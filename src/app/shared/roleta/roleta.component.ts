import { Component, OnDestroy, OnInit, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { IonButton, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { ClubeService } from '../../core/clube.service';
import { OpcaoSorteio, ResultadoBusca, Sorteio } from '../../core/modelos';
import { AvatarMembroComponent } from '../avatar/avatar-membro.component';
import { BuscaLivroComponent } from '../busca-livro/busca-livro.component';

// Cores da roleta (as cores do clube)
const CORES = [
  { fundo: '#D1325F', texto: '#FFFFFF' },
  { fundo: '#FDE3E7', texto: '#7A1230' },
  { fundo: '#7A1230', texto: '#FFFFFF' },
  { fundo: '#F7B4C0', texto: '#7A1230' },
  { fundo: '#D9A441', texto: '#2B0612' },
  { fundo: '#FFF3F1', texto: '#7A1230' },
];

const DURACAO_DO_GIRO = 5200; // em milissegundos

interface Fatia {
  caminho: string;
  fundo: string;
  corTexto: string;
  texto: string;
  giro: string;
}

// A roleta de livros: as sugestões viram fatias, e quem administra o clube gira no dia do sorteio.
// O resultado vem do servidor, então é o mesmo para todo mundo (e todo mundo vê girar ao vivo).
@Component({
  selector: 'app-roleta',
  imports: [IonButton, IonSpinner, AvatarMembroComponent, BuscaLivroComponent],
  template: `
    <section class="secao">
      <h2 class="titulo-serif">Roleta de livros</h2>
      <p class="data">{{ infoSorteio() }}</p>

      <div class="caixa">
        <div class="ponteiro" aria-hidden="true"></div>
        <svg
          class="roda"
          viewBox="0 0 220 220"
          role="img"
          aria-label="Roleta com os livros sugeridos"
          [style.transform]="'rotate(' + rotacao() + 'deg)'"
          [style.transition]="semAnimacao() ? 'none' : 'transform ' + duracao + 'ms cubic-bezier(0.12, 0.72, 0.1, 1)'"
        >
          <circle cx="110" cy="110" r="108" fill="#7A1230" />
          @if (fatias().length === 0) {
            <circle cx="110" cy="110" r="100" fill="#FDE3E7" />
            <text x="110" y="106" text-anchor="middle" font-size="12" font-weight="700" fill="#7A1230">Sugira um livro</text>
            <text x="110" y="124" text-anchor="middle" font-size="12" font-weight="700" fill="#7A1230">para a roleta!</text>
          } @else {
            @for (f of fatias(); track $index) {
              <path [attr.d]="f.caminho" [attr.fill]="f.fundo" stroke="#FFFFFF" stroke-width="1.6" />
              <g [attr.transform]="f.giro">
                <text x="140" y="113.4" [attr.font-size]="tamanhoDaFonte()" font-weight="700" [attr.fill]="f.corTexto">{{ f.texto }}</text>
              </g>
            }
          }
          <circle cx="110" cy="110" r="107" fill="none" stroke="#D9A441" stroke-width="3" />
        </svg>
        <div class="miolo" aria-hidden="true">📖</div>
      </div>

      @if (resultado(); as r) {
        <div class="resultado">
          <span class="faisca f1" aria-hidden="true">✨</span>
          <span class="faisca f2" aria-hidden="true">✨</span>
          <p class="suave">O livro sorteado foi</p>
          <h3>{{ r.vencedor_titulo }}</h3>
          @if (r.opcoes[r.indice]?.autor) {
            <p class="autor">{{ r.opcoes[r.indice].autor }}</p>
          }
        </div>
      }

      @if (auth.eAdmin()) {
        <ion-button expand="block" [disabled]="girando() || opcoes().length < 2 || !temAtivas()" (click)="girarAgora()">
          @if (girando()) {
            <ion-spinner name="dots"></ion-spinner>
          } @else {
            Girar a roleta 🎡
          }
        </ion-button>
        @if (temAtivas() && opcoes().length < 2) {
          <p class="suave">Precisa de pelo menos 2 sugestões para girar.</p>
        }
      } @else {
        <p class="suave">Quem administra o clube gira a roleta no dia do sorteio. Fique de olho: o resultado aparece aqui para todo mundo ao mesmo tempo!</p>
      }

      @if (mensagem()) {
        <p class="aviso" role="status">{{ mensagem() }}</p>
      }

      <div class="sugestoes">
        <h3 class="titulo-serif">Livros na roleta ({{ clube.sugestoes().length }})</h3>
        @for (s of clube.sugestoes(); track s.id) {
          <div class="sugestao">
            <div class="capa" style="width: 38px; height: 54px">
              @if (s.capa_url) {
                <img [src]="s.capa_url" alt="" loading="lazy" />
              } @else {
                <span>📖</span>
              }
            </div>
            <div class="info">
              <strong>{{ s.titulo }}</strong>
              @if (s.autor) {
                <span>{{ s.autor }}</span>
              }
              <span class="quem">
                <app-avatar-membro [membro]="s.quem" [tamanho]="18"></app-avatar-membro>
                sugerido por {{ s.quem?.nome ?? 'alguém' }}
              </span>
            </div>
            @if (s.sugerido_por === auth.perfil()?.id || auth.eAdmin()) {
              <button type="button" class="tirar" (click)="tirar(s.id)" [attr.aria-label]="'Tirar ' + s.titulo + ' da roleta'">✕</button>
            }
          </div>
        } @empty {
          <p class="suave">Ninguém sugeriu ainda. Seja a primeira pessoa! 📚</p>
        }
      </div>

      <div class="nova">
        <h3 class="titulo-serif">Sugira um livro</h3>
        @if (minhas() >= 1) {
          <p class="suave">
            Você já colocou o seu livro na roleta. 💌 Quer trocar? Toque no ✕ do seu livro na lista e escolha outro.
          </p>
        } @else {
          <app-busca-livro [(escolhido)]="novaSugestao" placeholder="Qual livro você quer ler?"></app-busca-livro>
          <ion-button expand="block" [disabled]="!novaSugestao() || enviando()" (click)="enviarSugestao()">
            @if (enviando()) {
              <ion-spinner name="dots"></ion-spinner>
            } @else {
              Colocar na roleta
            }
          </ion-button>
          <p class="suave">Cada pessoa pode colocar 1 livro por vez na roleta.</p>
        }
      </div>
    </section>
  `,
  styles: [
    `
      h2 {
        font-size: 1.55rem;
        margin-bottom: 2px;
      }
      h3 {
        font-size: 1.2rem;
        margin: 0 0 8px;
      }
      .data {
        margin: 0 0 12px;
        font-weight: 700;
        color: var(--cob-framboesa);
      }
      .caixa {
        position: relative;
        width: min(78vw, 300px);
        aspect-ratio: 1;
        margin: 8px auto 14px;
        filter: drop-shadow(0 10px 18px rgba(122, 18, 48, 0.28));
      }
      .roda {
        display: block;
        width: 100%;
        height: 100%;
      }
      .ponteiro {
        position: absolute;
        top: -10px;
        left: 50%;
        z-index: 2;
        width: 0;
        height: 0;
        margin-left: -13px;
        border-left: 13px solid transparent;
        border-right: 13px solid transparent;
        border-top: 26px solid #d9a441;
        filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.3));
      }
      .miolo {
        position: absolute;
        top: 50%;
        left: 50%;
        z-index: 2;
        width: 17%;
        aspect-ratio: 1;
        margin: -8.5% 0 0 -8.5%;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: #fff3f1;
        border: 4px solid #d9a441;
        font-size: 1.3rem;
      }
      .resultado {
        position: relative;
        margin: 6px 0 14px;
        padding: 14px;
        border-radius: 18px;
        background: linear-gradient(120deg, #fff1cf, #fde3e7);
        text-align: center;
      }
      .resultado p {
        margin: 0;
      }
      .resultado h3 {
        margin: 2px 0 0;
        font-family: 'Fraunces', Georgia, serif;
        font-size: 1.5rem;
        color: var(--cob-vinho);
      }
      .resultado .autor {
        font-weight: 700;
        color: #8c5a68;
      }
      .faisca {
        position: absolute;
        font-size: 1.4rem;
        animation: faisca 1.8s ease-in-out infinite;
      }
      .f1 { top: 6px; left: 12px; }
      .f2 { top: 10px; right: 14px; animation-delay: 0.6s; }
      @keyframes faisca {
        0%, 100% { transform: scale(0.8) rotate(0); opacity: 0.6; }
        50% { transform: scale(1.25) rotate(14deg); opacity: 1; }
      }
      .sugestoes,
      .nova {
        margin-top: 20px;
        padding-top: 14px;
        border-top: 1.5px dashed #f0b9c4;
      }
      .nova {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .nova h3 {
        margin-bottom: 0;
      }
      .sugestao {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 0;
      }
      .info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        flex: 1;
      }
      .info span {
        color: #8c5a68;
        font-size: 0.86rem;
      }
      .quem {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .tirar {
        width: 32px;
        height: 32px;
        flex-shrink: 0;
        border: none;
        border-radius: 50%;
        background: #fde8ec;
        color: #b3122f;
        font-weight: 700;
        cursor: pointer;
      }
      p {
        margin: 8px 0 0;
      }
    `,
  ],
})
export class RoletaComponent implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  protected readonly clube = inject(ClubeService);

  protected readonly duracao = DURACAO_DO_GIRO;
  protected readonly rotacao = signal(0);
  protected readonly semAnimacao = signal(true);
  protected readonly girando = signal(false);
  protected readonly resultado = signal<Sorteio | null>(null);
  // Durante e logo depois do sorteio, a roleta mostra a "foto" das opções da hora do sorteio
  private readonly foto = signal<Sorteio | null>(null);

  protected readonly mensagem = signal('');
  protected readonly novaSugestao = signal<ResultadoBusca | null>(null);
  protected readonly enviando = signal(false);

  private readonly busca = viewChild(BuscaLivroComponent);
  private temporizadores: ReturnType<typeof setTimeout>[] = [];

  protected readonly temAtivas = computed(() => this.clube.sugestoes().length > 0);

  protected readonly opcoes = computed<OpcaoSorteio[]>(() => {
    const foto = this.foto();
    if (foto) return foto.opcoes;
    return this.clube.sugestoes().map((s) => ({ id: s.id, titulo: s.titulo, autor: s.autor, capa_url: s.capa_url }));
  });

  protected readonly tamanhoDaFonte = computed(() => {
    const n = this.opcoes().length;
    return n > 14 ? 6.5 : n > 8 ? 8 : 9.6;
  });

  protected readonly fatias = computed<Fatia[]>(() => {
    const opcoes = this.opcoes();
    const n = opcoes.length;
    if (n === 0) return [];
    const passo = 360 / n;
    // quantas letras cabem do miolo até a borda, conforme o tamanho da letra
    const fonte = n > 14 ? 6.5 : n > 8 ? 8 : 9.6;
    const limite = Math.floor(64 / (fonte * 0.58));
    return opcoes.map((o, i) => {
      let cor = CORES[i % CORES.length];
      if (i === n - 1 && n > 1 && i % CORES.length === 0) cor = CORES[3]; // a última fatia nunca igual à primeira
      const texto = o.titulo.length > limite ? o.titulo.slice(0, limite - 1).trimEnd() + '…' : o.titulo;
      const caminho =
        n === 1
          ? 'M110 10 A100 100 0 1 1 109.99 10 Z'
          : this.caminhoDaFatia(i * passo, (i + 1) * passo);
      return {
        caminho,
        fundo: cor.fundo,
        corTexto: cor.texto,
        texto,
        giro: `rotate(${n === 1 ? -90 : i * passo + passo / 2 - 90} 110 110)`,
      };
    });
  });

  protected readonly minhas = computed(
    () => this.clube.sugestoes().filter((s) => s.sugerido_por === this.auth.perfil()?.id).length,
  );

  protected readonly infoSorteio = computed(() => {
    const data = this.clube.dados().data_sorteio;
    if (!data) return 'A data do sorteio ainda vai ser combinada.';
    const [ano, mes, dia] = data.split('-').map(Number);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dias = Math.round((new Date(ano, mes - 1, dia).getTime() - hoje.getTime()) / 86400000);
    const bonito = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
    if (dias > 1) return `Sorteio dia ${bonito} · faltam ${dias} dias`;
    if (dias === 1) return `O sorteio é amanhã (${bonito})!`;
    if (dias === 0) return `O sorteio é hoje! (${bonito}) 🎉`;
    return `O sorteio estava marcado para ${bonito}`;
  });

  constructor() {
    // Quando o servidor avisa que a roleta girou, ela gira aqui também
    effect(() => {
      const sorteio = this.clube.sorteioAoVivo();
      if (sorteio) untracked(() => this.girar(sorteio));
    });
    // Quando chegam sugestões novas depois de um sorteio, a roleta volta a mostrar as sugestões atuais
    effect(() => {
      const ativas = this.clube.sugestoes().length;
      untracked(() => {
        if (ativas > 0 && !this.girando() && this.foto()) {
          this.foto.set(null);
          this.resultado.set(null);
          this.semAnimacao.set(true);
          this.rotacao.set(0);
        }
      });
    });
  }

  async ngOnInit() {
    this.clube.escutar();
    await this.clube.carregar();
    this.mostrarUltimoSorteio();
  }

  ngOnDestroy() {
    this.temporizadores.forEach(clearTimeout);
    this.clube.parar();
  }

  // Se não há sugestões novas, mostra a roleta parada no resultado do último sorteio
  private mostrarUltimoSorteio() {
    const ultimo = this.clube.ultimoSorteio();
    if (!ultimo || this.clube.sugestoes().length > 0 || this.girando()) return;
    this.foto.set(ultimo);
    this.resultado.set(ultimo);
    this.semAnimacao.set(true);
    this.rotacao.set(this.anguloFinal(ultimo));
  }

  private girar(sorteio: Sorteio) {
    this.temporizadores.forEach(clearTimeout);
    this.foto.set(sorteio);
    this.resultado.set(null);
    this.girando.set(true);
    this.semAnimacao.set(true);
    this.rotacao.set(0);
    this.temporizadores = [
      setTimeout(() => {
        this.semAnimacao.set(false);
        this.rotacao.set(360 * 6 + this.anguloFinal(sorteio));
      }, 80),
      setTimeout(() => {
        this.girando.set(false);
        this.resultado.set(sorteio);
      }, DURACAO_DO_GIRO + 200),
    ];
  }

  // O quanto a roda precisa virar para a fatia vencedora ficar embaixo do ponteiro (que fica em cima)
  private anguloFinal(sorteio: Sorteio): number {
    const passo = 360 / Math.max(1, sorteio.opcoes.length);
    return 360 - (sorteio.indice + 0.5) * passo;
  }

  protected async girarAgora() {
    this.mensagem.set('');
    const erro = await this.clube.sortear();
    if (erro) this.mensagem.set(erro);
  }

  protected async enviarSugestao() {
    const livro = this.novaSugestao();
    if (!livro) return;
    this.enviando.set(true);
    this.mensagem.set('');
    const erro = await this.clube.sugerir(livro);
    this.enviando.set(false);
    if (erro) {
      this.mensagem.set(erro);
      return;
    }
    this.busca()?.limpar();
  }

  protected async tirar(id: string) {
    await this.clube.removerSugestao(id);
  }

  private ponto(angulo: number, raio: number): [number, number] {
    const rad = (angulo * Math.PI) / 180;
    return [Math.round((110 + raio * Math.sin(rad)) * 100) / 100, Math.round((110 - raio * Math.cos(rad)) * 100) / 100];
  }

  private caminhoDaFatia(a1: number, a2: number): string {
    const [x1, y1] = this.ponto(a1, 100);
    const [x2, y2] = this.ponto(a2, 100);
    return `M110 110 L${x1} ${y1} A100 100 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${x2} ${y2} Z`;
  }
}

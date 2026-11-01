import { Component, computed, inject, signal } from '@angular/core';
import { IonButton, IonContent, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { DesafiosService } from '../../core/desafios.service';
import { Desafio, NOMES_DOS_NIVEIS, NivelAvatar, UNIDADES, nivelDoPerfil } from '../../core/modelos';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { AvatarMembroComponent } from '../../shared/avatar/avatar-membro.component';
import { CriarDesafioComponent } from '../../shared/criar-desafio/criar-desafio.component';
import { DesafioDetalheComponent } from '../../shared/desafio-detalhe/desafio-detalhe.component';
import { TopoComponent } from '../../shared/topo/topo.component';

interface InfoDoNivel {
  nivel: NivelAvatar;
  nome: string;
  regra: string;
}

const NIVEIS: InfoDoNivel[] = [
  { nivel: 'inicial', nome: NOMES_DOS_NIVEIS.inicial, regra: 'Ainda não entrou em nenhum desafio' },
  { nivel: 'bronze', nome: NOMES_DOS_NIVEIS.bronze, regra: 'Entrou em um desafio (até 2 vitórias)' },
  { nivel: 'prata', nome: NOMES_DOS_NIVEIS.prata, regra: '3 vitórias' },
  { nivel: 'ouro', nome: NOMES_DOS_NIVEIS.ouro, regra: '6 vitórias' },
  { nivel: 'diamante', nome: NOMES_DOS_NIVEIS.diamante, regra: '10 vitórias' },
];

const COR_DO_TROFEU: Record<NivelAvatar, string> = {
  inicial: '#B8742F',
  bronze: '#B8742F',
  prata: '#AEB7C4',
  ouro: '#E3B02C',
  diamante: '#6FD8EE',
};

@Component({
  selector: 'app-desafios',
  imports: [
    IonContent,
    IonButton,
    IonSpinner,
    TopoComponent,
    AvatarComponent,
    AvatarMembroComponent,
    CriarDesafioComponent,
    DesafioDetalheComponent,
  ],
  template: `
    <app-topo titulo="Desafios" enfeite="📚"></app-topo>
    <ion-content [fullscreen]="true">
      <section class="secao explicacao">
        <h1 class="titulo-serif">Desafios de leitura 🏆</h1>
        <p>
          Aqui o clube vira uma competição amiga. Você pode <strong>criar desafios do jeito que quiser</strong>: ler um livro em
          pouco tempo, ler um livro que comece com a letra X, ler um livro de uma certa cor… A criatividade é sua!
        </p>
        <p>
          <strong>Convide outras pessoas</strong>, acompanhem o progresso de cada uma numa corrida e vejam quem está na frente. Quem
          vence ganha um <strong>troféu</strong>, e o aro ao redor do seu avatar vai evoluindo: vinho, bronze, prata, ouro e diamante.
        </p>
        <ion-button expand="block" (click)="criando.set(true)">Criar um desafio 🏆</ion-button>
      </section>

      @if (desafios.convites().length > 0) {
        <section class="secao convites">
          <h2 class="titulo-serif">Convites para você 💌</h2>
          @for (d of desafios.convites(); track d.id) {
            <div class="convite">
              <div class="texto">
                <strong>{{ d.titulo }}</strong>
                <span>Meta: {{ d.meta }} {{ plural(d) }}</span>
              </div>
              <div class="botoes">
                <ion-button size="small" (click)="responder(d.id, true)">Aceitar</ion-button>
                <ion-button size="small" fill="outline" (click)="responder(d.id, false)">Recusar</ion-button>
                <button type="button" class="pilula" (click)="abrir(d.id)">Ver</button>
              </div>
            </div>
          }
        </section>
      }

      <section class="secao">
        <h2 class="titulo-serif">Meus desafios</h2>
        @if (!desafios.carregado()) {
          <div class="centro"><ion-spinner name="dots"></ion-spinner></div>
        }
        @for (d of ativos(); track d.id) {
          <button type="button" class="cartao-desafio" (click)="abrir(d.id)">
            <div class="linha">
              <strong>{{ d.titulo }}</strong>
              <span class="chip">Em andamento</span>
            </div>
            <span class="detalhe">{{ d.participantes.length }} {{ d.participantes.length === 1 ? 'pessoa' : 'pessoas' }} · meta {{ d.meta }} {{ plural(d) }}</span>
            <div class="barra" aria-hidden="true"><div class="enchimento" [style.width.%]="meuPercentual(d)"></div></div>
            <span class="detalhe">Você: {{ meuProgresso(d) }} / {{ d.meta }}</span>
          </button>
        }
        @for (d of terminados(); track d.id) {
          <button type="button" class="cartao-desafio encerrado" (click)="abrir(d.id)">
            <div class="linha">
              <strong>{{ d.titulo }}</strong>
              <span class="chip" [class.cancelado]="d.status === 'cancelado'">{{ d.status === 'encerrado' ? 'Encerrado' : 'Cancelado' }}</span>
            </div>
          </button>
        }
        @if (desafios.carregado() && desafios.meus().length === 0) {
          <p class="suave">Você ainda não está em nenhum desafio. Crie o primeiro e convide o pessoal!</p>
        }
      </section>

      <section class="secao">
        <h2 class="titulo-serif">Meu nível</h2>
        <div class="meu">
          <app-avatar-membro [membro]="auth.perfil()" [tamanho]="92"></app-avatar-membro>
          <div class="dados">
            <strong class="nivel">{{ nomeDoMeuNivel() }}</strong>
            <span>
              {{ vitorias() }} {{ vitorias() === 1 ? 'troféu' : 'troféus' }} ·
              {{ participacoes() }} {{ participacoes() === 1 ? 'desafio' : 'desafios' }}
            </span>
            @if (proximo(); as p) {
              <span class="prox">Faltam {{ p.faltam }} {{ p.faltam === 1 ? 'vitória' : 'vitórias' }} para o nível {{ p.nome }}</span>
            } @else {
              <span class="prox">Você chegou ao nível máximo! 💎</span>
            }
          </div>
        </div>

        <h3 class="titulo-serif">Meus troféus</h3>
        @if (vitorias() > 0) {
          <div class="prateleira">
            @for (t of trofeusParaMostrar(); track $index) {
              <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
                <path d="M7 3h10v6a5 5 0 0 1-10 0V3z" [attr.fill]="corDoTrofeu()" />
                <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" [attr.stroke]="corDoTrofeu()" stroke-width="1.7" fill="none" stroke-linecap="round" />
                <path d="M12 14v4M8.5 21h7M10 18h4" [attr.stroke]="corDoTrofeu()" stroke-width="2" stroke-linecap="round" fill="none" />
              </svg>
            }
          </div>
        } @else {
          <p class="suave">Sua prateleira ainda está vazia. O primeiro troféu vem quando você ganhar um desafio!</p>
        }
      </section>

      <section class="secao">
        <h2 class="titulo-serif">Os níveis</h2>
        @for (n of niveis; track n.nivel) {
          <div class="nivel-linha">
            <app-avatar [avatarId]="auth.perfil()?.avatar_id" [tamanho]="46" [nivel]="n.nivel"></app-avatar>
            <div>
              <strong>{{ n.nome }}</strong>
              <span>{{ n.regra }}</span>
            </div>
          </div>
        }
      </section>

      <section class="secao">
        <h2 class="titulo-serif">Placar de troféus</h2>
        @for (m of placar(); track m.id; let i = $index) {
          <div class="placar-linha">
            <span class="pos">{{ i + 1 }}º</span>
            <app-avatar-membro [membro]="m" [tamanho]="44"></app-avatar-membro>
            <div class="info">
              <strong>{{ m.nome }}</strong>
              <span>{{ m.participacoes }} {{ m.participacoes === 1 ? 'desafio' : 'desafios' }}</span>
            </div>
            <span class="quantos">🏆 {{ m.vitorias }}</span>
          </div>
        } @empty {
          <p class="suave">Ninguém entrou em desafio ainda. Seja a primeira pessoa a competir!</p>
        }
      </section>

      <app-criar-desafio [aberto]="criando()" (fechar)="criando.set(false)"></app-criar-desafio>
      <app-desafio-detalhe [desafioId]="aberto()" (fechar)="aberto.set(null)"></app-desafio-detalhe>
    </ion-content>
  `,
  styles: [
    `
      .explicacao h1 {
        font-size: 1.7rem;
        margin-bottom: 6px;
      }
      .explicacao p {
        margin: 8px 0 0;
        line-height: 1.5;
      }
      .explicacao ion-button {
        margin-top: 14px;
      }
      h2 {
        font-size: 1.5rem;
        margin-bottom: 8px;
      }
      h3 {
        font-size: 1.15rem;
        margin: 16px 0 6px;
      }
      .convite {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px 0;
        border-bottom: 1px solid #f7dde2;
      }
      .convite:last-child {
        border-bottom: none;
      }
      .convite .texto {
        display: flex;
        flex-direction: column;
      }
      .convite .texto span {
        color: #8c5a68;
        font-size: 0.85rem;
      }
      .botoes {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .cartao-desafio {
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 100%;
        margin-bottom: 10px;
        padding: 12px 14px;
        border: 1.5px solid #f0b9c4;
        border-radius: 16px;
        background: #fff;
        font-family: inherit;
        color: inherit;
        text-align: left;
        cursor: pointer;
      }
      .cartao-desafio.encerrado {
        opacity: 0.8;
      }
      .linha {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .chip {
        flex-shrink: 0;
        padding: 2px 10px;
        border-radius: 999px;
        background: var(--cob-framboesa);
        color: #fff;
        font-size: 0.72rem;
        font-weight: 700;
      }
      .encerrado .chip { background: #c9922b; }
      .chip.cancelado { background: #8c5a68; }
      .detalhe {
        font-size: 0.85rem;
        color: #8c5a68;
      }
      .barra {
        height: 10px;
        border-radius: 999px;
        background: #fde3e7;
        overflow: hidden;
      }
      .enchimento {
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, #f7b4c0, #d1325f);
        transition: width 0.6s ease;
      }
      .meu {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .dados {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .nivel {
        font-family: 'Fraunces', Georgia, serif;
        font-size: 1.5rem;
        color: var(--cob-vinho);
      }
      .dados span {
        color: #8c5a68;
        font-size: 0.9rem;
      }
      .dados .prox {
        color: var(--cob-framboesa);
        font-weight: 700;
      }
      .prateleira {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 10px;
        border-radius: 14px;
        background: #fff3f1;
      }
      .nivel-linha,
      .placar-linha {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 8px 0;
      }
      .nivel-linha div,
      .info {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
      }
      .nivel-linha span,
      .info span {
        color: #8c5a68;
        font-size: 0.85rem;
      }
      .pos {
        width: 30px;
        font-family: 'Fraunces', Georgia, serif;
        font-weight: 700;
        font-size: 1.15rem;
        color: var(--cob-framboesa);
      }
      .quantos {
        font-weight: 700;
      }
      .centro {
        display: flex;
        justify-content: center;
      }
    `,
  ],
})
export class DesafiosPage {
  protected readonly auth = inject(AuthService);
  protected readonly desafios = inject(DesafiosService);
  protected readonly niveis = NIVEIS;

  protected readonly criando = signal(false);
  protected readonly aberto = signal<string | null>(null);

  protected readonly vitorias = computed(() => this.auth.perfil()?.vitorias ?? 0);
  protected readonly participacoes = computed(() => this.auth.perfil()?.participacoes ?? 0);
  protected readonly nivelAtual = computed(() => nivelDoPerfil(this.auth.perfil()));
  protected readonly nomeDoMeuNivel = computed(() => NOMES_DOS_NIVEIS[this.nivelAtual()]);
  protected readonly corDoTrofeu = computed(() => COR_DO_TROFEU[this.nivelAtual()]);
  protected readonly trofeusParaMostrar = computed(() => Array.from({ length: Math.min(this.vitorias(), 15) }));

  protected readonly ativos = computed(() => this.desafios.meus().filter((d) => d.status === 'ativo'));
  protected readonly terminados = computed(() => this.desafios.meus().filter((d) => d.status !== 'ativo'));

  // Quantas vitórias faltam para o próximo nível
  protected readonly proximo = computed(() => {
    const v = this.vitorias();
    const metas = [
      { vitorias: 3, nome: NOMES_DOS_NIVEIS.prata },
      { vitorias: 6, nome: NOMES_DOS_NIVEIS.ouro },
      { vitorias: 10, nome: NOMES_DOS_NIVEIS.diamante },
    ];
    const meta = metas.find((m) => v < m.vitorias);
    return meta ? { nome: meta.nome, faltam: meta.vitorias - v } : null;
  });

  // Só quem já entrou em algum desafio aparece no placar
  protected readonly placar = computed(() =>
    this.auth
      .membros()
      .filter((m) => m.participacoes > 0 || m.vitorias > 0)
      .sort((a, b) => b.vitorias - a.vitorias || b.participacoes - a.participacoes || a.nome.localeCompare(b.nome)),
  );

  async ionViewWillEnter() {
    await Promise.all([this.desafios.carregar(), this.auth.carregarMembros(), this.auth.recarregarPerfil()]);
  }

  protected abrir(id: string) {
    this.aberto.set(id);
  }

  protected async responder(id: string, aceitar: boolean) {
    await this.desafios.responder(id, aceitar);
  }

  protected plural(d: Desafio): string {
    return UNIDADES.find((u) => u.valor === d.unidade)?.plural ?? '';
  }

  protected meuProgresso(d: Desafio): number {
    return d.participantes.find((p) => p.perfil_id === this.auth.perfil()?.id)?.progresso ?? 0;
  }

  protected meuPercentual(d: Desafio): number {
    return Math.min(100, (this.meuProgresso(d) / d.meta) * 100);
  }
}

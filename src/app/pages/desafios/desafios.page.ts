import { Component, computed, inject, signal } from '@angular/core';
import { IonButton, IonContent, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { NOMES_DOS_NIVEIS, NivelAvatar, nivelDoPerfil } from '../../core/modelos';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { AvatarMembroComponent } from '../../shared/avatar/avatar-membro.component';
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
  imports: [IonContent, IonButton, IonSpinner, TopoComponent, AvatarComponent, AvatarMembroComponent],
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
          <strong>Convide outras pessoas</strong>, acompanhem o progresso de cada uma e vejam quem está na frente. Quem vence ganha
          um <strong>troféu</strong>, e o aro ao redor do seu avatar vai evoluindo: vinho, bronze, prata, ouro e diamante.
        </p>
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
        <h2 class="titulo-serif">Meus desafios</h2>
        <p class="suave">Você ainda não está em nenhum desafio.</p>
        <ion-button expand="block" disabled>Criar um desafio (chega no próximo bloco)</ion-button>
        <p class="suave pequeno">
          No próximo bloco você poderá escolher o tipo do desafio, convidar as pessoas (elas recebem um aviso) e acompanhar o progresso de cada uma num chat só do desafio.
        </p>
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
        @if (carregando()) {
          <div class="centro"><ion-spinner name="dots"></ion-spinner></div>
        }
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
          @if (!carregando()) {
            <p class="suave">Ninguém entrou em desafio ainda. Seja a primeira pessoa a competir!</p>
          }
        }
      </section>
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
      h2 {
        font-size: 1.5rem;
        margin-bottom: 8px;
      }
      h3 {
        font-size: 1.15rem;
        margin: 16px 0 6px;
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
      .pequeno {
        font-size: 0.85rem;
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
  protected readonly niveis = NIVEIS;
  protected readonly carregando = signal(true);

  protected readonly vitorias = computed(() => this.auth.perfil()?.vitorias ?? 0);
  protected readonly participacoes = computed(() => this.auth.perfil()?.participacoes ?? 0);
  protected readonly nivelAtual = computed(() => nivelDoPerfil(this.auth.perfil()));
  protected readonly nomeDoMeuNivel = computed(() => NOMES_DOS_NIVEIS[this.nivelAtual()]);
  protected readonly corDoTrofeu = computed(() => COR_DO_TROFEU[this.nivelAtual()]);
  protected readonly trofeusParaMostrar = computed(() => Array.from({ length: Math.min(this.vitorias(), 15) }));

  // Quantas vitórias faltam para o próximo nível
  protected readonly proximo = computed(() => {
    const v = this.vitorias();
    const metas: { vitorias: number; nome: string }[] = [
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
    await this.auth.carregarMembros();
    this.carregando.set(false);
  }
}

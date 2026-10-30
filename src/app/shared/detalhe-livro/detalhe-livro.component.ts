import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { IonButton, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { ClubeService } from '../../core/clube.service';
import { LivrosApiService } from '../../core/livros-api.service';
import { CONTEXTOS, ContextoLeitura, ResultadoBusca } from '../../core/modelos';
import { LivrosLidosService } from '../../core/livros-lidos.service';

// A "ficha" de um livro: capa, dados, descrição (da Open Library) e ações (sugerir para a roleta, marcar como lido).
@Component({
  selector: 'app-detalhe-livro',
  imports: [IonButton, IonSpinner],
  template: `
    @if (livro(); as l) {
      <div class="sobreposicao">
        <div class="sobreposicao-fundo" (click)="fechar.emit()"></div>
        <div class="cartao-flutuante" role="dialog" aria-modal="true" [attr.aria-label]="l.titulo">
          <button type="button" class="x" (click)="fechar.emit()" aria-label="Fechar">✕</button>

          <div class="cabeca">
            <div class="capa" style="width: 104px; height: 152px">
              @if (l.capa_url) {
                <img [src]="l.capa_url" alt="" />
              } @else {
                <span style="font-size: 2.4rem">📖</span>
              }
            </div>
            <div class="dados">
              <h2 class="titulo-serif">{{ l.titulo }}</h2>
              @if (l.autor) {
                <p class="autor">{{ l.autor }}</p>
              }
              @if (meta()) {
                <p class="meta">{{ meta() }}</p>
              }
            </div>
          </div>

          @if (carregando()) {
            <div class="centro"><ion-spinner name="dots"></ion-spinner></div>
          }
          @if (descricao()) {
            <p class="descricao">{{ descricao() }}</p>
          } @else if (!carregando()) {
            <p class="suave">Esse livro ainda não tem descrição por aqui.</p>
          }

          @if (l.chave_ol) {
            <a class="fonte" [href]="'https://openlibrary.org/works/' + l.chave_ol" target="_blank" rel="noopener noreferrer">
              Ver na Open Library ↗
            </a>
          }

          <div class="acoes">
            @if (modo() === 'descobrir') {
              <ion-button expand="block" fill="outline" [disabled]="jaSugeriu() || enviando()" (click)="sugerir()">
                🎡 Sugerir para a roleta
              </ion-button>
              @if (jaSugeriu()) {
                <p class="suave pequeno">Você já tem um livro na roleta. Tire o seu (na aba Início) para sugerir outro.</p>
              }
            }

            <span class="rotulo-campo">Já li este livro</span>
            <div class="fichas">
              @for (c of contextos; track c.valor) {
                <button type="button" class="pilula" [class.ativa]="contexto() === c.valor" (click)="contexto.set(c.valor)">
                  {{ c.nome }}
                </button>
              }
            </div>
            <ion-button expand="block" [disabled]="enviando()" (click)="marcarComoLido()">
              ✓ Adicionar à minha lista de lidos
            </ion-button>
          </div>

          @if (mensagem()) {
            <p class="aviso" role="status">{{ mensagem() }}</p>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .x {
        position: absolute;
        top: 10px;
        right: 12px;
        width: 34px;
        height: 34px;
        border: none;
        border-radius: 50%;
        background: #fde3e7;
        color: var(--cob-vinho);
        font-weight: 700;
        cursor: pointer;
      }
      .cabeca {
        display: flex;
        gap: 16px;
        padding-right: 28px;
      }
      h2 {
        margin: 0;
        font-size: 1.5rem;
        line-height: 1.15;
      }
      .autor {
        margin: 6px 0 0;
        font-weight: 700;
        color: #8c5a68;
      }
      .meta {
        margin: 4px 0 0;
        font-size: 0.88rem;
        color: #8c5a68;
      }
      .descricao {
        margin: 16px 0 0;
        line-height: 1.55;
        overflow-wrap: anywhere;
      }
      .fonte {
        display: inline-block;
        margin-top: 10px;
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--cob-framboesa);
      }
      .centro {
        display: flex;
        justify-content: center;
        padding: 10px;
      }
      .acoes {
        margin-top: 16px;
        padding-top: 14px;
        border-top: 1.5px dashed #f0b9c4;
      }
      .acoes ion-button {
        margin-top: 8px;
      }
      .rotulo-campo {
        margin-top: 16px;
      }
      .fichas {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .pequeno {
        font-size: 0.82rem;
        margin: 4px 0 0;
      }
      p {
        margin-bottom: 0;
      }
    `,
  ],
})
export class DetalheLivroComponent {
  private readonly api = inject(LivrosApiService);
  private readonly clube = inject(ClubeService);
  private readonly lidos = inject(LivrosLidosService);
  private readonly auth = inject(AuthService);

  // O livro que está sendo mostrado (nada = fechado)
  readonly livro = input<ResultadoBusca | null>(null);
  // "clube" = livro da estante do clube; "descobrir" = livro do mostruário (pode ser sugerido para a roleta)
  readonly modo = input<'clube' | 'descobrir'>('descobrir');
  readonly fechar = output<void>();

  protected readonly contextos = CONTEXTOS;
  protected readonly contexto = signal<ContextoLeitura>('fora_do_clube');
  protected readonly extras = signal<{ descricao: string | null; paginas: number | null; ano: number | null } | null>(null);
  protected readonly carregando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly mensagem = signal('');

  protected readonly descricao = computed(() => this.livro()?.descricao ?? this.extras()?.descricao ?? null);
  protected readonly meta = computed(() => {
    const l = this.livro();
    if (!l) return '';
    const ano = l.ano ?? this.extras()?.ano;
    const paginas = l.paginas ?? this.extras()?.paginas;
    return [ano ? String(ano) : '', paginas ? `${paginas} páginas` : ''].filter(Boolean).join(' · ');
  });

  protected readonly jaSugeriu = computed(
    () => this.clube.sugestoes().some((s) => s.sugerido_por === this.auth.perfil()?.id),
  );

  constructor() {
    effect(() => {
      const l = this.livro();
      untracked(() => void this.abrir(l));
    });
  }

  private async abrir(l: ResultadoBusca | null) {
    this.extras.set(null);
    this.mensagem.set('');
    if (!l) return;
    this.contexto.set(this.modo() === 'clube' ? 'no_clube' : 'fora_do_clube');
    void this.clube.carregarSugestoes();
    // Se faltar descrição, páginas ou ano, pergunta para a Open Library
    if (l.chave_ol && (!l.descricao || !l.paginas || !l.ano)) {
      this.carregando.set(true);
      try {
        const extras = await this.api.completar(l.chave_ol);
        if (this.livro()?.chave_ol === l.chave_ol) this.extras.set(extras);
      } catch {
        // sem os extras, mostramos só o que já temos
      }
      this.carregando.set(false);
    }
  }

  // O livro completo (com o que veio da Open Library), pronto para salvar
  private completo(): ResultadoBusca | null {
    const l = this.livro();
    if (!l) return null;
    const e = this.extras();
    return { ...l, descricao: l.descricao ?? e?.descricao ?? null, paginas: l.paginas ?? e?.paginas ?? null, ano: l.ano ?? e?.ano ?? null };
  }

  protected async sugerir() {
    const l = this.completo();
    if (!l) return;
    this.enviando.set(true);
    const erro = await this.clube.sugerir(l);
    this.enviando.set(false);
    this.mensagem.set(erro || 'Seu livro entrou na roleta! 🎡');
  }

  protected async marcarComoLido() {
    const l = this.completo();
    const meuId = this.auth.perfil()?.id;
    if (!l || !meuId) return;
    this.enviando.set(true);
    const erro = await this.lidos.adicionar(l, this.contexto(), meuId);
    this.enviando.set(false);
    this.mensagem.set(erro || 'Adicionado aos seus livros lidos! 📚');
  }
}

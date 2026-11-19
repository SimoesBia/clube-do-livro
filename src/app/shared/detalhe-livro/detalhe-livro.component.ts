import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { IonButton, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { ClubeService } from '../../core/clube.service';
import { LivrosApiService } from '../../core/livros-api.service';
import { CONTEXTOS, ContextoLeitura, ResultadoBusca, STATUS_LEITURA, StatusLeitura } from '../../core/modelos';
import { LivrosLidosService } from '../../core/livros-lidos.service';

// A "ficha" de um livro: capa, dados, descrição em português e ações (sugerir para a roleta, marcar como lido).
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
          @if (descricaoMostrada()) {
            <p class="descricao">{{ descricaoMostrada() }}</p>
            @if (traduzida()) {
              <p class="suave pequeno">
                Tradução automática.
                <button type="button" class="link" (click)="traduzida.set(null)">Ver o texto original</button>
              </p>
            } @else if (pareceIngles()) {
              <button type="button" class="pilula traduzir" [disabled]="traduzindo()" (click)="traduzir()">
                {{ traduzindo() ? 'Traduzindo…' : '🌐 Traduzir para português' }}
              </button>
            }
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

            @if (modo() === 'clube' && auth.eAdmin() && idDoLivro()) {
              <ion-button expand="block" fill="outline" color="danger" [disabled]="enviando()" (click)="remover()">
                🗑️ Arquivar livro (só administração)
              </ion-button>
            }

            @if (auth.perfil()) {
              <span class="rotulo-campo">Minha leitura</span>
              @if (registro(); as salvo) {
                <span class="suave">Salvo em {{ nomeDoStatus(salvo.status_leitura) }}</span>
              }
              <div class="fichas">
                <button type="button" class="pilula" [class.ativa]="querLer()" [attr.aria-pressed]="querLer()"
                  [disabled]="enviando() || carregandoLeitura()" (click)="alternarQueroLer()">
                  {{ querLer() ? '♥' : '♡' }} Quero ler
                </button>
                @for (status of opcoesLeitura; track status.valor) {
                  <button type="button" class="pilula" [class.ativa]="statusEscolhido() === status.valor"
                    [attr.aria-pressed]="statusEscolhido() === status.valor"
                    [disabled]="enviando() || carregandoLeitura()" (click)="statusEscolhido.set(status.valor)">
                    {{ status.nome }}
                  </button>
                }
              </div>
              @if (statusEscolhido(); as status) {
                @if (status === 'lido') {
                  <span class="rotulo-campo">Quando você leu?</span>
                  <div class="fichas">
                    @for (c of contextos; track c.valor) {
                      <button type="button" class="pilula" [class.ativa]="contexto() === c.valor"
                        [disabled]="enviando()" (click)="contexto.set(c.valor)">{{ c.nome }}</button>
                    }
                  </div>
                }
                <ion-button expand="block" [disabled]="enviando() || carregandoLeitura()" (click)="salvarLeitura(status)">
                  Salvar status
                </ion-button>
              }
            }
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
      .traduzir {
        margin-top: 10px;
      }
      .link {
        border: none;
        background: none;
        padding: 0;
        color: var(--cob-framboesa);
        font-family: inherit;
        font-weight: 700;
        text-decoration: underline;
        cursor: pointer;
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
  protected readonly auth = inject(AuthService);

  // O livro que está sendo mostrado (nada = fechado)
  readonly livro = input<ResultadoBusca | null>(null);
  // "clube" = livro da estante do clube; "descobrir" = livro do mostruário (pode ser sugerido para a roleta)
  readonly modo = input<'clube' | 'descobrir' | 'perfil'>('descobrir');
  readonly idDoLivro = input<string | null>(null); // só para livros da estante (permite remover)
  readonly fechar = output<void>();
  readonly removido = output<void>();

  protected readonly contextos = CONTEXTOS;
  protected readonly opcoesLeitura = [
    { valor: 'lendo', nome: 'Lendo agora' },
    { valor: 'lido', nome: 'Já li' },
    { valor: 'abandonado', nome: 'Abandonei' },
  ] as const;
  protected readonly statusEscolhido = signal<StatusLeitura | null>(null);
  protected readonly carregandoLeitura = signal(false);
  protected readonly registro = computed(() => {
    const livro = this.livro();
    return livro ? this.lidos.registro(livro) : undefined;
  });
  protected readonly querLer = computed(() => this.registro()?.status_leitura === 'quero_ler');
  private aberturaLeitura = 0;

  protected readonly contexto = signal<ContextoLeitura>('fora_do_clube');
  protected readonly extras = signal<{ descricao: string | null; paginas: number | null; ano: number | null } | null>(null);
  protected readonly carregando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly mensagem = signal('');
  protected readonly traduzida = signal<string | null>(null);
  protected readonly traduzindo = signal(false);

  protected readonly descricao = computed(() => this.livro()?.descricao ?? this.extras()?.descricao ?? null);
  protected readonly descricaoMostrada = computed(() => this.traduzida() ?? this.descricao());
  protected readonly pareceIngles = computed(() => pareceIngles(this.descricao()));
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
      const perfilId = this.auth.perfil()?.id;
      untracked(() => void this.carregarLeitura(l, perfilId));
    });
    effect(() => {
      const l = this.livro();
      untracked(() => void this.abrir(l));
    });
  }

  private async abrir(l: ResultadoBusca | null) {
    this.extras.set(null);
    this.traduzida.set(null);
    this.mensagem.set('');
    if (!l) return;
    if (this.modo() === 'descobrir') void this.clube.carregarSugestoes();
    // Se faltar descrição, páginas ou ano, procura (em português) para completar
    if (!l.descricao || !l.paginas || !l.ano) {
      this.carregando.set(true);
      try {
        const extras = await this.api.detalhes(l);
        if (this.livro()?.titulo === l.titulo) this.extras.set(extras);
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

  protected async traduzir() {
    const texto = this.descricao();
    if (!texto) return;
    this.traduzindo.set(true);
    try {
      this.traduzida.set(await this.api.traduzir(texto));
    } catch {
      this.mensagem.set('Não consegui traduzir agora. Tente de novo mais tarde.');
    }
    this.traduzindo.set(false);
  }

  protected async remover() {
    const id = this.idDoLivro();
    if (!id || !confirm('Remover este livro da estante? As resenhas dele também serão apagadas.')) return;
    const erro = await this.clube.removerLivro(id);
    if (erro) return this.mensagem.set(erro);
    this.removido.emit();
    this.fechar.emit();
  }

  protected async sugerir() {
    const l = this.completo();
    if (!l) return;
    this.enviando.set(true);
    const erro = await this.clube.sugerir(l);
    this.enviando.set(false);
    this.mensagem.set(erro || 'Seu livro entrou na roleta! 🎡');
  }

  private async carregarLeitura(livro: ResultadoBusca | null, perfilId?: string) {
    const abertura = ++this.aberturaLeitura;
    this.statusEscolhido.set(null);
    this.contexto.set(this.modo() === 'clube' ? 'no_clube' : 'fora_do_clube');
    this.carregandoLeitura.set(!!livro && !!perfilId);
    if (!livro || !perfilId) return;
    const erro = await this.lidos.carregarMeus(perfilId);
    if (abertura !== this.aberturaLeitura) return;
    this.carregandoLeitura.set(false);
    const registro = this.registro();
    if (registro) {
      this.contexto.set(registro.contexto);
      if (registro.status_leitura !== 'quero_ler') this.statusEscolhido.set(registro.status_leitura);
    }
    if (erro) this.mensagem.set(erro);
  }

  protected nomeDoStatus(status: StatusLeitura): string {
    return STATUS_LEITURA.find(item => item.valor === status)?.nome ?? '';
  }

  protected async alternarQueroLer() {
    await this.salvarLeitura('quero_ler');
  }

  protected async salvarLeitura(status: StatusLeitura) {
    const livro = this.completo();
    const meuId = this.auth.perfil()?.id;
    if (!livro || !meuId || this.enviando() || this.carregandoLeitura()) return;
    const registro = this.registro();
    const retirar = status === 'quero_ler' && registro?.status_leitura === 'quero_ler';
    const abertura = this.aberturaLeitura;
    this.enviando.set(true);
    try {
      const erro = retirar && registro
        ? await this.lidos.remover(registro.id, meuId, 'quero_ler')
        : await this.lidos.salvar(livro, status, meuId, this.contexto());
      if (abertura !== this.aberturaLeitura) return;
      if (!erro) this.statusEscolhido.set(status === 'quero_ler' ? null : status);
      this.mensagem.set(erro || (retirar ? 'Removido de Quero ler.' : 'Leitura atualizada.'));
    } finally {
      this.enviando.set(false);
    }
  }

}

// Um jeito simples de perceber se um texto está em inglês (conta palavras comuns de cada idioma)
function pareceIngles(texto: string | null | undefined): boolean {
  if (!texto) return false;
  const t = ` ${texto.toLowerCase()} `;
  const ingles = (t.match(/\b(the|and|of|to|is|was|with|his|her|for|that|she|he|in)\b/g) ?? []).length;
  const portugues = (t.match(/\b(o|a|de|que|e|do|da|em|um|uma|para|com|não|os|as|na|no|se)\b/g) ?? []).length;
  return ingles >= 4 && ingles > portugues * 1.2;
}

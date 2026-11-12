import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { IonButton, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { LivrosLidosService } from '../../core/livros-lidos.service';
import { CONTEXTOS, ContextoLeitura, LivroLido, ResultadoBusca, STATUS_LEITURA, StatusLeitura } from '../../core/modelos';
import { BuscaLivroComponent } from '../busca-livro/busca-livro.component';

import { DetalheLivroComponent } from '../detalhe-livro/detalhe-livro.component';
@Component({
  selector: 'app-livros-lidos',
  imports: [IonButton, IonSpinner, BuscaLivroComponent, DetalheLivroComponent],
  template: `
    <section class="secao">
      <h2 class="titulo-serif">Minha estante</h2>

      <div class="contador">
        <strong>{{ lidos.meus().length }}</strong>
        <span>{{ lidos.meus().length === 1 ? 'livro lido' : 'livros lidos' }}</span>
        @if (totalDePaginas() > 0) {
          <span class="paginas">· {{ totalDePaginas() }} páginas</span>
        }
      </div>

      <div class="resumo">
        @for (c of contextos; track c.valor) {
          <span class="mini">{{ c.nome }}: <b>{{ contagem()[c.valor] }}</b></span>
        }
      </div>

      <div class="novo">
        <h3 class="titulo-serif">Adicionar um livro</h3>
        <app-busca-livro [(escolhido)]="escolhido" placeholder="Procure um livro que você já leu"></app-busca-livro>

        @if (escolhido(); as e) {
          @if (!e.paginas) {
            <label class="rotulo-campo" for="paginas-lido">Quantas páginas tem? (se souber)</label>
            <input id="paginas-lido" class="campo" type="number" inputmode="numeric" min="1" max="20000" placeholder="Ex.: 320" [value]="paginasManual()" (input)="paginasManual.set($any($event.target).value)" />
          }
          <span class="rotulo-campo">Quando você leu?</span>
          <div class="fichas">
            @for (c of contextos; track c.valor) {
              <button type="button" class="pilula" [class.ativa]="contexto() === c.valor" (click)="contexto.set(c.valor)">
                {{ c.nome }}
              </button>
            }
          </div>
          <ion-button expand="block" [disabled]="enviando()" (click)="adicionar()">
            @if (enviando()) {
              <ion-spinner name="dots"></ion-spinner>
            } @else {
              Adicionar à minha lista
            }
          </ion-button>
        }
        @if (mensagem()) {
          <p class="aviso" role="status">{{ mensagem() }}</p>
        }
      </div>

      <div class="lista">
        <div class="fichas" aria-label="Filtrar por status">
          @for (status of statusLeitura; track status.valor) {
            <button type="button" class="pilula" [class.ativa]="aba() === status.valor"
              [attr.aria-pressed]="aba() === status.valor" (click)="aba.set(status.valor)">
              {{ status.nome }}
            </button>
          }
        </div>
        @if (carregando()) {
          <ion-spinner name="dots" aria-label="Carregando estante"></ion-spinner>
        }
        @for (l of livrosDaAba(); track l.id) {
          <div class="item">
            <div class="capa" style="width: 38px; height: 54px">
              @if (l.capa_url) {
                <img [src]="l.capa_url" alt="" loading="lazy" />
              } @else {
                <span>📖</span>
              }
            </div>
            <button type="button" class="info" (click)="abrir(l)">
              <strong>{{ l.titulo }}</strong>
              <span>{{ l.autor ?? 'Autor não informado' }}</span>
              @if (l.status_leitura === 'lido') {
                <span class="ctx">{{ nomeDoContexto(l.contexto) }}{{ l.paginas ? ' · ' + l.paginas + ' páginas' : '' }}</span>
              }
            </button>
            <button type="button" class="tirar" [disabled]="enviando()" (click)="remover(l.id)" [attr.aria-label]="'Tirar ' + l.titulo + ' da lista'">✕</button>
          </div>
        } @empty {
          @if (!carregando()) {
            <p class="suave">Nenhum livro nesta lista ainda.</p>
          }
        }
      </div>
    </section>
    <app-detalhe-livro [livro]="detalhe()" modo="perfil" (fechar)="detalhe.set(null)"></app-detalhe-livro>
  `,
  styles: [
    `
      h2 {
        font-size: 1.5rem;
        margin-bottom: 6px;
      }
      h3 {
        font-size: 1.15rem;
        margin: 0 0 8px;
      }
      .contador {
        display: flex;
        align-items: baseline;
        gap: 8px;
      }
      .contador strong {
        font-family: 'Fraunces', Georgia, serif;
        font-size: 2.6rem;
        line-height: 1;
        color: var(--cob-framboesa);
      }
      .contador span {
        font-weight: 700;
        color: #8c5a68;
      }
      .resumo {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 12px;
        margin: 6px 0 14px;
      }
      .mini {
        font-size: 0.82rem;
        color: #8c5a68;
      }
      .novo {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-top: 14px;
        border-top: 1.5px dashed #f0b9c4;
      }
      .fichas {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .novo ion-button {
        margin-top: 8px;
      }
      .lista {
        margin-top: 16px;
        padding-top: 8px;
        border-top: 1.5px dashed #f0b9c4;
      }
      .item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 0;
      }
      .info {
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        padding: 0;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
      }
      .info span {
        color: #8c5a68;
        font-size: 0.85rem;
      }
      .info .ctx {
        color: var(--cob-framboesa);
        font-weight: 700;
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
export class LivrosLidosComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly lidos = inject(LivrosLidosService);

  protected readonly contextos = CONTEXTOS;
  protected readonly statusLeitura = STATUS_LEITURA;
  protected readonly aba = signal<StatusLeitura>('lido');
  protected readonly detalhe = signal<ResultadoBusca | null>(null);
  protected readonly carregando = signal(false);
  protected readonly livrosDaAba = computed(() => this.lidos.todos().filter(l => l.status_leitura === this.aba()));
  protected readonly escolhido = signal<ResultadoBusca | null>(null);
  protected readonly contexto = signal<ContextoLeitura>('fora_do_clube');
  protected readonly paginasManual = signal('');
  protected readonly enviando = signal(false);
  protected readonly mensagem = signal('');

  private readonly busca = viewChild(BuscaLivroComponent);

  protected readonly totalDePaginas = computed(() => this.lidos.meus().reduce((soma, l) => soma + (l.paginas ?? 0), 0));
  protected readonly contagem = computed(() => {
    const total: Record<ContextoLeitura, number> = { antes_do_clube: 0, no_clube: 0, fora_do_clube: 0 };
    for (const l of this.lidos.meus()) total[l.contexto]++;
    return total;
  });

  async ngOnInit() {
    const id = this.auth.perfil()?.id;
    if (!id) return;
    this.carregando.set(true);
    try {
      const erro = await this.lidos.carregarMeus(id);
      if (erro) this.mensagem.set(erro);
    } finally {
      this.carregando.set(false);
    }
  }

  protected nomeDoContexto(c: ContextoLeitura): string {
    return CONTEXTOS.find((x) => x.valor === c)?.nome ?? '';
  }

  protected async adicionar() {
    const livro = this.escolhido();
    const meuId = this.auth.perfil()?.id;
    if (!livro || !meuId || this.enviando()) return;
    const manual = Math.round(Number(this.paginasManual()));
    const paginas = livro.paginas ?? (manual >= 1 && manual <= 20000 ? manual : null);

    this.enviando.set(true);
    this.mensagem.set('');
    const erro = await this.lidos.adicionar({ ...livro, paginas }, this.contexto(), meuId);
    this.enviando.set(false);
    if (erro) {
      this.mensagem.set(erro);
      return;
    }
    this.aba.set('lido');
    this.mensagem.set('Salvo em Lidos.');
    this.paginasManual.set('');
    this.busca()?.limpar();
  }

  protected abrir(livro: LivroLido) {
    this.detalhe.set({ ...livro, descricao: null });
  }

  protected async remover(id: string) {
    const meuId = this.auth.perfil()?.id;
    if (!meuId || this.enviando()) return;
    this.enviando.set(true);
    try {
      const erro = await this.lidos.remover(id, meuId, this.aba());
      this.mensagem.set(erro || 'Livro removido da lista.');
    } finally {
      this.enviando.set(false);
    }
  }
}

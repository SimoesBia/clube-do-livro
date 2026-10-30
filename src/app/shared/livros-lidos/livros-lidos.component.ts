import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { IonButton, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { LivrosLidosService } from '../../core/livros-lidos.service';
import { CONTEXTOS, ContextoLeitura, ResultadoBusca } from '../../core/modelos';
import { BuscaLivroComponent } from '../busca-livro/busca-livro.component';

// "Meus livros lidos": a pessoa vai adicionando tudo que já leu (antes do clube, no clube ou fora dele)
@Component({
  selector: 'app-livros-lidos',
  imports: [IonButton, IonSpinner, BuscaLivroComponent],
  template: `
    <section class="secao">
      <h2 class="titulo-serif">Meus livros lidos</h2>

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
        @for (l of lidos.meus(); track l.id) {
          <div class="item">
            <div class="capa" style="width: 38px; height: 54px">
              @if (l.capa_url) {
                <img [src]="l.capa_url" alt="" loading="lazy" />
              } @else {
                <span>📖</span>
              }
            </div>
            <div class="info">
              <strong>{{ l.titulo }}</strong>
              <span>{{ l.autor ?? 'Autor não informado' }}</span>
              <span class="ctx">{{ nomeDoContexto(l.contexto) }}{{ l.paginas ? ' · ' + l.paginas + ' páginas' : '' }}</span>
            </div>
            <button type="button" class="tirar" (click)="remover(l.id)" [attr.aria-label]="'Tirar ' + l.titulo + ' da lista'">✕</button>
          </div>
        } @empty {
          <p class="suave">Sua lista está vazia. Adicione os livros que você já leu e o contador cresce! 📚</p>
        }
      </div>
    </section>
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
    if (id) await this.lidos.carregarMeus(id);
  }

  protected nomeDoContexto(c: ContextoLeitura): string {
    return CONTEXTOS.find((x) => x.valor === c)?.nome ?? '';
  }

  protected async adicionar() {
    const livro = this.escolhido();
    const meuId = this.auth.perfil()?.id;
    if (!livro || !meuId) return;
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
    this.mensagem.set('Adicionado! 🎉');
    this.paginasManual.set('');
    this.busca()?.limpar();
  }

  protected async remover(id: string) {
    const meuId = this.auth.perfil()?.id;
    if (meuId) await this.lidos.remover(id, meuId);
  }
}

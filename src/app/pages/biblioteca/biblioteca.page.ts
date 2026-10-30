import { Component, inject, signal } from '@angular/core';
import { IonContent, IonLabel, IonSegment, IonSegmentButton, IonSpinner } from '@ionic/angular';
import { ClubeService } from '../../core/clube.service';
import { ASSUNTOS, LivrosApiService } from '../../core/livros-api.service';
import { Livro, ResultadoBusca } from '../../core/modelos';
import { SupabaseService } from '../../core/supabase.service';
import { DetalheLivroComponent } from '../../shared/detalhe-livro/detalhe-livro.component';
import { TopoComponent } from '../../shared/topo/topo.component';

type Aba = 'estante' | 'descobrir';

@Component({
  selector: 'app-biblioteca',
  imports: [IonContent, IonSegment, IonSegmentButton, IonLabel, IonSpinner, TopoComponent, DetalheLivroComponent],
  template: `
    <app-topo titulo="Biblioteca" enfeite="📚"></app-topo>
    <ion-content [fullscreen]="true">
      <section class="intro">
        <h1 class="titulo-serif">Nossa estante</h1>
        <p class="suave">Os livros que o clube já leu e, na outra aba, ideias de leitura para você se inspirar.</p>
      </section>

      <ion-segment class="abas" [value]="aba()" (ionChange)="trocar($event)">
        <ion-segment-button value="estante">
          <ion-label>Lidos pelo clube</ion-label>
        </ion-segment-button>
        <ion-segment-button value="descobrir">
          <ion-label>Descobrir</ion-label>
        </ion-segment-button>
      </ion-segment>

      @if (aba() === 'estante') {
        @for (l of livros(); track l.id) {
          <article class="livro">
            <button type="button" class="cartao" (click)="abrirDoClube(l)">
              <div class="capa lombada" style="width: 92px; height: 134px">
                @if (l.capa_url) {
                  <img [src]="l.capa_url" alt="" loading="lazy" />
                } @else {
                  <span style="font-size: 2.2rem">📖</span>
                }
              </div>
              <div class="texto">
                @if (l.id === clube.dados().livro?.id) {
                  <span class="agora">Lendo agora 📖</span>
                }
                <strong class="titulo">{{ l.titulo }}</strong>
                @if (l.autor) {
                  <span class="autor">{{ l.autor }}</span>
                }
                @if (l.ano || l.paginas) {
                  <span class="meta">{{ l.ano ?? '' }}{{ l.ano && l.paginas ? ' · ' : '' }}{{ l.paginas ? l.paginas + ' páginas' : '' }}</span>
                }
                @if (l.descricao) {
                  <span class="descricao">{{ l.descricao }}</span>
                }
              </div>
            </button>
            <div class="tabua" aria-hidden="true"></div>
          </article>
        } @empty {
          @if (!carregandoEstante()) {
            <section class="secao vazio">
              <div class="emoji">📚</div>
              <h2 class="titulo-serif">A estante está esperando</h2>
              <p class="suave">
                Os livros lidos pelo clube e pelos desafios vão se empilhando aqui. Enquanto isso, que tal dar uma olhada na aba <strong>Descobrir</strong>?
              </p>
            </section>
          }
        }
        @if (carregandoEstante()) {
          <div class="centro"><ion-spinner name="dots"></ion-spinner></div>
        }
      } @else {
        <div class="categorias">
          <button type="button" class="pilula" [class.ativa]="categoria() === 'alta'" (click)="escolherCategoria('alta')">🔥 Em alta</button>
          @for (a of assuntos; track a.id) {
            <button type="button" class="pilula" [class.ativa]="categoria() === a.id" (click)="escolherCategoria(a.id)">{{ a.nome }}</button>
          }
        </div>
        <div class="surpresa">
          <button type="button" class="pilula ativa" (click)="surpreender()">🎲 Surpreenda-me</button>
          @if (rotuloSurpresa()) {
            <span class="suave">{{ rotuloSurpresa() }}</span>
          }
        </div>

        @if (carregando()) {
          <div class="centro"><ion-spinner name="dots"></ion-spinner></div>
        }
        @if (erro()) {
          <p class="erro mensagem" role="alert">{{ erro() }}</p>
        }

        <div class="vitrine">
          @for (l of lista(); track $index) {
            <button type="button" class="vitrine-item" (click)="abrirDoMostruario(l)">
              <div class="capa" style="width: 100%; aspect-ratio: 2 / 3">
                @if (l.capa_url) {
                  <img [src]="l.capa_url" [alt]="l.titulo" loading="lazy" />
                } @else {
                  <span style="font-size: 2rem">📖</span>
                }
              </div>
              <span class="nome">{{ l.titulo }}</span>
              @if (l.ano) {
                <span class="ano">{{ l.ano }}</span>
              }
            </button>
          }
        </div>

        <p class="credito">Dados e capas: <a href="https://openlibrary.org" target="_blank" rel="noopener noreferrer">Open Library</a></p>
      }

      <app-detalhe-livro [livro]="detalhe()" [modo]="modoDoDetalhe()" (fechar)="detalhe.set(null)"></app-detalhe-livro>
    </ion-content>
  `,
  styles: [
    `
      .intro {
        padding: 16px 18px 4px;
      }
      h1 {
        font-size: 1.8rem;
      }
      .abas {
        margin: 8px 14px 6px;
        width: auto;
      }
      .livro {
        margin: 12px 14px 0;
      }
      .cartao {
        display: flex;
        gap: 16px;
        width: 100%;
        padding: 14px;
        border: none;
        border-radius: 18px 18px 6px 6px;
        background: #fff;
        box-shadow: 0 6px 22px var(--cob-sombra);
        font-family: inherit;
        color: inherit;
        text-align: left;
        cursor: pointer;
      }
      .lombada {
        border-radius: 4px 10px 10px 4px;
        box-shadow: -4px 4px 0 rgba(122, 18, 48, 0.18), 0 6px 14px var(--cob-sombra);
      }
      .texto {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }
      .agora {
        align-self: flex-start;
        padding: 2px 10px;
        border-radius: 999px;
        background: #fff1cf;
        color: #5a3b00;
        font-size: 0.75rem;
        font-weight: 700;
      }
      .titulo {
        font-family: 'Fraunces', Georgia, serif;
        font-size: 1.2rem;
        line-height: 1.2;
        color: var(--cob-vinho);
      }
      .autor {
        font-weight: 700;
        color: #8c5a68;
      }
      .meta {
        font-size: 0.85rem;
        color: var(--cob-framboesa);
        font-weight: 700;
      }
      .descricao {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
        margin-top: 4px;
        font-size: 0.88rem;
        line-height: 1.4;
        color: #5c3a45;
      }
      /* a "tábua" de madeira onde o livro fica apoiado */
      .tabua {
        height: 12px;
        border-radius: 3px 3px 8px 8px;
        background: linear-gradient(#c68a5b, #8f5a35);
        box-shadow: 0 6px 12px rgba(122, 18, 48, 0.2);
      }
      .vazio {
        text-align: center;
      }
      .emoji {
        font-size: 2.6rem;
      }
      .categorias {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 6px 14px 4px;
      }
      .surpresa {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 14px 2px;
      }
      .surpresa .suave {
        margin: 0;
        font-size: 0.85rem;
      }
      .vitrine {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px 10px;
        padding: 12px 14px;
      }
      .vitrine-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 0;
        border: none;
        background: none;
        font-family: inherit;
        color: inherit;
        text-align: left;
        cursor: pointer;
        transition: transform 0.15s ease;
      }
      .vitrine-item:active {
        transform: scale(0.96);
      }
      .nome {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        font-size: 0.82rem;
        font-weight: 700;
        line-height: 1.2;
      }
      .ano {
        font-size: 0.75rem;
        color: #8c5a68;
      }
      .centro {
        display: flex;
        justify-content: center;
        padding: 16px;
      }
      .mensagem {
        margin: 12px 14px;
      }
      .credito {
        margin: 4px 14px 24px;
        text-align: center;
        font-size: 0.8rem;
        color: #8c5a68;
      }
      .credito a {
        color: var(--cob-framboesa);
        font-weight: 700;
      }
    `,
  ],
})
export class BibliotecaPage {
  private readonly sb = inject(SupabaseService).cliente;
  private readonly api = inject(LivrosApiService);
  protected readonly clube = inject(ClubeService);

  protected readonly aba = signal<Aba>('estante');
  protected readonly assuntos = ASSUNTOS;

  // estante do clube
  protected readonly livros = signal<Livro[]>([]);
  protected readonly carregandoEstante = signal(true);

  // descobrir (Open Library)
  protected readonly categoria = signal('alta');
  protected readonly lista = signal<ResultadoBusca[]>([]);
  protected readonly carregando = signal(false);
  protected readonly erro = signal('');
  protected readonly rotuloSurpresa = signal('');

  // ficha do livro
  protected readonly detalhe = signal<ResultadoBusca | null>(null);
  protected readonly modoDoDetalhe = signal<'clube' | 'descobrir'>('descobrir');

  async ionViewWillEnter() {
    void this.clube.carregarClube();
    await this.carregarEstante();
    if (this.aba() === 'descobrir' && this.lista().length === 0) await this.carregarCategoria();
  }

  protected async trocar(evento: Event) {
    this.aba.set((evento as CustomEvent).detail.value as Aba);
    if (this.aba() === 'descobrir' && this.lista().length === 0) await this.carregarCategoria();
  }

  private async carregarEstante() {
    const { data } = await this.sb
      .from('livros')
      .select('id, titulo, autor, capa_url, ano, paginas, descricao, chave_ol, criado_em')
      .order('criado_em', { ascending: false });
    this.livros.set((data ?? []) as Livro[]);
    this.carregandoEstante.set(false);
  }

  protected async escolherCategoria(id: string) {
    this.categoria.set(id);
    this.rotuloSurpresa.set('');
    await this.carregarCategoria();
  }

  protected async surpreender() {
    const assunto = this.assuntos[Math.floor(Math.random() * this.assuntos.length)];
    const deslocamento = Math.floor(Math.random() * 8) * 18;
    this.categoria.set(assunto.id);
    this.rotuloSurpresa.set(`Surpresa de hoje: ${assunto.nome}`);
    await this.carregarCategoria(deslocamento);
  }

  private async carregarCategoria(deslocamento = 0) {
    this.carregando.set(true);
    this.erro.set('');
    try {
      const id = this.categoria();
      const livros = id === 'alta' ? await this.api.emAlta() : await this.api.porAssunto(id, deslocamento);
      this.lista.set(livros);
      if (livros.length === 0) this.erro.set('Não encontrei livros nessa categoria agora.');
    } catch {
      this.lista.set([]);
      this.erro.set('Não consegui falar com a Open Library agora. Tente de novo em instantes.');
    }
    this.carregando.set(false);
  }

  protected abrirDoMostruario(livro: ResultadoBusca) {
    this.modoDoDetalhe.set('descobrir');
    this.detalhe.set(livro);
  }

  protected abrirDoClube(l: Livro) {
    this.modoDoDetalhe.set('clube');
    this.detalhe.set({
      titulo: l.titulo,
      autor: l.autor,
      capa_url: l.capa_url,
      ano: l.ano ?? null,
      paginas: l.paginas ?? null,
      descricao: l.descricao ?? null,
      chave_ol: l.chave_ol ?? null,
    });
  }
}

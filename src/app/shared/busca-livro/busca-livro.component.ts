import { Component, inject, input, model, signal } from '@angular/core';
import { IonSpinner } from '@ionic/angular';
import { LivrosApiService } from '../../core/livros-api.service';
import { ResultadoBusca } from '../../core/modelos';

// Campo para procurar um livro: a pessoa digita e aparecem as opções com capa.
// Se não achar, dá para usar o que digitou mesmo assim.
@Component({
  selector: 'app-busca-livro',
  imports: [IonSpinner],
  template: `
    <div class="busca">
      <input
        class="campo"
        type="text"
        maxlength="120"
        [placeholder]="placeholder()"
        [value]="texto()"
        (input)="aoDigitar($event)"
        aria-label="Buscar livro"
      />

      @if (buscando()) {
        <div class="centro"><ion-spinner name="dots"></ion-spinner></div>
      }

      @if (escolhido(); as e) {
        <div class="escolhido">
          <div class="capa" style="width: 44px; height: 64px">
            @if (e.capa_url) {
              <img [src]="e.capa_url" alt="" />
            } @else {
              <span>📖</span>
            }
          </div>
          <div class="info">
            <strong>{{ e.titulo }}</strong>
            @if (e.autor) {
              <span>{{ e.autor }}</span>
            }
            @if (e.ano || e.paginas) {
              <span>{{ e.ano ?? '' }}{{ e.ano && e.paginas ? ' · ' : '' }}{{ e.paginas ? e.paginas + ' páginas' : '' }}</span>
            }
            <span class="ok">✓ Livro escolhido</span>
          </div>
        </div>
      } @else {
        @if (resultados().length > 0) {
          <div class="lista" role="listbox">
            @for (r of resultados(); track $index) {
              <button type="button" class="opcao" role="option" (click)="escolher(r)">
                <div class="capa" style="width: 36px; height: 52px">
                  @if (r.capa_url) {
                    <img [src]="r.capa_url" alt="" loading="lazy" />
                  } @else {
                    <span>📖</span>
                  }
                </div>
                <div class="info">
                  <strong>{{ r.titulo }}</strong>
                  @if (r.autor) {
                    <span>{{ r.autor }}{{ r.ano ? ' · ' + r.ano : '' }}</span>
                  }
                </div>
              </button>
            }
          </div>
        }
        @if (texto().trim().length >= 3 && !buscando()) {
          @if (erro()) {
            <p class="aviso">{{ erro() }}</p>
          } @else if (buscou() && resultados().length === 0) {
            <p class="suave">Não achei esse livro por aqui.</p>
          }
          <button type="button" class="usar" (click)="usarDigitado()">Usar “{{ texto().trim() }}” do jeito que digitei</button>
        }
      }
    </div>
  `,
  styles: [
    `
      .busca {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .centro {
        display: flex;
        justify-content: center;
      }
      .lista {
        display: flex;
        flex-direction: column;
        border: 1.5px solid #f7dde2;
        border-radius: 16px;
        overflow: hidden;
        background: #fff;
      }
      .opcao,
      .escolhido {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        text-align: left;
      }
      .opcao {
        border: none;
        border-bottom: 1px solid #f7dde2;
        background: #fff;
        cursor: pointer;
        font-family: inherit;
        color: inherit;
      }
      .opcao:last-child {
        border-bottom: none;
      }
      .opcao:active {
        background: #fff3f1;
      }
      .escolhido {
        border: 1.5px solid var(--cob-framboesa);
        border-radius: 16px;
        background: #fff8f8;
      }
      .info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .info strong {
        line-height: 1.25;
      }
      .info span {
        color: #8c5a68;
        font-size: 0.88rem;
      }
      .info .ok {
        color: var(--cob-framboesa);
        font-weight: 700;
      }
      .usar {
        align-self: flex-start;
        border: none;
        background: none;
        padding: 4px 2px;
        color: var(--cob-framboesa);
        font-family: inherit;
        font-weight: 700;
        font-size: 0.9rem;
        text-decoration: underline;
        cursor: pointer;
        text-align: left;
      }
      p {
        margin: 0;
      }
    `,
  ],
})
export class BuscaLivroComponent {
  private readonly api = inject(LivrosApiService);

  readonly placeholder = input('Digite o nome do livro ou do autor');
  // O livro escolhido (quem usa o componente recebe daqui)
  readonly escolhido = model<ResultadoBusca | null>(null);

  protected readonly texto = signal('');
  protected readonly resultados = signal<ResultadoBusca[]>([]);
  protected readonly buscando = signal(false);
  protected readonly buscou = signal(false);
  protected readonly erro = signal('');

  private temporizador: ReturnType<typeof setTimeout> | undefined;

  protected aoDigitar(evento: Event) {
    const valor = (evento.target as HTMLInputElement).value;
    this.texto.set(valor);
    this.escolhido.set(null);
    this.erro.set('');
    clearTimeout(this.temporizador);
    if (valor.trim().length < 3) {
      this.resultados.set([]);
      this.buscou.set(false);
      return;
    }
    // espera a pessoa parar de digitar um instantinho antes de buscar
    this.temporizador = setTimeout(() => void this.buscar(), 500);
  }

  private async buscar() {
    this.buscando.set(true);
    try {
      this.resultados.set(await this.api.buscar(this.texto()));
    } catch {
      this.erro.set('Não consegui buscar agora. Você pode usar o que digitou.');
      this.resultados.set([]);
    } finally {
      this.buscando.set(false);
      this.buscou.set(true);
    }
  }

  protected escolher(r: ResultadoBusca) {
    this.escolhido.set(r);
    this.resultados.set([]);
    this.texto.set(r.titulo);
    void this.completar(r);
  }

  // Depois de escolher, busca na Open Library a descrição (e as páginas/ano, se faltarem)
  private async completar(r: ResultadoBusca) {
    if (!r.chave_ol) return;
    try {
      const extras = await this.api.completar(r.chave_ol);
      if (this.escolhido()?.chave_ol !== r.chave_ol) return; // a pessoa já escolheu outro
      this.escolhido.set({
        ...r,
        descricao: extras.descricao ?? r.descricao ?? null,
        paginas: r.paginas ?? extras.paginas,
        ano: r.ano ?? extras.ano,
      });
    } catch {
      // sem os extras, o livro continua valendo
    }
  }

  protected usarDigitado() {
    const titulo = this.texto().trim().slice(0, 200);
    if (!titulo) return;
    this.escolhido.set({ titulo, autor: null, capa_url: null });
    this.resultados.set([]);
  }

  // Limpa tudo (usado depois que a sugestão é enviada)
  limpar() {
    this.texto.set('');
    this.resultados.set([]);
    this.escolhido.set(null);
    this.buscou.set(false);
    this.erro.set('');
  }
}

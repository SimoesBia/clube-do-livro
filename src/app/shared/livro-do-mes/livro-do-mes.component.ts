import { Component, inject, signal, viewChild } from '@angular/core';
import { IonButton, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { ClubeService } from '../../core/clube.service';
import { ResultadoBusca } from '../../core/modelos';
import { BuscaLivroComponent } from '../busca-livro/busca-livro.component';

// O quadro do livro do mês, com capa. Quem administra o clube também escolhe aqui o livro e a data do sorteio.
@Component({
  selector: 'app-livro-do-mes',
  imports: [IonButton, IonSpinner, BuscaLivroComponent],
  template: `
    <section class="secao">
      <h2 class="titulo-serif">Livro do mês</h2>

      @if (clube.dados().livro; as l) {
        <div class="livro">
          <div class="capa" style="width: 100px; height: 146px">
            @if (l.capa_url) {
              <img [src]="l.capa_url" alt="Capa do livro {{ l.titulo }}" />
            } @else {
              <span style="font-size: 2.4rem">📖</span>
            }
          </div>
          <div class="texto">
            <h3>{{ l.titulo }}</h3>
            @if (l.autor) {
              <p class="autor">{{ l.autor }}</p>
            }
            @if (l.ano || l.paginas) {
              <p class="meta">{{ l.ano ?? '' }}{{ l.ano && l.paginas ? ' · ' : '' }}{{ l.paginas ? l.paginas + ' páginas' : '' }}</p>
            }
            <p class="suave">Depois de ler, conta o que achou na aba <strong>Resenhas</strong>.</p>
          </div>
        </div>
      } @else {
        <p class="suave">Ainda não tem livro do mês. Ele aparece aqui assim que sair o sorteio da roleta aí embaixo. 🎡</p>
      }

      @if (auth.eAdmin()) {
        <div class="admin">
          <p class="etiqueta">Só quem administra o clube vê isto</p>

          <label class="rotulo-campo" for="data-sorteio">Data do sorteio</label>
          <input
            id="data-sorteio"
            class="campo"
            type="date"
            [value]="clube.dados().data_sorteio ?? ''"
            (change)="mudarData($event)"
          />

          <button type="button" class="pilula" [class.ativa]="aberto()" (click)="aberto.set(!aberto())">
            {{ aberto() ? 'Fechar' : 'Escolher o livro do mês à mão' }}
          </button>

          @if (aberto()) {
            <app-busca-livro [(escolhido)]="escolhido" placeholder="Procure o livro do mês"></app-busca-livro>
            <ion-button expand="block" [disabled]="!escolhido() || salvando()" (click)="salvarLivro()">
              @if (salvando()) {
                <ion-spinner name="dots"></ion-spinner>
              } @else {
                Definir como livro do mês
              }
            </ion-button>
          }

          @if (mensagem()) {
            <p class="aviso" role="status">{{ mensagem() }}</p>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      h2 {
        font-size: 1.55rem;
        margin-bottom: 10px;
      }
      .livro {
        display: flex;
        gap: 16px;
        align-items: flex-start;
      }
      .texto h3 {
        margin: 0;
        font-family: 'Fraunces', Georgia, serif;
        font-size: 1.35rem;
        line-height: 1.2;
        color: var(--cob-vinho);
      }
      .autor {
        margin: 4px 0 0;
        font-weight: 700;
        color: #8c5a68;
      }
      .meta {
        margin: 2px 0 0;
        font-size: 0.88rem;
        font-weight: 700;
        color: var(--cob-framboesa);
      }
      .admin {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 18px;
        padding-top: 14px;
        border-top: 1.5px dashed #f0b9c4;
      }
      .admin .pilula {
        align-self: flex-start;
      }
      .etiqueta {
        margin: 0;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: #b58b98;
      }
      .rotulo-campo {
        margin: 0 0 -4px;
      }
    `,
  ],
})
export class LivroDoMesComponent {
  protected readonly auth = inject(AuthService);
  protected readonly clube = inject(ClubeService);

  protected readonly aberto = signal(false);
  protected readonly escolhido = signal<ResultadoBusca | null>(null);
  protected readonly salvando = signal(false);
  protected readonly mensagem = signal('');

  private readonly busca = viewChild(BuscaLivroComponent);

  protected async salvarLivro() {
    const livro = this.escolhido();
    if (!livro) return;
    this.salvando.set(true);
    const erro = await this.clube.definirLivroDoMes(livro);
    this.salvando.set(false);
    if (erro) {
      this.mensagem.set(erro);
      return;
    }
    this.mensagem.set('Livro do mês atualizado! 🎉');
    this.busca()?.limpar();
    this.aberto.set(false);
  }

  protected async mudarData(evento: Event) {
    const valor = (evento.target as HTMLInputElement).value;
    const erro = await this.clube.definirDataSorteio(valor || null);
    this.mensagem.set(erro || 'Data do sorteio salva!');
  }
}

import { Component, inject, signal, viewChild } from '@angular/core';
import { IonButton, IonContent, IonSegment, IonSegmentButton, IonLabel } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { ClubeService } from '../../core/clube.service';
import { CalendarioComponent } from '../../shared/calendario/calendario.component';
import { RecadosComponent } from '../../shared/recados/recados.component';
import { TopoComponent } from '../../shared/topo/topo.component';

type Aba = 'calendario' | 'recados';

@Component({
  selector: 'app-encontros',
  imports: [IonContent, IonButton, IonSegment, IonSegmentButton, IonLabel, TopoComponent, CalendarioComponent, RecadosComponent],
  template: `
    <app-topo titulo="Encontros" enfeite="📚"></app-topo>
    <ion-content [fullscreen]="true">
      <section class="intro">
        <h1 class="titulo-serif">Vamos marcar o encontro?</h1>
        <p class="suave">
          Marque os dias em que você está livre e deixe um recadinho. Aqui a gente descobre qual dia cabe para o clube todo.
        </p>
      </section>

      <section class="secao meet">
        <h2 class="titulo-serif">Encontro online 🎥</h2>
        @if (clube.dados().link_meet; as link) {
          <p class="suave">Na hora do encontro, é só tocar no botão para entrar.</p>
          <a class="entrar" [href]="link" target="_blank" rel="noopener noreferrer">Entrar no encontro</a>
        } @else {
          <p class="suave">O link do encontro ainda não foi combinado. Quando a administração colocar, ele aparece aqui.</p>
        }

        @if (auth.eAdmin()) {
          <div class="admin">
            <label class="rotulo-campo" for="link-meet">Link do encontro (só quem administra vê)</label>
            <input
              id="link-meet"
              class="campo"
              type="url"
              placeholder="https://meet.google.com/..."
              [value]="linkEditado() ?? clube.dados().link_meet ?? ''"
              (input)="linkEditado.set($any($event.target).value)"
            />
            <ion-button size="small" (click)="salvarLink()">Salvar link</ion-button>
            @if (mensagem()) {
              <p class="aviso" role="status">{{ mensagem() }}</p>
            }
          </div>
        }
      </section>

      <ion-segment class="abas" [value]="aba()" (ionChange)="trocar($event)">
        <ion-segment-button value="calendario">
          <ion-label>Calendário</ion-label>
        </ion-segment-button>
        <ion-segment-button value="recados">
          <ion-label>Recadinhos</ion-label>
        </ion-segment-button>
      </ion-segment>

      @if (aba() === 'calendario') {
        <app-calendario></app-calendario>
      } @else {
        <app-recados></app-recados>
      }
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
        margin: 8px 14px 0;
        width: auto;
      }
      .meet h2 {
        font-size: 1.4rem;
        margin-bottom: 4px;
      }
      .entrar {
        display: block;
        margin-top: 10px;
        padding: 14px;
        border-radius: 16px;
        background: var(--cob-vinho);
        color: #fff;
        font-weight: 700;
        text-align: center;
        text-decoration: none;
      }
      .admin {
        margin-top: 14px;
        padding-top: 4px;
        border-top: 1.5px dashed #f0b9c4;
      }
      .admin ion-button {
        margin-top: 8px;
      }
    `,
  ],
})
export class EncontrosPage {
  protected readonly auth = inject(AuthService);
  protected readonly clube = inject(ClubeService);
  protected readonly aba = signal<Aba>('calendario');
  protected readonly linkEditado = signal<string | null>(null);
  protected readonly mensagem = signal('');
  private readonly calendario = viewChild(CalendarioComponent);

  protected trocar(evento: Event) {
    this.aba.set((evento as CustomEvent).detail.value as Aba);
  }

  // Sempre que a pessoa volta para esta aba, o calendário se atualiza
  ionViewWillEnter() {
    void this.clube.carregarClube();
    void this.calendario()?.recarregar();
  }

  protected async salvarLink() {
    const erro = await this.clube.definirLinkMeet(this.linkEditado() ?? this.clube.dados().link_meet ?? '');
    this.mensagem.set(erro || 'Link salvo! 🎥');
    if (!erro) this.linkEditado.set(null);
  }
}

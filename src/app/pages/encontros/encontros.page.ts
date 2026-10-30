import { Component, signal, viewChild } from '@angular/core';
import { IonContent, IonSegment, IonSegmentButton, IonLabel } from '@ionic/angular';
import { CalendarioComponent } from '../../shared/calendario/calendario.component';
import { RecadosComponent } from '../../shared/recados/recados.component';
import { TopoComponent } from '../../shared/topo/topo.component';

type Aba = 'calendario' | 'recados';

@Component({
  selector: 'app-encontros',
  imports: [IonContent, IonSegment, IonSegmentButton, IonLabel, TopoComponent, CalendarioComponent, RecadosComponent],
  template: `
    <app-topo titulo="Encontros" enfeite="📚"></app-topo>
    <ion-content [fullscreen]="true">
      <section class="intro">
        <h1 class="titulo-serif">Vamos marcar o encontro?</h1>
        <p class="suave">
          Marque os dias em que você está livre e deixe um recadinho. Aqui a gente descobre qual dia cabe para o clube todo.
        </p>
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
    `,
  ],
})
export class EncontrosPage {
  protected readonly aba = signal<Aba>('calendario');
  private readonly calendario = viewChild(CalendarioComponent);

  protected trocar(evento: Event) {
    this.aba.set((evento as CustomEvent).detail.value as Aba);
  }

  // Sempre que a pessoa volta para esta aba, o calendário se atualiza
  ionViewWillEnter() {
    void this.calendario()?.recarregar();
  }
}

import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { libraryOutline } from 'ionicons/icons';
import { EmBreveComponent } from '../../shared/em-breve/em-breve.component';
import { TopoComponent } from '../../shared/topo/topo.component';

@Component({
  selector: 'app-biblioteca',
  imports: [IonContent, TopoComponent, EmBreveComponent],
  template: `
    <app-topo titulo="Biblioteca"></app-topo>
    <ion-content [fullscreen]="true">
      <app-em-breve [icone]="icone" titulo="A biblioteca do clube" texto="Aqui ficam os livros em EPUB e PDF, a começar pelo livro do mês."></app-em-breve>
    </ion-content>
  `,
})
export class BibliotecaPage {
  protected readonly icone = libraryOutline;
}

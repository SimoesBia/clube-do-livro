import { Component } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { ResumoMembroComponent } from '../../shared/resumo-membro/resumo-membro.component';
import {
  calendarOutline,
  chatbubbleEllipsesOutline,
  homeOutline,
  libraryOutline,
  trophyOutline,
} from 'ionicons/icons';

// A "moldura" do app depois do login: as abas de baixo
@Component({
  selector: 'app-abas',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, ResumoMembroComponent],
  templateUrl: './abas.page.html',
})
export class AbasPage {
  protected readonly iconeInicio = homeOutline;
  protected readonly iconeBiblioteca = libraryOutline;
  protected readonly iconeResenhas = chatbubbleEllipsesOutline;
  protected readonly iconeDesafios = trophyOutline;
  protected readonly iconeEncontros = calendarOutline;
}

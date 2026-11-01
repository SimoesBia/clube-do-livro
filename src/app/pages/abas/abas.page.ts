import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { IonBadge, IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { DesafiosService } from '../../core/desafios.service';
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
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge, ResumoMembroComponent],
  templateUrl: './abas.page.html',
})
export class AbasPage implements OnInit, OnDestroy {
  protected readonly desafios = inject(DesafiosService);

  ngOnInit() {
    void this.desafios.carregar(); // para a bolinha de convites já aparecer
    this.desafios.escutar();
  }

  ngOnDestroy() {
    this.desafios.parar();
  }

  protected readonly iconeInicio = homeOutline;
  protected readonly iconeBiblioteca = libraryOutline;
  protected readonly iconeResenhas = chatbubbleEllipsesOutline;
  protected readonly iconeDesafios = trophyOutline;
  protected readonly iconeEncontros = calendarOutline;
}

import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { IonBadge, IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { DesafiosService } from '../../core/desafios.service';
import { NotificacoesService } from '../../core/notificacoes.service';
import { NotificacoesPainelComponent } from '../../shared/notificacoes/notificacoes-painel.component';
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
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge, NotificacoesPainelComponent],
  templateUrl: './abas.page.html',
})
export class AbasPage implements OnInit, OnDestroy {
  protected readonly desafios = inject(DesafiosService);
  private readonly notificacoes = inject(NotificacoesService);
  private readonly auth = inject(AuthService);

  ngOnInit() {
    void this.desafios.carregar(); // para a bolinha de convites já aparecer
    this.desafios.escutar();
    void this.auth.carregarMembros(); // para os avisos de aniversário
    void this.notificacoes.carregar();
    this.notificacoes.escutar();
  }

  ngOnDestroy() {
    this.desafios.parar();
    this.notificacoes.parar();
  }

  protected readonly iconeInicio = homeOutline;
  protected readonly iconeBiblioteca = libraryOutline;
  protected readonly iconeResenhas = chatbubbleEllipsesOutline;
  protected readonly iconeDesafios = trophyOutline;
  protected readonly iconeEncontros = calendarOutline;
}

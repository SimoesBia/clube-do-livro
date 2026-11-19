import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonButtons, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { NotificacoesService } from '../../core/notificacoes.service';
import { AvatarMembroComponent } from '../avatar/avatar-membro.component';

// Barra do topo de todas as abas: título (com enfeite, se quiser) + o avatar da pessoa (toque para abrir o perfil)
@Component({
  selector: 'app-topo',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, AvatarMembroComponent],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title [style.font-size.px]="titulo() === 'Court of Books' ? 18 : null">
          {{ titulo() }}
          @if (enfeite()) {
            <span class="enfeite" aria-hidden="true">{{ enfeite() }}</span>
          }
        </ion-title>
        <ion-buttons slot="end">
          <ion-button class="botao-sino" (click)="notificacoes.alternar()" aria-label="Notificações">
            <span class="sino" aria-hidden="true">🔔</span>
            @if (notificacoes.total() > 0) {
              <span class="bolinha">{{ notificacoes.total() > 9 ? '9+' : notificacoes.total() }}</span>
            }
          </ion-button>
          <ion-button class="botao-avatar" (click)="abrirPerfil()" aria-label="Abrir meu perfil">
            <app-avatar-membro [membro]="auth.perfil()" [tamanho]="32" [clicavel]="false"></app-avatar-membro>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
  `,
  styles: [
    `
      .botao-avatar {
        --padding-start: 4px;
        --padding-end: 8px;
        margin-right: 6px;
      }
      .botao-sino {
        --padding-start: 6px;
        --padding-end: 6px;
        position: relative;
      }
      .sino {
        font-size: 1.35rem;
      }
      .bolinha {
        position: absolute;
        top: 2px;
        right: 0;
        min-width: 17px;
        height: 17px;
        padding: 0 4px;
        border-radius: 999px;
        background: var(--cob-framboesa);
        color: #fff;
        font-size: 0.68rem;
        font-weight: 700;
        line-height: 17px;
        text-align: center;
        box-sizing: border-box;
        animation: pulsar 1.8s ease-in-out infinite;
      }
      @keyframes pulsar {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.15); }
      }
      .enfeite {
        display: inline-block;
        margin-left: 4px;
        animation: balanco 3.2s ease-in-out infinite;
        transform-origin: 50% 80%;
      }
      @keyframes balanco {
        0%, 100% { transform: rotate(-6deg) translateY(0); }
        50% { transform: rotate(6deg) translateY(-2px); }
      }
    `,
  ],
})
export class TopoComponent {
  readonly titulo = input.required<string>();
  readonly enfeite = input('');

  protected readonly auth = inject(AuthService);
  protected readonly notificacoes = inject(NotificacoesService);
  private readonly router = inject(Router);

  protected abrirPerfil() {
    this.router.navigateByUrl('/perfil');
  }
}

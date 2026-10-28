import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonButtons, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { AvatarMembroComponent } from '../avatar/avatar-membro.component';

// Barra do topo de todas as abas: título (com enfeite, se quiser) + o avatar da pessoa (toque para abrir o perfil)
@Component({
  selector: 'app-topo',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, AvatarMembroComponent],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>
          {{ titulo() }}
          @if (enfeite()) {
            <span class="enfeite" aria-hidden="true">{{ enfeite() }}</span>
          }
        </ion-title>
        <ion-buttons slot="end">
          <ion-button class="botao-avatar" (click)="abrirPerfil()" aria-label="Abrir meu perfil">
            <app-avatar-membro [membro]="auth.perfil()" [tamanho]="32"></app-avatar-membro>
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
  private readonly router = inject(Router);

  protected abrirPerfil() {
    this.router.navigateByUrl('/perfil');
  }
}

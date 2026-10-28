import { Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';

// Aviso bonitinho para as abas que ainda vão ser construídas nos próximos blocos
@Component({
  selector: 'app-em-breve',
  imports: [IonIcon],
  template: `
    <div class="vazio">
      <div class="selo"><ion-icon [icon]="icone()"></ion-icon></div>
      <h2 class="titulo-serif">{{ titulo() }}</h2>
      <p class="suave">{{ texto() }}</p>
      <span class="etiqueta">Chega nos próximos blocos</span>
    </div>
  `,
  styles: [
    `
      .vazio {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 56px 28px;
      }
      .selo {
        width: 84px;
        height: 84px;
        border-radius: 50%;
        background: var(--cob-rosa-claro);
        color: var(--cob-vinho);
        display: grid;
        place-items: center;
        font-size: 38px;
        margin-bottom: 14px;
      }
      h2 {
        font-size: 1.9rem;
      }
      .etiqueta {
        margin-top: 16px;
        padding: 6px 14px;
        border-radius: 999px;
        background: #fff1cf;
        color: #5a3b00;
        font-weight: 800;
        font-size: 0.82rem;
      }
    `,
  ],
})
export class EmBreveComponent {
  readonly icone = input.required<string>();
  readonly titulo = input.required<string>();
  readonly texto = input.required<string>();
}

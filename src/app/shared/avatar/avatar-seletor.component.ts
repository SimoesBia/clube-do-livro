import { Component, model, signal } from '@angular/core';
import { AVATARES } from '../../core/modelos';
import { AvatarComponent } from './avatar.component';

// A "vitrine": todas as bonecas prontas, e a pessoa toca naquela que quer ser.
@Component({
  selector: 'app-avatar-seletor',
  imports: [AvatarComponent],
  template: `
    <div class="vitrine">
      <div class="destaque" [class.pulso]="pulso()">
        <app-avatar [avatarId]="escolhido()" [tamanho]="130"></app-avatar>
        <p class="manuscrita">{{ escolhido() ? 'Essa vai ser você!' : 'Toque em quem você quer ser' }}</p>
      </div>

      <div class="grade" role="radiogroup" aria-label="Escolha seu avatar">
        @for (a of avatares; track a.id; let i = $index) {
          <button
            type="button"
            class="item"
            role="radio"
            [class.ativo]="escolhido() === a.id"
            [attr.aria-checked]="escolhido() === a.id"
            [attr.aria-label]="'Avatar ' + (i + 1)"
            (click)="escolher(a.id)"
          >
            <app-avatar [avatarId]="a.id" [tamanho]="84"></app-avatar>
            @if (escolhido() === a.id) {
              <span class="marca" aria-hidden="true">✓</span>
            }
          </button>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .vitrine {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      .destaque {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        text-align: center;
      }
      .destaque.pulso {
        animation: pop 0.35s ease;
      }
      @keyframes pop {
        0% { transform: scale(1); }
        45% { transform: scale(1.05) rotate(-1.5deg); }
        100% { transform: scale(1); }
      }
      .destaque p {
        margin: 0;
      }
      .grade {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
        gap: 14px 8px;
        justify-items: center;
      }
      .item {
        position: relative;
        padding: 0;
        border: none;
        background: none;
        cursor: pointer;
        line-height: 0;
        transition: transform 0.15s ease;
      }
      .item:active {
        transform: scale(0.95);
      }
      .item.ativo {
        transform: scale(1.06);
        filter: drop-shadow(0 6px 12px rgba(209, 50, 95, 0.5));
      }
      .marca {
        position: absolute;
        right: -4px;
        bottom: -4px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: var(--cob-framboesa);
        color: #fff;
        font-size: 14px;
        font-weight: 700;
        line-height: 24px;
        text-align: center;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
      }
    `,
  ],
})
export class AvatarSeletorComponent {
  // Entrada e saída ao mesmo tempo: quem usa recebe o avatar escolhido e é avisado quando muda
  readonly escolhido = model<string | null>(null);

  protected readonly avatares = AVATARES;
  protected readonly pulso = signal(false);

  protected escolher(id: string) {
    this.escolhido.set(id);
    this.pulso.set(true);
    setTimeout(() => this.pulso.set(false), 350);
  }
}

import { Component, computed, inject, input } from '@angular/core';
import { Perfil, nivelDoPerfil } from '../../core/modelos';
import { ResumoMembroService } from '../../core/resumo-membro.service';
import { AvatarComponent } from './avatar.component';

// A boneca de um membro, já com o aro do nível dele e o troféu (se já ganhou algum desafio).
// Toque nela para ver o cartãozinho de resumo da pessoa.
// Use este componente sempre que tiver os dados da pessoa em mãos.
@Component({
  selector: 'app-avatar-membro',
  imports: [AvatarComponent],
  host: {
    '[class.clicavel]': 'podeAbrir()',
    '[attr.role]': 'podeAbrir() ? "button" : null',
    '[attr.tabindex]': 'podeAbrir() ? 0 : null',
    '[attr.aria-label]': 'podeAbrir() ? "Ver resumo da pessoa" : null',
    '(click)': 'abrir($event)',
    '(keydown.enter)': 'abrir($event)',
  },
  template: `<app-avatar
    [avatarId]="membro()?.avatar_id"
    [tamanho]="tamanho()"
    [nivel]="nivel()"
    [trofeus]="membro()?.vitorias ?? 0"
  ></app-avatar>`,
  styles: [
    `
      :host {
        display: inline-block;
        line-height: 0;
      }
      :host(.clicavel) {
        cursor: pointer;
        transition: transform 0.15s ease;
      }
      :host(.clicavel:hover) {
        transform: translateY(-2px);
      }
      :host(.clicavel:active) {
        transform: scale(0.94);
      }
    `,
  ],
})
export class AvatarMembroComponent {
  private readonly resumo = inject(ResumoMembroService);

  readonly membro = input<(Pick<Perfil, 'avatar_id' | 'participacoes' | 'vitorias'> & { id?: string }) | null | undefined>();
  readonly tamanho = input(48);
  readonly clicavel = input(true); // desligue onde tocar já faz outra coisa (ex.: botão do perfil no topo)

  protected readonly nivel = computed(() => nivelDoPerfil(this.membro()));
  protected readonly podeAbrir = computed(() => this.clicavel() && !!this.membro()?.id);

  protected abrir(evento: Event) {
    const id = this.membro()?.id;
    if (!this.clicavel() || !id) return;
    evento.stopPropagation();
    this.resumo.abrir(id);
  }
}

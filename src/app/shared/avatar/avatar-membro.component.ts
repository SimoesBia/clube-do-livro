import { Component, computed, input } from '@angular/core';
import { Perfil, nivelDoPerfil } from '../../core/modelos';
import { AvatarComponent } from './avatar.component';

// A boneca de um membro, já com o aro do nível dele e o troféu (se já ganhou algum desafio).
// Use este componente sempre que tiver os dados da pessoa em mãos.
@Component({
  selector: 'app-avatar-membro',
  imports: [AvatarComponent],
  template: `<app-avatar
    [avatarId]="membro()?.avatar_id"
    [tamanho]="tamanho()"
    [nivel]="nivel()"
    [trofeus]="membro()?.vitorias ?? 0"
  ></app-avatar>`,
  styles: [':host { display: inline-block; line-height: 0; }'],
})
export class AvatarMembroComponent {
  readonly membro = input<Pick<Perfil, 'avatar_id' | 'participacoes' | 'vitorias'> | null | undefined>();
  readonly tamanho = input(48);

  protected readonly nivel = computed(() => nivelDoPerfil(this.membro()));
}

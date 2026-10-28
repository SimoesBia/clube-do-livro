import { Component, computed, input } from '@angular/core';
import { NivelAvatar, avatarPorId } from '../../core/modelos';

// Cores do aro de cada nível
const FUNDOS_DO_ARO: Record<NivelAvatar, string> = {
  inicial: '#7A1230',
  bronze: 'linear-gradient(135deg, #8C4A1E, #E8AE76 45%, #A55E2B)',
  prata: 'linear-gradient(135deg, #8F98A6, #F6F8FA 45%, #848D9B)',
  ouro: 'linear-gradient(135deg, #B8791A, #FFE58A 45%, #C9922B)',
  diamante: 'linear-gradient(135deg, #79E4F6, #F2FDFF 35%, #B9A8FF 65%, #79E4F6)',
};

// As bonecas são retratos um pouco mais altos do que largos (a largura é 0,75 a 0,80 da altura).
// Todas as molduras usam a mesma proporção, então todos os aros ficam iguais.
const PROPORCAO = 0.77;

// Cor do troféu (a mesma do aro do nível)
const COR_DO_TROFEU: Record<NivelAvatar, string> = {
  inicial: '#B8742F',
  bronze: '#B8742F',
  prata: '#AEB7C4',
  ouro: '#E3B02C',
  diamante: '#6FD8EE',
};

// A boneca escolhida pela pessoa, dentro de uma moldura com o aro do nível dela
// (começa vinho e evolui com os desafios). A imagem aparece inteira, sem corte e sem esticar.
@Component({
  selector: 'app-avatar',
  template: `
    <span
      class="aro"
      [class.diamante]="nivel() === 'diamante'"
      [style.background]="fundoDoAro()"
      [style.padding.px]="espessura()"
      [style.border-radius.px]="raioInterno() + espessura()"
    >
      <span
        class="moldura"
        [style.width.px]="tamanho()"
        [style.height.px]="altura()"
        [style.border-radius.px]="raioInterno()"
        [style.background]="fundoDaMoldura()"
      >
        @if (boneca(); as b) {
          <img [src]="b.arquivo" alt="" draggable="false" decoding="async" />
        } @else {
          <span class="vazio" [style.font-size.px]="tamanho() * 0.42">📖</span>
        }
      </span>
    </span>
    @if (trofeus() > 0) {
      <span
        class="trofeu"
        [style.width.px]="seloTrofeu()"
        [style.height.px]="seloTrofeu()"
        [style.right.px]="-seloTrofeu() * 0.2"
        [style.bottom.px]="-seloTrofeu() * 0.12"
        [attr.title]="trofeus() + (trofeus() === 1 ? ' troféu' : ' troféus')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 3h10v6a5 5 0 0 1-10 0V3z" [attr.fill]="corDoTrofeu()" />
          <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" [attr.stroke]="corDoTrofeu()" stroke-width="1.7" fill="none" stroke-linecap="round" />
          <path d="M12 14v4M8.5 21h7M10 18h4" [attr.stroke]="corDoTrofeu()" stroke-width="2" stroke-linecap="round" fill="none" />
        </svg>
        <span class="numero" [style.font-size.px]="seloTrofeu() * 0.46">{{ trofeus() }}</span>
      </span>
    }
  `,
  styles: [
    `
      :host {
        display: inline-block;
        position: relative;
        line-height: 0;
        flex-shrink: 0;
      }
      .trofeu {
        position: absolute;
        display: block;
        filter: drop-shadow(0 0 1.2px #fff) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
      }
      .trofeu svg {
        display: block;
        width: 100%;
        height: 100%;
      }
      .numero {
        position: absolute;
        top: -34%;
        right: -42%;
        min-width: 1.5em;
        padding: 0 0.2em;
        border-radius: 999px;
        background: #7a1230;
        color: #fff;
        font-weight: 700;
        line-height: 1.5em;
        text-align: center;
        box-sizing: border-box;
      }
      .aro {
        display: inline-block;
        box-shadow: 0 2px 8px rgba(122, 18, 48, 0.18);
      }
      .aro.diamante {
        background-size: 220% 220%;
        animation: brilho-diamante 4s ease-in-out infinite;
      }
      @keyframes brilho-diamante {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
      }
      .moldura {
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain; /* mostra a imagem inteira, sem cortar nem esticar */
        user-select: none;
      }
      .vazio {
        line-height: 1;
      }
    `,
  ],
})
export class AvatarComponent {
  // Entradas: o que quem usa o componente pode informar
  readonly avatarId = input<string | null | undefined>();
  readonly tamanho = input(48); // largura da moldura, em pixels
  readonly nivel = input<NivelAvatar>('inicial');
  readonly trofeus = input(0); // quantos desafios a pessoa já ganhou (só aparece se for maior que zero)

  protected readonly boneca = computed(() => avatarPorId(this.avatarId()));
  protected readonly altura = computed(() => this.tamanho() / PROPORCAO);
  protected readonly espessura = computed(() => Math.min(6, Math.max(2, this.tamanho() * 0.045)));
  protected readonly raioInterno = computed(() => this.tamanho() * 0.09);
  protected readonly fundoDoAro = computed(() => FUNDOS_DO_ARO[this.nivel()] ?? FUNDOS_DO_ARO.inicial);
  protected readonly seloTrofeu = computed(() => Math.max(16, this.tamanho() * 0.3));
  protected readonly corDoTrofeu = computed(() => COR_DO_TROFEU[this.nivel()] ?? COR_DO_TROFEU.bronze);
  protected readonly fundoDaMoldura = computed(() => this.boneca()?.fundo ?? '#FDE3E7');
}

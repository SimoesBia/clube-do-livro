import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { IonSpinner } from '@ionic/angular';
import { LivrosLidosService } from '../../core/livros-lidos.service';
import { NOMES_DOS_NIVEIS, Perfil, nivelDoPerfil } from '../../core/modelos';
import { ResumoMembroService } from '../../core/resumo-membro.service';
import { SupabaseService } from '../../core/supabase.service';
import { AvatarComponent } from '../avatar/avatar.component';

type DadosDoMembro = Pick<Perfil, 'id' | 'nome' | 'avatar_id' | 'participacoes' | 'vitorias'>;

// O cartãozinho que abre quando alguém toca na boneca de outra pessoa:
// nome, nível do aro, troféus e livros lidos.
@Component({
  selector: 'app-resumo-membro',
  imports: [IonSpinner, AvatarComponent],
  template: `
    @if (resumo.aberto()) {
      <div class="sobreposicao">
        <div class="sobreposicao-fundo" (click)="resumo.fechar()"></div>
        <div class="cartao-flutuante cartao" role="dialog" aria-modal="true" aria-label="Resumo do membro">
          <button type="button" class="fechar" (click)="resumo.fechar()" aria-label="Fechar">✕</button>

          @if (carregando()) {
            <div class="centro"><ion-spinner name="dots"></ion-spinner></div>
          } @else if (dados(); as d) {
            <app-avatar [avatarId]="d.avatar_id" [tamanho]="124" [nivel]="nivel()" [trofeus]="d.vitorias"></app-avatar>
            <h2 class="titulo-serif">{{ d.nome }}</h2>
            <span class="selo" [attr.data-nivel]="nivel()">Nível {{ nomeDoNivel() }}</span>

            <div class="numeros">
              <div>
                <strong>🏆 {{ d.vitorias }}</strong>
                <span>{{ d.vitorias === 1 ? 'troféu' : 'troféus' }}</span>
              </div>
              <div>
                <strong>📚 {{ livros() }}</strong>
                <span>{{ livros() === 1 ? 'livro lido' : 'livros lidos' }}</span>
              </div>
              <div>
                <strong>🎯 {{ d.participacoes }}</strong>
                <span>{{ d.participacoes === 1 ? 'desafio' : 'desafios' }}</span>
              </div>
            </div>
          } @else {
            <p class="suave">Não consegui abrir esse perfil agora.</p>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .cartao {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        max-width: 340px;
        padding-top: 30px;
      }
      .fechar {
        position: absolute;
        top: 10px;
        right: 12px;
        width: 34px;
        height: 34px;
        border: none;
        border-radius: 50%;
        background: #fde3e7;
        color: var(--cob-vinho);
        font-weight: 700;
        cursor: pointer;
      }
      h2 {
        margin: 14px 0 6px;
        font-size: 1.8rem;
      }
      .selo {
        padding: 4px 14px;
        border-radius: 999px;
        font-weight: 700;
        font-size: 0.85rem;
        color: #fff;
        background: var(--cob-vinho);
      }
      .selo[data-nivel='bronze'] { background: #b8742f; }
      .selo[data-nivel='prata'] { background: #8f98a6; }
      .selo[data-nivel='ouro'] { background: #c9922b; }
      .selo[data-nivel='diamante'] { background: linear-gradient(90deg, #39c5df, #8f7bff); }
      .numeros {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        width: 100%;
        margin-top: 18px;
      }
      .numeros div {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 10px 4px;
        border-radius: 16px;
        background: #fff;
        box-shadow: 0 4px 14px var(--cob-sombra);
      }
      .numeros strong {
        font-size: 1.15rem;
      }
      .numeros span {
        font-size: 0.78rem;
        color: #8c5a68;
      }
      .centro {
        padding: 40px;
      }
    `,
  ],
})
export class ResumoMembroComponent {
  protected readonly resumo = inject(ResumoMembroService);
  private readonly sb = inject(SupabaseService).cliente;
  private readonly lidos = inject(LivrosLidosService);

  protected readonly dados = signal<DadosDoMembro | null>(null);
  protected readonly livros = signal(0);
  protected readonly carregando = signal(false);

  protected readonly nivel = computed(() => nivelDoPerfil(this.dados()));
  protected readonly nomeDoNivel = computed(() => NOMES_DOS_NIVEIS[this.nivel()]);

  constructor() {
    effect(() => {
      const id = this.resumo.aberto();
      if (id) untracked(() => void this.carregar(id));
    });
  }

  private async carregar(id: string) {
    this.carregando.set(true);
    this.dados.set(null);
    const { data } = await this.sb
      .from('perfis')
      .select('id, nome, avatar_id, participacoes, vitorias')
      .eq('id', id)
      .maybeSingle();
    this.dados.set((data as DadosDoMembro | null) ?? null);
    this.livros.set(await this.lidos.contar(id));
    this.carregando.set(false);
  }
}

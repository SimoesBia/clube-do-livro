import { Component, computed, effect, inject, output, signal, untracked, input } from '@angular/core';
import { IonButton, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { DesafiosService } from '../../core/desafios.service';
import { UNIDADES, UnidadeDesafio } from '../../core/modelos';
import { AvatarMembroComponent } from '../avatar/avatar-membro.component';

interface Modelo {
  id: string;
  nome: string;
  titulo: string;
  descricao: string;
  unidade: UnidadeDesafio;
  meta: number;
}

// Ideias prontas (dá para mudar tudo depois de escolher)
const MODELOS: Modelo[] = [
  { id: 'livros', nome: '📚 Maratona de livros', titulo: 'Maratona de livros', descricao: 'Quem terminar mais livros até o fim do desafio leva o troféu!', unidade: 'livros', meta: 3 },
  { id: 'paginas', nome: '📖 Maratona de páginas', titulo: 'Maratona de páginas', descricao: 'Vale qualquer livro. Conta quantas páginas você leu.', unidade: 'paginas', meta: 1000 },
  { id: 'tempo', nome: '⏱️ Tempo de leitura', titulo: 'Leitura todo dia', descricao: 'Anote quantos minutos você leu. Quem ler mais tempo ganha!', unidade: 'minutos', meta: 600 },
  { id: 'tema', nome: '🎨 Desafio temático', titulo: 'Desafio temático', descricao: 'Ex.: ler um livro cujo título começa com a letra A, ou com capa de uma cor combinada. Descreva a regra aqui!', unidade: 'livros', meta: 1 },
];

// O formulário para criar um desafio e convidar as pessoas
@Component({
  selector: 'app-criar-desafio',
  imports: [IonButton, IonSpinner, AvatarMembroComponent],
  template: `
    @if (aberto()) {
      <div class="sobreposicao">
        <div class="sobreposicao-fundo" (click)="fechar.emit()"></div>
        <div class="cartao-flutuante" role="dialog" aria-modal="true" aria-label="Criar desafio">
          <button type="button" class="x" (click)="fechar.emit()" aria-label="Fechar">✕</button>
          <h2 class="titulo-serif">Criar um desafio 🏆</h2>

          <span class="rotulo-campo">Comece por uma ideia</span>
          <div class="fichas">
            @for (m of modelos; track m.id) {
              <button type="button" class="pilula" [class.ativa]="modelo() === m.id" (click)="usarModelo(m)">{{ m.nome }}</button>
            }
          </div>

          <label class="rotulo-campo" for="d-titulo">Nome do desafio</label>
          <input id="d-titulo" class="campo" type="text" maxlength="80" placeholder="Ex.: Maratona de novembro" [value]="titulo()" (input)="titulo.set($any($event.target).value)" />

          <label class="rotulo-campo" for="d-descricao">Como funciona? (a regra)</label>
          <textarea id="d-descricao" class="campo" maxlength="500" placeholder="Explique a regra para o pessoal" [value]="descricao()" (input)="descricao.set($any($event.target).value)"></textarea>

          <span class="rotulo-campo">O que vai ser contado?</span>
          <div class="fichas">
            @for (u of unidades; track u.valor) {
              <button type="button" class="pilula" [class.ativa]="unidade() === u.valor" (click)="unidade.set(u.valor)">{{ u.nome }}</button>
            }
          </div>

          <div class="duas">
            <div>
              <label class="rotulo-campo" for="d-meta">Meta ({{ nomeDaUnidade() }})</label>
              <input id="d-meta" class="campo" type="number" inputmode="numeric" min="1" max="100000" [value]="meta()" (input)="meta.set($any($event.target).value)" />
            </div>
            <div>
              <label class="rotulo-campo" for="d-fim">Termina em (opcional)</label>
              <input id="d-fim" class="campo" type="date" [min]="hoje" [value]="fim()" (input)="fim.set($any($event.target).value)" />
            </div>
          </div>

          <span class="rotulo-campo">Quem você quer convidar?</span>
          <div class="pessoas">
            @for (m of convidaveis(); track m.id) {
              <button type="button" class="pessoa" [class.marcada]="convidados().includes(m.id)" (click)="alternar(m.id)" [attr.aria-pressed]="convidados().includes(m.id)">
                <app-avatar-membro [membro]="m" [tamanho]="34" [clicavel]="false"></app-avatar-membro>
                <span>{{ m.nome }}</span>
                <b>{{ convidados().includes(m.id) ? '✓' : '+' }}</b>
              </button>
            } @empty {
              <p class="suave">Ainda não tem outras pessoas no clube para convidar.</p>
            }
          </div>

          @if (erro()) {
            <p class="erro" role="alert">{{ erro() }}</p>
          }

          <ion-button expand="block" [disabled]="criando()" (click)="criar()">
            @if (criando()) {
              <ion-spinner name="dots"></ion-spinner>
            } @else {
              Criar e convidar
            }
          </ion-button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .x {
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
        margin: 0 0 4px;
        font-size: 1.6rem;
        padding-right: 36px;
      }
      .fichas {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .duas {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .pessoas {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 210px;
        overflow-y: auto;
        padding: 2px;
      }
      .pessoa {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 10px;
        border: 1.5px solid #f0b9c4;
        border-radius: 14px;
        background: #fff;
        font-family: inherit;
        font-weight: 700;
        color: inherit;
        text-align: left;
        cursor: pointer;
      }
      .pessoa span {
        flex: 1;
      }
      .pessoa.marcada {
        border-color: var(--cob-framboesa);
        background: #fff0f3;
      }
      .pessoa b {
        color: var(--cob-framboesa);
        font-size: 1.1rem;
      }
      ion-button {
        margin-top: 16px;
      }
    `,
  ],
})
export class CriarDesafioComponent {
  private readonly auth = inject(AuthService);
  private readonly desafios = inject(DesafiosService);

  readonly aberto = input(false);
  readonly fechar = output<void>();

  protected readonly modelos = MODELOS;
  protected readonly unidades = UNIDADES;
  protected readonly hoje = new Date().toISOString().slice(0, 10);

  protected readonly modelo = signal('livros');
  protected readonly titulo = signal(MODELOS[0].titulo);
  protected readonly descricao = signal(MODELOS[0].descricao);
  protected readonly unidade = signal<UnidadeDesafio>(MODELOS[0].unidade);
  protected readonly meta = signal(String(MODELOS[0].meta));
  protected readonly fim = signal('');
  protected readonly convidados = signal<string[]>([]);
  protected readonly erro = signal('');
  protected readonly criando = signal(false);

  protected readonly convidaveis = computed(() => this.auth.membros().filter((m) => m.id !== this.auth.perfil()?.id));
  protected readonly nomeDaUnidade = computed(() => UNIDADES.find((u) => u.valor === this.unidade())?.plural ?? '');

  constructor() {
    // Sempre que o formulário abre, carrega as pessoas do clube
    effect(() => {
      if (this.aberto()) untracked(() => void this.auth.carregarMembros());
    });
  }

  protected usarModelo(m: Modelo) {
    this.modelo.set(m.id);
    this.titulo.set(m.titulo);
    this.descricao.set(m.descricao);
    this.unidade.set(m.unidade);
    this.meta.set(String(m.meta));
  }

  protected alternar(id: string) {
    this.convidados.update((lista) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]));
  }

  protected async criar() {
    this.erro.set('');
    const meta = Math.round(Number(this.meta()));
    if (this.titulo().trim().length < 2) return this.erro.set('Dê um nome para o desafio.');
    if (!Number.isFinite(meta) || meta < 1 || meta > 100000) return this.erro.set('A meta precisa ser um número entre 1 e 100000.');
    if (this.fim() && this.fim() < this.hoje) return this.erro.set('A data final não pode ser no passado.');

    this.criando.set(true);
    const erro = await this.desafios.criar(
      { titulo: this.titulo(), descricao: this.descricao(), unidade: this.unidade(), meta, fim: this.fim() },
      this.convidados(),
    );
    this.criando.set(false);
    if (erro) return this.erro.set(erro);

    this.convidados.set([]);
    this.fechar.emit();
  }
}

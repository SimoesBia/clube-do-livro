import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonSpinner } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { Perfil } from '../../core/modelos';
import { ResumoMembroService } from '../../core/resumo-membro.service';
import { SupabaseService } from '../../core/supabase.service';
import { AvatarMembroComponent } from '../avatar/avatar-membro.component';

type Membro = Pick<Perfil, 'id' | 'nome' | 'avatar_id' | 'participacoes' | 'vitorias'>;
const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

@Component({
  selector: 'app-membros',
  imports: [FormsModule, IonSpinner, AvatarMembroComponent],
  template: `
    <section class="secao" aria-labelledby="titulo-membros">
      <h2 id="titulo-membros" class="titulo-serif">Quem faz parte do clube</h2>
      <p class="suave">Toque em uma integrante para ver seu perfil ou enviar uma mensagem.</p>
      <label for="buscar-membro">Buscar pelo nome</label>
      <input id="buscar-membro" type="search" placeholder="Quem você procura?" [ngModel]="busca()" (ngModelChange)="busca.set($event)" />
      @if (carregando()) {
        <div class="estado" role="status"><ion-spinner name="dots"></ion-spinner><span>Carregando integrantes…</span></div>
      } @else if (erro()) {
        <div class="estado" role="alert"><p>{{ erro() }}</p><button type="button" class="pilula" (click)="carregar()">Tentar novamente</button></div>
      } @else {
        <p class="suave" role="status">{{ filtrados().length }} de {{ membros().length }} integrantes</p>
        <div class="grade">
          @for (m of filtrados(); track m.id) {
            <button type="button" class="membro" (click)="resumo.abrir(m.id)" [attr.aria-label]="'Abrir card de ' + m.nome">
              <app-avatar-membro [membro]="m" [tamanho]="80" [clicavel]="false"></app-avatar-membro>
              <strong>{{ m.nome }}</strong>
              <span>{{ m.id === auth.perfil()?.id ? 'Você' : 'Ver card' }}</span>
            </button>
          } @empty {
            <p class="suave">{{ busca().trim() ? 'Nenhuma integrante encontrada com esse nome.' : 'Ainda não há integrantes para mostrar.' }}</p>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    h2 { margin-bottom: 8px; font-size: 1.6rem; }
    label { display: block; margin: 18px 0 6px; font-weight: 700; }
    input { width: 100%; box-sizing: border-box; padding: 12px; border: 1px solid #dda3b2; border-radius: 14px; background: #fff; color: #55152b; font: inherit; }
    .grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; }
    .membro { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 16px 10px; border: 1px solid #f2ced6; border-radius: 20px; background: #fff6f7; color: var(--cob-vinho); font: inherit; cursor: pointer; box-shadow: 0 3px 10px var(--cob-sombra); }
    .membro strong { overflow-wrap: anywhere; }
    .membro span { font-size: .85rem; }
    .membro:hover { background: #fde3e7; }
    .membro:focus-visible, input:focus-visible { outline: 2px solid var(--cob-vinho); outline-offset: 3px; }
    .estado { display: flex; flex-direction: column; align-items: center; padding: 24px 0; gap: 10px; }
  `],
})
export class MembrosComponent implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  protected readonly resumo = inject(ResumoMembroService);
  private readonly sb = inject(SupabaseService).cliente;
  protected readonly membros = signal<Membro[]>([]);
  protected readonly busca = signal('');
  protected readonly carregando = signal(true);
  protected readonly erro = signal('');
  protected readonly filtrados = computed(() => {
    const termo = normalizar(this.busca());
    return this.membros().filter(m => normalizar(m.nome).includes(termo));
  });
  private versao = 0;

  ngOnInit() { void this.carregar(); }
  ngOnDestroy() { ++this.versao; }

  protected async carregar() {
    const versao = ++this.versao;
    this.carregando.set(true);
    this.erro.set('');
    try {
      const todos: Membro[] = [];
      // Pagina para incluir também quem ultrapassar o limite de resposta do banco.
      for (let inicio = 0; ; inicio += 100) {
        const { data, error } = await this.sb.from('perfis')
          .select('id, nome, avatar_id, participacoes, vitorias')
          .order('nome').order('id').range(inicio, inicio + 99);
        if (versao !== this.versao) return;
        if (error) throw error;
        const pagina = (data ?? []) as Membro[];
        todos.push(...pagina);
        if (pagina.length < 100) break;
      }
      this.membros.set(todos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
    } catch {
      if (versao === this.versao) this.erro.set('Não consegui carregar as integrantes agora. Tente novamente.');
    } finally {
      if (versao === this.versao) this.carregando.set(false);
    }
  }
}

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { IonButton, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { Autor } from '../../core/modelos';
import { SupabaseService } from '../../core/supabase.service';
import { AvatarMembroComponent } from '../avatar/avatar-membro.component';

interface Recado {
  perfil_id: string;
  mes: string;
  texto: string;
  atualizado_em: string;
  quem: Autor | null;
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

// Os recadinhos: cada pessoa conta com suas palavras quando está livre (ex.: "sábados à tarde")
@Component({
  selector: 'app-recados',
  imports: [IonButton, IonSpinner, AvatarMembroComponent],
  template: `
    <section class="secao">
      <div class="cabeca">
        <button type="button" class="seta" (click)="mudarMes(-1)" aria-label="Mês anterior">‹</button>
        <h2 class="titulo-serif">{{ nomeDoMes() }} de {{ ano() }}</h2>
        <button type="button" class="seta" (click)="mudarMes(1)" aria-label="Próximo mês">›</button>
      </div>

      <label class="rotulo-campo" for="meu-recado">Seu recadinho para esse mês</label>
      <textarea
        id="meu-recado"
        class="campo"
        maxlength="500"
        placeholder="Ex.: Prefiro sábado à tarde. Domingos eu não consigo!"
        [value]="texto()"
        (input)="aoDigitar($event)"
      ></textarea>
      <div class="rodape">
        <span class="contador">{{ texto().length }}/500</span>
        <ion-button [disabled]="!texto().trim() || salvando()" (click)="salvar()">
          @if (salvando()) {
            <ion-spinner name="dots"></ion-spinner>
          } @else {
            Salvar recadinho
          }
        </ion-button>
      </div>
      @if (mensagem()) {
        <p class="aviso" role="status">{{ mensagem() }}</p>
      }
    </section>

    <section class="secao">
      <h3 class="titulo-serif">Recadinhos de {{ nomeDoMes() }}</h3>
      @if (carregando()) {
        <div class="centro"><ion-spinner name="dots"></ion-spinner></div>
      }
      @for (r of recados(); track r.perfil_id) {
        <div class="recado">
          <app-avatar-membro [membro]="r.quem" [tamanho]="40"></app-avatar-membro>
          <div class="corpo">
            <strong>{{ r.quem?.nome ?? 'Alguém do clube' }}</strong>
            <p>{{ r.texto }}</p>
          </div>
        </div>
      } @empty {
        @if (!carregando()) {
          <p class="suave">Ninguém deixou recadinho nesse mês ainda.</p>
        }
      }
    </section>
  `,
  styles: [
    `
      .cabeca {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;
      }
      h2 {
        font-size: 1.5rem;
        text-transform: capitalize;
      }
      h3 {
        font-size: 1.25rem;
        margin: 0 0 8px;
        text-transform: none;
      }
      .seta {
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 50%;
        background: #fde3e7;
        color: var(--cob-vinho);
        font-size: 1.6rem;
        font-weight: 700;
        line-height: 1;
        cursor: pointer;
      }
      .rodape {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 8px;
      }
      .contador {
        font-size: 0.8rem;
        color: #b58b98;
      }
      .centro {
        display: flex;
        justify-content: center;
      }
      .recado {
        display: flex;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid #f7dde2;
        animation: entrar 0.35s ease both;
      }
      .recado:last-child {
        border-bottom: none;
      }
      @keyframes entrar {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: none; }
      }
      .corpo p {
        margin: 2px 0 0;
        line-height: 1.45;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class RecadosComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly sb = inject(SupabaseService).cliente;

  private readonly hoje = new Date();
  protected readonly ano = signal(this.hoje.getFullYear());
  protected readonly mes = signal(this.hoje.getMonth());
  protected readonly texto = signal('');
  protected readonly recados = signal<Recado[]>([]);
  protected readonly carregando = signal(false);
  protected readonly salvando = signal(false);
  protected readonly mensagem = signal('');

  protected readonly nomeDoMes = computed(() => MESES[this.mes()]);

  async ngOnInit() {
    await this.recarregar();
  }

  private primeiroDia(): string {
    return `${this.ano()}-${String(this.mes() + 1).padStart(2, '0')}-01`;
  }

  async recarregar() {
    this.carregando.set(true);
    const { data } = await this.sb
      .from('recados_encontro')
      .select('perfil_id, mes, texto, atualizado_em, quem:perfis(id, nome, avatar_id, participacoes, vitorias)')
      .eq('mes', this.primeiroDia())
      .order('atualizado_em', { ascending: false });
    const lista = (data ?? []) as unknown as Recado[];
    this.recados.set(lista);
    const meu = lista.find((r) => r.perfil_id === this.auth.perfil()?.id);
    this.texto.set(meu?.texto ?? '');
    this.carregando.set(false);
  }

  protected aoDigitar(evento: Event) {
    this.texto.set((evento.target as HTMLTextAreaElement).value);
  }

  protected async mudarMes(delta: number) {
    let mes = this.mes() + delta;
    let ano = this.ano();
    if (mes < 0) { mes = 11; ano--; }
    if (mes > 11) { mes = 0; ano++; }
    this.mes.set(mes);
    this.ano.set(ano);
    this.mensagem.set('');
    await this.recarregar();
  }

  protected async salvar() {
    const meuId = this.auth.perfil()?.id;
    const texto = this.texto().trim();
    if (!meuId || !texto) return;
    this.salvando.set(true);
    this.mensagem.set('');
    const { error } = await this.sb
      .from('recados_encontro')
      .upsert({ perfil_id: meuId, mes: this.primeiroDia(), texto, atualizado_em: new Date().toISOString() }, { onConflict: 'perfil_id,mes' });
    this.salvando.set(false);
    if (error) {
      this.mensagem.set('Não deu para salvar agora. Tente de novo.');
      return;
    }
    this.mensagem.set('Recadinho salvo! 💌');
    await this.recarregar();
  }
}

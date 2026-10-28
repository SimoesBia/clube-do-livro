import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { IonSpinner } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { Perfil } from '../../core/modelos';
import { SupabaseService } from '../../core/supabase.service';
import { AvatarMembroComponent } from '../avatar/avatar-membro.component';

interface Celula {
  dia: number | null;
  iso: string;
  livres: number;
  euLivre: boolean;
  hoje: boolean;
  passado: boolean;
  melhor: boolean;
}

interface LinhaDeDisponibilidade {
  perfil_id: string;
  dia: string; // AAAA-MM-DD
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const iso = (ano: number, mes: number, dia: number) =>
  `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

// O calendário do clube: cada pessoa marca os dias em que está livre e todo mundo vê
// quais dias têm mais gente livre (quanto mais rosa, mais gente).
@Component({
  selector: 'app-calendario',
  imports: [IonSpinner, AvatarMembroComponent],
  template: `
    <section class="secao">
      <div class="cabeca">
        <button type="button" class="seta" (click)="mudarMes(-1)" aria-label="Mês anterior">‹</button>
        <h2 class="titulo-serif">{{ nomeDoMes() }} de {{ ano() }}</h2>
        <button type="button" class="seta" (click)="mudarMes(1)" aria-label="Próximo mês">›</button>
      </div>

      <p class="suave dica">Toque nos dias em que <strong>você</strong> está livre. Quanto mais rosa o dia, mais gente livre!</p>

      <div class="semana" aria-hidden="true">
        @for (d of semana; track $index) {
          <span>{{ d }}</span>
        }
      </div>

      <div class="grade" [class.carregando]="carregando()">
        @for (c of celulas(); track $index) {
          @if (c.dia === null) {
            <span class="vazio"></span>
          } @else {
            <button
              type="button"
              class="dia"
              [class.hoje]="c.hoje"
              [class.passado]="c.passado"
              [class.eu]="c.euLivre"
              [class.escolhido]="selecionado() === c.iso"
              [style.background]="fundo(c)"
              [style.color]="c.livres / total() > 0.5 ? '#fff' : 'inherit'"
              [disabled]="c.passado"
              [attr.aria-label]="c.dia + ' de ' + nomeDoMes() + ': ' + c.livres + ' pessoas livres' + (c.euLivre ? ', você está livre' : '')"
              (click)="alternar(c)"
            >
              <span class="numero">{{ c.dia }}</span>
              @if (c.livres > 0) {
                <span class="contagem">{{ c.livres }}</span>
              }
              @if (c.melhor) {
                <span class="estrela" aria-hidden="true">★</span>
              }
              @if (c.euLivre) {
                <span class="coracao" aria-hidden="true">♥</span>
              }
            </button>
          }
        }
      </div>

      @if (carregando()) {
        <div class="centro"><ion-spinner name="dots"></ion-spinner></div>
      }
      @if (erro()) {
        <p class="erro" role="alert">{{ erro() }}</p>
      }

      <div class="legenda">
        <span><b class="coracao">♥</b> você está livre</span>
        <span><b class="estrela">★</b> dia com mais gente livre</span>
      </div>
    </section>

    @if (melhores().length > 0) {
      <section class="secao">
        <h3 class="titulo-serif">Melhores dias do mês</h3>
        @for (m of melhores(); track m.iso) {
          <button type="button" class="melhor" (click)="selecionado.set(m.iso)">
            <span class="posicao">{{ $index + 1 }}º</span>
            <span class="texto">{{ m.texto }}</span>
            <span class="gente">{{ m.livres }} {{ m.livres === 1 ? 'pessoa' : 'pessoas' }}</span>
          </button>
        }
      </section>
    }

    @if (selecionado(); as dia) {
      <section class="secao">
        <h3 class="titulo-serif">Quem está livre em {{ bonito(dia) }}</h3>
        @for (m of quemEstaLivre(); track m.id) {
          <div class="pessoa">
            <app-avatar-membro [membro]="m" [tamanho]="40"></app-avatar-membro>
            <strong>{{ m.nome }}</strong>
          </div>
        } @empty {
          <p class="suave">Ninguém marcou esse dia ainda.</p>
        }
      </section>
    }
  `,
  styles: [
    `
      .cabeca {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      h2 {
        font-size: 1.5rem;
        text-transform: capitalize;
      }
      h3 {
        font-size: 1.25rem;
        margin: 0 0 8px;
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
      .dica {
        margin: 6px 0 12px;
        font-size: 0.9rem;
      }
      .semana,
      .grade {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 5px;
      }
      .semana span {
        text-align: center;
        font-weight: 700;
        font-size: 0.8rem;
        color: #b58b98;
        padding-bottom: 4px;
      }
      .grade.carregando {
        opacity: 0.55;
      }
      .vazio {
        aspect-ratio: 1;
      }
      .dia {
        position: relative;
        aspect-ratio: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1.5px solid #f7dde2;
        border-radius: 12px;
        font-family: inherit;
        font-weight: 700;
        cursor: pointer;
        padding: 0;
        transition: transform 0.12s ease;
      }
      .dia:active:not(:disabled) {
        transform: scale(0.92);
      }
      .dia.passado {
        opacity: 0.35;
        cursor: default;
      }
      .dia.hoje {
        border-color: var(--cob-vinho);
        border-width: 2px;
      }
      .dia.escolhido {
        box-shadow: 0 0 0 3px rgba(209, 50, 95, 0.4);
      }
      .contagem {
        position: absolute;
        left: 4px;
        bottom: 2px;
        font-size: 0.62rem;
        opacity: 0.85;
      }
      .estrela {
        position: absolute;
        top: 1px;
        right: 4px;
        font-size: 0.78rem;
        color: #d9a441;
        text-shadow: 0 0 2px #fff;
      }
      .coracao {
        position: absolute;
        right: 4px;
        bottom: 1px;
        font-size: 0.78rem;
        color: #d1325f;
        text-shadow: 0 0 2px #fff;
      }
      .legenda {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 16px;
        margin-top: 12px;
        font-size: 0.8rem;
        color: #8c5a68;
      }
      .legenda b {
        position: static;
      }
      .legenda .estrela,
      .legenda .coracao {
        position: static;
        font-size: 0.9rem;
      }
      .centro {
        display: flex;
        justify-content: center;
        margin-top: 8px;
      }
      .melhor {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 10px 4px;
        border: none;
        border-bottom: 1px solid #f7dde2;
        background: none;
        font-family: inherit;
        text-align: left;
        cursor: pointer;
        color: inherit;
      }
      .melhor:last-child {
        border-bottom: none;
      }
      .posicao {
        font-family: 'Fraunces', Georgia, serif;
        font-weight: 700;
        font-size: 1.2rem;
        color: var(--cob-framboesa);
        width: 30px;
      }
      .texto {
        flex: 1;
        font-weight: 700;
        text-transform: capitalize;
      }
      .gente {
        color: #8c5a68;
        font-size: 0.85rem;
      }
      .pessoa {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 6px 0;
      }
    `,
  ],
})
export class CalendarioComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly sb = inject(SupabaseService).cliente;

  protected readonly semana = SEMANA;
  private readonly hoje = new Date();
  private readonly hojeISO = iso(this.hoje.getFullYear(), this.hoje.getMonth(), this.hoje.getDate());

  protected readonly ano = signal(this.hoje.getFullYear());
  protected readonly mes = signal(this.hoje.getMonth());
  protected readonly linhas = signal<LinhaDeDisponibilidade[]>([]);
  protected readonly selecionado = signal<string | null>(null);
  protected readonly carregando = signal(false);
  protected readonly erro = signal('');

  protected readonly nomeDoMes = computed(() => MESES[this.mes()]);
  protected readonly total = computed(() => Math.max(1, this.auth.membros().length));

  protected readonly celulas = computed<Celula[]>(() => {
    const ano = this.ano();
    const mes = this.mes();
    const primeiro = new Date(ano, mes, 1).getDay();
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    const meuId = this.auth.perfil()?.id;

    const porDia = new Map<string, string[]>();
    for (const l of this.linhas()) {
      const lista = porDia.get(l.dia) ?? [];
      lista.push(l.perfil_id);
      porDia.set(l.dia, lista);
    }
    const maximo = Math.max(0, ...Array.from(porDia.values()).map((v) => v.length));

    const lista: Celula[] = [];
    for (let i = 0; i < primeiro; i++) {
      lista.push({ dia: null, iso: '', livres: 0, euLivre: false, hoje: false, passado: false, melhor: false });
    }
    for (let d = 1; d <= diasNoMes; d++) {
      const id = iso(ano, mes, d);
      const pessoas = porDia.get(id) ?? [];
      lista.push({
        dia: d,
        iso: id,
        livres: pessoas.length,
        euLivre: !!meuId && pessoas.includes(meuId),
        hoje: id === this.hojeISO,
        passado: id < this.hojeISO,
        melhor: maximo >= 2 && pessoas.length === maximo,
      });
    }
    return lista;
  });

  protected readonly melhores = computed(() =>
    this.celulas()
      .filter((c) => c.dia !== null && c.livres > 0 && !c.passado)
      .sort((a, b) => b.livres - a.livres || (a.dia ?? 0) - (b.dia ?? 0))
      .slice(0, 3)
      .map((c) => ({
        iso: c.iso,
        livres: c.livres,
        texto: `${new Date(this.ano(), this.mes(), c.dia ?? 1).toLocaleDateString('pt-BR', { weekday: 'long' })}, ${c.dia}`,
      })),
  );

  protected readonly quemEstaLivre = computed<Perfil[]>(() => {
    const dia = this.selecionado();
    if (!dia) return [];
    const ids = new Set(this.linhas().filter((l) => l.dia === dia).map((l) => l.perfil_id));
    return this.auth.membros().filter((m) => ids.has(m.id));
  });

  async ngOnInit() {
    await this.recarregar();
  }

  async recarregar() {
    this.carregando.set(true);
    await this.auth.carregarMembros();
    await this.carregarMes();
    this.carregando.set(false);
  }

  private async carregarMes() {
    const ano = this.ano();
    const mes = this.mes();
    const ultimo = new Date(ano, mes + 1, 0).getDate();
    const { data, error } = await this.sb
      .from('disponibilidade')
      .select('perfil_id, dia')
      .gte('dia', iso(ano, mes, 1))
      .lte('dia', iso(ano, mes, ultimo));
    if (error) {
      this.erro.set('Não deu para carregar o calendário agora.');
      return;
    }
    this.erro.set('');
    this.linhas.set((data ?? []) as LinhaDeDisponibilidade[]);
  }

  protected async mudarMes(delta: number) {
    let mes = this.mes() + delta;
    let ano = this.ano();
    if (mes < 0) { mes = 11; ano--; }
    if (mes > 11) { mes = 0; ano++; }
    this.mes.set(mes);
    this.ano.set(ano);
    this.selecionado.set(null);
    this.carregando.set(true);
    await this.carregarMes();
    this.carregando.set(false);
  }

  // Cor de cada dia: quanto mais gente livre, mais rosa
  protected fundo(c: Celula): string {
    if (c.livres === 0) return '#FFFFFF';
    const forca = 0.2 + 0.7 * Math.min(1, c.livres / this.total());
    return `rgba(209, 50, 95, ${forca.toFixed(2)})`;
  }

  protected bonito(dia: string): string {
    const [a, m, d] = dia.split('-').map(Number);
    const nome = new Date(a, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long' });
    return `${nome}, ${d} de ${MESES[m - 1]}`;
  }

  protected async alternar(c: Celula) {
    if (c.dia === null || c.passado) return;
    const meuId = this.auth.perfil()?.id;
    if (!meuId) return;
    this.selecionado.set(c.iso);
    this.erro.set('');

    const antes = this.linhas();
    if (c.euLivre) {
      this.linhas.set(antes.filter((l) => !(l.perfil_id === meuId && l.dia === c.iso)));
      const { error } = await this.sb.from('disponibilidade').delete().eq('perfil_id', meuId).eq('dia', c.iso);
      if (error) {
        this.linhas.set(antes);
        this.erro.set('Não deu para desmarcar agora. Tente de novo.');
      }
    } else {
      this.linhas.set([...antes, { perfil_id: meuId, dia: c.iso }]);
      const { error } = await this.sb.from('disponibilidade').insert({ perfil_id: meuId, dia: c.iso });
      if (error) {
        this.linhas.set(antes);
        this.erro.set('Não deu para marcar agora. Tente de novo.');
      }
    }
  }
}

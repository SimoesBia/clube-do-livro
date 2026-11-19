import { Component, inject, signal, viewChild } from '@angular/core';
import { IonButton, IonContent, IonSegment, IonSegmentButton, IonLabel } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { ClubeService } from '../../core/clube.service';
import { CalendarioComponent } from '../../shared/calendario/calendario.component';
import { RecadosComponent } from '../../shared/recados/recados.component';
import { TopoComponent } from '../../shared/topo/topo.component';

type Aba = 'calendario' | 'recados';

@Component({
  selector: 'app-encontros',
  imports: [IonContent, IonButton, IonSegment, IonSegmentButton, IonLabel, TopoComponent, CalendarioComponent, RecadosComponent],
  template: `
    <app-topo titulo="Encontros" enfeite="📚"></app-topo>
    <ion-content [fullscreen]="true">
      <section class="intro">
        <h1 class="titulo-serif">Vamos marcar o encontro?</h1>
        <p class="suave">
          Marque os dias em que você está livre e deixe um recadinho. Aqui a gente descobre qual dia cabe para o clube todo.
        </p>
      </section>

      <section class="secao meet">
        <h2 class="titulo-serif">Encontro online 🎥</h2>
        @if (clube.dados().encontro_em) {
          <p><strong>{{ encontroFormatado() }} · horário de Recife</strong></p>
        }
        @if (clube.dados().link_meet; as link) {
          <p class="suave">Na hora do encontro, é só tocar no botão para entrar.</p>
          <a class="entrar" [href]="link" target="_blank" rel="noopener noreferrer">Entrar no encontro</a>
        } @else {
          <p class="suave">O link do encontro ainda não foi combinado. Quando a administração colocar, ele aparece aqui.</p>
        }

        @if (auth.eAdmin()) {
          <div class="admin">
            <label class="rotulo-campo" for="link-meet">Link do encontro (só quem administra vê)</label>
            <input
              id="link-meet"
              class="campo"
              type="url"
              placeholder="https://meet.google.com/..."
              [value]="linkEditado() ?? clube.dados().link_meet ?? ''"
              (input)="linkEditado.set($any($event.target).value)"
            />
            <label class="rotulo-campo" for="data-encontro">Data do encontro (horário de Recife)</label>
            <input id="data-encontro" class="campo" type="date"
              [value]="dataEditada() ?? parteEncontro('data')"
              (input)="dataEditada.set($any($event.target).value)" />
            <label class="rotulo-campo" for="hora-encontro">Horário</label>
            <input id="hora-encontro" class="campo" type="time"
              [value]="horaEditada() ?? parteEncontro('hora')"
              (input)="horaEditada.set($any($event.target).value)" />
            <ion-button size="small" [disabled]="salvando()" (click)="salvarLink()">Salvar encontro</ion-button>
            @if (clube.dados().encontro_em) {
              <ion-button size="small" fill="outline" [disabled]="salvando()" (click)="cancelarEncontro()">Cancelar encontro</ion-button>
            }
            @if (mensagem()) {
              <p class="aviso" role="status">{{ mensagem() }}</p>
            }
          </div>
        }
      </section>

      <ion-segment class="abas" [value]="aba()" (ionChange)="trocar($event)">
        <ion-segment-button value="calendario">
          <ion-label>Calendário</ion-label>
        </ion-segment-button>
        <ion-segment-button value="recados">
          <ion-label>Recadinhos</ion-label>
        </ion-segment-button>
      </ion-segment>

      @if (aba() === 'calendario') {
        <app-calendario></app-calendario>
      } @else {
        <app-recados></app-recados>
      }
    </ion-content>
  `,
  styles: [
    `
      .intro {
        padding: 16px 18px 4px;
      }
      h1 {
        font-size: 1.8rem;
      }
      .abas {
        margin: 8px 14px 0;
        width: auto;
      }
      .meet h2 {
        font-size: 1.4rem;
        margin-bottom: 4px;
      }
      .entrar {
        display: block;
        margin-top: 10px;
        padding: 14px;
        border-radius: 16px;
        background: var(--cob-vinho);
        color: #fff;
        font-weight: 700;
        text-align: center;
        text-decoration: none;
      }
      .admin {
        margin-top: 14px;
        padding-top: 4px;
        border-top: 1.5px dashed #f0b9c4;
      }
      .admin ion-button {
        margin-top: 8px;
      }
    `,
  ],
})
export class EncontrosPage {
  protected readonly auth = inject(AuthService);
  protected readonly clube = inject(ClubeService);
  protected readonly aba = signal<Aba>('calendario');
  protected readonly linkEditado = signal<string | null>(null);
  protected readonly mensagem = signal('');
  protected readonly dataEditada = signal<string | null>(null);
  protected readonly horaEditada = signal<string | null>(null);
  protected readonly salvando = signal(false);

  protected parteEncontro(parte: 'data' | 'hora'): string {
    const data = this.clube.dados().encontro_em;
    if (!data) return '';
    const partes = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(new Date(data)).split(' ');
    return parte === 'data' ? partes[0] : partes[1];
  }

  protected encontroFormatado(): string {
    const data = this.clube.dados().encontro_em;
    return data ? new Date(data).toLocaleString('pt-BR', {
      timeZone: 'America/Recife', dateStyle: 'full', timeStyle: 'short',
    }) : '';
  }

  protected async cancelarEncontro() {
    if (this.salvando() || !window.confirm('Cancelar este encontro e o lembrete agendado?')) return;
    this.salvando.set(true);
    try {
      const erro = await this.clube.definirEncontro('', null);
      this.mensagem.set(erro || 'Encontro cancelado.');
    } finally { this.salvando.set(false); }
  }
  private readonly calendario = viewChild(CalendarioComponent);

  protected trocar(evento: Event) {
    this.aba.set((evento as CustomEvent).detail.value as Aba);
  }

  // Sempre que a pessoa volta para esta aba, o calendário se atualiza
  ionViewWillEnter() {
    void this.clube.carregarClube();
    void this.calendario()?.recarregar();
  }

  protected async salvarLink() {
    if (this.salvando()) return;
    const link = (this.linkEditado() ?? this.clube.dados().link_meet ?? '').trim();
    const data = this.dataEditada() ?? this.parteEncontro('data');
    const hora = this.horaEditada() ?? this.parteEncontro('hora');
    if ((data && !hora) || (!data && hora)) { this.mensagem.set('Preencha a data e o horário juntos.'); return; }
    let encontro: string | null = null;
    try {
      if (link && new URL(link).protocol !== 'https:') throw new Error();
      if (data) {
        if (!link) { this.mensagem.set('Adicione o link do encontro.'); return; }
        const instante = new Date(data + 'T' + hora + ':00-03:00');
        if (!Number.isFinite(instante.getTime()) || instante.getTime() <= Date.now()) {
          this.mensagem.set('Escolha uma data e horário futuros.'); return;
        }
        encontro = instante.toISOString();
      }
    } catch { this.mensagem.set('Use um link completo que comece com https://'); return; }
    this.salvando.set(true);
    try {
      const erro = await this.clube.definirEncontro(link, encontro);
      this.mensagem.set(erro || 'Encontro salvo.');
      if (!erro) { this.linkEditado.set(null); this.dataEditada.set(null); this.horaEditada.set(null); }
    } finally { this.salvando.set(false); }
  }
}

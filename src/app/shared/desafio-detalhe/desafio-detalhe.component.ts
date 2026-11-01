import { Component, ElementRef, OnDestroy, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { IonButton, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../core/auth.service';
import { DesafiosService } from '../../core/desafios.service';
import { MensagemDoDesafio, ParticipanteDesafio, UNIDADES } from '../../core/modelos';
import { AvatarMembroComponent } from '../avatar/avatar-membro.component';

const MEDALHAS = ['🥇', '🥈', '🥉'];

// A tela de um desafio: a "corrida" de progresso, o pódio, o chat e as ações de quem participa.
@Component({
  selector: 'app-desafio-detalhe',
  imports: [IonButton, IonSpinner, AvatarMembroComponent],
  template: `
    @if (desafio(); as d) {
      <div class="sobreposicao">
        <div class="sobreposicao-fundo" (click)="fechar.emit()"></div>
        <div class="cartao-flutuante" role="dialog" aria-modal="true" [attr.aria-label]="d.titulo">
          <button type="button" class="x" (click)="fechar.emit()" aria-label="Fechar">✕</button>

          <span class="status" [attr.data-status]="d.status">
            {{ d.status === 'ativo' ? 'Em andamento' : d.status === 'encerrado' ? 'Encerrado' : 'Cancelado' }}
          </span>
          <h2 class="titulo-serif">{{ d.titulo }}</h2>
          <p class="meta">Meta: {{ d.meta }} {{ unidade().plural }}@if (prazo()) { · {{ prazo() }} }</p>
          @if (d.descricao) {
            <p class="regra">{{ d.descricao }}</p>
          }

          @if (meuConvite()) {
            <div class="convite">
              <p>Você foi convidada para este desafio!</p>
              <div class="botoes">
                <ion-button size="small" (click)="responder(true)">Aceitar</ion-button>
                <ion-button size="small" fill="outline" (click)="responder(false)">Recusar</ion-button>
              </div>
            </div>
          }

          @if (d.status === 'encerrado' && podio().length > 0) {
            <h3 class="titulo-serif">Pódio 🏆</h3>
            <div class="podio">
              @for (g of podio(); track g.posicao) {
                <div class="degrau">
                  <span class="medalha">{{ medalhas[g.posicao - 1] }}</span>
                  <div class="quem">
                    @for (p of g.pessoas; track p.perfil_id) {
                      <span class="ganhador">
                        <app-avatar-membro [membro]="p.quem" [tamanho]="34"></app-avatar-membro>
                        <strong>{{ p.quem?.nome ?? 'Alguém' }}</strong>
                        <em>{{ p.progresso }} {{ unidade().plural }}</em>
                      </span>
                    }
                  </div>
                </div>
              }
            </div>
            <p class="suave pequeno">Quem fica em 1º lugar ganha o troféu. Em caso de empate, todo mundo que empatou ganha! 🤝</p>
          }
          @if (d.status === 'cancelado') {
            <p class="aviso">Este desafio foi cancelado: ele precisa de pelo menos 2 pessoas participando e alguém com progresso. Ninguém ganha troféu.</p>
          }

          <h3 class="titulo-serif">A corrida 🏁</h3>
          @for (c of corredores(); track c.perfil_id) {
            <div class="faixa">
              <div class="nome">
                <strong>{{ c.quem?.nome ?? 'Alguém' }}</strong>
                <span>{{ c.progresso }} / {{ d.meta }} {{ unidade().plural }}</span>
              </div>
              <div class="pista">
                <div class="chao"></div>
                <div class="corredor" [style.left.%]="posicaoNaPista(c)">
                  <app-avatar-membro [membro]="c.quem" [tamanho]="30"></app-avatar-membro>
                </div>
                <span class="chegada" aria-hidden="true">🏁</span>
              </div>
            </div>
          } @empty {
            <p class="suave">Ninguém aceitou o convite ainda.</p>
          }
          @if (esperando().length > 0) {
            <p class="suave pequeno">Esperando resposta: {{ nomesDosConvidados() }}</p>
          }

          @if (d.status === 'ativo' && euParticipo()) {
            <div class="meu">
              <h3 class="titulo-serif">Meu progresso: {{ meuProgresso() }} / {{ d.meta }}</h3>
              <div class="passos">
                <button type="button" class="pilula" (click)="somar(-unidade().passos[0])">− {{ unidade().passos[0] }}</button>
                @for (p of unidade().passos; track p) {
                  <button type="button" class="pilula ativa" (click)="somar(p)">+ {{ p }}</button>
                }
              </div>
              <div class="manual">
                <input class="campo" type="number" inputmode="numeric" min="0" placeholder="Ou digite o total exato" [value]="manual()" (input)="manual.set($any($event.target).value)" />
                <button type="button" class="pilula" (click)="definir()">Salvar</button>
              </div>
            </div>
          }

          @if (podeConversar()) {
            <h3 class="titulo-serif">Chat do desafio 💬</h3>
            <div class="chat" #caixa>
              @for (m of mensagens(); track m.id) {
                <div class="mensagem" [class.minha]="m.autor_id === auth.perfil()?.id">
                  <app-avatar-membro [membro]="m.quem" [tamanho]="26"></app-avatar-membro>
                  <div class="balao">
                    <strong>{{ m.quem?.nome ?? 'Alguém' }}</strong>
                    <p>{{ m.texto }}</p>
                  </div>
                </div>
              } @empty {
                <p class="suave">Ainda não tem mensagens. Mande um recado para a turma!</p>
              }
            </div>
            <div class="enviar">
              <input class="campo" type="text" maxlength="500" placeholder="Escreva uma mensagem…" [value]="texto()" (input)="texto.set($any($event.target).value)" (keyup.enter)="enviar()" />
              <ion-button size="small" (click)="enviar()">Enviar</ion-button>
            </div>
          }

          @if (mensagem()) {
            <p class="aviso" role="status">{{ mensagem() }}</p>
          }

          @if (d.status === 'ativo' && podeEncerrar()) {
            <div class="encerrar">
              <ion-button expand="block" color="secondary" [disabled]="encerrando()" (click)="encerrar()">
                @if (encerrando()) {
                  <ion-spinner name="dots"></ion-spinner>
                } @else {
                  Encerrar desafio e premiar 🏆
                }
              </ion-button>
              <p class="suave pequeno">Ao encerrar, o pódio é montado pelo progresso de cada pessoa.</p>
            </div>
          }
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
      .status {
        display: inline-block;
        padding: 3px 12px;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 700;
        color: #fff;
        background: var(--cob-framboesa);
      }
      .status[data-status='encerrado'] { background: #c9922b; }
      .status[data-status='cancelado'] { background: #8c5a68; }
      h2 {
        margin: 8px 0 2px;
        font-size: 1.7rem;
        padding-right: 30px;
      }
      h3 {
        margin: 18px 0 8px;
        font-size: 1.2rem;
      }
      .meta {
        margin: 0;
        font-weight: 700;
        color: var(--cob-framboesa);
      }
      .regra {
        margin: 8px 0 0;
        line-height: 1.5;
        overflow-wrap: anywhere;
      }
      .convite {
        margin-top: 12px;
        padding: 12px;
        border-radius: 16px;
        background: #fff1cf;
      }
      .convite p {
        margin: 0 0 6px;
        font-weight: 700;
      }
      .botoes {
        display: flex;
        gap: 8px;
      }
      .podio {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .degrau {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 16px;
        background: linear-gradient(120deg, #fff1cf, #fde3e7);
      }
      .medalha {
        font-size: 1.8rem;
      }
      .quem {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .ganhador {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ganhador em {
        font-style: normal;
        font-size: 0.82rem;
        color: #8c5a68;
      }
      .pequeno {
        font-size: 0.82rem;
        margin: 6px 0 0;
      }
      .faixa {
        margin-bottom: 10px;
      }
      .nome {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        font-size: 0.9rem;
      }
      .nome span {
        color: #8c5a68;
        font-size: 0.82rem;
      }
      .pista {
        position: relative;
        height: 52px;
        margin-top: 2px;
      }
      .chao {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 6px;
        height: 12px;
        border-radius: 999px;
        background: repeating-linear-gradient(90deg, #f7b4c0 0 14px, #fde3e7 14px 28px);
      }
      .corredor {
        position: absolute;
        bottom: 6px;
        line-height: 0;
        transition: left 0.9s cubic-bezier(0.3, 0.8, 0.3, 1);
      }
      .chegada {
        position: absolute;
        right: 0;
        bottom: 8px;
        font-size: 1.5rem;
      }
      .meu {
        margin-top: 6px;
        padding: 4px 12px 12px;
        border-radius: 16px;
        background: #fff;
        box-shadow: 0 4px 14px var(--cob-sombra);
      }
      .passos {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .manual,
      .enviar {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 10px;
      }
      .chat {
        max-height: 220px;
        overflow-y: auto;
        padding: 10px;
        border-radius: 16px;
        background: #fff;
        box-shadow: inset 0 2px 8px rgba(122, 18, 48, 0.08);
      }
      .mensagem {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
      }
      .mensagem.minha {
        flex-direction: row-reverse;
      }
      .balao {
        max-width: 78%;
        padding: 6px 10px;
        border-radius: 14px;
        background: #fde3e7;
      }
      .mensagem.minha .balao {
        background: #fff0cf;
      }
      .balao strong {
        font-size: 0.78rem;
        color: var(--cob-vinho);
      }
      .balao p {
        margin: 1px 0 0;
        line-height: 1.35;
        overflow-wrap: anywhere;
      }
      .encerrar {
        margin-top: 18px;
        padding-top: 12px;
        border-top: 1.5px dashed #f0b9c4;
      }
      p {
        margin: 8px 0 0;
      }
    `,
  ],
})
export class DesafioDetalheComponent implements OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly desafios = inject(DesafiosService);

  // Qual desafio mostrar (nada = fechado). A tela acompanha o desafio "ao vivo".
  readonly desafioId = input<string | null>(null);
  readonly fechar = output<void>();

  protected readonly medalhas = MEDALHAS;
  protected readonly mensagens = signal<MensagemDoDesafio[]>([]);
  protected readonly texto = signal('');
  protected readonly manual = signal('');
  protected readonly mensagem = signal('');
  protected readonly encerrando = signal(false);

  private readonly caixa = viewChild<ElementRef<HTMLElement>>('caixa');
  private pararDeEscutar: (() => void) | undefined;

  protected readonly desafio = computed(() => this.desafios.lista().find((d) => d.id === this.desafioId()) ?? null);
  protected readonly unidade = computed(() => UNIDADES.find((u) => u.valor === this.desafio()?.unidade) ?? UNIDADES[0]);
  private readonly meuId = computed(() => this.auth.perfil()?.id);

  private readonly meuRegistro = computed(() => this.desafio()?.participantes.find((p) => p.perfil_id === this.meuId()) ?? null);
  protected readonly euParticipo = computed(() => this.meuRegistro()?.status === 'aceito');
  protected readonly meuConvite = computed(() => this.desafio()?.status === 'ativo' && this.meuRegistro()?.status === 'convidado');
  protected readonly meuProgresso = computed(() => this.meuRegistro()?.progresso ?? 0);
  protected readonly souCriadora = computed(() => this.desafio()?.criado_por === this.meuId());
  protected readonly podeEncerrar = computed(() => this.souCriadora() || this.auth.eAdmin());
  protected readonly podeConversar = computed(() => this.euParticipo() || this.souCriadora());

  protected readonly corredores = computed(() =>
    (this.desafio()?.participantes ?? []).filter((p) => p.status === 'aceito').sort((a, b) => b.progresso - a.progresso),
  );
  protected readonly esperando = computed(() => (this.desafio()?.participantes ?? []).filter((p) => p.status === 'convidado'));
  protected readonly nomesDosConvidados = computed(() => this.esperando().map((p) => p.quem?.nome ?? 'alguém').join(', '));

  protected readonly podio = computed(() => {
    const todos = this.desafio()?.participantes ?? [];
    return [1, 2, 3]
      .map((posicao) => ({ posicao, pessoas: todos.filter((p) => p.posicao === posicao) }))
      .filter((g) => g.pessoas.length > 0);
  });

  protected readonly prazo = computed(() => {
    const fim = this.desafio()?.fim;
    if (!fim) return '';
    const [a, m, dia] = fim.split('-').map(Number);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dias = Math.round((new Date(a, m - 1, dia).getTime() - hoje.getTime()) / 86400000);
    const bonito = `${String(dia).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
    if (dias > 1) return `até ${bonito} (faltam ${dias} dias)`;
    if (dias === 1) return `termina amanhã (${bonito})`;
    if (dias === 0) return `termina hoje (${bonito})`;
    return `prazo era ${bonito}`;
  });

  constructor() {
    effect(() => {
      const id = this.desafioId();
      untracked(() => void this.abrirChat(id));
    });
  }

  ngOnDestroy() {
    this.pararDeEscutar?.();
  }

  protected posicaoNaPista(p: ParticipanteDesafio): number {
    const meta = this.desafio()?.meta ?? 1;
    return Math.min(100, (p.progresso / meta) * 100) * 0.84;
  }

  private async abrirChat(id: string | null) {
    this.pararDeEscutar?.();
    this.pararDeEscutar = undefined;
    this.mensagens.set([]);
    this.mensagem.set('');
    this.manual.set('');
    if (!id) return;
    await this.carregarMensagens(id);
    this.pararDeEscutar = this.desafios.escutarMensagens(id, () => void this.carregarMensagens(id));
  }

  private async carregarMensagens(id: string) {
    this.mensagens.set(await this.desafios.carregarMensagens(id));
    setTimeout(() => {
      const el = this.caixa()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  protected async enviar() {
    const id = this.desafioId();
    if (!id || !this.texto().trim()) return;
    const erro = await this.desafios.enviarMensagem(id, this.texto());
    if (erro) return this.mensagem.set(erro);
    this.texto.set('');
    await this.carregarMensagens(id);
  }

  protected async responder(aceitar: boolean) {
    const id = this.desafioId();
    if (!id) return;
    const erro = await this.desafios.responder(id, aceitar);
    this.mensagem.set(erro);
    if (!aceitar) this.fechar.emit();
  }

  protected async somar(delta: number) {
    const id = this.desafioId();
    if (!id) return;
    this.mensagem.set(await this.desafios.registrarProgresso(id, this.meuProgresso() + delta));
  }

  protected async definir() {
    const id = this.desafioId();
    const valor = Number(this.manual());
    if (!id || !Number.isFinite(valor) || valor < 0) return this.mensagem.set('Digite um número a partir de 0.');
    this.mensagem.set(await this.desafios.registrarProgresso(id, valor));
    this.manual.set('');
  }

  protected async encerrar() {
    const id = this.desafioId();
    if (!id) return;
    if (!confirm('Encerrar o desafio agora? Depois disso ninguém pode mais mudar o progresso.')) return;
    this.encerrando.set(true);
    const resultado = await this.desafios.encerrar(id);
    this.encerrando.set(false);
    if (resultado.startsWith('erro:')) return this.mensagem.set(resultado.slice(5).trim());
    this.mensagem.set(
      resultado === 'cancelado'
        ? 'Desafio cancelado: faltou gente participando ou ninguém tinha progresso.'
        : 'Desafio encerrado! Parabéns ao pódio! 🏆',
    );
  }
}

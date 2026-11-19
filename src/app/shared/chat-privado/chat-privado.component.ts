import { Component, OnDestroy, effect, inject, input, signal, untracked } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { SupabaseService } from '../../core/supabase.service';

interface MensagemPrivada {
  id: string; remetente_id: string; destinatario_id: string; texto: string; criado_em: string;
}

@Component({
  selector: 'app-chat-privado',
  template: `
    <section class="chat" aria-label="Conversa privada">
      <h3>Mensagem para {{ nome() }}</h3>
      <p class="suave">Conversa privada entre vocês duas.</p>
      @if (temAnteriores()) {
        <button type="button" class="pilula" [disabled]="buscando()" (click)="carregarAnteriores()">Mensagens anteriores</button>
      }
      <div class="mensagens" aria-live="polite">
        @for (mensagem of mensagens(); track mensagem.id) {
          <div class="balao" [class.minha]="mensagem.remetente_id === auth.perfil()?.id">
            <p>{{ mensagem.texto }}</p>
            <small>{{ horario(mensagem.criado_em) }}</small>
          </div>
        } @empty { <p class="suave">Escreva a primeira mensagem.</p> }
      </div>
      <form (submit)="enviar($event)">
        <label for="texto-privado">Sua mensagem</label>
        <textarea id="texto-privado" class="campo" required maxlength="2000" rows="2"
          [value]="texto()" (input)="texto.set($any($event.target).value)"></textarea>
        <button type="submit" class="pilula ativa" [disabled]="enviando() || !texto().trim()">Enviar</button>
      </form>
      @if (erro()) { <p role="status">{{ erro() }}</p> }
    </section>
  `,
  styles: [`
    .chat { width: 100%; text-align: left; margin-top: 12px; }
    .mensagens { max-height: 38vh; overflow: auto; display: flex; flex-direction: column; gap: 8px; margin: 12px 0; }
    .balao { background: #fff; border-radius: 12px; padding: 8px 12px; max-width: 90%; align-self: flex-start; }
    .minha { align-self: flex-end; background: #f7d5e3; }
    p { white-space: pre-wrap; overflow-wrap: anywhere; margin: 4px 0; }
    small { font-size: 0.7rem; } form { display: grid; gap: 6px; }
  `],
})
export class ChatPrivadoComponent implements OnDestroy {
  readonly destinatario = input.required<string>();
  readonly nome = input('integrante');
  protected readonly auth = inject(AuthService);
  private readonly sb = inject(SupabaseService).cliente;
  protected readonly mensagens = signal<MensagemPrivada[]>([]);
  protected readonly texto = signal('');
  protected readonly erro = signal('');
  protected readonly enviando = signal(false);
  protected readonly buscando = signal(false);
  protected readonly temAnteriores = signal(false);
  private limite = 50;
  private versao = 0;
  private consulta = 0;
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    effect(() => {
      const id = this.destinatario();
      const meuId = this.auth.perfil()?.id;
      untracked(() => {
        this.versao++;
        this.mensagens.set([]);
        this.texto.set('');
        this.erro.set('');
        this.limite = 50;
        clearInterval(this.timer);
        if (!meuId || id === meuId) return;
        void this.carregar();
        this.timer = setInterval(() => {
          if (!document.hidden) void this.carregar();
        }, 8000);
      });
    });
  }

  ngOnDestroy() { ++this.versao; clearInterval(this.timer); }

  protected horario(data: string) {
    return new Date(data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  private async carregar() {
    const id = this.destinatario();
    const meuId = this.auth.perfil()?.id;
    if (!meuId || !/^[0-9a-f-]{36}$/i.test(id)) return;
    const versao = this.versao;
    const consulta = ++this.consulta;
    this.buscando.set(true);
    const { data, error } = await this.sb.from('mensagens_privadas')
      .select('id, remetente_id, destinatario_id, texto, criado_em')
      .or(`and(remetente_id.eq.${meuId},destinatario_id.eq.${id}),and(remetente_id.eq.${id},destinatario_id.eq.${meuId})`)
      .order('criado_em', { ascending: false }).order('id', { ascending: false }).limit(this.limite + 1);
    if (versao !== this.versao || consulta !== this.consulta) return;
    this.buscando.set(false);
    if (error) { this.erro.set('Não consegui carregar a conversa.'); return; }
    const mensagens = (data ?? []) as MensagemPrivada[];
    this.temAnteriores.set(mensagens.length > this.limite);
    this.mensagens.set(mensagens.slice(0, this.limite).reverse());
    this.erro.set('');
  }

  protected async carregarAnteriores() {
    this.limite += 50;
    await this.carregar();
  }

  protected async enviar(evento: Event) {
    evento.preventDefault();
    const texto = this.texto().trim();
    if (!texto || this.enviando() || !this.auth.perfil()) return;
    const versao = this.versao;
    this.enviando.set(true);
    try {
      const { error } = await this.sb.from('mensagens_privadas')
        .insert({ destinatario_id: this.destinatario(), texto });
      if (versao !== this.versao) return;
      if (error) { this.erro.set('Não consegui enviar. Sua mensagem continua no campo para tentar novamente.'); return; }
      this.texto.set('');
      await this.carregar();
    } finally { this.enviando.set(false); }
  }
}

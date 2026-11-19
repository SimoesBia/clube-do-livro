import { Component, OnInit, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { ResumoMembroService } from '../../core/resumo-membro.service';
import { SupabaseService } from '../../core/supabase.service';
@Component({
  selector: 'app-conversas',
  template: `
    <section class="secao">
      <h2 class="titulo-serif">Conversas</h2>
      <button class="pilula" type="button" (click)="carregar()">Atualizar conversas</button>
      @if (erro()) { <p role="status">{{ erro() }}</p> }
      @for (membro of membros(); track membro.id) {
        <p><button class="pilula" type="button" (click)="resumo.abrir(membro.id)">{{ membro.nome }} · Abrir conversa</button></p>
      } @empty { <p class="suave">Para conversar, toque na bonequinha de uma integrante e escolha Enviar mensagem.</p> }
    </section>
  `,
})
export class ConversasComponent implements OnInit {
  private readonly sb = inject(SupabaseService).cliente;
  private readonly auth = inject(AuthService);
  protected readonly resumo = inject(ResumoMembroService);
  protected readonly membros = signal<{id: string; nome: string}[]>([]);
  protected readonly erro = signal('');
  ngOnInit() { void this.carregar(); }
  protected async carregar() {
    const meuId = this.auth.perfil()?.id;
    if (!meuId) return;
    const { data, error } = await this.sb.from('mensagens_privadas')
      .select('remetente_id,destinatario_id').order('criado_em', { ascending: false });
    if (error) { this.erro.set('Não consegui carregar as conversas.'); return; }
    const ids = [...new Set((data ?? []).map(m => m.remetente_id === meuId ? m.destinatario_id : m.remetente_id))];
    if (!ids.length) { this.membros.set([]); return; }
    const { data: perfis, error: erroPerfil } = await this.sb.from('perfis').select('id,nome').in('id', ids);
    if (erroPerfil) { this.erro.set('Não consegui carregar as integrantes.'); return; }
    if (this.auth.perfil()?.id !== meuId) return;
    this.membros.set(ids.flatMap(id => (perfis ?? []).filter(p => p.id === id)));
    this.erro.set('');
  }
}

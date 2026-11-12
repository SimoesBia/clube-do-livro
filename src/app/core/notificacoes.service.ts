import { Injectable, computed, inject, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { Notificacao } from './modelos';
import { SupabaseService } from './supabase.service';

export interface AvisoDeAniversario {
  id: string;
  texto: string;
  meu: boolean;
}

const CHAVE_ANIVERSARIO_VISTO = 'cob_aniversario_visto';

// O sininho: avisos guardados no banco (convites, sorteio, comentários...) e os aniversários de hoje.
@Injectable({ providedIn: 'root' })
export class NotificacoesService {
  private readonly sb = inject(SupabaseService).cliente;
  private readonly auth = inject(AuthService);

  readonly itens = signal<Notificacao[]>([]);
  readonly aberto = signal(false);
  private readonly aniversarioVisto = signal(this.lerVisto());
  private canal: RealtimeChannel | null = null;

  // Quem faz aniversário hoje (calculado na hora, a partir dos perfis)
  readonly aniversarios = computed<AvisoDeAniversario[]>(() => {
    const hoje = new Date();
    const mes = hoje.getMonth() + 1;
    const dia = hoje.getDate();
    const meuId = this.auth.perfil()?.id;
    return this.auth
      .membros()
      .filter((m) => {
        if (!m.aniversario) return false;
        const [, mm, dd] = m.aniversario.split('-').map(Number);
        return mm === mes && dd === dia;
      })
      .map((m) => ({
        id: m.id,
        meu: m.id === meuId,
        texto: m.id === meuId
          ? 'Parabéns! Hoje é o seu aniversário! 🎉'
          : `Hoje é aniversário de ${m.nome}! 🎂 Passe lá e deseje parabéns.`,
      }));
  });

  readonly naoLidas = computed(() => this.itens().filter((n) => !n.lida).length);
  // Número que aparece na bolinha do sininho
  readonly total = computed(() => this.naoLidas() + (this.aniversarioVisto() ? 0 : this.aniversarios().length));

  async carregar() {
    const { data } = await this.sb
      .from('notificacoes')
      .select('id, tipo, texto, rota, lida, criado_em')
      .order('criado_em', { ascending: false })
      .limit(40);
    this.itens.set((data ?? []) as Notificacao[]);
  }

  // Avisos chegando ao vivo
  escutar() {
    const meuId = this.auth.perfil()?.id;
    if (this.canal || !meuId) return;
    this.canal = this.sb
      .channel('notificacoes-ao-vivo')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificacoes', filter: `perfil_id=eq.${meuId}` },
        () => void this.carregar(),
      )
      .subscribe();
  }

  parar() {
    if (this.canal) {
      void this.sb.removeChannel(this.canal);
      this.canal = null;
    }
  }

  alternar() {
    const abrir = !this.aberto();
    this.aberto.set(abrir);
    if (abrir) {
      void this.carregar();
      this.guardarVisto();
    }
  }

  fechar() {
    this.aberto.set(false);
  }

  async marcarComoLida(id: string) {
    this.itens.update((lista) => lista.map((n) => (n.id === id ? { ...n, lida: true } : n)));
    await this.sb.from('notificacoes').update({ lida: true }).eq('id', id);
  }

  async marcarTodasComoLidas() {
    const meuId = this.auth.perfil()?.id;
    if (!meuId) return;
    this.itens.update((lista) => lista.map((n) => ({ ...n, lida: true })));
    await this.sb.from('notificacoes').update({ lida: true }).eq('perfil_id', meuId).eq('lida', false);
  }

  private hojeComoTexto(): string {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
  }

  private lerVisto(): boolean {
    try {
      return localStorage.getItem(CHAVE_ANIVERSARIO_VISTO) === this.hojeComoTexto();
    } catch {
      return false;
    }
  }

  private guardarVisto() {
    this.aniversarioVisto.set(true);
    try {
      localStorage.setItem(CHAVE_ANIVERSARIO_VISTO, this.hojeComoTexto());
    } catch {
      // sem armazenamento: o aviso só some até recarregar
    }
  }
}

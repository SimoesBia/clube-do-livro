import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { ContextoLeitura, LivroLido, ResultadoBusca, StatusLeitura } from './modelos';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class LivrosLidosService {
  private readonly sb = inject(SupabaseService).cliente;
  private readonly auth = inject(AuthService);
  private readonly estante = signal<{ perfilId: string; livros: LivroLido[] } | null>(null);
  private consulta = 0;

  readonly todos = computed(() => {
    const estante = this.estante();
    return estante && estante.perfilId === this.auth.perfil()?.id ? estante.livros : [];
  });
  readonly meus = computed(() => this.todos().filter(livro => livro.status_leitura === 'lido'));

  async carregarMeus(meuId: string): Promise<string> {
    const consulta = ++this.consulta;
    const { data, error } = await this.sb
      .from('livros_lidos')
      .select('id, perfil_id, titulo, autor, capa_url, ano, paginas, chave_ol, contexto, status_leitura, criado_em')
      .eq('perfil_id', meuId)
      .order('criado_em', { ascending: false });
    if (error) return 'Não consegui carregar seus livros. Tente novamente.';
    if (consulta === this.consulta && this.auth.perfil()?.id === meuId) {
      this.estante.set({ perfilId: meuId, livros: (data ?? []) as LivroLido[] });
    }
    return '';
  }

  registro(livro: ResultadoBusca): LivroLido | undefined {
    return this.todos().find(item =>
      item.titulo.toLowerCase() === livro.titulo.slice(0, 200).toLowerCase() &&
      (item.autor ?? '').toLowerCase() === (livro.autor ?? '').slice(0, 200).toLowerCase(),
    );
  }

  adicionar(livro: ResultadoBusca, contexto: ContextoLeitura, meuId: string): Promise<string> {
    return this.salvar(livro, 'lido', meuId, contexto);
  }

  async salvar(
    livro: ResultadoBusca, status: StatusLeitura, meuId: string, contexto?: ContextoLeitura,
  ): Promise<string> {
    const { error } = await this.sb.rpc('salvar_status_leitura', {
      p_titulo: livro.titulo.slice(0, 200),
      p_autor: livro.autor ? livro.autor.slice(0, 200) : null,
      p_capa_url: livro.capa_url?.startsWith('https://') ? livro.capa_url : null,
      p_ano: livro.ano ?? null,
      p_paginas: livro.paginas ?? null,
      p_chave_ol: livro.chave_ol ?? null,
      p_status: status,
      p_contexto: status === 'lido' ? contexto ?? 'fora_do_clube' : null,
    });
    if (error) return 'Não deu para salvar o status. Tente de novo.';
    return this.carregarMeus(meuId);
  }

  async remover(id: string, meuId: string, status?: StatusLeitura): Promise<string> {
    let exclusao = this.sb.from('livros_lidos').delete().eq('id', id).eq('perfil_id', meuId);
    if (status) exclusao = exclusao.eq('status_leitura', status);
    const { error } = await exclusao;
    if (error) return 'Não deu para tirar o livro da lista. Tente de novo.';
    return this.carregarMeus(meuId);
  }

  async contar(perfilId: string): Promise<number> {
    const { count } = await this.sb
      .from('livros_lidos')
      .select('id', { count: 'exact', head: true })
      .eq('perfil_id', perfilId)
      .eq('status_leitura', 'lido');
    return count ?? 0;
  }
}

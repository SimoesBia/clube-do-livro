import { Injectable, inject, signal } from '@angular/core';
import { ContextoLeitura, LivroLido, ResultadoBusca } from './modelos';
import { SupabaseService } from './supabase.service';

// Os livros que cada pessoa já leu (antes do clube, no clube ou fora dele)
@Injectable({ providedIn: 'root' })
export class LivrosLidosService {
  private readonly sb = inject(SupabaseService).cliente;

  // A lista da própria pessoa
  readonly meus = signal<LivroLido[]>([]);

  async carregarMeus(meuId: string) {
    const { data } = await this.sb
      .from('livros_lidos')
      .select('id, perfil_id, titulo, autor, capa_url, ano, paginas, chave_ol, contexto, criado_em')
      .eq('perfil_id', meuId)
      .order('criado_em', { ascending: false });
    this.meus.set((data ?? []) as LivroLido[]);
  }

  // Devolve um texto de erro (ou vazio se deu certo)
  async adicionar(livro: ResultadoBusca, contexto: ContextoLeitura, meuId: string): Promise<string> {
    const { error } = await this.sb.from('livros_lidos').insert({
      titulo: livro.titulo.slice(0, 200),
      autor: livro.autor ? livro.autor.slice(0, 200) : null,
      capa_url: livro.capa_url && livro.capa_url.startsWith('https://') ? livro.capa_url : null,
      ano: livro.ano ?? null,
      paginas: livro.paginas ?? null,
      chave_ol: livro.chave_ol ?? null,
      contexto,
    });
    if (error) {
      return error.code === '23505' ? 'Esse livro já está na sua lista.' : 'Não deu para adicionar agora. Tente de novo.';
    }
    await this.carregarMeus(meuId);
    return '';
  }

  async remover(id: string, meuId: string) {
    await this.sb.from('livros_lidos').delete().eq('id', id);
    await this.carregarMeus(meuId);
  }

  // Quantos livros uma pessoa já leu
  async contar(perfilId: string): Promise<number> {
    const { count } = await this.sb
      .from('livros_lidos')
      .select('id', { count: 'exact', head: true })
      .eq('perfil_id', perfilId);
    return count ?? 0;
  }
}

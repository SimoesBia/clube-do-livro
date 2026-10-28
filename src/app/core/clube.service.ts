import { Injectable, inject, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { DadosDoClube, ResultadoBusca, Sorteio, Sugestao } from './modelos';
import { SupabaseService } from './supabase.service';

const AUTOR_COM_NIVEL = 'quem:perfis(nome, avatar_id, participacoes, vitorias)';

// Tudo sobre o clube em si: livro do mês, sugestões, roleta e sorteios.
@Injectable({ providedIn: 'root' })
export class ClubeService {
  private readonly sb = inject(SupabaseService).cliente;

  readonly dados = signal<DadosDoClube>({ data_sorteio: null, link_meet: null, livro: null });
  readonly sugestoes = signal<Sugestao[]>([]);
  readonly ultimoSorteio = signal<Sorteio | null>(null);
  // Quando alguém gira a roleta, este valor muda e a roleta de todo mundo gira junto
  readonly sorteioAoVivo = signal<Sorteio | null>(null);

  private canal: RealtimeChannel | null = null;

  async carregar() {
    await Promise.all([this.carregarClube(), this.carregarSugestoes(), this.carregarUltimoSorteio()]);
  }

  async carregarClube() {
    const { data } = await this.sb
      .from('clube')
      .select('data_sorteio, link_meet, livro:livros(id, titulo, autor, capa_url, criado_em)')
      .eq('id', 1)
      .maybeSingle();
    if (data) {
      this.dados.set({
        data_sorteio: data.data_sorteio ?? null,
        link_meet: data.link_meet ?? null,
        livro: (data.livro as unknown as DadosDoClube['livro']) ?? null,      });
    }
  }

  async carregarSugestoes() {
    const { data } = await this.sb
      .from('sugestoes')
      .select(`id, titulo, autor, capa_url, sugerido_por, criado_em, ${AUTOR_COM_NIVEL}`)
      .is('sorteio_id', null)
      .order('criado_em', { ascending: true });
    this.sugestoes.set((data ?? []) as unknown as Sugestao[]);
  }

  async carregarUltimoSorteio() {
    const { data } = await this.sb
      .from('sorteios')
      .select('*')
      .order('realizado_em', { ascending: false })
      .limit(1)
      .maybeSingle();
    this.ultimoSorteio.set((data as Sorteio | null) ?? null);
  }

  // ----- quem administra -----

  // Devolve um texto de erro (ou vazio se deu certo)
  async definirLivroDoMes(livro: ResultadoBusca): Promise<string> {
    const { data, error } = await this.sb
      .from('livros')
      .insert({ titulo: livro.titulo, autor: livro.autor, capa_url: livro.capa_url })
      .select('id')
      .single();
    if (error || !data) return 'Não deu para salvar o livro agora.';
    const { error: erro2 } = await this.sb.from('clube').update({ livro_do_mes_id: data.id }).eq('id', 1);
    if (erro2) return 'O livro foi salvo, mas não deu para marcar como livro do mês.';
    await this.carregarClube();
    return '';
  }

  async definirDataSorteio(data: string | null): Promise<string> {
    const { error } = await this.sb.from('clube').update({ data_sorteio: data }).eq('id', 1);
    if (error) return 'Não deu para salvar a data agora.';
    await this.carregarClube();
    return '';
  }

  async sortear(): Promise<string> {
    const { data, error } = await this.sb.rpc('realizar_sorteio');
    if (error || !data) {
      return error?.message?.includes('pelo menos 2')
        ? 'Precisa de pelo menos 2 sugestões na roleta.'
        : 'Não deu para girar a roleta agora.';
    }
    this.aoVivo(data as Sorteio);
    return '';
  }

  // ----- sugestões -----

  async sugerir(livro: ResultadoBusca): Promise<string> {
    const { error } = await this.sb
      .from('sugestoes')
      .insert({ titulo: livro.titulo, autor: livro.autor, capa_url: livro.capa_url });
    if (error) {
      return error.code === '42501'
        ? 'Você já tem um livro na roleta. Tire o seu para colocar outro.'
        : 'Não deu para colocar na roleta agora.';
    }
    await this.carregarSugestoes();
    return '';
  }

  async removerSugestao(id: string) {
    await this.sb.from('sugestoes').delete().eq('id', id);
    await this.carregarSugestoes();
  }

  // ----- ao vivo -----

  escutar() {
    if (this.canal) return;
    this.canal = this.sb
      .channel('clube-ao-vivo')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sorteios' }, (p) => this.aoVivo(p.new as Sorteio))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sugestoes' }, () => void this.carregarSugestoes())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clube' }, () => void this.carregarClube())
      .subscribe();
  }

  parar() {
    if (this.canal) {
      void this.sb.removeChannel(this.canal);
      this.canal = null;
    }
  }

  private aoVivo(sorteio: Sorteio) {
    if (this.sorteioAoVivo()?.id === sorteio.id) return;
    this.sorteioAoVivo.set(sorteio);
    this.ultimoSorteio.set(sorteio);
    void this.carregarSugestoes();
    void this.carregarClube();
  }
}

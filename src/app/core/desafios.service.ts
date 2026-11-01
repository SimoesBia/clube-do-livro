import { Injectable, computed, inject, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { Desafio, MensagemDoDesafio, UnidadeDesafio } from './modelos';
import { SupabaseService } from './supabase.service';

// "!perfil_id" diz ao Supabase qual ligação usar (a tabela também tem "convidado_por", que liga a perfis)
const COLUNAS =
  'id, titulo, descricao, unidade, meta, inicio, fim, criado_por, status, criado_em, encerrado_em, ' +
  'participantes:desafio_participantes(perfil_id, status, progresso, posicao, quem:perfis!perfil_id(id, nome, avatar_id, participacoes, vitorias))';

export interface DadosNovoDesafio {
  titulo: string;
  descricao: string;
  unidade: UnidadeDesafio;
  meta: number;
  fim: string; // AAAA-MM-DD ou vazio
}

// Tudo sobre os desafios de leitura: criar, convidar, andar na corrida, conversar e encerrar.
@Injectable({ providedIn: 'root' })
export class DesafiosService {
  private readonly sb = inject(SupabaseService).cliente;
  private readonly auth = inject(AuthService);

  readonly lista = signal<Desafio[]>([]);
  readonly carregado = signal(false);

  // Convites que ainda esperam resposta
  readonly convites = computed(() => {
    const meuId = this.auth.perfil()?.id;
    return this.lista().filter(
      (d) => d.status === 'ativo' && d.participantes.some((p) => p.perfil_id === meuId && p.status === 'convidado'),
    );
  });

  // Desafios dos quais eu participo (aceitei ou criei)
  readonly meus = computed(() => {
    const meuId = this.auth.perfil()?.id;
    return this.lista().filter((d) => d.participantes.some((p) => p.perfil_id === meuId && p.status === 'aceito'));
  });

  private canal: RealtimeChannel | null = null;
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  async carregar() {
    const { data } = await this.sb.from('desafios').select(COLUNAS).order('criado_em', { ascending: false });
    this.lista.set((data ?? []) as unknown as Desafio[]);
    this.carregado.set(true);
  }

  // Avisos ao vivo (novo convite, alguém andou na corrida...)
  escutar() {
    if (this.canal) return;
    this.canal = this.sb
      .channel('desafios-ao-vivo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'desafio_participantes' }, () => {
        clearTimeout(this.temporizador);
        this.temporizador = setTimeout(() => void this.carregar(), 400);
      })
      .subscribe();
  }

  parar() {
    if (this.canal) {
      void this.sb.removeChannel(this.canal);
      this.canal = null;
    }
  }

  // Devolve um texto de erro (ou vazio se deu certo)
  async criar(dados: DadosNovoDesafio, convidados: string[]): Promise<string> {
    const meuId = this.auth.perfil()?.id;
    if (!meuId) return 'Entre de novo para criar o desafio.';

    const { data, error } = await this.sb
      .from('desafios')
      .insert({
        titulo: dados.titulo.trim(),
        descricao: dados.descricao.trim() || null,
        unidade: dados.unidade,
        meta: dados.meta,
        fim: dados.fim || null,
      })
      .select('id')
      .single();
    if (error || !data) return 'Não deu para criar o desafio agora.';

    const linhas = [
      { desafio_id: data.id, perfil_id: meuId, status: 'aceito' },
      ...convidados.filter((id) => id !== meuId).map((id) => ({ desafio_id: data.id, perfil_id: id, status: 'convidado' })),
    ];
    const { error: erroDosConvites } = await this.sb.from('desafio_participantes').insert(linhas);
    await this.carregar();
    await this.auth.recarregarPerfil();
    return erroDosConvites ? 'O desafio foi criado, mas não deu para convidar todo mundo.' : '';
  }

  async responder(desafioId: string, aceitar: boolean): Promise<string> {
    const meuId = this.auth.perfil()?.id;
    if (!meuId) return '';
    const { error } = await this.sb
      .from('desafio_participantes')
      .update({ status: aceitar ? 'aceito' : 'recusado', atualizado_em: new Date().toISOString() })
      .eq('desafio_id', desafioId)
      .eq('perfil_id', meuId);
    await this.carregar();
    await this.auth.recarregarPerfil();
    return error ? 'Não deu para responder agora.' : '';
  }

  async registrarProgresso(desafioId: string, valor: number): Promise<string> {
    const meuId = this.auth.perfil()?.id;
    if (!meuId) return '';
    const novo = Math.max(0, Math.min(100000, Math.round(valor)));
    const { error } = await this.sb
      .from('desafio_participantes')
      .update({ progresso: novo, atualizado_em: new Date().toISOString() })
      .eq('desafio_id', desafioId)
      .eq('perfil_id', meuId);
    await this.carregar();
    return error ? 'Não deu para salvar seu progresso agora.' : '';
  }

  // Devolve "encerrado", "cancelado" ou um texto de erro começando com "erro:"
  async encerrar(desafioId: string): Promise<string> {
    const { data, error } = await this.sb.rpc('encerrar_desafio', { p_id: desafioId });
    await this.carregar();
    await this.auth.recarregarPerfil();
    await this.auth.carregarMembros();
    if (error) return 'erro: ' + (error.message?.includes('Só quem criou') ? 'Só quem criou o desafio pode encerrar.' : 'Não deu para encerrar agora.');
    return String(data);
  }

  // ----- chat do desafio -----

  async carregarMensagens(desafioId: string): Promise<MensagemDoDesafio[]> {
    const { data } = await this.sb
      .from('desafio_mensagens')
      .select('id, desafio_id, autor_id, texto, criado_em, quem:perfis!autor_id(id, nome, avatar_id, participacoes, vitorias)')
      .eq('desafio_id', desafioId)
      .order('criado_em', { ascending: true })
      .limit(200);
    return (data ?? []) as unknown as MensagemDoDesafio[];
  }

  async enviarMensagem(desafioId: string, texto: string): Promise<string> {
    const meuId = this.auth.perfil()?.id;
    const limpo = texto.trim();
    if (!meuId || !limpo) return '';
    const { error } = await this.sb.from('desafio_mensagens').insert({ desafio_id: desafioId, autor_id: meuId, texto: limpo.slice(0, 500) });
    return error ? 'Não deu para enviar agora.' : '';
  }

  // Avisa quando chega mensagem nova no desafio (devolve uma função para parar de escutar)
  escutarMensagens(desafioId: string, aoChegar: () => void): () => void {
    const canal = this.sb
      .channel(`mensagens-${desafioId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'desafio_mensagens', filter: `desafio_id=eq.${desafioId}` },
        () => aoChegar(),
      )
      .subscribe();
    return () => void this.sb.removeChannel(canal);
  }
}

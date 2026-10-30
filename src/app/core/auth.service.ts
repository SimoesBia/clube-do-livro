import { Injectable, computed, inject, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { EfeitosService } from './efeitos.service';
import { SupabaseService } from './supabase.service';
import { Perfil } from './modelos';

export interface DadosCadastro {
  nome: string;
  aniversario: string;
  email: string;
  senha: string;
  avatarId: string;
}

export interface Resultado {
  erro?: string;
  precisaConfirmar?: boolean;
}

// Cuida de tudo sobre "quem está usando o app": entrar, sair, criar conta e guardar o perfil.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sb = inject(SupabaseService).cliente;

  // Estado (signals): quando mudam, as telas se atualizam sozinhas
  readonly sessao = signal<Session | null>(null);
  readonly perfil = signal<Perfil | null>(null);
  readonly logado = computed(() => this.sessao() !== null);
  readonly eAdmin = computed(() => this.perfil()?.admin === true);

  // Todos os membros do clube (guardados aqui para as telas usarem sem pedir de novo)
  readonly membros = signal<Perfil[]>([]);
  readonly membroPorId = computed(() => new Map(this.membros().map((m) => [m.id, m] as [string, Perfil])));

  // Promessa que se cumpre quando o app termina de descobrir se já existe alguém logado
  private resolverPronto!: () => void;
  readonly pronto: Promise<void> = new Promise<void>((resolver) => (this.resolverPronto = resolver));

  constructor() {
    inject(EfeitosService).iniciar(); // brilhinhos ao tocar nos botões
    this.iniciar();
  }

  private async iniciar() {
    try {
      const { data } = await this.sb.auth.getSession();
      await this.aplicarSessao(data.session);
    } catch {
      this.sessao.set(null);
    } finally {
      this.resolverPronto();
    }

    // Avisa quando alguém entra, sai ou a sessão é renovada.
    // O setTimeout evita um travamento conhecido ao chamar o Supabase dentro deste aviso.
    this.sb.auth.onAuthStateChange((_evento, sessao) => {
      setTimeout(() => this.aplicarSessao(sessao), 0);
    });
  }

  private async aplicarSessao(sessao: Session | null) {
    this.sessao.set(sessao);
    if (!sessao) {
      this.perfil.set(null);
      return;
    }
    if (this.perfil()?.id === sessao.user.id) return; // perfil já carregado

    const { data } = await this.sb.from('perfis').select('*').eq('id', sessao.user.id).maybeSingle();
    this.perfil.set((data as Perfil | null) ?? null);
  }

  async criarConta(d: DadosCadastro): Promise<Resultado> {
    const { data, error } = await this.sb.auth.signUp({
      email: d.email.trim(),
      password: d.senha,
      options: { data: { nome: d.nome.trim(), aniversario: d.aniversario, avatar_id: d.avatarId } },
    });
    if (error) return { erro: this.traduzirErro(error.message) };
    if (!data.session) return { precisaConfirmar: true };

    await this.aplicarSessao(data.session);
    return {};
  }

  async entrar(email: string, senha: string): Promise<Resultado> {
    const { data, error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) return { erro: this.traduzirErro(error.message) };

    await this.aplicarSessao(data.session);
    return {};
  }

  async sair() {
    await this.sb.auth.signOut();
    this.sessao.set(null);
    this.perfil.set(null);
  }

  async atualizarPerfil(campos: Partial<Pick<Perfil, 'nome' | 'aniversario' | 'avatar_id'>>): Promise<Resultado> {
    const id = this.sessao()?.user.id;
    if (!id) return { erro: 'Você precisa entrar de novo para salvar.' };

    const { data, error } = await this.sb.from('perfis').update(campos).eq('id', id).select().single();
    if (error) return { erro: 'Não deu para salvar agora. Tente de novo em instantes.' };

    this.perfil.set(data as Perfil);
    return {};
  }

  async carregarMembros() {
    this.membros.set(await this.listarMembros());
  }

  async listarMembros(): Promise<Perfil[]> {
    const { data, error } = await this.sb.from('perfis').select('*').order('nome');
    if (error || !data) return [];
    return data as Perfil[];
  }

  private traduzirErro(mensagem: string): string {
    const m = mensagem.toLowerCase();
    if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (m.includes('already registered')) return 'Esse e-mail já tem conta. Que tal entrar?';
    if (m.includes('at least')) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (m.includes('not confirmed')) return 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).';
    if (m.includes('valid email') || m.includes('invalid email')) return 'Esse e-mail não parece válido.';
    if (m.includes('rate limit')) return 'Muitas tentativas seguidas. Espere um pouquinho e tente de novo.';
    return 'Algo deu errado. Tente de novo em instantes.';
  }
}

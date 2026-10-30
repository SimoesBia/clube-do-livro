// Modelos: descrevem o "formato" dos dados que o app guarda.

// Um membro do clube (uma linha da tabela "perfis" no Supabase)
export interface Perfil {
  id: string;
  nome: string;
  aniversario: string | null; // formato AAAA-MM-DD
  avatar_id: string | null; // qual das bonecas prontas a pessoa escolheu (ex.: boneca_07)
  admin: boolean; // quem administra o clube (define o livro do mês, gira a roleta...)
  participacoes: number; // em quantos desafios a pessoa já entrou
  vitorias: number; // quantos desafios a pessoa já ganhou (troféus)
  criado_em: string;
}

// ---------- Bonecas prontas (as imagens ficam em src/assets/avatares e nunca são alteradas) ----------

export interface AvatarPronto {
  id: string;
  arquivo: string;
  fundo: string; // cor creme da borda da imagem (usada para a moldura combinar com ela)
}

export const AVATARES: AvatarPronto[] = [
  { id: 'boneca_01', arquivo: 'assets/avatares/boneca_01.png', fundo: '#F9EBE4' },
  { id: 'boneca_02', arquivo: 'assets/avatares/boneca_02.png', fundo: '#F9EBE4' },
  { id: 'boneca_03', arquivo: 'assets/avatares/boneca_03.png', fundo: '#F9ECE5' },
  { id: 'boneca_04', arquivo: 'assets/avatares/boneca_04.png', fundo: '#FAECE5' },
  { id: 'boneca_05', arquivo: 'assets/avatares/boneca_05.png', fundo: '#F9ECE5' },
  { id: 'boneca_06', arquivo: 'assets/avatares/boneca_06.png', fundo: '#FAECE5' },
  { id: 'boneca_07', arquivo: 'assets/avatares/boneca_07.png', fundo: '#F9EAE2' },
  { id: 'boneca_08', arquivo: 'assets/avatares/boneca_08.png', fundo: '#FAEBE4' },
  { id: 'boneca_09', arquivo: 'assets/avatares/boneca_09.png', fundo: '#F9ECE5' },
  { id: 'boneca_10', arquivo: 'assets/avatares/boneca_10.png', fundo: '#F9EBE4' },
  { id: 'boneca_11', arquivo: 'assets/avatares/boneca_11.png', fundo: '#FAECE5' },
  { id: 'boneca_12', arquivo: 'assets/avatares/boneca_12.png', fundo: '#FAEDE6' },
  { id: 'boneca_13', arquivo: 'assets/avatares/boneca_13.png', fundo: '#FAEDE7' },
  { id: 'boneca_14', arquivo: 'assets/avatares/boneca_14.png', fundo: '#FCEEE8' },
  { id: 'boneca_15', arquivo: 'assets/avatares/boneca_15.png', fundo: '#FBEEE9' },
  { id: 'boneca_16', arquivo: 'assets/avatares/boneca_16.png', fundo: '#FCEEE9' },
  { id: 'boneca_17', arquivo: 'assets/avatares/boneca_17.png', fundo: '#FBEEE8' },
  { id: 'boneca_18', arquivo: 'assets/avatares/boneca_18.png', fundo: '#FBF0EA' },
  { id: 'boneca_19', arquivo: 'assets/avatares/boneca_19.png', fundo: '#FEF5EF' },
  { id: 'boneca_20', arquivo: 'assets/avatares/boneca_20.png', fundo: '#FDF4EF' },
  { id: 'boneca_21', arquivo: 'assets/avatares/boneca_21.png', fundo: '#FEF4EE' },
  { id: 'boneca_22', arquivo: 'assets/avatares/boneca_22.png', fundo: '#FCF4EF' },
  { id: 'boneca_23', arquivo: 'assets/avatares/boneca_23.png', fundo: '#FDF4EF' },
  { id: 'boneca_24', arquivo: 'assets/avatares/boneca_24.png', fundo: '#FDF4EE' },
  { id: 'boneca_25', arquivo: 'assets/avatares/boneca_25.png', fundo: '#FEF5EF' },
  { id: 'boneca_26', arquivo: 'assets/avatares/boneca_26.png', fundo: '#FDF4EF' },
  { id: 'boneca_27', arquivo: 'assets/avatares/boneca_27.png', fundo: '#FDF4EE' },
  { id: 'boneca_28', arquivo: 'assets/avatares/boneca_28.png', fundo: '#FDF4EE' },
  { id: 'boneca_29', arquivo: 'assets/avatares/boneca_29.png', fundo: '#FDF4EE' },
  { id: 'boneca_30', arquivo: 'assets/avatares/boneca_30.png', fundo: '#FCF4EE' },
  { id: 'boneca_31', arquivo: 'assets/avatares/boneca_31.png', fundo: '#FEF5F0' },
  { id: 'boneca_32', arquivo: 'assets/avatares/boneca_32.png', fundo: '#FEF4EF' },
  { id: 'boneca_33', arquivo: 'assets/avatares/boneca_33.png', fundo: '#FDF4EF' },
  { id: 'boneca_34', arquivo: 'assets/avatares/boneca_34.png', fundo: '#FEF4EF' },
  { id: 'boneca_35', arquivo: 'assets/avatares/boneca_35.png', fundo: '#FDF4EF' },
  { id: 'boneca_36', arquivo: 'assets/avatares/boneca_36.png', fundo: '#FEF4EE' },
];

// Procura a boneca pelo código. Se o código não existir na lista, devolve nada
// (assim nunca usamos um caminho de arquivo vindo do banco de dados sem conferir).
export function avatarPorId(id: string | null | undefined): AvatarPronto | null {
  return AVATARES.find((a) => a.id === id) ?? null;
}

// ---------- Aro ao redor do avatar (vai mudando conforme a pessoa participa e ganha desafios) ----------

export type NivelAvatar = 'inicial' | 'bronze' | 'prata' | 'ouro' | 'diamante';

// Regra provisória (os números podem ser ajustados aqui, num lugar só):
// inicial = ainda não entrou em nenhum desafio; bronze = já está competindo (até 2 vitórias);
// prata = 3+ vitórias; ouro = 6+ vitórias; diamante = 10+ vitórias.
export function nivelDoMembro(participacoes: number, vitorias: number): NivelAvatar {
  if (vitorias >= 10) return 'diamante';
  if (vitorias >= 6) return 'ouro';
  if (vitorias >= 3) return 'prata';
  if (participacoes >= 1 || vitorias >= 1) return 'bronze';
  return 'inicial';
}

export function nivelDoPerfil(p: Pick<Perfil, 'participacoes' | 'vitorias'> | null | undefined): NivelAvatar {
  return p ? nivelDoMembro(p.participacoes, p.vitorias) : 'inicial';
}

export const NOMES_DOS_NIVEIS: Record<NivelAvatar, string> = {
  inicial: 'Leitora iniciante',
  bronze: 'Bronze',
  prata: 'Prata',
  ouro: 'Ouro',
  diamante: 'Diamante',
};

// ---------- Livros, roleta, resenhas ----------

export interface Livro {
  id: string;
  titulo: string;
  autor: string | null;
  capa_url: string | null;
  ano?: number | null;
  paginas?: number | null;
  descricao?: string | null;
  chave_ol?: string | null; // código do livro na Open Library (ex.: OL45883W)
  criado_em: string;
}

export interface DadosDoClube {
  data_sorteio: string | null; // AAAA-MM-DD
  link_meet: string | null;
  livro: Livro | null; // livro do mês
}

// Quem aparece ao lado de uma sugestão, resenha ou recado
export type Autor = Pick<Perfil, 'id' | 'nome' | 'avatar_id' | 'participacoes' | 'vitorias'>;

export interface OpcaoSorteio {
  id: string;
  titulo: string;
  autor: string | null;
  capa_url: string | null;
}

export interface Sugestao extends OpcaoSorteio {
  sugerido_por: string;
  criado_em: string;
  quem: Autor | null;
}

export interface Sorteio {
  id: string;
  realizado_em: string;
  opcoes: OpcaoSorteio[];
  indice: number;
  vencedor_titulo: string;
}

// Um livro encontrado na busca (ou digitado à mão)
export interface ResultadoBusca {
  titulo: string;
  autor: string | null;
  capa_url: string | null;
  ano?: number | null;
  paginas?: number | null;
  descricao?: string | null;
  chave_ol?: string | null;
}

export interface Resenha {
  id: string;
  livro_id: string;
  autor_id: string;
  nota: number;
  dias_leitura: number | null;
  texto: string;
  spoiler: boolean;
  criado_em: string;
  livro: Pick<Livro, 'id' | 'titulo' | 'autor' | 'capa_url'> | null;
  quem: Autor | null;
}

export interface Comentario {
  id: string;
  resenha_id: string;
  autor_id: string;
  texto: string;
  criado_em: string;
  quem: Autor | null;
}

// ---------- Livros lidos de cada pessoa ----------

export type ContextoLeitura = 'antes_do_clube' | 'no_clube' | 'fora_do_clube';

export const CONTEXTOS: { valor: ContextoLeitura; nome: string }[] = [
  { valor: 'antes_do_clube', nome: 'Antes do clube' },
  { valor: 'no_clube', nome: 'No clube' },
  { valor: 'fora_do_clube', nome: 'Fora do clube' },
];

export interface LivroLido {
  id: string;
  perfil_id: string;
  titulo: string;
  autor: string | null;
  capa_url: string | null;
  ano: number | null;
  paginas: number | null;
  chave_ol: string | null;
  contexto: ContextoLeitura;
  criado_em: string;
}

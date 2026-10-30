import { Injectable } from '@angular/core';
import { ResultadoBusca } from './modelos';

// ============================================================
// Open Library (https://openlibrary.org): a fonte principal de livros do app.
// É gratuita e não pede chave. Usamos quatro partes dela:
//   • Search API    -> procurar livros (título, autor, capa, ano, páginas)
//   • Trending API  -> livros em alta (mostruário da Biblioteca)
//   • Subjects API  -> livros por assunto (mostruário e "surpreenda-me")
//   • Works API     -> descrição completa de um livro
//   • Covers API    -> as capas
// Se a Open Library estiver fora do ar, a busca tenta o Google Livros.
// ============================================================

interface DocBusca {
  key?: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
  number_of_pages_median?: number;
}

interface ObraAssunto {
  key?: string;
  title?: string;
  authors?: { name?: string }[];
  cover_id?: number;
  first_publish_year?: number;
}

interface VolumeGoogle {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    pageCount?: number;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
}

export interface Assunto {
  id: string; // como a Open Library chama o assunto
  nome: string;
}

export const ASSUNTOS: Assunto[] = [
  { id: 'romance', nome: 'Romance' },
  { id: 'fantasy', nome: 'Fantasia' },
  { id: 'mystery_and_detective_stories', nome: 'Mistério' },
  { id: 'young_adult_fiction', nome: 'Jovem adulto' },
  { id: 'classic_literature', nome: 'Clássicos' },
  { id: 'science_fiction', nome: 'Ficção científica' },
  { id: 'historical_fiction', nome: 'Ficção histórica' },
];

export interface DetalhesExtras {
  descricao: string | null;
  paginas: number | null;
  ano: number | null;
}

const BASE = 'https://openlibrary.org';

@Injectable({ providedIn: 'root' })
export class LivrosApiService {
  private readonly memoria = new Map<string, ResultadoBusca[]>();

  // ----- procurar um livro -----
  async buscar(texto: string): Promise<ResultadoBusca[]> {
    const q = texto.trim();
    if (q.length < 2) return [];
    try {
      const url = `${BASE}/search.json?q=${encodeURIComponent(q)}&limit=12&fields=key,title,author_name,cover_i,first_publish_year,number_of_pages_median`;
      const json = (await this.pegar(url)) as { docs?: DocBusca[] };
      const lista = this.semRepetidos((json.docs ?? []).map((d) => this.deBusca(d)));
      if (lista.length > 0) return lista.slice(0, 6);
    } catch {
      // Open Library fora do ar: tentamos o Google Livros logo abaixo
    }
    return this.googleLivros(q);
  }

  // ----- mostruário: livros em alta hoje -----
  async emAlta(): Promise<ResultadoBusca[]> {
    return this.comMemoria('alta', async () => {
      const json = (await this.pegar(`${BASE}/trending/daily.json?limit=18`)) as { works?: DocBusca[] };
      return this.semRepetidos((json.works ?? []).map((d) => this.deBusca(d)));
    });
  }

  // ----- mostruário: livros de um assunto (com ponto de partida para variar) -----
  async porAssunto(assunto: string, deslocamento = 0): Promise<ResultadoBusca[]> {
    return this.comMemoria(`assunto:${assunto}:${deslocamento}`, async () => {
      const url = `${BASE}/subjects/${encodeURIComponent(assunto)}.json?limit=18&offset=${deslocamento}`;
      const json = (await this.pegar(url)) as { works?: ObraAssunto[] };
      return this.semRepetidos((json.works ?? []).map((o) => this.deAssunto(o)));
    });
  }

  // ----- descrição, páginas e ano de um livro específico -----
  async completar(chave: string): Promise<DetalhesExtras> {
    const vazio: DetalhesExtras = { descricao: null, paginas: null, ano: null };
    if (!/^OL[0-9]+[A-Z]$/.test(chave)) return vazio;
    const [obra, busca] = await Promise.allSettled([
      this.pegar(`${BASE}/works/${chave}.json`),
      this.pegar(`${BASE}/search.json?q=${encodeURIComponent('key:/works/' + chave)}&fields=number_of_pages_median,first_publish_year&limit=1`),
    ]);

    let descricao: string | null = null;
    if (obra.status === 'fulfilled') {
      const d = (obra.value as { description?: string | { value?: string } }).description;
      const texto = typeof d === 'string' ? d : d?.value ?? '';
      descricao = this.limparDescricao(texto);
    }

    let paginas: number | null = null;
    let ano: number | null = null;
    if (busca.status === 'fulfilled') {
      const doc = ((busca.value as { docs?: DocBusca[] }).docs ?? [])[0];
      paginas = this.numero(doc?.number_of_pages_median, 1, 20000);
      ano = this.numero(doc?.first_publish_year, 0, 2100);
    }
    return { descricao, paginas, ano };
  }

  // ---------- ajudantes ----------

  private async pegar(url: string): Promise<unknown> {
    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), 9000);
    try {
      const resposta = await fetch(url, { signal: controle.signal });
      if (!resposta.ok) throw new Error('Serviço indisponível');
      return await resposta.json();
    } finally {
      clearTimeout(relogio);
    }
  }

  private async comMemoria(chave: string, buscar: () => Promise<ResultadoBusca[]>): Promise<ResultadoBusca[]> {
    const guardado = this.memoria.get(chave);
    if (guardado) return guardado;
    const lista = await buscar();
    if (lista.length > 0) this.memoria.set(chave, lista);
    return lista;
  }

  private capa(id: number | undefined): string | null {
    return id && id > 0 ? `https://covers.openlibrary.org/b/id/${id}-M.jpg` : null;
  }

  private chaveCurta(key: string | undefined): string | null {
    const curta = key?.split('/').pop() ?? '';
    return /^OL[0-9]+[A-Z]$/.test(curta) ? curta : null;
  }

  private numero(valor: unknown, minimo: number, maximo: number): number | null {
    return typeof valor === 'number' && Number.isFinite(valor) && valor >= minimo && valor <= maximo ? Math.round(valor) : null;
  }

  private deBusca(d: DocBusca): ResultadoBusca {
    return {
      titulo: String(d.title ?? '').slice(0, 200),
      autor: Array.isArray(d.author_name) && d.author_name.length > 0 ? d.author_name.slice(0, 2).join(', ').slice(0, 200) : null,
      capa_url: this.capa(d.cover_i),
      ano: this.numero(d.first_publish_year, 0, 2100),
      paginas: this.numero(d.number_of_pages_median, 1, 20000),
      chave_ol: this.chaveCurta(d.key),
    };
  }

  private deAssunto(o: ObraAssunto): ResultadoBusca {
    const nomes = (o.authors ?? []).map((a) => a.name).filter((n): n is string => !!n);
    return {
      titulo: String(o.title ?? '').slice(0, 200),
      autor: nomes.length > 0 ? nomes.slice(0, 2).join(', ').slice(0, 200) : null,
      capa_url: this.capa(o.cover_id),
      ano: this.numero(o.first_publish_year, 0, 2100),
      paginas: null,
      chave_ol: this.chaveCurta(o.key),
    };
  }

  // A descrição da Open Library às vezes traz lixo no fim (links, "----------"): ficamos só com o começo
  private limparDescricao(texto: string): string | null {
    const inicio = texto.split(/\r?\n\s*-{3,}/)[0] ?? '';
    const limpo = inicio.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();
    if (!limpo) return null;
    return limpo.length > 700 ? limpo.slice(0, 697).trimEnd() + '…' : limpo;
  }

  private semRepetidos(lista: ResultadoBusca[]): ResultadoBusca[] {
    const vistos = new Set<string>();
    return lista.filter((r) => {
      if (!r.titulo) return false;
      const chave = `${r.titulo}|${r.autor ?? ''}`.toLowerCase();
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });
  }

  // ----- plano B: Google Livros -----
  private async googleLivros(q: string): Promise<ResultadoBusca[]> {
    try {
      const json = (await this.pegar(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=8&printType=books`,
      )) as { items?: VolumeGoogle[] };
      const lista = (json.items ?? []).map((item): ResultadoBusca => {
        const v = item.volumeInfo ?? {};
        const capa = v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail ?? null;
        const ano = Number.parseInt(String(v.publishedDate ?? '').slice(0, 4), 10);
        return {
          titulo: String(v.title ?? '').slice(0, 200),
          autor: Array.isArray(v.authors) && v.authors.length > 0 ? v.authors.join(', ').slice(0, 200) : null,
          capa_url: capa ? String(capa).replace(/^http:/, 'https:').replace('&edge=curl', '') : null,
          ano: this.numero(ano, 0, 2100),
          paginas: this.numero(v.pageCount, 1, 20000),
          chave_ol: null,
        };
      });
      return this.semRepetidos(lista).slice(0, 6);
    } catch {
      return [];
    }
  }
}

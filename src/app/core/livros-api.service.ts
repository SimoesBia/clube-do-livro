import { Injectable } from '@angular/core';
import { ResultadoBusca } from './modelos';

// ============================================================
// De onde vêm os livros do app
//
//  • Google Livros (em português): títulos, descrições e capas das edições brasileiras.
//    É a fonte principal, porque a Open Library tem a maior parte do acervo em inglês.
//  • Open Library (https://openlibrary.org): complementa a busca (filtro de idioma português),
//    completa capas, ano e páginas que faltarem, guarda o código do livro (link "Ver na Open Library")
//    e alimenta a categoria "Mundo", com os livros em alta no mundo todo (títulos originais).
// Os dois serviços são gratuitos e não pedem chave para o uso do clube.
// ============================================================

interface VolumeGoogle {
  id?: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publishedDate?: string;
    pageCount?: number;
    description?: string;
    language?: string;
    ratingsCount?: number;
    averageRating?: number;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
}

interface DocOpenLibrary {
  key?: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
  number_of_pages_median?: number;
}

// Um livro com os dados extras que usamos só para escolher e ordenar
interface Candidato extends ResultadoBusca {
  idioma: string;
  avaliacoes: number;
  nota: number;
}

export interface Categoria {
  id: string;
  nome: string;
  consulta: string; // o que perguntamos ao Google Livros
  ordem: 'relevance' | 'newest';
  anosRecentes?: number; // se informado, dá preferência a livros dos últimos X anos
}

export const CATEGORIAS: Categoria[] = [
  { id: 'alta', nome: '🔥 Em alta', consulta: 'subject:fiction', ordem: 'relevance', anosRecentes: 6 },
  { id: 'novos', nome: '🆕 Lançamentos', consulta: 'subject:fiction', ordem: 'newest', anosRecentes: 2 },
  { id: 'romance', nome: 'Romance', consulta: 'subject:romance', ordem: 'relevance' },
  { id: 'fantasia', nome: 'Fantasia', consulta: 'subject:fantasy', ordem: 'relevance' },
  { id: 'misterio', nome: 'Mistério', consulta: 'subject:mystery', ordem: 'relevance' },
  { id: 'jovem', nome: 'Jovem adulto', consulta: 'subject:"young adult fiction"', ordem: 'relevance' },
  { id: 'classicos', nome: 'Clássicos', consulta: 'subject:classics', ordem: 'relevance' },
  { id: 'brasileiros', nome: 'Autores brasileiros', consulta: 'subject:"brazilian fiction"', ordem: 'relevance' },
  { id: 'scifi', nome: 'Ficção científica', consulta: 'subject:"science fiction"', ordem: 'relevance' },
];

// Categoria especial: livros em alta no mundo, direto da Open Library (os títulos vêm no idioma original)
export const CATEGORIA_MUNDO = { id: 'mundo', nome: '🌎 Mundo (Open Library)' };

export interface DetalhesExtras {
  descricao: string | null;
  paginas: number | null;
  ano: number | null;
}

const GOOGLE = 'https://www.googleapis.com/books/v1/volumes';
const OPEN_LIBRARY = 'https://openlibrary.org';

@Injectable({ providedIn: 'root' })
export class LivrosApiService {
  private readonly memoria = new Map<string, ResultadoBusca[]>();

  // ----- procurar um livro (português primeiro, Open Library completando) -----
  async buscar(texto: string): Promise<ResultadoBusca[]> {
    const q = texto.trim();
    if (q.length < 2) return [];

    const [google, aberta] = await Promise.allSettled([
      this.volumes({ q, max: 10 }).then((v) => v.map((x) => this.deGoogle(x))),
      this.openLibrary(q),
    ]);
    const principais = google.status === 'fulfilled' ? google.value.filter((c) => c.titulo && c.idioma === 'pt') : [];
    const complemento = aberta.status === 'fulfilled' ? aberta.value : [];

    const mapa = new Map<string, ResultadoBusca>();
    for (const c of principais) {
      const k = this.chave(c.titulo);
      if (!mapa.has(k)) mapa.set(k, this.limpo(c));
    }
    for (const o of complemento) {
      const k = this.chave(o.titulo);
      const ja = mapa.get(k);
      if (ja) {
        // o mesmo livro: a Open Library completa o que faltar e dá o código dela
        ja.capa_url ??= o.capa_url;
        ja.chave_ol ??= o.chave_ol;
        ja.ano ??= o.ano;
        ja.paginas ??= o.paginas;
      } else {
        mapa.set(k, o);
      }
    }
    return Array.from(mapa.values()).slice(0, 8);
  }

  // ----- mostruário da Biblioteca -----
  async mostruario(categoriaId: string, inicio = 0): Promise<ResultadoBusca[]> {
    if (categoriaId === CATEGORIA_MUNDO.id) return this.emAltaNoMundo();
    const cat = CATEGORIAS.find((c) => c.id === categoriaId);
    if (!cat) return [];

    return this.comMemoria(`cat:${categoriaId}:${inicio}`, async () => {
      const volumes = await this.volumes({ q: cat.consulta, ordem: cat.ordem, inicio, max: 40 });
      let candidatos = volumes.map((v) => this.deGoogle(v)).filter((c) => c.titulo && c.capa_url && c.idioma === 'pt');

      if (cat.anosRecentes) {
        const minimo = new Date().getFullYear() - cat.anosRecentes;
        const recentes = candidatos.filter((c) => (c.ano ?? 0) >= minimo);
        if (recentes.length >= 6) candidatos = recentes;
      }
      // os mais bem avaliados primeiro (a ordem de antes se mantém nos empates)
      candidatos.sort((a, b) => b.avaliacoes - a.avaliacoes || b.nota - a.nota);
      return this.semRepetidos(candidatos.map((c) => this.limpo(c))).slice(0, 18);
    });
  }

  // ----- livros em alta no mundo (Open Library, títulos originais) -----
  async emAltaNoMundo(): Promise<ResultadoBusca[]> {
    return this.comMemoria('mundo', async () => {
      const json = (await this.pegar(`${OPEN_LIBRARY}/trending/daily.json?limit=18`)) as { works?: DocOpenLibrary[] };
      return this.semRepetidos((json.works ?? []).map((d) => this.deOpenLibrary(d)).filter((r) => r.titulo));
    });
  }

  // ----- descrição em português, páginas e ano de um livro específico -----
  async detalhes(l: ResultadoBusca): Promise<DetalhesExtras> {
    const extras: DetalhesExtras = { descricao: l.descricao ?? null, paginas: l.paginas ?? null, ano: l.ano ?? null };

    if (!extras.descricao || !extras.paginas || !extras.ano) {
      try {
        const autor = (l.autor ?? '').split(',')[0].replace(/"/g, '').trim();
        const titulo = l.titulo.replace(/"/g, '').trim();
        const q = `intitle:"${titulo}"${autor ? ` inauthor:"${autor}"` : ''}`;
        const achados = (await this.volumes({ q, max: 5 })).map((v) => this.deGoogle(v)).filter((c) => c.idioma === 'pt');
        const parecido = achados.find((c) => this.chave(c.titulo) === this.chave(l.titulo)) ?? achados[0];
        if (parecido) {
          extras.descricao ??= parecido.descricao ?? null;
          extras.paginas ??= parecido.paginas ?? null;
          extras.ano ??= parecido.ano ?? null;
        }
      } catch {
        // sem o Google, seguimos com o que temos
      }
    }

    if ((!extras.paginas || !extras.ano) && l.chave_ol && /^OL[0-9]+[A-Z]$/.test(l.chave_ol)) {
      try {
        const json = (await this.pegar(
          `${OPEN_LIBRARY}/search.json?q=${encodeURIComponent('key:/works/' + l.chave_ol)}&fields=number_of_pages_median,first_publish_year&limit=1`,
        )) as { docs?: DocOpenLibrary[] };
        const doc = (json.docs ?? [])[0];
        extras.paginas ??= this.numero(doc?.number_of_pages_median, 1, 20000);
        extras.ano ??= this.numero(doc?.first_publish_year, 0, 2100);
      } catch {
        // tudo bem
      }
    }
    return extras;
  }

  // ---------- Google Livros ----------

  private async volumes(o: { q: string; ordem?: 'relevance' | 'newest'; inicio?: number; max?: number }): Promise<VolumeGoogle[]> {
    const url =
      `${GOOGLE}?q=${encodeURIComponent(o.q)}&langRestrict=pt&printType=books` +
      `&orderBy=${o.ordem ?? 'relevance'}&startIndex=${o.inicio ?? 0}&maxResults=${o.max ?? 10}`;
    const json = (await this.pegar(url)) as { items?: VolumeGoogle[] };
    return json.items ?? [];
  }

  private deGoogle(v: VolumeGoogle): Candidato {
    const info = v.volumeInfo ?? {};
    const capa = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null;
    const ano = Number.parseInt(String(info.publishedDate ?? '').slice(0, 4), 10);
    return {
      titulo: String(info.title ?? '').slice(0, 200),
      autor: Array.isArray(info.authors) && info.authors.length > 0 ? info.authors.slice(0, 2).join(', ').slice(0, 200) : null,
      capa_url: capa ? String(capa).replace(/^http:/, 'https:').replace('&edge=curl', '') : null,
      ano: this.numero(ano, 0, 2100),
      paginas: this.numero(info.pageCount, 1, 20000),
      descricao: this.limparTexto(info.description),
      chave_ol: null,
      idioma: String(info.language ?? ''),
      avaliacoes: Number(info.ratingsCount ?? 0),
      nota: Number(info.averageRating ?? 0),
    };
  }

  // ---------- Open Library ----------

  // Procura só livros que têm edição em português
  private async openLibrary(q: string): Promise<ResultadoBusca[]> {
    const url =
      `${OPEN_LIBRARY}/search.json?q=${encodeURIComponent(q + ' language:por')}` +
      `&limit=8&fields=key,title,author_name,cover_i,first_publish_year,number_of_pages_median`;
    const json = (await this.pegar(url)) as { docs?: DocOpenLibrary[] };
    return (json.docs ?? []).map((d) => this.deOpenLibrary(d)).filter((r) => r.titulo);
  }

  private deOpenLibrary(d: DocOpenLibrary): ResultadoBusca {
    const curta = d.key?.split('/').pop() ?? '';
    return {
      titulo: String(d.title ?? '').slice(0, 200),
      autor: Array.isArray(d.author_name) && d.author_name.length > 0 ? d.author_name.slice(0, 2).join(', ').slice(0, 200) : null,
      capa_url: d.cover_i && d.cover_i > 0 ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
      ano: this.numero(d.first_publish_year, 0, 2100),
      paginas: this.numero(d.number_of_pages_median, 1, 20000),
      chave_ol: /^OL[0-9]+[A-Z]$/.test(curta) ? curta : null,
    };
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

  private numero(valor: unknown, minimo: number, maximo: number): number | null {
    return typeof valor === 'number' && Number.isFinite(valor) && valor >= minimo && valor <= maximo ? Math.round(valor) : null;
  }

  // Tira etiquetas HTML e caracteres estranhos das descrições
  private limparTexto(texto: string | undefined): string | null {
    if (!texto) return null;
    const limpo = texto
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
    if (!limpo) return null;
    return limpo.length > 700 ? limpo.slice(0, 697).trimEnd() + '…' : limpo;
  }

  // Título "limpo" para comparar (sem acento, maiúscula ou pontuação)
  private chave(titulo: string): string {
    return titulo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  private limpo(c: Candidato): ResultadoBusca {
    return { titulo: c.titulo, autor: c.autor, capa_url: c.capa_url, ano: c.ano, paginas: c.paginas, descricao: c.descricao, chave_ol: c.chave_ol };
  }

  private semRepetidos(lista: ResultadoBusca[]): ResultadoBusca[] {
    const vistos = new Set<string>();
    return lista.filter((r) => {
      if (!r.titulo) return false;
      const k = this.chave(r.titulo);
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
  }
}

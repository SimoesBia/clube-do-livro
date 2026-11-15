import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { ResultadoBusca } from './modelos';

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

interface Candidato extends ResultadoBusca {
  idioma: string;
  avaliacoes: number;
  nota: number;
}

export interface Categoria {
  id: string;
  nome: string;
  consulta: string; 
  ordem: 'relevance' | 'newest';
  anosRecentes?: number; 
}

export const CATEGORIAS: Categoria[] = [
  { id: 'alta', nome: '🔥 Em alta', consulta: '', ordem: 'relevance' },
  { id: 'novos', nome: '🆕 Lançamentos', consulta: 'ficção', ordem: 'relevance', anosRecentes: 2 },
  { id: 'romance', nome: 'Romance', consulta: 'romance literário', ordem: 'relevance' },
  { id: 'fantasia', nome: 'Fantasia', consulta: 'fantasia', ordem: 'relevance' },
  { id: 'misterio', nome: 'Mistério', consulta: 'mistério', ordem: 'relevance' },
  { id: 'jovem', nome: 'Jovem adulto', consulta: 'ficção juvenil', ordem: 'relevance' },
  { id: 'classicos', nome: 'Clássicos', consulta: 'clássicos', ordem: 'relevance' },
  { id: 'brasileiros', nome: 'Autores brasileiros', consulta: 'literatura brasileira', ordem: 'relevance' },
  { id: 'scifi', nome: 'Ficção científica', consulta: '"ficção científica"', ordem: 'relevance' },
];

export const CATEGORIA_MUNDO = { id: 'mundo', nome: '🌎 Mundo (Open Library)' };

export interface DetalhesExtras {
  descricao: string | null;
  paginas: number | null;
  ano: number | null;
}

const GOOGLE = 'https://www.googleapis.com/books/v1/volumes';
// Chave do Google Livros configurada no ambiente do app.
const CHAVE_GOOGLE = (environment as unknown as { googleLivrosChave?: string }).googleLivrosChave ?? '';
const OPEN_LIBRARY = 'https://openlibrary.org';

const TAMANHO_PAGINA = 20;
const CAMPOS_OPEN_LIBRARY = 'key,title,author_name,cover_i,first_publish_year,number_of_pages_median';
const ASSUNTOS_OPEN_LIBRARY: Record<string, string> = {
  romance: 'Romance fiction',
  fantasia: 'Fantasy fiction',
  misterio: 'Mystery fiction',
  jovem: 'Young adult fiction',
  classicos: 'Classics',
  brasileiros: 'Brazilian literature',
  scifi: 'Science fiction',
};
const CONSULTAS_LANCAMENTOS = ['ficção', 'romance', 'fantasia', 'mistério', 'não ficção', 'biografia', 'história'];

export interface CursorBiblioteca {
  google: (number | null)[];
  openLibrary: number | null;
}

export interface PaginaBiblioteca {
  livros: ResultadoBusca[];
  proximo: CursorBiblioteca | null;
  falhas: string[];
}

@Injectable({ providedIn: 'root' })
export class LivrosApiService {
  private readonly memoria = new Map<string, ResultadoBusca[]>();

  async buscar(texto: string): Promise<ResultadoBusca[]> {
    const q = texto.trim();
    if (q.length < 2) return [];

    const [google, aberta] = await Promise.allSettled([
      this.volumes({ q, max: 10 }).then((v) => v.map((x) => this.deGoogle(x))),
      this.openLibrary(q),
    ]);
    const principais = google.status === 'fulfilled' ? google.value.filter((c) => c.titulo && /^pt(?:-|$)/i.test(c.idioma)) : [];
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

  async paginaBiblioteca(
    categoriaId: string,
    busca = '',
    cursor?: CursorBiblioteca,
  ): Promise<PaginaBiblioteca> {
    const cat = CATEGORIAS.find(c => c.id === categoriaId);
    const emAlta = !busca && categoriaId === 'alta';
    const mundo = !busca && categoriaId === CATEGORIA_MUNDO.id;
    const lancamentos = !busca && categoriaId === 'novos';
    const anoMinimo = new Date().getFullYear() - (cat?.anosRecentes ?? 2);
    const consultas = busca ? [busca] : lancamentos ? CONSULTAS_LANCAMENTOS :
      cat?.consulta ? [cat.consulta] : [];
    const atual = cursor ?? { google: consultas.map(() => 0), openLibrary: 0 };

    const assunto = ASSUNTOS_OPEN_LIBRARY[categoriaId];
    const qAberta = busca
      ? '"' + busca.replace(/["\\]/g, ' ').trim() + '"'
      : lancamentos ? `first_publish_year:[${anoMinimo} TO *]`
        : emAlta ? 'trending_score_hourly_sum:[1 TO *]'
          : assunto ? `subject:"${assunto}"` : (cat?.consulta ?? '');

    const google = Promise.allSettled(consultas.map(async (q, indice) => {
      const inicio = atual.google[indice];
      if (inicio == null) return { livros: [], proximo: null };
      const volumes = await this.volumes({ q, ordem: busca ? 'relevance' : cat?.ordem, inicio, max: TAMANHO_PAGINA });
      const livros = volumes.map(v => this.deGoogle(v)).filter(c =>
        c.titulo && /^pt(?:-|$)/i.test(c.idioma) &&
        (!lancamentos || (c.ano ?? 0) >= anoMinimo),
      ).map(c => this.limpo(c));
      return { livros, proximo: volumes.length ? inicio + volumes.length : null };
    }));

    const aberta = Promise.allSettled([this.paginaOpenLibrary(
      qAberta, atual.openLibrary, mundo, emAlta ? 'trending' : lancamentos ? 'new' : '',
    )]);
    const [resultadosGoogle, [resultadoAberto]] = await Promise.all([google, aberta]);
    const falhas = new Set<string>();
    const livrosGoogle: ResultadoBusca[] = [];
    const proximosGoogle = resultadosGoogle.map((resultado, indice) => {
      if (resultado.status === 'rejected') {
        falhas.add('Google Livros');
        return atual.google[indice];
      }
      livrosGoogle.push(...resultado.value.livros);
      return resultado.value.proximo;
    });

    let livrosAbertos: ResultadoBusca[] = [];
    let proximoAberto = atual.openLibrary;
    if (resultadoAberto.status === 'fulfilled') {
      livrosAbertos = resultadoAberto.value.livros;
      proximoAberto = resultadoAberto.value.proximo;
    } else {
      falhas.add('Open Library');
    }

    
    if (emAlta) {
      const edicoes = await Promise.allSettled(livrosAbertos.slice(0, 3).map(async livro => {
        const titulo = livro.titulo.replace(/"/g, '');
        const autor = (livro.autor ?? '').split(',')[0].replace(/"/g, '').trim();
        const q = `intitle:"${titulo}"${autor ? ` inauthor:"${autor}"` : ''}`;
        const volumes = await this.volumes({ q, max: 5 });
        return volumes.map(v => this.deGoogle(v)).find(c =>
          /^pt(?:-|$)/i.test(c.idioma) && this.chave(c.titulo) === this.chave(livro.titulo) &&
          autor && this.chave(c.autor ?? '').includes(this.chave(autor)),
        );
      }));
      livrosAbertos = livrosAbertos.map((livro, indice) => {
        const edicao = edicoes[indice];
        if (edicao?.status === 'rejected') falhas.add('Google Livros');
        if (edicao?.status !== 'fulfilled' || !edicao.value) return livro;
        const dados = this.limpo(edicao.value);
        return { ...livro, descricao: dados.descricao, capa_url: dados.capa_url ?? livro.capa_url,
          paginas: dados.paginas ?? livro.paginas };
      });
    }

    return {
      livros: this.juntarLivros(livrosGoogle, livrosAbertos),
      proximo: proximoAberto !== null || proximosGoogle.some(inicio => inicio !== null)
        ? { google: proximosGoogle, openLibrary: proximoAberto } : null,
      falhas: [...falhas],
    };
  }

  private async paginaOpenLibrary(
    q: string, inicio: number | null, mundo: boolean, ordem: string,
  ): Promise<{ livros: ResultadoBusca[]; proximo: number | null }> {
    if (inicio === null) return { livros: [], proximo: null };
    const url = mundo
      ? `${OPEN_LIBRARY}/trending/daily.json?limit=${TAMANHO_PAGINA}&page=${Math.floor(inicio / TAMANHO_PAGINA) + 1}`
      : `${OPEN_LIBRARY}/search.json?q=${encodeURIComponent(q)}&limit=${TAMANHO_PAGINA}&offset=${inicio}` +
        `&fields=${CAMPOS_OPEN_LIBRARY}${ordem ? `&sort=${ordem}` : ''}`;
    const json = (await this.pegar(url)) as {
      docs?: DocOpenLibrary[]; works?: DocOpenLibrary[]; numFound?: number; num_found?: number;
    };
    const docs = (mundo ? json.works : json.docs) ?? [];
    const total = json.numFound ?? json.num_found;
    const proximo = inicio + docs.length;
    return {
      livros: docs.map(d => this.deOpenLibrary(d)).filter(l => l.titulo),
      proximo: docs.length && (total != null ? proximo < total : docs.length === TAMANHO_PAGINA)
        ? proximo : null,
    };
  }

  juntarLivros(atuais: ResultadoBusca[], novos: ResultadoBusca[]): ResultadoBusca[] {
    const livros = new Map<string, ResultadoBusca>();
    for (const livro of [...atuais, ...novos]) {
      const autor = (livro.autor ?? '').split(',')[0];
      const chave = `${this.chave(livro.titulo)}|${this.chave(autor)}`;
      const anterior = livros.get(chave);
      livros.set(chave, anterior ? {
        ...anterior,
        capa_url: anterior.capa_url ?? livro.capa_url,
        descricao: anterior.descricao ?? livro.descricao,
        paginas: anterior.paginas ?? livro.paginas,
        ano: anterior.ano ?? livro.ano,
        chave_ol: anterior.chave_ol ?? livro.chave_ol,
      } : livro);
    }
    return [...livros.values()];
  }

  
  async emAltaNoMundo(): Promise<ResultadoBusca[]> {
    return this.comMemoria('mundo', async () => {
      const json = (await this.pegar(`${OPEN_LIBRARY}/trending/daily.json?limit=18`)) as { works?: DocOpenLibrary[] };
      return this.semRepetidos((json.works ?? []).map((d) => this.deOpenLibrary(d)).filter((r) => r.titulo));
    });
  }

 
  async detalhes(l: ResultadoBusca): Promise<DetalhesExtras> {
    const extras: DetalhesExtras = { descricao: l.descricao ?? null, paginas: l.paginas ?? null, ano: l.ano ?? null };

    if (!extras.descricao || !extras.paginas || !extras.ano) {
      try {
        const autor = (l.autor ?? '').split(',')[0].replace(/"/g, '').trim();
        const titulo = l.titulo.replace(/"/g, '').trim();
        const q = `intitle:"${titulo}"${autor ? ` inauthor:"${autor}"` : ''}`;
        const achados = (await this.volumes({ q, max: 5 })).map((v) => this.deGoogle(v)).filter((c) => /^pt(?:-|$)/i.test(c.idioma));
        const parecido = achados.find((c) => this.chave(c.titulo) === this.chave(l.titulo)) ?? achados[0];
        if (parecido) {
          extras.descricao ??= parecido.descricao ?? null;
          extras.paginas ??= parecido.paginas ?? null;
          extras.ano ??= parecido.ano ?? null;
        }
      } catch {
       
      }
    }

    if (!extras.descricao || !extras.paginas || !extras.ano) {
      try {
        const chave = l.chave_ol ?? (await this.acharNaOpenLibrary(l));
        if (chave && /^OL[0-9]+[A-Z]$/.test(chave)) {
          const [obra, busca] = await Promise.allSettled([
            this.pegar(`${OPEN_LIBRARY}/works/${chave}.json`),
            this.pegar(`${OPEN_LIBRARY}/search.json?q=${encodeURIComponent('key:/works/' + chave)}&fields=number_of_pages_median,first_publish_year&limit=1`),
          ]);
          if (obra.status === 'fulfilled' && !extras.descricao) {
            const d = (obra.value as { description?: string | { value?: string } }).description;
            extras.descricao = this.limparDescricaoOpenLibrary(typeof d === 'string' ? d : d?.value ?? '');
          }
          if (busca.status === 'fulfilled') {
            const doc = ((busca.value as { docs?: DocOpenLibrary[] }).docs ?? [])[0];
            extras.paginas ??= this.numero(doc?.number_of_pages_median, 1, 20000);
            extras.ano ??= this.numero(doc?.first_publish_year, 0, 2100);
          }
        }
      } catch {
        
      }
    }
    return extras;
  }

  
  private async acharNaOpenLibrary(l: ResultadoBusca): Promise<string | null> {
    const autor = (l.autor ?? '').split(',')[0].trim();
    const url =
      `${OPEN_LIBRARY}/search.json?title=${encodeURIComponent(l.titulo)}` +
      `${autor ? `&author=${encodeURIComponent(autor)}` : ''}&limit=1&fields=key`;
    const json = (await this.pegar(url)) as { docs?: DocOpenLibrary[] };
    const curta = (json.docs ?? [])[0]?.key?.split('/').pop() ?? '';
    return /^OL[0-9]+[A-Z]$/.test(curta) ? curta : null;
  }

  private limparDescricaoOpenLibrary(texto: string): string | null {
    const inicio = texto.split(/\r?\n\s*-{3,}/)[0] ?? '';
    return this.limparTexto(inicio.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'));
  }

 
  async traduzir(texto: string): Promise<string> {
    const partes = this.dividir(texto, 440);
    const saida: string[] = [];
    for (const parte of partes) {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(parte)}&langpair=en|pt-BR`;
      const json = (await this.pegar(url)) as { responseData?: { translatedText?: string } };
      const traduzido = json.responseData?.translatedText ?? '';
      if (!traduzido || traduzido.toUpperCase().includes('MYMEMORY WARNING')) throw new Error('Tradução indisponível');
      saida.push(this.limparTexto(traduzido) ?? '');
    }
    return saida.join(' ').trim();
  }

  
  private dividir(texto: string, limite: number): string[] {
    const frases = texto.match(/[^.!?]+[.!?]*\s*/g) ?? [texto];
    const partes: string[] = [];
    let atual = '';
    for (const frase of frases) {
      if ((atual + frase).length > limite && atual) {
        partes.push(atual.trim());
        atual = '';
      }
      atual += frase;
      while (atual.length > limite) {
        partes.push(atual.slice(0, limite));
        atual = atual.slice(limite);
      }
    }
    if (atual.trim()) partes.push(atual.trim());
    return partes;
  }

  // ---------- Google Livros ----------

  private async volumes(o: { q: string; ordem?: 'relevance' | 'newest'; inicio?: number; max?: number }): Promise<VolumeGoogle[]> {
    const url =
      `${GOOGLE}?q=${encodeURIComponent(o.q)}&langRestrict=pt&printType=books` +
      `&orderBy=${o.ordem ?? 'relevance'}&startIndex=${o.inicio ?? 0}&maxResults=${o.max ?? 10}` +
      (CHAVE_GOOGLE ? `&key=${encodeURIComponent(CHAVE_GOOGLE)}` : '');
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

 

  private async pegar(url: string): Promise<unknown> {
    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), 9000);
    try {
      const resposta = await fetch(url, { signal: controle.signal });
      if (!resposta.ok) throw new Error(`Serviço respondeu com o código ${resposta.status}`);
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

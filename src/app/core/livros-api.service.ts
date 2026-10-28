import { Injectable } from '@angular/core';
import { ResultadoBusca } from './modelos';

// Procura livros na internet (Google Livros e, se falhar, Open Library) para trazer título, autor e capa.
// Os dois serviços são gratuitos e não pedem chave.
interface VolumeGoogle {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  };
}

interface DocOpenLibrary {
  title?: string;
  author_name?: string[];
  cover_i?: number;
}

@Injectable({ providedIn: 'root' })
export class LivrosApiService {
  async buscar(texto: string): Promise<ResultadoBusca[]> {
    const q = texto.trim();
    if (q.length < 2) return [];
    try {
      const achados = await this.googleLivros(q);
      if (achados.length > 0) return achados;
    } catch {
      // se o Google falhar, tentamos o outro
    }
    return this.openLibrary(q);
  }

  private async googleLivros(q: string): Promise<ResultadoBusca[]> {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=8&printType=books`;
    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error('Google Livros indisponível');
    const json = (await resposta.json()) as { items?: VolumeGoogle[] };
    const lista = (json.items ?? []).map((item): ResultadoBusca => {
      const v = item.volumeInfo ?? {};
      const capa = v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail ?? null;
      return {
        titulo: String(v.title ?? '').slice(0, 200),
        autor: Array.isArray(v.authors) && v.authors.length > 0 ? v.authors.join(', ').slice(0, 200) : null,
        capa_url: capa ? String(capa).replace(/^http:/, 'https:').replace('&edge=curl', '') : null,
      };
    });
    return this.semRepetidos(lista).slice(0, 6);
  }

  private async openLibrary(q: string): Promise<ResultadoBusca[]> {
    try {
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=title,author_name,cover_i`;
      const resposta = await fetch(url);
      if (!resposta.ok) return [];
      const json = (await resposta.json()) as { docs?: DocOpenLibrary[] };
      const lista = (json.docs ?? []).map((d): ResultadoBusca => ({
        titulo: String(d.title ?? '').slice(0, 200),
        autor: Array.isArray(d.author_name) && d.author_name.length > 0 ? d.author_name.slice(0, 2).join(', ').slice(0, 200) : null,
        capa_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
      }));
      return this.semRepetidos(lista).slice(0, 6);
    } catch {
      return [];
    }
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
}

import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResenhasPage } from './resenhas.page';
import { AuthService } from '../../core/auth.service';
import { NotificacoesService } from '../../core/notificacoes.service';
import { SupabaseService } from '../../core/supabase.service';

const post = (n: number, tipo = 'clube') => ({
  id: String(n), tipo, criado_em: '2026-11-19T12:00:00.123456Z',
  autor_id: 'eu', livro_id: tipo === 'clube' ? 'livro' : null,
  nota: 5, dias_leitura: null, texto: 'Minha leitura', spoiler: false,
  livro: { titulo: 'Livro', autor: 'Autora' }, quem: { id: 'eu', nome: 'Bru' },
  total_curtidas: 0, eu_curti: false, total_comentarios: 0,
});

describe('Feed geral de resenhas', () => {
  let page: any;
  let fixture: any;
  let rpc: ReturnType<typeof vi.fn>;
  let from: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    rpc = vi.fn(); from = vi.fn();
    TestBed.configureTestingModule({ providers: [
      { provide: NotificacoesService, useValue: { total: signal(0), alternar: vi.fn() } },
      { provide: AuthService, useValue: { perfil: signal({ id: 'eu' }), eAdmin: () => false } },
      { provide: SupabaseService, useValue: { cliente: { rpc, from } } },
    ] });
    fixture = TestBed.createComponent(ResenhasPage);
    page = fixture.componentInstance;
  });

  it('mistura as fontes e usa cursor completo ao carregar a próxima página', async () => {
    const primeira = Array.from({length:21}, (_,i) => post(100-i,i%2?'pessoal':'clube'));
    rpc.mockResolvedValueOnce({data:primeira,error:null});
    await page.atualizar();
    expect(page.resenhas()).toHaveLength(20);
    expect(page.temMais()).toBe(true);
    expect(new Set(page.resenhas().map((r:any)=>r.tipo)).size).toBe(2);
    rpc.mockResolvedValueOnce({data:[primeira[20]],error:null});
    await page.carregarMais();
    expect(rpc.mock.calls[1][1]).toEqual({ p_antes_data:primeira[19].criado_em,p_antes_id:primeira[19].id,p_antes_tipo:primeira[19].tipo,p_limite:21 });
    expect(page.resenhas()).toHaveLength(21);
    expect(page.temMais()).toBe(false);
  });

  it('não envia duas buscas simultâneas nem aplica página antiga depois de atualizar', async () => {
    let liberar!: (r:any)=>void;
    rpc.mockReturnValueOnce(new Promise(resolve => liberar=resolve));
    const antiga = page.carregarMais();
    await page.carregarMais(); expect(rpc).toHaveBeenCalledTimes(1);
    rpc.mockResolvedValueOnce({ data:[post(999)],error:null });
    await page.atualizar();
    liberar({data:[post(1)],error:null}); await antiga;
    expect(page.resenhas().map((r:any)=>r.id)).toEqual(['999']);
  });

  it('mantém a página e o cursor após falha para poder tentar de novo', async () => {
    rpc.mockResolvedValueOnce({data:Array.from({length:21},(_,i)=>post(100-i)),error:null});
    await page.atualizar();
    rpc.mockResolvedValueOnce({data:null,error:{message:'sem rede'}});
    await page.carregarMais();
    expect(page.resenhas()).toHaveLength(20); expect(page.erroDaLista()).toBeTruthy();
    rpc.mockResolvedValueOnce({data:[post(80)],error:null});
    await page.carregarMais();
    expect(rpc.mock.calls[2][1]).toEqual(rpc.mock.calls[1][1]);
    expect(page.resenhas()).toHaveLength(21); expect(page.erroDaLista()).toBe('');
  });

  it('separa publicações de mesmo UUID em tabelas diferentes', async () => {
    rpc.mockResolvedValueOnce({data:[post(1,'clube'),post(1,'pessoal')],error:null});
    await page.atualizar();
    expect(page.resenhas()).toHaveLength(2);
    expect(page.chave(page.resenhas()[0])).not.toBe(page.chave(page.resenhas()[1]));
  });

  it('curte na tabela certa e não aumenta o contador se o banco recusar', async () => {
    page.resenhas.set([post(1,'pessoal'),post(2,'clube')]);
    const insert=vi.fn().mockResolvedValueOnce({error:null}).mockResolvedValueOnce({error:{}});
    from.mockReturnValue({insert});
    await page.curtir('pessoal:1');
    expect(from).toHaveBeenLastCalledWith('curtidas_resenha_pessoal');
    expect(insert).toHaveBeenLastCalledWith({resenha_id:'1'});
    expect(page.euCurti('pessoal:1')).toBe(true);
    await page.curtir('clube:2');
    expect(from).toHaveBeenLastCalledWith('curtidas_resenha');
    expect(page.totalDeCurtidas('clube:2')).toBe(0);
    expect(page.errosInteracao()['clube:2']).toBeTruthy();
  });

  it('renderiza as duas fontes e protege o spoiler da amiga até ela tocar para abrir', () => {
    page.resenhas.set([post(1), {...post(2,'pessoal'),autor_id:'amiga',spoiler:true,texto:'O segredo do final'}]);
    page.temMais.set(false);
    fixture.detectChanges();
    const tela=fixture.nativeElement as HTMLElement;
    expect(tela.textContent).toContain('Livro do clube');
    expect(tela.textContent).toContain('Leitura pessoal');
    expect(tela.textContent).not.toContain('O segredo do final');
    expect(tela.textContent).toContain('Esta resenha tem spoiler');
    page.mostrarSpoiler('pessoal:2'); fixture.detectChanges();
    expect(tela.textContent).toContain('O segredo do final');
  });

  it('conclui o evento de rolagem mesmo quando a rede falha', async () => {
    rpc.mockRejectedValueOnce(new Error('offline'));
    const complete=vi.fn().mockResolvedValue(undefined);
    await page.rolarMais({target:{complete}});
    expect(complete).toHaveBeenCalledOnce();
    expect(page.carregando()).toBe(false);
  });
});

begin;

alter table public.livros_lidos
  add column if not exists status_leitura text not null default 'lido';

alter table public.livros_lidos
  drop constraint if exists livros_lidos_status_leitura_check,
  add constraint livros_lidos_status_leitura_check
    check (status_leitura in ('quero_ler', 'lendo', 'lido', 'abandonado'));

-- Mantém o histórico de contexto, inclusive quando alguém relê um livro.
drop policy if exists "ver livros lidos" on public.livros_lidos;
create policy "ver livros lidos" on public.livros_lidos
  for select to authenticated using (status_leitura = 'lido' or perfil_id = auth.uid());

drop policy if exists "alterar propria leitura" on public.livros_lidos;
create policy "alterar propria leitura" on public.livros_lidos
  for update to authenticated
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

create or replace function public.salvar_status_leitura(
  p_titulo text, p_autor text, p_capa_url text, p_ano int, p_paginas int,
  p_chave_ol text, p_status text, p_contexto text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.livros_lidos as livro
    (perfil_id, titulo, autor, capa_url, ano, paginas, chave_ol, status_leitura, contexto)
  values
    (auth.uid(), p_titulo, p_autor, p_capa_url, p_ano, p_paginas, p_chave_ol,
     p_status, coalesce(p_contexto, 'fora_do_clube'))
  on conflict (perfil_id, lower(titulo), lower(coalesce(autor, '')))
  do update set
    status_leitura = excluded.status_leitura,
    contexto = coalesce(p_contexto, livro.contexto),
    capa_url = coalesce(excluded.capa_url, livro.capa_url),
    ano = coalesce(excluded.ano, livro.ano),
    paginas = coalesce(excluded.paginas, livro.paginas),
    chave_ol = coalesce(excluded.chave_ol, livro.chave_ol);
$$;

revoke execute on function public.salvar_status_leitura(text, text, text, int, int, text, text, text)
  from public, anon;
grant execute on function public.salvar_status_leitura(text, text, text, int, int, text, text, text)
  to authenticated;

commit;

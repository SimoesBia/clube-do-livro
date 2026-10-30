-- ============================================================
-- Court of Books — Bloco 3: biblioteca, livros lidos e curtidas
-- Rode este arquivo UMA vez: Supabase > SQL Editor > New query > cole tudo > Run
-- (precisa ter rodado antes o 01, 02, 03 e 04)
-- ============================================================

-- 1) Mais informações sobre cada livro (vêm da Open Library; podem ficar vazias)
alter table public.livros add column if not exists ano int check (ano is null or ano between 0 and 2100);
alter table public.livros add column if not exists paginas int check (paginas is null or paginas between 1 and 20000);
alter table public.livros add column if not exists descricao text check (descricao is null or char_length(descricao) <= 1000);
alter table public.livros add column if not exists chave_ol text check (chave_ol is null or chave_ol ~ '^OL[0-9]+[A-Z]$');

alter table public.sugestoes add column if not exists ano int check (ano is null or ano between 0 and 2100);
alter table public.sugestoes add column if not exists paginas int check (paginas is null or paginas between 1 and 20000);
alter table public.sugestoes add column if not exists descricao text check (descricao is null or char_length(descricao) <= 1000);
alter table public.sugestoes add column if not exists chave_ol text check (chave_ol is null or chave_ol ~ '^OL[0-9]+[A-Z]$');

-- 2) Livros que cada pessoa já leu (antes do clube, no clube ou fora dele)
create table if not exists public.livros_lidos (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 200),
  autor text check (autor is null or char_length(autor) <= 200),
  capa_url text check (capa_url is null or capa_url ~ '^https://'),
  ano int check (ano is null or ano between 0 and 2100),
  paginas int check (paginas is null or paginas between 1 and 20000),
  chave_ol text check (chave_ol is null or chave_ol ~ '^OL[0-9]+[A-Z]$'),
  contexto text not null default 'fora_do_clube' check (contexto in ('antes_do_clube', 'no_clube', 'fora_do_clube')),
  criado_em timestamptz not null default now()
);

-- o mesmo livro não entra duas vezes na lista da mesma pessoa
create unique index if not exists livros_lidos_sem_repetir
  on public.livros_lidos (perfil_id, lower(titulo), lower(coalesce(autor, '')));

-- 3) Curtidas nas resenhas
create table if not exists public.curtidas_resenha (
  resenha_id uuid not null references public.resenhas (id) on delete cascade,
  perfil_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  primary key (resenha_id, perfil_id)
);

-- SEGURANÇA (RLS)
alter table public.livros_lidos enable row level security;
alter table public.curtidas_resenha enable row level security;

drop policy if exists "ver livros lidos" on public.livros_lidos;
create policy "ver livros lidos" on public.livros_lidos for select to authenticated using (true);
drop policy if exists "registrar leitura" on public.livros_lidos;
create policy "registrar leitura" on public.livros_lidos for insert to authenticated with check (perfil_id = auth.uid());
drop policy if exists "tirar leitura" on public.livros_lidos;
create policy "tirar leitura" on public.livros_lidos for delete to authenticated using (perfil_id = auth.uid());

drop policy if exists "ver curtidas" on public.curtidas_resenha;
create policy "ver curtidas" on public.curtidas_resenha for select to authenticated using (true);
drop policy if exists "curtir" on public.curtidas_resenha;
create policy "curtir" on public.curtidas_resenha for insert to authenticated with check (perfil_id = auth.uid());
drop policy if exists "descurtir" on public.curtidas_resenha;
create policy "descurtir" on public.curtidas_resenha for delete to authenticated using (perfil_id = auth.uid());

-- 4) O sorteio agora leva junto ano, páginas e descrição do livro sorteado
create or replace function public.realizar_sorteio()
returns public.sorteios
language plpgsql
security definer
set search_path = public
as $$
declare
  lista jsonb;
  total int;
  escolhido int;
  vencedora public.sugestoes;
  novo public.sorteios;
  novo_livro uuid;
begin
  if not public.eh_admin() then
    raise exception 'Só quem administra o clube pode girar a roleta.';
  end if;

  select jsonb_agg(
           jsonb_build_object('id', id, 'titulo', titulo, 'autor', autor, 'capa_url', capa_url)
           order by criado_em, id
         )
    into lista
    from public.sugestoes
   where sorteio_id is null;

  total := coalesce(jsonb_array_length(lista), 0);
  if total < 2 then
    raise exception 'Precisa de pelo menos 2 sugestões na roleta.';
  end if;

  escolhido := floor(random() * total)::int;

  select * into vencedora from public.sugestoes where id = (lista -> escolhido ->> 'id')::uuid;

  insert into public.sorteios (opcoes, indice, vencedor_titulo)
  values (lista, escolhido, vencedora.titulo)
  returning * into novo;

  update public.sugestoes set sorteio_id = novo.id where sorteio_id is null;

  insert into public.livros (titulo, autor, capa_url, ano, paginas, descricao, chave_ol, criado_por)
  values (vencedora.titulo, vencedora.autor, vencedora.capa_url, vencedora.ano, vencedora.paginas, vencedora.descricao, vencedora.chave_ol, auth.uid())
  returning id into novo_livro;

  update public.clube set livro_do_mes_id = novo_livro where id = 1;

  return novo;
end;
$$;

revoke all on function public.realizar_sorteio() from public;
grant execute on function public.realizar_sorteio() to authenticated;

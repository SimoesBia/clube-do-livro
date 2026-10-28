-- ============================================================
-- Court of Books — Bloco 2: livro do mês, roleta, encontros, resenhas e desafios
-- Rode este arquivo UMA vez: Supabase > SQL Editor > New query > cole tudo > Run
-- ============================================================

-- 1) Perfis: quem administra o clube + contadores de desafios
alter table public.perfis add column if not exists admin boolean not null default false;
alter table public.perfis add column if not exists participacoes int not null default 0;
alter table public.perfis add column if not exists vitorias int not null default 0;

-- SEGURANÇA: cada pessoa só pode editar nome, aniversário e avatar do próprio perfil.
-- (Sem isso, alguém poderia se dar "admin" ou vitórias pela internet.)
revoke update on public.perfis from authenticated;
grant update (nome, aniversario, avatar_id) on public.perfis to authenticated;

-- Função que diz se quem está logado administra o clube
create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select admin from public.perfis where id = auth.uid()), false)
$$;

-- 2) Livros e configurações do clube (livro do mês, data do sorteio, link do Meet)
create table if not exists public.livros (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 200),
  autor text check (autor is null or char_length(autor) <= 200),
  capa_url text check (capa_url is null or capa_url ~ '^https://'),
  criado_por uuid default auth.uid() references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);

create table if not exists public.clube (
  id int primary key default 1 check (id = 1),
  livro_do_mes_id uuid references public.livros (id) on delete set null,
  data_sorteio date,
  link_meet text check (link_meet is null or link_meet ~ '^https://')
);
insert into public.clube (id) values (1) on conflict do nothing;

-- 3) Roleta: sorteios e sugestões
create table if not exists public.sorteios (
  id uuid primary key default gen_random_uuid(),
  realizado_em timestamptz not null default now(),
  opcoes jsonb not null,            -- foto da roleta na hora do sorteio
  indice int not null,              -- posição do livro vencedor (começa em 0)
  vencedor_titulo text not null
);

create table if not exists public.sugestoes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 200),
  autor text check (autor is null or char_length(autor) <= 200),
  capa_url text check (capa_url is null or capa_url ~ '^https://'),
  sugerido_por uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  sorteio_id uuid references public.sorteios (id) on delete set null  -- vazio = ainda está na roleta
);

-- 4) Encontros: dias livres e recadinhos
create table if not exists public.disponibilidade (
  perfil_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  dia date not null,
  primary key (perfil_id, dia)
);

create table if not exists public.recados_encontro (
  perfil_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  mes date not null check (extract(day from mes) = 1),
  texto text not null check (char_length(texto) between 1 and 500),
  atualizado_em timestamptz not null default now(),
  primary key (perfil_id, mes)
);

-- 5) Resenhas e comentários
create table if not exists public.resenhas (
  id uuid primary key default gen_random_uuid(),
  livro_id uuid not null references public.livros (id) on delete cascade,
  autor_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  nota smallint not null check (nota between 1 and 5),
  dias_leitura int check (dias_leitura is null or dias_leitura between 0 and 3650),
  texto text not null check (char_length(texto) between 1 and 5000),
  spoiler boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (livro_id, autor_id)
);

create table if not exists public.comentarios (
  id uuid primary key default gen_random_uuid(),
  resenha_id uuid not null references public.resenhas (id) on delete cascade,
  autor_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 1000),
  criado_em timestamptz not null default now()
);

-- ============================================================
-- SEGURANÇA (RLS): por padrão ninguém mexe em nada; as regras abaixo liberam só o necessário
-- ============================================================
alter table public.livros enable row level security;
alter table public.clube enable row level security;
alter table public.sorteios enable row level security;
alter table public.sugestoes enable row level security;
alter table public.disponibilidade enable row level security;
alter table public.recados_encontro enable row level security;
alter table public.resenhas enable row level security;
alter table public.comentarios enable row level security;

-- Livros e clube: todo mundo vê; só quem administra altera
drop policy if exists "ver livros" on public.livros;
create policy "ver livros" on public.livros for select to authenticated using (true);
drop policy if exists "admin cria livros" on public.livros;
create policy "admin cria livros" on public.livros for insert to authenticated with check (public.eh_admin());

drop policy if exists "ver clube" on public.clube;
create policy "ver clube" on public.clube for select to authenticated using (true);
drop policy if exists "admin altera clube" on public.clube;
create policy "admin altera clube" on public.clube for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- Sorteios: todo mundo vê; quem cria é só a função realizar_sorteio() lá embaixo
drop policy if exists "ver sorteios" on public.sorteios;
create policy "ver sorteios" on public.sorteios for select to authenticated using (true);

-- Sugestões: todo mundo vê; cada pessoa pode ter 1 livro por vez na roleta e tirar o seu
drop policy if exists "ver sugestoes" on public.sugestoes;
create policy "ver sugestoes" on public.sugestoes for select to authenticated using (true);
drop policy if exists "sugerir livro" on public.sugestoes;
create policy "sugerir livro" on public.sugestoes for insert to authenticated
  with check (
    sugerido_por = auth.uid()
    and sorteio_id is null
    and (select count(*) from public.sugestoes s where s.sugerido_por = auth.uid() and s.sorteio_id is null) < 1
  );
drop policy if exists "tirar sugestao" on public.sugestoes;
create policy "tirar sugestao" on public.sugestoes for delete to authenticated
  using ((sugerido_por = auth.uid() and sorteio_id is null) or public.eh_admin());

-- Dias livres: todo mundo vê; cada pessoa mexe nos seus
drop policy if exists "ver disponibilidade" on public.disponibilidade;
create policy "ver disponibilidade" on public.disponibilidade for select to authenticated using (true);
drop policy if exists "marcar dia livre" on public.disponibilidade;
create policy "marcar dia livre" on public.disponibilidade for insert to authenticated with check (perfil_id = auth.uid());
drop policy if exists "desmarcar dia livre" on public.disponibilidade;
create policy "desmarcar dia livre" on public.disponibilidade for delete to authenticated using (perfil_id = auth.uid());

-- Recadinhos: todo mundo vê; cada pessoa mexe nos seus
drop policy if exists "ver recados" on public.recados_encontro;
create policy "ver recados" on public.recados_encontro for select to authenticated using (true);
drop policy if exists "escrever recado" on public.recados_encontro;
create policy "escrever recado" on public.recados_encontro for insert to authenticated with check (perfil_id = auth.uid());
drop policy if exists "editar recado" on public.recados_encontro;
create policy "editar recado" on public.recados_encontro for update to authenticated using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());
drop policy if exists "apagar recado" on public.recados_encontro;
create policy "apagar recado" on public.recados_encontro for delete to authenticated using (perfil_id = auth.uid());

-- Resenhas e comentários: todo mundo vê; cada pessoa mexe nos seus
drop policy if exists "ver resenhas" on public.resenhas;
create policy "ver resenhas" on public.resenhas for select to authenticated using (true);
drop policy if exists "escrever resenha" on public.resenhas;
create policy "escrever resenha" on public.resenhas for insert to authenticated with check (autor_id = auth.uid());
drop policy if exists "editar resenha" on public.resenhas;
create policy "editar resenha" on public.resenhas for update to authenticated using (autor_id = auth.uid()) with check (autor_id = auth.uid());
drop policy if exists "apagar resenha" on public.resenhas;
create policy "apagar resenha" on public.resenhas for delete to authenticated using (autor_id = auth.uid());

drop policy if exists "ver comentarios" on public.comentarios;
create policy "ver comentarios" on public.comentarios for select to authenticated using (true);
drop policy if exists "comentar" on public.comentarios;
create policy "comentar" on public.comentarios for insert to authenticated with check (autor_id = auth.uid());
drop policy if exists "apagar comentario" on public.comentarios;
create policy "apagar comentario" on public.comentarios for delete to authenticated using (autor_id = auth.uid() or public.eh_admin());

-- ============================================================
-- O SORTEIO (feito pelo servidor, para o resultado ser igual para todo mundo)
-- ============================================================
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

  insert into public.sorteios (opcoes, indice, vencedor_titulo)
  values (lista, escolhido, lista -> escolhido ->> 'titulo')
  returning * into novo;

  update public.sugestoes set sorteio_id = novo.id where sorteio_id is null;

  insert into public.livros (titulo, autor, capa_url, criado_por)
  values (lista -> escolhido ->> 'titulo', lista -> escolhido ->> 'autor', lista -> escolhido ->> 'capa_url', auth.uid())
  returning id into novo_livro;

  update public.clube set livro_do_mes_id = novo_livro where id = 1;

  return novo;
end;
$$;

revoke all on function public.realizar_sorteio() from public;
grant execute on function public.realizar_sorteio() to authenticated;

-- ============================================================
-- AO VIVO: faz o sorteio aparecer na hora para todo mundo que estiver com o app aberto
-- ============================================================
do $$
begin
  begin alter publication supabase_realtime add table public.sorteios; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.sugestoes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.clube; exception when duplicate_object then null; end;
end $$;

-- ============================================================
-- PASSO FINAL (faça você mesma): se tornar administradora do clube.
-- Troque pelo e-mail com o qual você criou sua conta e rode só esta linha:
--
--   update public.perfis set admin = true
--    where id = (select id from auth.users where email = 'COLOQUE_SEU_EMAIL_AQUI');
-- ============================================================

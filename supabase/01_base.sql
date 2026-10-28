-- ============================================================
-- Court of Books — Bloco 1: cadastro de membros
-- Rode este arquivo UMA vez: Supabase > SQL Editor > New query > cole tudo > Run
-- ============================================================

-- 1) Tabela de perfis: uma linha para cada pessoa do clube
create table if not exists public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  aniversario date,
  avatar jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

-- 2) Segurança (RLS): por padrão, ninguém mexe em nada. As regras abaixo liberam só o necessário.
alter table public.perfis enable row level security;

-- Quem está logado pode ver os perfis dos outros membros (nome, avatar e aniversário)
drop policy if exists "membros veem perfis" on public.perfis;
create policy "membros veem perfis"
  on public.perfis for select
  to authenticated
  using (true);

-- Cada pessoa só pode editar o PRÓPRIO perfil
drop policy if exists "cada pessoa edita o proprio perfil" on public.perfis;
create policy "cada pessoa edita o proprio perfil"
  on public.perfis for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 3) Gatilho: quando alguém cria a conta, o perfil é criado sozinho com os dados do cadastro
create or replace function public.criar_perfil_do_novo_membro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, nome, aniversario, avatar)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), 'Membro'),
    nullif(new.raw_user_meta_data ->> 'aniversario', '')::date,
    coalesce(new.raw_user_meta_data -> 'avatar', '{}'::jsonb)
  );
  return new;
end;
$$;

drop trigger if exists ao_criar_membro on auth.users;
create trigger ao_criar_membro
  after insert on auth.users
  for each row execute function public.criar_perfil_do_novo_membro();

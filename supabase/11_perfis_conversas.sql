begin;

-- As quatro listas são visíveis às integrantes autenticadas.
drop policy if exists "ver livros lidos" on public.livros_lidos;
create policy "ver livros lidos" on public.livros_lidos
for select to authenticated using (true);

create table if not exists public.resenhas_pessoais (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null default auth.uid() references public.perfis(id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 200),
  autor text check (autor is null or char_length(autor) <= 200),
  capa_url text check (capa_url is null or capa_url ~ '^https://'),
  nota int not null check (nota between 1 and 5),
  texto text not null check (char_length(texto) between 1 and 5000),
  spoiler boolean not null default false,
  criado_em timestamptz not null default now()
);
create unique index if not exists resenha_pessoal_por_livro
on public.resenhas_pessoais(perfil_id, lower(titulo), lower(coalesce(autor, '')));
alter table public.resenhas_pessoais enable row level security;
drop policy if exists "ler resenhas pessoais" on public.resenhas_pessoais;
create policy "ler resenhas pessoais" on public.resenhas_pessoais for select to authenticated using (true);
drop policy if exists "criar resenha pessoal" on public.resenhas_pessoais;
create policy "criar resenha pessoal" on public.resenhas_pessoais for insert to authenticated with check (perfil_id = auth.uid());
drop policy if exists "editar resenha pessoal" on public.resenhas_pessoais;
create policy "editar resenha pessoal" on public.resenhas_pessoais for update to authenticated using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());
drop policy if exists "apagar resenha pessoal" on public.resenhas_pessoais;
create policy "apagar resenha pessoal" on public.resenhas_pessoais for delete to authenticated using (perfil_id = auth.uid());
grant select, insert, delete on public.resenhas_pessoais to authenticated;
revoke update on public.resenhas_pessoais from authenticated;
grant update(nota, texto, spoiler) on public.resenhas_pessoais to authenticated;

create table if not exists public.mensagens_privadas (
  id uuid primary key default gen_random_uuid(),
  remetente_id uuid not null default auth.uid() references public.perfis(id) on delete cascade,
  destinatario_id uuid not null references public.perfis(id) on delete cascade,
  texto text not null check (char_length(trim(texto)) between 1 and 2000),
  criado_em timestamptz not null default now(),
  check (remetente_id <> destinatario_id)
);
create index if not exists mensagens_remetente on public.mensagens_privadas(remetente_id, criado_em desc);
create index if not exists mensagens_destinatario on public.mensagens_privadas(destinatario_id, criado_em desc);
alter table public.mensagens_privadas enable row level security;
drop policy if exists "ler minha conversa" on public.mensagens_privadas;
create policy "ler minha conversa" on public.mensagens_privadas for select to authenticated
using (remetente_id = auth.uid() or destinatario_id = auth.uid());
drop policy if exists "enviar minha mensagem" on public.mensagens_privadas;
create policy "enviar minha mensagem" on public.mensagens_privadas for insert to authenticated
with check (remetente_id = auth.uid());
grant select on public.mensagens_privadas to authenticated;
revoke insert on public.mensagens_privadas from authenticated;
grant insert(destinatario_id, texto) on public.mensagens_privadas to authenticated;
revoke update, delete on public.mensagens_privadas from authenticated, anon;

-- Campos opcionais preservam os encontros que já têm apenas link.
alter table public.clube add column if not exists encontro_em timestamptz;
alter table public.clube add column if not exists encontro_versao bigint not null default 0;
alter table public.perfis add column if not exists receber_emails boolean not null default true;
grant update(receber_emails) on public.perfis to authenticated;

-- Interesses dos últimos 90 dias no clube, sem filtrar por um gênero.
create or replace function public.livros_populares_clube(p_inicio int default 0,p_limite int default 20)
returns table(titulo text,autor text,capa_url text,ano int,paginas int,chave_ol text)
language sql stable security invoker set search_path='' as $$
  select min(l.titulo),min(l.autor),max(l.capa_url),max(l.ano),max(l.paginas),max(l.chave_ol)
  from public.livros_lidos l
  where l.criado_em >= now()-interval '90 days'
  group by lower(l.titulo),lower(coalesce(l.autor,''))
  order by sum(case l.status_leitura when 'lendo' then 3 when 'quero_ler' then 2 else 1 end) desc,
    max(l.criado_em) desc,lower(l.titulo),lower(coalesce(l.autor,''))
  offset greatest(p_inicio,0) limit least(greatest(p_limite,1),40);
$$;
revoke execute on function public.livros_populares_clube(int,int) from public,anon;
grant execute on function public.livros_populares_clube(int,int) to authenticated;

commit;

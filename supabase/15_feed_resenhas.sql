-- Feed geral. Execute este arquivo no SQL Editor antes de publicar o novo src.
-- Não move nem apaga resenhas, curtidas ou comentários existentes.
begin;

create table if not exists public.curtidas_resenha_pessoal (
  resenha_id uuid not null references public.resenhas_pessoais(id) on delete cascade,
  perfil_id uuid not null default auth.uid() references public.perfis(id) on delete cascade,
  primary key(resenha_id, perfil_id)
);
create table if not exists public.comentarios_resenha_pessoal (
  id uuid primary key default gen_random_uuid(),
  resenha_id uuid not null references public.resenhas_pessoais(id) on delete cascade,
  autor_id uuid not null default auth.uid() references public.perfis(id) on delete cascade,
  texto text not null check(char_length(trim(texto)) between 1 and 1000),
  criado_em timestamptz not null default now()
);
alter table public.curtidas_resenha_pessoal enable row level security;
alter table public.comentarios_resenha_pessoal enable row level security;

drop policy if exists "ler curtidas pessoais" on public.curtidas_resenha_pessoal;
create policy "ler curtidas pessoais" on public.curtidas_resenha_pessoal for select to authenticated using(true);
drop policy if exists "curtir resenha pessoal" on public.curtidas_resenha_pessoal;
create policy "curtir resenha pessoal" on public.curtidas_resenha_pessoal for insert to authenticated with check(perfil_id=auth.uid());
drop policy if exists "descurtir resenha pessoal" on public.curtidas_resenha_pessoal;
create policy "descurtir resenha pessoal" on public.curtidas_resenha_pessoal for delete to authenticated using(perfil_id=auth.uid());

drop policy if exists "ler comentarios pessoais" on public.comentarios_resenha_pessoal;
create policy "ler comentarios pessoais" on public.comentarios_resenha_pessoal for select to authenticated using(true);
drop policy if exists "comentar resenha pessoal" on public.comentarios_resenha_pessoal;
create policy "comentar resenha pessoal" on public.comentarios_resenha_pessoal for insert to authenticated with check(autor_id=auth.uid());
drop policy if exists "apagar comentario pessoal" on public.comentarios_resenha_pessoal;
create policy "apagar comentario pessoal" on public.comentarios_resenha_pessoal for delete to authenticated using(autor_id=auth.uid() or public.eh_admin());

revoke all on public.curtidas_resenha_pessoal, public.comentarios_resenha_pessoal from anon, authenticated;
grant select, delete on public.curtidas_resenha_pessoal, public.comentarios_resenha_pessoal to authenticated;
grant insert(resenha_id) on public.curtidas_resenha_pessoal to authenticated;
grant insert(resenha_id, texto) on public.comentarios_resenha_pessoal to authenticated;

create index if not exists resenhas_feed_ordem on public.resenhas(criado_em desc, id desc);
create index if not exists pessoais_feed_ordem on public.resenhas_pessoais(criado_em desc, id desc);
create index if not exists comentarios_pessoais_resenha on public.comentarios_resenha_pessoal(resenha_id, criado_em, id);
create index if not exists comentarios_clube_resenha on public.comentarios(resenha_id, criado_em, id);

-- Cursor estável: publicações novas não deslocam as páginas que já estão sendo lidas.
-- SECURITY INVOKER conserva as permissões e o RLS de cada tabela.
create or replace function public.feed_resenhas(
  p_antes_data timestamptz default null,
  p_antes_id uuid default null,
  p_antes_tipo text default null,
  p_limite int default 21
)
returns table(
  id uuid, tipo text, livro_id uuid, autor_id uuid, nota int, dias_leitura int,
  texto text, spoiler boolean, criado_em timestamptz, livro jsonb, quem jsonb,
  total_curtidas bigint, eu_curti boolean, total_comentarios bigint
)
language sql stable security invoker set search_path='' as $$
  with publicacoes as (
    select r.id, 'clube'::text as tipo, r.livro_id, r.autor_id, r.nota::int,
      r.dias_leitura, r.texto, r.spoiler, r.criado_em,
      jsonb_build_object('id',l.id,'titulo',l.titulo,'autor',l.autor,'capa_url',l.capa_url) as livro
    from public.resenhas r join public.livros l on l.id=r.livro_id
    where p_antes_data is null or (r.criado_em,r.id,'clube'::text)<(p_antes_data,p_antes_id,p_antes_tipo)
    union all
    select r.id,'pessoal'::text,null::uuid,r.perfil_id,r.nota,null::int,
      r.texto,r.spoiler,r.criado_em,
      jsonb_build_object('id',null,'titulo',r.titulo,'autor',r.autor,'capa_url',r.capa_url)
    from public.resenhas_pessoais r
    where p_antes_data is null or (r.criado_em,r.id,'pessoal'::text)<(p_antes_data,p_antes_id,p_antes_tipo)
  ), pagina as (
    select r.* from publicacoes r
    order by r.criado_em desc,r.id desc,r.tipo desc
    limit least(greatest(coalesce(p_limite,21),1),41)
  )
  select r.*,jsonb_build_object('id',p.id,'nome',p.nome,'avatar_id',p.avatar_id,
    'participacoes',p.participacoes,'vitorias',p.vitorias) as quem,
    case r.tipo when 'clube' then (select count(*) from public.curtidas_resenha c where c.resenha_id=r.id)
      else (select count(*) from public.curtidas_resenha_pessoal c where c.resenha_id=r.id) end,
    case r.tipo when 'clube' then exists(select 1 from public.curtidas_resenha c where c.resenha_id=r.id and c.perfil_id=auth.uid())
      else exists(select 1 from public.curtidas_resenha_pessoal c where c.resenha_id=r.id and c.perfil_id=auth.uid()) end,
    case r.tipo when 'clube' then (select count(*) from public.comentarios c where c.resenha_id=r.id)
      else (select count(*) from public.comentarios_resenha_pessoal c where c.resenha_id=r.id) end
  from pagina r join public.perfis p on p.id=r.autor_id
  order by r.criado_em desc,r.id desc,r.tipo desc;
$$;
revoke all on function public.feed_resenhas(timestamptz,uuid,text,int) from public,anon;
grant execute on function public.feed_resenhas(timestamptz,uuid,text,int) to authenticated;
commit;

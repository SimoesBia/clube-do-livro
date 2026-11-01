-- ============================================================
-- Court of Books — Bloco 4: desafios de leitura
-- Rode este arquivo UMA vez: Supabase > SQL Editor > New query > cole tudo > Run
-- (precisa ter rodado antes os arquivos 01 a 05)
-- ============================================================

-- 1) Tabelas
create table if not exists public.desafios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 80),
  descricao text check (descricao is null or char_length(descricao) <= 500),
  unidade text not null check (unidade in ('livros', 'paginas', 'minutos')),
  meta int not null check (meta between 1 and 100000),
  inicio date not null default current_date,
  fim date,
  criado_por uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  status text not null default 'ativo' check (status in ('ativo', 'encerrado', 'cancelado')),
  criado_em timestamptz not null default now(),
  encerrado_em timestamptz
);

create table if not exists public.desafio_participantes (
  desafio_id uuid not null references public.desafios (id) on delete cascade,
  perfil_id uuid not null references public.perfis (id) on delete cascade,
  status text not null default 'convidado' check (status in ('convidado', 'aceito', 'recusado')),
  progresso int not null default 0 check (progresso between 0 and 100000),
  posicao int check (posicao between 1 and 3),
  convidado_por uuid default auth.uid() references public.perfis (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  primary key (desafio_id, perfil_id)
);

create table if not exists public.desafio_mensagens (
  id uuid primary key default gen_random_uuid(),
  desafio_id uuid not null references public.desafios (id) on delete cascade,
  autor_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 500),
  criado_em timestamptz not null default now()
);

-- 2) Funções ajudantes (rodam "por dentro", para as regras de segurança não entrarem em loop)
create or replace function public.criou_desafio(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.desafios where id = p_id and criado_por = auth.uid())
$$;

create or replace function public.participa_do_desafio(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.desafio_participantes where desafio_id = p_id and perfil_id = auth.uid())
$$;

create or replace function public.participa_aceito(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.desafio_participantes where desafio_id = p_id and perfil_id = auth.uid() and status = 'aceito')
$$;

-- 3) SEGURANÇA (RLS)
alter table public.desafios enable row level security;
alter table public.desafio_participantes enable row level security;
alter table public.desafio_mensagens enable row level security;

-- Desafios: só aparecem para quem criou, quem foi convidado e quem administra
drop policy if exists "ver desafios" on public.desafios;
create policy "ver desafios" on public.desafios for select to authenticated
  using (criado_por = auth.uid() or public.participa_do_desafio(id) or public.eh_admin());
drop policy if exists "criar desafio" on public.desafios;
create policy "criar desafio" on public.desafios for insert to authenticated
  with check (criado_por = auth.uid());
-- (ninguém altera um desafio direto: encerrar é pela função lá embaixo)

-- Participantes: quem criou convida; cada pessoa responde ao próprio convite e atualiza o próprio progresso
drop policy if exists "ver participantes" on public.desafio_participantes;
create policy "ver participantes" on public.desafio_participantes for select to authenticated
  using (public.participa_do_desafio(desafio_id) or public.criou_desafio(desafio_id) or public.eh_admin());
drop policy if exists "convidar" on public.desafio_participantes;
create policy "convidar" on public.desafio_participantes for insert to authenticated
  with check (public.criou_desafio(desafio_id) and (status = 'convidado' or perfil_id = auth.uid()));
drop policy if exists "responder e andar" on public.desafio_participantes;
create policy "responder e andar" on public.desafio_participantes for update to authenticated
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());
drop policy if exists "tirar convite" on public.desafio_participantes;
create policy "tirar convite" on public.desafio_participantes for delete to authenticated
  using (public.criou_desafio(desafio_id) and perfil_id <> auth.uid() and status <> 'aceito');

-- A pessoa só pode mexer nestas colunas (não consegue se dar posição de pódio, por exemplo)
revoke update on public.desafio_participantes from authenticated;
grant update (status, progresso, atualizado_em) on public.desafio_participantes to authenticated;

-- Chat do desafio: só quem está participando lê e escreve
drop policy if exists "ver mensagens" on public.desafio_mensagens;
create policy "ver mensagens" on public.desafio_mensagens for select to authenticated
  using (public.participa_aceito(desafio_id) or public.criou_desafio(desafio_id) or public.eh_admin());
drop policy if exists "escrever mensagem" on public.desafio_mensagens;
create policy "escrever mensagem" on public.desafio_mensagens for insert to authenticated
  with check (autor_id = auth.uid() and (public.participa_aceito(desafio_id) or public.criou_desafio(desafio_id)));
drop policy if exists "apagar mensagem" on public.desafio_mensagens;
create policy "apagar mensagem" on public.desafio_mensagens for delete to authenticated
  using (autor_id = auth.uid() or public.eh_admin());

-- 4) Não deixa mexer no progresso de um desafio que já terminou
create or replace function public.tg_bloqueia_progresso_encerrado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.progresso <> old.progresso
     and (select status from public.desafios where id = new.desafio_id) <> 'ativo' then
    raise exception 'Esse desafio já terminou.';
  end if;
  return new;
end;
$$;

drop trigger if exists bloqueia_progresso_encerrado on public.desafio_participantes;
create trigger bloqueia_progresso_encerrado
  before update on public.desafio_participantes
  for each row execute function public.tg_bloqueia_progresso_encerrado();

-- 5) Contadores: quantos desafios cada pessoa disputou e quantos ganhou (aro e troféu do avatar)
create or replace function public.recalcular_contadores(p_perfil uuid)
returns void language sql security definer set search_path = public as $$
  update public.perfis p set
    participacoes = (
      select count(*) from public.desafio_participantes dp
        join public.desafios d on d.id = dp.desafio_id
       where dp.perfil_id = p.id and dp.status = 'aceito' and d.status <> 'cancelado'),
    vitorias = (
      select count(*) from public.desafio_participantes dp
        join public.desafios d on d.id = dp.desafio_id
       where dp.perfil_id = p.id and dp.status = 'aceito' and d.status = 'encerrado' and dp.posicao = 1)
   where p.id = p_perfil;
$$;

create or replace function public.tg_contadores_participante()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalcular_contadores(old.perfil_id);
    return old;
  end if;
  perform public.recalcular_contadores(new.perfil_id);
  return new;
end;
$$;

drop trigger if exists contadores_participante on public.desafio_participantes;
create trigger contadores_participante
  after insert or update or delete on public.desafio_participantes
  for each row execute function public.tg_contadores_participante();

create or replace function public.tg_contadores_desafio()
returns trigger language plpgsql security definer set search_path = public as $$
declare alvo uuid;
begin
  for alvo in select perfil_id from public.desafio_participantes where desafio_id = new.id loop
    perform public.recalcular_contadores(alvo);
  end loop;
  return new;
end;
$$;

drop trigger if exists contadores_desafio on public.desafios;
create trigger contadores_desafio
  after update of status on public.desafios
  for each row execute function public.tg_contadores_desafio();

-- 6) Encerrar o desafio (quem criou ou quem administra).
--    Regras: precisa de pelo menos 2 pessoas participando e alguém com progresso, senão o desafio é cancelado (sem troféu).
--    Pódio: 1º a 3º lugar; empate divide a posição (as duas pessoas ganham). O troféu é de quem fica em 1º.
create or replace function public.encerrar_desafio(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.desafios;
  aceitos int;
  maior int;
begin
  select * into d from public.desafios where id = p_id;
  if not found then
    raise exception 'Desafio não encontrado.';
  end if;
  if d.criado_por <> auth.uid() and not public.eh_admin() then
    raise exception 'Só quem criou o desafio pode encerrar.';
  end if;
  if d.status <> 'ativo' then
    raise exception 'Esse desafio já foi encerrado.';
  end if;

  select count(*), coalesce(max(progresso), 0) into aceitos, maior
    from public.desafio_participantes where desafio_id = p_id and status = 'aceito';

  if aceitos < 2 or maior <= 0 then
    update public.desafios set status = 'cancelado', encerrado_em = now() where id = p_id;
    return 'cancelado';
  end if;

  update public.desafio_participantes dp
     set posicao = r.pos
    from (
      select perfil_id, rank() over (order by progresso desc) as pos
        from public.desafio_participantes
       where desafio_id = p_id and status = 'aceito' and progresso > 0
    ) r
   where dp.desafio_id = p_id and dp.perfil_id = r.perfil_id and r.pos <= 3;

  update public.desafios set status = 'encerrado', encerrado_em = now() where id = p_id;
  return 'encerrado';
end;
$$;

revoke all on function public.encerrar_desafio(uuid) from public;
grant execute on function public.encerrar_desafio(uuid) to authenticated;

-- 7) AO VIVO: convites, corrida e chat aparecem na hora
do $$
begin
  begin alter publication supabase_realtime add table public.desafio_participantes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.desafio_mensagens; exception when duplicate_object then null; end;
end $$;

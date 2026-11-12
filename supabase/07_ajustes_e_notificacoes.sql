-- ============================================================
-- Court of Books — Bloco 5: ferramentas de limpeza e notificações
-- Rode este arquivo UMA vez: Supabase > SQL Editor > New query > cole tudo > Run
-- (precisa ter rodado antes os arquivos 01 a 06)
-- ============================================================

-- 1) Quem administra pode apagar livros da estante (as resenhas desse livro vão junto)
drop policy if exists "admin apaga livros" on public.livros;
create policy "admin apaga livros" on public.livros for delete to authenticated using (public.eh_admin());

-- 2) Zerar a roleta (só quem administra)
--    p_tudo = false: tira só as sugestões que ainda estão na roleta
--    p_tudo = true : tira também as sugestões e os resultados dos sorteios antigos
create or replace function public.resetar_roleta(p_tudo boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.eh_admin() then
    raise exception 'Só quem administra o clube pode zerar a roleta.';
  end if;
  if p_tudo then
    delete from public.sugestoes;
    delete from public.sorteios;
  else
    delete from public.sugestoes where sorteio_id is null;
  end if;
end;
$$;

revoke all on function public.resetar_roleta(boolean) from public;
grant execute on function public.resetar_roleta(boolean) to authenticated;

-- 3) Notificações (aparecem no sininho do app)
create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis (id) on delete cascade,
  tipo text not null check (tipo in ('convite', 'sorteio', 'livro_do_mes', 'desafio_encerrado', 'comentario', 'curtida')),
  texto text not null check (char_length(texto) <= 300),
  rota text check (rota is null or rota ~ '^/app/[a-z]+$'),
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);

create index if not exists notificacoes_por_pessoa on public.notificacoes (perfil_id, criado_em desc);

alter table public.notificacoes enable row level security;

drop policy if exists "ver minhas notificacoes" on public.notificacoes;
create policy "ver minhas notificacoes" on public.notificacoes for select to authenticated using (perfil_id = auth.uid());
drop policy if exists "marcar como lida" on public.notificacoes;
create policy "marcar como lida" on public.notificacoes for update to authenticated
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());
drop policy if exists "apagar minhas notificacoes" on public.notificacoes;
create policy "apagar minhas notificacoes" on public.notificacoes for delete to authenticated using (perfil_id = auth.uid());
-- (ninguém cria notificação direto: elas nascem dos gatilhos abaixo)

revoke update on public.notificacoes from authenticated;
grant update (lida) on public.notificacoes to authenticated;

-- 3a) Convite para um desafio
create or replace function public.tg_notifica_convite()
returns trigger language plpgsql security definer set search_path = public as $$
declare quem text; titulo text;
begin
  if new.status = 'convidado' then
    select nome into quem from public.perfis where id = new.convidado_por;
    select d.titulo into titulo from public.desafios d where d.id = new.desafio_id;
    insert into public.notificacoes (perfil_id, tipo, texto, rota)
    values (new.perfil_id, 'convite',
            coalesce(quem, 'Alguém') || ' convidou você para o desafio "' || coalesce(titulo, '') || '"',
            '/app/desafios');
  end if;
  return new;
end;
$$;
drop trigger if exists notifica_convite on public.desafio_participantes;
create trigger notifica_convite after insert on public.desafio_participantes
  for each row execute function public.tg_notifica_convite();

-- 3b) A roleta girou: todo mundo fica sabendo
create or replace function public.tg_notifica_sorteio()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notificacoes (perfil_id, tipo, texto, rota)
  select id, 'sorteio', 'A roleta girou! O livro sorteado foi "' || new.vencedor_titulo || '" 🎉', '/app/inicio'
    from public.perfis;
  return new;
end;
$$;
drop trigger if exists notifica_sorteio on public.sorteios;
create trigger notifica_sorteio after insert on public.sorteios
  for each row execute function public.tg_notifica_sorteio();

-- 3c) Livro do mês escolhido à mão (o sorteio já avisa por conta própria)
create or replace function public.tg_notifica_livro_do_mes()
returns trigger language plpgsql security definer set search_path = public as $$
declare titulo text;
begin
  if new.livro_do_mes_id is not null
     and new.livro_do_mes_id is distinct from old.livro_do_mes_id
     and not exists (select 1 from public.sorteios where realizado_em > now() - interval '15 seconds') then
    select l.titulo into titulo from public.livros l where l.id = new.livro_do_mes_id;
    insert into public.notificacoes (perfil_id, tipo, texto, rota)
    select id, 'livro_do_mes', 'Novo livro do mês: "' || coalesce(titulo, '') || '" 📖', '/app/inicio' from public.perfis;
  end if;
  return new;
end;
$$;
drop trigger if exists notifica_livro_do_mes on public.clube;
create trigger notifica_livro_do_mes after update of livro_do_mes_id on public.clube
  for each row execute function public.tg_notifica_livro_do_mes();

-- 3d) Desafio encerrado ou cancelado
create or replace function public.tg_notifica_desafio_encerrado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> old.status and new.status in ('encerrado', 'cancelado') then
    insert into public.notificacoes (perfil_id, tipo, texto, rota)
    select dp.perfil_id, 'desafio_encerrado',
           case when new.status = 'encerrado'
                then 'O desafio "' || new.titulo || '" terminou! Veja o pódio 🏆'
                else 'O desafio "' || new.titulo || '" foi cancelado.' end,
           '/app/desafios'
      from public.desafio_participantes dp
     where dp.desafio_id = new.id and dp.status = 'aceito';
  end if;
  return new;
end;
$$;
drop trigger if exists notifica_desafio_encerrado on public.desafios;
create trigger notifica_desafio_encerrado after update of status on public.desafios
  for each row execute function public.tg_notifica_desafio_encerrado();

-- 3e) Comentário na sua resenha
create or replace function public.tg_notifica_comentario()
returns trigger language plpgsql security definer set search_path = public as $$
declare dona uuid; livro text; quem text;
begin
  select r.autor_id, l.titulo into dona, livro
    from public.resenhas r join public.livros l on l.id = r.livro_id
   where r.id = new.resenha_id;
  if dona is not null and dona <> new.autor_id then
    select nome into quem from public.perfis where id = new.autor_id;
    insert into public.notificacoes (perfil_id, tipo, texto, rota)
    values (dona, 'comentario', coalesce(quem, 'Alguém') || ' comentou na sua resenha de "' || coalesce(livro, '') || '" 💬', '/app/resenhas');
  end if;
  return new;
end;
$$;
drop trigger if exists notifica_comentario on public.comentarios;
create trigger notifica_comentario after insert on public.comentarios
  for each row execute function public.tg_notifica_comentario();

-- 3f) Curtida na sua resenha
create or replace function public.tg_notifica_curtida()
returns trigger language plpgsql security definer set search_path = public as $$
declare dona uuid; livro text; quem text;
begin
  select r.autor_id, l.titulo into dona, livro
    from public.resenhas r join public.livros l on l.id = r.livro_id
   where r.id = new.resenha_id;
  if dona is not null and dona <> new.perfil_id then
    select nome into quem from public.perfis where id = new.perfil_id;
    insert into public.notificacoes (perfil_id, tipo, texto, rota)
    values (dona, 'curtida', coalesce(quem, 'Alguém') || ' curtiu sua resenha de "' || coalesce(livro, '') || '" ♥', '/app/resenhas');
  end if;
  return new;
end;
$$;
drop trigger if exists notifica_curtida on public.curtidas_resenha;
create trigger notifica_curtida after insert on public.curtidas_resenha
  for each row execute function public.tg_notifica_curtida();

-- 4) AO VIVO: o sininho atualiza na hora
do $$
begin
  begin alter publication supabase_realtime add table public.notificacoes; exception when duplicate_object then null; end;
end $$;

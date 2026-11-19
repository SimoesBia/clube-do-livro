begin;

create table if not exists public.config_emails (
  id int primary key default 1 check(id = 1),
  ativo boolean not null default false
);
insert into public.config_emails(id) values(1) on conflict do nothing;
alter table public.config_emails enable row level security;
revoke all on public.config_emails from anon, authenticated;

create table if not exists public.fila_emails (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  chave text unique not null,
  assunto text not null,
  texto text not null,
  rota text not null,
  encontro_versao bigint,
  enviar_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  estado text not null default 'pendente' check(estado in ('pendente','processando','enviado','cancelado','falhou')),
  tentativas int not null default 0,
  reserva uuid,
  reservado_em timestamptz,
  enviado_em timestamptz,
  ultimo_erro text
);
alter table public.fila_emails enable row level security;
revoke all on public.fila_emails from anon, authenticated;
grant all on public.fila_emails, public.config_emails to service_role;
create index if not exists emails_pendentes on public.fila_emails(estado,enviar_em);

alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes add constraint notificacoes_tipo_check
  check(tipo in ('convite','sorteio','livro_do_mes','desafio_encerrado','comentario','curtida','encontro'));

create or replace function public.tg_email_notificacao()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.tipo in ('convite','sorteio','livro_do_mes')
     and exists(select 1 from public.config_emails where id=1 and ativo) then
    insert into public.fila_emails(perfil_id,chave,assunto,texto,rota)
      values(new.perfil_id,'notificacao:'||new.id,
        case new.tipo when 'convite' then 'Você recebeu um convite de desafio'
          when 'sorteio' then 'Saiu o livro da roleta!' else 'Novo livro do mês' end,
        new.texto,coalesce(new.rota,'/app/inicio'))
      on conflict(chave) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists email_notificacao on public.notificacoes;
create trigger email_notificacao after insert on public.notificacoes
for each row execute function public.tg_email_notificacao();

create or replace function public.tg_encontro_versao()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.encontro_em is distinct from old.encontro_em or new.link_meet is distinct from old.link_meet then
    new.encontro_versao = old.encontro_versao + 1;
  end if;
  return new;
end;
$$;
drop trigger if exists encontro_versao on public.clube;
create trigger encontro_versao before update of encontro_em,link_meet on public.clube
for each row execute function public.tg_encontro_versao();

create or replace function public.tg_avisar_encontro()
returns trigger language plpgsql security definer set search_path = '' as $$
declare texto_aviso text; horario_lembrete timestamptz;
begin
  if new.encontro_versao = old.encontro_versao then return new; end if;
  update public.fila_emails set estado='cancelado'
    where encontro_versao is not null and estado in ('pendente','processando');
  if new.encontro_em is null or new.encontro_em <= now() or new.link_meet is null then return new; end if;
  texto_aviso = 'Encontro do Court of Books em ' ||
    to_char(new.encontro_em at time zone 'America/Recife','DD/MM/YYYY "às" HH24:MI') ||
    ' (horário de Recife). Link: ' || new.link_meet;
  insert into public.notificacoes(perfil_id,tipo,texto,rota)
    select id,'encontro',left(texto_aviso,300),'/app/encontros' from public.perfis;
  if not exists(select 1 from public.config_emails where id=1 and ativo) then return new; end if;
  insert into public.fila_emails(perfil_id,chave,assunto,texto,rota,encontro_versao)
    select id,'encontro:'||new.encontro_versao||':'||id,
      case when old.encontro_em is null then 'Encontro marcado' else 'Encontro atualizado' end,
      texto_aviso,'/app/encontros',new.encontro_versao from public.perfis
    on conflict(chave) do nothing;
  horario_lembrete = least(
    ((new.encontro_em at time zone 'America/Recife')::date + time '09:00') at time zone 'America/Recife',
    new.encontro_em - interval '1 hour'
  );
  if horario_lembrete > now() then
    insert into public.fila_emails(perfil_id,chave,assunto,texto,rota,encontro_versao,enviar_em)
      select id,'lembrete:'||new.encontro_versao||':'||id,'Nosso encontro é hoje!',
        texto_aviso,'/app/encontros',new.encontro_versao,horario_lembrete from public.perfis
      on conflict(chave) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists avisar_encontro on public.clube;
create trigger avisar_encontro after update of encontro_em,link_meet on public.clube
for each row execute function public.tg_avisar_encontro();

-- Só a função do servidor pode reservar e finalizar os envios.
create or replace function public.reservar_emails()
returns table(id uuid, destinatario text, assunto text, texto text, rota text, reserva uuid)
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.config_emails where ativo) then return; end if;
  update public.fila_emails f set estado='cancelado' where f.estado in ('pendente','processando')
    and (not exists(select 1 from public.perfis p where p.id=f.perfil_id and p.receber_emails)
      or (f.encontro_versao is not null and not exists(
        select 1 from public.clube c where c.encontro_versao=f.encontro_versao and c.encontro_em > now())));
  update public.fila_emails f set estado='falhou',ultimo_erro='Prazo ou tentativas de envio esgotados'
    where f.estado in ('pendente','processando')
      and (f.tentativas >= 8 or now() > greatest(f.criado_em,f.enviar_em) + interval '23 hours');
  return query
    with proximos as (
      select f.id from public.fila_emails f
      where (f.estado='pendente' or (f.estado='processando' and f.reservado_em < now()-interval '10 minutes'))
        and f.enviar_em <= now()
        and (f.reservado_em is null or f.reservado_em < now()-interval '2 minutes')
      order by f.enviar_em
      limit 10 for update skip locked
    ), reservados as (
      update public.fila_emails f set estado='processando',tentativas=f.tentativas+1,
        reserva=gen_random_uuid(),reservado_em=now()
      from proximos where f.id=proximos.id returning f.*
    )
    select f.id,u.email::text,f.assunto,f.texto,f.rota,f.reserva
    from reservados f join auth.users u on u.id=f.perfil_id;
end;
$$;

create or replace function public.finalizar_email(p_id uuid,p_reserva uuid,p_sucesso boolean,p_erro text default null)
returns void language sql security definer set search_path = '' as $$
  update public.fila_emails set
    estado=case when p_sucesso then 'enviado' else 'pendente' end,
    enviado_em=case when p_sucesso then now() else null end,
    ultimo_erro=left(p_erro,300)
  where id=p_id and reserva=p_reserva and estado='processando';
$$;
revoke execute on function public.reservar_emails() from public,anon,authenticated;
revoke execute on function public.finalizar_email(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.reservar_emails(), public.finalizar_email(uuid,uuid,boolean,text) to service_role;
commit;

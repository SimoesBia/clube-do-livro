-- Execute apenas depois do teste da Edge Function e da configuração do agendamento.
update public.config_emails set ativo=true where id=1;

-- Garante um lembrete futuro para um encontro já marcado antes da ativação.
insert into public.fila_emails(perfil_id,chave,assunto,texto,rota,encontro_versao,enviar_em)
select p.id,'lembrete:'||c.encontro_versao||':'||p.id,'Nosso encontro é hoje!',
  'Encontro do Court of Books em '||to_char(c.encontro_em at time zone 'America/Recife','DD/MM/YYYY "às" HH24:MI')||
  ' (horário de Recife). Link: '||c.link_meet,
  '/app/encontros',c.encontro_versao,
  least(((c.encontro_em at time zone 'America/Recife')::date+time '09:00') at time zone 'America/Recife',
    c.encontro_em-interval '1 hour')
from public.clube c cross join public.perfis p
where c.encontro_em > now() and c.link_meet is not null
  and least(((c.encontro_em at time zone 'America/Recife')::date+time '09:00') at time zone 'America/Recife',
    c.encontro_em-interval '1 hour') > now()
on conflict(chave) do nothing;

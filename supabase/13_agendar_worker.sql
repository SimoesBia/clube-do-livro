-- Antes, ative pg_cron, pg_net e Vault no Dashboard (Database → Extensions).
-- Substitua APENAS os dois valores abaixo, usando a URL do Supabase e
-- o mesmo EMAIL_WORKER_SECRET guardado em Edge Functions → Secrets.
do $$
declare
  url_projeto text := 'https://thfwwizqraofsusfoege.supabase.co';
  segredo_worker text := 'CEaC7D+KqG2Y6mFWPVnfzCUmk5VRSKfip1+61m4guT/0=';
  segredo_id uuid;
begin
  if url_projeto not like 'https://%.supabase.co' or length(segredo_worker) < 32
    or segredo_worker = 'COLE_EMAIL_WORKER_SECRET' then
    raise exception 'Preencha a URL do projeto e o segredo de no mínimo 32 caracteres.';
  end if;
  select id into segredo_id from vault.secrets where name='court_project_url' limit 1;
  if segredo_id is null then perform vault.create_secret(url_projeto,'court_project_url');
  else perform vault.update_secret(segredo_id,url_projeto); end if;
  select id into segredo_id from vault.secrets where name='court_worker_secret' limit 1;
  if segredo_id is null then perform vault.create_secret(segredo_worker,'court_worker_secret');
  else perform vault.update_secret(segredo_id,segredo_worker); end if;
end $$;

create or replace function public.disparar_emails_clube()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.config_emails where id=1 and ativo) then return; end if;
  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='court_project_url' limit 1) || '/functions/v1/avisos-clube',
    headers := jsonb_build_object('Content-Type','application/json','x-worker-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='court_worker_secret' limit 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;
revoke execute on function public.disparar_emails_clube() from public, anon, authenticated, service_role;
do $$
begin
  if exists(select 1 from cron.job where jobname='court-enviar-emails') then
    perform cron.unschedule('court-enviar-emails');
  end if;
end $$;
select cron.schedule('court-enviar-emails','* * * * *','select public.disparar_emails_clube()');

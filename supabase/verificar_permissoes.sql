-- Consultas de leitura. O resultado mostra a configuração efetivamente ativa.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

select
  has_column_privilege('authenticated', 'public.perfis', 'admin', 'UPDATE')
    as membro_pode_alterar_admin,
  has_function_privilege('authenticated', 'public.recalcular_contadores(uuid)', 'EXECUTE')
    as membro_pode_chamar_contadores;

begin;

-- Os gatilhos que recalculam os contadores continuam chamando a função
-- com as permissões de seu proprietário.
revoke execute on function public.recalcular_contadores(uuid)
  from public, anon, authenticated;

commit;

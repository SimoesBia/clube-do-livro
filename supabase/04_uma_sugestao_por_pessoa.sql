-- ============================================================
-- Court of Books — ajuste: cada pessoa pode ter só 1 livro na roleta
-- Rode este arquivo UMA vez: Supabase > SQL Editor > New query > cole tudo > Run
-- (Para mudar o limite no futuro, troque o número 1 abaixo.)
-- ============================================================
drop policy if exists "sugerir livro" on public.sugestoes;
create policy "sugerir livro" on public.sugestoes for insert to authenticated
  with check (
    sugerido_por = auth.uid()
    and sorteio_id is null
    and (select count(*) from public.sugestoes s where s.sugerido_por = auth.uid() and s.sorteio_id is null) < 1
  );

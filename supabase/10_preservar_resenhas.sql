begin;
alter table public.livros add column if not exists arquivado boolean not null default false;
alter table public.resenhas drop constraint if exists resenhas_livro_id_fkey;
alter table public.resenhas add constraint resenhas_livro_id_fkey
  foreign key (livro_id) references public.livros(id) on delete restrict;
create or replace function public.arquivar_livro_clube(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.eh_admin() then raise exception 'Somente a administração pode arquivar livros.' using errcode = '42501'; end if;
  update public.clube set livro_do_mes_id = null where livro_do_mes_id = p_id;
  update public.livros set arquivado = true where id = p_id;
end;
$$;
revoke execute on function public.arquivar_livro_clube(uuid) from public, anon;
grant execute on function public.arquivar_livro_clube(uuid) to authenticated;
commit;

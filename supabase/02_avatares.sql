-- ============================================================
-- Court of Books — Bloco 1.5: avatares prontos (bonecas)
-- Rode este arquivo UMA vez: Supabase > SQL Editor > New query > cole tudo > Run
-- ============================================================

-- 1) Guarda qual boneca a pessoa escolheu (ex.: boneca_07). A coluna "avatar" antiga fica sem uso.
alter table public.perfis add column if not exists avatar_id text;

-- Só aceita o formato certo (boneca_ + dois números) ou vazio
alter table public.perfis drop constraint if exists perfis_avatar_id_formato;
alter table public.perfis add constraint perfis_avatar_id_formato
  check (avatar_id is null or avatar_id ~ '^boneca_[0-9]{2}$');

-- 2) O gatilho de cadastro agora grava a boneca escolhida
create or replace function public.criar_perfil_do_novo_membro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  escolhida text := nullif(new.raw_user_meta_data ->> 'avatar_id', '');
begin
  insert into public.perfis (id, nome, aniversario, avatar_id)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), 'Membro'),
    nullif(new.raw_user_meta_data ->> 'aniversario', '')::date,
    case when escolhida ~ '^boneca_[0-9]{2}$' then escolhida else null end
  );
  return new;
end;
$$;

-- Doações pelo Mercado Pago (Checkout Pro): cada clique em "Doar com Mercado Pago" cria uma linha aqui
-- (o id vai como external_reference da preferência). O webhook confirma o pagamento no Mercado Pago e chama
-- registrar_apoio_mp, que lança o apoio na Aliança Z (tabela donations).
create table if not exists public.mp_pagamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,   -- quem estava logado (Discord) ao doar
  nome text,                                                   -- nome digitado sem login (vai para o mural)
  anonimo boolean not null default false,                      -- anônimo: registra, mas não entra no mural
  valor numeric(10,2) not null check (valor >= 5 and valor <= 5000),
  status text not null default 'criado',                       -- criado | aprovado | status do Mercado Pago
  mp_payment_id text unique,
  preference_id text,
  created_at timestamptz not null default now(),
  aprovado_em timestamptz
);
-- Sem políticas: só o service role (as Edge Functions) lê e grava.
alter table public.mp_pagamentos enable row level security;
revoke all on public.mp_pagamentos from anon, authenticated;

-- Lança um pagamento aprovado na Aliança Z, uma única vez por external_reference.
create or replace function public.registrar_apoio_mp(p_ref uuid, p_payment_id text, p_valor numeric)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.mp_pagamentos;
  d_id uuid;
  nome_mural text;
begin
  update public.mp_pagamentos
     set status = 'aprovado', mp_payment_id = p_payment_id, aprovado_em = now()
   where id = p_ref and status <> 'aprovado'
  returning * into r;
  if not found then
    return 'ja_registrado_ou_inexistente';
  end if;
  if r.anonimo then
    return 'anonimo';
  end if;

  lock table public.donations in share row exclusive mode;   -- número do mural sem repetir

  if r.user_id is not null then
    select id into d_id from public.donations where user_id = r.user_id order by created_at limit 1;
    if d_id is not null then
      update public.donations set amount = amount + p_valor, active = true where id = d_id;
      return 'somado';
    end if;
    select nullif(btrim(nickname), '') into nome_mural from public.profiles where id = r.user_id;
    if nome_mural is null then
      select coalesce(nullif(raw_user_meta_data->'custom_claims'->>'global_name', ''),
                      nullif(raw_user_meta_data->>'full_name', ''),
                      nullif(raw_user_meta_data->>'name', ''), 'Apoiador')
        into nome_mural from auth.users where id = r.user_id;
    end if;
  else
    nome_mural := nullif(btrim(r.nome), '');
    if nome_mural is null then
      return 'sem_nome';
    end if;
  end if;

  insert into public.donations (number, name, amount, user_id)
  values ((select coalesce(max(number), 0) + 1 from public.donations), left(nome_mural, 40), p_valor, r.user_id);
  return 'novo';
end;
$$;

revoke all on function public.registrar_apoio_mp(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.registrar_apoio_mp(uuid, text, numeric) to service_role;

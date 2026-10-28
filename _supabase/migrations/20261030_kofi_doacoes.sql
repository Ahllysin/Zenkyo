-- Doações internacionais pelo Ko-fi (site em inglês, /en/). Substitui a tentativa do PayPal direto (precisava de CNPJ).
-- Reaproveita a tabela mp_pagamentos e a função registrar_apoio_mp, igual ao Mercado Pago:
--   valor            continua em REAIS (dólar x taxa fixa), para a patente e o mural valerem igual nos dois idiomas;
--   valor_original   o que a pessoa pagou de fato, em dólar;
--   moeda            USD;
--   mp_payment_id    guarda o kofi_transaction_id (único por doação) — impede lançar a mesma doação duas vezes.
-- Quem doa cola na mensagem do Ko-fi o código do site (ZK- + os 8 primeiros caracteres do id do perfil); a função abaixo acha o perfil
-- por esse código e soma no apoiador dele (a patente sobe sozinha). Sem código, entra no mural pelo nome digitado no Ko-fi.
-- Pode ser aplicada mesmo se as migrações do Stripe/PayPal não foram: cria o que faltar e limpa o que sobrou do PayPal.
alter table public.mp_pagamentos
  add column if not exists provedor text not null default 'mercadopago',
  add column if not exists moeda text not null default 'BRL',
  add column if not exists valor_original numeric(10,2);

drop index if exists public.mp_pagamentos_paypal_order_uq;
alter table public.mp_pagamentos drop column if exists paypal_order_id;

alter table public.mp_pagamentos drop constraint if exists mp_pagamentos_provedor_chk;
alter table public.mp_pagamentos add constraint mp_pagamentos_provedor_chk check (provedor in ('mercadopago', 'stripe', 'kofi'));

-- Uma doação do Ko-fi só entra uma vez, mesmo que o Ko-fi reenvie o aviso.
create unique index if not exists mp_pagamentos_kofi_txn_uq on public.mp_pagamentos (mp_payment_id) where provedor = 'kofi';

-- Lança uma doação do Ko-fi (já confirmada pelo token do webhook) na Aliança Z. Devolve o texto de registrar_apoio_mp
-- ('novo', 'somado', 'anonimo', 'sem_nome'...) ou 'ja_registrado'.
create or replace function public.registrar_apoio_kofi(
  p_txn text, p_nome text, p_anonimo boolean, p_codigo text, p_valor numeric, p_valor_original numeric, p_moeda text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  n integer;
  ref uuid;
begin
  if coalesce(btrim(p_txn), '') = '' then
    return 'sem_transacao';
  end if;

  -- O código do site (8 caracteres hexadecimais) acha o perfil. Se der mais de um perfil, não liga a ninguém.
  if p_codigo ~* '^[0-9a-f]{8}$' then
    select count(*), (array_agg(id))[1] into n, uid
      from auth.users where replace(id::text, '-', '') like lower(p_codigo) || '%';
    if n <> 1 then
      uid := null;
    end if;
  end if;

  insert into public.mp_pagamentos (user_id, nome, anonimo, valor, valor_original, moeda, provedor, status, mp_payment_id)
  values (
    uid,
    case when uid is null and not p_anonimo then left(nullif(btrim(p_nome), ''), 40) end,
    p_anonimo, p_valor, p_valor_original, coalesce(p_moeda, 'USD'), 'kofi', 'criado', p_txn
  )
  on conflict (mp_payment_id) where provedor = 'kofi' do nothing
  returning id into ref;

  if ref is null then
    return 'ja_registrado';
  end if;
  return public.registrar_apoio_mp(ref, p_txn, p_valor);
end;
$$;

revoke all on function public.registrar_apoio_kofi(text, text, boolean, text, numeric, numeric, text) from public, anon, authenticated;
grant execute on function public.registrar_apoio_kofi(text, text, boolean, text, numeric, numeric, text) to service_role;

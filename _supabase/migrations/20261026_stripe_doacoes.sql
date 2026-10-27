-- Doações internacionais pelo Stripe Checkout (site em inglês, /en/).
-- Reaproveita a tabela mp_pagamentos e as funções registrar_apoio_mp / ajustar_devolucao_mp:
--   valor            continua em REAIS (equivalente pela taxa fixa), para a patente e o mural valerem igual nos dois idiomas;
--   valor_original   o que a pessoa pagou de fato, na moeda dela (hoje sempre dólar);
--   mp_payment_id    guarda o PaymentIntent do Stripe (pi_...) quando o provedor é o Stripe — é o que liga reembolso/disputa à doação.
-- Só acrescenta colunas com valor padrão: as doações do Mercado Pago não mudam.
alter table public.mp_pagamentos
  add column if not exists provedor text not null default 'mercadopago',
  add column if not exists moeda text not null default 'BRL',
  add column if not exists valor_original numeric(10,2),
  add column if not exists stripe_session_id text;

create unique index if not exists mp_pagamentos_stripe_session_uq on public.mp_pagamentos (stripe_session_id) where stripe_session_id is not null;

alter table public.mp_pagamentos drop constraint if exists mp_pagamentos_provedor_chk;
alter table public.mp_pagamentos add constraint mp_pagamentos_provedor_chk check (provedor in ('mercadopago', 'stripe'));

-- Doações internacionais pelo PayPal (site em inglês, /en/). Segue o mesmo desenho do Stripe (20261026):
--   valor            continua em REAIS (equivalente pela taxa fixa), para a patente e o mural valerem igual nos dois idiomas;
--   valor_original   o que a pessoa pagou de fato, em dólar;
--   paypal_order_id  o pedido (Order) do PayPal criado em paypal-checkout; liga a volta do pagamento à doação;
--   mp_payment_id    guarda o id da captura do PayPal quando o provedor é o PayPal — é o que liga reembolso/estorno à doação.
-- Só acrescenta coluna e aceita um valor novo em provedor: as doações do Mercado Pago e do Stripe não mudam.
alter table public.mp_pagamentos
  add column if not exists paypal_order_id text;

create unique index if not exists mp_pagamentos_paypal_order_uq on public.mp_pagamentos (paypal_order_id) where paypal_order_id is not null;

alter table public.mp_pagamentos drop constraint if exists mp_pagamentos_provedor_chk;
alter table public.mp_pagamentos add constraint mp_pagamentos_provedor_chk check (provedor in ('mercadopago', 'stripe', 'paypal'));

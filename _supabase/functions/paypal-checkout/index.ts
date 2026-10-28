// Zenkyo — cria o pedido (Order) do PayPal para uma doação internacional (site em inglês) e devolve o link de aprovação.
// Chamada pela aba Doar de /en/ (supabase.functions.invoke('paypal-checkout', { body: { valor, nome, anonimo } })), valor em US$.
// Segredos (Painel do Supabase → Edge Functions → Secrets): PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET e, opcionais,
// PAYPAL_ENV ("sandbox" para testar; qualquer outro valor = de verdade), SITE_URL_EN e USD_BRL.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm do próprio Supabase.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGENS = [
  "https://ahllysin.github.io",
  "https://zenkyo.com.br",
  "https://www.zenkyo.com.br",
  "http://localhost:8765",
  "http://127.0.0.1:8765",
  "http://localhost:8766",
];
const VALOR_MIN = 1;      // US$ (= R$ 5 na taxa padrão, o mínimo do banco)
const VALOR_MAX = 1000;   // US$ (= R$ 5.000)
const LIMITE_10MIN = 40;  // trava simples contra cliques em massa (pedidos criados nos últimos 10 min)

const SITE_URL_EN = (Deno.env.get("SITE_URL_EN") || "https://zenkyo.com.br/en/").trim().replace(/\/?$/, "/");
// Taxa fixa USD→BRL. Precisa ser a mesma do site (KZ_USD_BRL em js/i18n.js) para o total mostrado bater com o registrado.
const USD_BRL = Number(Deno.env.get("USD_BRL") || "5");
const API = (Deno.env.get("PAYPAL_ENV") || "").trim().toLowerCase() === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

function headersFor(origin: string) {
  return {
    "Access-Control-Allow-Origin": ORIGENS.includes(origin) ? origin : ORIGENS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
}

async function tokenPayPal(id: string, segredo: string): Promise<string> {
  const r = await fetch(`${API}/v1/oauth2/token`, {
    method: "POST",
    headers: { "Authorization": "Basic " + btoa(`${id}:${segredo}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const j = await r.json();
  if (!r.ok || typeof j?.access_token !== "string") throw new Error(`PayPal oauth ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token;
}

Deno.serve(async (req: Request) => {
  const h = headersFor(req.headers.get("origin") ?? "");
  const responder = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: h });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return responder(405, { erro: "Use POST." });

  const clientId = Deno.env.get("PAYPAL_CLIENT_ID"), clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  if (!clientId || !clientSecret) return responder(503, { erro: "PayPal donations have not been set up yet." });
  if (!Number.isFinite(USD_BRL) || USD_BRL <= 0) { console.error("paypal-checkout: USD_BRL inválido"); return responder(500, { erro: "Donations are unavailable right now." }); }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return responder(400, { erro: "Invalid request." }); }

  const usd = Math.round(Number(body.valor) * 100) / 100;
  if (!Number.isFinite(usd) || usd < VALOR_MIN || usd > VALOR_MAX) {
    return responder(400, { erro: `Choose an amount between $${VALOR_MIN} and $${VALOR_MAX}.` });
  }
  const valorBRL = Math.round(usd * USD_BRL * 100) / 100;   // o que entra no mural/patente
  const anonimo = body.anonimo === true;
  const nome = typeof body.nome === "string" ? body.nome.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 40) : "";

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Quem está logado vem do token de sessão do Supabase; nunca de um id enviado pelo navegador.
  let userId: string | null = null;
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (jwt.split(".").length === 3) {
    const { data } = await admin.auth.getUser(jwt);
    userId = data?.user?.id ?? null;
  }

  const desde = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await admin.from("mp_pagamentos").select("id", { count: "exact", head: true }).gte("created_at", desde);
  if ((count ?? 0) >= LIMITE_10MIN) return responder(429, { erro: "Too many requests right now. Please try again in a few minutes." });

  const { data: reg, error } = await admin
    .from("mp_pagamentos")
    .insert({
      user_id: userId, nome: !userId && !anonimo && nome ? nome : null, anonimo,
      valor: valorBRL, provedor: "paypal", moeda: "USD", valor_original: usd, metodo: "paypal_checkout",
    })
    .select("id")
    .single();
  if (error || !reg) {
    console.error("paypal-checkout: falha ao registrar", error);
    return responder(500, { erro: "I could not start the donation right now. Please try again." });
  }

  try {
    const token = await tokenPayPal(clientId, clientSecret);
    const r = await fetch(`${API}/v2/checkout/orders`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": reg.id },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: reg.id, custom_id: reg.id,
          description: "Support Zenkyo — donation to keep the site online",
          amount: { currency_code: "USD", value: usd.toFixed(2) },
        }],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "Zenkyo", user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING",
              return_url: `${SITE_URL_EN}?doacao=aprovada`,
              cancel_url: `${SITE_URL_EN}?doacao=recusada`,
            },
          },
        },
      }),
    });
    const pedido = await r.json();
    const link = (pedido?.links ?? []).find((l: Record<string, string>) => l.rel === "payer-action" || l.rel === "approve")?.href;
    if (!r.ok || typeof link !== "string" || typeof pedido?.id !== "string") throw new Error(`PayPal ${r.status}: ${JSON.stringify(pedido).slice(0, 300)}`);
    await admin.from("mp_pagamentos").update({ paypal_order_id: pedido.id }).eq("id", reg.id);
    return responder(200, { url: link });
  } catch (e) {
    console.error("paypal-checkout: falha ao criar o pedido", e);
    await admin.from("mp_pagamentos").update({ status: "erro" }).eq("id", reg.id);
    return responder(502, { erro: "PayPal did not respond. Please try again in a moment." });
  }
});

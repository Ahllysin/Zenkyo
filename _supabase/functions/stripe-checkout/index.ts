// Zenkyo — cria a sessão do Stripe Checkout para uma doação internacional (site em inglês) e devolve o link de pagamento.
// Chamada pela aba Doar de /en/ (supabase.functions.invoke('stripe-checkout', { body: { valor, nome, anonimo } })), valor em US$.
// Segredos (Painel do Supabase → Edge Functions → Secrets): STRIPE_SECRET_KEY e, opcionais, SITE_URL_EN e USD_BRL.
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

Deno.serve(async (req: Request) => {
  const h = headersFor(req.headers.get("origin") ?? "");
  const responder = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: h });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return responder(405, { erro: "Use POST." });

  const chave = Deno.env.get("STRIPE_SECRET_KEY");
  if (!chave) return responder(503, { erro: "Stripe donations have not been set up yet." });
  if (!Number.isFinite(USD_BRL) || USD_BRL <= 0) { console.error("stripe-checkout: USD_BRL inválido"); return responder(500, { erro: "Donations are unavailable right now." }); }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return responder(400, { erro: "Invalid request." }); }

  const usd = Math.round(Number(body.valor) * 100) / 100;
  if (!Number.isFinite(usd) || usd < VALOR_MIN || usd > VALOR_MAX) {
    return responder(400, { erro: `Choose an amount between $${VALOR_MIN} and $${VALOR_MAX}.` });
  }
  const centavos = Math.round(usd * 100);
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
      valor: valorBRL, provedor: "stripe", moeda: "USD", valor_original: usd, metodo: "stripe_checkout",
    })
    .select("id")
    .single();
  if (error || !reg) {
    console.error("stripe-checkout: falha ao registrar", error);
    return responder(500, { erro: "I could not start the donation right now. Please try again." });
  }

  try {
    const p = new URLSearchParams();
    p.set("mode", "payment");
    p.set("client_reference_id", reg.id);
    p.set("metadata[ref]", reg.id);
    p.set("payment_intent_data[metadata][ref]", reg.id);
    p.set("line_items[0][quantity]", "1");
    p.set("line_items[0][price_data][currency]", "usd");
    p.set("line_items[0][price_data][unit_amount]", String(centavos));
    p.set("line_items[0][price_data][product_data][name]", "Support Zenkyo");
    p.set("line_items[0][price_data][product_data][description]", "Donation to keep the site online");
    p.set("success_url", `${SITE_URL_EN}?doacao=aprovada`);
    p.set("cancel_url", `${SITE_URL_EN}?doacao=recusada`);
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${chave}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": reg.id,
      },
      body: p,
    });
    const sessao = await r.json();
    if (!r.ok || typeof sessao?.url !== "string") throw new Error(`Stripe ${r.status}: ${JSON.stringify(sessao?.error ?? sessao).slice(0, 300)}`);
    await admin.from("mp_pagamentos").update({ stripe_session_id: sessao.id }).eq("id", reg.id);
    return responder(200, { url: sessao.url });
  } catch (e) {
    console.error("stripe-checkout: falha ao criar a sessão", e);
    await admin.from("mp_pagamentos").update({ status: "erro" }).eq("id", reg.id);
    return responder(502, { erro: "Stripe did not respond. Please try again in a moment." });
  }
});

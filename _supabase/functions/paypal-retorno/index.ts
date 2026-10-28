// Zenkyo — fecha a doação pelo PayPal quando a pessoa volta ao site: captura o pedido aprovado e lança o apoio na Aliança Z.
// Chamada pela aba Doar de /en/ ao voltar do PayPal (?doacao=aprovada&token=<pedido>): body { pedido }.
// NÃO confia no que o navegador diz: só captura um pedido que o paypal-checkout criou, e o valor e a moeda
// capturados têm que bater com o registrado. O paypal-webhook faz o mesmo caminho como reserva (e cuida de reembolsos).
// Segredos: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET e, opcional, PAYPAL_ENV ("sandbox" para testar).
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

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return responder(400, { erro: "Invalid request." }); }
  const pedido = String(body.pedido ?? "").trim();
  if (!/^[A-Za-z0-9]{10,40}$/.test(pedido)) return responder(400, { erro: "Invalid order." });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: reg } = await db.from("mp_pagamentos").select("id, valor, valor_original, moeda, status, provedor").eq("paypal_order_id", pedido).eq("provedor", "paypal").maybeSingle();
  if (!reg) return responder(404, { erro: "Order not found." });
  if (reg.status === "aprovado") return responder(200, { status: "approved" });

  try {
    const token = await tokenPayPal(clientId, clientSecret);
    const aut = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
    let r = await fetch(`${API}/v2/checkout/orders/${pedido}/capture`, { method: "POST", headers: { ...aut, "PayPal-Request-Id": `cap-${reg.id}` }, body: "{}" });
    let ordem = await r.json();
    if (!r.ok) {
      // Já capturado (volta repetida, webhook na frente): lê o pedido em vez de capturar de novo.
      const jaCapturado = r.status === 422 && JSON.stringify(ordem).includes("ORDER_ALREADY_CAPTURED");
      if (!jaCapturado) throw new Error(`PayPal captura ${r.status}: ${JSON.stringify(ordem).slice(0, 300)}`);
      r = await fetch(`${API}/v2/checkout/orders/${pedido}`, { headers: aut });
      ordem = await r.json();
      if (!r.ok) throw new Error(`PayPal leitura ${r.status}`);
    }
    const captura = ordem?.purchase_units?.[0]?.payments?.captures?.[0];
    if (!captura?.id) return responder(200, { status: "pending" });
    if (captura.status === "PENDING") return responder(200, { status: "pending" });
    if (captura.status !== "COMPLETED") return responder(200, { status: "rejected" });
    // Nunca confia só na volta: o valor e a moeda capturados têm que bater com o que foi pedido.
    if (captura.amount?.currency_code !== "USD" || Math.round(Number(captura.amount?.value) * 100) !== Math.round(Number(reg.valor_original) * 100)) {
      console.error(`paypal-retorno: valor capturado (${captura.amount?.value} ${captura.amount?.currency_code}) diferente do pedido (${reg.valor_original} USD) em ${reg.id}`);
      return responder(200, { status: "rejected" });
    }
    const { data, error } = await db.rpc("registrar_apoio_mp", { p_ref: reg.id, p_payment_id: String(captura.id), p_valor: Number(reg.valor) });
    if (error) throw new Error("falha ao registrar o apoio: " + error.message);
    console.log(`paypal-retorno: pedido ${pedido} capturado → ${data}`);
    return responder(200, { status: "approved" });
  } catch (e) {
    console.error("paypal-retorno:", e);
    return responder(502, { erro: "Could not confirm the payment right now." });
  }
});

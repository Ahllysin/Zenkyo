// Zenkyo — recebe os avisos (webhooks) do PayPal, confere a assinatura com o próprio PayPal e acompanha a doação:
//   PAYMENT.CAPTURE.COMPLETED                 → registrar_apoio_mp (reserva, caso a pessoa não volte ao site)
//   PAYMENT.CAPTURE.REFUNDED                  → ajustar_devolucao_mp (reembolso total ou parcial)
//   PAYMENT.CAPTURE.REVERSED                  → ajustar_devolucao_mp como estorno (contestação)
// Segredos: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID (id do webhook no painel do PayPal) e, opcional, PAYPAL_ENV.
// Publicada sem verificação de JWT: quem chama é o PayPal; a autenticação é a assinatura conferida em /verify-webhook-signature.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const API = (Deno.env.get("PAYPAL_ENV") || "").trim().toLowerCase() === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function tokenPayPal(id: string, segredo: string): Promise<string> {
  const r = await fetch(`${API}/v1/oauth2/token`, {
    method: "POST",
    headers: { "Authorization": "Basic " + btoa(`${id}:${segredo}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const j = await r.json();
  if (!r.ok || typeof j?.access_token !== "string") throw new Error(`PayPal oauth ${r.status}`);
  return j.access_token;
}

async function achaPorCaptura(db: ReturnType<typeof admin>, captura: string) {
  const { data } = await db.from("mp_pagamentos").select("id, valor, valor_original, moeda").eq("mp_payment_id", captura).eq("provedor", "paypal").maybeSingle();
  return data;
}

// Captura concluída: caminho de reserva. O pedido vem em supplementary_data; a doação é achada por custom_id (= id do registro).
async function concluida(captura: Record<string, any>) {
  const ref = String(captura.custom_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(ref)) { console.log("paypal-webhook: captura sem referência do Zenkyo"); return; }
  if (captura.status !== "COMPLETED") { console.log(`paypal-webhook: captura ${captura.id} ainda ${captura.status}`); return; }
  const db = admin();
  const { data: reg } = await db.from("mp_pagamentos").select("id, valor, valor_original, provedor").eq("id", ref).maybeSingle();
  if (!reg || reg.provedor !== "paypal") { console.error(`paypal-webhook: referência ${ref} não é uma doação do PayPal`); return; }
  if (captura.amount?.currency_code !== "USD" || Math.round(Number(captura.amount?.value) * 100) !== Math.round(Number(reg.valor_original) * 100)) {
    console.error(`paypal-webhook: valor pago (${captura.amount?.value} ${captura.amount?.currency_code}) diferente do pedido (${reg.valor_original} USD) em ${ref}`);
    return;
  }
  const { data, error } = await db.rpc("registrar_apoio_mp", { p_ref: ref, p_payment_id: String(captura.id), p_valor: Number(reg.valor) });
  if (error) throw new Error("falha ao registrar o apoio: " + error.message);
  console.log(`paypal-webhook: captura ${captura.id} → ${data}`);
}

async function devolvido(recurso: Record<string, any>, estorno: boolean, token: string) {
  // O reembolso aponta para a captura original pelo link "up"; o estorno (REVERSED) já é a própria captura.
  let capturaId = String(recurso.id ?? "");
  let totalOriginal = 0;
  const up = (recurso.links ?? []).find((l: Record<string, string>) => l.rel === "up")?.href;
  if (!estorno && typeof up === "string" && up.startsWith(API + "/v2/payments/captures/")) {
    capturaId = up.split("/").pop() ?? "";
    const r = await fetch(up, { headers: { "Authorization": `Bearer ${token}` } });
    if (r.ok) totalOriginal = Number((await r.json())?.amount?.value) || 0;
  }
  const db = admin();
  const reg = await achaPorCaptura(db, capturaId);
  if (!reg) { console.log(`paypal-webhook: ${capturaId} não é uma doação do Zenkyo`); return; }
  const original = totalOriginal || Number(reg.valor_original) || 1;
  const parte = estorno ? 1 : Math.min(Number(recurso.amount?.value ?? 0) / original, 1);
  const valorBRL = Math.round(Number(reg.valor) * parte * 100) / 100;
  const { data, error } = await db.rpc("ajustar_devolucao_mp", { p_ref: reg.id, p_devolvido: valorBRL, p_estornado: estorno });
  if (error) throw new Error("falha ao ajustar a devolução: " + error.message);
  console.log(`paypal-webhook: ${estorno ? "estorno" : "reembolso"} de R$ ${valorBRL} em ${reg.id} → ${data}`);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });
  const id = Deno.env.get("PAYPAL_CLIENT_ID"), segredo = Deno.env.get("PAYPAL_CLIENT_SECRET"), webhookId = Deno.env.get("PAYPAL_WEBHOOK_ID");
  if (!id || !segredo || !webhookId) { console.error("paypal-webhook: PAYPAL_CLIENT_ID/SECRET/WEBHOOK_ID não configurados"); return new Response("config", { status: 500 }); }

  const bruto = await req.text();
  let evento: Record<string, any>;
  try { evento = JSON.parse(bruto); } catch { return new Response("corpo inválido", { status: 400 }); }

  try {
    // 1) Confere a assinatura com o próprio PayPal, antes de qualquer coisa.
    const token = await tokenPayPal(id, segredo);
    const h = req.headers;
    const v = await fetch(`${API}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_algo: h.get("paypal-auth-algo"), cert_url: h.get("paypal-cert-url"), transmission_id: h.get("paypal-transmission-id"),
        transmission_sig: h.get("paypal-transmission-sig"), transmission_time: h.get("paypal-transmission-time"),
        webhook_id: webhookId, webhook_event: evento,
      }),
    });
    const ver = await v.json();
    if (!v.ok || ver?.verification_status !== "SUCCESS") return new Response("assinatura inválida", { status: 401 });

    const obj = evento?.resource ?? {};
    switch (evento.event_type) {
      case "PAYMENT.CAPTURE.COMPLETED": await concluida(obj); break;
      case "PAYMENT.CAPTURE.REFUNDED": await devolvido(obj, false, token); break;
      case "PAYMENT.CAPTURE.REVERSED": await devolvido(obj, true, token); break;
      default: console.log(`paypal-webhook: evento ${evento.event_type} ignorado`);
    }
  } catch (e) {
    console.error("paypal-webhook:", e);
    return new Response("erro", { status: 500 });   // o PayPal tenta de novo
  }
  return new Response("ok", { status: 200 });
});

// Zenkyo — recebe os avisos (webhooks) do Stripe, valida a assinatura e lança o apoio na Aliança Z.
//   checkout.session.completed / checkout.session.async_payment_succeeded → registrar_apoio_mp (só se estiver pago)
//   charge.refunded                                                       → ajustar_devolucao_mp (reembolso total ou parcial)
//   charge.dispute.created                                                → ajustar_devolucao_mp como estorno (contestação)
// Segredos (Painel do Supabase → Edge Functions → Secrets): STRIPE_WEBHOOK_SECRET (whsec_...).
// Publicada sem verificação de JWT: quem chama é o Stripe; a autenticação é a assinatura Stripe-Signature.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const enc = new TextEncoder();
const TOLERANCIA_S = 300;

async function hmacHex(segredo: string, texto: string): Promise<string> {
  const chave = await crypto.subtle.importKey("raw", enc.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const assinatura = await crypto.subtle.sign("HMAC", chave, enc.encode(texto));
  return [...new Uint8Array(assinatura)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function iguaisSemVazarTempo(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Doação pelo Stripe a partir do PaymentIntent (é o que o Stripe devolve em reembolsos e contestações).
async function achaPorPagamento(db: ReturnType<typeof admin>, pi: string) {
  const { data } = await db.from("mp_pagamentos").select("id, valor, valor_original, provedor").eq("mp_payment_id", pi).eq("provedor", "stripe").maybeSingle();
  return data;
}

async function pago(sessao: Record<string, any>) {
  const ref = String(sessao.client_reference_id ?? sessao.metadata?.ref ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(ref)) { console.log("stripe-webhook: sessão sem referência do Zenkyo"); return; }
  if (sessao.payment_status !== "paid") { console.log(`stripe-webhook: sessão ${sessao.id} ainda não paga (${sessao.payment_status})`); return; }
  const db = admin();
  const { data: reg } = await db.from("mp_pagamentos").select("id, valor, valor_original, provedor, moeda").eq("id", ref).maybeSingle();
  // Nunca confia só no aviso: o valor e a moeda pagos têm que bater com o que foi pedido no checkout.
  if (!reg || reg.provedor !== "stripe") { console.error(`stripe-webhook: referência ${ref} não é uma doação do Stripe`); return; }
  const centavos = Math.round(Number(reg.valor_original) * 100);
  if (String(sessao.currency).toLowerCase() !== "usd" || Number(sessao.amount_total) !== centavos) {
    console.error(`stripe-webhook: valor pago (${sessao.amount_total} ${sessao.currency}) diferente do pedido (${centavos} usd) em ${ref}`);
    return;
  }
  const pi = String(sessao.payment_intent ?? "");
  if (!pi) { console.error(`stripe-webhook: sessão ${sessao.id} sem payment_intent`); return; }
  const { data, error } = await db.rpc("registrar_apoio_mp", { p_ref: ref, p_payment_id: pi, p_valor: Number(reg.valor) });
  if (error) throw new Error("falha ao registrar o apoio: " + error.message);
  console.log(`stripe-webhook: sessão ${sessao.id} paga → ${data}`);
}

async function devolvido(cobranca: Record<string, any>, estorno: boolean) {
  const pi = String(cobranca.payment_intent ?? "");
  if (!pi) return;
  const db = admin();
  const reg = await achaPorPagamento(db, pi);
  if (!reg) { console.log(`stripe-webhook: ${pi} não é uma doação do Zenkyo`); return; }
  // Reembolso parcial vira a mesma fração do valor em reais registrado.
  const total = Number(cobranca.amount) || 1;
  const parte = estorno ? 1 : Math.min(Number(cobranca.amount_refunded ?? 0) / total, 1);
  const valorBRL = Math.round(Number(reg.valor) * parte * 100) / 100;
  const { data, error } = await db.rpc("ajustar_devolucao_mp", { p_ref: reg.id, p_devolvido: valorBRL, p_estornado: estorno });
  if (error) throw new Error("falha ao ajustar a devolução: " + error.message);
  console.log(`stripe-webhook: ${estorno ? "contestação" : "reembolso"} de R$ ${valorBRL} em ${reg.id} → ${data}`);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });
  const segredo = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!segredo) { console.error("stripe-webhook: STRIPE_WEBHOOK_SECRET não configurado"); return new Response("config", { status: 500 }); }

  // 1) Valida a assinatura Stripe-Signature (t=...,v1=...) sobre o corpo cru, antes de qualquer coisa.
  const bruto = await req.text();
  const cab = (req.headers.get("stripe-signature") ?? "").split(",").map((p) => p.trim().split("="));
  const ts = cab.find(([k]) => k === "t")?.[1] ?? "";
  const v1s = cab.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!ts || !v1s.length) return new Response("assinatura ausente", { status: 400 });
  if (Math.abs(Date.now() / 1000 - Number(ts)) > TOLERANCIA_S) return new Response("assinatura vencida", { status: 400 });
  const esperado = await hmacHex(segredo, `${ts}.${bruto}`);
  if (!v1s.some((v) => iguaisSemVazarTempo(esperado, v))) return new Response("assinatura inválida", { status: 401 });

  let evento: Record<string, any>;
  try { evento = JSON.parse(bruto); } catch { return new Response("corpo inválido", { status: 400 }); }
  const obj = evento?.data?.object ?? {};
  try {
    switch (evento.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": await pago(obj); break;
      case "charge.refunded": await devolvido(obj, false); break;
      case "charge.dispute.created": await devolvido(obj, true); break;
      default: console.log(`stripe-webhook: evento ${evento.type} ignorado`);
    }
  } catch (e) {
    console.error("stripe-webhook:", e);
    return new Response("erro", { status: 500 });   // o Stripe tenta de novo
  }
  return new Response("ok", { status: 200 });
});

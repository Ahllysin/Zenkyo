// Zenkyo — recebe os avisos (webhooks) do Mercado Pago, valida a assinatura e, quando o pagamento está
// aprovado, lança o apoio na Aliança Z (função registrar_apoio_mp no banco).
// Segredos (Painel do Supabase → Edge Functions → Secrets): MP_ACCESS_TOKEN e MP_WEBHOOK_SECRET.
// Publicada sem verificação de JWT: quem chama é o Mercado Pago; a autenticação é a assinatura x-signature.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { MercadoPagoConfig, Payment } from "npm:mercadopago@3.6.1";

const enc = new TextEncoder();

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

async function processar(paymentId: string) {
  const accessToken = Deno.env.get("MP_ACCESS_TOKEN");
  if (!accessToken) { console.error("mp-webhook: MP_ACCESS_TOKEN não configurado"); return; }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Nunca confia no conteúdo do aviso: busca o pagamento direto no Mercado Pago.
  const pagamento = await new Payment(new MercadoPagoConfig({ accessToken })).get({ id: paymentId });
  const ref = pagamento.external_reference ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(ref)) { console.log(`mp-webhook: pagamento ${paymentId} sem referência do Zenkyo`); return; }
  const valorPago = Number(pagamento.transaction_amount);
  const status = String(pagamento.status ?? "desconhecido");
  if (status === "approved" || status === "refunded" || status === "charged_back") {
    // lança o apoio no mural (só na primeira vez; avisos repetidos são ignorados pelo banco)
    const { data, error } = await admin.rpc("registrar_apoio_mp", { p_ref: ref, p_payment_id: String(pagamento.id), p_valor: valorPago });
    if (error) { console.error("mp-webhook: falha ao registrar o apoio", error); return; }
    console.log(`mp-webhook: pagamento ${paymentId} ${status} → ${data}`);
    // devolução (total ou parcial) ou estorno: desconta do apoio no mural
    const estornado = status === "charged_back";
    const devolvido = status === "approved" ? Number(pagamento.transaction_amount_refunded ?? 0) : valorPago;
    if (devolvido > 0 || estornado) {
      const aj = await admin.rpc("ajustar_devolucao_mp", { p_ref: ref, p_devolvido: devolvido, p_estornado: estornado });
      if (aj.error) console.error("mp-webhook: falha ao ajustar a devolução", aj.error);
      else console.log(`mp-webhook: devolução de R$ ${devolvido} → ${aj.data}`);
    }
  } else {
    // pendente, em análise, recusado, cancelado...: só guarda o status (nunca mexe em apoio já aprovado/devolvido)
    await admin.from("mp_pagamentos").update({ status, mp_payment_id: String(pagamento.id) })
      .eq("id", ref).not("status", "in", "(aprovado,devolvido,estornado)");
    console.log(`mp-webhook: pagamento ${paymentId} → ${status}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });
  const segredo = Deno.env.get("MP_WEBHOOK_SECRET");
  if (!segredo) { console.error("mp-webhook: MP_WEBHOOK_SECRET não configurado"); return new Response("config", { status: 500 }); }

  const url = new URL(req.url);
  let corpo: Record<string, any> = {};
  try { corpo = await req.json(); } catch { /* aviso sem corpo JSON */ }
  const tipo = String(corpo?.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "");
  let dataId = String(url.searchParams.get("data.id") ?? corpo?.data?.id ?? "");
  if (/^[a-z0-9]+$/i.test(dataId)) dataId = dataId.toLowerCase();

  // 1) Valida a assinatura x-signature (HMAC-SHA256) antes de qualquer coisa.
  const partes = Object.fromEntries((req.headers.get("x-signature") ?? "").split(",").map((p) => {
    const [k, ...v] = p.split("="); return [k?.trim(), v.join("=").trim()];
  }));
  const ts = partes.ts, v1 = partes.v1;
  const requestId = req.headers.get("x-request-id") ?? "";
  if (!ts || !v1 || !dataId) return new Response("assinatura ausente", { status: 400 });
  const manifesto = `id:${dataId};${requestId ? `request-id:${requestId};` : ""}ts:${ts};`;
  if (!iguaisSemVazarTempo(await hmacHex(segredo, manifesto), v1)) return new Response("assinatura inválida", { status: 401 });

  // 2) Responde 200 na hora e 3) processa em segundo plano (avisos repetidos são ignorados pelo banco).
  if (tipo === "payment") EdgeRuntime.waitUntil(processar(dataId).catch((e) => console.error("mp-webhook:", e)));
  return new Response("ok", { status: 200 });
});

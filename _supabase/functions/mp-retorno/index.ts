// Zenkyo — confirmação na VOLTA do pagamento (segundo caminho, independente do webhook).
// Ao voltar do Mercado Pago, o endereço traz o número do pagamento (payment_id). O site manda esse número aqui; a função
// NÃO confia nele: consulta o pagamento direto no Mercado Pago com a chave do site, confere que veio do botão do Zenkyo
// (external_reference = pedido gravado no banco) e só então lança o apoio no mural, uma vez só (mesma regra do webhook).
// Qualquer um pode chamar, mas só consegue registrar pagamentos que o Mercado Pago confirma como pagos.
// Segredo: MP_ACCESS_TOKEN.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { MercadoPagoConfig, Payment } from "npm:mercadopago@3.6.1";

const ORIGENS = ["https://zenkyo.com.br", "https://www.zenkyo.com.br", "https://ahllysin.github.io", "http://localhost:8765", "http://127.0.0.1:8765", "http://localhost:8766"];

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

  const accessToken = Deno.env.get("MP_ACCESS_TOKEN");
  if (!accessToken) return responder(503, { erro: "Doações não configuradas." });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return responder(400, { erro: "Pedido inválido." }); }
  const numero = String(body.pagamento ?? "").replace(/\D/g, "");
  if (numero.length < 6 || numero.length > 20) return responder(400, { erro: "Número de pagamento inválido." });

  let pagamento: any;
  try {
    pagamento = await new Payment(new MercadoPagoConfig({ accessToken })).get({ id: numero });
  } catch (e) {
    console.error("mp-retorno: consulta ao Mercado Pago falhou", e);
    return responder(404, { erro: "Pagamento não encontrado." });
  }
  const ref = String(pagamento.external_reference ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(ref)) return responder(422, { erro: "Pagamento de outra origem." });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: reg } = await admin.from("mp_pagamentos").select("id").eq("id", ref).maybeSingle();
  if (!reg) return responder(404, { erro: "Pedido não encontrado." });

  const valorPago = Number(pagamento.transaction_amount);
  const status = String(pagamento.status ?? "desconhecido");
  let resultado = "status_atualizado";
  if (status === "approved" || status === "refunded" || status === "charged_back") {
    const r = await admin.rpc("registrar_apoio_mp", { p_ref: ref, p_payment_id: String(pagamento.id), p_valor: valorPago });
    if (r.error) { console.error("mp-retorno: registrar falhou", r.error); return responder(500, { erro: "Não consegui registrar agora." }); }
    resultado = String(r.data);
    const estornado = status === "charged_back";
    const devolvido = status === "approved" ? Number(pagamento.transaction_amount_refunded ?? 0) : valorPago;
    if (devolvido > 0 || estornado) await admin.rpc("ajustar_devolucao_mp", { p_ref: ref, p_devolvido: devolvido, p_estornado: estornado });
  } else {
    await admin.from("mp_pagamentos").update({ status, mp_payment_id: String(pagamento.id) })
      .eq("id", ref).not("status", "in", "(aprovado,devolvido,estornado)");
  }
  console.log(`mp-retorno: pagamento ${numero} ${status} → ${resultado}`);
  return responder(200, { status, resultado });
});

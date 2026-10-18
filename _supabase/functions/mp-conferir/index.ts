// Zenkyo — "Conferir pagamento" da aba Admin: o dono digita o número da operação do Mercado Pago, a função consulta o
// pagamento direto no Mercado Pago e lança o apoio no mural (mesma regra do webhook). Serve para recuperar um pagamento
// cujo aviso automático não chegou. Só responde para a conta do dono (o JWT da sessão é conferido aqui dentro).
// Segredo: MP_ACCESS_TOKEN (o mesmo das outras funções).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { MercadoPagoConfig, Payment } from "npm:mercadopago@3.6.1";

const DONO = "a06d68b7-b5c9-4be3-a102-8a826bbe8cee";   // mesmo UID do ADMIN_DISCORD_ID do site
const ORIGENS = ["https://zenkyo.com.br", "https://www.zenkyo.com.br", "http://localhost:8765", "http://127.0.0.1:8765", "http://localhost:8766"];

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

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const { data: u } = jwt.split(".").length === 3 ? await admin.auth.getUser(jwt) : { data: { user: null } };
  if (!u?.user || u.user.id !== DONO) return responder(403, { erro: "Só o dono do site pode conferir pagamentos." });

  const accessToken = Deno.env.get("MP_ACCESS_TOKEN");
  if (!accessToken) return responder(503, { erro: "MP_ACCESS_TOKEN não configurado." });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return responder(400, { erro: "Pedido inválido." }); }
  const numero = String(body.pagamento ?? "").replace(/\D/g, "");
  if (numero.length < 6 || numero.length > 20) return responder(400, { erro: "Digite o número da operação (só números)." });

  let pagamento: any;
  try {
    pagamento = await new Payment(new MercadoPagoConfig({ accessToken })).get({ id: numero });
  } catch (e) {
    console.error("mp-conferir: consulta ao Mercado Pago falhou", e);
    return responder(404, { erro: "O Mercado Pago não encontrou esse pagamento com a chave do site. Confira o número da operação." });
  }
  const ref = String(pagamento.external_reference ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(ref)) return responder(422, { erro: "Esse pagamento não veio do botão de doação do Zenkyo." });
  const { data: reg } = await admin.from("mp_pagamentos").select("id, status, nome, anonimo").eq("id", ref).maybeSingle();
  if (!reg) return responder(404, { erro: "Pedido não encontrado no site (pode ter sido apagado na limpeza de não pagos)." });

  const valorPago = Number(pagamento.transaction_amount);
  const status = String(pagamento.status ?? "desconhecido");
  let resultado = "status_atualizado";
  if (status === "approved" || status === "refunded" || status === "charged_back") {
    const r = await admin.rpc("registrar_apoio_mp", { p_ref: ref, p_payment_id: String(pagamento.id), p_valor: valorPago });
    if (r.error) { console.error("mp-conferir: registrar falhou", r.error); return responder(500, { erro: "Não consegui registrar no mural." }); }
    resultado = String(r.data);
    const estornado = status === "charged_back";
    const devolvido = status === "approved" ? Number(pagamento.transaction_amount_refunded ?? 0) : valorPago;
    if (devolvido > 0 || estornado) {
      const aj = await admin.rpc("ajustar_devolucao_mp", { p_ref: ref, p_devolvido: devolvido, p_estornado: estornado });
      if (!aj.error) resultado += " + devolução " + String(aj.data);
    }
  } else {
    await admin.from("mp_pagamentos").update({ status, mp_payment_id: String(pagamento.id) })
      .eq("id", ref).not("status", "in", "(aprovado,devolvido,estornado)");
  }
  return responder(200, { status, valor: valorPago, resultado, nome: reg.anonimo ? null : reg.nome });
});

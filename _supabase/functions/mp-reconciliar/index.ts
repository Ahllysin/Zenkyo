// Zenkyo — "Conferir agora" da aba Admin: reconcilia os pedidos que ficaram abertos (aviso do Mercado Pago que não chegou).
// Para cada pedido recente ainda sem confirmação, a função pergunta ao Mercado Pago (busca por external_reference, que é o id do
// pedido) e lança no mural os que foram pagos, na mesma regra do webhook (registrar_apoio_mp / ajustar_devolucao_mp, uma vez só).
// Só responde para a conta do dono (o JWT da sessão é conferido aqui dentro). Segredo: MP_ACCESS_TOKEN.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { MercadoPagoConfig, Payment } from "npm:mercadopago@3.6.1";

const DONO = "a06d68b7-b5c9-4be3-a102-8a826bbe8cee";
const ORIGENS = ["https://zenkyo.com.br", "https://www.zenkyo.com.br", "http://localhost:8765", "http://127.0.0.1:8765", "http://localhost:8766"];
const JANELA_DIAS = 7;
const MAXIMO = 50;

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
  const mp = new Payment(new MercadoPagoConfig({ accessToken }));

  const desde = new Date(Date.now() - JANELA_DIAS * 86400_000).toISOString();
  const { data: pedidos, error } = await admin.from("mp_pagamentos").select("id, status")
    .in("status", ["criado", "pending", "in_process"]).is("aprovado_em", null).gte("created_at", desde)
    .order("created_at", { ascending: false }).limit(MAXIMO);
  if (error) { console.error("mp-reconciliar: leitura falhou", error); return responder(500, { erro: "Não consegui ler os pedidos." }); }

  let lancados = 0, atualizados = 0, semPagamento = 0, falhas = 0;
  for (const p of pedidos ?? []) {
    try {
      const r: any = await mp.search({ options: { external_reference: p.id, sort: "date_created", criteria: "desc", limit: 5 } });
      const pagamentos: any[] = r?.results ?? [];
      if (!pagamentos.length) { semPagamento++; continue; }
      // o mais relevante: um pago/devolvido vence; senão o mais recente
      const pago = pagamentos.find((x) => ["approved", "refunded", "charged_back"].includes(String(x.status))) ?? pagamentos[0];
      const status = String(pago.status ?? "desconhecido");
      const valor = Number(pago.transaction_amount);
      if (["approved", "refunded", "charged_back"].includes(status)) {
        const reg = await admin.rpc("registrar_apoio_mp", { p_ref: p.id, p_payment_id: String(pago.id), p_valor: valor });
        if (reg.error) { console.error("mp-reconciliar: registrar falhou", p.id, reg.error); falhas++; continue; }
        if (String(reg.data) === "novo" || String(reg.data) === "somado" || String(reg.data) === "anonimo" || String(reg.data) === "sem_nome") lancados++;
        const estornado = status === "charged_back";
        const devolvido = status === "approved" ? Number(pago.transaction_amount_refunded ?? 0) : valor;
        if (devolvido > 0 || estornado) await admin.rpc("ajustar_devolucao_mp", { p_ref: p.id, p_devolvido: devolvido, p_estornado: estornado });
      } else if (status !== p.status) {
        await admin.from("mp_pagamentos").update({ status, mp_payment_id: String(pago.id) })
          .eq("id", p.id).not("status", "in", "(aprovado,devolvido,estornado)");
        atualizados++;
      }
    } catch (e) {
      console.error("mp-reconciliar: pedido", p.id, e);
      falhas++;
    }
  }
  console.log(`mp-reconciliar: ${pedidos?.length ?? 0} conferidos, ${lancados} lançados, ${atualizados} atualizados, ${semPagamento} sem pagamento, ${falhas} falhas`);
  return responder(200, { conferidos: pedidos?.length ?? 0, lancados, atualizados, sem_pagamento: semPagamento, falhas });
});

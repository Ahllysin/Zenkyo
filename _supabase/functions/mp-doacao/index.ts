// Zenkyo — cria a preferência do Checkout Pro para uma doação e devolve o init_point.
// Chamada pela aba Doar (supabase.functions.invoke('mp-doacao', { body: { valor, nome, anonimo } })).
// Segredos (Painel do Supabase → Edge Functions → Secrets): MP_ACCESS_TOKEN e, opcional, SITE_URL.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm do próprio Supabase.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { MercadoPagoConfig, Preference } from "npm:mercadopago@3.6.1";

const ORIGENS = [
  "https://ahllysin.github.io",
  "https://zenkyo.com.br",
  "https://www.zenkyo.com.br",
  "http://localhost:8765",
  "http://127.0.0.1:8765",
  "http://localhost:8766",
];
const VALOR_MIN = 5;
const VALOR_MAX = 5000;
const LIMITE_10MIN = 40; // trava simples contra cliques em massa (preferências criadas nos últimos 10 min)

const SITE_URL = (Deno.env.get("SITE_URL") || "https://zenkyo.com.br/").trim().replace(/\/?$/, "/");

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
  if (!accessToken) return responder(503, { erro: "As doações pelo Mercado Pago ainda não foram configuradas." });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return responder(400, { erro: "Pedido inválido." }); }

  const valor = Math.round(Number(body.valor) * 100) / 100;
  if (!Number.isFinite(valor) || valor < VALOR_MIN || valor > VALOR_MAX) {
    return responder(400, { erro: `Escolha um valor entre R$ ${VALOR_MIN} e R$ ${VALOR_MAX}.` });
  }
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
  if ((count ?? 0) >= LIMITE_10MIN) return responder(429, { erro: "Muitos pedidos agora. Tente de novo em alguns minutos." });

  const { data: reg, error } = await admin
    .from("mp_pagamentos")
    .insert({ user_id: userId, nome: !userId && !anonimo && nome ? nome : null, anonimo, valor })
    .select("id")
    .single();
  if (error || !reg) {
    console.error("mp-doacao: falha ao registrar", error);
    return responder(500, { erro: "Não consegui iniciar a doação agora. Tente de novo." });
  }

  try {
    const voltar = (s: string) => `${SITE_URL}?doacao=${s}`;
    // auto_return só com endereço https público: o Mercado Pago recusa auto_return com localhost
    const publicAppUrl = /^https:\/\//i.test(SITE_URL) && !/^https:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::|\/|$)/i.test(SITE_URL);
    const result = await new Preference(new MercadoPagoConfig({ accessToken })).create({
      body: {
        items: [{
          id: "apoio-zenkyo",
          title: "Apoio ao Zenkyo",
          description: "Doação para manter o site no ar",
          category_id: "donations",
          quantity: 1,
          unit_price: valor,
          currency_id: "BRL",
        }],
        back_urls: { success: voltar("aprovada"), failure: voltar("recusada"), pending: voltar("pendente") },
        ...(publicAppUrl ? { auto_return: "approved" } : {}),
        external_reference: reg.id,
        // avisa o webhook deste projeto a cada pagamento, sem depender do cadastro no painel (?source_news=webhooks = só webhooks)
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook?source_news=webhooks`,
        statement_descriptor: "ZENKYO",
      },
      requestOptions: { idempotencyKey: reg.id },
    });
    await admin.from("mp_pagamentos").update({ preference_id: result.id }).eq("id", reg.id);
    // Sempre o init_point da resposta (o Mercado Pago não tem mais ambiente sandbox).
    return responder(200, { init_point: result.init_point });
  } catch (e) {
    console.error("mp-doacao: falha ao criar a preferência", e);
    await admin.from("mp_pagamentos").update({ status: "erro" }).eq("id", reg.id);
    return responder(502, { erro: "O Mercado Pago não respondeu. Tente de novo em instantes." });
  }
});

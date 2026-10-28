// Zenkyo — recebe o aviso (webhook) do Ko-fi quando alguém doa e lança o apoio na Aliança Z (site em inglês).
// O Ko-fi manda um POST (application/x-www-form-urlencoded) com o campo "data" em JSON. A autenticação é o "verification_token"
// do próprio aviso, comparado com o segredo KOFI_VERIFICATION_TOKEN (Ko-fi → Settings → API → Webhooks).
// Segredos: KOFI_VERIFICATION_TOKEN e, opcional, USD_BRL (taxa fixa; precisa ser igual a KZ_USD_BRL em js/i18n.js, padrão 5).
// Quem doa cola na mensagem o código do site (ZK-XXXXXXXX); a função do banco registrar_apoio_kofi acha o perfil por ele.
// Publicada sem verificação de JWT: quem chama é o Ko-fi. O Ko-fi não avisa reembolso: devolução é ajustada à mão na aba Admin.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const USD_BRL = Number(Deno.env.get("USD_BRL")) > 0 ? Number(Deno.env.get("USD_BRL")) : 5;
const VALOR_MIN_BRL = 5;
const VALOR_MAX_BRL = 5000;
// Só doações e mensalidades entram na patente (pedidos de loja e comissões são vendas, não apoio).
const TIPOS = ["Donation", "Subscription"];

// Compara sem parar no primeiro caractere diferente.
function iguais(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}

const limpaNome = (s: unknown) =>
  typeof s === "string" ? s.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 40) : "";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });
  const segredo = Deno.env.get("KOFI_VERIFICATION_TOKEN");
  if (!segredo) { console.error("kofi-webhook: KOFI_VERIFICATION_TOKEN não configurado"); return new Response("config", { status: 500 }); }

  let dado: Record<string, any>;
  try {
    const form = await req.formData();
    dado = JSON.parse(String(form.get("data") ?? ""));
  } catch {
    return new Response("corpo inválido", { status: 400 });
  }

  if (typeof dado.verification_token !== "string" || !iguais(dado.verification_token, segredo)) {
    return new Response("token inválido", { status: 401 });
  }

  // Daqui para baixo o aviso é do Ko-fi. Respostas 200 = "recebi" (não adianta o Ko-fi reenviar o que a gente ignora de propósito).
  if (!TIPOS.includes(String(dado.type))) { console.log(`kofi-webhook: tipo ${dado.type} ignorado`); return new Response("ok", { status: 200 }); }
  const txn = String(dado.kofi_transaction_id ?? "").trim();
  if (!txn) { console.error("kofi-webhook: aviso sem kofi_transaction_id"); return new Response("ok", { status: 200 }); }
  const moeda = String(dado.currency ?? "").toUpperCase();
  const usd = Math.round(Number(dado.amount) * 100) / 100;
  if (moeda !== "USD") {
    console.error(`kofi-webhook: moeda ${moeda} não suportada (${txn}); deixe a página do Ko-fi em dólar`);
    return new Response("ok", { status: 200 });
  }
  const brl = Math.round(usd * USD_BRL * 100) / 100;
  if (!Number.isFinite(brl) || brl < VALOR_MIN_BRL || brl > VALOR_MAX_BRL) {
    console.error(`kofi-webhook: valor fora do limite (${dado.amount} ${moeda}, ${txn})`);
    return new Response("ok", { status: 200 });
  }

  const codigo = String(dado.message ?? "").match(/\bZK-?([0-9A-F]{8})\b/i)?.[1] ?? "";
  const anonimo = dado.is_public === false;

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.rpc("registrar_apoio_kofi", {
    p_txn: txn, p_nome: limpaNome(dado.from_name), p_anonimo: anonimo, p_codigo: codigo,
    p_valor: brl, p_valor_original: usd, p_moeda: moeda,
  });
  if (error) {
    console.error("kofi-webhook: falha ao registrar o apoio", error);
    return new Response("erro", { status: 500 });   // o Ko-fi tenta de novo
  }
  console.log(`kofi-webhook: ${txn} (${usd} USD → R$ ${brl}) → ${data}`);
  return new Response("ok", { status: 200 });
});

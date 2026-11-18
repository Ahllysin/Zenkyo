-- "Descreva o time": guarda os pedidos (sem IP e sem conta) para o dono ver o que as pessoas pedem e onde o site erra.
-- Só o servidor (service role) grava; o dono lê pela função admin_ia_pedidos. O site nunca lê esta tabela.
create table if not exists public.ia_pedidos (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  idioma text not null default 'pt' check (idioma in ('pt', 'en')),
  texto text not null check (char_length(texto) between 1 and 200),
  fonte text not null default 'local' check (fonte in ('ia', 'local')),   -- quem leu o pedido: IA ou só a leitura por palavras
  vazio boolean not null default false,                                   -- true = não entendeu o pedido
  fase text not null default '',
  entendido jsonb not null default '[]'::jsonb,                           -- rótulos que o site mostrou em "Entendi:"
  n_times integer not null default 0,
  voto smallint check (voto in (1, -1)),                                  -- 👍 / 👎 da pessoa
  quem text                                                               -- código embaralhado do IP, só para limitar abuso; zera em 2 dias
);
alter table public.ia_pedidos enable row level security;
create index if not exists ia_pedidos_criado_idx on public.ia_pedidos (criado_em desc);

create or replace function public.ia_registrar_pedido(
  p_quem text, p_idioma text, p_texto text, p_fonte text, p_vazio boolean, p_fase text, p_entendido jsonb, p_n_times integer, p_limite integer)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare novo uuid; n integer;
begin
  select count(*) into n from public.ia_pedidos where quem = p_quem and criado_em > now() - interval '1 day';
  if n >= p_limite then return null; end if;
  insert into public.ia_pedidos (idioma, texto, fonte, vazio, fase, entendido, n_times, quem)
  values (case when p_idioma = 'en' then 'en' else 'pt' end, left(p_texto, 200), case when p_fonte = 'ia' then 'ia' else 'local' end,
          coalesce(p_vazio, false), left(coalesce(p_fase, ''), 10), coalesce(p_entendido, '[]'::jsonb), greatest(coalesce(p_n_times, 0), 0), p_quem)
  returning id into novo;
  -- limpeza: esquece o código do IP depois de 2 dias e apaga pedidos com mais de 180 dias
  if random() < 0.05 then
    update public.ia_pedidos set quem = null where quem is not null and criado_em < now() - interval '2 days';
    delete from public.ia_pedidos where criado_em < now() - interval '180 days';
  end if;
  return novo;
end;
$function$;

-- voto da pessoa no pedido que acabou de fazer (o id só quem fez o pedido conhece)
create or replace function public.ia_votar_pedido(p_id uuid, p_voto integer)
 returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare n integer;
begin
  if p_voto not in (1, -1) then return false; end if;
  update public.ia_pedidos set voto = p_voto where id = p_id and criado_em > now() - interval '1 day';
  get diagnostics n = row_count;
  return n > 0;
end;
$function$;

-- painel do dono: pedidos recentes, os que não foram entendidos, os 👎 e os termos mais repetidos
create or replace function public.admin_ia_pedidos(p_dias integer default 30)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare desde timestamptz := now() - make_interval(days => greatest(least(coalesce(p_dias, 30), 180), 1));
begin
  if auth.uid() is distinct from 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'total', (select count(*) from public.ia_pedidos where criado_em >= desde),
    'vazios', (select count(*) from public.ia_pedidos where criado_em >= desde and vazio),
    'positivos', (select count(*) from public.ia_pedidos where criado_em >= desde and voto = 1),
    'negativos', (select count(*) from public.ia_pedidos where criado_em >= desde and voto = -1),
    'recentes', coalesce((select jsonb_agg(to_jsonb(p) order by p.criado_em desc) from (
        select id, criado_em, idioma, texto, fonte, vazio, fase, entendido, n_times, voto
          from public.ia_pedidos where criado_em >= desde order by criado_em desc limit 200) p), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.admin_ia_pedido_apagar(p_id uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if auth.uid() is distinct from 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  delete from public.ia_pedidos where id = p_id;
end;
$function$;

revoke all on function public.ia_registrar_pedido(text, text, text, text, boolean, text, jsonb, integer, integer) from public, anon, authenticated;
revoke all on function public.ia_votar_pedido(uuid, integer) from public, anon, authenticated;
revoke all on function public.admin_ia_pedidos(integer) from public, anon;
revoke all on function public.admin_ia_pedido_apagar(uuid) from public, anon;
grant execute on function public.ia_registrar_pedido(text, text, text, text, boolean, text, jsonb, integer, integer) to service_role;
grant execute on function public.ia_votar_pedido(uuid, integer) to service_role;
grant execute on function public.admin_ia_pedidos(integer) to authenticated;
grant execute on function public.admin_ia_pedido_apagar(uuid) to authenticated;

-- IA do montador de time (função ia-montador): contagem de uso por dia e aviso quando o limite gratuito acaba.
-- Só o servidor (service role) mexe nestas tabelas e funções; o site nunca as lê.

-- uso do dia: uma linha 'global' (tudo que a IA respondeu hoje) e uma por visitante (hash do IP, nunca o IP).
create table if not exists public.ia_uso (
  dia date not null,
  chave text not null,
  qtd integer not null default 0,
  primary key (dia, chave)
);
alter table public.ia_uso enable row level security;

-- um aviso por dia por motivo (ex.: 'limite_gemini_diario'); serve para avisar o dono uma vez só e para parar de chamar a IA no resto do dia.
create table if not exists public.ia_avisos (
  dia date not null,
  motivo text not null,
  criado_em timestamptz not null default now(),
  primary key (dia, motivo)
);
alter table public.ia_avisos enable row level security;

-- Tenta gastar 1 chamada de IA. ok=false quando o visitante ou o dia já bateram no limite.
create or replace function public.ia_consumir(p_chave text, p_limite_chave integer, p_limite_global integer)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  g integer; c integer;
begin
  insert into public.ia_uso (dia, chave, qtd) values (hoje, 'global', 0) on conflict do nothing;
  select qtd into g from public.ia_uso where dia = hoje and chave = 'global' for update;
  if g >= p_limite_global then
    return jsonb_build_object('ok', false, 'motivo', 'global');
  end if;
  insert into public.ia_uso (dia, chave, qtd) values (hoje, p_chave, 0) on conflict do nothing;
  select qtd into c from public.ia_uso where dia = hoje and chave = p_chave for update;
  if c >= p_limite_chave then
    return jsonb_build_object('ok', false, 'motivo', 'visitante');
  end if;
  update public.ia_uso set qtd = qtd + 1 where dia = hoje and chave in ('global', p_chave);
  if g = 0 then   -- primeira chamada do dia: aproveita para apagar o que passou de 14 dias
    delete from public.ia_uso where dia < hoje - 14;
    delete from public.ia_avisos where dia < hoje - 60;
  end if;
  return jsonb_build_object('ok', true, 'restantes', p_limite_chave - c - 1, 'restantes_global', p_limite_global - g - 1);
end;
$function$;

-- Devolve a chamada quando a IA falhou (não conta contra o visitante).
create or replace function public.ia_devolver(p_chave text)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  update public.ia_uso set qtd = greatest(qtd - 1, 0) where dia = hoje and chave in ('global', p_chave);
end;
$function$;

-- Registra um aviso do dia. Devolve true só na primeira vez (é quando o dono deve ser avisado).
create or replace function public.ia_avisar(p_motivo text)
 returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare n integer;
begin
  insert into public.ia_avisos (dia, motivo) values ((now() at time zone 'America/Sao_Paulo')::date, left(p_motivo, 60)) on conflict do nothing;
  get diagnostics n = row_count;
  return n > 0;
end;
$function$;

-- Já há aviso hoje? (a função usa para não chamar a IA depois que o limite gratuito acabou)
create or replace function public.ia_tem_aviso(p_motivo text)
 returns boolean language sql stable security definer set search_path to 'public'
as $function$
  select exists (select 1 from public.ia_avisos where dia = (now() at time zone 'America/Sao_Paulo')::date and motivo = p_motivo);
$function$;

revoke all on function public.ia_consumir(text, integer, integer) from public, anon, authenticated;
revoke all on function public.ia_devolver(text) from public, anon, authenticated;
revoke all on function public.ia_avisar(text) from public, anon, authenticated;
revoke all on function public.ia_tem_aviso(text) from public, anon, authenticated;
grant execute on function public.ia_consumir(text, integer, integer) to service_role;
grant execute on function public.ia_devolver(text) to service_role;
grant execute on function public.ia_avisar(text) to service_role;
grant execute on function public.ia_tem_aviso(text) to service_role;

-- Painel do dono (aba Admin): uso da IA do montador e avisos de limite. Só a conta do dono consegue chamar.
create or replace function public.admin_ia_status()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if auth.uid() is distinct from 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'hoje', hoje,
    'visitantes_hoje', (select count(*) from public.ia_uso where dia = hoje and chave <> 'global'),
    'dias', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'qtd', qtd) order by dia desc)
                        from public.ia_uso where chave = 'global' and dia >= hoje - 6), '[]'::jsonb),
    'avisos', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'motivo', motivo, 'criado_em', criado_em) order by criado_em desc)
                          from public.ia_avisos where dia >= hoje - 13), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.admin_ia_status() from public, anon;
grant execute on function public.admin_ia_status() to authenticated;

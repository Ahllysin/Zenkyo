-- Retrato do banco do Zenkyo (Supabase, projeto luyuprliobxtxnppdohw) em 2026-10-18.
-- Serve de CÓPIA DE SEGURANÇA DA ESTRUTURA e de documentação: tabelas, funções, vistas, políticas (RLS), gatilhos e tarefas agendadas.
-- NÃO contém dados (apoiadores, pagamentos, perfis). Para recriar o banco do zero, rode na ordem: tabelas, funções, vistas, gatilhos,
-- políticas e tarefas. As tabelas site_errors/site_frames têm sequência/identidade própria no projeto real (id bigint, id text).
-- Segredos (MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET) NÃO ficam aqui: moram em Edge Functions > Secrets no painel do Supabase.

-- ===================== TABELAS =====================
create table public.community_likes (
  post_id uuid not null,
  user_id uuid not null
);
alter table public.community_likes enable row level security;

create table public.community_posts (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  kind text not null,
  title text not null,
  description text,
  data jsonb not null,
  author_name text,
  created_at timestamp with time zone not null default now()
);
alter table public.community_posts enable row level security;

create table public.community_reports (
  post_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone not null default now()
);
alter table public.community_reports enable row level security;

create table public.donations (
  id uuid not null default gen_random_uuid(),
  number integer not null,
  name text not null,
  amount numeric not null default 0,
  quote text,
  discord text,
  link text,
  honras text[] not null default '{}'::text[],
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  user_id uuid,
  patente_manual text    -- patente definida à mão pelo dono; 'zenoh' é única (só a conta do dono)
);
alter table public.donations enable row level security;
alter table public.donations add constraint donations_patente_manual_chk check (
  patente_manual is null or patente_manual in ('guerreiro_z','saiyajin','ssj','ssj_god','ssj_blue','ultra','deus_destruicao','anjo','zenoh'));

create table public.mp_pagamentos (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  nome text,
  anonimo boolean not null default false,
  valor numeric(10,2) not null,
  status text not null default 'criado'::text,
  mp_payment_id text,
  preference_id text,
  created_at timestamp with time zone not null default now(),
  aprovado_em timestamp with time zone,
  metodo text not null default 'checkout_pro'::text,
  mp_order_id text,
  expira_em timestamp with time zone,
  donation_id uuid,
  devolvido numeric(10,2) not null default 0
);
alter table public.mp_pagamentos enable row level security;      -- sem políticas: só funções do servidor (service role) mexem

create table public.profiles (
  id uuid not null,
  nickname text,
  servidor text,
  bio text,
  instagram text,
  twitch text,
  youtube text,
  avatar_char_id text,     -- guarda também a foto de perfil escolhida, como "foto:<nome>"
  show_socials boolean not null default false,
  is_public boolean not null default false,
  updated_at timestamp with time zone not null default now(),
  patente_forma text,
  patente_cor text
);
alter table public.profiles enable row level security;

create table public.site_errors (
  id bigint not null,
  created_at timestamp with time zone not null default now(),
  user_id uuid default auth.uid(),
  msg text not null,
  stack text,
  pagina text,
  navegador text,
  versao text,
  extra jsonb
);
alter table public.site_errors enable row level security;

create table public.site_frames (
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone not null default now()
);
alter table public.site_frames enable row level security;

create table public.user_data (
  user_id uuid not null,
  key text not null,
  value text not null,
  updated_at timestamp with time zone not null default now()
);
alter table public.user_data enable row level security;

-- ===================== FUNÇÕES =====================
-- O dono do site é o usuário a06d68b7-b5c9-4be3-a102-8a826bbe8cee (UID do Supabase).
CREATE OR REPLACE FUNCTION public.admin_definir_patente(p_id uuid, p_patente text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is distinct from 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid then
    raise exception 'Só o dono do site pode mudar patentes';
  end if;
  update public.donations set patente_manual = nullif(p_patente, '') where id = p_id;
  if not found then raise exception 'Apoiador não encontrado'; end if;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_limpar_aguardando(p_dias integer DEFAULT 1)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is distinct from 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return public.limpar_mp_nao_pagos(p_dias);
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_listar_doacoes(p_limite integer DEFAULT 300)
 RETURNS TABLE(id uuid, criado timestamp with time zone, aprovado_em timestamp with time zone, valor numeric, devolvido numeric, status text, metodo text, anonimo boolean, nome text, user_id uuid)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
#variable_conflict use_column
begin
  if auth.uid() is distinct from 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return query
    select p.id, p.created_at, p.aprovado_em, p.valor, p.devolvido, p.status, p.metodo, p.anonimo,
           case when p.anonimo then null else coalesce(
             nullif(btrim(pr.nickname), ''), nullif(btrim(p.nome), ''),
             (select coalesce(nullif(u.raw_user_meta_data->'custom_claims'->>'global_name', ''),
                              nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''))
                from auth.users u where u.id = p.user_id)) end,
           p.user_id
      from public.mp_pagamentos p
      left join public.profiles pr on pr.id = p.user_id
     order by p.created_at desc
     limit least(greatest(coalesce(p_limite, 300), 1), 1000);
end;
$function$;

CREATE OR REPLACE FUNCTION public.ajustar_devolucao_mp(p_ref uuid, p_devolvido numeric, p_estornado boolean DEFAULT false)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
#variable_conflict use_column
declare
  r public.mp_pagamentos;
  novo numeric;
  delta numeric;
  restante numeric;
begin
  select * into r from public.mp_pagamentos where id = p_ref for update;
  if not found or r.status not in ('aprovado', 'devolvido', 'estornado') then
    return 'ignorado';
  end if;
  novo := least(greatest(coalesce(p_devolvido, 0), 0), r.valor);
  delta := novo - r.devolvido;
  if delta = 0 and not (p_estornado and r.status <> 'estornado') then
    return 'sem_mudanca';
  end if;
  update public.mp_pagamentos
     set devolvido = novo,
         status = case when p_estornado then 'estornado' when novo >= r.valor then 'devolvido' else 'aprovado' end
   where id = p_ref;
  if delta <> 0 and r.donation_id is not null and not r.anonimo then
    update public.donations
       set amount = greatest(amount - delta, 0)
     where id = r.donation_id
    returning amount into restante;
    if restante is not null then
      update public.donations
         set active = (restante > 0 or coalesce(array_length(honras, 1), 0) > 0 or patente_manual is not null)
       where id = r.donation_id;
    end if;
  end if;
  return 'ajustado';
end;
$function$;

CREATE OR REPLACE FUNCTION public.community_set_author()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth'
AS $function$
declare nick text; disc text;
begin
  select nullif(trim(nickname), '') into nick from public.profiles where id = auth.uid() and is_public = true;
  select coalesce(identity_data->>'full_name', identity_data->>'name') into disc
    from auth.identities where user_id = auth.uid() and provider = 'discord' limit 1;
  new.author_name := left(coalesce(nick, disc, 'Jogador'), 40);
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.donations_zenoh_so_dono()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO ''
AS $function$
begin
  if new.patente_manual = 'zenoh' and new.user_id is distinct from 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid then
    raise exception 'A patente Zen''oh é única e só pode ser da conta do dono';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.limpar_mp_nao_pagos(p_dias integer)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare n int;
begin
  delete from public.mp_pagamentos
   where aprovado_em is null
     and status in ('criado', 'erro', 'pending', 'in_process', 'rejected', 'cancelled')
     and created_at < now() - make_interval(days => greatest(coalesce(p_dias, 30), 1));
  get diagnostics n = row_count;
  return n;
end;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_apoio_mp(p_ref uuid, p_payment_id text, p_valor numeric)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  r public.mp_pagamentos;
  d_id uuid;
  nome_mural text;
begin
  -- só registra uma vez na vida (aprovado_em vazio), mesmo se o status depois virar devolvido/estornado
  update public.mp_pagamentos
     set status = 'aprovado', mp_payment_id = p_payment_id, aprovado_em = now()
   where id = p_ref and aprovado_em is null
  returning * into r;
  if not found then
    return 'ja_registrado_ou_inexistente';
  end if;
  if r.anonimo then
    return 'anonimo';
  end if;

  lock table public.donations in share row exclusive mode;

  if r.user_id is not null then
    select id into d_id from public.donations where user_id = r.user_id order by created_at limit 1;
    if d_id is not null then
      update public.donations set amount = amount + p_valor, active = true where id = d_id;
      update public.mp_pagamentos set donation_id = d_id where id = p_ref;
      return 'somado';
    end if;
    select nullif(btrim(nickname), '') into nome_mural from public.profiles where id = r.user_id;
    if nome_mural is null then
      select coalesce(nullif(raw_user_meta_data->'custom_claims'->>'global_name', ''),
                      nullif(raw_user_meta_data->>'full_name', ''),
                      nullif(raw_user_meta_data->>'name', ''), 'Apoiador')
        into nome_mural from auth.users where id = r.user_id;
    end if;
  else
    nome_mural := nullif(btrim(r.nome), '');
    if nome_mural is null then
      return 'sem_nome';
    end if;
  end if;

  insert into public.donations (number, name, amount, user_id)
  values ((select coalesce(max(number), 0) + 1 from public.donations), left(nome_mural, 40), p_valor, r.user_id)
  returning id into d_id;
  update public.mp_pagamentos set donation_id = d_id where id = p_ref;
  return 'novo';
end;
$function$;

CREATE OR REPLACE FUNCTION public.site_errors_poda()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
begin
  delete from public.site_errors where id <= new.id - 3000;
  return null;
end;
$function$;

-- Permissões das funções chamadas pelo site (as demais só o servidor chama):
--   admin_definir_patente, admin_limpar_aguardando, admin_listar_doacoes -> authenticated (cada uma confere o dono por dentro)
--   registrar_apoio_mp, ajustar_devolucao_mp, limpar_mp_nao_pagos -> só service_role

-- ===================== VISTAS PÚBLICAS =====================
-- O valor exato da doação nunca sai: só a faixa da patente. Só apoiadores ativos aparecem.
create or replace view public.donations_public as
 SELECT id, number, name,
        CASE WHEN amount >= 1000 THEN 1000 WHEN amount >= 600 THEN 600 WHEN amount >= 350 THEN 350 WHEN amount >= 200 THEN 200
             WHEN amount >= 100 THEN 100 WHEN amount >= 50 THEN 50 WHEN amount >= 20 THEN 20 WHEN amount >= 10 THEN 10 ELSE 0 END AS amount,
        quote, discord, link, honras, active, user_id, patente_manual
   FROM donations
  WHERE active;
grant select on public.donations_public to anon, authenticated;

create or replace view public.profiles_public as
 SELECT id, nickname, servidor, bio,
        CASE WHEN show_socials THEN instagram ELSE NULL::text END AS instagram,
        CASE WHEN show_socials THEN twitch ELSE NULL::text END AS twitch,
        CASE WHEN show_socials THEN youtube ELSE NULL::text END AS youtube,
        avatar_char_id, patente_forma, patente_cor, show_socials, is_public
   FROM profiles
  WHERE (is_public = true);
grant select on public.profiles_public to anon, authenticated;

-- ===================== GATILHOS =====================
CREATE TRIGGER community_posts_author BEFORE INSERT ON public.community_posts FOR EACH ROW EXECUTE FUNCTION community_set_author();
CREATE TRIGGER donations_zenoh_so_dono BEFORE INSERT OR UPDATE ON public.donations FOR EACH ROW EXECUTE FUNCTION donations_zenoh_so_dono();
CREATE TRIGGER site_errors_poda AFTER INSERT ON public.site_errors FOR EACH ROW EXECUTE FUNCTION site_errors_poda();

-- ===================== POLÍTICAS (RLS) =====================
create policy "curte como si mesmo" on public.community_likes for insert with check ((auth.uid() = user_id));
create policy "descurte a propria" on public.community_likes for delete using ((auth.uid() = user_id));
create policy "todos leem as curtidas" on public.community_likes for select using (true);
create policy "apaga o proprio ou admin" on public.community_posts for delete using (((auth.uid() = user_id) OR (auth.uid() = 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid)));
-- limite de times publicados: 2 para todos; 5 para quem apoiou R$ 10 ou mais (soma das doações ativas ligadas ao login); 30 posts no total
create policy "logado posta (limites)" on public.community_posts for insert with check (((auth.uid() = user_id) AND (( SELECT count(*) FROM community_posts p WHERE (p.user_id = auth.uid())) < 30) AND ((kind <> 'team'::text) OR (( SELECT count(*) FROM community_posts p WHERE ((p.user_id = auth.uid()) AND (p.kind = 'team'::text))) < CASE WHEN (COALESCE(( SELECT sum(d.amount) FROM donations d WHERE ((d.user_id = auth.uid()) AND d.active)), (0)::numeric) >= (10)::numeric) THEN 5 ELSE 2 END))));
create policy "todos leem os posts" on public.community_posts for select using (true);
create policy "denuncia como si mesmo" on public.community_reports for insert with check ((auth.uid() = user_id));
create policy "so admin ve denuncias" on public.community_reports for select using ((auth.uid() = 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid));
create policy "le o proprio ou admin" on public.donations for select using (((auth.uid() = user_id) OR (auth.uid() = 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid)));
create policy "admin escreve" on public.donations for all using ((auth.uid() = 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid)) with check ((auth.uid() = 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid));
create policy "cada um so mexe no proprio perfil" on public.profiles for all using ((auth.uid() = id)) with check ((auth.uid() = id));
create policy "qualquer um registra erro" on public.site_errors for insert with check (((user_id IS NULL) OR (user_id = ( SELECT auth.uid() AS uid))));
create policy "so admin apaga erros" on public.site_errors for delete using ((( SELECT auth.uid() AS uid) = 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid));
create policy "so admin le erros" on public.site_errors for select using ((( SELECT auth.uid() AS uid) = 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid));
create policy "so admin apaga site_frames" on public.site_frames for delete using ((auth.uid() = 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid));
create policy "so admin atualiza site_frames" on public.site_frames for update using ((auth.uid() = 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid)) with check ((auth.uid() = 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid));
create policy "so admin insere site_frames" on public.site_frames for insert with check ((auth.uid() = 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid));
create policy "todo mundo le site_frames" on public.site_frames for select using (true);
create policy "cada um so mexe no proprio" on public.user_data for all using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));

-- ===================== TAREFAS AGENDADAS (pg_cron) =====================
select cron.schedule('limpar-mp-nao-pagos', '0 7 * * *', 'select public.limpar_mp_nao_pagos(30)');   -- apaga pedidos nunca pagos com mais de 30 dias

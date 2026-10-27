-- Resolve os avisos do Advisor do Supabase sem mudar o comportamento do site.

-- 1) Views públicas: só leitura. Antes anon/authenticated tinham INSERT/UPDATE/DELETE/TRUNCATE nelas e, como as views
--    rodam com a permissão do dono (SECURITY DEFINER, necessário para mostrar o mural), isso alcançava as tabelas de baixo.
revoke all on public.profiles_public from anon, authenticated;
revoke all on public.donations_public from anon, authenticated;
grant select on public.profiles_public to anon, authenticated;
grant select on public.donations_public to anon, authenticated;

-- 2) Regras de RLS: auth.uid() avaliado uma vez por consulta, não por linha (mesma lógica de antes)
alter policy "cada um so mexe no proprio" on public.user_data
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "cada um so mexe no proprio perfil" on public.profiles
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
alter policy "apaga o proprio ou admin" on public.community_posts
  using (((select auth.uid()) = user_id) or ((select auth.uid()) = 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid));
alter policy "logado posta (limites)" on public.community_posts
  with check (
    ((select auth.uid()) = user_id)
    and ((select count(*) from public.community_posts p where p.user_id = (select auth.uid())) < 30)
    and ((kind <> 'team'::text) or ((select count(*) from public.community_posts p where p.user_id = (select auth.uid()) and p.kind = 'team'::text) <
      case when coalesce((select sum(d.amount) from public.donations d where d.user_id = (select auth.uid()) and d.active), 0::numeric) >= 10::numeric then 5 else 2 end))
  );
alter policy "curte como si mesmo" on public.community_likes with check ((select auth.uid()) = user_id);
alter policy "descurte a propria" on public.community_likes using ((select auth.uid()) = user_id);
alter policy "denuncia como si mesmo" on public.community_reports with check ((select auth.uid()) = user_id);
alter policy "so admin ve denuncias" on public.community_reports using ((select auth.uid()) = 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid);
alter policy "le o proprio ou admin" on public.donations
  using (((select auth.uid()) = user_id) or ((select auth.uid()) = 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid));
alter policy "admin escreve" on public.donations
  using ((select auth.uid()) = 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid)
  with check ((select auth.uid()) = 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid);
alter policy "so admin insere site_frames" on public.site_frames with check ((select auth.uid()) = 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid);
alter policy "so admin atualiza site_frames" on public.site_frames
  using ((select auth.uid()) = 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid)
  with check ((select auth.uid()) = 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid);
alter policy "so admin apaga site_frames" on public.site_frames using ((select auth.uid()) = 'a06d68b7-b5c9-4be3-a102-8a826bbe8cee'::uuid);

-- 3) Índices nas chaves estrangeiras que não tinham
create index if not exists community_likes_user_id_idx on public.community_likes (user_id);
create index if not exists community_posts_user_id_idx on public.community_posts (user_id);
create index if not exists community_reports_user_id_idx on public.community_reports (user_id);
create index if not exists donations_user_id_idx on public.donations (user_id);
create index if not exists mp_pagamentos_user_id_idx on public.mp_pagamentos (user_id);

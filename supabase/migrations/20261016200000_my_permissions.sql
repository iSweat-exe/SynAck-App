-- All permissions of the signed-in user in one call (used by the Payload back office on every request).
-- Same source of truth as has_permission(): read from the database, never from the JWT.

create function private.user_permissions(p_user_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct rp.permission order by rp.permission), '{}'::text[])
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  where ur.user_id = p_user_id;
$$;

revoke all on function private.user_permissions(uuid) from public, anon;
grant execute on function private.user_permissions(uuid) to authenticated, service_role;

create function public.my_permissions()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $$
  select private.user_permissions((select auth.uid()));
$$;

revoke all on function public.my_permissions() from public, anon;
grant execute on function public.my_permissions() to authenticated, service_role;

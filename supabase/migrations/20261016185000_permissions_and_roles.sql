-- Permissions and roles (README §5 bis).
--
-- * Permissions are strings in the `resource.action` format. The closed list lives in the code
--   (src/lib/permissions.ts); the database only stores roles and their associations.
-- * Roles are data: the four starting presets below can be edited or extended by an administrator.
-- * Deny by default: no permission, no access. Users never get individual permissions.
-- * Sensitive writes (granting roles, audit entries) go through server-side functions that only
--   `service_role` can execute; the API roles can only read what their policies allow.

-- ---------------------------------------------------------------------------------------------
-- Hardening: new tables in `public` are not reachable by the API roles until a migration grants
-- access explicitly (row level security still applies on top of the grants).
-- ---------------------------------------------------------------------------------------------
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;

-- Internal schema, not exposed through the Supabase API.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name ~ '^[a-z][a-z0-9_]*$'),
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission text not null check (permission ~ '^[a-z_]+\.[a-z_]+$'),
  primary key (role_id, permission)
);

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create index user_roles_role_id_idx on public.user_roles (role_id);
create index user_roles_granted_by_idx on public.user_roles (granted_by);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_log_created_at_idx on public.audit_log (created_at desc);
create index audit_log_actor_id_idx on public.audit_log (actor_id);

alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_log enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------------------------

-- Source of truth for "can this user do that?". Read from the database every time (never from the
-- JWT), so a revoked permission takes effect immediately. Used by RLS policies and by Payload.
create function private.has_permission(p_user_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    where ur.user_id = p_user_id
      and rp.permission = p_permission
  );
$$;

revoke all on function private.has_permission(uuid, text) from public, anon;
grant execute on function private.has_permission(uuid, text) to authenticated, service_role;

-- Convenience wrapper for the signed-in user (callable through the API).
create function public.has_permission(p_permission text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.has_permission((select auth.uid()), p_permission);
$$;

revoke all on function public.has_permission(text) from public, anon;
grant execute on function public.has_permission(text) to authenticated, service_role;

create function private.write_audit(
  p_actor_id uuid,
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_metadata jsonb default '{}'
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, target_type, target_id, metadata)
  values (p_actor_id, p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'));
$$;

revoke all on function private.write_audit(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function private.write_audit(uuid, text, text, text, jsonb) to service_role;

create function private.grant_role(p_user_id uuid, p_role text, p_actor_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_id uuid;
begin
  select id into v_role_id from public.roles where name = p_role;
  if v_role_id is null then
    raise exception 'unknown role: %', p_role;
  end if;

  insert into public.user_roles (user_id, role_id, granted_by)
  values (p_user_id, v_role_id, p_actor_id)
  on conflict do nothing;

  perform private.write_audit(
    p_actor_id, 'role.granted', 'user', p_user_id::text, jsonb_build_object('role', p_role)
  );
end;
$$;

create function private.revoke_role(p_user_id uuid, p_role text, p_actor_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_id uuid;
begin
  select id into v_role_id from public.roles where name = p_role;
  if v_role_id is null then
    raise exception 'unknown role: %', p_role;
  end if;

  -- Sign-in is SSO only, so the last administrator must never be removed (lock-out).
  if p_role = 'administrator'
     and (select count(*) from public.user_roles where role_id = v_role_id) <= 1
     and exists (select 1 from public.user_roles where role_id = v_role_id and user_id = p_user_id) then
    raise exception 'cannot remove the last administrator';
  end if;

  delete from public.user_roles where user_id = p_user_id and role_id = v_role_id;

  perform private.write_audit(
    p_actor_id, 'role.revoked', 'user', p_user_id::text, jsonb_build_object('role', p_role)
  );
end;
$$;

revoke all on function private.grant_role(uuid, text, uuid) from public, anon, authenticated;
revoke all on function private.revoke_role(uuid, text, uuid) from public, anon, authenticated;
grant execute on function private.grant_role(uuid, text, uuid) to service_role;
grant execute on function private.revoke_role(uuid, text, uuid) to service_role;

-- Every new account starts as a plain member.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_roles (user_id, role_id)
  select new.id, r.id from public.roles r where r.name = 'member'
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------------------------
-- Row level security: read-only through the API, nothing is writable by the API roles.
-- ---------------------------------------------------------------------------------------------
revoke all on public.roles, public.role_permissions, public.user_roles, public.audit_log from anon, authenticated;
grant select on public.roles, public.role_permissions, public.user_roles, public.audit_log to authenticated;

create policy roles_select on public.roles
  for select to authenticated
  using ((select public.has_permission('roles.manage')));

create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using ((select public.has_permission('roles.manage')));

create policy user_roles_select on public.user_roles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_permission('users.manage')));

create policy audit_log_select on public.audit_log
  for select to authenticated
  using ((select public.has_permission('audit.read')));

-- ---------------------------------------------------------------------------------------------
-- Starting presets (must match PRESETS in src/lib/permissions.ts; a test checks it)
-- ---------------------------------------------------------------------------------------------
insert into public.roles (name, description) values
  ('member', 'Default role of every account: practice, track progress, review'),
  ('junior_instructor', 'Writes content; submits it for review before publication'),
  ('senior_instructor', 'Publishes content and approves reviews'),
  ('administrator', 'Full access, including users, roles and moderation');

insert into public.role_permissions (role_id, permission)
select r.id, p.permission
from (values
  ('member', 'exercises.run'),
  ('member', 'progress.write_own'),
  ('member', 'review.use'),
  ('member', 'leaderboard.see'),
  ('junior_instructor', 'cms.access'),
  ('junior_instructor', 'courses.create'),
  ('junior_instructor', 'courses.edit_own'),
  ('junior_instructor', 'courses.submit_review'),
  ('junior_instructor', 'quiz.create'),
  ('junior_instructor', 'articles.create'),
  ('senior_instructor', 'cms.access'),
  ('senior_instructor', 'courses.create'),
  ('senior_instructor', 'courses.edit_own'),
  ('senior_instructor', 'courses.submit_review'),
  ('senior_instructor', 'quiz.create'),
  ('senior_instructor', 'articles.create'),
  ('senior_instructor', 'courses.edit'),
  ('senior_instructor', 'courses.publish'),
  ('senior_instructor', 'reviews.approve'),
  ('senior_instructor', 'articles.publish'),
  ('senior_instructor', 'paths.manage'),
  ('administrator', 'exercises.run'),
  ('administrator', 'progress.write_own'),
  ('administrator', 'review.use'),
  ('administrator', 'leaderboard.see'),
  ('administrator', 'cms.access'),
  ('administrator', 'courses.create'),
  ('administrator', 'courses.edit_own'),
  ('administrator', 'courses.submit_review'),
  ('administrator', 'quiz.create'),
  ('administrator', 'articles.create'),
  ('administrator', 'courses.edit'),
  ('administrator', 'courses.publish'),
  ('administrator', 'reviews.approve'),
  ('administrator', 'articles.publish'),
  ('administrator', 'paths.manage'),
  ('administrator', 'courses.delete'),
  ('administrator', 'users.manage'),
  ('administrator', 'roles.manage'),
  ('administrator', 'moderation.ban'),
  ('administrator', 'audit.read')
) as p (role_name, permission)
join public.roles r on r.name = p.role_name;

-- Accounts that already exist become members too.
insert into public.user_roles (user_id, role_id)
select u.id, r.id
from auth.users u
cross join public.roles r
where r.name = 'member'
on conflict do nothing;

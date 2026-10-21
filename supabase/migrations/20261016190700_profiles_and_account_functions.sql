-- Profiles and account functions (README §7, §11 bis).
--
-- * One profile per account, created automatically with the account.
-- * Age declaration: an account must declare being at least 15 before using the app. The declaration
--   is recorded server-side by `declare_age()`; the client cannot write that column directly.
-- * An account can delete itself (also the way out for someone who is under 15).

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text check (nickname is null or nickname ~ '^[A-Za-z0-9_-]{3,20}$'),
  avatar_url text,
  leaderboard_opt_in boolean not null default false,
  age_declared_at timestamptz,
  created_at timestamptz not null default now()
);

-- Nicknames are unique regardless of case.
create unique index profiles_nickname_key on public.profiles (lower(nickname));

alter table public.profiles enable row level security;

-- API access: read; update only the columns an account may edit itself.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (nickname, avatar_url, leaderboard_opt_in) on public.profiles to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_permission('users.manage')));

create policy profiles_update on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- A new account gets a profile (with the avatar given by the sign-in provider) and the member role.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, avatar_url)
  values (new.id, new.raw_user_meta_data ->> 'avatar_url')
  on conflict do nothing;

  insert into public.user_roles (user_id, role_id)
  select new.id, r.id from public.roles r where r.name = 'member'
  on conflict do nothing;

  return new;
end;
$$;

-- Accounts that already exist get a profile too.
insert into public.profiles (user_id, avatar_url)
select u.id, u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
on conflict do nothing;

-- Records the age declaration of the signed-in account (only once).
create function public.declare_age()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set age_declared_at = now()
  where user_id = (select auth.uid())
    and age_declared_at is null;
$$;

revoke all on function public.declare_age() from public, anon;
grant execute on function public.declare_age() to authenticated;

-- Deletes the signed-in account and everything attached to it (profile, roles, sessions).
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_admin_role_id uuid;
begin
  if v_user_id is null then
    raise exception 'not signed in';
  end if;

  -- Sign-in is SSO only: never remove the last administrator (lock-out).
  select id into v_admin_role_id from public.roles where name = 'administrator';
  if exists (select 1 from public.user_roles where user_id = v_user_id and role_id = v_admin_role_id)
     and (select count(*) from public.user_roles where role_id = v_admin_role_id) <= 1 then
    raise exception 'cannot delete the last administrator';
  end if;

  perform private.write_audit(null, 'account.deleted', 'user', v_user_id::text, '{}'::jsonb);

  delete from auth.users where id = v_user_id;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

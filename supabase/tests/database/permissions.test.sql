-- pgTAP tests for roles and permissions (run with `supabase test db`).
begin;

select plan(26);

-- Fixtures: three accounts (the on_auth_user_created trigger makes each of them a member).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.test'),
  ('00000000-0000-0000-0000-0000000000c3', 'carol@example.test');

-- Presets -----------------------------------------------------------------------------------
select results_eq(
  $$ select name from public.roles order by name $$,
  $$ values ('administrator'), ('junior_instructor'), ('member'), ('senior_instructor') $$,
  'the four starting presets exist'
);

select is(
  (select count(*) from public.role_permissions where permission !~ '^[a-z_]+\.[a-z_]+$'),
  0::bigint,
  'every stored permission uses the resource.action format'
);

-- New accounts ------------------------------------------------------------------------------
select is(
  (select count(*) from public.user_roles ur join public.roles r on r.id = ur.role_id
    where r.name = 'member' and ur.user_id = '00000000-0000-0000-0000-0000000000a1'),
  1::bigint,
  'a new account is a member'
);

-- has_permission: deny by default, read from the database -------------------------------------
select ok(
  private.has_permission('00000000-0000-0000-0000-0000000000a1', 'exercises.run'),
  'a member can run exercises'
);
select ok(
  not private.has_permission('00000000-0000-0000-0000-0000000000a1', 'courses.publish'),
  'a member cannot publish courses'
);
select ok(
  not private.has_permission('00000000-0000-0000-0000-0000000000a1', 'does.not_exist'),
  'an unknown permission is denied'
);
select ok(
  not private.has_permission('00000000-0000-0000-0000-00000000ffff', 'exercises.run'),
  'an unknown user is denied'
);

-- Granting and revoking roles (server-side only) ----------------------------------------------
select private.grant_role('00000000-0000-0000-0000-0000000000b2', 'senior_instructor', '00000000-0000-0000-0000-0000000000c3');
select ok(
  private.has_permission('00000000-0000-0000-0000-0000000000b2', 'courses.publish'),
  'a granted role takes effect immediately'
);
select is(
  (select count(*) from public.audit_log where action = 'role.granted' and target_id = '00000000-0000-0000-0000-0000000000b2'),
  1::bigint,
  'granting a role is written to the audit log'
);

select private.revoke_role('00000000-0000-0000-0000-0000000000b2', 'senior_instructor', '00000000-0000-0000-0000-0000000000c3');
select ok(
  not private.has_permission('00000000-0000-0000-0000-0000000000b2', 'courses.publish'),
  'a revoked role stops working immediately'
);
select throws_ok(
  $$ select private.grant_role('00000000-0000-0000-0000-0000000000b2', 'nope') $$,
  'unknown role: nope',
  'granting an unknown role fails'
);

-- The last administrator cannot be removed ----------------------------------------------------
select private.grant_role('00000000-0000-0000-0000-0000000000c3', 'administrator');
select throws_ok(
  $$ select private.revoke_role('00000000-0000-0000-0000-0000000000c3', 'administrator') $$,
  'cannot remove the last administrator',
  'the last administrator cannot be revoked'
);
select private.grant_role('00000000-0000-0000-0000-0000000000a1', 'administrator');
select lives_ok(
  $$ select private.revoke_role('00000000-0000-0000-0000-0000000000c3', 'administrator') $$,
  'an administrator can be revoked while another one remains'
);
select private.grant_role('00000000-0000-0000-0000-0000000000c3', 'administrator');

-- Row level security, as the API roles ---------------------------------------------------------
-- alice (member + administrator), bob (member), carol (member + administrator)
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is(
  (select count(*) from public.user_roles),
  1::bigint,
  'a member only sees their own role assignments'
);
select is((select count(*) from public.roles), 0::bigint, 'a member cannot read the roles table');
select is((select count(*) from public.audit_log), 0::bigint, 'a member cannot read the audit log');
select ok(public.has_permission('exercises.run'), 'has_permission() answers for the signed-in user');
select throws_ok(
  $$ insert into public.user_roles (user_id, role_id) select '00000000-0000-0000-0000-0000000000b2', id from public.roles where name = 'administrator' $$,
  '42501',
  null,
  'a member cannot give themselves a role'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select ok(
  (select count(*) from public.user_roles) > 1,
  'an administrator sees every role assignment'
);
select ok((select count(*) from public.audit_log) > 0, 'an administrator can read the audit log');

select throws_ok(
  $$ select private.grant_role('00000000-0000-0000-0000-0000000000b2', 'administrator') $$,
  '42501',
  null,
  'even an administrator cannot call the role functions through the API'
);

reset role;

-- Anonymous visitors --------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select * from public.user_roles $$, '42501', null, 'anon cannot read role assignments');
reset role;

-- my_permissions(): every permission of the signed-in user in one call ---------------------------
select is(
  private.user_permissions('00000000-0000-0000-0000-0000000000a1'),
  (select array_agg(distinct permission order by permission) from public.role_permissions rp
     join public.user_roles ur on ur.role_id = rp.role_id
     where ur.user_id = '00000000-0000-0000-0000-0000000000a1'),
  'user_permissions() lists the permissions of the roles held'
);
select is(
  private.user_permissions('00000000-0000-0000-0000-00000000ffff'),
  '{}'::text[],
  'an unknown user has no permission'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select ok('cms.access' = any (public.my_permissions()), 'my_permissions() includes the permissions of the caller');
reset role;

set local role anon;
select throws_ok($$ select public.my_permissions() $$, '42501', null, 'anon cannot call my_permissions()');
reset role;

select * from finish();

rollback;

-- pgTAP tests for profiles, the age declaration and account deletion.
begin;

select plan(18);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@example.test', '{"avatar_url":"https://example.test/a.png"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.test', '{}'),
  ('00000000-0000-0000-0000-0000000000c3', 'carol@example.test', '{}');

select private.grant_role('00000000-0000-0000-0000-0000000000c3', 'administrator');

-- Creation ----------------------------------------------------------------------------------
select is(
  (select avatar_url from public.profiles where user_id = '00000000-0000-0000-0000-0000000000a1'),
  'https://example.test/a.png',
  'a profile is created with the account, with the provider avatar'
);
select ok(
  (select age_declared_at is null and not leaderboard_opt_in from public.profiles where user_id = '00000000-0000-0000-0000-0000000000b2'),
  'a new profile has no age declaration and is not on the leaderboard'
);

-- As alice ---------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select is((select count(*) from public.profiles), 1::bigint, 'an account only sees its own profile');

select throws_ok(
  $$ update public.profiles set age_declared_at = now() where user_id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501',
  null,
  'the age declaration cannot be written directly'
);

select lives_ok($$ select public.declare_age() $$, 'declare_age() works for a signed-in account');
select ok(
  (select age_declared_at is not null from public.profiles),
  'the age declaration is recorded'
);

select lives_ok(
  $$ update public.profiles set nickname = 'Alice_42' where user_id = '00000000-0000-0000-0000-0000000000a1' $$,
  'an account can choose its nickname'
);
select throws_ok(
  $$ update public.profiles set nickname = 'a' where user_id = '00000000-0000-0000-0000-0000000000a1' $$,
  '23514',
  null,
  'a nickname must be 3 to 20 safe characters'
);
select throws_ok(
  $$ update public.profiles set nickname = 'bad name!' where user_id = '00000000-0000-0000-0000-0000000000a1' $$,
  '23514',
  null,
  'a nickname cannot contain spaces or symbols'
);

-- Another account cannot take the same nickname, whatever the case ----------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select throws_ok(
  $$ update public.profiles set nickname = 'ALICE_42' where user_id = '00000000-0000-0000-0000-0000000000b2' $$,
  '23505',
  null,
  'nicknames are unique regardless of case'
);

-- bob cannot touch alice's profile: RLS hides the row, so nothing is updated (checked below as admin)
select lives_ok(
  $$ update public.profiles set leaderboard_opt_in = true where user_id = '00000000-0000-0000-0000-0000000000a1' $$,
  'updating someone else''s profile is a no-op'
);

-- An administrator sees every profile --------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
select is((select count(*) from public.profiles), 3::bigint, 'an account with users.manage sees every profile');
select is(
  (select leaderboard_opt_in::text from public.profiles where user_id = '00000000-0000-0000-0000-0000000000a1'),
  'false',
  'alice''s profile was not changed by bob'
);
reset role;

-- Anonymous ---------------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select public.delete_my_account() $$, '42501', null, 'anon cannot call delete_my_account()');
reset role;

-- Account deletion --------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select lives_ok($$ select public.delete_my_account() $$, 'an account can delete itself');
reset role;

select is(
  (select count(*) from auth.users u left join public.profiles p on p.user_id = u.id
    where u.id = '00000000-0000-0000-0000-0000000000b2' or p.user_id = '00000000-0000-0000-0000-0000000000b2'),
  0::bigint,
  'deleting the account removes the user and the profile'
);

-- The last administrator cannot delete their account (SSO only: no lock-out)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
select throws_ok(
  $$ select public.delete_my_account() $$,
  'cannot delete the last administrator',
  'the last administrator cannot delete their account'
);
reset role;

select * from finish();

rollback;

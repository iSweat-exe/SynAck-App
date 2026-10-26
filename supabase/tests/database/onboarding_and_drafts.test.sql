-- pgTAP tests for the onboarding answers and the drafts (run with `supabase test db`).
begin;

select plan(15);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.test');

-- As alice ---------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select lives_ok(
  $$ select public.save_onboarding('{"level":"beginner"}'::jsonb) $$,
  'a signed-in account saves its answers'
);
select lives_ok(
  $$ select public.save_onboarding('{"level":"advanced"}'::jsonb) $$,
  'saving again replaces the answers'
);
select is(
  (select answers ->> 'level' from public.onboarding),
  'advanced',
  'the latest answers are the ones kept'
);
select is((select count(*) from public.onboarding), 1::bigint, 'there is one row per account');
select throws_ok(
  $$ select public.save_onboarding('[1,2]'::jsonb) $$,
  '23514',
  null,
  'the answers must be an object'
);
select throws_ok(
  $$ insert into public.onboarding (user_id, answers)
     values ('00000000-0000-0000-0000-0000000000a1', '{}') $$,
  '42501',
  null,
  'the answers cannot be inserted directly'
);

select lives_ok(
  $$ select public.save_draft('fizzbuzz', 'python', 'print(1)') $$,
  'a signed-in account saves a draft'
);
select lives_ok(
  $$ select public.save_draft('fizzbuzz', 'python', 'print(2)') $$,
  'saving the same draft again replaces the code'
);
select is(
  (select code from public.drafts where exercise = 'fizzbuzz'),
  'print(2)',
  'the latest code is the one kept'
);
select throws_ok(
  $$ select public.save_draft('fizzbuzz', 'python', repeat('x', 20001)) $$,
  '23514',
  null,
  'a draft cannot exceed the size of an exercise'
);
select throws_ok(
  $$ select public.save_draft('fizzbuzz', 'cobol', 'x') $$,
  '23514',
  null,
  'a draft needs a known language'
);

-- As bob -----------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);

select is((select count(*) from public.onboarding), 0::bigint, 'an account never sees the answers of another');
select is((select count(*) from public.drafts), 0::bigint, 'an account never sees the drafts of another');

-- Deleting the account ------------------------------------------------------------------------
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000a1';

select is((select count(*) from public.onboarding), 0::bigint, 'deleting an account deletes its answers');
select is((select count(*) from public.drafts), 0::bigint, 'deleting an account deletes its drafts');

select * from finish();

rollback;

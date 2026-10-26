-- pgTAP tests for the progress of an account (run with `supabase test db`).
begin;

select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.test');

-- As alice ---------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select lives_ok(
  $$ select public.record_solved_exercise('fizzbuzz', 'python') $$,
  'a signed-in account records a solved exercise'
);
select lives_ok(
  $$ select public.record_solved_exercise('fizzbuzz', 'python') $$,
  'recording the same exercise again is harmless'
);
select is((select count(*) from public.solved_exercises), 1::bigint, 'an exercise is stored once');

select lives_ok(
  $$ select public.record_validated_protocol('tcp') $$,
  'a signed-in account records a validated protocol'
);
select is((select count(*) from public.validated_protocols), 1::bigint, 'a protocol is stored once');

select throws_ok(
  $$ insert into public.solved_exercises (user_id, exercise, language)
     values ('00000000-0000-0000-0000-0000000000a1', 'tips', 'python') $$,
  '42501',
  null,
  'a row cannot be inserted directly'
);
select throws_ok(
  $$ select public.record_solved_exercise('fizzbuzz', 'cobol') $$,
  '23514',
  null,
  'an unknown language is refused'
);
select throws_ok(
  $$ select public.record_solved_exercise('Not An Id!', 'python') $$,
  '23514',
  null,
  'an exercise id must be a plain slug'
);

-- As bob -----------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);

select is((select count(*) from public.solved_exercises), 0::bigint, 'an account never sees the exercises of another');
select is((select count(*) from public.validated_protocols), 0::bigint, 'an account never sees the protocols of another');

-- Signed out ---------------------------------------------------------------------------------
reset role;
set local role anon;

select throws_ok(
  $$ select public.record_solved_exercise('fizzbuzz', 'python') $$,
  '42501',
  null,
  'a signed-out client cannot record an exercise'
);
select throws_ok(
  $$ select count(*) from public.solved_exercises $$,
  '42501',
  null,
  'a signed-out client cannot read progress'
);

-- Deleting the account ------------------------------------------------------------------------
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000a1';

select is((select count(*) from public.solved_exercises), 0::bigint, 'deleting an account deletes its exercises');
select is((select count(*) from public.validated_protocols), 0::bigint, 'deleting an account deletes its protocols');

select * from finish();

rollback;

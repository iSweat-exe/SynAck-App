-- pgTAP tests for the numbers of a learner: experience, coins, level, streak
-- (run with `supabase test db`).
begin;

select plan(20);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'bob@example.test'),
  ('00000000-0000-0000-0000-0000000000c3', 'carol@example.test'),
  ('00000000-0000-0000-0000-0000000000d4', 'dave@example.test');

-- As alice: experience and coins --------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

do $$ begin perform public.record_solved_exercise('fibonacci', 'python'); end $$;

select is((select xp from public.my_stats), 10, 'an easy exercise earns 10 XP');
select is((select coins from public.my_stats), 5, 'an easy exercise earns 5 coins');

do $$ begin perform public.record_solved_exercise('fibonacci', 'javascript'); end $$;

select is((select xp from public.my_stats), 10, 'the same exercise in another language earns nothing more');
select is((select solved_count from public.my_stats), 1, 'an exercise is counted once, whatever the language');

do $$ begin perform public.record_solved_exercise('tips', 'python'); end $$;

select is((select xp from public.my_stats), 30, 'a medium exercise earns 20 XP');

do $$ begin perform public.record_validated_protocol('ssh'); end $$;

select is((select xp from public.my_stats), 60, 'a hard protocol earns 30 XP');
select is((select validated_count from public.my_stats), 1, 'a validated protocol is counted');

do $$ begin perform public.record_solved_exercise('brand_new', 'python'); end $$;

select is((select xp from public.my_stats), 60, 'an exercise the catalog does not know earns nothing');
select is((select solved_count from public.my_stats), 3, 'an exercise the catalog does not know is still counted');

do $$
begin
  perform public.record_validated_protocol('tls');
  perform public.record_solved_exercise('caesar', 'python');
end $$;

select is((select xp from public.my_stats), 110, 'experience adds up');
select is((select level from public.my_stats), 2, 'a level is 100 XP');
select is((select streak from public.my_stats), 1, 'doing something today starts a streak');

select throws_ok(
  $$ update public.player_stats set xp = 999999 $$,
  '42501',
  null,
  'nobody can write the numbers directly'
);
select throws_ok(
  $$ select count(*) from public.catalog_items $$,
  '42501',
  null,
  'the catalog is not readable through the API'
);

-- Streaks, with rows made by the server (a learner cannot choose a date) ------------------------
reset role;

insert into public.solved_exercises (user_id, exercise, language, solved_at) values
  ('00000000-0000-0000-0000-0000000000b2', 'fizzbuzz', 'python', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000b2', 'palindrome', 'python', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000b2', 'factorial', 'python', now()),
  ('00000000-0000-0000-0000-0000000000c3', 'fizzbuzz', 'python', now() - interval '3 days'),
  ('00000000-0000-0000-0000-0000000000c3', 'palindrome', 'python', now()),
  ('00000000-0000-0000-0000-0000000000d4', 'fizzbuzz', 'python', now() - interval '6 days'),
  ('00000000-0000-0000-0000-0000000000d4', 'palindrome', 'python', now() - interval '5 days');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select is((select streak from public.my_stats), 3, 'three days in a row make a streak of three');
select is((select count(*) from public.my_stats), 1::bigint, 'an account only sees its own numbers');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
select is((select streak from public.my_stats), 1, 'a missed day ends the streak: only today counts');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d4","role":"authenticated"}', true);
select is((select streak from public.my_stats), 0, 'a streak whose last day is older than yesterday is over');
select is((select best_streak from public.my_stats), 2, 'the best streak is remembered');

-- Deleting the account ------------------------------------------------------------------------
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000a1';

select is(
  (select count(*) from public.player_stats where user_id = '00000000-0000-0000-0000-0000000000a1'),
  0::bigint,
  'deleting an account deletes its numbers'
);

select * from finish();

rollback;

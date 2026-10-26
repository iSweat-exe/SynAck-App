-- The numbers of a learner, computed by the server: experience, coins, level, streak.
--
-- * `catalog_items` tells the server how hard each exercise and protocol is. It is the server's
--   copy of what the app ships (`exercise.json`, `src/protocols/data`): tests of the app fail when
--   the two differ, so a new exercise comes with a migration adding its row.
-- * `player_stats` is kept up to date by triggers on the progress tables. It is recomputed from
--   the rows each time, never incremented, so it cannot drift. Nobody writes it, not even the
--   learner's own account: it is a consequence of the progress, not a claim.
-- * The rules are the app's: 10, 20 or 30 XP and 5, 10 or 15 coins by difficulty, an exercise
--   counted once whatever the language, 100 XP per level.
-- * A day of the streak is a UTC day: the server has no better idea of where the learner is. The
--   app shows the streak in the learner's own days, so the two can differ by a day around
--   midnight.
-- * Coins are earned only: nothing can be bought yet, so there is nothing to subtract.

create table public.catalog_items (
  kind text not null check (kind in ('exercise', 'protocol')),
  id text not null check (id ~ '^[a-z0-9_-]{1,64}$'),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  primary key (kind, id)
);

-- Only the server's own functions read it.
alter table public.catalog_items enable row level security;
revoke all on public.catalog_items from anon, authenticated;

insert into public.catalog_items (kind, id, difficulty) values
  ('exercise', 'fibonacci', 'easy'),
  ('exercise', 'dict_sum', 'easy'),
  ('exercise', 'list_extend', 'easy'),
  ('exercise', 'fizzbuzz', 'easy'),
  ('exercise', 'max_in_list', 'easy'),
  ('exercise', 'count_vowels', 'easy'),
  ('exercise', 'palindrome', 'easy'),
  ('exercise', 'factorial', 'easy'),
  ('exercise', 'reverse_words', 'easy'),
  ('exercise', 'tips', 'medium'),
  ('exercise', 'primes', 'medium'),
  ('exercise', 'word_count', 'medium'),
  ('exercise', 'dedupe', 'medium'),
  ('exercise', 'change_coins', 'medium'),
  ('exercise', 'caesar', 'medium'),
  ('protocol', 'http', 'easy'),
  ('protocol', 'udp', 'easy'),
  ('protocol', 'dns', 'medium'),
  ('protocol', 'https', 'medium'),
  ('protocol', 'ipc', 'medium'),
  ('protocol', 'tcp', 'medium'),
  ('protocol', 'ssh', 'hard'),
  ('protocol', 'tls', 'hard');

create table public.player_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  coins integer not null default 0 check (coins >= 0),
  level integer not null default 1 check (level >= 1),
  -- The streak as of the last activity: `my_stats` shows it as of today.
  streak integer not null default 0 check (streak >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  last_active_on date,
  solved_count integer not null default 0 check (solved_count >= 0),
  validated_count integer not null default 0 check (validated_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.player_stats enable row level security;
revoke all on public.player_stats from anon, authenticated;
grant select on public.player_stats to authenticated;

create policy player_stats_select on public.player_stats
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Recomputes the numbers of an account from its progress.
create function private.refresh_player_stats(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_xp integer;
  v_coins integer;
  v_solved integer;
  v_validated integer;
  v_streak integer;
  v_best integer;
  v_last date;
begin
  select count(distinct exercise) into v_solved
  from public.solved_exercises where user_id = p_user;

  select count(*) into v_validated
  from public.validated_protocols where user_id = p_user;

  -- An exercise counts once, in whichever language it was solved. One the catalog does not know
  -- is counted but earns nothing.
  select
    coalesce(sum(case c.difficulty when 'easy' then 10 when 'medium' then 20 else 30 end), 0),
    coalesce(sum(case c.difficulty when 'easy' then 5 when 'medium' then 10 else 15 end), 0)
  into v_xp, v_coins
  from (
    select distinct 'exercise'::text as kind, exercise as id
    from public.solved_exercises where user_id = p_user
    union all
    select 'protocol'::text, protocol
    from public.validated_protocols where user_id = p_user
  ) done
  join public.catalog_items c on c.kind = done.kind and c.id = done.id;

  -- Runs of consecutive days: days minus their rank is constant inside a run.
  with days as (
    select (solved_at at time zone 'utc')::date as d
    from public.solved_exercises where user_id = p_user
    union
    select (validated_at at time zone 'utc')::date
    from public.validated_protocols where user_id = p_user
  ),
  runs as (
    select count(*) as n, max(d) as last_d
    from (select d, d - (row_number() over (order by d))::integer as g from days) ranked
    group by g
  )
  select
    coalesce(max(n), 0),
    max(last_d),
    coalesce((select n from runs order by last_d desc limit 1), 0)
  into v_best, v_last, v_streak
  from runs;

  -- A streak lives until a whole day has been missed.
  if v_last is null or v_last < (now() at time zone 'utc')::date - 1 then
    v_streak := 0;
  end if;

  insert into public.player_stats
    (user_id, xp, coins, level, streak, best_streak, last_active_on, solved_count, validated_count, updated_at)
  values
    (p_user, v_xp, v_coins, v_xp / 100 + 1, v_streak, v_best, v_last, v_solved, v_validated, now())
  on conflict (user_id) do update set
    xp = excluded.xp,
    coins = excluded.coins,
    level = excluded.level,
    streak = excluded.streak,
    best_streak = excluded.best_streak,
    last_active_on = excluded.last_active_on,
    solved_count = excluded.solved_count,
    validated_count = excluded.validated_count,
    updated_at = excluded.updated_at;
end;
$$;

create function private.progress_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_player_stats(new.user_id);
  return null;
end;
$$;

revoke all on function private.refresh_player_stats(uuid) from public, anon, authenticated;
revoke all on function private.progress_changed() from public, anon, authenticated;

create trigger solved_exercises_changed
  after insert on public.solved_exercises
  for each row execute function private.progress_changed();

create trigger validated_protocols_changed
  after insert on public.validated_protocols
  for each row execute function private.progress_changed();

-- What the app and the learner read: the stored numbers, with the streak as of today. Row level
-- security of `player_stats` applies, so an account only ever sees its own line.
create view public.my_stats with (security_invoker = true) as
select
  user_id,
  xp,
  coins,
  level,
  case
    when last_active_on >= (now() at time zone 'utc')::date - 1 then streak
    else 0
  end as streak,
  best_streak,
  last_active_on,
  solved_count,
  validated_count,
  updated_at
from public.player_stats;

revoke all on public.my_stats from anon, authenticated;
grant select on public.my_stats to authenticated;

-- Accounts that already have progress get their numbers now.
select private.refresh_player_stats(user_id)
from (
  select user_id from public.solved_exercises
  union
  select user_id from public.validated_protocols
) accounts;

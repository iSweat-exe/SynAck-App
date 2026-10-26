-- Progress of an account: the exercises it solved and the protocols it validated.
--
-- * The tables are read-only for the API. Rows are added by `record_solved_exercise()` and
--   `record_validated_protocol()`, which check what they are given and never overwrite a row.
-- * The check itself runs on the learner's machine (the Rust side of the app), so a row is a claim
--   from a client we do not control: this is bookkeeping, not proof (see CLAUDE.md, "Données et
--   Supabase"). Anything that must be trusted, like a leaderboard, has to be judged here.
-- * Experience, coins and levels are not stored: they are computed from these rows.

create table public.solved_exercises (
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise text not null check (exercise ~ '^[a-z0-9_-]{1,64}$'),
  language text not null check (language in ('python', 'javascript', 'go', 'rust', 'c', 'cpp')),
  solved_at timestamptz not null default now(),
  primary key (user_id, exercise, language)
);

create table public.validated_protocols (
  user_id uuid not null references auth.users (id) on delete cascade,
  protocol text not null check (protocol ~ '^[a-z0-9_-]{1,64}$'),
  validated_at timestamptz not null default now(),
  primary key (user_id, protocol)
);

alter table public.solved_exercises enable row level security;
alter table public.validated_protocols enable row level security;

revoke all on public.solved_exercises, public.validated_protocols from anon, authenticated;
grant select on public.solved_exercises, public.validated_protocols to authenticated;

create policy solved_exercises_select on public.solved_exercises
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy validated_protocols_select on public.validated_protocols
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Records a solved exercise for the signed-in account. Doing it again keeps the first date.
create function public.record_solved_exercise(p_exercise text, p_language text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.solved_exercises (user_id, exercise, language)
  values ((select auth.uid()), p_exercise, p_language)
  on conflict do nothing;
$$;

-- Records a validated protocol for the signed-in account. Doing it again keeps the first date.
create function public.record_validated_protocol(p_protocol text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.validated_protocols (user_id, protocol)
  values ((select auth.uid()), p_protocol)
  on conflict do nothing;
$$;

revoke all on function public.record_solved_exercise(text, text) from public, anon;
revoke all on function public.record_validated_protocol(text) from public, anon;
grant execute on function public.record_solved_exercise(text, text) to authenticated;
grant execute on function public.record_validated_protocol(text) to authenticated;

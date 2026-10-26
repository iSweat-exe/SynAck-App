-- What an account told the app about itself, and the code it is writing in exercises it has not
-- finished. Same model as the progress tables: read-only for the API, written by functions that
-- check what they are given (see 20261026180000_progress.sql).

-- The answers of the first-launch questions, one row per account, kept as JSON: the questions
-- change over time and the app (not the database) knows how to read them.
create table public.onboarding (
  user_id uuid primary key references auth.users (id) on delete cascade,
  answers jsonb not null check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 4000),
  updated_at timestamptz not null default now()
);

-- The code of an exercise in progress, one row per account, exercise and language.
create table public.drafts (
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise text not null check (exercise ~ '^[a-z0-9_-]{1,64}$'),
  language text not null check (language in ('python', 'javascript', 'go', 'rust', 'c', 'cpp')),
  code text not null check (octet_length(code) <= 20000),
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise, language)
);

alter table public.onboarding enable row level security;
alter table public.drafts enable row level security;

revoke all on public.onboarding, public.drafts from anon, authenticated;
grant select on public.onboarding, public.drafts to authenticated;

create policy onboarding_select on public.onboarding
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy drafts_select on public.drafts
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Saves the answers of the signed-in account, replacing the earlier ones.
create function public.save_onboarding(p_answers jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.onboarding (user_id, answers)
  values ((select auth.uid()), p_answers)
  on conflict (user_id) do update
    set answers = excluded.answers, updated_at = now();
$$;

-- Saves the code the signed-in account is writing, replacing the earlier draft.
create function public.save_draft(p_exercise text, p_language text, p_code text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.drafts (user_id, exercise, language, code)
  values ((select auth.uid()), p_exercise, p_language, p_code)
  on conflict (user_id, exercise, language) do update
    set code = excluded.code, updated_at = now();
$$;

revoke all on function public.save_onboarding(jsonb) from public, anon;
revoke all on function public.save_draft(text, text, text) from public, anon;
grant execute on function public.save_onboarding(jsonb) to authenticated;
grant execute on function public.save_draft(text, text, text) to authenticated;

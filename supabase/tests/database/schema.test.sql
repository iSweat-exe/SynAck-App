-- pgTAP tests, run with `supabase test db` (and by the "DB migrations" CI job).
begin;

select plan(4);

select has_schema('payload', 'the payload schema exists');

select schema_privs_are('payload', 'anon', array[]::text[], 'anon has no privileges on the payload schema');

select schema_privs_are('payload', 'authenticated', array[]::text[], 'authenticated has no privileges on the payload schema');

select is(
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity),
  0::bigint,
  'row level security is enabled on every public table'
);

select * from finish();

rollback;

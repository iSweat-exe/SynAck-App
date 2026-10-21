-- Dedicated schema for the Payload CMS tables (README §3 and §7).
-- It lives in the same database as the application data but is never exposed through the Supabase API:
-- Payload connects with its own privileged connection, so the API roles get no access at all.

create schema if not exists payload;

revoke all on schema payload from public, anon, authenticated;

alter default privileges in schema payload revoke all on tables from anon, authenticated;
alter default privileges in schema payload revoke all on sequences from anon, authenticated;
alter default privileges in schema payload revoke all on functions from anon, authenticated;

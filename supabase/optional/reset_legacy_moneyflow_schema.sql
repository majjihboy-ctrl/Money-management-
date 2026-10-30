-- OPTIONAL + DESTRUCTIVE. Only for a Supabase project that already has the OLD "MoneyFlow" (Expo) schema applied.
-- Deletes EVERYTHING in the public schema (tables, data, functions, the on_auth_user_created trigger).
-- It does NOT touch auth.users. Skip this and use a brand-new Supabase project if you can.
-- Run it once in the SQL editor, then run 0001_init.sql and 0002_functions.sql.
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;

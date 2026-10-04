-- Harden the automatic-RLS event-trigger function.
-- It is an internal event-trigger implementation and must not live in the exposed public schema.

create schema if not exists private;

alter function public.rls_auto_enable() set schema private;

-- SECURITY DEFINER is required for the event trigger, but the function must not
-- be callable through the Data API by public/anon/authenticated roles.
revoke execute on function private.rls_auto_enable() from public;
revoke execute on function private.rls_auto_enable() from anon;
revoke execute on function private.rls_auto_enable() from authenticated;

-- Keep the privileged function's name resolution pinned to a trusted schema.
alter function private.rls_auto_enable()
  set search_path = pg_catalog;

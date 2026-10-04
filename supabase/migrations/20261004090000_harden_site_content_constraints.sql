-- Defense in depth for site content managed through the Node.js API.
-- The API also validates keys and values before writing to Supabase.

alter table public.site_content
  drop constraint if exists site_content_key_format;

alter table public.site_content
  drop constraint if exists site_content_value_length;

alter table public.site_content
  add constraint site_content_key_format
  check (content_key ~ '^[A-Za-z0-9_.-]{1,120}$');

alter table public.site_content
  add constraint site_content_value_length
  check (char_length(content_value) <= 10000);

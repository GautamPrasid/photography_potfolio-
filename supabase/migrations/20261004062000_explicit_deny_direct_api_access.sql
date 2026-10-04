-- Keep RLS explicit for the server-only data model.
-- The Node.js API uses the server-side privileged Supabase key, while direct
-- anon/authenticated Data API access is denied for these application tables.

do $$
declare
  t text;
  tables text[] := array[
    'cms_state',
    'media',
    'navigation_items',
    'portfolio_item_sections',
    'portfolio_items',
    'sections',
    'site_content',
    'skills',
    'social_link_locations',
    'social_links'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "deny_direct_api_access" on public.%I', t);
    execute format(
      'create policy "deny_direct_api_access" on public.%I for all to anon, authenticated using (false) with check (false)',
      t
    );
  end loop;
end
$$;

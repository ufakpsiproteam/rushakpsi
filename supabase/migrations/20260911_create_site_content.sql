-- Rushing copy — admin-editable content (people/links/dates/FAQ/decision
-- letters/etc) that changes semester to semester. Mirrors app_config's
-- shape and RLS exactly: one row, a jsonb blob, public read, admin write.
--
-- The row is seeded with content = '{}' deliberately. Every field's actual
-- current text lives only in lib/siteContent.ts (SITE_CONTENT_DEFAULTS);
-- an empty override row means every page renders exactly what it rendered
-- before this table existed, until an admin edits something.

create table if not exists public.site_content (
  id boolean primary key default true,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.brothers(id),
  constraint site_content_singleton check (id)
);

insert into public.site_content (id, content)
values (true, '{}'::jsonb)
on conflict (id) do nothing;

alter table public.site_content enable row level security;

create policy "Anyone can read site content"
  on public.site_content
  for select
  to public
  using (true);

create policy "Admins can write site content"
  on public.site_content
  for all
  to authenticated
  using (fn_is_admin())
  with check (fn_is_admin());

grant select on public.site_content to anon, authenticated;
grant insert, update, delete on public.site_content to authenticated;
grant all on public.site_content to service_role;

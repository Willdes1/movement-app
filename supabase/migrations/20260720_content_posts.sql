-- Public blog / content engine (Phase 1 of the Marketing Hub — TODO #6).
-- ADDITIVE + REVERSIBLE (drop table to undo). Admin generates + reviews drafts;
-- only status='published' rows are ever readable by the public /blog routes.

create table if not exists public.content_posts (
  id               uuid        primary key default gen_random_uuid(),
  slug             text        not null unique,
  title            text        not null,
  meta_description text,
  excerpt          text,
  body             text,                                     -- markdown
  category         text,                                     -- topic cluster id (e.g. 'coach-software')
  tags             text[]      not null default '{}',
  cover_emoji      text,
  status           text        not null default 'draft',     -- 'draft' | 'published'
  author           text        not null default 'Atlas Prime',
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists content_posts_status_pub_idx
  on public.content_posts (status, published_at desc);

alter table public.content_posts enable row level security;

-- Public/anon can read ONLY published posts. Drafts stay invisible outside the
-- service role (which the admin routes use). Idempotent policy create.
drop policy if exists content_posts_public_read on public.content_posts;
create policy content_posts_public_read on public.content_posts
  for select using (status = 'published');

grant all on public.content_posts to service_role;
grant select on public.content_posts to anon, authenticated;

-- Self-register in the migration ledger (no-op if the ledger doesn't exist yet).
DO $$ BEGIN
  INSERT INTO public.applied_migrations (filename)
  VALUES ('20260720_content_posts.sql') ON CONFLICT (filename) DO NOTHING;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- To undo:  drop table if exists public.content_posts;

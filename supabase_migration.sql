-- ==============================================================================
-- Supabase PostgreSQL Complete Setup, RLS Policies & Seed Script
-- Project: Photography Portfolio CMS
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/xdhusmmqkgzflxixrbis/sql/new
-- ==============================================================================

-- ── 1. Create Tables ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  slug TEXT UNIQUE NOT NULL,
  is_visible BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  is_system BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  width INTEGER,
  height INTEGER,
  alt_text TEXT DEFAULT '',
  ai_metadata TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_items (
  id TEXT PRIMARY KEY,
  media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT '',
  location TEXT DEFAULT '',
  photo_date TEXT DEFAULT '',
  tags TEXT DEFAULT '',
  is_featured BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT TRUE,
  is_hidden BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_item_sections (
  portfolio_item_id TEXT REFERENCES portfolio_items(id) ON DELETE CASCADE,
  section_id TEXT REFERENCES sections(id) ON DELETE CASCADE,
  PRIMARY KEY (portfolio_item_id, section_id)
);

CREATE TABLE IF NOT EXISTS social_links (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  display_name TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT NOT NULL,
  is_visible BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS social_link_locations (
  social_link_id TEXT REFERENCES social_links(id) ON DELETE CASCADE,
  location TEXT NOT NULL,
  PRIMARY KEY (social_link_id, location)
);

CREATE TABLE IF NOT EXISTS site_content (
  content_key TEXT PRIMARY KEY,
  content_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS navigation_items (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT DEFAULT '',
  is_visible BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  percent INTEGER DEFAULT 0,
  icon TEXT DEFAULT '',
  is_visible BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0
);

-- ── 2. Storage Bucket Setup & Permissions ─────────────────────────────────────

-- Create public portfolio bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'portfolio',
  'portfolio',
  TRUE,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml'];

-- Storage Object Policies (Read, Upload, Update, Delete for portfolio bucket)
DROP POLICY IF EXISTS "Public Read Storage Objects" ON storage.objects;
DROP POLICY IF EXISTS "Allow Upload Storage Objects" ON storage.objects;
DROP POLICY IF EXISTS "Allow Update Storage Objects" ON storage.objects;
DROP POLICY IF EXISTS "Allow Delete Storage Objects" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

CREATE POLICY "Public Read Storage Objects"
ON storage.objects FOR SELECT
USING (bucket_id = 'portfolio');

CREATE POLICY "Allow Upload Storage Objects"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'portfolio');

CREATE POLICY "Allow Update Storage Objects"
ON storage.objects FOR UPDATE
USING (bucket_id = 'portfolio')
WITH CHECK (bucket_id = 'portfolio');

CREATE POLICY "Allow Delete Storage Objects"
ON storage.objects FOR DELETE
USING (bucket_id = 'portfolio');

-- ── 3. Table Row-Level Security (RLS) Full CRUD Policies ──────────────────────

ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_item_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_link_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE navigation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

-- Drop old single-action policies to prevent conflicts
DROP POLICY IF EXISTS "Public read sections" ON sections;
DROP POLICY IF EXISTS "Public read media" ON media;
DROP POLICY IF EXISTS "Public read portfolio_items" ON portfolio_items;
DROP POLICY IF EXISTS "Public read portfolio_item_sections" ON portfolio_item_sections;
DROP POLICY IF EXISTS "Public read social_links" ON social_links;
DROP POLICY IF EXISTS "Public read social_link_locations" ON social_link_locations;
DROP POLICY IF EXISTS "Public read site_content" ON site_content;
DROP POLICY IF EXISTS "Public read navigation_items" ON navigation_items;
DROP POLICY IF EXISTS "Public read skills" ON skills;

DROP POLICY IF EXISTS "Allow all on sections" ON sections;
DROP POLICY IF EXISTS "Allow all on media" ON media;
DROP POLICY IF EXISTS "Allow all on portfolio_items" ON portfolio_items;
DROP POLICY IF EXISTS "Allow all on portfolio_item_sections" ON portfolio_item_sections;
DROP POLICY IF EXISTS "Allow all on social_links" ON social_links;
DROP POLICY IF EXISTS "Allow all on social_link_locations" ON social_link_locations;
DROP POLICY IF EXISTS "Allow all on site_content" ON site_content;
DROP POLICY IF EXISTS "Allow all on navigation_items" ON navigation_items;
DROP POLICY IF EXISTS "Allow all on skills" ON skills;

-- Full CRUD policies so admin panel writes & public reads both succeed seamlessly
CREATE POLICY "Allow all on sections" ON sections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on media" ON media FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on portfolio_items" ON portfolio_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on portfolio_item_sections" ON portfolio_item_sections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on social_links" ON social_links FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on social_link_locations" ON social_link_locations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on site_content" ON site_content FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on navigation_items" ON navigation_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on skills" ON skills FOR ALL USING (true) WITH CHECK (true);

-- ── 4. Seed Data from Local SQLite ───────────────────────────────────────────

-- ── Table: sections (11 rows) ───────────────────────────────────
INSERT INTO sections (id, name, title, description, slug, is_visible, display_order, is_system) VALUES ('home', 'Homepage', 'Homepage', '', 'homepage', TRUE, 0, TRUE) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, title = EXCLUDED.title, description = EXCLUDED.description, slug = EXCLUDED.slug, is_visible = EXCLUDED.is_visible, display_order = EXCLUDED.display_order, is_system = EXCLUDED.is_system;
INSERT INTO sections (id, name, title, description, slug, is_visible, display_order, is_system) VALUES ('portfolio', 'Portfolio', 'Portfolio', '', 'portfolio', TRUE, 1, TRUE) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, title = EXCLUDED.title, description = EXCLUDED.description, slug = EXCLUDED.slug, is_visible = EXCLUDED.is_visible, display_order = EXCLUDED.display_order, is_system = EXCLUDED.is_system;
INSERT INTO sections (id, name, title, description, slug, is_visible, display_order, is_system) VALUES ('gallery', 'Gallery', 'Gallery', '', 'gallery', TRUE, 2, TRUE) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, title = EXCLUDED.title, description = EXCLUDED.description, slug = EXCLUDED.slug, is_visible = EXCLUDED.is_visible, display_order = EXCLUDED.display_order, is_system = EXCLUDED.is_system;
INSERT INTO sections (id, name, title, description, slug, is_visible, display_order, is_system) VALUES ('featured', 'Featured', 'Featured', '', 'featured', TRUE, 3, TRUE) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, title = EXCLUDED.title, description = EXCLUDED.description, slug = EXCLUDED.slug, is_visible = EXCLUDED.is_visible, display_order = EXCLUDED.display_order, is_system = EXCLUDED.is_system;
INSERT INTO sections (id, name, title, description, slug, is_visible, display_order, is_system) VALUES ('about', 'About', 'About', '', 'about', TRUE, 4, TRUE) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, title = EXCLUDED.title, description = EXCLUDED.description, slug = EXCLUDED.slug, is_visible = EXCLUDED.is_visible, display_order = EXCLUDED.display_order, is_system = EXCLUDED.is_system;
INSERT INTO sections (id, name, title, description, slug, is_visible, display_order, is_system) VALUES ('contact', 'Contact', 'Contact', '', 'contact', TRUE, 5, TRUE) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, title = EXCLUDED.title, description = EXCLUDED.description, slug = EXCLUDED.slug, is_visible = EXCLUDED.is_visible, display_order = EXCLUDED.display_order, is_system = EXCLUDED.is_system;
INSERT INTO sections (id, name, title, description, slug, is_visible, display_order, is_system) VALUES ('nature', 'Nature', 'Nature', '', 'nature', TRUE, 6, FALSE) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, title = EXCLUDED.title, description = EXCLUDED.description, slug = EXCLUDED.slug, is_visible = EXCLUDED.is_visible, display_order = EXCLUDED.display_order, is_system = EXCLUDED.is_system;
INSERT INTO sections (id, name, title, description, slug, is_visible, display_order, is_system) VALUES ('portrait', 'Portrait', 'Portrait', '', 'portrait', TRUE, 7, FALSE) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, title = EXCLUDED.title, description = EXCLUDED.description, slug = EXCLUDED.slug, is_visible = EXCLUDED.is_visible, display_order = EXCLUDED.display_order, is_system = EXCLUDED.is_system;
INSERT INTO sections (id, name, title, description, slug, is_visible, display_order, is_system) VALUES ('urban', 'Urban', 'Urban', '', 'urban', TRUE, 8, FALSE) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, title = EXCLUDED.title, description = EXCLUDED.description, slug = EXCLUDED.slug, is_visible = EXCLUDED.is_visible, display_order = EXCLUDED.display_order, is_system = EXCLUDED.is_system;
INSERT INTO sections (id, name, title, description, slug, is_visible, display_order, is_system) VALUES ('travel', 'Travel', 'Travel', '', 'travel', TRUE, 9, FALSE) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, title = EXCLUDED.title, description = EXCLUDED.description, slug = EXCLUDED.slug, is_visible = EXCLUDED.is_visible, display_order = EXCLUDED.display_order, is_system = EXCLUDED.is_system;
INSERT INTO sections (id, name, title, description, slug, is_visible, display_order, is_system) VALUES ('blackwhite', 'B&W', 'Black & White', '', 'blackwhite', TRUE, 10, FALSE) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, title = EXCLUDED.title, description = EXCLUDED.description, slug = EXCLUDED.slug, is_visible = EXCLUDED.is_visible, display_order = EXCLUDED.display_order, is_system = EXCLUDED.is_system;

-- ── Table: media (12 rows) ───────────────────────────────────
INSERT INTO media (id, file_name, file_url, mime_type, alt_text, created_at, ai_metadata) VALUES ('2cfea5cd-2d4d-49b0-bbb8-60289bdf1f52', 'portfolio-1.png', '/assets/portfolio-1.png', 'image/png', 'A clear shot of a mountain peak under a blue sky.', '2026-10-02 16:09:16', '{"subject":"mountain peak","scene":"alpine region","mood":"majestic","lighting":"daylight","composition":"wide shot","style":"landscape photography","analyzedAt":"2026-10-03T12:29:39.340Z"}') ON CONFLICT (id) DO UPDATE SET file_name = EXCLUDED.file_name, file_url = EXCLUDED.file_url, mime_type = EXCLUDED.mime_type, alt_text = EXCLUDED.alt_text, created_at = EXCLUDED.created_at, ai_metadata = EXCLUDED.ai_metadata;
INSERT INTO media (id, file_name, file_url, mime_type, alt_text, created_at, ai_metadata) VALUES ('be225ddd-b244-4ec5-96e7-2cd267a00b84', 'portfolio-2.png', '/assets/portfolio-2.png', 'image/png', 'Urban architecture', '2026-10-02 16:09:16', NULL) ON CONFLICT (id) DO UPDATE SET file_name = EXCLUDED.file_name, file_url = EXCLUDED.file_url, mime_type = EXCLUDED.mime_type, alt_text = EXCLUDED.alt_text, created_at = EXCLUDED.created_at, ai_metadata = EXCLUDED.ai_metadata;
INSERT INTO media (id, file_name, file_url, mime_type, alt_text, created_at, ai_metadata) VALUES ('a462f0a6-6f7c-4b4e-a378-f0cb03b6825a', 'portfolio-3.png', '/assets/portfolio-3.png', 'image/png', 'Portrait photography', '2026-10-02 16:09:16', NULL) ON CONFLICT (id) DO UPDATE SET file_name = EXCLUDED.file_name, file_url = EXCLUDED.file_url, mime_type = EXCLUDED.mime_type, alt_text = EXCLUDED.alt_text, created_at = EXCLUDED.created_at, ai_metadata = EXCLUDED.ai_metadata;
INSERT INTO media (id, file_name, file_url, mime_type, alt_text, created_at, ai_metadata) VALUES ('8283a699-22cb-4fff-bce3-af8c6c372551', 'portfolio-4.png', '/assets/portfolio-4.png', 'image/png', 'Travel photography', '2026-10-02 16:09:16', NULL) ON CONFLICT (id) DO UPDATE SET file_name = EXCLUDED.file_name, file_url = EXCLUDED.file_url, mime_type = EXCLUDED.mime_type, alt_text = EXCLUDED.alt_text, created_at = EXCLUDED.created_at, ai_metadata = EXCLUDED.ai_metadata;
INSERT INTO media (id, file_name, file_url, mime_type, alt_text, created_at, ai_metadata) VALUES ('23fdd2c5-6e23-4141-9d34-0a22e1579ff7', 'portfolio-5.png', '/assets/portfolio-5.png', 'image/png', 'Verification alt', '2026-10-02 16:09:16', NULL) ON CONFLICT (id) DO UPDATE SET file_name = EXCLUDED.file_name, file_url = EXCLUDED.file_url, mime_type = EXCLUDED.mime_type, alt_text = EXCLUDED.alt_text, created_at = EXCLUDED.created_at, ai_metadata = EXCLUDED.ai_metadata;
INSERT INTO media (id, file_name, file_url, mime_type, alt_text, created_at, ai_metadata) VALUES ('78c9530b-bbd9-4746-bfe2-ec6ab43c12a0', 'portfolio-6.jpg', '/assets/portfolio-6.jpg', 'image/jpeg', 'Black and white photography', '2026-10-02 16:09:16', NULL) ON CONFLICT (id) DO UPDATE SET file_name = EXCLUDED.file_name, file_url = EXCLUDED.file_url, mime_type = EXCLUDED.mime_type, alt_text = EXCLUDED.alt_text, created_at = EXCLUDED.created_at, ai_metadata = EXCLUDED.ai_metadata;
INSERT INTO media (id, file_name, file_url, mime_type, alt_text, created_at, ai_metadata) VALUES ('bc9bdb37-4bc5-409e-a434-bd7db772303d', 'portfolio-7.png', '/assets/portfolio-7.png', 'image/png', 'Urban life', '2026-10-02 16:09:16', NULL) ON CONFLICT (id) DO UPDATE SET file_name = EXCLUDED.file_name, file_url = EXCLUDED.file_url, mime_type = EXCLUDED.mime_type, alt_text = EXCLUDED.alt_text, created_at = EXCLUDED.created_at, ai_metadata = EXCLUDED.ai_metadata;
INSERT INTO media (id, file_name, file_url, mime_type, alt_text, created_at, ai_metadata) VALUES ('248d5958-89fd-4d8a-ad19-42feb55e05f3', 'portfolio-8.jpg', '/assets/portfolio-8.jpg', 'image/jpeg', 'Natural landscape', '2026-10-02 16:09:16', NULL) ON CONFLICT (id) DO UPDATE SET file_name = EXCLUDED.file_name, file_url = EXCLUDED.file_url, mime_type = EXCLUDED.mime_type, alt_text = EXCLUDED.alt_text, created_at = EXCLUDED.created_at, ai_metadata = EXCLUDED.ai_metadata;
INSERT INTO media (id, file_name, file_url, mime_type, alt_text, created_at, ai_metadata) VALUES ('7e9f0de5-9513-4ac4-9291-e6a0256d4aa2', 'portfolio-9.jpg', '/assets/portfolio-9.jpg', 'image/jpeg', 'Travel scene', '2026-10-02 16:09:16', NULL) ON CONFLICT (id) DO UPDATE SET file_name = EXCLUDED.file_name, file_url = EXCLUDED.file_url, mime_type = EXCLUDED.mime_type, alt_text = EXCLUDED.alt_text, created_at = EXCLUDED.created_at, ai_metadata = EXCLUDED.ai_metadata;
INSERT INTO media (id, file_name, file_url, mime_type, alt_text, created_at, ai_metadata) VALUES ('6184cbe6-e828-48aa-9974-ffffd2654f18', 'portfolio-10.jpg', '/assets/portfolio-10.jpg', 'image/jpeg', 'Portrait study', '2026-10-02 16:09:16', NULL) ON CONFLICT (id) DO UPDATE SET file_name = EXCLUDED.file_name, file_url = EXCLUDED.file_url, mime_type = EXCLUDED.mime_type, alt_text = EXCLUDED.alt_text, created_at = EXCLUDED.created_at, ai_metadata = EXCLUDED.ai_metadata;
INSERT INTO media (id, file_name, file_url, mime_type, alt_text, created_at, ai_metadata) VALUES ('b9e0ec34-f3d5-4fa1-a33c-d380e00b0907', 'portfolio-11.jpg', '/assets/portfolio-11.jpg', 'image/jpeg', 'Monochrome photography', '2026-10-02 16:09:16', NULL) ON CONFLICT (id) DO UPDATE SET file_name = EXCLUDED.file_name, file_url = EXCLUDED.file_url, mime_type = EXCLUDED.mime_type, alt_text = EXCLUDED.alt_text, created_at = EXCLUDED.created_at, ai_metadata = EXCLUDED.ai_metadata;
INSERT INTO media (id, file_name, file_url, mime_type, alt_text, created_at, ai_metadata) VALUES ('4c311b74-d6e4-4e1a-8a8e-10aeecc263be', 'portfolio-12.jpg', '/assets/portfolio-12.jpg', 'image/jpeg', 'City architecture', '2026-10-02 16:09:16', NULL) ON CONFLICT (id) DO UPDATE SET file_name = EXCLUDED.file_name, file_url = EXCLUDED.file_url, mime_type = EXCLUDED.mime_type, alt_text = EXCLUDED.alt_text, created_at = EXCLUDED.created_at, ai_metadata = EXCLUDED.ai_metadata;

-- ── Table: portfolio_items (12 rows) ───────────────────────────────────
INSERT INTO portfolio_items (id, media_id, title, description, category, location, photo_date, tags, is_featured, is_published, display_order, created_at, updated_at, is_hidden) VALUES ('92b79d7f-dd6f-4595-85be-72000f65a480', '2cfea5cd-2d4d-49b0-bbb8-60289bdf1f52', 'Mountain View', 'Beautiful mountain view.', 'nature', '', '', '', FALSE, FALSE, 0, '2026-10-02 16:09:16', '2026-10-03 12:29:39', FALSE) ON CONFLICT (id) DO UPDATE SET media_id = EXCLUDED.media_id, title = EXCLUDED.title, description = EXCLUDED.description, category = EXCLUDED.category, location = EXCLUDED.location, photo_date = EXCLUDED.photo_date, tags = EXCLUDED.tags, is_featured = EXCLUDED.is_featured, is_published = EXCLUDED.is_published, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, is_hidden = EXCLUDED.is_hidden;
INSERT INTO portfolio_items (id, media_id, title, description, category, location, photo_date, tags, is_featured, is_published, display_order, created_at, updated_at, is_hidden) VALUES ('d42a0440-8987-4dcc-8c80-4d655a6b3f0b', 'be225ddd-b244-4ec5-96e7-2cd267a00b84', 'City View', 'Urban architecture', 'urban', '', '', '', FALSE, TRUE, 1, '2026-10-02 16:09:16', '2026-10-02 16:44:31', FALSE) ON CONFLICT (id) DO UPDATE SET media_id = EXCLUDED.media_id, title = EXCLUDED.title, description = EXCLUDED.description, category = EXCLUDED.category, location = EXCLUDED.location, photo_date = EXCLUDED.photo_date, tags = EXCLUDED.tags, is_featured = EXCLUDED.is_featured, is_published = EXCLUDED.is_published, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, is_hidden = EXCLUDED.is_hidden;
INSERT INTO portfolio_items (id, media_id, title, description, category, location, photo_date, tags, is_featured, is_published, display_order, created_at, updated_at, is_hidden) VALUES ('ed82be12-2543-48d0-b9a2-cb0b50711e5a', 'a462f0a6-6f7c-4b4e-a378-f0cb03b6825a', 'Portrait', 'Portrait photography', 'portrait', '', '', '', FALSE, TRUE, 2, '2026-10-02 16:09:16', '2026-10-02 16:44:31', FALSE) ON CONFLICT (id) DO UPDATE SET media_id = EXCLUDED.media_id, title = EXCLUDED.title, description = EXCLUDED.description, category = EXCLUDED.category, location = EXCLUDED.location, photo_date = EXCLUDED.photo_date, tags = EXCLUDED.tags, is_featured = EXCLUDED.is_featured, is_published = EXCLUDED.is_published, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, is_hidden = EXCLUDED.is_hidden;
INSERT INTO portfolio_items (id, media_id, title, description, category, location, photo_date, tags, is_featured, is_published, display_order, created_at, updated_at, is_hidden) VALUES ('157c91a1-3509-4537-91e8-c16dee7d56a0', '8283a699-22cb-4fff-bce3-af8c6c372551', 'Travel', 'Travel photography', 'travel', '', '', '', FALSE, TRUE, 3, '2026-10-02 16:09:16', '2026-10-02 16:44:31', FALSE) ON CONFLICT (id) DO UPDATE SET media_id = EXCLUDED.media_id, title = EXCLUDED.title, description = EXCLUDED.description, category = EXCLUDED.category, location = EXCLUDED.location, photo_date = EXCLUDED.photo_date, tags = EXCLUDED.tags, is_featured = EXCLUDED.is_featured, is_published = EXCLUDED.is_published, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, is_hidden = EXCLUDED.is_hidden;
INSERT INTO portfolio_items (id, media_id, title, description, category, location, photo_date, tags, is_featured, is_published, display_order, created_at, updated_at, is_hidden) VALUES ('46541b7d-e495-445b-83b3-d0a955c31f7d', '23fdd2c5-6e23-4141-9d34-0a22e1579ff7', 'Nature', 'Nature photography', 'nature', '', '', '', FALSE, TRUE, 4, '2026-10-02 16:09:16', '2026-10-02 16:44:31', FALSE) ON CONFLICT (id) DO UPDATE SET media_id = EXCLUDED.media_id, title = EXCLUDED.title, description = EXCLUDED.description, category = EXCLUDED.category, location = EXCLUDED.location, photo_date = EXCLUDED.photo_date, tags = EXCLUDED.tags, is_featured = EXCLUDED.is_featured, is_published = EXCLUDED.is_published, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, is_hidden = EXCLUDED.is_hidden;
INSERT INTO portfolio_items (id, media_id, title, description, category, location, photo_date, tags, is_featured, is_published, display_order, created_at, updated_at, is_hidden) VALUES ('a7b3a893-570c-47ec-97d0-d658e69d752a', '78c9530b-bbd9-4746-bfe2-ec6ab43c12a0', 'Monochrome', 'Black and white photography', 'blackwhite', '', '', '', FALSE, TRUE, 5, '2026-10-02 16:09:16', '2026-10-02 16:44:31', FALSE) ON CONFLICT (id) DO UPDATE SET media_id = EXCLUDED.media_id, title = EXCLUDED.title, description = EXCLUDED.description, category = EXCLUDED.category, location = EXCLUDED.location, photo_date = EXCLUDED.photo_date, tags = EXCLUDED.tags, is_featured = EXCLUDED.is_featured, is_published = EXCLUDED.is_published, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, is_hidden = EXCLUDED.is_hidden;
INSERT INTO portfolio_items (id, media_id, title, description, category, location, photo_date, tags, is_featured, is_published, display_order, created_at, updated_at, is_hidden) VALUES ('34bab581-7603-4d27-87df-d6b424ba82a6', 'bc9bdb37-4bc5-409e-a434-bd7db772303d', 'Street', 'Urban life', 'urban', '', '', '', FALSE, TRUE, 6, '2026-10-02 16:09:16', '2026-10-02 16:44:31', FALSE) ON CONFLICT (id) DO UPDATE SET media_id = EXCLUDED.media_id, title = EXCLUDED.title, description = EXCLUDED.description, category = EXCLUDED.category, location = EXCLUDED.location, photo_date = EXCLUDED.photo_date, tags = EXCLUDED.tags, is_featured = EXCLUDED.is_featured, is_published = EXCLUDED.is_published, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, is_hidden = EXCLUDED.is_hidden;
INSERT INTO portfolio_items (id, media_id, title, description, category, location, photo_date, tags, is_featured, is_published, display_order, created_at, updated_at, is_hidden) VALUES ('3523fe2e-27d5-4aea-9c0a-f5ea65e85d83', '248d5958-89fd-4d8a-ad19-42feb55e05f3', 'Landscape View', 'Natural landscape', 'nature', '', '', '', FALSE, TRUE, 7, '2026-10-02 16:09:16', '2026-10-02 16:44:31', FALSE) ON CONFLICT (id) DO UPDATE SET media_id = EXCLUDED.media_id, title = EXCLUDED.title, description = EXCLUDED.description, category = EXCLUDED.category, location = EXCLUDED.location, photo_date = EXCLUDED.photo_date, tags = EXCLUDED.tags, is_featured = EXCLUDED.is_featured, is_published = EXCLUDED.is_published, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, is_hidden = EXCLUDED.is_hidden;
INSERT INTO portfolio_items (id, media_id, title, description, category, location, photo_date, tags, is_featured, is_published, display_order, created_at, updated_at, is_hidden) VALUES ('e2f2d721-305d-48bf-b31c-db1290d205fe', '7e9f0de5-9513-4ac4-9291-e6a0256d4aa2', 'Journey', 'Travel scene', 'travel', '', '', '', FALSE, TRUE, 8, '2026-10-02 16:09:16', '2026-10-02 16:44:31', FALSE) ON CONFLICT (id) DO UPDATE SET media_id = EXCLUDED.media_id, title = EXCLUDED.title, description = EXCLUDED.description, category = EXCLUDED.category, location = EXCLUDED.location, photo_date = EXCLUDED.photo_date, tags = EXCLUDED.tags, is_featured = EXCLUDED.is_featured, is_published = EXCLUDED.is_published, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, is_hidden = EXCLUDED.is_hidden;
INSERT INTO portfolio_items (id, media_id, title, description, category, location, photo_date, tags, is_featured, is_published, display_order, created_at, updated_at, is_hidden) VALUES ('715e0836-453f-4611-8480-00b88e4b4fd8', '6184cbe6-e828-48aa-9974-ffffd2654f18', 'Portrait Art', 'Portrait study', 'portrait', '', '', '', FALSE, TRUE, 9, '2026-10-02 16:09:16', '2026-10-02 16:44:31', FALSE) ON CONFLICT (id) DO UPDATE SET media_id = EXCLUDED.media_id, title = EXCLUDED.title, description = EXCLUDED.description, category = EXCLUDED.category, location = EXCLUDED.location, photo_date = EXCLUDED.photo_date, tags = EXCLUDED.tags, is_featured = EXCLUDED.is_featured, is_published = EXCLUDED.is_published, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, is_hidden = EXCLUDED.is_hidden;
INSERT INTO portfolio_items (id, media_id, title, description, category, location, photo_date, tags, is_featured, is_published, display_order, created_at, updated_at, is_hidden) VALUES ('595d1c1c-0aed-4fa3-b711-503904d9e5ae', 'b9e0ec34-f3d5-4fa1-a33c-d380e00b0907', 'Black & White', 'Monochrome photography', 'blackwhite', '', '', '', FALSE, TRUE, 10, '2026-10-02 16:09:16', '2026-10-02 16:44:31', FALSE) ON CONFLICT (id) DO UPDATE SET media_id = EXCLUDED.media_id, title = EXCLUDED.title, description = EXCLUDED.description, category = EXCLUDED.category, location = EXCLUDED.location, photo_date = EXCLUDED.photo_date, tags = EXCLUDED.tags, is_featured = EXCLUDED.is_featured, is_published = EXCLUDED.is_published, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, is_hidden = EXCLUDED.is_hidden;
INSERT INTO portfolio_items (id, media_id, title, description, category, location, photo_date, tags, is_featured, is_published, display_order, created_at, updated_at, is_hidden) VALUES ('cd1cff11-5a1b-4c10-b1fd-38db9b884e59', '4c311b74-d6e4-4e1a-8a8e-10aeecc263be', 'Urban Landscape', 'City architecture', 'urban', '', '', '', FALSE, TRUE, 11, '2026-10-02 16:09:16', '2026-10-02 16:44:31', FALSE) ON CONFLICT (id) DO UPDATE SET media_id = EXCLUDED.media_id, title = EXCLUDED.title, description = EXCLUDED.description, category = EXCLUDED.category, location = EXCLUDED.location, photo_date = EXCLUDED.photo_date, tags = EXCLUDED.tags, is_featured = EXCLUDED.is_featured, is_published = EXCLUDED.is_published, display_order = EXCLUDED.display_order, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at, is_hidden = EXCLUDED.is_hidden;

-- ── Table: portfolio_item_sections (40 rows) ───────────────────────────────────
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('d42a0440-8987-4dcc-8c80-4d655a6b3f0b', 'gallery') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('d42a0440-8987-4dcc-8c80-4d655a6b3f0b', 'home') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('d42a0440-8987-4dcc-8c80-4d655a6b3f0b', 'portfolio') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('d42a0440-8987-4dcc-8c80-4d655a6b3f0b', 'urban') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('ed82be12-2543-48d0-b9a2-cb0b50711e5a', 'gallery') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('ed82be12-2543-48d0-b9a2-cb0b50711e5a', 'home') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('ed82be12-2543-48d0-b9a2-cb0b50711e5a', 'portfolio') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('ed82be12-2543-48d0-b9a2-cb0b50711e5a', 'portrait') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('157c91a1-3509-4537-91e8-c16dee7d56a0', 'gallery') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('157c91a1-3509-4537-91e8-c16dee7d56a0', 'home') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('157c91a1-3509-4537-91e8-c16dee7d56a0', 'portfolio') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('157c91a1-3509-4537-91e8-c16dee7d56a0', 'travel') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('a7b3a893-570c-47ec-97d0-d658e69d752a', 'blackwhite') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('a7b3a893-570c-47ec-97d0-d658e69d752a', 'gallery') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('a7b3a893-570c-47ec-97d0-d658e69d752a', 'home') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('a7b3a893-570c-47ec-97d0-d658e69d752a', 'portfolio') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('46541b7d-e495-445b-83b3-d0a955c31f7d', 'gallery') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('46541b7d-e495-445b-83b3-d0a955c31f7d', 'home') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('46541b7d-e495-445b-83b3-d0a955c31f7d', 'nature') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('46541b7d-e495-445b-83b3-d0a955c31f7d', 'portfolio') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('34bab581-7603-4d27-87df-d6b424ba82a6', 'gallery') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('34bab581-7603-4d27-87df-d6b424ba82a6', 'home') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('34bab581-7603-4d27-87df-d6b424ba82a6', 'portfolio') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('34bab581-7603-4d27-87df-d6b424ba82a6', 'urban') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('3523fe2e-27d5-4aea-9c0a-f5ea65e85d83', 'gallery') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('3523fe2e-27d5-4aea-9c0a-f5ea65e85d83', 'nature') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('3523fe2e-27d5-4aea-9c0a-f5ea65e85d83', 'portfolio') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('e2f2d721-305d-48bf-b31c-db1290d205fe', 'gallery') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('e2f2d721-305d-48bf-b31c-db1290d205fe', 'portfolio') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('e2f2d721-305d-48bf-b31c-db1290d205fe', 'travel') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('715e0836-453f-4611-8480-00b88e4b4fd8', 'gallery') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('715e0836-453f-4611-8480-00b88e4b4fd8', 'portfolio') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('715e0836-453f-4611-8480-00b88e4b4fd8', 'portrait') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('595d1c1c-0aed-4fa3-b711-503904d9e5ae', 'blackwhite') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('595d1c1c-0aed-4fa3-b711-503904d9e5ae', 'gallery') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('595d1c1c-0aed-4fa3-b711-503904d9e5ae', 'portfolio') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('cd1cff11-5a1b-4c10-b1fd-38db9b884e59', 'gallery') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('cd1cff11-5a1b-4c10-b1fd-38db9b884e59', 'portfolio') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('cd1cff11-5a1b-4c10-b1fd-38db9b884e59', 'urban') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;
INSERT INTO portfolio_item_sections (portfolio_item_id, section_id) VALUES ('92b79d7f-dd6f-4595-85be-72000f65a480', 'nature') ON CONFLICT (portfolio_item_id, section_id) DO NOTHING;

-- ── Table: social_links (5 rows) ───────────────────────────────────
INSERT INTO social_links (id, platform, display_name, url, icon, is_visible, display_order) VALUES ('facebook', 'Facebook', 'Facebook', 'https://www.facebook.com/prajwol.gautam.35', 'ri-facebook-fill', TRUE, 0) ON CONFLICT (id) DO UPDATE SET platform = EXCLUDED.platform, display_name = EXCLUDED.display_name, url = EXCLUDED.url, icon = EXCLUDED.icon, is_visible = EXCLUDED.is_visible, display_order = EXCLUDED.display_order;
INSERT INTO social_links (id, platform, display_name, url, icon, is_visible, display_order) VALUES ('tiktok', 'TikTok', 'TikTok', 'https://www.tiktok.com/@prajwolgautam72', 'ri-tiktok-line', TRUE, 1) ON CONFLICT (id) DO UPDATE SET platform = EXCLUDED.platform, display_name = EXCLUDED.display_name, url = EXCLUDED.url, icon = EXCLUDED.icon, is_visible = EXCLUDED.is_visible, display_order = EXCLUDED.display_order;
INSERT INTO social_links (id, platform, display_name, url, icon, is_visible, display_order) VALUES ('instagram', 'Instagram', 'Instagram', 'https://www.instagram.com/mr.praajwol/', 'ri-instagram-line', TRUE, 2) ON CONFLICT (id) DO UPDATE SET platform = EXCLUDED.platform, display_name = EXCLUDED.display_name, url = EXCLUDED.url, icon = EXCLUDED.icon, is_visible = EXCLUDED.is_visible, display_order = EXCLUDED.display_order;
INSERT INTO social_links (id, platform, display_name, url, icon, is_visible, display_order) VALUES ('youtube', 'YouTube', 'YouTube', 'https://www.youtube.com/@PrajwolGautam', 'ri-youtube-fill', TRUE, 3) ON CONFLICT (id) DO UPDATE SET platform = EXCLUDED.platform, display_name = EXCLUDED.display_name, url = EXCLUDED.url, icon = EXCLUDED.icon, is_visible = EXCLUDED.is_visible, display_order = EXCLUDED.display_order;
INSERT INTO social_links (id, platform, display_name, url, icon, is_visible, display_order) VALUES ('whatsapp', 'WhatsApp', 'WhatsApp', 'https://wa.me/9779841234567', 'ri-whatsapp-line', TRUE, 4) ON CONFLICT (id) DO UPDATE SET platform = EXCLUDED.platform, display_name = EXCLUDED.display_name, url = EXCLUDED.url, icon = EXCLUDED.icon, is_visible = EXCLUDED.is_visible, display_order = EXCLUDED.display_order;

-- ── Table: social_link_locations (5 rows) ───────────────────────────────────
INSERT INTO social_link_locations (social_link_id, location, display_order) VALUES ('facebook', 'footer', 0) ON CONFLICT (social_link_id, location) DO UPDATE SET display_order = EXCLUDED.display_order;
INSERT INTO social_link_locations (social_link_id, location, display_order) VALUES ('tiktok', 'footer', 0) ON CONFLICT (social_link_id, location) DO UPDATE SET display_order = EXCLUDED.display_order;
INSERT INTO social_link_locations (social_link_id, location, display_order) VALUES ('instagram', 'footer', 0) ON CONFLICT (social_link_id, location) DO UPDATE SET display_order = EXCLUDED.display_order;
INSERT INTO social_link_locations (social_link_id, location, display_order) VALUES ('youtube', 'footer', 0) ON CONFLICT (social_link_id, location) DO UPDATE SET display_order = EXCLUDED.display_order;
INSERT INTO social_link_locations (social_link_id, location, display_order) VALUES ('whatsapp', 'footer', 0) ON CONFLICT (social_link_id, location) DO UPDATE SET display_order = EXCLUDED.display_order;

-- ── Table: site_content (25 rows) ───────────────────────────────────
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('home.heroTitle', 'Test Title Check', '2026-10-02 17:47:07') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('home.heroSubtitle', 'POKHARA, NEPAL', '2026-10-02 16:43:59') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('home.introduction', '', '2026-10-02 16:43:59') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('home.portfolioTitle', 'Portfolio', '2026-10-02 16:43:59') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('home.portfolioDescription', '', '2026-10-02 16:43:59') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('home.ctaText', 'HIRE ME', '2026-10-02 16:43:59') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('about.title', 'About Me', '2026-10-02 16:43:59') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('about.description', '', '2026-10-02 16:43:59') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('about.biography', '', '2026-10-02 16:43:59') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('portfolio.title', 'Photography Portfolio', '2026-10-02 16:43:59') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('portfolio.description', '', '2026-10-02 16:43:59') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('contact.title', 'Hire Me for Your Next Project', '2026-10-02 16:43:59') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('contact.description', '', '2026-10-02 16:43:59') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('contact.email', 'gautamprajwol22@gmail.com', '2026-10-02 16:43:59') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('contact.phone', '+971 54 519 2239', '2026-10-02 16:43:59') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('contact.location', 'FISTAIL HOUSING, BIRAUTA, POKHARA, NEPAL.', '2026-10-02 16:43:59') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('contact.closingTitle', 'Let''s Work Together', '2026-10-02 16:43:59') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('contact.closingDescription', '', '2026-10-02 16:43:59') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('footer.introduction', '', '2026-10-02 16:43:59') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('footer.officeTitle', 'Where''s My Office?', '2026-10-02 16:43:59') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('footer.socialTitle', 'My Social Links', '2026-10-02 16:43:59') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('footer.copyright', 'Copyright © 2025 Deeznotfound. All rights reserved.', '2026-10-02 16:43:59') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('about.skillsTitle', 'My Skills & Expertise', '2026-10-02 18:08:18') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('about.skillsDescription', 'Here are the key areas where I excel in creating stunning visual content', '2026-10-02 18:08:18') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;
INSERT INTO site_content (content_key, content_value, updated_at) VALUES ('footer.contactTitle', 'Get In Touch', '2026-10-02 18:08:18') ON CONFLICT (content_key) DO UPDATE SET content_value = EXCLUDED.content_value, updated_at = EXCLUDED.updated_at;

-- ── Table: navigation_items (4 rows) ───────────────────────────────────
INSERT INTO navigation_items (id, label, url, icon, is_visible, display_order) VALUES ('home', 'Home', 'home.html', '', TRUE, 0) ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, url = EXCLUDED.url, icon = EXCLUDED.icon, is_visible = EXCLUDED.is_visible, display_order = EXCLUDED.display_order;
INSERT INTO navigation_items (id, label, url, icon, is_visible, display_order) VALUES ('about', 'About', 'about.html', '', TRUE, 1) ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, url = EXCLUDED.url, icon = EXCLUDED.icon, is_visible = EXCLUDED.is_visible, display_order = EXCLUDED.display_order;
INSERT INTO navigation_items (id, label, url, icon, is_visible, display_order) VALUES ('portfolio', 'Portfolio', 'photography.html', '', TRUE, 2) ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, url = EXCLUDED.url, icon = EXCLUDED.icon, is_visible = EXCLUDED.is_visible, display_order = EXCLUDED.display_order;
INSERT INTO navigation_items (id, label, url, icon, is_visible, display_order) VALUES ('hire', 'Hire Me', 'hire.html', '', TRUE, 3) ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, url = EXCLUDED.url, icon = EXCLUDED.icon, is_visible = EXCLUDED.is_visible, display_order = EXCLUDED.display_order;

-- ── Table: skills (6 rows) ───────────────────────────────────
INSERT INTO skills (id, name, percent, icon, display_order, is_visible) VALUES ('skill-photography', 'Photography', 95, 'ri-camera-line', 0, TRUE) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, percent = EXCLUDED.percent, icon = EXCLUDED.icon, display_order = EXCLUDED.display_order, is_visible = EXCLUDED.is_visible;
INSERT INTO skills (id, name, percent, icon, display_order, is_visible) VALUES ('skill-editing', 'Photo Editing', 90, 'ri-edit-line', 1, TRUE) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, percent = EXCLUDED.percent, icon = EXCLUDED.icon, display_order = EXCLUDED.display_order, is_visible = EXCLUDED.is_visible;
INSERT INTO skills (id, name, percent, icon, display_order, is_visible) VALUES ('skill-lightroom', 'Lightroom', 85, 'ri-contrast-line', 2, TRUE) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, percent = EXCLUDED.percent, icon = EXCLUDED.icon, display_order = EXCLUDED.display_order, is_visible = EXCLUDED.is_visible;
INSERT INTO skills (id, name, percent, icon, display_order, is_visible) VALUES ('skill-photoshop', 'Photoshop', 80, 'ri-image-edit-line', 3, TRUE) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, percent = EXCLUDED.percent, icon = EXCLUDED.icon, display_order = EXCLUDED.display_order, is_visible = EXCLUDED.is_visible;
INSERT INTO skills (id, name, percent, icon, display_order, is_visible) VALUES ('skill-video', 'Video Editing', 75, 'ri-video-line', 4, TRUE) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, percent = EXCLUDED.percent, icon = EXCLUDED.icon, display_order = EXCLUDED.display_order, is_visible = EXCLUDED.is_visible;
INSERT INTO skills (id, name, percent, icon, display_order, is_visible) VALUES ('skill-design', 'Creative Design', 88, 'ri-palette-line', 5, TRUE) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, percent = EXCLUDED.percent, icon = EXCLUDED.icon, display_order = EXCLUDED.display_order, is_visible = EXCLUDED.is_visible;

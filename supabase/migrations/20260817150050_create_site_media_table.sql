/*
# Create site_media table for home page category videos

1. New Tables
- `site_media`
  - `id` (uuid, primary key)
  - `media_key` (text, unique, not null) — identifies the slot, e.g. "cat-robes", "cat-chandails", "cat-blouses", "cat-vestes"
  - `media_type` (text, not null) — "video" or "image"
  - `url` (text, not null) — storage path or full URL
  - `updated_at` (timestamptz, default now())
2. Security
- Enable RLS on `site_media`.
- Public read (anon + authenticated) so visitors see the videos.
- Only authenticated users can insert/update/delete (admin uploads).
3. Notes
- This table stores which video/image to show for each home page category card.
- The admin uploads an MP4 file to the `category-videos` storage bucket, then a row is inserted here.
*/

CREATE TABLE IF NOT EXISTS site_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_key text UNIQUE NOT NULL,
  media_type text NOT NULL DEFAULT 'video',
  url text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE site_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_site_media" ON site_media;
CREATE POLICY "public_read_site_media" ON site_media
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_site_media" ON site_media;
CREATE POLICY "auth_insert_site_media" ON site_media
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_site_media" ON site_media;
CREATE POLICY "auth_update_site_media" ON site_media
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_site_media" ON site_media;
CREATE POLICY "auth_delete_site_media" ON site_media
  FOR DELETE TO authenticated USING (true);

-- Create storage bucket for category videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('category-videos', 'category-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: public read, authenticated write
DROP POLICY IF EXISTS "public_read_category_videos" ON storage.objects;
CREATE POLICY "public_read_category_videos" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'category-videos');

DROP POLICY IF EXISTS "auth_insert_category_videos" ON storage.objects;
CREATE POLICY "auth_insert_category_videos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'category-videos');

DROP POLICY IF EXISTS "auth_update_category_videos" ON storage.objects;
CREATE POLICY "auth_update_category_videos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'category-videos') WITH CHECK (bucket_id = 'category-videos');

DROP POLICY IF EXISTS "auth_delete_category_videos" ON storage.objects;
CREATE POLICY "auth_delete_category_videos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'category-videos');
/*
# Create public bucket "product-images" with temporary anon upload policies

1. Storage
   - Creates bucket "product-images" as public (if not already present).
   - Ensures public read access for anon + authenticated.
2. Temporary RLS policies on storage.objects (for one-time bulk import)
   - anon INSERT into bucket "product-images"
   - anon UPDATE (upsert) on bucket "product-images"
3. Notes
   - These insert/update policies are TEMPORARY for a batch import.
   - Existing tables, policies, and the rest of the app are untouched.
*/

-- Ensure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read access
DROP POLICY IF EXISTS "anon_read_product_images" ON storage.objects;
CREATE POLICY "anon_read_product_images" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');

-- Temporary: allow anon to insert (for bulk upload)
DROP POLICY IF EXISTS "anon upload product-images" ON storage.objects;
CREATE POLICY "anon upload product-images" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'product-images');

-- Temporary: allow anon to update (for upsert)
DROP POLICY IF EXISTS "anon upsert product-images" ON storage.objects;
CREATE POLICY "anon upsert product-images" ON storage.objects
  FOR UPDATE TO anon
  USING (bucket_id = 'product-images')
  WITH CHECK (bucket_id = 'product-images');

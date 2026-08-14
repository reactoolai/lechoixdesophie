/*
# Create storage bucket for product photos

Creates a public storage bucket 'product-photos' so admin can upload
product images directly from the dashboard. Files are stored under
products/<filename> and accessible publicly.

## Storage
- Bucket: product-photos (public)
- Policies: anyone can read; only authenticated can write/upload/delete
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-photos', 'product-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read
DROP POLICY IF EXISTS "anon_read_product_photos" ON storage.objects;
CREATE POLICY "anon_read_product_photos" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-photos');

-- Allow authenticated to upload
DROP POLICY IF EXISTS "auth_insert_product_photos" ON storage.objects;
CREATE POLICY "auth_insert_product_photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-photos');

-- Allow authenticated to update
DROP POLICY IF EXISTS "auth_update_product_photos" ON storage.objects;
CREATE POLICY "auth_update_product_photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-photos') WITH CHECK (bucket_id = 'product-photos');

-- Allow authenticated to delete
DROP POLICY IF EXISTS "auth_delete_product_photos" ON storage.objects;
CREATE POLICY "auth_delete_product_photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-photos');

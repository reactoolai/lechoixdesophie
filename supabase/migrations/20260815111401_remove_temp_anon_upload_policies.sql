/*
# Remove temporary anon upload policies on product-images bucket

1. Security
   - Drops the temporary INSERT policy "anon upload product-images"
   - Drops the temporary UPDATE policy "anon upsert product-images"
   - Public read policy "anon_read_product_images" remains in place
2. Notes
   - Bulk import is complete; anon can no longer upload/upsert.
*/

DROP POLICY IF EXISTS "anon upload product-images" ON storage.objects;
DROP POLICY IF EXISTS "anon upsert product-images" ON storage.objects;

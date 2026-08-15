DROP POLICY IF EXISTS "anon upload product-images" ON storage.objects;
DROP POLICY IF EXISTS "anon upsert product-images" ON storage.objects;

CREATE POLICY "anon upload product-images"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "anon upsert product-images"
ON storage.objects FOR UPDATE TO anon
USING (bucket_id = 'product-images')
WITH CHECK (bucket_id = 'product-images');

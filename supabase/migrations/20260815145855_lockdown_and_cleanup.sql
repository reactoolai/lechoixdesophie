-- Drop the temporary function
DROP FUNCTION IF EXISTS import_preexisting_batch(json);

-- Remove anon write policies on storage.objects
DROP POLICY IF EXISTS "anon upload product-images" ON storage.objects;
DROP POLICY IF EXISTS "anon upsert product-images" ON storage.objects;

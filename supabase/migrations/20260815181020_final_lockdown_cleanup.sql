-- Final lockdown: drop temp import function, remove anon storage policies
-- This is the definitive lockdown after the last import batch (FW26 nouveautés).
-- No more imports are expected. All temporary access is revoked.

-- Drop the temporary import function
DROP FUNCTION IF EXISTS import_nouveautes_batch(json);

-- Remove anon write policies on storage.objects (definitive)
DROP POLICY IF EXISTS "anon upload product-images" ON storage.objects;
DROP POLICY IF EXISTS "anon upsert product-images" ON storage.objects;

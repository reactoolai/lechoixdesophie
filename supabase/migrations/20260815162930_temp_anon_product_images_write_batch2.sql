-- Temporarily re-enable anonymous write on product-images bucket for placeholder upload batch
drop policy if exists "anon upload product-images" on storage.objects;
drop policy if exists "anon upsert product-images" on storage.objects;

create policy "anon upload product-images" on storage.objects
  for insert to anon with check (bucket_id = 'product-images');

create policy "anon upsert product-images" on storage.objects
  for update to anon using (bucket_id = 'product-images') with check (bucket_id = 'product-images');

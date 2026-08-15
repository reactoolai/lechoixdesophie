DROP POLICY IF EXISTS "temp_anon_insert_product_images" ON product_images;
CREATE POLICY "temp_anon_insert_product_images" ON product_images FOR INSERT
  TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "temp_anon_delete_product_images" ON product_images;
CREATE POLICY "temp_anon_delete_product_images" ON product_images FOR DELETE
  TO anon USING (true);

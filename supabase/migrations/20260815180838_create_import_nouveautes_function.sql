/*
# Import FW26 nouveautés manifest — final batch

1. Purpose
   - Creates a SECURITY DEFINER function `import_nouveautes_batch(json)` to import the last batch of 62 FW26 nouveautés images into `product_images`.
   - For each SKU: updates `products.image_confidence` to 'approx', clears `products.images` to '[]', deletes existing `product_images` rows for that SKU, then inserts new rows with sort_order starting at 0.
   - URLs in the input are separated by '|||'.
2. Security
   - SECURITY DEFINER so it can write to product_images and products regardless of RLS.
   - Granted to anon, authenticated for the import call.
   - This function is temporary and will be dropped in the next migration (final lockdown).
3. Tables affected
   - products: UPDATE image_confidence, images
   - product_images: DELETE + INSERT
*/

CREATE OR REPLACE FUNCTION import_nouveautes_batch(items json)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item json;
  sku_val text;
  confidence_val text;
  urls_val text[];
  url text;
  sort_idx integer;
  updated_count integer := 0;
  inserted_count integer := 0;
  cleared_count integer := 0;
  failed_skus text[] := ARRAY[]::text[];
BEGIN
  FOR item IN SELECT * FROM json_array_elements(items)
  LOOP
    sku_val := item->>'sku';
    confidence_val := item->>'confidence';
    urls_val := string_to_array(item->>'urls', '|||');

    UPDATE products 
    SET image_confidence = confidence_val, images = '[]'::jsonb
    WHERE numref = sku_val;
    
    IF NOT FOUND THEN
      failed_skus := array_append(failed_skus, sku_val);
      CONTINUE;
    END IF;
    updated_count := updated_count + 1;
    cleared_count := cleared_count + 1;

    DELETE FROM product_images WHERE product_numref = sku_val;

    sort_idx := 0;
    FOREACH url IN ARRAY urls_val
    LOOP
      IF url IS NOT NULL AND url != '' THEN
        INSERT INTO product_images (product_numref, image_url, sort_order)
        VALUES (sku_val, url, sort_idx);
        inserted_count := inserted_count + 1;
        sort_idx := sort_idx + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN json_build_object(
    'updated', updated_count,
    'inserted', inserted_count,
    'cleared', cleared_count,
    'failed', failed_skus
  );
END;
$$;

GRANT EXECUTE ON FUNCTION import_nouveautes_batch(json) TO anon, authenticated;

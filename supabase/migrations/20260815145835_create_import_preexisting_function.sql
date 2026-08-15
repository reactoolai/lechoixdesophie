CREATE OR REPLACE FUNCTION import_preexisting_batch(items json)
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

    -- Update image_confidence and clear old images jsonb
    UPDATE products 
    SET image_confidence = confidence_val, images = '[]'::jsonb
    WHERE numref = sku_val;
    
    IF NOT FOUND THEN
      failed_skus := array_append(failed_skus, sku_val);
      CONTINUE;
    END IF;
    updated_count := updated_count + 1;
    cleared_count := cleared_count + 1;

    -- Delete existing product_images for this product
    DELETE FROM product_images WHERE product_numref = sku_val;

    -- Insert new images
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

GRANT EXECUTE ON FUNCTION import_preexisting_batch(json) TO anon, authenticated;

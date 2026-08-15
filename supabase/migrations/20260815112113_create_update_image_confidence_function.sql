CREATE OR REPLACE FUNCTION update_image_confidence(items json)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item record;
  updated_count integer := 0;
BEGIN
  FOR item IN SELECT * FROM json_array_elements(items)
  LOOP
    UPDATE products
    SET image_confidence = item->>'confidence'
    WHERE numref = item->>'numref';
    IF FOUND THEN updated_count := updated_count + 1; END IF;
  END LOOP;
  RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION update_image_confidence(json) TO anon, authenticated;

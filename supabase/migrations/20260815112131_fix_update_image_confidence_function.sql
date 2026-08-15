CREATE OR REPLACE FUNCTION update_image_confidence(items json)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item json;
  updated_count integer := 0;
  numref_val text;
  confidence_val text;
BEGIN
  FOR item IN SELECT * FROM json_array_elements(items)
  LOOP
    numref_val := item->>'numref';
    confidence_val := item->>'confidence';
    UPDATE products
    SET image_confidence = confidence_val
    WHERE numref = numref_val;
    IF FOUND THEN updated_count := updated_count + 1; END IF;
  END LOOP;
  RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION update_image_confidence(json) TO anon, authenticated;

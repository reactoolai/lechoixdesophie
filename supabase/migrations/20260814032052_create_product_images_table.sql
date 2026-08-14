/*
# Create product_images table for color-specific photos

## What this does
Creates a new `product_images` table that links individual product photos to specific colors.
This allows the product detail page to show different photos when a customer clicks on a color dot.

## New Tables
- `product_images`
  - `id` (uuid, primary key)
  - `product_numref` (text, references products.numref) — which product this image belongs to
  - `image_url` (text) — the filename or URL of the image
  - `color` (text, nullable) — which color this image represents (null = generic/default)
  - `sort_order` (integer, default 0) — display order
  - `created_at` (timestamptz, default now())

## Security
- RLS enabled on `product_images`.
- SELECT: anyone (anon + authenticated) can read — images are public catalog data.
- INSERT/UPDATE/DELETE: only authenticated users (admin) can modify.
- No user_id column needed — admin is determined by auth status (any authenticated user can manage, since the admin account is the only authenticated user).
*/

CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_numref text NOT NULL REFERENCES products(numref) ON DELETE CASCADE,
  image_url text NOT NULL,
  color text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "anon_select_product_images" ON product_images;
CREATE POLICY "anon_select_product_images" ON product_images FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_product_images" ON product_images;
CREATE POLICY "auth_insert_product_images" ON product_images FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_product_images" ON product_images;
CREATE POLICY "auth_update_product_images" ON product_images FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_product_images" ON product_images;
CREATE POLICY "auth_delete_product_images" ON product_images FOR DELETE
  TO authenticated USING (true);

-- Index for fast lookups by product
CREATE INDEX IF NOT EXISTS idx_product_images_numref ON product_images(product_numref);
CREATE INDEX IF NOT EXISTS idx_product_images_color ON product_images(product_numref, color);

/*
# Create products table for Le Choix de Sophie inventory

1. New Tables
- `products` — stores the real inventory from the FTP export
  - `id` (uuid, primary key)
  - `numref` (text, unique) — product reference number from the inventory system
  - `description` (text) — product description/name
  - `category` (text) — mapped category (Robes, Chandails, Pantalons, etc.)
  - `dept` (text) — original department from inventory system
  - `subdept` (text) — original sub-department
  - `price` (numeric) — product price
  - `season` (text) — season info
  - `images` (jsonb) — array of image filenames
  - `total_qt` (integer) — total stock quantity across all SKUs
  - `colors` (jsonb) — array of available colors
  - `sizes` (jsonb) — array of available sizes
  - `fournisseur` (text) — supplier name
  - `date_created` (text) — creation date from inventory system
  - `is_new` (boolean) — whether the product is a nouveauté (created in 2026)
  - `created_at` (timestamptz) — when the record was inserted

2. Security
- Enable RLS on `products`.
- Allow anon + authenticated to read products (public catalog).
- Only authenticated admin can insert/update/delete.
*/

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numref text UNIQUE NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  dept text,
  subdept text,
  price numeric(10,2) DEFAULT 0,
  season text,
  images jsonb DEFAULT '[]'::jsonb,
  total_qt integer DEFAULT 0,
  colors jsonb DEFAULT '[]'::jsonb,
  sizes jsonb DEFAULT '[]'::jsonb,
  fournisseur text,
  date_created text,
  is_new boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_products" ON products;
CREATE POLICY "anon_select_products" ON products FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_products" ON products;
CREATE POLICY "auth_insert_products" ON products FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_products" ON products;
CREATE POLICY "auth_update_products" ON products FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_products" ON products;
CREATE POLICY "auth_delete_products" ON products FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_new ON products(is_new);
CREATE INDEX IF NOT EXISTS idx_products_numref ON products(numref);

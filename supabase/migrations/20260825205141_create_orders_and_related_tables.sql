/*
# LOT 1 — Commandes, paniers abandonnés, infolettre

1. Nouvelles tables
- `orders` — entête de commande (client, livraison, totaux, paiement Square)
  - `id` (uuid, PK)
  - `order_number` (text, unique) — numéro lisible type LCS-2026-01000
  - `status` (text) — pending_payment | paid | preparing | ready_for_pickup | shipping | delivered | cancelled
  - `customer_first_name`, `customer_last_name`, `customer_email`, `customer_phone` (text)
  - `fulfillment_type` (text) — delivery | pickup
  - `ship_address1`, `ship_address2`, `ship_city`, `ship_province` (défaut QC), `ship_postal_code`, `ship_country` (défaut CA)
  - `customer_note` (text)
  - `subtotal`, `shipping_total`, `tps`, `tvq`, `total` (numeric(10,2))
  - `currency` (text, défaut CAD)
  - `payment_provider` (text, défaut square), `square_payment_id` (text)
  - `payment_status` (text) — pending | paid | failed | refunded
  - `cart_token` (text)
  - `created_at`, `updated_at`, `paid_at` (timestamptz)
- `order_items` — lignes de commande liées à `orders` (CASCADE)
  - `id` (uuid, PK)
  - `order_id` (uuid, FK → orders, ON DELETE CASCADE)
  - `product_numref`, `name`, `image_url`, `color`, `size` (text)
  - `unit_price`, `line_total` (numeric(10,2)), `quantity` (integer)
- `order_status_history` — journal des changements de statut lié à `orders` (CASCADE)
  - `id` (uuid, PK)
  - `order_id` (uuid, FK → orders, ON DELETE CASCADE)
  - `status`, `note` (text), `email_sent` (boolean)
  - `created_at` (timestamptz)
- `abandoned_carts` — paniers non finalisés pour relance
  - `id` (uuid, PK)
  - `cart_token` (text, unique)
  - `email`, `first_name`, `last_name`, `phone` (text)
  - `items` (jsonb), `items_count` (integer), `subtotal` (numeric)
  - `status` (text) — active | converted
  - `converted_order_id` (uuid, FK → orders)
  - `reached_checkout` (boolean), `user_agent` (text)
  - `created_at`, `last_seen_at` (timestamptz)
- `newsletter_subscribers` — inscriptions à l'infolettre
  - `id` (uuid, PK)
  - `email` (text, unique)
  - `source` (text, défaut 'footer')
  - `created_at` (timestamptz)

2. Séquence et fonction
- `order_number_seq` — séquence commençant à 1000
- `next_order_number()` — génère un numéro de commande au format LCS-AAAA-NNNNN

3. Sécurité (RLS)
- `orders`, `order_items`, `order_status_history`, `abandoned_carts` : RLS activé, SELECT/UPDATE/DELETE pour authenticated uniquement. Aucune politique anon — ces tables sont écrites via Edge Functions (clé service_role, contourne RLS).
- `newsletter_subscribers` : RLS activé, INSERT pour anon + authenticated, SELECT pour authenticated uniquement.

4. Index
- idx_orders_status, idx_orders_created, idx_order_items_order, idx_abandoned_last_seen
*/

-- COMMANDES
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending_payment',
  customer_first_name text NOT NULL,
  customer_last_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  fulfillment_type text NOT NULL DEFAULT 'delivery',
  ship_address1 text,
  ship_address2 text,
  ship_city text,
  ship_province text DEFAULT 'QC',
  ship_postal_code text,
  ship_country text DEFAULT 'CA',
  customer_note text,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  shipping_total numeric(10,2) NOT NULL DEFAULT 0,
  tps numeric(10,2) NOT NULL DEFAULT 0,
  tvq numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CAD',
  payment_provider text DEFAULT 'square',
  square_payment_id text,
  payment_status text DEFAULT 'pending',
  cart_token text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- LIGNES DE COMMANDE
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_numref text NOT NULL,
  name text NOT NULL,
  image_url text,
  color text,
  size text,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  line_total numeric(10,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- HISTORIQUE DES STATUTS
CREATE TABLE IF NOT EXISTS order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  email_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- PANIERS NON FINALISÉS
CREATE TABLE IF NOT EXISTS abandoned_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_token text UNIQUE NOT NULL,
  email text,
  first_name text,
  last_name text,
  phone text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  items_count integer DEFAULT 0,
  subtotal numeric(10,2) DEFAULT 0,
  status text DEFAULT 'active',
  converted_order_id uuid REFERENCES orders(id),
  reached_checkout boolean DEFAULT false,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abandoned_last_seen ON abandoned_carts(last_seen_at DESC);

-- INFOLETTRE
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  source text DEFAULT 'footer',
  created_at timestamptz DEFAULT now()
);

-- RLS : orders, order_items, order_status_history, abandoned_carts
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_orders" ON orders;
CREATE POLICY "auth_select_orders" ON orders FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_update_orders" ON orders;
CREATE POLICY "auth_update_orders" ON orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_orders" ON orders;
CREATE POLICY "auth_delete_orders" ON orders FOR DELETE TO authenticated USING (true);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_order_items" ON order_items;
CREATE POLICY "auth_select_order_items" ON order_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_update_order_items" ON order_items;
CREATE POLICY "auth_update_order_items" ON order_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_order_items" ON order_items;
CREATE POLICY "auth_delete_order_items" ON order_items FOR DELETE TO authenticated USING (true);

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_order_status_history" ON order_status_history;
CREATE POLICY "auth_select_order_status_history" ON order_status_history FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_update_order_status_history" ON order_status_history;
CREATE POLICY "auth_update_order_status_history" ON order_status_history FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_order_status_history" ON order_status_history;
CREATE POLICY "auth_delete_order_status_history" ON order_status_history FOR DELETE TO authenticated USING (true);

ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_select_abandoned_carts" ON abandoned_carts;
CREATE POLICY "auth_select_abandoned_carts" ON abandoned_carts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_update_abandoned_carts" ON abandoned_carts;
CREATE POLICY "auth_update_abandoned_carts" ON abandoned_carts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_delete_abandoned_carts" ON abandoned_carts;
CREATE POLICY "auth_delete_abandoned_carts" ON abandoned_carts FOR DELETE TO authenticated USING (true);

-- RLS : newsletter_subscribers (INSERT anon + authenticated, SELECT authenticated)
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_insert_newsletter" ON newsletter_subscribers;
CREATE POLICY "anon_insert_newsletter" ON newsletter_subscribers FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "auth_select_newsletter" ON newsletter_subscribers;
CREATE POLICY "auth_select_newsletter" ON newsletter_subscribers FOR SELECT
  TO authenticated USING (true);

-- Séquence et fonction de numéro de commande
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1000;
CREATE OR REPLACE FUNCTION next_order_number() RETURNS text
  LANGUAGE sql AS $$
  SELECT 'LCS-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('order_number_seq')::text, 5, '0')
  $$;

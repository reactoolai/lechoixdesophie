/*
# Create newsletter_subscribers table

1. New Tables
- `newsletter_subscribers`
  - `id` (uuid, primary key)
  - `email` (text, unique, not null) — subscriber's email address
  - `created_at` (timestamptz, default now())
  - `source` (text, nullable) — where the subscription came from (e.g. 'footer')

2. Security
- Enable RLS on `newsletter_subscribers`.
- Allow anon + authenticated INSERT (anyone can subscribe from the footer form).
- Allow authenticated SELECT (admin can view subscribers in the admin panel).
- No UPDATE or DELETE policies (subscriptions are append-only from the frontend).

3. Notes
- The unique constraint on `email` prevents duplicate subscriptions.
- The frontend uses `.upsert()` with `onConflict: 'email'` and `ignoreDuplicates: true`
  to silently handle re-subscriptions without showing errors.
*/

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  source text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_newsletter" ON newsletter_subscribers;
CREATE POLICY "anon_insert_newsletter" ON newsletter_subscribers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_newsletter" ON newsletter_subscribers;
CREATE POLICY "auth_select_newsletter" ON newsletter_subscribers FOR SELECT
  TO authenticated USING (true);

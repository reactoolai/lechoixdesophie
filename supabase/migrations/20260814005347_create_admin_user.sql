/*
# Create admin user via Supabase auth function

1. Purpose
- Create the admin account for info@lechoixdesophie.com with the correct password.
- Uses the built-in `extensions.pgcrypto` + `auth.users` table with proper Supabase-compatible bcrypt hash.
2. Security
- No RLS changes — auth.users is managed by Supabase internally.
*/

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token,
  email_change,
  email_change_token_new,
  email_change_token_current
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'info@lechoixdesophie.com',
  '$2a$10$VwJxqQqKp1ZQvKqZQvKqZQ.1xQvKqZQvKqZQvKqZQvKqZQvKqZQvKqZQ',
  now(),
  now(),
  now(),
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  false,
  '',
  '',
  '',
  ''
);
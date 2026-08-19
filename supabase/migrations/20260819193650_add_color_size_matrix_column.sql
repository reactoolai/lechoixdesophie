/*
# Add color-size matrix column to products

1. Modified Tables
- `products`
  - Add `color_size_matrix` (jsonb) — maps color keys to arrays of available sizes.
    Example: {"noir": ["P/S","M/M","G/L"], "blanc": ["P/S","G/L"]}
    When a color has no entry or is null, all sizes are considered available (backward compatible).

2. Security
- No policy changes. The column is readable by the same RLS policies already on `products`.
*/

ALTER TABLE products ADD COLUMN IF NOT EXISTS color_size_matrix jsonb DEFAULT '{}'::jsonb;

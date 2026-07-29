CREATE TABLE IF NOT EXISTS step11_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  product_name text NOT NULL,
  category_id text,
  subcategory_id text,
  total_cost decimal(15, 2) NOT NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS step11_product_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step11_product_id uuid NOT NULL REFERENCES step11_products(id) ON DELETE CASCADE,
  material_id uuid NOT NULL,
  material_name text NOT NULL,
  unit text,
  qty decimal(10, 2),
  rate decimal(15, 2),
  amount decimal(15, 2)
);

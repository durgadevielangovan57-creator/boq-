ALTER TABLE step11_product_items ADD COLUMN IF NOT EXISTS supply_rate DECIMAL(15, 2);
ALTER TABLE step11_product_items ADD COLUMN IF NOT EXISTS install_rate DECIMAL(15, 2);
ALTER TABLE step11_product_items ADD COLUMN IF NOT EXISTS location TEXT;

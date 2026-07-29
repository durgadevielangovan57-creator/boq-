-- 0002_shops_materials.sql - create shops and materials tables

CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  phoneCountryCode TEXT,
  contactNumber TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  pincode TEXT,
  image TEXT,
  rating NUMERIC,
  categories JSONB,
  gstNo TEXT,
  owner_id UUID,
  disabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shops_categories_gin ON shops USING gin (categories);

CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  rate NUMERIC DEFAULT 0,
  shop_id UUID REFERENCES shops(id) ON DELETE SET NULL,
  unit TEXT,
  category TEXT,
  brandName TEXT,
  modelNumber TEXT,
  subCategory TEXT,
  technicalSpecification TEXT,
  image TEXT,
  attributes JSONB,
  master_material_id UUID,
  disabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_materials_code ON materials (code);
CREATE INDEX IF NOT EXISTS idx_materials_attributes_gin ON materials USING gin (attributes);

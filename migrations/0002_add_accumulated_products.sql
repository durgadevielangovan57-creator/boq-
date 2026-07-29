CREATE TABLE accumulated_products (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  estimator_type VARCHAR(50) NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_accumulated_products_user_estimator ON accumulated_products(user_id, estimator_type);
-- Add new tax and vendor category fields to material_templates table
ALTER TABLE material_templates 
ADD COLUMN vendor_category VARCHAR(255),
ADD COLUMN tax_code_type VARCHAR(10) DEFAULT NULL CHECK (tax_code_type IN ('hsn', 'sac')),
ADD COLUMN tax_code_value VARCHAR(50) DEFAULT NULL;

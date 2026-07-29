-- Add new columns to existing users table
ALTER TABLE "users" ADD COLUMN "approved" text DEFAULT 'approved';
ALTER TABLE "users" ADD COLUMN "approval_reason" text;
ALTER TABLE "users" ADD COLUMN "full_name" text;
ALTER TABLE "users" ADD COLUMN "mobile_number" text;
ALTER TABLE "users" ADD COLUMN "department" text;
ALTER TABLE "users" ADD COLUMN "employee_code" text;
ALTER TABLE "users" ADD COLUMN "company_name" text;
ALTER TABLE "users" ADD COLUMN "gst_number" text;
ALTER TABLE "users" ADD COLUMN "business_address" text;
ALTER TABLE "users" ADD COLUMN "created_at" text DEFAULT now();

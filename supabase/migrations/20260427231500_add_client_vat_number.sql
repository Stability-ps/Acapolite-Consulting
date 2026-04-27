-- Add vat_number column to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS vat_number TEXT;

-- Add snapshot columns for VAT numbers to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_vat_number TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS practitioner_vat_number TEXT;

-- Update the schema cache for PostgREST
NOTIFY pgrst, 'reload schema';

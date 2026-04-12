alter table public.invoices
  add column if not exists sent_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists overdue_at timestamptz,
  add column if not exists cancelled_at timestamptz;

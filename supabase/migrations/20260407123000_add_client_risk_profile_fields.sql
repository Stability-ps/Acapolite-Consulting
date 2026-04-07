alter table public.clients
  add column if not exists client_type text,
  add column if not exists company_registration_number text,
  add column if not exists sars_outstanding_debt numeric(12,2),
  add column if not exists returns_filed boolean;

update public.clients
set client_type = case
  when coalesce(company_name, '') <> '' then 'company'
  else 'individual'
end
where client_type is null;

update public.clients
set sars_outstanding_debt = 0
where sars_outstanding_debt is null;

update public.clients
set returns_filed = false
where returns_filed is null;

alter table public.clients
  alter column client_type set default 'individual',
  alter column client_type set not null,
  alter column sars_outstanding_debt set default 0,
  alter column sars_outstanding_debt set not null,
  alter column returns_filed set default false,
  alter column returns_filed set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clients_client_type_chk'
  ) then
    alter table public.clients
      add constraint clients_client_type_chk
      check (client_type in ('individual', 'company'));
  end if;
end $$;

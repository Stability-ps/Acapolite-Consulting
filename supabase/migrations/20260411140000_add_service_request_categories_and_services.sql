do $$
begin
  if not exists (select 1 from pg_type where typname = 'service_request_category') then
    create type public.service_request_category as enum (
      'individual_tax',
      'business_tax',
      'accounting',
      'business_support'
    );
  end if;
end $$;

alter table public.service_requests
  add column if not exists service_category public.service_request_category;

do $$
begin
  -- Individual tax services
  if not exists (select 1 from pg_enum where enumlabel = 'individual_personal_income_tax_returns' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'individual_personal_income_tax_returns';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'individual_sars_debt_assistance' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'individual_sars_debt_assistance';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'individual_tax_compliance_issues' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'individual_tax_compliance_issues';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'individual_tax_clearance_certificates' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'individual_tax_clearance_certificates';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'individual_objections_and_disputes' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'individual_objections_and_disputes';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'individual_late_return_submissions' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'individual_late_return_submissions';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'individual_tax_number_registration' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'individual_tax_number_registration';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'individual_tax_status_corrections' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'individual_tax_status_corrections';
  end if;

  -- Business tax services
  if not exists (select 1 from pg_enum where enumlabel = 'business_company_income_tax' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'business_company_income_tax';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'business_vat_registration' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'business_vat_registration';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'business_vat_returns' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'business_vat_returns';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'business_paye_registration' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'business_paye_registration';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'business_paye_compliance' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'business_paye_compliance';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'business_sars_debt_arrangements' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'business_sars_debt_arrangements';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'business_tax_clearance_certificates' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'business_tax_clearance_certificates';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'business_sars_audits_support' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'business_sars_audits_support';
  end if;

  -- Accounting services
  if not exists (select 1 from pg_enum where enumlabel = 'accounting_bookkeeping' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'accounting_bookkeeping';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'accounting_financial_statements' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'accounting_financial_statements';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'accounting_management_accounts' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'accounting_management_accounts';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'accounting_payroll_services' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'accounting_payroll_services';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'accounting_monthly_accounting_services' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'accounting_monthly_accounting_services';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'accounting_annual_financial_reporting' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'accounting_annual_financial_reporting';
  end if;

  -- Business support services
  if not exists (select 1 from pg_enum where enumlabel = 'support_company_registration' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'support_company_registration';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'support_business_compliance' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'support_business_compliance';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'support_cipc_services' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'support_cipc_services';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'support_business_advisory' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'support_business_advisory';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'support_financial_compliance' and enumtypid = 'public.service_request_service_needed'::regtype) then
    alter type public.service_request_service_needed add value 'support_financial_compliance';
  end if;
end $$;

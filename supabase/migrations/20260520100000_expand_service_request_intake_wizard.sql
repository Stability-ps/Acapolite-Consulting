do $$
begin
  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'trust'
      and enumtypid = 'public.service_request_client_type'::regtype
  ) then
    alter type public.service_request_client_type add value 'trust';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'npo_organisation'
      and enumtypid = 'public.service_request_client_type'::regtype
  ) then
    alter type public.service_request_client_type add value 'npo_organisation';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'trust_services'
      and enumtypid = 'public.service_request_category'::regtype
  ) then
    alter type public.service_request_category add value 'trust_services';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'npo_organisation_services'
      and enumtypid = 'public.service_request_category'::regtype
  ) then
    alter type public.service_request_category add value 'npo_organisation_services';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'individual_tax_compliance_status_assistance'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'individual_tax_compliance_status_assistance';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'business_tax_compliance_support'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'business_tax_compliance_support';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'accounting_cash_flow_management'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'accounting_cash_flow_management';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'accounting_budget_planning'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'accounting_budget_planning';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'support_annual_returns_filing'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'support_annual_returns_filing';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'trust_tax_returns'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'trust_tax_returns';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'trust_compliance'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'trust_compliance';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'trust_sars_assistance'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'trust_sars_assistance';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'trust_tax_clearance'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'trust_tax_clearance';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'trust_financial_statements'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'trust_financial_statements';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'trust_advisory_support'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'trust_advisory_support';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'npo_registration_assistance'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'npo_registration_assistance';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'npo_tax_exemption_assistance'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'npo_tax_exemption_assistance';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'npo_annual_compliance_filing'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'npo_annual_compliance_filing';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'npo_payroll_accounting'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'npo_payroll_accounting';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'npo_sars_compliance'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'npo_sars_compliance';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'npo_financial_reporting'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'npo_financial_reporting';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'npo_governance_advisory'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'npo_governance_advisory';
  end if;
end
$$;

alter table public.service_requests
  add column if not exists city text,
  add column if not exists contact_preference text,
  add column if not exists marketing_consent boolean not null default true,
  add column if not exists submitted_with_account boolean not null default false,
  add column if not exists client_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists intake_payload jsonb not null default '{}'::jsonb;

create or replace function public.get_service_request_min_access_tier(
  p_services public.service_request_service_needed[]
)
returns public.lead_access_tier
language plpgsql
immutable
as $$
declare
  v_service public.service_request_service_needed;
  v_required_tier public.lead_access_tier := 'basic'::public.lead_access_tier;
begin
  foreach v_service in array coalesce(p_services, '{}'::public.service_request_service_needed[]) loop
    if v_service = 'business_sars_audits_support' then
      return 'business'::public.lead_access_tier;
    end if;

    if v_service in (
      'individual_sars_debt_assistance',
      'individual_objections_and_disputes',
      'individual_tax_compliance_status_assistance',
      'business_company_income_tax',
      'business_vat_registration',
      'business_vat_returns',
      'business_paye_registration',
      'business_paye_compliance',
      'business_sars_debt_arrangements',
      'business_tax_clearance_certificates',
      'business_tax_compliance_support',
      'accounting_bookkeeping',
      'accounting_financial_statements',
      'accounting_management_accounts',
      'accounting_payroll_services',
      'accounting_monthly_accounting_services',
      'accounting_annual_financial_reporting',
      'accounting_cash_flow_management',
      'accounting_budget_planning',
      'support_company_registration',
      'support_business_compliance',
      'support_cipc_services',
      'support_business_advisory',
      'support_financial_compliance',
      'support_annual_returns_filing',
      'trust_tax_returns',
      'trust_compliance',
      'trust_sars_assistance',
      'trust_tax_clearance',
      'trust_financial_statements',
      'trust_advisory_support',
      'npo_registration_assistance',
      'npo_tax_exemption_assistance',
      'npo_annual_compliance_filing',
      'npo_payroll_accounting',
      'npo_sars_compliance',
      'npo_financial_reporting',
      'npo_governance_advisory'
    ) then
      v_required_tier := 'professional'::public.lead_access_tier;
    end if;
  end loop;

  return v_required_tier;
end;
$$;

create or replace function public.get_service_request_base_credit_cost(
  p_service_needed public.service_request_service_needed
)
returns integer
language plpgsql
immutable
as $$
begin
  return case p_service_needed
    when 'individual_personal_income_tax_returns' then 2
    when 'individual_sars_debt_assistance' then 5
    when 'individual_tax_compliance_issues' then 2
    when 'individual_tax_clearance_certificates' then 3
    when 'individual_objections_and_disputes' then 7
    when 'individual_late_return_submissions' then 2
    when 'individual_tax_number_registration' then 2
    when 'individual_tax_status_corrections' then 2
    when 'individual_tax_compliance_status_assistance' then 3
    when 'business_company_income_tax' then 5
    when 'business_vat_registration' then 3
    when 'business_vat_returns' then 4
    when 'business_paye_registration' then 3
    when 'business_paye_compliance' then 4
    when 'business_sars_debt_arrangements' then 6
    when 'business_tax_clearance_certificates' then 3
    when 'business_sars_audits_support' then 7
    when 'business_tax_compliance_support' then 5
    when 'accounting_bookkeeping' then 5
    when 'accounting_financial_statements' then 6
    when 'accounting_management_accounts' then 6
    when 'accounting_payroll_services' then 5
    when 'accounting_monthly_accounting_services' then 5
    when 'accounting_annual_financial_reporting' then 6
    when 'accounting_cash_flow_management' then 6
    when 'accounting_budget_planning' then 6
    when 'support_company_registration' then 4
    when 'support_business_compliance' then 5
    when 'support_cipc_services' then 4
    when 'support_business_advisory' then 6
    when 'support_financial_compliance' then 6
    when 'support_annual_returns_filing' then 4
    when 'trust_tax_returns' then 5
    when 'trust_compliance' then 5
    when 'trust_sars_assistance' then 6
    when 'trust_tax_clearance' then 4
    when 'trust_financial_statements' then 6
    when 'trust_advisory_support' then 6
    when 'npo_registration_assistance' then 4
    when 'npo_tax_exemption_assistance' then 5
    when 'npo_annual_compliance_filing' then 4
    when 'npo_payroll_accounting' then 5
    when 'npo_sars_compliance' then 5
    when 'npo_financial_reporting' then 6
    when 'npo_governance_advisory' then 6
    else 4
  end;
end;
$$;

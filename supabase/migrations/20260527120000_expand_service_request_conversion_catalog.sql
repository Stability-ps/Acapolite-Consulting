do $$
begin
  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'individual_voluntary_disclosure_programme'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'individual_voluntary_disclosure_programme';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'individual_sars_verification_refund_assistance'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'individual_sars_verification_refund_assistance';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'individual_tax_directives'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'individual_tax_directives';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'individual_estate_pension_tax_matters'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'individual_estate_pension_tax_matters';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'individual_other'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'individual_other';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'business_vat_paye_corrections'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'business_vat_paye_corrections';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'business_tax_debt_compromise'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'business_tax_debt_compromise';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'business_vat_objections_disputes'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'business_vat_objections_disputes';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'business_tax_other'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'business_tax_other';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'trust_representative_assistance'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'trust_representative_assistance';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'trust_sars_disputes_objections'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'trust_sars_disputes_objections';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'trust_other'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'trust_other';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'npo_pbo_applications_assistance'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'npo_pbo_applications_assistance';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'npo_donor_tax_section18a_assistance'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'npo_donor_tax_section18a_assistance';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'npo_audit_compliance_support'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'npo_audit_compliance_support';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'npo_organisation_other'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'npo_organisation_other';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'accounting_independent_reviews'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'accounting_independent_reviews';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'accounting_other'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'accounting_other';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'support_beneficial_ownership_filings'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'support_beneficial_ownership_filings';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'support_director_shareholder_changes'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'support_director_shareholder_changes';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'support_bee_assistance'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'support_bee_assistance';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'business_support_other'
      and enumtypid = 'public.service_request_service_needed'::regtype
  ) then
    alter type public.service_request_service_needed add value 'business_support_other';
  end if;
end
$$;

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
      'individual_voluntary_disclosure_programme',
      'individual_sars_verification_refund_assistance',
      'individual_tax_directives',
      'individual_estate_pension_tax_matters',
      'business_company_income_tax',
      'business_vat_registration',
      'business_vat_returns',
      'business_paye_registration',
      'business_paye_compliance',
      'business_sars_debt_arrangements',
      'business_tax_clearance_certificates',
      'business_tax_compliance_support',
      'business_vat_paye_corrections',
      'business_tax_debt_compromise',
      'business_vat_objections_disputes',
      'business_tax_other',
      'accounting_bookkeeping',
      'accounting_financial_statements',
      'accounting_management_accounts',
      'accounting_payroll_services',
      'accounting_monthly_accounting_services',
      'accounting_annual_financial_reporting',
      'accounting_cash_flow_management',
      'accounting_budget_planning',
      'accounting_independent_reviews',
      'accounting_other',
      'support_company_registration',
      'support_business_compliance',
      'support_cipc_services',
      'support_business_advisory',
      'support_financial_compliance',
      'support_annual_returns_filing',
      'support_beneficial_ownership_filings',
      'support_director_shareholder_changes',
      'support_bee_assistance',
      'business_support_other',
      'trust_tax_returns',
      'trust_compliance',
      'trust_sars_assistance',
      'trust_tax_clearance',
      'trust_financial_statements',
      'trust_representative_assistance',
      'trust_advisory_support',
      'trust_sars_disputes_objections',
      'trust_other',
      'npo_registration_assistance',
      'npo_tax_exemption_assistance',
      'npo_annual_compliance_filing',
      'npo_payroll_accounting',
      'npo_sars_compliance',
      'npo_financial_reporting',
      'npo_governance_advisory',
      'npo_pbo_applications_assistance',
      'npo_donor_tax_section18a_assistance',
      'npo_audit_compliance_support',
      'npo_organisation_other'
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
    when 'individual_late_return_submissions' then 2
    when 'individual_tax_number_registration' then 2
    when 'individual_tax_compliance_issues' then 2
    when 'individual_tax_status_corrections' then 2
    when 'individual_tax_clearance_certificates' then 3
    when 'individual_tax_compliance_status_assistance' then 3
    when 'individual_voluntary_disclosure_programme' then 4
    when 'individual_sars_verification_refund_assistance' then 4
    when 'individual_tax_directives' then 4
    when 'individual_sars_debt_assistance' then 5
    when 'individual_estate_pension_tax_matters' then 5
    when 'individual_objections_and_disputes' then 7
    when 'individual_other' then 4
    when 'business_vat_registration' then 3
    when 'business_paye_registration' then 3
    when 'business_tax_clearance_certificates' then 3
    when 'business_vat_returns' then 4
    when 'business_paye_compliance' then 4
    when 'business_company_income_tax' then 5
    when 'business_tax_compliance_support' then 5
    when 'business_vat_paye_corrections' then 5
    when 'business_tax_debt_compromise' then 6
    when 'business_sars_debt_arrangements' then 6
    when 'business_vat_objections_disputes' then 6
    when 'business_sars_audits_support' then 7
    when 'business_tax_other' then 5
    when 'trust_tax_returns' then 4
    when 'trust_compliance' then 4
    when 'trust_tax_clearance' then 4
    when 'trust_sars_assistance' then 5
    when 'trust_financial_statements' then 5
    when 'trust_representative_assistance' then 5
    when 'trust_advisory_support' then 6
    when 'trust_sars_disputes_objections' then 7
    when 'trust_other' then 5
    when 'npo_registration_assistance' then 4
    when 'npo_tax_exemption_assistance' then 4
    when 'npo_annual_compliance_filing' then 4
    when 'npo_sars_compliance' then 5
    when 'npo_payroll_accounting' then 5
    when 'npo_financial_reporting' then 5
    when 'npo_pbo_applications_assistance' then 5
    when 'npo_donor_tax_section18a_assistance' then 5
    when 'npo_governance_advisory' then 6
    when 'npo_audit_compliance_support' then 6
    when 'npo_organisation_other' then 5
    when 'accounting_bookkeeping' then 5
    when 'accounting_payroll_services' then 5
    when 'accounting_monthly_accounting_services' then 5
    when 'accounting_financial_statements' then 6
    when 'accounting_management_accounts' then 6
    when 'accounting_cash_flow_management' then 6
    when 'accounting_budget_planning' then 6
    when 'accounting_annual_financial_reporting' then 6
    when 'accounting_independent_reviews' then 7
    when 'accounting_other' then 6
    when 'support_company_registration' then 4
    when 'support_cipc_services' then 4
    when 'support_annual_returns_filing' then 4
    when 'support_beneficial_ownership_filings' then 4
    when 'support_director_shareholder_changes' then 4
    when 'support_business_compliance' then 5
    when 'support_financial_compliance' then 6
    when 'support_business_advisory' then 6
    when 'support_bee_assistance' then 6
    when 'business_support_other' then 5
    else 4
  end;
end;
$$;

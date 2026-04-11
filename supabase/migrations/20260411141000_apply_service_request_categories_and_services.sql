update public.service_requests
set
  service_category = case service_needed
    when 'tax_return' then 'individual_tax'::public.service_request_category
    when 'sars_debt_assistance' then 'individual_tax'::public.service_request_category
    when 'vat_registration' then 'business_tax'::public.service_request_category
    when 'company_tax' then 'business_tax'::public.service_request_category
    when 'paye_issues' then 'business_tax'::public.service_request_category
    when 'objection_dispute' then 'individual_tax'::public.service_request_category
    when 'bookkeeping' then 'accounting'::public.service_request_category
    else 'business_support'::public.service_request_category
  end,
  service_needed = case service_needed
    when 'tax_return' then 'individual_personal_income_tax_returns'::public.service_request_service_needed
    when 'sars_debt_assistance' then 'individual_sars_debt_assistance'::public.service_request_service_needed
    when 'vat_registration' then 'business_vat_registration'::public.service_request_service_needed
    when 'company_tax' then 'business_company_income_tax'::public.service_request_service_needed
    when 'paye_issues' then 'business_paye_compliance'::public.service_request_service_needed
    when 'objection_dispute' then 'individual_objections_and_disputes'::public.service_request_service_needed
    when 'bookkeeping' then 'accounting_bookkeeping'::public.service_request_service_needed
    when 'other' then 'support_business_advisory'::public.service_request_service_needed
    else service_needed
  end
where service_category is null;

update public.practitioner_profiles
set services_offered = (
  select array_agg(
    case service_value
      when 'tax_return' then 'individual_personal_income_tax_returns'
      when 'sars_debt_assistance' then 'individual_sars_debt_assistance'
      when 'vat_registration' then 'business_vat_registration'
      when 'company_tax' then 'business_company_income_tax'
      when 'paye_issues' then 'business_paye_compliance'
      when 'objection_dispute' then 'individual_objections_and_disputes'
      when 'bookkeeping' then 'accounting_bookkeeping'
      when 'other' then 'support_business_advisory'
      else service_value
    end
  )
  from unnest(services_offered) as service_value
)
where services_offered is not null
  and cardinality(services_offered) > 0;

update public.service_requests
set service_category = 'individual_tax'
where service_category is null;

alter table public.service_requests
  alter column service_category set not null;

create or replace function public.map_service_request_to_case_type(
  p_service_needed public.service_request_service_needed
)
returns public.case_type
language plpgsql
immutable
as $$
begin
  return case p_service_needed
    when 'business_company_income_tax' then 'corporate_tax_return'::public.case_type
    when 'business_vat_registration' then 'vat_registration'::public.case_type
    when 'business_vat_returns' then 'vat_registration'::public.case_type
    when 'business_tax_clearance_certificates' then 'tax_clearance_certificate'::public.case_type
    when 'individual_tax_clearance_certificates' then 'tax_clearance_certificate'::public.case_type
    when 'individual_objections_and_disputes' then 'sars_dispute_objection'::public.case_type
    when 'business_sars_audits_support' then 'sars_dispute_objection'::public.case_type
    when 'individual_sars_debt_assistance' then 'sars_dispute_objection'::public.case_type
    when 'business_sars_debt_arrangements' then 'sars_dispute_objection'::public.case_type
    else 'other'::public.case_type
  end;
end;
$$;

create or replace function public.get_service_request_credit_cost(
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
    when 'individual_tax_compliance_issues' then 4
    when 'individual_tax_clearance_certificates' then 4
    when 'individual_objections_and_disputes' then 6
    when 'individual_late_return_submissions' then 4
    when 'individual_tax_number_registration' then 4
    when 'individual_tax_status_corrections' then 4
    when 'business_company_income_tax' then 4
    when 'business_vat_registration' then 3
    when 'business_vat_returns' then 3
    when 'business_paye_registration' then 4
    when 'business_paye_compliance' then 4
    when 'business_sars_debt_arrangements' then 5
    when 'business_tax_clearance_certificates' then 4
    when 'business_sars_audits_support' then 4
    when 'accounting_bookkeeping' then 5
    when 'accounting_financial_statements' then 4
    when 'accounting_management_accounts' then 4
    when 'accounting_payroll_services' then 4
    when 'accounting_monthly_accounting_services' then 5
    when 'accounting_annual_financial_reporting' then 4
    when 'support_company_registration' then 4
    when 'support_business_compliance' then 4
    when 'support_cipc_services' then 4
    when 'support_business_advisory' then 4
    when 'support_financial_compliance' then 4
    else 4;
  end;
end;
$$;

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
    when 'business_company_income_tax' then 5
    when 'business_vat_registration' then 3
    when 'business_vat_returns' then 4
    when 'business_paye_registration' then 3
    when 'business_paye_compliance' then 4
    when 'business_sars_debt_arrangements' then 6
    when 'business_tax_clearance_certificates' then 3
    when 'business_sars_audits_support' then 7
    when 'accounting_bookkeeping' then 5
    when 'accounting_financial_statements' then 6
    when 'accounting_management_accounts' then 6
    when 'accounting_payroll_services' then 5
    when 'accounting_monthly_accounting_services' then 5
    when 'accounting_annual_financial_reporting' then 6
    when 'support_company_registration' then 4
    when 'support_business_compliance' then 5
    when 'support_cipc_services' then 4
    when 'support_business_advisory' then 6
    when 'support_financial_compliance' then 6
    else 4
  end;
end;
$$;

update public.service_request_access_requests as sra
set
  credit_cost = public.get_service_request_credit_cost_for_services(
    case
      when coalesce(array_length(sr.service_needed_list, 1), 0) > 0 then sr.service_needed_list
      when sr.service_needed is not null then array[sr.service_needed]
      else '{}'::public.service_request_service_needed[]
    end
  ),
  updated_at = now()
from public.service_requests as sr
where sr.id = sra.service_request_id
  and sra.credit_deducted = false;

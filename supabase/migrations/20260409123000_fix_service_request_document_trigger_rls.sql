create or replace function public.refresh_service_request_risk()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  attachment_count integer := 0;
begin
  if tg_table_name = 'service_request_documents' then
    select count(*)
    into attachment_count
    from public.service_request_documents
    where service_request_id = coalesce(new.service_request_id, old.service_request_id);

    update public.service_requests
    set
      missing_documents_flag = attachment_count = 0,
      risk_indicator = case
        when has_debt_flag and missing_returns_flag then 'high'::public.service_request_risk_indicator
        when has_debt_flag or missing_returns_flag or attachment_count = 0 then 'medium'::public.service_request_risk_indicator
        else 'low'::public.service_request_risk_indicator
      end,
      updated_at = now()
    where id = coalesce(new.service_request_id, old.service_request_id);

    return coalesce(new, old);
  end if;

  new.has_debt_flag := coalesce(new.sars_debt_amount, 0) > 0;
  new.missing_returns_flag := not coalesce(new.returns_filed, false);

  select count(*)
  into attachment_count
  from public.service_request_documents
  where service_request_id = coalesce(new.id, old.id);

  new.missing_documents_flag := attachment_count = 0;
  new.risk_indicator := case
    when new.has_debt_flag and new.missing_returns_flag then 'high'::public.service_request_risk_indicator
    when new.has_debt_flag or new.missing_returns_flag or attachment_count = 0 then 'medium'::public.service_request_risk_indicator
    else 'low'::public.service_request_risk_indicator
  end;

  return new;
end;
$$;

alter table public.service_requests
  add column if not exists service_categories public.service_request_category[],
  add column if not exists service_needed_list public.service_request_service_needed[];

update public.service_requests
set
  service_categories = coalesce(
    service_categories,
    case
      when service_category is null then '{}'::public.service_request_category[]
      else array[service_category]
    end
  ),
  service_needed_list = coalesce(
    service_needed_list,
    array[service_needed]
  );

create index if not exists idx_service_requests_service_categories
  on public.service_requests using gin(service_categories);

create index if not exists idx_service_requests_service_needed_list
  on public.service_requests using gin(service_needed_list);

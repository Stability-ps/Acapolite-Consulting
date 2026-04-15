alter table public.cases
  add column if not exists case_number text;

update public.cases
set case_number = 'CASE-' || upper(left(replace(id::text, '-', ''), 8))
where case_number is null;

alter table public.cases
  alter column case_number set not null;

create unique index if not exists cases_case_number_key
  on public.cases(case_number);

create index if not exists idx_cases_case_number
  on public.cases(case_number);

create or replace function public.set_case_number()
returns trigger
language plpgsql
as $$
begin
  if new.case_number is null or btrim(new.case_number) = '' then
    new.case_number := 'CASE-' || upper(left(replace(new.id::text, '-', ''), 8));
  end if;

  return new;
end;
$$;

drop trigger if exists set_case_number_on_cases on public.cases;

create trigger set_case_number_on_cases
before insert on public.cases
for each row
execute function public.set_case_number();

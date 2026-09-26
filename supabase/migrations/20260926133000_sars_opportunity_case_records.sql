-- SARS Opportunity Hub case records derived from reviewed public evidence.
create table if not exists public.sars_opportunities (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  public_signal_id uuid not null references public.prospect_public_signals(id) on delete cascade,
  opportunity_type text not null,
  status text not null default 'review' check (status in ('review','qualified','contact_ready','contacted','follow_up','converted','dismissed')),
  score integer not null default 50 check (score between 0 and 100),
  issue_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(public_signal_id)
);
create index if not exists sars_opportunities_prospect_idx on public.sars_opportunities(prospect_id);
create index if not exists sars_opportunities_type_status_idx on public.sars_opportunities(opportunity_type,status);

alter table public.sars_opportunities enable row level security;
drop policy if exists "staff view sars opportunities" on public.sars_opportunities;
create policy "staff view sars opportunities" on public.sars_opportunities for select using (
 exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','consultant'))
);
drop policy if exists "staff manage sars opportunities" on public.sars_opportunities;
create policy "staff manage sars opportunities" on public.sars_opportunities for all using (
 exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','consultant'))
) with check (
 exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','consultant'))
);

create or replace function public.classify_sars_signal(p_type text, p_summary text)
returns text language sql immutable as $$
 select case
  when p_type='preservation_order' or coalesce(p_summary,'') ~* 'section\s*163|preservation order' then 'preservation_order'
  when p_type in ('s164_suspension','suspension_of_payment') or coalesce(p_summary,'') ~* 'section\s*164|suspension of payment' then 's164_suspension'
  when p_type='s200_compromise' or coalesce(p_summary,'') ~* 'section\s*200|compromise of tax debt' then 's200_compromise'
  when p_type='sars_debt_enforcement' or coalesce(p_summary,'') ~* 'tax debt|debt enforcement|section\s*179|final demand' then 'sars_debt_enforcement'
  when p_type='tax_dispute' or coalesce(p_summary,'') ~* 'objection|appeal|assessment dispute' then 'tax_dispute_appeal'
  when coalesce(p_summary,'') ~* '\bVAT\b|value-added tax' then 'vat'
  when coalesce(p_summary,'') ~* '\bPAYE\b|employees.? tax' then 'paye'
  when p_type='liquidation' then 'liquidation'
  when p_type='insolvency' then 'insolvency'
  when p_type='business_rescue' then 'business_rescue'
  when p_type='sars_court_case' then 'other_tax'
  else 'other_tax' end
$$;

create or replace function public.sync_sars_opportunity_from_signal()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.signal_type in ('sars_court_case','tax_dispute','sars_debt_enforcement','preservation_order','s164_suspension','suspension_of_payment','s200_compromise','liquidation','insolvency','business_rescue') then
  insert into public.sars_opportunities(prospect_id,public_signal_id,opportunity_type,score,issue_summary)
  values(new.prospect_id,new.id,public.classify_sars_signal(new.signal_type,new.evidence_summary),
    case when new.signal_type in ('sars_debt_enforcement','preservation_order','s164_suspension','suspension_of_payment','s200_compromise') then 80
         when new.signal_type in ('sars_court_case','tax_dispute') then 70 else 55 end,
    new.evidence_summary)
  on conflict(public_signal_id) do update set opportunity_type=excluded.opportunity_type,issue_summary=excluded.issue_summary,updated_at=now();
 end if;
 return new;
end $$;
drop trigger if exists trg_sync_sars_opportunity_from_signal on public.prospect_public_signals;
create trigger trg_sync_sars_opportunity_from_signal after insert or update of signal_type,evidence_summary on public.prospect_public_signals
for each row execute function public.sync_sars_opportunity_from_signal();

insert into public.sars_opportunities(prospect_id,public_signal_id,opportunity_type,score,issue_summary)
select s.prospect_id,s.id,public.classify_sars_signal(s.signal_type,s.evidence_summary),
 case when s.signal_type in ('sars_debt_enforcement','preservation_order','s164_suspension','suspension_of_payment','s200_compromise') then 80
      when s.signal_type in ('sars_court_case','tax_dispute') then 70 else 55 end,
 s.evidence_summary
from public.prospect_public_signals s
where s.signal_type in ('sars_court_case','tax_dispute','sars_debt_enforcement','preservation_order','s164_suspension','suspension_of_payment','s200_compromise','liquidation','insolvency','business_rescue')
on conflict(public_signal_id) do nothing;

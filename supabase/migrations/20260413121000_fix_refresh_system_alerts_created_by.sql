create or replace function public.refresh_system_alerts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Missing documents
  insert into public.alerts (
    client_id,
    case_id,
    title,
    description,
    alert_type,
    status,
    alert_at,
    created_by,
    is_system
  )
  select
    dr.client_id,
    dr.case_id,
    'Missing documents required',
    coalesce(dr.description, dr.title),
    'missing_document'::public.alert_type,
    'active'::public.alert_status,
    coalesce(dr.due_date, now()),
    null::uuid,
    true
  from public.document_requests dr
  where dr.is_required = true
    and coalesce(dr.is_fulfilled, false) = false
    and not exists (
      select 1
      from public.alerts a
      where a.is_system = true
        and a.alert_type = 'missing_document'
        and a.status = 'active'
        and a.client_id = dr.client_id
        and a.case_id is not distinct from dr.case_id
        and a.title = 'Missing documents required'
    );

  update public.alerts a
  set status = 'resolved', updated_at = now()
  where a.is_system = true
    and a.alert_type = 'missing_document'
    and a.status = 'active'
    and not exists (
      select 1
      from public.document_requests dr
      where dr.client_id = a.client_id
        and dr.case_id is not distinct from a.case_id
        and dr.is_required = true
        and coalesce(dr.is_fulfilled, false) = false
    );

  -- Overdue invoices
  insert into public.alerts (
    client_id,
    case_id,
    invoice_id,
    title,
    description,
    alert_type,
    status,
    alert_at,
    created_by,
    is_system
  )
  select
    i.client_id,
    i.case_id,
    i.id,
    'Invoice overdue',
    coalesce(i.title, 'Invoice') || ' is overdue.',
    'payment_deadline'::public.alert_type,
    'active'::public.alert_status,
    coalesce(i.due_date, now()),
    null::uuid,
    true
  from public.invoices i
  where i.status in ('issued', 'partially_paid', 'overdue')
    and i.due_date is not null
    and i.due_date::date < now()::date
    and not exists (
      select 1
      from public.alerts a
      where a.is_system = true
        and a.alert_type = 'payment_deadline'
        and a.status = 'active'
        and a.invoice_id = i.id
    );

  update public.alerts a
  set status = 'resolved', updated_at = now()
  where a.is_system = true
    and a.alert_type = 'payment_deadline'
    and a.status = 'active'
    and (
      a.invoice_id is null
      or exists (
        select 1
        from public.invoices i
        where i.id = a.invoice_id
          and (i.status = 'paid' or i.status = 'cancelled' or i.due_date is null or i.due_date::date >= now()::date)
      )
    );

  -- Pending reviews (documents)
  insert into public.alerts (
    client_id,
    case_id,
    title,
    description,
    alert_type,
    status,
    alert_at,
    created_by,
    is_system
  )
  select distinct
    d.client_id,
    d.case_id,
    'Documents pending review',
    'Client documents are awaiting review.',
    'follow_up_required'::public.alert_type,
    'active'::public.alert_status,
    coalesce(d.uploaded_at, now()),
    null::uuid,
    true
  from public.documents d
  where d.status in ('uploaded', 'pending_review')
    and not exists (
      select 1
      from public.alerts a
      where a.is_system = true
        and a.alert_type = 'follow_up_required'
        and a.status = 'active'
        and a.client_id = d.client_id
        and a.case_id is not distinct from d.case_id
        and a.title = 'Documents pending review'
    );

  update public.alerts a
  set status = 'resolved', updated_at = now()
  where a.is_system = true
    and a.alert_type = 'follow_up_required'
    and a.status = 'active'
    and not exists (
      select 1
      from public.documents d
      where d.client_id = a.client_id
        and d.case_id is not distinct from a.case_id
        and d.status in ('uploaded', 'pending_review')
    );

  -- SARS deadlines (case due dates within 7 days or overdue)
  insert into public.alerts (
    client_id,
    case_id,
    title,
    description,
    alert_type,
    status,
    alert_at,
    created_by,
    is_system
  )
  select
    c.client_id,
    c.id,
    'SARS deadline approaching',
    'Upcoming SARS deadline for this case.',
    'sars_due_date'::public.alert_type,
    'active'::public.alert_status,
    c.due_date,
    null::uuid,
    true
  from public.cases c
  where c.due_date is not null
    and c.status not in ('resolved', 'closed')
    and c.due_date::date <= (now()::date + 7)
    and not exists (
      select 1
      from public.alerts a
      where a.is_system = true
        and a.alert_type = 'sars_due_date'
        and a.status = 'active'
        and a.case_id = c.id
        and a.title = 'SARS deadline approaching'
    );

  update public.alerts a
  set status = 'resolved', updated_at = now()
  where a.is_system = true
    and a.alert_type = 'sars_due_date'
    and a.status = 'active'
    and (
      a.case_id is null
      or exists (
        select 1
        from public.cases c
        where c.id = a.case_id
          and (c.status in ('resolved', 'closed') or c.due_date is null or c.due_date::date > (now()::date + 7))
      )
    );
end;
$$;

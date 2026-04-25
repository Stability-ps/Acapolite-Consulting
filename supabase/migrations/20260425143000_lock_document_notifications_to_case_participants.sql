create or replace function public.handle_document_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client public.clients%rowtype;
  v_case public.cases%rowtype;
  v_actor_role public.app_role;
  v_recipient_ids uuid[];
  v_practitioner_profile_id uuid;
  v_staff_link text;
  v_client_link text;
begin
  select *
  into v_client
  from public.clients
  where id = new.client_id;

  if new.case_id is not null then
    select *
    into v_case
    from public.cases
    where id = new.case_id;
  end if;

  if new.uploaded_by is not null then
    select role
    into v_actor_role
    from public.profiles
    where id = new.uploaded_by;
  end if;

  v_practitioner_profile_id := coalesce(v_case.assigned_consultant_id, v_client.assigned_consultant_id);
  v_staff_link := case
    when new.case_id is not null then '/dashboard/staff/cases?caseId=' || new.case_id::text
    else '/dashboard/staff/documents'
  end;
  v_client_link := case
    when new.case_id is not null then '/dashboard/client/cases?caseId=' || new.case_id::text
    else '/dashboard/client/documents'
  end;

  if tg_op = 'INSERT' then
    if v_actor_role = 'client' then
      v_recipient_ids := public.staff_profile_ids(array['admin']::public.app_role[]);

      if v_practitioner_profile_id is not null then
        v_recipient_ids := array_append(v_recipient_ids, v_practitioner_profile_id);
      end if;

      perform public.create_notifications(
        v_recipient_ids,
        new.uploaded_by,
        'document_uploaded',
        'documents',
        'New client document uploaded',
        coalesce(new.title, new.file_name, 'A document') || ' was uploaded by a client.',
        v_staff_link,
        'document',
        new.id,
        jsonb_build_object(
          'client_id', new.client_id,
          'case_id', new.case_id,
          'assigned_practitioner_id', v_practitioner_profile_id
        )
      );
    else
      perform public.create_notification(
        v_client.profile_id,
        new.uploaded_by,
        'document_uploaded',
        'documents',
        'New document available',
        coalesce(new.title, new.file_name, 'A document') || ' was uploaded to your portal.',
        v_client_link,
        'document',
        new.id,
        jsonb_build_object(
          'client_id', new.client_id,
          'case_id', new.case_id,
          'assigned_practitioner_id', v_practitioner_profile_id
        )
      );
    end if;

    return new;
  end if;

  if new.status is distinct from old.status then
    perform public.create_notification(
      v_client.profile_id,
      auth.uid(),
      'document_status_changed',
      'documents',
      'Document status updated',
      coalesce(new.title, new.file_name, 'A document') || ' is now ' || replace(new.status::text, '_', ' ') || '.',
      v_client_link,
      'document',
      new.id,
      jsonb_build_object(
        'previous_status', old.status,
        'new_status', new.status,
        'client_id', new.client_id,
        'case_id', new.case_id,
        'assigned_practitioner_id', v_practitioner_profile_id
      )
    );
  end if;

  return new;
end;
$$;

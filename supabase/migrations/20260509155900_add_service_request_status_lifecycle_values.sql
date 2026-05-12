alter type public.service_request_status add value if not exists 'pending_client_confirmation';
alter type public.service_request_status add value if not exists 'expired';

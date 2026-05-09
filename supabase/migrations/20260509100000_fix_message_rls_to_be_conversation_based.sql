-- Fix message RLS policies to be conversation-based instead of case-based
-- This prevents practitioners from seeing messages in conversations they're not part of

drop policy if exists "Case participants can view messages" on public.messages;
drop policy if exists "Case participants can send messages" on public.messages;
drop policy if exists "Admins can manage all messages" on public.messages;

-- Messages: Users can only view messages in conversations they participate in
create policy "messages_select_conversation_participants"
  on public.messages for select
  using (
    public.get_my_role() = 'admin'
    or exists (
      select 1
      from public.conversations c
      join public.clients cl on cl.id = c.client_id
      where c.id = messages.conversation_id
        and (
          -- Client can view their own conversation messages
          cl.profile_id = auth.uid()
          -- Practitioner can view if they're assigned to the conversation
          or c.practitioner_profile_id = auth.uid()
        )
    )
  );

-- Messages: Users can only insert messages in conversations they participate in
create policy "messages_insert_conversation_participants"
  on public.messages for insert
  with check (
    auth.uid() = sender_profile_id
    and exists (
      select 1
      from public.conversations c
      join public.clients cl on cl.id = c.client_id
      where c.id = messages.conversation_id
        and (
          -- Client can send to their own conversation
          cl.profile_id = auth.uid()
          -- Practitioner can send if they're assigned to the conversation
          or c.practitioner_profile_id = auth.uid()
        )
    )
  );

-- Messages: Users can update their own messages
create policy "messages_update_own"
  on public.messages for update
  using (
    auth.uid() = sender_profile_id
    or public.get_my_role() = 'admin'
  )
  with check (
    auth.uid() = sender_profile_id
    or public.get_my_role() = 'admin'
  );

-- Conversations: Users can only view conversations they participate in
drop policy if exists "conversations_select_own" on public.conversations;
drop policy if exists "Clients can view own conversations" on public.conversations;
drop policy if exists "Staff can view all conversations" on public.conversations;

create policy "conversations_select_participants"
  on public.conversations for select
  using (
    public.get_my_role() = 'admin'
    or exists (
      select 1
      from public.clients cl
      where cl.id = conversations.client_id
        and cl.profile_id = auth.uid()
    )
    or conversations.practitioner_profile_id = auth.uid()
  );

-- Conversations: Users can only insert conversations they're part of
drop policy if exists "conversations_insert_own" on public.conversations;

create policy "conversations_insert_participants"
  on public.conversations for insert
  with check (
    public.get_my_role() = 'admin'
    or exists (
      select 1
      from public.clients cl
      where cl.id = conversations.client_id
        and cl.profile_id = auth.uid()
    )
    or conversations.practitioner_profile_id = auth.uid()
  );

-- Conversations: Users can update conversations they participate in
drop policy if exists "conversations_update_own" on public.conversations;

create policy "conversations_update_participants"
  on public.conversations for update
  using (
    public.get_my_role() = 'admin'
    or exists (
      select 1
      from public.clients cl
      where cl.id = conversations.client_id
        and cl.profile_id = auth.uid()
    )
    or conversations.practitioner_profile_id = auth.uid()
  )
  with check (
    public.get_my_role() = 'admin'
    or exists (
      select 1
      from public.clients cl
      where cl.id = conversations.client_id
        and cl.profile_id = auth.uid()
    )
    or conversations.practitioner_profile_id = auth.uid()
  );

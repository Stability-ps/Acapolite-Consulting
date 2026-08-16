# Acapolite WhatsApp Admin AI Integration

## Purpose

Replace the externally hosted ElevenLabs WhatsApp text agent with an Acapolite-owned WhatsApp integration while preserving the existing Facebook/Instagram click-to-WhatsApp customer journey.

WhatsApp is an **admin-only intake channel**. Practitioners do not see, manage, query, or control WhatsApp conversations. Practitioners continue to receive work only through the existing `service_requests` and case workflows after an admin-approved handoff.

## Production safety rules

1. Do not change the live Meta webhook until the replacement is tested on a non-production/test WhatsApp configuration.
2. Do not disconnect ElevenLabs until inbound receipt, outbound replies, deduplication, human handoff, and admin visibility are verified.
3. WhatsApp data must be admin-only at the database and UI layers.
4. Public clients never receive direct database access to WhatsApp data. Meta webhook writes occur only server-side.
5. OpenAI and Meta credentials live only in Supabase project secrets.
6. Every Meta message ID must be stored uniquely so webhook retries cannot produce duplicate messages or duplicate AI replies.
7. AI may qualify and summarize an enquiry, but must not assign practitioners, create cases, expose practitioner data, or make irreversible platform changes.
8. Human handoff immediately pauses AI replies until an admin explicitly resumes automation.
9. Existing `service_requests`, practitioner credits, assignments, and case workflows are not modified in Phase 1.

## Target flow

Facebook / Instagram click-to-WhatsApp ad
→ existing WhatsApp Business number
→ Meta WhatsApp Cloud API webhook
→ `whatsapp-agent` Supabase Edge Function
→ admin-only WhatsApp conversation store
→ OpenAI Responses API
→ Meta WhatsApp Cloud API reply
→ optional secure handoff into existing `/request-tax-assistance`
→ existing `service_requests` workflow
→ practitioner only after normal platform routing/assignment

## Phase 1 scope

- Verify Meta webhook challenge.
- Validate Meta webhook signatures before production cutover.
- Receive inbound text messages.
- De-duplicate webhook retries.
- Store conversations and messages.
- Capture referral/ad metadata supplied by Meta where available.
- Generate concise lead-intake replies with OpenAI.
- Send replies through Meta WhatsApp Cloud API.
- Detect explicit requests for a human and pause automation.
- Keep all WhatsApp data admin-only.
- No automatic service-request creation in Phase 1.

## Phase 2 after Phase 1 verification

- Admin WhatsApp Inbox inside Acapolite.
- Admin pause/resume controls.
- Secure pre-filled handoff token to `/request-tax-assistance`.
- Lead attribution reporting.
- Admin-approved conversion from a WhatsApp conversation into `service_requests`.
- Media/document intake with explicit validation and retention controls.

## Required Supabase secrets

- `OPENAI_API_KEY`
- `OPENAI_WHATSAPP_MODEL`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_GRAPH_API_VERSION`
- `WHATSAPP_APP_SECRET`

## OpenAI data handling

For WhatsApp intake, API requests should use `store: false`. Conversation history required for continuity remains in Acapolite's own database and only the minimum necessary recent context is sent to the model.

## Cutover checklist

- [ ] Test number receives inbound message.
- [ ] Webhook verification succeeds.
- [ ] Signature verification succeeds.
- [ ] Duplicate webhook delivery does not duplicate a stored message or AI response.
- [ ] OpenAI response is concise and appropriate.
- [ ] Human-handoff phrase pauses automation.
- [ ] Admin-only access verified with admin and consultant test accounts.
- [ ] Outbound Meta message succeeds and returned message ID is stored.
- [ ] Failure paths do not leak secrets or customer data.
- [ ] Existing service-request flow remains unchanged.
- [ ] Existing practitioner workflows remain unchanged.
- [ ] Meta ad still opens the intended WhatsApp number.
- [ ] Only after all checks pass: switch the production Meta webhook from ElevenLabs to Acapolite.
- [ ] Observe production logs before cancelling ElevenLabs.

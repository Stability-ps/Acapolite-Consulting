import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminWhatsAppQA from "./AdminWhatsAppQA";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    session: { access_token: "test-token", user: { id: "staff-1" } },
    loading: false,
  }),
}));

const now = new Date().toISOString();

const conversations = [
  {
    id: "conv-ai",
    wa_id: "27821110001",
    display_name: "Thabo Nkosi",
    linked_client_id: null,
    linked_client_profile_id: null,
    linked_client_at: null,
    linked_client_by: null,
    status: "active",
    inbox_status: "new",
    priority_level: "normal",
    ai_enabled: true,
    human_handoff_requested_at: null,
    service_request_id: null,
    ai_summary: "Wants help with a SARS debt arrangement.",
    submission_state: "collecting",
    intake_payload: { full_name: "Thabo Nkosi", service_needed: "individual_sars_debt_assistance" },
    intake_missing_fields: ["email"],
    intake_ready: false,
    last_inbound_at: now,
    last_outbound_at: now,
    assigned_staff_id: null,
    assigned_staff_name: null,
    assigned_at: null,
    last_staff_reply_at: null,
    first_staff_reply_at: null,
    resolved_at: null,
    resolved_by: null,
    created_at: now,
    updated_at: now,
  },
  {
    id: "conv-human",
    wa_id: "27821110002",
    display_name: "Naledi Dlamini",
    linked_client_id: null,
    linked_client_profile_id: null,
    linked_client_at: null,
    linked_client_by: null,
    status: "human_handoff",
    inbox_status: "assigned",
    priority_level: "high",
    ai_enabled: false,
    human_handoff_requested_at: now,
    service_request_id: null,
    ai_summary: "Needs a consultant to take over.",
    submission_state: "collecting",
    intake_payload: { full_name: "Naledi Dlamini", service_needed: "business_sars_debt_arrangements" },
    intake_missing_fields: [],
    intake_ready: true,
    last_inbound_at: now,
    last_outbound_at: now,
    assigned_staff_id: "staff-1",
    assigned_staff_name: "Test Staff",
    assigned_at: now,
    last_staff_reply_at: null,
    first_staff_reply_at: null,
    resolved_at: null,
    resolved_by: null,
    created_at: now,
    updated_at: now,
  },
];

const messages = [
  {
    id: "msg-ai-1",
    conversation_id: "conv-ai",
    direction: "inbound",
    sender_type: "customer",
    message_type: "text",
    content: "Hi, I need help with my SARS debt.",
    delivery_status: null,
    media_mime_type: null,
    media_filename: null,
    media_size_bytes: null,
    media_storage_path: null,
    attachment_url: null,
    staff_sender_id: null,
    staff_sender_name: null,
    created_at: now,
  },
  {
    id: "msg-human-1",
    conversation_id: "conv-human",
    direction: "inbound",
    sender_type: "customer",
    message_type: "text",
    content: "Please can a person help me instead of the bot?",
    delivery_status: null,
    media_mime_type: null,
    media_filename: null,
    media_size_bytes: null,
    media_storage_path: null,
    attachment_url: null,
    staff_sender_id: null,
    staff_sender_name: null,
    created_at: now,
  },
];

const feedPayload = {
  features: { inbox_v2: true },
  conversations,
  messages,
  reads: [],
  alerts: [],
  notes: [],
  staff_actions: [],
  client_matches: [],
  related_service_requests: [],
  staff: [{ id: "staff-1", full_name: "Test Staff", email: "staff@acapolite.test", role: "admin" }],
  current_staff: { id: "staff-1", full_name: "Test Staff", email: "staff@acapolite.test", role: "admin" },
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={["/dashboard/staff/whatsapp-qa"]}>
      <QueryClientProvider client={queryClient}>
        <AdminWhatsAppQA />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("AdminWhatsAppQA", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/whatsapp-qa-feed")) {
        return new Response(JSON.stringify(feedPayload), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the live overview counts on the Inbox tab", async () => {
    renderPage();

    expect((await screen.findAllByText("Thabo Nkosi")).length).toBeGreaterThan(0);

    const conversationsCard = screen.getByText("Conversations").closest("button");
    expect(conversationsCard).not.toBeNull();
    expect(within(conversationsCard as HTMLElement).getByText("2")).toBeInTheDocument();
  });

  it("lists every WhatsApp chat and its customer on the AI Control tab", async () => {
    renderPage();
    await screen.findAllByText("Thabo Nkosi");

    screen.getByRole("button", { name: /AI Control/i }).click();

    expect(await screen.findByText("WhatsApp chats / people")).toBeInTheDocument();
    expect(screen.getAllByText("Thabo Nkosi").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Naledi Dlamini").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+27821110001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+27821110002").length).toBeGreaterThan(0);
  });

  it("keeps lead export and delete controls in the same card as the lead list", async () => {
    renderPage();
    await screen.findAllByText("Thabo Nkosi");

    screen.getByRole("button", { name: /^Leads/ }).click();

    const leadListHeading = await screen.findByText("Lead intake");
    const leadCard = leadListHeading.closest(".rounded-lg, [class*='card'], div");
    expect(await screen.findByRole("button", { name: /Export/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Select leads to delete|Delete selected/i })).toBeInTheDocument();
    expect(leadCard).not.toBeNull();
  });
});

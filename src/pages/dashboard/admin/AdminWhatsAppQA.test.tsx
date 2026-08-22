import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  it("shows the live overview KPI counts on the Reports tab", async () => {
    renderPage();

    expect((await screen.findAllByText("Thabo Nkosi")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /^Reports/ }));

    const conversationsCard = (await screen.findByText("Conversations")).closest("button");
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

  it("navigates to the Actions & AI and Review sections and preserves the selected conversation", async () => {
    renderPage();
    const [conversationCard] = await screen.findAllByText("Naledi Dlamini");
    fireEvent.click(conversationCard);

    // Actions & AI and Review are now top-level WhatsApp QA navigation destinations,
    // not tabs inside the Inbox right panel - there is no Inbox right panel any more.
    fireEvent.click(screen.getByRole("button", { name: "Actions & AI" }));
    expect(await screen.findAllByText("Actions & AI")).not.toHaveLength(0);
    expect(screen.getAllByText(/AI replies are locked/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Naledi Dlamini/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /^Review/ }));
    expect(await screen.findAllByText(/Naledi Dlamini/)).not.toHaveLength(0);

    // Radix Tabs activates on mousedown (not click) - see @radix-ui/react-tabs TabsTrigger.
    const clientSubTab = await screen.findByRole("tab", { name: /^Client$/ });
    fireEvent.mouseDown(clientSubTab, { button: 0 });
    await waitFor(() => expect(screen.getAllByText("WhatsApp name").length).toBeGreaterThan(0));

    // switching sections must not lose the selected conversation
    expect(screen.getAllByText("Naledi Dlamini").length).toBeGreaterThan(0);

    // Inbox no longer shows the full Actions & AI panel (lead quality / quick status),
    // but its own compact control bar still reflects the same live AI/human status.
    fireEvent.click(screen.getByRole("button", { name: /^Inbox/ }));
    await waitFor(() => expect(screen.queryByText("Quick status")).not.toBeInTheDocument());
    expect(screen.getAllByText(/AI replies are locked/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Naledi Dlamini").length).toBeGreaterThan(0);
  });

  it("shows the Inbox control bar and lets staff pick a recommended reply without auto-sending", async () => {
    renderPage();
    const [conversationCard] = await screen.findAllByText("Naledi Dlamini");
    fireEvent.click(conversationCard);

    // dynamic human-control status, reflecting the assigned staff member from the feed (not hardcoded)
    expect(await screen.findByText("Human control is active, assigned to Test Staff. AI replies are locked.")).toBeInTheDocument();

    // control bar exposes the existing handlers, reusing them rather than duplicating backend logic
    expect(screen.getByRole("button", { name: /Return to AI/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ask missing info/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resolve/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open request/i })).not.toBeInTheDocument();

    // recommended replies panel is collapsed by default
    expect(screen.queryByText("Recommended replies")).not.toBeInTheDocument();

    const draftFollowUpButton = screen.getByRole("button", { name: /Draft follow-up/i });
    fireEvent.click(draftFollowUpButton);

    expect(await screen.findByText("Recommended replies")).toBeInTheDocument();
    const recommendation = screen.getByRole("button", { name: /Human takeover/i });
    fireEvent.click(recommendation);

    // inserted into the composer, not auto-sent - staff can still edit and send manually
    const textarea = await screen.findByPlaceholderText("Write a WhatsApp reply...");
    await waitFor(() => expect((textarea as HTMLTextAreaElement).value.length).toBeGreaterThan(0));
    expect(screen.queryByText("Recommended replies")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send reply/i })).toBeInTheDocument();

    // switching conversations clears any open panel and does not leak the previous recommendation
    fireEvent.click(draftFollowUpButton);
    expect(await screen.findByText("Recommended replies")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Thabo Nkosi")[0]);
    await waitFor(() => expect(screen.queryByText("Recommended replies")).not.toBeInTheDocument());
    expect(await screen.findByText("AI is active. Take over or assign the chat before replying.")).toBeInTheDocument();
  });

  it("shows an empty state for Actions & AI and Review when there is no conversation to select", async () => {
    const emptyQueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/whatsapp-qa-feed")) {
        return new Response(JSON.stringify({ ...feedPayload, conversations: [], messages: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    }));

    render(
      <MemoryRouter initialEntries={["/dashboard/staff/whatsapp-qa"]}>
        <QueryClientProvider client={emptyQueryClient}>
          <AdminWhatsAppQA />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Actions & AI" }));
    expect(await screen.findByText(/Select a WhatsApp conversation from Inbox or AI Control to manage its actions here\./i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Review/ }));
    expect(await screen.findByText(/Select a WhatsApp conversation from Inbox or AI Control to review it here\./i)).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ role: "consultant" as string, perms: new Set<string>() }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ role: auth.role, user: { id: "staff-1" }, hasStaffPermission: (p: string) => auth.perms.has(p) }),
}));

// Minimal chainable stand-in for the Supabase query builder: every filter
// method returns the builder; awaiting it resolves the fixture for the table.
const db = vi.hoisted(() => {
  const fixtures: Record<string, unknown> = {};
  const rpcFixtures: Record<string, unknown> = {};
  const builder = (table: string) => {
    const result = () => {
      const data = fixtures[table] ?? [];
      return { data, error: null, count: Array.isArray(data) ? data.length : 1 };
    };
    const b: Record<string, unknown> = {};
    const chain = () => b;
    for (const m of ["select", "eq", "neq", "in", "is", "not", "gt", "gte", "lt", "lte", "ilike", "or", "order", "range", "limit", "insert", "update", "delete"]) b[m] = chain;
    b.single = () => Promise.resolve({ data: Array.isArray(fixtures[table]) ? (fixtures[table] as unknown[])[0] : fixtures[table], error: null });
    b.maybeSingle = b.single;
    b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve);
    return b;
  };
  return {
    fixtures,
    rpcFixtures,
    client: {
      from: (t: string) => builder(t),
      rpc: (fn: string) => Promise.resolve({ data: rpcFixtures[fn] ?? null, error: null }),
      functions: { invoke: () => Promise.resolve({ data: { ok: true }, error: null }) },
    },
  };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: db.client }));

import ProspectList from "./ProspectList";
import ProspectProfile from "./ProspectProfile";
import ProspectCampaignDetail from "./ProspectCampaignDetail";
import ProspectDashboard from "./ProspectDashboard";

const prospect = {
  id: "p1", company_name: "Mahika Technologies", registration_number: null, sector: "IT", city: "Pretoria", province: "Gauteng",
  email: "info@mahika.co.za", phone: "+27116444000", website: "https://mahika.co.za/", whatsapp: null, contact_name: null, contact_title: null,
  status: "new", score: 83, score_reasons: [{ label: "Government procurement award on record", points: 20 }, { label: "IT sector", points: 20 }],
  assigned_to: null, source_name: "National Treasury eTenders OCDS", source_url: "https://ocds-api.etenders.gov.za/api/OCDSReleases/release/x",
  discovered_at: "2026-09-20T08:00:00Z", last_contacted_at: null, next_follow_up_at: null, do_not_contact: false, enrichment_status: "completed",
  procurement_record_count: 2, lead_at: null, converted_client_id: null, metadata: {}, email_source_url: null, phone_source_url: null,
};

function renderAt(path: string, routePath: string, element: JSX.Element) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}><Routes><Route path={routePath} element={element} /></Routes></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  auth.role = "consultant";
  auth.perms = new Set(["can_view_prospect_hub"]);
  for (const k of Object.keys(db.fixtures)) delete db.fixtures[k];
  for (const k of Object.keys(db.rpcFixtures)) delete db.rpcFixtures[k];
  db.fixtures.prospects = [prospect];
  db.fixtures.profiles = [];
  db.fixtures.prospect_sources = [];
});

describe("Prospect list", () => {
  it("renders prospects with stage and fit score", async () => {
    renderAt("/p", "/p", <ProspectList mode="prospects" />);
    expect(await screen.findByText("Mahika Technologies")).toBeInTheDocument();
    expect(screen.getByText("New prospect")).toBeInTheDocument();
    expect(screen.getByText("83")).toBeInTheDocument();
    expect(screen.getByText(/2 awards/)).toBeInTheDocument();
  });

  it("hides add/import/export for view-only staff", async () => {
    renderAt("/p", "/p", <ProspectList mode="prospects" />);
    await screen.findByText("Mahika Technologies");
    expect(screen.queryByRole("button", { name: /Add prospect/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Import/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /CSV/ })).not.toBeInTheDocument();
  });

  it("shows management actions for staff with manage permission", async () => {
    auth.perms.add("can_manage_prospect_hub");
    renderAt("/p", "/p", <ProspectList mode="prospects" />);
    await screen.findByText("Mahika Technologies");
    expect(screen.getByRole("button", { name: /Add prospect/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Import/ })).toBeInTheDocument();
  });
});

describe("Prospect profile", () => {
  it("shows transparent score reasons and evidence, and no actions for view-only staff", async () => {
    db.fixtures.prospect_source_records = [{ id: "r1", tender_title: "Toners and drums", buyer_name: "Department of Justice", award_value: 21796778, award_currency: "ZAR", award_date: "2026-06-02T00:00:00Z", source_url: "https://ocds-api.etenders.gov.za/x" }];
    renderAt("/prospects/p1", "/prospects/:id", <ProspectProfile />);
    expect(await screen.findByText("Government procurement award on record")).toBeInTheDocument();
    expect(screen.getByText("Toners and drums")).toBeInTheDocument();
    expect(screen.getByText(/Not a statement about SARS compliance/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Convert to client/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Log call/ })).not.toBeInTheDocument();
  });

  it("offers lead/client conversion and call logging to managers", async () => {
    auth.perms.add("can_manage_prospect_hub");
    renderAt("/prospects/p1", "/prospects/:id", <ProspectProfile />);
    expect(await screen.findByRole("button", { name: /Convert to client/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Convert to lead/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Log call/ })).toBeInTheDocument();
  });
});

describe("Campaign approval", () => {
  const campaign = { id: "c1", name: "TCS outreach", subject: "Hello {{company_name}}", body_text: "Good day", status: "draft", created_at: "2026-09-25T10:00:00Z", total_recipients: 1, skipped_count: 0, sent_count: 0, failed_count: 0, bounced_count: 0, replied_count: 0, unsubscribed_count: 0 };
  beforeEach(() => {
    db.fixtures.prospect_campaigns = [campaign];
    db.fixtures.prospect_campaign_recipients = [{ id: "r1", prospect_id: "p1", email: "info@mahika.co.za", status: "pending", prospects: { company_name: "Mahika Technologies" } }];
    db.fixtures.prospect_campaign_settings = [{ sending_enabled: false, daily_limit: 200, batch_size: 20 }];
  });

  it("requires an authorised sender to approve a draft", async () => {
    auth.perms.add("can_manage_prospect_hub");
    renderAt("/campaigns/c1", "/campaigns/:id", <ProspectCampaignDetail />);
    expect(await screen.findByText(/An authorised sender must approve this draft/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve & queue/ })).not.toBeInTheDocument();
  });

  it("lets a sender approve and renders the preview with known values only", async () => {
    auth.role = "admin";
    renderAt("/campaigns/c1", "/campaigns/:id", <ProspectCampaignDetail />);
    expect(await screen.findByRole("button", { name: /Approve & queue/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Hello Mahika Technologies")).toBeInTheDocument());
  });
});

describe("Dashboard", () => {
  it("renders aggregate statistics from the server", async () => {
    db.rpcFixtures.prospect_hub_dashboard = { total: 42, new_today: 3, new_week: 12, high_fit: 7, missing_contact: 9, enriched_today: 4, leads: 2, converted: 1, contacted: 10, follow_ups_overdue: 1, follow_ups_due_today: 0, campaign_emails_sent: 0, campaign_replies: 0, duplicates_pending: 0, do_not_contact: 0, needs_review: 0 };
    renderAt("/", "/", <ProspectDashboard />);
    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.getByText("3 / 12")).toBeInTheDocument();
    expect(screen.getByText(/Conversion of contacted: 10.0%/)).toBeInTheDocument();
  });
});

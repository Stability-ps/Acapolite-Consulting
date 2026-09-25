import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  FileInput,
  Receipt,
  UserRoundCheck,
  Users,
  WalletCards,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

type AnalyticsRange = "today" | "7d" | "30d" | "month" | "90d";

type ClientRow = {
  id: string;
  created_at: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type PractitionerRow = {
  profile_id: string;
  created_at: string;
  verification_status: string;
  is_verified: boolean;
  business_name: string | null;
  profiles?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

type ServiceRequestRow = {
  id: string;
  created_at: string;
  service_category: string;
  status: string;
  converted_case_id: string | null;
  full_name: string;
  company_name: string | null;
};

type CaseRow = {
  id: string;
  created_at: string;
  closed_at: string | null;
  status: string;
};

type InvoiceRow = {
  id: string;
  created_at: string;
  paid_at: string | null;
  issue_date: string;
  status: string;
  amount_paid: number;
  balance_due: number | null;
};

const RANGE_OPTIONS: Array<{ value: AnalyticsRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "month", label: "This Month" },
  { value: "90d", label: "90 Days" },
];

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getRangeBounds(range: AnalyticsRange) {
  const now = new Date();
  let start: Date;

  if (range === "today") {
    start = startOfDay(now);
  } else if (range === "7d") {
    start = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
  } else if (range === "30d") {
    start = startOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000));
  } else if (range === "90d") {
    start = startOfDay(new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000));
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const end = new Date(now);
  const duration = Math.max(1, end.getTime() - start.getTime());
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration);

  return { start, end, previousStart, previousEnd };
}

function inRange(value: string | null | undefined, start: Date, end: Date) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= start.getTime() && time <= end.getTime();
}

function trendPercent(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatServiceCategory(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function clientName(client: ClientRow) {
  return (
    client.company_name ||
    [client.first_name, client.last_name].filter(Boolean).join(" ") ||
    client.email ||
    "Client"
  );
}

function practitionerName(practitioner: PractitionerRow) {
  return (
    practitioner.profiles?.full_name ||
    practitioner.business_name ||
    practitioner.profiles?.email ||
    "Practitioner"
  );
}

export function AdminBusinessAnalytics() {
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const { start, end, previousStart, previousEnd } = useMemo(() => getRangeBounds(range), [range]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-business-analytics"],
    queryFn: async () => {
      const [clientsResult, practitionersResult, requestsResult, casesResult, invoicesResult] =
        await Promise.all([
          supabase
            .from("clients")
            .select("id, created_at, company_name, first_name, last_name, email")
            .eq("is_archived", false),
          supabase
            .from("practitioner_profiles")
            .select(
              "profile_id, created_at, verification_status, is_verified, business_name, profiles!practitioner_profiles_profile_id_fkey(full_name, email)",
            ),
          supabase
            .from("service_requests")
            .select("id, created_at, service_category, status, converted_case_id, full_name, company_name")
            .eq("is_archived", false),
          supabase.from("cases").select("id, created_at, closed_at, status"),
          supabase
            .from("invoices")
            .select("id, created_at, paid_at, issue_date, status, amount_paid, balance_due"),
        ]);

      const firstError =
        clientsResult.error ||
        practitionersResult.error ||
        requestsResult.error ||
        casesResult.error ||
        invoicesResult.error;

      if (firstError) throw firstError;

      return {
        clients: (clientsResult.data ?? []) as ClientRow[],
        practitioners: (practitionersResult.data ?? []) as PractitionerRow[],
        requests: (requestsResult.data ?? []) as ServiceRequestRow[],
        cases: (casesResult.data ?? []) as CaseRow[],
        invoices: (invoicesResult.data ?? []) as InvoiceRow[],
      };
    },
    staleTime: 60_000,
  });

  const analytics = useMemo(() => {
    const clients = data?.clients ?? [];
    const practitioners = data?.practitioners ?? [];
    const requests = data?.requests ?? [];
    const cases = data?.cases ?? [];
    const invoices = data?.invoices ?? [];

    const currentClients = clients.filter((row) => inRange(row.created_at, start, end));
    const previousClients = clients.filter((row) => inRange(row.created_at, previousStart, previousEnd));
    const currentPractitioners = practitioners.filter((row) => inRange(row.created_at, start, end));
    const previousPractitioners = practitioners.filter((row) => inRange(row.created_at, previousStart, previousEnd));
    const currentRequests = requests.filter((row) => inRange(row.created_at, start, end));
    const previousRequests = requests.filter((row) => inRange(row.created_at, previousStart, previousEnd));
    const currentCases = cases.filter((row) => inRange(row.created_at, start, end));
    const previousCases = cases.filter((row) => inRange(row.created_at, previousStart, previousEnd));
    const currentInvoices = invoices.filter((row) => inRange(row.created_at, start, end));
    const previousInvoices = invoices.filter((row) => inRange(row.created_at, previousStart, previousEnd));

    const currentPaid = invoices.filter((row) => inRange(row.paid_at, start, end));
    const previousPaid = invoices.filter((row) => inRange(row.paid_at, previousStart, previousEnd));
    const currentRevenue = currentPaid.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0);
    const previousRevenue = previousPaid.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0);

    const convertedRequests = currentRequests.filter((row) => Boolean(row.converted_case_id)).length;
    const conversionRate = currentRequests.length
      ? Math.round((convertedRequests / currentRequests.length) * 100)
      : 0;

    const outstandingNow = invoices
      .filter((row) => ["issued", "partially_paid", "overdue"].includes(row.status))
      .reduce((sum, row) => sum + Number(row.balance_due || 0), 0);

    const metrics = [
      {
        label: "New Clients",
        value: currentClients.length,
        previous: previousClients.length,
        icon: Users,
        display: String(currentClients.length),
      },
      {
        label: "New Practitioners",
        value: currentPractitioners.length,
        previous: previousPractitioners.length,
        icon: UserRoundCheck,
        display: String(currentPractitioners.length),
      },
      {
        label: "Service Requests",
        value: currentRequests.length,
        previous: previousRequests.length,
        icon: FileInput,
        display: String(currentRequests.length),
      },
      {
        label: "Cases Opened",
        value: currentCases.length,
        previous: previousCases.length,
        icon: BriefcaseBusiness,
        display: String(currentCases.length),
      },
      {
        label: "Invoices Issued",
        value: currentInvoices.length,
        previous: previousInvoices.length,
        icon: Receipt,
        display: String(currentInvoices.length),
      },
      {
        label: "Payments Received",
        value: currentRevenue,
        previous: previousRevenue,
        icon: WalletCards,
        display: formatCurrency(currentRevenue),
      },
      {
        label: "Request Conversion",
        value: conversionRate,
        previous: 0,
        icon: Activity,
        display: `${conversionRate}%`,
        hideTrend: true,
      },
      {
        label: "Outstanding Now",
        value: outstandingNow,
        previous: 0,
        icon: CalendarDays,
        display: formatCurrency(outstandingNow),
        hideTrend: true,
      },
    ];

    const dayMap = new Map<string, { date: string; clients: number; practitioners: number; requests: number }>();
    const cursor = startOfDay(start);
    const finalDay = startOfDay(end);
    while (cursor <= finalDay) {
      const key = cursor.toISOString().slice(0, 10);
      dayMap.set(key, {
        date: cursor.toLocaleDateString("en-ZA", { day: "numeric", month: "short" }),
        clients: 0,
        practitioners: 0,
        requests: 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    const addToDay = (createdAt: string, key: "clients" | "practitioners" | "requests") => {
      if (!inRange(createdAt, start, end)) return;
      const dayKey = new Date(createdAt).toISOString().slice(0, 10);
      const bucket = dayMap.get(dayKey);
      if (bucket) bucket[key] += 1;
    };

    clients.forEach((row) => addToDay(row.created_at, "clients"));
    practitioners.forEach((row) => addToDay(row.created_at, "practitioners"));
    requests.forEach((row) => addToDay(row.created_at, "requests"));

    const serviceCounts = currentRequests.reduce<Record<string, number>>((acc, row) => {
      const key = row.service_category || "other";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const serviceBreakdown = Object.entries(serviceCounts)
      .map(([category, count]) => ({ category: formatServiceCategory(category), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      metrics,
      trendData: Array.from(dayMap.values()),
      serviceBreakdown,
      recentClients: [...currentClients].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5),
      recentPractitioners: [...currentPractitioners].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5),
      recentRequests: [...currentRequests].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5),
      totalPractitioners: practitioners.length,
      verifiedPractitioners: practitioners.filter((row) => row.is_verified).length,
      totalClients: clients.length,
      totalRequests: requests.length,
    };
  }, [data, end, previousEnd, previousStart, start]);

  if (error) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <p className="font-semibold text-red-700">Business analytics could not be loaded.</p>
        <p className="mt-2 text-sm text-red-600">The existing dashboard remains available while this data query is unavailable.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6 rounded-[28px] border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Admin Analytics</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-foreground">Growth & Operations Dashboard</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Track practitioner sign-ups, clients, service requests, cases and billing from the records Acapolite already creates.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={range === option.value ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setRange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {analytics.metrics.map((metric) => {
          const delta = trendPercent(metric.value, metric.previous);
          return (
            <div key={metric.label} className="rounded-2xl border border-border bg-accent/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <metric.icon className="h-5 w-5 text-primary" />
                {!metric.hideTrend ? (
                  <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                    delta >= 0
                      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                      : "border-rose-100 bg-rose-50 text-rose-700"
                  }`}>
                    {delta >= 0 ? "+" : ""}{delta}%
                  </span>
                ) : null}
              </div>
              <p className="mt-4 text-xs uppercase tracking-[0.14em] text-muted-foreground">{metric.label}</p>
              <p className="mt-2 font-display text-3xl font-semibold text-foreground">{isLoading ? "—" : metric.display}</p>
              {!metric.hideTrend ? (
                <p className="mt-2 text-xs text-muted-foreground">vs previous equivalent period</p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">current operational position</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
        <div className="rounded-2xl border border-border p-5">
          <div className="mb-4">
            <h3 className="font-display text-lg font-semibold text-foreground">Sign-ups & Requests Trend</h3>
            <p className="mt-1 text-sm text-muted-foreground">Daily activity inside the selected period.</p>
          </div>
          <ChartContainer
            config={{
              clients: { label: "Clients", color: "hsl(var(--chart-1))" },
              practitioners: { label: "Practitioners", color: "hsl(var(--chart-2))" },
              requests: { label: "Requests", color: "hsl(var(--chart-3))" },
            }}
            className="h-[280px] w-full"
          >
            <LineChart data={analytics.trendData} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="clients" stroke="var(--color-clients)" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="practitioners" stroke="var(--color-practitioners)" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="requests" stroke="var(--color-requests)" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ChartContainer>
        </div>

        <div className="rounded-2xl border border-border p-5">
          <div className="mb-4">
            <h3 className="font-display text-lg font-semibold text-foreground">Requests by Service</h3>
            <p className="mt-1 text-sm text-muted-foreground">Top requested service categories.</p>
          </div>
          {analytics.serviceBreakdown.length ? (
            <ChartContainer
              config={{ count: { label: "Requests", color: "hsl(var(--chart-1))" } }}
              className="h-[280px] w-full"
            >
              <BarChart data={analytics.serviceBreakdown} layout="vertical" margin={{ left: 10, right: 12 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="category" width={115} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={6} />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              No requests in this period.
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">All Clients</p>
          <p className="mt-2 font-display text-2xl text-foreground">{analytics.totalClients}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">All Practitioners</p>
          <p className="mt-2 font-display text-2xl text-foreground">{analytics.totalPractitioners}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Verified Practitioners</p>
          <p className="mt-2 font-display text-2xl text-foreground">{analytics.verifiedPractitioners}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">All Requests</p>
          <p className="mt-2 font-display text-2xl text-foreground">{analytics.totalRequests}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ActivityList
          title="Newest Clients"
          emptyLabel="No new clients in this period."
          rows={analytics.recentClients.map((row) => ({
            id: row.id,
            primary: clientName(row),
            secondary: row.email || "No email",
            date: row.created_at,
          }))}
        />
        <ActivityList
          title="Newest Practitioners"
          emptyLabel="No practitioner sign-ups in this period."
          rows={analytics.recentPractitioners.map((row) => ({
            id: row.profile_id,
            primary: practitionerName(row),
            secondary: row.is_verified ? "Verified" : formatServiceCategory(row.verification_status || "pending"),
            date: row.created_at,
          }))}
        />
        <ActivityList
          title="Newest Requests"
          emptyLabel="No service requests in this period."
          rows={analytics.recentRequests.map((row) => ({
            id: row.id,
            primary: row.company_name || row.full_name,
            secondary: formatServiceCategory(row.service_category),
            date: row.created_at,
          }))}
        />
      </div>
    </section>
  );
}

function ActivityList({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: Array<{ id: string; primary: string; secondary: string; date: string }>;
  emptyLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-border p-5">
      <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
      <div className="mt-4 space-y-3">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-border bg-background/60 p-3">
              <p className="truncate text-sm font-semibold text-foreground">{row.primary}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{row.secondary}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {new Date(row.date).toLocaleString("en-ZA")}
              </p>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}

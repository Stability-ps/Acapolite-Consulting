import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";

type StaffClient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  tax_number: string | null;
  sars_reference_number: string | null;
  id_number: string | null;
  client_code: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  notes: string | null;
  created_at: string;
  profiles?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  assigned_consultant?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
  created_by_profile?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

function getClientName(client: StaffClient) {
  return (
    client.company_name ||
    client.profiles?.full_name ||
    [client.first_name, client.last_name].filter(Boolean).join(" ") ||
    client.client_code ||
    "Client"
  );
}

function getAddress(client: StaffClient) {
  return [
    client.address_line_1,
    client.address_line_2,
    client.city,
    client.province,
    client.postal_code,
    client.country,
  ].filter(Boolean).join(", ");
}

export default function AdminClients() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["staff-clients"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select(`
          *,
          profiles!clients_profile_id_fkey(full_name, email, phone),
          assigned_consultant:profiles!clients_assigned_consultant_id_fkey(full_name, email),
          created_by_profile:profiles!clients_created_by_fkey(full_name, email)
        `)
        .order("created_at", { ascending: false });
      return (data ?? []) as StaffClient[];
    },
  });

  const filteredClients = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    if (!normalizedSearch) {
      return clients ?? [];
    }

    return (clients ?? []).filter((client) => {
      const name = getClientName(client).toLowerCase();
      const email = (client.profiles?.email || "").toLowerCase();
      const phone = (client.profiles?.phone || "").toLowerCase();
      const taxNumber = (client.tax_number || "").toLowerCase();
      const clientCode = (client.client_code || "").toLowerCase();

      return (
        name.includes(normalizedSearch) ||
        email.includes(normalizedSearch) ||
        phone.includes(normalizedSearch) ||
        taxNumber.includes(normalizedSearch) ||
        clientCode.includes(normalizedSearch)
      );
    });
  }, [clients, searchQuery]);

  const selectedClient = filteredClients.find((client) => client.id === selectedClientId)
    || clients?.find((client) => client.id === selectedClientId)
    || null;

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 font-display text-2xl font-bold text-foreground">All Clients</h1>
          <p className="text-sm text-muted-foreground font-body">Manage client profiles and open the full record from this list.</p>
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search client, email, code, or tax number..."
            className="rounded-xl pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground font-body">Loading...</div>
      ) : filteredClients.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="p-4 text-left text-sm font-semibold text-foreground font-body">Name</th>
                <th className="p-4 text-left text-sm font-semibold text-foreground font-body">Email</th>
                <th className="p-4 text-left text-sm font-semibold text-foreground font-body">Phone</th>
                <th className="p-4 text-left text-sm font-semibold text-foreground font-body">Tax Number</th>
                <th className="p-4 text-left text-sm font-semibold text-foreground font-body">Client Code</th>
                <th className="p-4 text-left text-sm font-semibold text-foreground font-body">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr
                  key={client.id}
                  className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-accent/30"
                  onClick={() => setSelectedClientId(client.id)}
                >
                  <td className="p-4 text-sm font-medium text-foreground font-body">{getClientName(client)}</td>
                  <td className="p-4 text-sm text-muted-foreground font-body">{client.profiles?.email || "-"}</td>
                  <td className="p-4 text-sm text-muted-foreground font-body">{client.profiles?.phone || "-"}</td>
                  <td className="p-4 text-sm text-muted-foreground font-body">{client.tax_number || "-"}</td>
                  <td className="p-4 text-sm text-muted-foreground font-body">{client.client_code || "-"}</td>
                  <td className="p-4 text-sm text-muted-foreground font-body">{new Date(client.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground font-body">
            {searchQuery.trim() ? "No clients matched your search." : "No clients found."}
          </p>
        </div>
      )}

      <DashboardItemDialog
        open={!!selectedClient}
        onOpenChange={(open) => {
          if (!open) setSelectedClientId(null);
        }}
        title={selectedClient ? getClientName(selectedClient) : "Client Details"}
        description="Review this client's profile, tax details, assignment, and address information."
      >
        {selectedClient ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Full Name</p>
                <p className="font-body text-foreground">{selectedClient.profiles?.full_name || [selectedClient.first_name, selectedClient.last_name].filter(Boolean).join(" ") || "Not provided"}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Company</p>
                <p className="font-body text-foreground">{selectedClient.company_name || "Individual client"}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Email</p>
                <p className="break-all font-body text-foreground">{selectedClient.profiles?.email || "Not provided"}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Phone</p>
                <p className="font-body text-foreground">{selectedClient.profiles?.phone || "Not provided"}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-border p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Tax Number</p>
                <p className="font-body text-foreground">{selectedClient.tax_number || "Not provided"}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">SARS Reference</p>
                <p className="font-body text-foreground">{selectedClient.sars_reference_number || "Not provided"}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">ID Number</p>
                <p className="font-body text-foreground">{selectedClient.id_number || "Not provided"}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Client Code</p>
                <p className="font-body text-foreground">{selectedClient.client_code || "Not assigned"}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Assigned Consultant</p>
                <p className="font-body text-foreground">{selectedClient.assigned_consultant?.full_name || selectedClient.assigned_consultant?.email || "Not assigned"}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Joined</p>
                <p className="font-body text-foreground">{new Date(selectedClient.created_at).toLocaleString()}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border p-4">
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Address</p>
              <p className="font-body text-foreground">{getAddress(selectedClient) || "No address details added yet."}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Created By</p>
                <p className="font-body text-foreground">{selectedClient.created_by_profile?.full_name || selectedClient.created_by_profile?.email || "Not recorded"}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Notes</p>
                <p className="whitespace-pre-wrap font-body text-foreground">{selectedClient.notes || "No internal notes yet."}</p>
              </div>
            </div>
          </div>
        ) : null}
      </DashboardItemDialog>
    </div>
  );
}

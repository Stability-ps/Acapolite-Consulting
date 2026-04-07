import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

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

type NewClientFormState = {
  email: string;
  fullName: string;
  phone: string;
  companyName: string;
  firstName: string;
  lastName: string;
  taxNumber: string;
  sarsReferenceNumber: string;
  idNumber: string;
  clientCode: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  notes: string;
};

const initialFormState: NewClientFormState = {
  email: "",
  fullName: "",
  phone: "",
  companyName: "",
  firstName: "",
  lastName: "",
  taxNumber: "",
  sarsReferenceNumber: "",
  idNumber: "",
  clientCode: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  province: "",
  postalCode: "",
  country: "South Africa",
  notes: "",
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

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return { firstName: "", lastName: "" };
  }

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export default function AdminClients() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formState, setFormState] = useState<NewClientFormState>(initialFormState);

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

  const updateForm = (key: keyof NewClientFormState, value: string) => {
    setFormState((current) => ({ ...current, [key]: value }));
  };

  const resetCreateForm = () => {
    setFormState(initialFormState);
    setIsCreating(false);
  };

  const createClient = async () => {
    const email = formState.email.trim().toLowerCase();

    if (!email) {
      toast.error("Enter the existing portal account email first.");
      return;
    }

    setIsCreating(true);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .eq("email", email)
      .maybeSingle();

    if (profileError) {
      toast.error(profileError.message);
      setIsCreating(false);
      return;
    }

    if (!profile) {
      toast.error("No portal profile was found for this email. Create the auth account first, then add the client here.");
      setIsCreating(false);
      return;
    }

    const { data: existingClient, error: existingClientError } = await supabase
      .from("clients")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (existingClientError) {
      toast.error(existingClientError.message);
      setIsCreating(false);
      return;
    }

    if (existingClient) {
      toast.error("This portal account already has a client record.");
      setIsCreating(false);
      return;
    }

    const resolvedFullName = formState.fullName.trim() || profile.full_name || "";
    const nameParts = splitFullName(resolvedFullName);
    const firstName = formState.firstName.trim() || nameParts.firstName;
    const lastName = formState.lastName.trim() || nameParts.lastName;

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({
        full_name: resolvedFullName || null,
        phone: formState.phone.trim() || profile.phone || null,
      })
      .eq("id", profile.id);

    if (profileUpdateError) {
      toast.error(profileUpdateError.message);
      setIsCreating(false);
      return;
    }

    const { error: insertError } = await supabase.from("clients").insert({
      profile_id: profile.id,
      first_name: firstName || null,
      last_name: lastName || null,
      company_name: formState.companyName.trim() || null,
      tax_number: formState.taxNumber.trim() || null,
      sars_reference_number: formState.sarsReferenceNumber.trim() || null,
      id_number: formState.idNumber.trim() || null,
      client_code: formState.clientCode.trim() || null,
      address_line_1: formState.addressLine1.trim() || null,
      address_line_2: formState.addressLine2.trim() || null,
      city: formState.city.trim() || null,
      province: formState.province.trim() || null,
      postal_code: formState.postalCode.trim() || null,
      country: formState.country.trim() || "South Africa",
      notes: formState.notes.trim() || null,
      created_by: user?.id ?? null,
    });

    if (insertError) {
      toast.error(insertError.message);
      setIsCreating(false);
      return;
    }

    toast.success("Client added successfully.");
    setIsCreateOpen(false);
    resetCreateForm();
    await queryClient.invalidateQueries({ queryKey: ["staff-clients"] });
  };

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 font-display text-2xl font-bold text-foreground">All Clients</h1>
          <p className="text-sm text-muted-foreground font-body">Manage client profiles, open full records, and add new clients from existing portal accounts.</p>
        </div>

        <div className="flex w-full max-w-2xl items-center justify-end gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search client, email, code, or tax number..."
              className="rounded-xl pl-9"
            />
          </div>
          <Button type="button" className="rounded-xl shrink-0" onClick={() => setIsCreateOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add New Client
          </Button>
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
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetCreateForm();
        }}
        title="Add New Client"
        description="Create a client record for an existing portal account. The email must already exist in auth/profiles."
      >
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-accent/30 p-4">
            <p className="text-sm text-foreground font-body">
              Use the email of a user who already has a portal account. This screen creates the `clients` row and saves the client details.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Portal Account Email</label>
              <Input value={formState.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="client@example.com" className="rounded-xl" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Full Name</label>
              <Input value={formState.fullName} onChange={(event) => updateForm("fullName", event.target.value)} placeholder="Client full name" className="rounded-xl" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Phone</label>
              <Input value={formState.phone} onChange={(event) => updateForm("phone", event.target.value)} placeholder="+27 ..." className="rounded-xl" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">First Name</label>
              <Input value={formState.firstName} onChange={(event) => updateForm("firstName", event.target.value)} placeholder="First name" className="rounded-xl" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Last Name</label>
              <Input value={formState.lastName} onChange={(event) => updateForm("lastName", event.target.value)} placeholder="Last name" className="rounded-xl" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Company Name</label>
              <Input value={formState.companyName} onChange={(event) => updateForm("companyName", event.target.value)} placeholder="Optional for business clients" className="rounded-xl" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Tax Number</label>
              <Input value={formState.taxNumber} onChange={(event) => updateForm("taxNumber", event.target.value)} placeholder="Tax number" className="rounded-xl" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">SARS Reference</label>
              <Input value={formState.sarsReferenceNumber} onChange={(event) => updateForm("sarsReferenceNumber", event.target.value)} placeholder="SARS reference number" className="rounded-xl" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">ID Number</label>
              <Input value={formState.idNumber} onChange={(event) => updateForm("idNumber", event.target.value)} placeholder="ID number" className="rounded-xl" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Client Code</label>
              <Input value={formState.clientCode} onChange={(event) => updateForm("clientCode", event.target.value)} placeholder="Optional client code" className="rounded-xl" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Address Line 1</label>
              <Input value={formState.addressLine1} onChange={(event) => updateForm("addressLine1", event.target.value)} placeholder="Street address" className="rounded-xl" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Address Line 2</label>
              <Input value={formState.addressLine2} onChange={(event) => updateForm("addressLine2", event.target.value)} placeholder="Apartment, suite, building" className="rounded-xl" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">City</label>
              <Input value={formState.city} onChange={(event) => updateForm("city", event.target.value)} placeholder="City" className="rounded-xl" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Province</label>
              <Input value={formState.province} onChange={(event) => updateForm("province", event.target.value)} placeholder="Province" className="rounded-xl" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Postal Code</label>
              <Input value={formState.postalCode} onChange={(event) => updateForm("postalCode", event.target.value)} placeholder="Postal code" className="rounded-xl" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Country</label>
              <Input value={formState.country} onChange={(event) => updateForm("country", event.target.value)} placeholder="Country" className="rounded-xl" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Notes</label>
              <Textarea value={formState.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="Internal notes about this client" className="rounded-xl" />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setIsCreateOpen(false);
                resetCreateForm();
              }}
            >
              Cancel
            </Button>
            <Button type="button" className="rounded-xl" onClick={createClient} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Client"}
            </Button>
          </div>
        </div>
      </DashboardItemDialog>

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

            <div className="flex justify-end">
              <Button asChild className="rounded-xl">
                <Link to={`/dashboard/staff/client-workspace?clientId=${selectedClient.id}`}>
                  Open Client 360
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </DashboardItemDialog>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { useAuth } from "@/hooks/useAuth";
import { useAccessibleClientIds } from "@/hooks/useAccessibleClientIds";
import { getClientIdentityFieldLabel, getClientIdentityLabel, getClientTypeLabel, getClientWarningSummary } from "@/lib/clientRisk";

const provinces = [
  "Gauteng",
  "Western Cape",
  "KwaZulu-Natal",
  "Eastern Cape",
  "Free State",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
];

type StaffClient = {
  id: string;
  created_by: string | null;
  client_type: string;
  company_registration_number: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  tax_number: string | null;
  sars_reference_number: string | null;
  id_number: string | null;
  sars_outstanding_debt: number;
  returns_filed: boolean;
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
    id?: string | null;
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
  password: string;
  fullName: string;
  phone: string;
  clientType: "individual" | "company";
  companyName: string;
  companyRegistrationNumber: string;
  firstName: string;
  lastName: string;
  taxNumber: string;
  sarsReferenceNumber: string;
  idNumber: string;
  sarsOutstandingDebt: string;
  returnsFiled: boolean;
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
  password: "",
  fullName: "",
  phone: "",
  clientType: "individual",
  companyName: "",
  companyRegistrationNumber: "",
  firstName: "",
  lastName: "",
  taxNumber: "",
  sarsReferenceNumber: "",
  idNumber: "",
  sarsOutstandingDebt: "0",
  returnsFiled: false,
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

function generateClientCode(seed: string) {
  const compactSeed = seed.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `CL-${compactSeed.slice(-6)}`;
}

function formatCurrency(value: number) {
  return `R ${Number(value || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function canEditClientRecord(client: StaffClient | null, role: string | null, userId?: string) {
  if (!client) {
    return false;
  }

  if (role === "consultant") {
    return client.created_by === (userId ?? null);
  }

  return true;
}

export default function AdminClients() {
  const { user, role, hasStaffPermission } = useAuth();
  const { accessibleClientIds, hasRestrictedClientScope, isLoadingAccessibleClientIds } = useAccessibleClientIds();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isAssigningCodes, setIsAssigningCodes] = useState(false);
  const [formState, setFormState] = useState<NewClientFormState>(initialFormState);
  const [isUpdatingReturnStatus, setIsUpdatingReturnStatus] = useState(false);
  const [updatingInvoiceId, setUpdatingInvoiceId] = useState<string | null>(null);
  const [showInvoiceWarningActions, setShowInvoiceWarningActions] = useState(false);

  const accessibleClientIdsKey = accessibleClientIds?.join(",") ?? "all";
  const canManageClients = role === "consultant" || hasStaffPermission("can_manage_clients");
  const canShowClientCreationControls = canManageClients;
  const canManageInvoices = hasStaffPermission("can_manage_invoices");
  const canViewClientWorkspace = hasStaffPermission("can_view_client_workspace");
  const canViewInvoices = hasStaffPermission("can_view_invoices");
  const canResolveReturnWarnings = canManageClients || canViewClientWorkspace;
  const canResolveInvoiceWarnings = canManageInvoices || canViewInvoices || canViewClientWorkspace;
  const practitionerFilterId = searchParams.get("practitionerId") ?? "";

  const { data: clients, isLoading } = useQuery({
    queryKey: ["staff-clients", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }

      let query = supabase
        .from("clients")
        .select(`
          *,
          profiles!clients_profile_id_fkey(full_name, email, phone),
          assigned_consultant:profiles!clients_assigned_consultant_id_fkey(id, full_name, email),
          created_by_profile:profiles!clients_created_by_fkey(full_name, email)
        `)
        .order("created_at", { ascending: false });

      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("id", accessibleClientIds);
      }

      const { data } = await query;
      return (data ?? []) as StaffClient[];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const { data: riskInvoices } = useQuery({
    queryKey: ["staff-client-risk-invoices", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }

      let query = supabase.from("invoices").select("client_id, status, balance_due");
      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("client_id", accessibleClientIds);
      }
      const { data } = await query;
      return data ?? [];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const { data: riskRequests } = useQuery({
    queryKey: ["staff-client-risk-document-requests", accessibleClientIdsKey],
    queryFn: async () => {
      if (hasRestrictedClientScope && !accessibleClientIds?.length) {
        return [];
      }

      let query = supabase.from("document_requests").select("client_id, is_required, is_fulfilled");
      if (hasRestrictedClientScope && accessibleClientIds?.length) {
        query = query.in("client_id", accessibleClientIds);
      }
      const { data } = await query;
      return data ?? [];
    },
    enabled: !hasRestrictedClientScope || !isLoadingAccessibleClientIds,
  });

  const clientIssueMap = useMemo(() => {
    const outstandingInvoicesByClient = new Map<string, number>();
    const outstandingRequestsByClient = new Map<string, number>();

    for (const invoice of riskInvoices ?? []) {
      const isOutstanding = ["issued", "partially_paid", "overdue"].includes(invoice.status) && Number(invoice.balance_due || 0) > 0;
      if (!isOutstanding) continue;
      outstandingInvoicesByClient.set(invoice.client_id, (outstandingInvoicesByClient.get(invoice.client_id) ?? 0) + 1);
    }

    for (const request of riskRequests ?? []) {
      const isOutstanding = request.is_required && !request.is_fulfilled;
      if (!isOutstanding) continue;
      outstandingRequestsByClient.set(request.client_id, (outstandingRequestsByClient.get(request.client_id) ?? 0) + 1);
    }

    const map = new Map<string, ReturnType<typeof getClientWarningSummary>>();
    for (const client of clients ?? []) {
      map.set(
        client.id,
        getClientWarningSummary(client, {
          outstandingInvoices: outstandingInvoicesByClient.get(client.id) ?? 0,
          outstandingDocumentRequests: outstandingRequestsByClient.get(client.id) ?? 0,
        }),
      );
    }

    return map;
  }, [clients, riskInvoices, riskRequests]);

  const filteredClients = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    if (!normalizedSearch) {
      return (clients ?? []).filter((client) => !practitionerFilterId || client.assigned_consultant?.id === practitionerFilterId);
    }

    return (clients ?? []).filter((client) => {
      const name = getClientName(client).toLowerCase();
      const email = (client.profiles?.email || "").toLowerCase();
      const phone = (client.profiles?.phone || "").toLowerCase();
      const taxNumber = (client.tax_number || "").toLowerCase();
      const clientCode = (client.client_code || "").toLowerCase();
      const clientType = (client.client_type || "").toLowerCase();
      const matchesPractitioner = !practitionerFilterId || client.assigned_consultant?.id === practitionerFilterId;

      return (
        matchesPractitioner && (
          name.includes(normalizedSearch) ||
          email.includes(normalizedSearch) ||
          phone.includes(normalizedSearch) ||
          taxNumber.includes(normalizedSearch) ||
          clientCode.includes(normalizedSearch) ||
          clientType.includes(normalizedSearch)
        )
      );
    });
  }, [clients, practitionerFilterId, searchQuery]);

  const selectedClient = filteredClients.find((client) => client.id === selectedClientId)
    || clients?.find((client) => client.id === selectedClientId)
    || null;
  const canEditSelectedClient = canEditClientRecord(selectedClient, role, user?.id);

  useEffect(() => {
    setShowInvoiceWarningActions(false);
  }, [selectedClientId]);

  const { data: selectedClientOutstandingInvoices } = useQuery({
    queryKey: ["staff-client-warning-invoices", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) {
        return [];
      }

      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, title, status, total_amount, amount_paid, balance_due")
        .eq("client_id", selectedClientId)
        .in("status", ["issued", "partially_paid", "overdue"])
        .gt("balance_due", 0)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return data ?? [];
    },
    enabled: !!selectedClientId,
  });

  const filteredPractitionerLabel = useMemo(
    () => clients?.find((client) => client.assigned_consultant?.id === practitionerFilterId)?.assigned_consultant?.full_name
      || clients?.find((client) => client.assigned_consultant?.id === practitionerFilterId)?.assigned_consultant?.email
      || "",
    [clients, practitionerFilterId],
  );

  const clearPractitionerFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("practitionerId");
    setSearchParams(next, { replace: true });
  };

  const refreshClientViews = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff-clients"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-client-risk-invoices"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-client-risk-document-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-overview-risk-clients"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-client-warning-invoices", selectedClientId] }),
    ]);
  };

  const updateClientReturnStatus = async () => {
    if (!selectedClient || !canResolveReturnWarnings) {
      toast.error("This consultant profile cannot update client return status.");
      return;
    }

    setIsUpdatingReturnStatus(true);
    const { error } = await supabase
      .from("clients")
      .update({ returns_filed: true })
      .eq("id", selectedClient.id);
    setIsUpdatingReturnStatus(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Return status updated.");
    await refreshClientViews();
  };

  const markInvoiceAsPaid = async (invoiceId: string, totalAmount: number | null) => {
    if (!canResolveInvoiceWarnings) {
      toast.error("This consultant profile cannot update payment status.");
      return;
    }

    setUpdatingInvoiceId(invoiceId);
    const total = Number(totalAmount || 0);
    const { error } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        amount_paid: total,
        balance_due: 0,
      })
      .eq("id", invoiceId);
    setUpdatingInvoiceId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Payment status updated.");
    await refreshClientViews();
  };

  const updateForm = <K extends keyof NewClientFormState>(key: K, value: NewClientFormState[K]) => {
    setFormState((current) => ({ ...current, [key]: value }));
  };

  const resetCreateForm = () => {
    setFormState(initialFormState);
    setIsCreating(false);
    setIsSavingEdit(false);
  };

  const loadClientIntoForm = (client: StaffClient) => {
    setFormState({
      email: client.profiles?.email || "",
      password: "",
      fullName: client.profiles?.full_name || [client.first_name, client.last_name].filter(Boolean).join(" ") || client.company_name || "",
      phone: client.profiles?.phone || "",
      clientType: client.client_type === "company" ? "company" : "individual",
      companyName: client.company_name || "",
      companyRegistrationNumber: client.company_registration_number || "",
      firstName: client.first_name || "",
      lastName: client.last_name || "",
      taxNumber: client.tax_number || "",
      sarsReferenceNumber: client.sars_reference_number || "",
      idNumber: client.id_number || "",
      sarsOutstandingDebt: String(client.sars_outstanding_debt ?? 0),
      returnsFiled: client.returns_filed,
      clientCode: client.client_code || "",
      addressLine1: client.address_line_1 || "",
      addressLine2: client.address_line_2 || "",
      city: client.city || "",
      province: client.province || "",
      postalCode: client.postal_code || "",
      country: client.country || "South Africa",
      notes: client.notes || "",
    });
  };

  const createClient = async () => {
    if (!canManageClients) {
      toast.error("This consultant profile cannot create client records.");
      return;
    }

    const email = formState.email.trim().toLowerCase();

    if (!email) {
      toast.error("Enter the client email first.");
      return;
    }

    setIsCreating(true);

    const requestedFullName = formState.fullName.trim()
      || [formState.firstName.trim(), formState.lastName.trim()].filter(Boolean).join(" ")
      || formState.companyName.trim()
      || email.split("@")[0];

    const { data: existingProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .eq("email", email)
      .maybeSingle();

    if (profileError) {
      toast.error(profileError.message);
      setIsCreating(false);
      return;
    }

    let profile = existingProfile;
    const createdPortalAccount = !existingProfile;

    if (!profile) {
      const password = formState.password.trim();

      if (password.length < 8) {
        toast.error("Enter a portal password with at least 8 characters for a brand-new client account.");
        setIsCreating(false);
        return;
      }

      const { data: createUserData, error: createUserError } = await supabase.functions.invoke("create-client-user", {
        body: {
          email,
          password,
          fullName: requestedFullName,
          phone: formState.phone.trim(),
        },
      });

      if (createUserError || createUserData?.error) {
        toast.error(createUserData?.error || createUserError?.message || "Unable to create the portal account for this client.");
        setIsCreating(false);
        return;
      }

      profile = {
        id: createUserData.user.id,
        full_name: createUserData.user.full_name,
        phone: createUserData.user.phone,
      };
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

    if (existingClient && !createdPortalAccount) {
      toast.error("This portal account already has a client record.");
      setIsCreating(false);
      return;
    }

    const resolvedFullName = requestedFullName || profile.full_name || "";
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

    const clientPayload = {
      profile_id: profile.id,
      client_type: formState.clientType,
      company_registration_number: formState.clientType === "company" ? formState.companyRegistrationNumber.trim() || null : null,
      first_name: firstName || null,
      last_name: lastName || null,
      company_name: formState.clientType === "company" ? formState.companyName.trim() || null : null,
      tax_number: formState.taxNumber.trim() || null,
      sars_reference_number: formState.sarsReferenceNumber.trim() || null,
      id_number: formState.clientType === "individual" ? formState.idNumber.trim() || null : null,
      sars_outstanding_debt: Number(formState.sarsOutstandingDebt || 0),
      returns_filed: formState.returnsFiled,
      client_code: formState.clientCode.trim() || generateClientCode(profile.id),
      address_line_1: formState.addressLine1.trim() || null,
      address_line_2: formState.addressLine2.trim() || null,
      city: formState.city.trim() || null,
      province: formState.province.trim() || null,
      postal_code: formState.postalCode.trim() || null,
      country: formState.country.trim() || "South Africa",
      notes: formState.notes.trim() || null,
      assigned_consultant_id: role === "consultant" ? user?.id ?? null : null,
      created_by: user?.id ?? null,
    };

    const { error: clientWriteError } = existingClient
      ? await supabase
        .from("clients")
        .update(clientPayload)
        .eq("id", existingClient.id)
      : await supabase
        .from("clients")
        .insert(clientPayload);

    if (clientWriteError) {
      toast.error(clientWriteError.message);
      setIsCreating(false);
      return;
    }

    toast.success(existingProfile ? "Client added successfully." : "Client account and profile created successfully.");
    setIsCreateOpen(false);
    resetCreateForm();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff-clients"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-client-risk-invoices"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-client-risk-document-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-overview-risk-clients"] }),
    ]);
  };

  const saveClientEdits = async () => {
    if (!selectedClient || !canManageClients || !canEditSelectedClient) {
      toast.error("This practitioner profile cannot update client records.");
      return;
    }

    setIsSavingEdit(true);

    const resolvedFullName = formState.fullName.trim()
      || [formState.firstName.trim(), formState.lastName.trim()].filter(Boolean).join(" ")
      || formState.companyName.trim()
      || selectedClient.profiles?.full_name
      || "";

    const nameParts = splitFullName(resolvedFullName);
    const firstName = formState.firstName.trim() || nameParts.firstName;
    const lastName = formState.lastName.trim() || nameParts.lastName;

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({
        full_name: resolvedFullName || null,
        phone: formState.phone.trim() || null,
      })
      .eq("id", selectedClient.profile_id);

    if (profileUpdateError) {
      toast.error(profileUpdateError.message);
      setIsSavingEdit(false);
      return;
    }

    const { error: clientUpdateError } = await supabase
      .from("clients")
      .update({
        client_type: formState.clientType,
        company_registration_number: formState.clientType === "company" ? formState.companyRegistrationNumber.trim() || null : null,
        first_name: firstName || null,
        last_name: lastName || null,
        company_name: formState.clientType === "company" ? formState.companyName.trim() || null : null,
        tax_number: formState.taxNumber.trim() || null,
        sars_reference_number: formState.sarsReferenceNumber.trim() || null,
        id_number: formState.clientType === "individual" ? formState.idNumber.trim() || null : null,
        sars_outstanding_debt: Number(formState.sarsOutstandingDebt || 0),
        returns_filed: formState.returnsFiled,
        client_code: formState.clientCode.trim() || selectedClient.client_code || generateClientCode(selectedClient.id),
        address_line_1: formState.addressLine1.trim() || null,
        address_line_2: formState.addressLine2.trim() || null,
        city: formState.city.trim() || null,
        province: formState.province.trim() || null,
        postal_code: formState.postalCode.trim() || null,
        country: formState.country.trim() || "South Africa",
        notes: formState.notes.trim() || null,
      })
      .eq("id", selectedClient.id);

    if (clientUpdateError) {
      toast.error(clientUpdateError.message);
      setIsSavingEdit(false);
      return;
    }

    toast.success("Client details updated.");
    setIsSavingEdit(false);
    setIsEditOpen(false);
    await refreshClientViews();
  };

  const assignMissingClientCodes = async () => {
    if (!canManageClients) {
      toast.error("This consultant profile cannot update client records.");
      return;
    }

    const missingCodes = (clients ?? []).filter((client) => !client.client_code);

    if (!missingCodes.length) {
      toast.success("All clients already have a client code.");
      return;
    }

    setIsAssigningCodes(true);

    const results = await Promise.allSettled(
      missingCodes.map((client) =>
        supabase
          .from("clients")
          .update({ client_code: generateClientCode(client.id) })
          .eq("id", client.id),
      ),
    );

    const failed = results.filter((result) => result.status === "rejected" || result.value?.error);

    if (failed.length) {
      toast.error(`Assigned codes to ${missingCodes.length - failed.length} clients. ${failed.length} updates failed.`);
    } else {
      toast.success(`Assigned client codes to ${missingCodes.length} clients.`);
    }

    setIsAssigningCodes(false);
    await queryClient.invalidateQueries({ queryKey: ["staff-clients"] });
  };

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 font-display text-2xl font-bold text-foreground">All Clients</h1>
          <p className="text-sm text-muted-foreground font-body">
            {hasRestrictedClientScope
              ? "View and monitor only the client accounts assigned to this consultant profile."
              : practitionerFilterId
                ? "Review the client accounts assigned to this practitioner."
                : "Manage client profiles, open full records, and add new clients manually for clients already working with this practitioner."}
          </p>
        </div>

        <div className="flex w-full max-w-2xl items-center justify-end gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search client, email, type, code, or tax number..."
              className="rounded-xl pl-9"
            />
          </div>
          {canShowClientCreationControls ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl shrink-0"
                onClick={assignMissingClientCodes}
                disabled={isAssigningCodes}
              >
                {isAssigningCodes ? "Assigning..." : "Auto Client Codes"}
              </Button>
              <Button type="button" className="rounded-xl shrink-0" onClick={() => setIsCreateOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add New Client
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {practitionerFilterId ? (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground font-body">
            Filtering clients for <span className="font-semibold text-foreground">{filteredPractitionerLabel || "selected practitioner"}</span>.
          </p>
          <Button type="button" variant="outline" className="rounded-xl" onClick={clearPractitionerFilter}>
            Clear Practitioner Filter
          </Button>
        </div>
      ) : null}

      {isLoading || isLoadingAccessibleClientIds ? (
        <div className="text-muted-foreground font-body">Loading...</div>
      ) : filteredClients.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="p-4 text-left text-sm font-semibold text-foreground font-body">Name</th>
                <th className="p-4 text-left text-sm font-semibold text-foreground font-body">Email</th>
                <th className="p-4 text-left text-sm font-semibold text-foreground font-body">Type</th>
                <th className="p-4 text-left text-sm font-semibold text-foreground font-body">Tax Number</th>
                <th className="p-4 text-left text-sm font-semibold text-foreground font-body">Client Code</th>
                <th className="p-4 text-left text-sm font-semibold text-foreground font-body">Status</th>
                <th className="p-4 text-left text-sm font-semibold text-foreground font-body">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => {
                const warningSummary = clientIssueMap.get(client.id);

                return (
                  <tr
                    key={client.id}
                    className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-accent/30"
                    onClick={() => setSelectedClientId(client.id)}
                  >
                    <td className="p-4 text-sm font-medium text-foreground font-body">{getClientName(client)}</td>
                    <td className="p-4 text-sm text-muted-foreground font-body">{client.profiles?.email || "-"}</td>
                    <td className="p-4 text-sm text-muted-foreground font-body">{getClientTypeLabel(client.client_type)}</td>
                    <td className="p-4 text-sm text-muted-foreground font-body">{client.tax_number || "-"}</td>
                    <td className="p-4 text-sm text-muted-foreground font-body">{client.client_code || "-"}</td>
                    <td className="p-4 text-sm font-body">
                      {warningSummary?.hasIssues ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {warningSummary.issueCount} warning{warningSummary.issueCount === 1 ? "" : "s"}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          Healthy
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground font-body">{new Date(client.created_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
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
        open={canShowClientCreationControls && isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetCreateForm();
        }}
        title="Add New Client"
        description="Create a client record for an existing portal account, or create a brand-new portal client account from this same screen."
      >
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-accent/30 p-4">
            <p className="text-sm text-foreground font-body">
              If the email already exists, this screen links the client details to that portal account. If the email is brand new, it will create the portal login first and then save the client record.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Portal Account Email</label>
              <Input value={formState.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="client@example.com" className="rounded-xl" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Portal Password</label>
              <Input
                type="password"
                value={formState.password}
                onChange={(event) => updateForm("password", event.target.value)}
                placeholder="Required only when this email is brand new"
                className="rounded-xl"
              />
              <p className="mt-2 text-xs text-muted-foreground font-body">
                Leave this blank for an existing portal user. For a brand-new client account, enter the initial portal password here.
              </p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Client Type</label>
              <Select value={formState.clientType} onValueChange={(value) => updateForm("clientType", value as NewClientFormState["clientType"])}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                </SelectContent>
              </Select>
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

            {formState.clientType === "company" ? (
              <>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Company Name</label>
                  <Input value={formState.companyName} onChange={(event) => updateForm("companyName", event.target.value)} placeholder="Company name" className="rounded-xl" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">Company Registration Number</label>
                  <Input value={formState.companyRegistrationNumber} onChange={(event) => updateForm("companyRegistrationNumber", event.target.value)} placeholder="Registration number" className="rounded-xl" />
                </div>
              </>
            ) : (
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">ID Number</label>
                <Input value={formState.idNumber} onChange={(event) => updateForm("idNumber", event.target.value)} placeholder="ID number" className="rounded-xl" />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Tax Number</label>
              <Input value={formState.taxNumber} onChange={(event) => updateForm("taxNumber", event.target.value)} placeholder="Tax number" className="rounded-xl" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">SARS Reference</label>
              <Input value={formState.sarsReferenceNumber} onChange={(event) => updateForm("sarsReferenceNumber", event.target.value)} placeholder="SARS reference number" className="rounded-xl" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">SARS Outstanding / Debt</label>
              <Input
                value={formState.sarsOutstandingDebt}
                onChange={(event) => updateForm("sarsOutstandingDebt", event.target.value)}
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Client Code</label>
              <Input value={formState.clientCode} onChange={(event) => updateForm("clientCode", event.target.value)} placeholder="Optional client code" className="rounded-xl" />
            </div>

            <div className="sm:col-span-2 rounded-2xl border border-border bg-accent/30 p-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="returns-filed"
                  checked={formState.returnsFiled}
                  onCheckedChange={(checked) => updateForm("returnsFiled", checked === true)}
                />
                <label htmlFor="returns-filed" className="text-sm font-semibold text-foreground font-body">
                  Returns filed
                </label>
              </div>
              <p className="mt-2 text-xs text-muted-foreground font-body">
                Leave this unchecked when returns are still outstanding so the dashboard can raise a red warning.
              </p>
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
              <Select value={formState.province} onValueChange={(value) => updateForm("province", value)}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="Select province" />
                </SelectTrigger>
                <SelectContent>
                  {provinces.map((province) => (
                    <SelectItem key={province} value={province}>
                      {province}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          if (!open) {
            setSelectedClientId(null);
            setShowInvoiceWarningActions(false);
          }
        }}
        title={selectedClient ? getClientName(selectedClient) : "Client Details"}
        description="Review this client's profile, tax details, assignment, and address information."
      >
        {selectedClient ? (
          <div className="space-y-6">
            {(() => {
              const warningSummary = clientIssueMap.get(selectedClient.id) ?? getClientWarningSummary(selectedClient);
              return warningSummary.hasIssues ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    <div className="w-full">
                      <p className="font-body text-sm font-semibold text-red-700">Attention needed on this client account</p>
                      <div className="mt-3 space-y-3">
                        {canManageClients && canEditSelectedClient ? (
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="rounded-lg"
                              onClick={() => {
                                loadClientIntoForm(selectedClient);
                                setIsEditOpen(true);
                              }}
                            >
                              Edit Client Details
                            </Button>
                          </div>
                        ) : null}

                        {warningSummary.debtAmount > 0 ? (
                          <div className="rounded-xl border border-red-100 bg-white px-3 py-3 text-sm font-medium text-red-700">
                            SARS debt outstanding
                          </div>
                        ) : null}

                        {selectedClient.returns_filed === false ? (
                          <div className="flex flex-col gap-3 rounded-xl border border-red-100 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-sm font-medium text-red-700">Returns not filed</span>
                            <Button
                              type="button"
                              size="sm"
                              className="rounded-lg bg-red-600 text-white shadow-sm hover:bg-red-700"
                              onClick={updateClientReturnStatus}
                              disabled={isUpdatingReturnStatus || !canResolveReturnWarnings}
                            >
                              {isUpdatingReturnStatus ? "Updating..." : "Update Return Status"}
                            </Button>
                          </div>
                        ) : null}

                        {warningSummary.outstandingInvoices > 0 ? (
                          <div className="rounded-xl border border-red-100 bg-white px-3 py-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <span className="text-sm font-medium text-red-700">
                                {warningSummary.outstandingInvoices} invoice{warningSummary.outstandingInvoices === 1 ? "" : "s"} outstanding
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-lg border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
                                onClick={() => setShowInvoiceWarningActions((current) => !current)}
                                disabled={!canResolveInvoiceWarnings}
                              >
                                Update Payment Status
                              </Button>
                            </div>
                            {showInvoiceWarningActions && selectedClientOutstandingInvoices?.length ? (
                              <div className="mt-3 space-y-2">
                                {selectedClientOutstandingInvoices.map((invoice) => (
                                  <div key={invoice.id} className="flex flex-col gap-2 rounded-lg border border-border/70 bg-accent/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">
                                        {invoice.invoice_number ? `INV-${invoice.invoice_number}` : invoice.title || "Outstanding invoice"}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Outstanding: {formatCurrency(Number(invoice.balance_due || 0))}
                                      </p>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="rounded-lg bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                                      onClick={() => markInvoiceAsPaid(invoice.id, Number(invoice.total_amount || 0))}
                                      disabled={updatingInvoiceId === invoice.id || !canResolveInvoiceWarnings}
                                    >
                                      {updatingInvoiceId === invoice.id ? "Updating..." : "Mark as Paid"}
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {warningSummary.outstandingDocumentRequests > 0 ? (
                          <div className="rounded-xl border border-red-100 bg-white px-3 py-3 text-sm font-medium text-red-700">
                            {warningSummary.outstandingDocumentRequests} document request{warningSummary.outstandingDocumentRequests === 1 ? "" : "s"} outstanding
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Full Name</p>
                <p className="font-body text-foreground">{selectedClient.profiles?.full_name || [selectedClient.first_name, selectedClient.last_name].filter(Boolean).join(" ") || "Not provided"}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Client Type</p>
                <p className="font-body text-foreground">{getClientTypeLabel(selectedClient.client_type)}</p>
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
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Company Name</p>
                <p className="font-body text-foreground">{selectedClient.company_name || "Not provided"}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">{getClientIdentityFieldLabel(selectedClient.client_type)}</p>
                <p className="font-body text-foreground">{getClientIdentityLabel(selectedClient)}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Tax Number</p>
                <p className="font-body text-foreground">{selectedClient.tax_number || "Not provided"}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">SARS Reference</p>
                <p className="font-body text-foreground">{selectedClient.sars_reference_number || "Not provided"}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">SARS Outstanding / Debt</p>
                <p className="font-body text-foreground">{formatCurrency(selectedClient.sars_outstanding_debt)}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Returns Filed</p>
                <p className="font-body text-foreground">{selectedClient.returns_filed ? "Filed" : "Not filed"}</p>
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

            {canEditSelectedClient || canViewClientWorkspace ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                {canEditSelectedClient ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      loadClientIntoForm(selectedClient);
                      setIsEditOpen(true);
                    }}
                  >
                    Edit Client Details
                  </Button>
                ) : null}
                {canViewClientWorkspace ? (
                <Button asChild className="rounded-xl">
                  <Link to={`/dashboard/staff/client-workspace?clientId=${selectedClient.id}`}>
                    Open Client 360
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </DashboardItemDialog>

      <DashboardItemDialog
        open={!!selectedClient && isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) {
            resetCreateForm();
          }
        }}
        title="Edit Client Details"
        description="Update this client profile to resolve warnings and keep the record accurate."
      >
        {selectedClient && canEditSelectedClient ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Full Name</label>
                <Input value={formState.fullName} onChange={(event) => updateForm("fullName", event.target.value)} placeholder="Client full name" className="rounded-xl" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Phone</label>
                <Input value={formState.phone} onChange={(event) => updateForm("phone", event.target.value)} placeholder="+27 ..." className="rounded-xl" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Client Type</label>
                <Select value={formState.clientType} onValueChange={(value) => updateForm("clientType", value as NewClientFormState["clientType"])}>
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">First Name</label>
                <Input value={formState.firstName} onChange={(event) => updateForm("firstName", event.target.value)} placeholder="First name" className="rounded-xl" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Last Name</label>
                <Input value={formState.lastName} onChange={(event) => updateForm("lastName", event.target.value)} placeholder="Last name" className="rounded-xl" />
              </div>

              {formState.clientType === "company" ? (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-foreground font-body">Company Name</label>
                    <Input value={formState.companyName} onChange={(event) => updateForm("companyName", event.target.value)} placeholder="Company name" className="rounded-xl" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-foreground font-body">Company Registration Number</label>
                    <Input value={formState.companyRegistrationNumber} onChange={(event) => updateForm("companyRegistrationNumber", event.target.value)} placeholder="Registration number" className="rounded-xl" />
                  </div>
                </>
              ) : (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-foreground font-body">ID Number</label>
                  <Input value={formState.idNumber} onChange={(event) => updateForm("idNumber", event.target.value)} placeholder="ID number" className="rounded-xl" />
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Tax Number</label>
                <Input value={formState.taxNumber} onChange={(event) => updateForm("taxNumber", event.target.value)} placeholder="Tax number" className="rounded-xl" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">SARS Reference</label>
                <Input value={formState.sarsReferenceNumber} onChange={(event) => updateForm("sarsReferenceNumber", event.target.value)} placeholder="SARS reference number" className="rounded-xl" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">SARS Outstanding / Debt</label>
                <Input value={formState.sarsOutstandingDebt} onChange={(event) => updateForm("sarsOutstandingDebt", event.target.value)} type="number" min="0" step="0.01" placeholder="0.00" className="rounded-xl" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Client Code</label>
                <Input value={formState.clientCode} onChange={(event) => updateForm("clientCode", event.target.value)} placeholder="Client code" className="rounded-xl" />
              </div>

              <div className="sm:col-span-2 rounded-2xl border border-border bg-accent/30 p-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="edit-returns-filed"
                    checked={formState.returnsFiled}
                    onCheckedChange={(checked) => updateForm("returnsFiled", checked === true)}
                  />
                  <label htmlFor="edit-returns-filed" className="text-sm font-semibold text-foreground font-body">
                    Returns filed
                  </label>
                </div>
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
                <Select value={formState.province} onValueChange={(value) => updateForm("province", value)}>
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue placeholder="Select province" />
                  </SelectTrigger>
                  <SelectContent>
                    {provinces.map((province) => (
                      <SelectItem key={province} value={province}>
                        {province}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Textarea value={formState.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="Internal notes" className="rounded-xl" />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setIsEditOpen(false);
                  resetCreateForm();
                }}
              >
                Cancel
              </Button>
              <Button type="button" className="rounded-xl" onClick={saveClientEdits} disabled={isSavingEdit}>
                {isSavingEdit ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        ) : selectedClient ? (
          <div className="rounded-2xl border border-border bg-accent/20 p-4 text-sm text-muted-foreground font-body">
            Practitioners can only edit clients they created.
          </div>
        ) : null}
      </DashboardItemDialog>
    </div>
  );
}

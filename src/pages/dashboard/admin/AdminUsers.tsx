import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Eye,
  FileWarning,
  LockKeyhole,
  Search,
  Shield,
  UserCheck,
  UserCog,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import type { Enums, Tables } from "@/integrations/supabase/types";
import {
  PractitionerProfileFields,
  type PractitionerProfileFormState,
} from "@/components/dashboard/PractitionerProfileFields";
import { PractitionerDocumentsSection } from "@/components/dashboard/PractitionerDocumentsSection";
import { PractitionerProfileMissingFields } from "@/components/dashboard/PractitionerProfileMissingFields";
import { AdminCreditControls } from "@/components/dashboard/AdminCreditControls";
import { CreditHistory } from "@/components/dashboard/CreditHistory";
import { DeletePlatformUserDialog } from "@/components/dashboard/DeletePlatformUserDialog";
import {
  formatAvailabilityLabel,
  getAvailabilityBadgeClass,
  getWorkloadLabel,
  normalizeServicesOffered,
} from "@/lib/practitionerMarketplace";
import {
  consultantPermissionFields,
  defaultConsultantPermissions,
  fullStaffPermissions,
  getFirstStaffRoute,
  resolveStaffPermissions,
  sanitizeStaffPermissions,
  type StaffPermissionValues,
} from "@/lib/staffPermissions";

type StaffRole = Extract<Enums<"app_role">, "admin" | "consultant">;
type PractitionerAvailability = Enums<"practitioner_availability_status">;
type StaffProfile = Tables<"profiles">;
type StaffPermissionRow = Tables<"staff_permissions">;
type PractitionerProfile = Tables<"practitioner_profiles">;
type ClientAssignmentRow = Pick<
  Tables<"clients">,
  "id" | "assigned_consultant_id"
>;
type CaseAssignmentRow = Pick<
  Tables<"cases">,
  "id" | "client_id" | "assigned_consultant_id" | "status"
>;
type DocumentAttentionRow = Pick<
  Tables<"documents">,
  "id" | "client_id" | "case_id" | "status"
>;
type StaffCardRecord = {
  staffUser: StaffProfile;
  role: StaffRole;
  practitionerProfile: PractitionerProfile | null;
  isVerified: boolean;
  isIncompleteProfile: boolean;
  outstandingDocumentsCount: number;
  rejectedDocumentsCount: number;
  activeCaseCount: number;
  assignedClientCount: number;
  availabilityStatus: PractitionerAvailability | null;
  registrationNumber: string;
  businessName: string;
  businessType: "individual" | "company";
  needsAttention: boolean;
  isReadyForWork: boolean;
};

type CreateStaffFormState = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: StaffRole;
};

type EditStaffFormState = {
  fullName: string;
  phone: string;
  role: StaffRole;
  isActive: boolean;
};

const initialCreateForm: CreateStaffFormState = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
  role: "consultant",
};

const initialEditForm: EditStaffFormState = {
  fullName: "",
  phone: "",
  role: "consultant",
  isActive: true,
};

const initialPractitionerProfileForm: PractitionerProfileFormState = {
  businessType: "individual",
  businessName: "",
  registrationNumber: "",
  professionalTitle: "",
  profileSummary: "",
  languagesSpoken: "",
  showRegistrationNumber: false,
  yearsOfExperience: "0",
  availabilityStatus: "available",
  isVerified: false,
  internalNotes: "",
  servicesOffered: [],
  bankAccountHolderName: "",
  bankName: "",
  bankBranchName: "",
  bankBranchCode: "",
  bankAccountNumber: "",
  bankAccountType: "",
  isVatRegistered: false,
  vatNumber: "",
};

function getRoleLabel(role: StaffRole) {
  return role === "admin" ? "Admin" : "Practitioner";
}

function getRoleDescription(role: StaffRole) {
  return role === "admin"
    ? "Full Acapolite management access."
    : "Marketplace practitioner access for leads, assigned clients, case work, and communication based on the limits you set.";
}

function getRoleBadgeClass(role: StaffRole) {
  return role === "admin"
    ? "border-blue-200 bg-blue-50 text-blue-700"
    : "border-slate-200 bg-slate-100 text-slate-700";
}

function getActivityBadgeClass(isActive: boolean) {
  return isActive
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-700";
}

function getVerificationBadgeClass(isVerified: boolean) {
  return isVerified
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

function getBankingVerificationBadgeClass(status?: string | null) {
  switch (status) {
    case "verified":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "rejected":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function getBankingVerificationLabel(status?: string | null) {
  switch (status) {
    case "verified":
      return "Verified";
    case "rejected":
      return "Rejected";
    default:
      return "Pending Verification";
  }
}

function hasCompleteBankingDetails(profile?: PractitionerProfile | null) {
  return Boolean(
    profile?.bank_account_holder_name?.trim() &&
    profile?.bank_name?.trim() &&
    profile?.bank_branch_name?.trim() &&
    profile?.bank_branch_code?.trim() &&
    profile?.bank_account_number?.trim() &&
    profile?.bank_account_type?.trim(),
  );
}

function getVerificationDocumentStatus(
  totalRequired?: number | null,
  approvedRequired?: number | null,
  pendingRequired?: number | null,
  rejectedRequired?: number | null,
) {
  if (!totalRequired) {
    return { status: "no_docs", label: "No documents uploaded", ready: false };
  }

  if ((rejectedRequired ?? 0) > 0) {
    return {
      status: "has_rejected",
      label: `${rejectedRequired} document(s) rejected`,
      ready: false,
    };
  }

  if ((approvedRequired ?? 0) === totalRequired) {
    return {
      status: "all_approved",
      label: "All required documents approved",
      ready: true,
    };
  }

  if ((pendingRequired ?? 0) > 0) {
    return {
      status: "pending",
      label: `${pendingRequired} document(s) pending review`,
      ready: false,
    };
  }

  return {
    status: "incomplete",
    label: `${approvedRequired ?? 0} of ${totalRequired} approved`,
    ready: false,
  };
}

function isPractitionerProfileIncomplete(profile?: PractitionerProfile | null) {
  if (!profile) return true;

  const isRegisteredCompany = profile.business_type === "company";

  return (
    (isRegisteredCompany &&
      (!profile.business_name?.trim() || !profile.registration_number?.trim())) ||
    !profile.services_offered?.length
  );
}

function getPermissionPreset(
  role: StaffRole,
  permissions?: Partial<StaffPermissionValues> | null,
) {
  return resolveStaffPermissions(role, permissions) ?? fullStaffPermissions;
}

function PermissionEditor({
  role,
  permissions,
  onToggle,
}: {
  role: StaffRole;
  permissions: StaffPermissionValues;
  onToggle: (key: keyof StaffPermissionValues, value: boolean) => void;
}) {
  if (role === "admin") {
    return (
      <div className="rounded-2xl border border-border bg-accent/30 p-4">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground font-body">
              Admins always have full access
            </p>
            <p className="mt-1 text-sm text-muted-foreground font-body">
              Admin accounts ignore practitioner restrictions and can access
              every staff screen and action automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-accent/30 p-4">
        <p className="text-sm font-semibold text-foreground font-body">
          Practitioner visibility and action limits
        </p>
        <p className="mt-1 text-sm text-muted-foreground font-body">
          Choose exactly what this practitioner can open and what actions they
          can perform.
        </p>
      </div>

      <div className="grid gap-3">
        {consultantPermissionFields.map((field) => (
          <div key={field.key} className="rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground font-body">
                  {field.label}
                </p>
                <p className="mt-1 text-sm text-muted-foreground font-body">
                  {field.description}
                </p>
              </div>
              <Switch
                checked={permissions[field.key]}
                onCheckedChange={(checked) => onToggle(field.key, checked)}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
          Landing Route
        </p>
        <p className="mt-2 font-body text-foreground">
          {getFirstStaffRoute(permissions)}
        </p>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | StaffRole>("all");
  const [verificationFilter, setVerificationFilter] = useState<
    "all" | "verified" | "not_verified"
  >("all");
  const [documentFilter, setDocumentFilter] = useState<
    "all" | "outstanding" | "rejected" | "attention" | "clean"
  >("all");
  const [activityFilter, setActivityFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<
    "all" | PractitionerAvailability
  >("all");
  const [sortOption, setSortOption] = useState<
    "newest" | "oldest" | "workload_high" | "workload_low"
  >("newest");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isDeletePractitionerOpen, setIsDeletePractitionerOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [quickAction, setQuickAction] = useState<{
    id: string | null;
    type: "verify" | "verify-banking" | "toggle-active" | null;
  }>({
    id: null,
    type: null,
  });
  const [createForm, setCreateForm] =
    useState<CreateStaffFormState>(initialCreateForm);
  const [editForm, setEditForm] = useState<EditStaffFormState>(initialEditForm);
  const [createPermissions, setCreatePermissions] =
    useState<StaffPermissionValues>(defaultConsultantPermissions);
  const [editPermissions, setEditPermissions] = useState<StaffPermissionValues>(
    defaultConsultantPermissions,
  );
  const [createPractitionerProfile, setCreatePractitionerProfile] =
    useState<PractitionerProfileFormState>(initialPractitionerProfileForm);
  const [editPractitionerProfile, setEditPractitionerProfile] =
    useState<PractitionerProfileFormState>(initialPractitionerProfileForm);
  const [startingConversationId, setStartingConversationId] = useState<
    string | null
  >(null);

  const { data: staffUsers, isLoading } = useQuery({
    queryKey: ["staff-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, phone, role, is_active, created_at, updated_at",
        )
        .in("role", ["admin", "consultant"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as StaffProfile[];
    },
  });

  const consultantIds = useMemo(
    () =>
      (staffUsers ?? [])
        .filter((staffUser) => staffUser.role === "consultant")
        .map((staffUser) => staffUser.id),
    [staffUsers],
  );

  const { data: practitionerProfileRows } = useQuery({
    queryKey: ["staff-user-practitioner-profiles", consultantIds],
    queryFn: async () => {
      if (!consultantIds.length) {
        return [] as PractitionerProfile[];
      }

      const { data, error } = await supabase
        .from("practitioner_profiles")
        .select("*")
        .in("profile_id", consultantIds);

      if (error) throw error;
      return (data ?? []) as PractitionerProfile[];
    },
    enabled: consultantIds.length > 0,
  });

  const { data: clientAssignmentRows } = useQuery({
    queryKey: ["staff-user-client-assignments", consultantIds],
    queryFn: async () => {
      if (!consultantIds.length) {
        return [] as ClientAssignmentRow[];
      }

      const { data, error } = await supabase
        .from("clients")
        .select("id, assigned_consultant_id")
        .in("assigned_consultant_id", consultantIds);

      if (error) throw error;
      return (data ?? []) as ClientAssignmentRow[];
    },
    enabled: consultantIds.length > 0,
  });

  const { data: caseAssignmentRows } = useQuery({
    queryKey: ["staff-user-case-assignments", consultantIds],
    queryFn: async () => {
      if (!consultantIds.length) {
        return [] as CaseAssignmentRow[];
      }

      const { data, error } = await supabase
        .from("cases")
        .select("id, client_id, assigned_consultant_id, status")
        .in("assigned_consultant_id", consultantIds);

      if (error) throw error;
      return (data ?? []) as CaseAssignmentRow[];
    },
    enabled: consultantIds.length > 0,
  });

  const { data: documentAttentionRows } = useQuery({
    queryKey: ["staff-user-document-attention"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, client_id, case_id, status")
        .in("status", ["uploaded", "pending_review", "rejected"]);

      if (error) throw error;
      return (data ?? []) as DocumentAttentionRow[];
    },
  });

  const practitionerProfileMap = useMemo(
    () =>
      new Map(
        (practitionerProfileRows ?? []).map((profile) => [
          profile.profile_id,
          profile,
        ]),
      ),
    [practitionerProfileRows],
  );

  const practitionerStatsMap = useMemo(() => {
    const assignedClientIdsByPractitioner = new Map<string, Set<string>>();
    const activeCaseCountByPractitioner = new Map<string, number>();
    const outstandingDocumentsByPractitioner = new Map<string, number>();
    const rejectedDocumentsByPractitioner = new Map<string, number>();
    const caseToPractitioner = new Map<string, string>();
    const clientToPractitioner = new Map<string, string>();

    for (const clientRow of clientAssignmentRows ?? []) {
      if (!clientRow.assigned_consultant_id) continue;

      clientToPractitioner.set(clientRow.id, clientRow.assigned_consultant_id);
      const current =
        assignedClientIdsByPractitioner.get(clientRow.assigned_consultant_id) ??
        new Set<string>();
      current.add(clientRow.id);
      assignedClientIdsByPractitioner.set(
        clientRow.assigned_consultant_id,
        current,
      );
    }

    for (const caseRow of caseAssignmentRows ?? []) {
      if (!caseRow.assigned_consultant_id) continue;

      caseToPractitioner.set(caseRow.id, caseRow.assigned_consultant_id);

      if (!["resolved", "closed"].includes(caseRow.status)) {
        activeCaseCountByPractitioner.set(
          caseRow.assigned_consultant_id,
          (activeCaseCountByPractitioner.get(caseRow.assigned_consultant_id) ??
            0) + 1,
        );
      }
    }

    for (const documentRow of documentAttentionRows ?? []) {
      const practitionerId =
        (documentRow.case_id
          ? caseToPractitioner.get(documentRow.case_id)
          : null) ||
        (documentRow.client_id
          ? clientToPractitioner.get(documentRow.client_id)
          : null);

      if (!practitionerId) continue;

      if (documentRow.status === "rejected") {
        rejectedDocumentsByPractitioner.set(
          practitionerId,
          (rejectedDocumentsByPractitioner.get(practitionerId) ?? 0) + 1,
        );
        continue;
      }

      if (["uploaded", "pending_review"].includes(documentRow.status)) {
        outstandingDocumentsByPractitioner.set(
          practitionerId,
          (outstandingDocumentsByPractitioner.get(practitionerId) ?? 0) + 1,
        );
      }
    }

    return new Map(
      consultantIds.map((consultantId) => [
        consultantId,
        {
          assignedClientCount:
            assignedClientIdsByPractitioner.get(consultantId)?.size ?? 0,
          activeCaseCount: activeCaseCountByPractitioner.get(consultantId) ?? 0,
          outstandingDocumentsCount:
            outstandingDocumentsByPractitioner.get(consultantId) ?? 0,
          rejectedDocumentsCount:
            rejectedDocumentsByPractitioner.get(consultantId) ?? 0,
        },
      ]),
    );
  }, [
    caseAssignmentRows,
    clientAssignmentRows,
    consultantIds,
    documentAttentionRows,
  ]);

  const staffCards = useMemo(() => {
    return (staffUsers ?? []).map((staffUser) => {
      const role = staffUser.role as StaffRole;
      const practitionerProfile =
        role === "consultant"
          ? (practitionerProfileMap.get(staffUser.id) ?? null)
          : null;
      const practitionerStats = practitionerStatsMap.get(staffUser.id);
      const isVerified =
        role === "consultant" && Boolean(practitionerProfile?.is_verified);
      const isIncompleteProfile =
        role === "consultant" &&
        isPractitionerProfileIncomplete(practitionerProfile);
      const availabilityStatus =
        role === "consultant"
          ? (practitionerProfile?.availability_status ?? "not_available")
          : null;
      const outstandingDocumentsCount =
        practitionerStats?.outstandingDocumentsCount ?? 0;
      const rejectedDocumentsCount =
        practitionerStats?.rejectedDocumentsCount ?? 0;
      const activeCaseCount = practitionerStats?.activeCaseCount ?? 0;
      const assignedClientCount = practitionerStats?.assignedClientCount ?? 0;
      const needsAttention =
        role === "consultant" &&
        (!staffUser.is_active ||
          !isVerified ||
          isIncompleteProfile ||
          outstandingDocumentsCount > 0 ||
          rejectedDocumentsCount > 0);
      const isReadyForWork =
        role === "consultant" &&
        staffUser.is_active &&
        isVerified &&
        !isIncompleteProfile &&
        availabilityStatus === "available";

      return {
        staffUser,
        role,
        practitionerProfile,
        isVerified,
        isIncompleteProfile,
        outstandingDocumentsCount,
        rejectedDocumentsCount,
        activeCaseCount,
        assignedClientCount,
        availabilityStatus,
        registrationNumber: practitionerProfile?.registration_number || "",
        businessName: practitionerProfile?.business_name || "",
        businessType: practitionerProfile?.business_type === "company" ? "company" : "individual",
        needsAttention,
        isReadyForWork,
      } satisfies StaffCardRecord;
    });
  }, [practitionerProfileMap, practitionerStatsMap, staffUsers]);

  const hasActiveFilters = [
    searchQuery.trim(),
    roleFilter,
    verificationFilter,
    documentFilter,
    activityFilter,
    availabilityFilter,
    sortOption,
  ].some((value) => value && value !== "all" && value !== "newest");

  const filteredStaffCards = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    const rows = staffCards.filter((card) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          card.staffUser.full_name || "",
          card.staffUser.email || "",
          card.staffUser.phone || "",
          card.role,
          getRoleLabel(card.role),
          card.registrationNumber,
          card.businessName,
          card.businessType === "company"
            ? "registered company firm"
            : "individual sole proprietor",
          card.isVerified
            ? "verified verified practitioner"
            : "not verified unverified missing verification",
          card.availabilityStatus
            ? formatAvailabilityLabel(card.availabilityStatus)
            : "",
        ].some((value) => value.toLowerCase().includes(normalizedSearch));

      const matchesRole = roleFilter === "all" || card.role === roleFilter;
      const matchesActivity =
        activityFilter === "all" ||
        (activityFilter === "active"
          ? card.staffUser.is_active
          : !card.staffUser.is_active);
      const matchesVerification =
        verificationFilter === "all" ||
        (card.role === "consultant" &&
          ((verificationFilter === "verified" && card.isVerified) ||
            (verificationFilter === "not_verified" && !card.isVerified)));
      const matchesAvailability =
        availabilityFilter === "all" ||
        (card.role === "consultant" &&
          card.availabilityStatus === availabilityFilter);
      const matchesDocuments =
        documentFilter === "all" ||
        (card.role === "consultant" &&
          ((documentFilter === "outstanding" &&
            card.outstandingDocumentsCount > 0) ||
            (documentFilter === "rejected" &&
              card.rejectedDocumentsCount > 0) ||
            (documentFilter === "attention" &&
              (card.outstandingDocumentsCount > 0 ||
                card.rejectedDocumentsCount > 0)) ||
            (documentFilter === "clean" &&
              card.outstandingDocumentsCount === 0 &&
              card.rejectedDocumentsCount === 0)));

      return (
        matchesSearch &&
        matchesRole &&
        matchesActivity &&
        matchesVerification &&
        matchesAvailability &&
        matchesDocuments
      );
    });

    rows.sort((left, right) => {
      switch (sortOption) {
        case "oldest":
          return (
            new Date(left.staffUser.created_at).getTime() -
            new Date(right.staffUser.created_at).getTime()
          );
        case "workload_high":
          return (
            right.activeCaseCount - left.activeCaseCount ||
            right.assignedClientCount - left.assignedClientCount ||
            (left.staffUser.full_name || "").localeCompare(
              right.staffUser.full_name || "",
            )
          );
        case "workload_low":
          return (
            left.activeCaseCount - right.activeCaseCount ||
            left.assignedClientCount - right.assignedClientCount ||
            (left.staffUser.full_name || "").localeCompare(
              right.staffUser.full_name || "",
            )
          );
        default:
          return (
            new Date(right.staffUser.created_at).getTime() -
            new Date(left.staffUser.created_at).getTime()
          );
      }
    });

    return rows;
  }, [
    activityFilter,
    availabilityFilter,
    documentFilter,
    roleFilter,
    searchQuery,
    sortOption,
    staffCards,
    verificationFilter,
  ]);

  const selectedStaffCard =
    filteredStaffCards.find((card) => card.staffUser.id === selectedStaffId) ||
    staffCards.find((card) => card.staffUser.id === selectedStaffId) ||
    null;

  const startPractitionerConversation = async (card: StaffCardRecord) => {
    if (!user) {
      toast.error("Please sign in again to start a conversation.");
      return;
    }

    if (card.role !== "consultant") {
      toast.error(
        "Only practitioner profiles can receive practitioner conversations.",
      );
      return;
    }

    if (startingConversationId === card.staffUser.id) return;
    setStartingConversationId(card.staffUser.id);

    const practitionerName =
      card.staffUser.full_name || card.staffUser.email || "Practitioner";

    const { data: existingConversation, error: existingError } = await supabase
      .from("conversations")
      .select("id")
      .eq("practitioner_profile_id", card.staffUser.id)
      .is("client_id", null)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      toast.error(existingError.message);
      setStartingConversationId(null);
      return;
    }

    let conversationId = existingConversation?.id ?? "";

    if (!conversationId) {
      const { data: createdConversation, error: createError } = await supabase
        .from("conversations")
        .insert({
          practitioner_profile_id: card.staffUser.id,
          subject: `Practitioner Support: ${practitionerName}`,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (createError) {
        toast.error(createError.message);
        setStartingConversationId(null);
        return;
      }

      conversationId = createdConversation.id;
    }

    await queryClient.invalidateQueries({ queryKey: ["staff-conversations"] });
    setStartingConversationId(null);
    navigate(`/dashboard/staff/messages?conversationId=${conversationId}`);
  };

  const selectedStaffUser = selectedStaffCard?.staffUser ?? null;

  const { data: selectedPermissionRow } = useQuery({
    queryKey: ["staff-user-permissions", selectedStaffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_permissions")
        .select("*")
        .eq("profile_id", selectedStaffId!)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as StaffPermissionRow | null;
    },
    enabled: !!selectedStaffId,
  });

  const { data: selectedPractitionerProfile } = useQuery({
    queryKey: ["staff-user-practitioner-profile", selectedStaffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_profiles")
        .select("*")
        .eq("profile_id", selectedStaffId!)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as PractitionerProfile | null;
    },
    enabled: !!selectedStaffId,
  });

  const { data: selectedPractitionerCreditAccount } = useQuery({
    queryKey: ["staff-user-credit-account", selectedStaffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practitioner_credit_accounts")
        .select("*")
        .eq("profile_id", selectedStaffId!)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as any;
    },
    enabled: !!selectedStaffId,
  });

  useEffect(() => {
    if (!selectedStaffUser) {
      setEditForm(initialEditForm);
      setEditPermissions(defaultConsultantPermissions);
      setEditPractitionerProfile(initialPractitionerProfileForm);
      return;
    }

    setEditForm({
      fullName: selectedStaffUser.full_name || "",
      phone: selectedStaffUser.phone || "",
      role: selectedStaffUser.role as StaffRole,
      isActive: selectedStaffUser.is_active,
    });
  }, [selectedStaffUser]);

  useEffect(() => {
    if (!selectedStaffUser) return;
    setEditPermissions(
      getPermissionPreset(
        selectedStaffUser.role as StaffRole,
        selectedPermissionRow,
      ),
    );
  }, [selectedPermissionRow, selectedStaffUser]);

  useEffect(() => {
    if (!createForm.fullName.trim()) return;
    setCreatePractitionerProfile((current) =>
      current.bankAccountHolderName.trim()
        ? current
        : { ...current, bankAccountHolderName: createForm.fullName.trim() },
    );
  }, [createForm.fullName]);

  useEffect(() => {
    if (!selectedStaffUser || selectedStaffUser.role !== "consultant") {
      setEditPractitionerProfile(initialPractitionerProfileForm);
      return;
    }

    setEditPractitionerProfile({
      businessType:
        selectedPractitionerProfile?.business_type === "company"
          ? "company"
          : "individual",
      businessName: selectedPractitionerProfile?.business_name || "",
      registrationNumber:
        selectedPractitionerProfile?.registration_number || "",
      professionalTitle: selectedPractitionerProfile?.professional_title || "",
      profileSummary: selectedPractitionerProfile?.profile_summary || "",
      languagesSpoken: (selectedPractitionerProfile?.languages_spoken ?? []).join(", "),
      showRegistrationNumber: selectedPractitionerProfile?.show_registration_number ?? false,
      yearsOfExperience: String(
        selectedPractitionerProfile?.years_of_experience ?? 0,
      ),
      availabilityStatus:
        selectedPractitionerProfile?.availability_status ?? "available",
      isVerified: selectedPractitionerProfile?.is_verified ?? false,
      internalNotes: selectedPractitionerProfile?.internal_notes || "",
      servicesOffered: selectedPractitionerProfile?.services_offered ?? [],
      bankAccountHolderName:
        selectedPractitionerProfile?.bank_account_holder_name ||
        selectedStaffUser.full_name ||
        "",
      bankName: selectedPractitionerProfile?.bank_name || "",
      bankBranchName: selectedPractitionerProfile?.bank_branch_name || "",
      bankBranchCode: selectedPractitionerProfile?.bank_branch_code || "",
      bankAccountNumber: selectedPractitionerProfile?.bank_account_number || "",
      bankAccountType: selectedPractitionerProfile?.bank_account_type || "",
      isVatRegistered:
        selectedPractitionerProfile?.is_vat_registered ??
        Boolean(selectedPractitionerProfile?.vat_number),
      vatNumber: selectedPractitionerProfile?.vat_number || "",
    });
  }, [selectedPractitionerProfile, selectedStaffUser]);

  const adminCount = staffCards.filter((card) => card.role === "admin").length;
  const practitionerCards = staffCards.filter(
    (card) => card.role === "consultant",
  );
  const consultantCount = practitionerCards.length;
  const activeCount = staffCards.filter(
    (card) => card.staffUser.is_active,
  ).length;
  const verifiedPractitionerCount = practitionerCards.filter(
    (card) => card.isVerified,
  ).length;
  const readyPractitionerCount = practitionerCards.filter(
    (card) => card.isReadyForWork,
  ).length;
  const attentionPractitionerCount = practitionerCards.filter(
    (card) => card.needsAttention,
  ).length;

  const resetCreateForm = () => {
    setCreateForm(initialCreateForm);
    setCreatePermissions(defaultConsultantPermissions);
    setCreatePractitionerProfile(initialPractitionerProfileForm);
    setIsCreating(false);
  };

  const handleCreatePermissionToggle = (
    key: keyof StaffPermissionValues,
    value: boolean,
  ) => {
    setCreatePermissions((current) =>
      sanitizeStaffPermissions({ ...current, [key]: value }),
    );
  };

  const handleEditPermissionToggle = (
    key: keyof StaffPermissionValues,
    value: boolean,
  ) => {
    setEditPermissions((current) =>
      sanitizeStaffPermissions({ ...current, [key]: value }),
    );
  };

  const upsertPractitionerProfile = async (
    profileId: string,
    values: PractitionerProfileFormState,
  ) => {
    const yearsOfExperience = Number(values.yearsOfExperience || 0);

    const { error } = await supabase.from("practitioner_profiles").upsert({
      profile_id: profileId,
      business_type: values.businessType,
      business_name:
        values.businessType === "company" ? values.businessName.trim() || null : null,
      registration_number:
        values.businessType === "company" ? values.registrationNumber.trim() || null : null,
      professional_title: values.professionalTitle.trim() || null,
      profile_summary: values.profileSummary.trim() || null,
      languages_spoken: values.languagesSpoken
        .split(",")
        .map((language) => language.trim())
        .filter(Boolean),
      show_registration_number: values.showRegistrationNumber,
      years_of_experience: Number.isNaN(yearsOfExperience)
        ? 0
        : Math.max(0, yearsOfExperience),
      availability_status: values.availabilityStatus,
      is_verified: values.isVerified,
      internal_notes: values.internalNotes.trim() || null,
      services_offered: normalizeServicesOffered(values.servicesOffered),
      bank_account_holder_name: values.bankAccountHolderName.trim() || null,
      bank_name: values.bankName.trim() || null,
      bank_branch_name: values.bankBranchName.trim() || null,
      bank_branch_code: values.bankBranchCode.trim() || null,
      bank_account_number: values.bankAccountNumber.trim() || null,
      bank_account_type: values.bankAccountType.trim() || null,
      is_vat_registered: values.isVatRegistered,
      vat_number: values.isVatRegistered ? values.vatNumber.trim() || null : null,
    });

    return error;
  };

  const createStaffUser = async () => {
    const email = createForm.email.trim().toLowerCase();

    if (!createForm.fullName.trim() || !email || !createForm.password.trim()) {
      toast.error("Full name, email, password, and role are required.");
      return;
    }

    if (createForm.password.trim().length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }

    setIsCreating(true);

    const { data, error } = await supabase.functions.invoke(
      "create-staff-user",
      {
        body: {
          fullName: createForm.fullName.trim(),
          email,
          phone: createForm.phone.trim(),
          password: createForm.password,
          role: createForm.role,
          permissions:
            createForm.role === "admin"
              ? fullStaffPermissions
              : sanitizeStaffPermissions(createPermissions),
        },
      },
    );

    if (error || data?.error) {
      toast.error(
        data?.error || error?.message || "Unable to create the staff user.",
      );
      setIsCreating(false);
      return;
    }

    if (createForm.role === "consultant" && data?.user?.id) {
      const practitionerError = await upsertPractitionerProfile(
        data.user.id,
        createPractitionerProfile,
      );

      if (practitionerError) {
        toast.error(practitionerError.message);
        setIsCreating(false);
        return;
      }
    }

    toast.success(
      `${getRoleLabel(createForm.role)} account created successfully.`,
    );
    setIsCreateOpen(false);
    resetCreateForm();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff-users"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-user-permissions"] }),
      queryClient.invalidateQueries({
        queryKey: ["staff-user-practitioner-profiles"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["staff-user-client-assignments"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["staff-user-case-assignments"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["staff-user-document-attention"],
      }),
    ]);
  };

  const updateStaffUser = async () => {
    if (!selectedStaffUser) return;

    if (!editForm.fullName.trim()) {
      toast.error("Full name is required.");
      return;
    }

    if (selectedStaffUser.id === user?.id && editForm.role !== "admin") {
      toast.error("You cannot remove your own admin access from this screen.");
      return;
    }

    if (selectedStaffUser.id === user?.id && !editForm.isActive) {
      toast.error("You cannot deactivate your own account from this screen.");
      return;
    }

    setIsSaving(true);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: editForm.fullName.trim(),
        phone: editForm.phone.trim() || null,
        role: editForm.role,
        is_active: editForm.isActive,
      })
      .eq("id", selectedStaffUser.id);

    if (profileError) {
      toast.error(profileError.message);
      setIsSaving(false);
      return;
    }

    if (editForm.role === "consultant") {
      const { error: practitionerStatusError } = await supabase
        .from("practitioner_profiles")
        .update({
          verification_status: editForm.isActive
            ? editPractitionerProfile.isVerified
              ? "verified"
              : "pending"
            : "suspended",
        })
        .eq("profile_id", selectedStaffUser.id);

      if (practitionerStatusError) {
        toast.error(practitionerStatusError.message);
        setIsSaving(false);
        return;
      }
    }

    const permissionsToSave =
      editForm.role === "admin"
        ? fullStaffPermissions
        : sanitizeStaffPermissions(editPermissions);

    const { error: permissionError } = await supabase
      .from("staff_permissions")
      .upsert({
        profile_id: selectedStaffUser.id,
        ...permissionsToSave,
      });

    if (permissionError) {
      toast.error(permissionError.message);
      setIsSaving(false);
      return;
    }

    if (editForm.role === "consultant") {
      const practitionerError = await upsertPractitionerProfile(
        selectedStaffUser.id,
        editPractitionerProfile,
      );

      if (practitionerError) {
        toast.error(practitionerError.message);
        setIsSaving(false);
        return;
      }
    }

    toast.success("Staff profile updated.");
    setIsSaving(false);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff-users"] }),
      queryClient.invalidateQueries({
        queryKey: ["staff-user-permissions", selectedStaffUser.id],
      }),
      queryClient.invalidateQueries({
        queryKey: ["staff-user-practitioner-profile", selectedStaffUser.id],
      }),
      queryClient.invalidateQueries({
        queryKey: ["staff-user-practitioner-profiles"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["staff-user-client-assignments"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["staff-user-case-assignments"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["staff-user-document-attention"],
      }),
    ]);
    setSelectedStaffId(null);
  };

  const quickRefreshStaffBoard = async (profileId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff-users"] }),
      queryClient.invalidateQueries({
        queryKey: ["staff-user-practitioner-profiles"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["staff-user-client-assignments"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["staff-user-case-assignments"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["staff-user-document-attention"],
      }),
      ...(profileId
        ? [
            queryClient.invalidateQueries({
              queryKey: ["staff-user-practitioner-profile", profileId],
            }),
            queryClient.invalidateQueries({
              queryKey: ["staff-user-permissions", profileId],
            }),
          ]
        : []),
    ]);
  };

  const verifyPractitioner = async (card: StaffCardRecord) => {
    if (card.role !== "consultant") {
      return;
    }

    setQuickAction({ id: card.staffUser.id, type: "verify" });

    // Check if all required documents are approved
    const { data: docSummary, error: docError } = await supabase
      .from("practitioner_document_summary")
      .select("*")
      .eq("practitioner_profile_id", card.staffUser.id)
      .maybeSingle();

    if (docError) {
      toast.error("Failed to check verification documents");
      setQuickAction({ id: null, type: null });
      return;
    }

    // Check if there are any pending required documents
    if (
      !docSummary ||
      !docSummary.total_required_docs ||
      docSummary.approved_required_docs !== docSummary.total_required_docs
    ) {
      toast.error(
        "All required verification documents must be approved before marking practitioner as verified.",
      );
      setQuickAction({ id: null, type: null });
      return;
    }

    const { error } = await supabase.from("practitioner_profiles").upsert({
      profile_id: card.staffUser.id,
      business_name: card.practitionerProfile?.business_name ?? null,
      registration_number:
        card.practitionerProfile?.registration_number ?? null,
      years_of_experience: card.practitionerProfile?.years_of_experience ?? 0,
      availability_status:
        card.practitionerProfile?.availability_status ?? "available",
      is_verified: true,
      verification_status: "verified",
      internal_notes: card.practitionerProfile?.internal_notes ?? null,
      services_offered: card.practitionerProfile?.services_offered ?? [],
    });

    if (error) {
      toast.error(error.message);
      setQuickAction({ id: null, type: null });
      return;
    }

    const { error: activationError } = await supabase
      .from("profiles")
      .update({ is_active: true })
      .eq("id", card.staffUser.id)
      .eq("role", "consultant");

    if (activationError) {
      toast.error(activationError.message);
      setQuickAction({ id: null, type: null });
      return;
    }

    toast.success("Practitioner verified.");
    setQuickAction({ id: null, type: null });
    await quickRefreshStaffBoard(card.staffUser.id);
  };

  const verifyPractitionerBanking = async (
    profileId: string,
    practitionerProfile?: PractitionerProfile | null,
  ) => {
    if (!hasCompleteBankingDetails(practitionerProfile)) {
      toast.error(
        "Complete banking details are required before admin can verify them.",
      );
      return;
    }

    setQuickAction({ id: profileId, type: "verify-banking" });

    const { error } = await supabase
      .from("practitioner_profiles")
      .update({
        banking_verification_status: "verified",
        banking_verified_at: new Date().toISOString(),
        banking_verified_by: user?.id ?? null,
      })
      .eq("profile_id", profileId);

    if (error) {
      toast.error(error.message);
      setQuickAction({ id: null, type: null });
      return;
    }

    toast.success("Practitioner banking details verified.");
    setQuickAction({ id: null, type: null });
    await quickRefreshStaffBoard(profileId);
  };

  const toggleStaffActiveState = async (card: StaffCardRecord) => {
    if (card.staffUser.id === user?.id && card.staffUser.is_active) {
      toast.error("You cannot suspend your own account from this page.");
      return;
    }

    setQuickAction({ id: card.staffUser.id, type: "toggle-active" });

    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !card.staffUser.is_active })
      .eq("id", card.staffUser.id);

    if (error) {
      toast.error(error.message);
      setQuickAction({ id: null, type: null });
      return;
    }

    if (card.role === "consultant") {
      const nextIsActive = !card.staffUser.is_active;
      const { error: practitionerStatusError } = await supabase
        .from("practitioner_profiles")
        .update({
          verification_status: nextIsActive
            ? card.isVerified
              ? "verified"
              : "pending"
            : "suspended",
        })
        .eq("profile_id", card.staffUser.id);

      if (practitionerStatusError) {
        toast.error(practitionerStatusError.message);
        setQuickAction({ id: null, type: null });
        return;
      }
    }

    toast.success(
      card.staffUser.is_active
        ? "Staff account suspended."
        : "Staff account activated.",
    );
    setQuickAction({ id: null, type: null });
    await quickRefreshStaffBoard(card.staffUser.id);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
    setVerificationFilter("all");
    setDocumentFilter("all");
    setActivityFilter("all");
    setAvailabilityFilter("all");
    setSortOption("newest");
  };

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 font-display text-2xl font-bold text-foreground">
            Staff Users
          </h1>
          <p className="text-sm text-muted-foreground font-body">
            Manage Acapolite admins and practitioners from one control view,
            including verification, workload, document pressure, and readiness
            for new work.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            className="rounded-xl"
            onClick={() => setIsCreateOpen(true)}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add Staff User
          </Button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-[1.5fr_repeat(5,minmax(0,180px))]">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
            Practitioner Control
          </p>
          <h2 className="mt-3 font-display text-lg font-semibold text-foreground">
            One view for verification, workload, and risk
          </h2>
          <p className="mt-2 text-sm text-muted-foreground font-body">
            Quickly see which practitioners are verified, which ones still have
            document issues, and who is ready to take on more work.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
            Admins
          </p>
          <p className="mt-3 font-display text-3xl text-foreground">
            {adminCount}
          </p>
          <p className="mt-1 text-sm text-muted-foreground font-body">
            Full platform managers
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
            Practitioners
          </p>
          <p className="mt-3 font-display text-3xl text-foreground">
            {consultantCount}
          </p>
          <p className="mt-1 text-sm text-muted-foreground font-body">
            Marketplace practitioner accounts
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
            Verified
          </p>
          <p className="mt-3 font-display text-3xl text-foreground">
            {verifiedPractitionerCount}
          </p>
          <p className="mt-1 text-sm text-muted-foreground font-body">
            Practitioners ready for trust checks
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
            Needs Attention
          </p>
          <p className="mt-3 font-display text-3xl text-red-700">
            {attentionPractitionerCount}
          </p>
          <p className="mt-1 text-sm text-muted-foreground font-body">
            Verification, profile, or document issues
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
            Ready For Work
          </p>
          <p className="mt-3 font-display text-3xl text-emerald-700">
            {readyPractitionerCount}
          </p>
          <p className="mt-1 text-sm text-muted-foreground font-body">
            Active, verified, complete, available
          </p>
        </div>
      </div>

      <div className="mb-8 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search name, email, phone, registration number, role, or verification..."
              className="rounded-xl pl-9"
            />
          </div>
          <Select
            value={roleFilter}
            onValueChange={(value) => setRoleFilter(value as "all" | StaffRole)}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="consultant">Practitioners</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={verificationFilter}
            onValueChange={(value) =>
              setVerificationFilter(
                value as "all" | "verified" | "not_verified",
              )
            }
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="All verification" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All verification states</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="not_verified">Not verified</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={documentFilter}
            onValueChange={(value) =>
              setDocumentFilter(
                value as
                  | "all"
                  | "outstanding"
                  | "rejected"
                  | "attention"
                  | "clean",
              )
            }
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="All document states" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All document states</SelectItem>
              <SelectItem value="outstanding">Outstanding documents</SelectItem>
              <SelectItem value="rejected">Rejected documents</SelectItem>
              <SelectItem value="attention">Any document issue</SelectItem>
              <SelectItem value="clean">No document issues</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={activityFilter}
            onValueChange={(value) =>
              setActivityFilter(value as "all" | "active" | "inactive")
            }
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="All activity states" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Active and inactive</SelectItem>
              <SelectItem value="active">Active only</SelectItem>
              <SelectItem value="inactive">Inactive only</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={availabilityFilter}
            onValueChange={(value) =>
              setAvailabilityFilter(value as "all" | PractitionerAvailability)
            }
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="All availability" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All availability states</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="limited">Limited</SelectItem>
              <SelectItem value="not_available">Not Available</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sortOption}
            onValueChange={(value) =>
              setSortOption(
                value as "newest" | "oldest" | "workload_high" | "workload_low",
              )
            }
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Newest first" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="workload_high">Highest workload</SelectItem>
              <SelectItem value="workload_low">Lowest workload</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground font-body">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {filteredStaffCards.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-foreground">
              {staffCards.length}
            </span>{" "}
            staff users
            <span className="mx-2 text-border">|</span>
            <span className="font-semibold text-foreground">
              {activeCount}
            </span>{" "}
            active
          </p>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
          >
            Clear Filters
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground font-body">Loading...</div>
      ) : filteredStaffCards.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredStaffCards.map((card) => {
            const { staffUser, role } = card;
            const isCurrentUser = staffUser.id === user?.id;
            const isPractitioner = role === "consultant";
            const isQuickVerifying =
              quickAction.id === staffUser.id && quickAction.type === "verify";
            const isQuickToggling =
              quickAction.id === staffUser.id &&
              quickAction.type === "toggle-active";

            return (
              <div
                key={staffUser.id}
                className={`rounded-2xl border bg-card p-5 shadow-card transition-all hover:shadow-elevated ${
                  card.needsAttention
                    ? "border-amber-200"
                    : "border-border hover:border-primary/25"
                }`}
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate font-display text-lg font-semibold text-foreground">
                          {staffUser.full_name ||
                            staffUser.email ||
                            "Staff user"}
                        </h2>
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getRoleBadgeClass(role)}`}
                        >
                          {getRoleLabel(role)}
                        </span>
                        {isPractitioner ? (
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getVerificationBadgeClass(card.isVerified)}`}
                          >
                            {card.isVerified
                              ? "Verified Practitioner"
                              : "Not Verified"}
                          </span>
                        ) : null}
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getActivityBadgeClass(staffUser.is_active)}`}
                        >
                          {staffUser.is_active ? "Active" : "Inactive"}
                        </span>
                        {isCurrentUser ? (
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                            You
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 truncate text-sm text-muted-foreground font-body">
                        {staffUser.email || "No email"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground font-body">
                        {staffUser.phone || "No phone number added"}
                      </p>
                      {isPractitioner ? (
                        <p className="mt-1 text-sm text-muted-foreground font-body">
                          {card.businessType === "company"
                            ? `${card.businessName || "No company / firm name"} | ${
                                card.registrationNumber || "No registration number"
                              }`
                            : "Individual Practitioner (Sole Proprietor)"}
                        </p>
                      ) : null}
                    </div>

                    {isPractitioner && card.availabilityStatus ? (
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getAvailabilityBadgeClass(card.availabilityStatus)}`}
                      >
                        {formatAvailabilityLabel(card.availabilityStatus)}
                      </span>
                    ) : null}
                  </div>

                  {isPractitioner ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-border bg-accent/30 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
                            Active Cases
                          </p>
                          <p className="mt-2 text-lg font-semibold text-foreground font-body">
                            {card.activeCaseCount}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground font-body">
                            {getWorkloadLabel(card.activeCaseCount)} workload
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border bg-accent/30 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
                            Assigned Clients
                          </p>
                          <p className="mt-2 text-lg font-semibold text-foreground font-body">
                            {card.assignedClientCount}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground font-body">
                            Linked client accounts
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border bg-accent/30 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
                            Outstanding Docs
                          </p>
                          <p
                            className={`mt-2 text-lg font-semibold font-body ${card.outstandingDocumentsCount > 0 ? "text-amber-700" : "text-foreground"}`}
                          >
                            {card.outstandingDocumentsCount}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground font-body">
                            Uploaded or pending review
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border bg-accent/30 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
                            Rejected Docs
                          </p>
                          <p
                            className={`mt-2 text-lg font-semibold font-body ${card.rejectedDocumentsCount > 0 ? "text-red-700" : "text-foreground"}`}
                          >
                            {card.rejectedDocumentsCount}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground font-body">
                            Need attention or rework
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {card.isReadyForWork ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Ready to receive work
                          </span>
                        ) : null}
                        {!card.isVerified ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                            <BadgeCheck className="h-3.5 w-3.5" />
                            Missing verification
                          </span>
                        ) : null}
                        {card.isIncompleteProfile ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                            <Clock3 className="h-3.5 w-3.5" />
                            Incomplete profile
                          </span>
                        ) : null}
                        {!staffUser.is_active ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                            <UserX className="h-3.5 w-3.5" />
                            Suspended / inactive
                          </span>
                        ) : null}
                        {card.outstandingDocumentsCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                            <FileWarning className="h-3.5 w-3.5" />
                            Outstanding documents
                          </span>
                        ) : null}
                        {card.rejectedDocumentsCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Rejected documents
                          </span>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-border bg-accent/30 p-4">
                      <p className="text-sm text-muted-foreground font-body">
                        {getRoleDescription(role)}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 border-t border-border pt-4">
                    {isPractitioner && !card.isVerified ? (
                      <Button
                        type="button"
                        className="rounded-xl"
                        onClick={() => void verifyPractitioner(card)}
                        disabled={isQuickVerifying}
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        {isQuickVerifying
                          ? "Verifying..."
                          : "Verify Practitioner"}
                      </Button>
                    ) : null}

                    {isPractitioner ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() =>
                          void verifyPractitionerBanking(
                            card.staffUser.id,
                            card.practitionerProfile,
                          )
                        }
                        disabled={
                          quickAction.id === card.staffUser.id &&
                          quickAction.type === "verify-banking"
                        }
                      >
                        <BadgeCheck className="mr-2 h-4 w-4" />
                        {quickAction.id === card.staffUser.id &&
                        quickAction.type === "verify-banking"
                          ? "Verifying Banking..."
                          : "Verify Banking"}
                      </Button>
                    ) : null}

                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => void toggleStaffActiveState(card)}
                      disabled={isQuickToggling}
                    >
                      {staffUser.is_active ? (
                        <UserX className="mr-2 h-4 w-4" />
                      ) : (
                        <UserCheck className="mr-2 h-4 w-4" />
                      )}
                      {isQuickToggling
                        ? "Saving..."
                        : staffUser.is_active
                          ? "Suspend"
                          : "Activate"}
                    </Button>

                    {isPractitioner ? (
                      card.outstandingDocumentsCount > 0 ||
                      card.rejectedDocumentsCount > 0 ? (
                        <Button
                          asChild
                          variant="outline"
                          className="rounded-xl"
                        >
                          <Link
                            to={`/dashboard/staff/documents?practitionerId=${staffUser.id}&documentState=attention`}
                          >
                            <FileWarning className="mr-2 h-4 w-4" />
                            View Outstanding Docs
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl"
                          disabled
                        >
                          <FileWarning className="mr-2 h-4 w-4" />
                          View Outstanding Docs
                        </Button>
                      )
                    ) : null}

                    {isPractitioner ? (
                      card.assignedClientCount > 0 ? (
                        <Button
                          asChild
                          variant="outline"
                          className="rounded-xl"
                        >
                          <Link
                            to={`/dashboard/staff/clients?practitionerId=${staffUser.id}`}
                          >
                            <Users className="mr-2 h-4 w-4" />
                            Open Assigned Clients
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl"
                          disabled
                        >
                          <Users className="mr-2 h-4 w-4" />
                          Open Assigned Clients
                        </Button>
                      )
                    ) : null}

                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-xl"
                      onClick={() => setSelectedStaffId(staffUser.id)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Open Profile
                    </Button>

                    {isPractitioner ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => void startPractitionerConversation(card)}
                        disabled={startingConversationId === staffUser.id}
                      >
                        <Users className="mr-2 h-4 w-4" />
                        {startingConversationId === staffUser.id
                          ? "Opening Chat..."
                          : "Start Chat"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-card">
          <p className="text-muted-foreground font-body">
            {hasActiveFilters
              ? "No staff users matched the current filters."
              : "No admin or practitioner users found yet."}
          </p>
        </div>
      )}

      <DashboardItemDialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetCreateForm();
        }}
        title="Add Staff User"
        description="Create a real login account for a new admin or practitioner, then define practitioner restrictions before they sign in."
      >
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-accent/30 p-4">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground font-body">
                  Secure staff account creation
                </p>
                <p className="mt-1 text-sm text-muted-foreground font-body">
                  This creates the auth user, stores the chosen role in the
                  profile, and saves practitioner permissions at the same time.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">
                Full Name
              </label>
              <Input
                value={createForm.fullName}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    fullName: event.target.value,
                  }))
                }
                placeholder="Example: Sarah Naidoo"
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">
                Email
              </label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                placeholder="staff@acapolite.com"
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">
                Phone
              </label>
              <Input
                value={createForm.phone}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                placeholder="+27 ..."
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">
                Password
              </label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder="At least 8 characters"
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">
                Role
              </label>
              <Select
                value={createForm.role}
                onValueChange={(value) =>
                  setCreateForm((current) => ({
                    ...current,
                    role: value as StaffRole,
                  }))
                }
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultant">Practitioner</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-2xl border border-border p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
              Selected Role
            </p>
            <p className="mt-2 font-display text-lg text-foreground">
              {getRoleLabel(createForm.role)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground font-body">
              {getRoleDescription(createForm.role)}
            </p>
          </div>

          <PermissionEditor
            role={createForm.role}
            permissions={
              createForm.role === "admin"
                ? fullStaffPermissions
                : createPermissions
            }
            onToggle={handleCreatePermissionToggle}
          />

          {createForm.role === "consultant" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
                  Practitioner Profile Setup
                </p>
                <p className="mt-2 text-sm text-muted-foreground font-body">
                  Set up the practitioner profile that clients will see when
                  this practitioner responds to marketplace leads.
                </p>
              </div>
              <PractitionerProfileFields
                value={createPractitionerProfile}
                onChange={setCreatePractitionerProfile}
              />
            </div>
          ) : null}

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
            <Button
              type="button"
              className="rounded-xl"
              onClick={createStaffUser}
              disabled={isCreating}
            >
              {isCreating ? "Creating..." : "Create Staff User"}
            </Button>
          </div>
        </div>
      </DashboardItemDialog>

      <DashboardItemDialog
        open={!!selectedStaffUser}
        onOpenChange={(open) => {
          if (!open) setSelectedStaffId(null);
        }}
        title={
          selectedStaffUser?.full_name ||
          selectedStaffUser?.email ||
          "Staff Member"
        }
        description="Review and update this staff profile. Practitioner page access, action rights, and client scope are controlled here."
      >
        {selectedStaffUser ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
                  Email
                </p>
                <p className="mt-2 break-all text-sm text-foreground font-body">
                  {selectedStaffUser.email || "No email"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
                  Created
                </p>
                <p className="mt-2 text-sm text-foreground font-body">
                  {new Date(selectedStaffUser.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">
                  Full Name
                </label>
                <Input
                  value={editForm.fullName}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      fullName: event.target.value,
                    }))
                  }
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">
                  Phone
                </label>
                <Input
                  value={editForm.phone}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="+27 ..."
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">
                  Role
                </label>
                <Select
                  value={editForm.role}
                  onValueChange={(value) => {
                    const nextRole = value as StaffRole;
                    setEditForm((current) => ({ ...current, role: nextRole }));
                    setEditPermissions(
                      getPermissionPreset(
                        nextRole,
                        nextRole === "admin"
                          ? fullStaffPermissions
                          : selectedPermissionRow,
                      ),
                    );
                  }}
                >
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultant">Practitioner</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground font-body">
                    Profile Active
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground font-body">
                    Use this flag to mark internal staff accounts active or
                    inactive inside the portal.
                  </p>
                </div>
                <Switch
                  checked={editForm.isActive}
                  onCheckedChange={(checked) =>
                    setEditForm((current) => ({
                      ...current,
                      isActive: checked,
                    }))
                  }
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
                Access Summary
              </p>
              <p className="mt-2 font-display text-lg text-foreground">
                {getRoleLabel(editForm.role)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground font-body">
                {getRoleDescription(editForm.role)}
              </p>
            </div>

            <PermissionEditor
              role={editForm.role}
              permissions={
                editForm.role === "admin"
                  ? fullStaffPermissions
                  : editPermissions
              }
              onToggle={handleEditPermissionToggle}
            />

            {editForm.role === "consultant" ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
                    Practitioner Profile
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground font-body">
                    Update public practitioner details, verification status,
                    availability, services, and internal notes.
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-emerald-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-emerald-700 font-body font-semibold">
                        Verification Status
                      </p>
                      <p className="mt-2 text-sm text-emerald-700 font-body">
                        Mark this practitioner as verified once all required
                        documents are approved and profile is complete.
                      </p>
                    </div>
                    <Badge
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        selectedPractitionerProfile?.is_verified
                          ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                          : "border-amber-300 bg-amber-100 text-amber-700"
                      }`}
                    >
                      {selectedPractitionerProfile?.is_verified
                        ? "Verified"
                        : "Not Verified"}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    className={`mt-3 rounded-lg w-full sm:w-auto ${
                      selectedPractitionerProfile?.is_verified
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                    onClick={async () => {
                      if (!selectedPractitionerProfile) return;
                      setSavingChanges(true);
                      try {
                        const newStatus =
                          !selectedPractitionerProfile.is_verified;
                        const { error } = await supabase
                          .from("practitioner_profiles")
                          .update({
                            is_verified: newStatus,
                            verification_status: newStatus
                              ? "verified"
                              : "pending",
                          })
                          .eq(
                            "profile_id",
                            selectedPractitionerProfile.profile_id,
                          );

                        if (error) throw error;

                        const { error: profileError } = await supabase
                          .from("profiles")
                          .update({ is_active: newStatus })
                          .eq("id", selectedPractitionerProfile.profile_id)
                          .eq("role", "consultant");

                        if (profileError) throw profileError;

                        toast.success(
                          newStatus
                            ? "Practitioner marked as verified"
                            : "Practitioner marked as unverified",
                        );
                        void quickRefreshStaffBoard(
                          selectedPractitionerProfile.profile_id,
                        );
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Failed to update verification status",
                        );
                      } finally {
                        setSavingChanges(false);
                      }
                    }}
                    disabled={savingChanges}
                  >
                    {savingChanges
                      ? "Updating..."
                      : selectedPractitionerProfile?.is_verified
                        ? "Mark as Unverified"
                        : "Mark as Verified"}
                  </Button>
                </div>
                <div className="rounded-2xl border border-border bg-accent/20 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">
                        Banking Verification
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground font-body">
                        Admin must verify practitioner banking details before
                        those details are used for invoices.
                      </p>
                    </div>
                    <Badge
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${getBankingVerificationBadgeClass(selectedPractitionerProfile?.banking_verification_status)}`}
                    >
                      {getBankingVerificationLabel(
                        selectedPractitionerProfile?.banking_verification_status,
                      )}
                    </Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() =>
                        void verifyPractitionerBanking(
                          selectedStaffUser.id,
                          selectedPractitionerProfile,
                        )
                      }
                      disabled={
                        quickAction.id === selectedStaffUser.id &&
                        quickAction.type === "verify-banking"
                      }
                    >
                      <BadgeCheck className="mr-2 h-4 w-4" />
                      {quickAction.id === selectedStaffUser.id &&
                      quickAction.type === "verify-banking"
                        ? "Verifying Banking..."
                        : "Verify Banking Details"}
                    </Button>
                    {!hasCompleteBankingDetails(selectedPractitionerProfile) ? (
                      <p className="text-sm text-amber-700 font-body">
                        Complete the banking fields first before verification.
                      </p>
                    ) : null}
                  </div>
                </div>

                <PractitionerProfileMissingFields
                  profile={selectedPractitionerProfile}
                />

                <PractitionerDocumentsSection
                  practitionerId={selectedStaffUser?.id}
                  isAdmin={true}
                  onDocumentsChange={() => {
                    void quickRefreshStaffBoard(selectedStaffUser?.id);
                  }}
                />

                <AdminCreditControls
                  practitionerId={selectedStaffUser?.id ?? null}
                  creditAccount={selectedPractitionerCreditAccount}
                  isAdmin={true}
                  onCreditsChanged={() => {
                    void quickRefreshStaffBoard(selectedStaffUser?.id);
                  }}
                />

                <CreditHistory practitionerId={selectedStaffUser?.id ?? null} />

                <PractitionerProfileFields
                  value={editPractitionerProfile}
                  onChange={setEditPractitionerProfile}
                />
              </div>
            ) : null}

            <div className="flex justify-end gap-3">
              {selectedStaffUser.role === "consultant" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                  onClick={() => setIsDeletePractitionerOpen(true)}
                  disabled={isSaving}
                >
                  <UserX className="mr-2 h-4 w-4" />
                  Delete Practitioner
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setSelectedStaffId(null)}
                disabled={isSaving}
              >
                Close
              </Button>
              <Button
                type="button"
                className="rounded-xl"
                onClick={updateStaffUser}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Staff Profile"}
              </Button>
            </div>
          </div>
        ) : null}
      </DashboardItemDialog>

      <DeletePlatformUserDialog
        open={isDeletePractitionerOpen && !!selectedStaffUser && selectedStaffUser.role === "consultant"}
        onOpenChange={setIsDeletePractitionerOpen}
        targetProfileId={selectedStaffUser?.role === "consultant" ? selectedStaffUser.id : null}
        titleName={selectedStaffUser?.full_name || selectedStaffUser?.email || "Practitioner"}
        entityLabel="practitioner"
        onDeleted={() => {
          setIsDeletePractitionerOpen(false);
          setSelectedStaffId(null);
          void quickRefreshStaffBoard();
        }}
      />
    </div>
  );
}

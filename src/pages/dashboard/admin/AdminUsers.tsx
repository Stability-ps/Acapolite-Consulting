import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, UserPlus, Search, UserCog, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import type { Enums, Tables } from "@/integrations/supabase/types";
import {
  PractitionerProfileFields,
  type PractitionerProfileFormState,
} from "@/components/dashboard/PractitionerProfileFields";
import { normalizeServicesOffered } from "@/lib/practitionerMarketplace";
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
type StaffProfile = Tables<"profiles">;
type StaffPermissionRow = Tables<"staff_permissions">;
type PractitionerProfile = Tables<"practitioner_profiles">;

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
  businessName: "",
  registrationNumber: "",
  yearsOfExperience: "0",
  availabilityStatus: "available",
  isVerified: false,
  internalNotes: "",
  servicesOffered: [],
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

function getPermissionPreset(role: StaffRole, permissions?: Partial<StaffPermissionValues> | null) {
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
            <p className="text-sm font-semibold text-foreground font-body">Admins always have full access</p>
            <p className="mt-1 text-sm text-muted-foreground font-body">
              Admin accounts ignore practitioner restrictions and can access every staff screen and action automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-accent/30 p-4">
        <p className="text-sm font-semibold text-foreground font-body">Practitioner visibility and action limits</p>
        <p className="mt-1 text-sm text-muted-foreground font-body">
          Choose exactly what this practitioner can open and what actions they can perform.
        </p>
      </div>

      <div className="grid gap-3">
        {consultantPermissionFields.map((field) => (
          <div key={field.key} className="rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground font-body">{field.label}</p>
                <p className="mt-1 text-sm text-muted-foreground font-body">{field.description}</p>
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
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Landing Route</p>
        <p className="mt-2 font-body text-foreground">{getFirstStaffRoute(permissions)}</p>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [createForm, setCreateForm] = useState<CreateStaffFormState>(initialCreateForm);
  const [editForm, setEditForm] = useState<EditStaffFormState>(initialEditForm);
  const [createPermissions, setCreatePermissions] = useState<StaffPermissionValues>(defaultConsultantPermissions);
  const [editPermissions, setEditPermissions] = useState<StaffPermissionValues>(defaultConsultantPermissions);
  const [createPractitionerProfile, setCreatePractitionerProfile] = useState<PractitionerProfileFormState>(initialPractitionerProfileForm);
  const [editPractitionerProfile, setEditPractitionerProfile] = useState<PractitionerProfileFormState>(initialPractitionerProfileForm);

  const { data: staffUsers, isLoading } = useQuery({
    queryKey: ["staff-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, role, is_active, created_at, updated_at")
        .in("role", ["admin", "consultant"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as StaffProfile[];
    },
  });

  const filteredStaffUsers = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    if (!normalizedSearch) {
      return staffUsers ?? [];
    }

    return (staffUsers ?? []).filter((staffUser) => {
      const fullName = (staffUser.full_name || "").toLowerCase();
      const email = (staffUser.email || "").toLowerCase();
      const phone = (staffUser.phone || "").toLowerCase();
      const role = (staffUser.role || "").toLowerCase();

      return (
        fullName.includes(normalizedSearch)
        || email.includes(normalizedSearch)
        || phone.includes(normalizedSearch)
        || role.includes(normalizedSearch)
      );
    });
  }, [searchQuery, staffUsers]);

  const selectedStaffUser = filteredStaffUsers.find((staffUser) => staffUser.id === selectedStaffId)
    || staffUsers?.find((staffUser) => staffUser.id === selectedStaffId)
    || null;

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
    setEditPermissions(getPermissionPreset(selectedStaffUser.role as StaffRole, selectedPermissionRow));
  }, [selectedPermissionRow, selectedStaffUser]);

  useEffect(() => {
    if (!selectedStaffUser || selectedStaffUser.role !== "consultant") {
      setEditPractitionerProfile(initialPractitionerProfileForm);
      return;
    }

    setEditPractitionerProfile({
      businessName: selectedPractitionerProfile?.business_name || "",
      registrationNumber: selectedPractitionerProfile?.registration_number || "",
      yearsOfExperience: String(selectedPractitionerProfile?.years_of_experience ?? 0),
      availabilityStatus: selectedPractitionerProfile?.availability_status ?? "available",
      isVerified: selectedPractitionerProfile?.is_verified ?? false,
      internalNotes: selectedPractitionerProfile?.internal_notes || "",
      servicesOffered: selectedPractitionerProfile?.services_offered ?? [],
    });
  }, [selectedPractitionerProfile, selectedStaffUser]);

  const adminCount = (staffUsers ?? []).filter((staffUser) => staffUser.role === "admin").length;
  const consultantCount = (staffUsers ?? []).filter((staffUser) => staffUser.role === "consultant").length;
  const activeCount = (staffUsers ?? []).filter((staffUser) => staffUser.is_active).length;

  const resetCreateForm = () => {
    setCreateForm(initialCreateForm);
    setCreatePermissions(defaultConsultantPermissions);
    setCreatePractitionerProfile(initialPractitionerProfileForm);
    setIsCreating(false);
  };

  const handleCreatePermissionToggle = (key: keyof StaffPermissionValues, value: boolean) => {
    setCreatePermissions((current) => sanitizeStaffPermissions({ ...current, [key]: value }));
  };

  const handleEditPermissionToggle = (key: keyof StaffPermissionValues, value: boolean) => {
    setEditPermissions((current) => sanitizeStaffPermissions({ ...current, [key]: value }));
  };

  const upsertPractitionerProfile = async (profileId: string, values: PractitionerProfileFormState) => {
    const yearsOfExperience = Number(values.yearsOfExperience || 0);

    const { error } = await supabase
      .from("practitioner_profiles")
      .upsert({
        profile_id: profileId,
        business_name: values.businessName.trim() || null,
        registration_number: values.registrationNumber.trim() || null,
        years_of_experience: Number.isNaN(yearsOfExperience) ? 0 : Math.max(0, yearsOfExperience),
        availability_status: values.availabilityStatus,
        is_verified: values.isVerified,
        internal_notes: values.internalNotes.trim() || null,
        services_offered: normalizeServicesOffered(values.servicesOffered),
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

    const { data, error } = await supabase.functions.invoke("create-staff-user", {
      body: {
        fullName: createForm.fullName.trim(),
        email,
        phone: createForm.phone.trim(),
        password: createForm.password,
        role: createForm.role,
        permissions: createForm.role === "admin" ? fullStaffPermissions : sanitizeStaffPermissions(createPermissions),
      },
    });

    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Unable to create the staff user.");
      setIsCreating(false);
      return;
    }

    if (createForm.role === "consultant" && data?.user?.id) {
      const practitionerError = await upsertPractitionerProfile(data.user.id, createPractitionerProfile);

      if (practitionerError) {
        toast.error(practitionerError.message);
        setIsCreating(false);
        return;
      }
    }

    toast.success(`${getRoleLabel(createForm.role)} account created successfully.`);
    setIsCreateOpen(false);
    resetCreateForm();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff-users"] }),
      queryClient.invalidateQueries({ queryKey: ["staff-user-permissions"] }),
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

    const permissionsToSave = editForm.role === "admin" ? fullStaffPermissions : sanitizeStaffPermissions(editPermissions);

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
      const practitionerError = await upsertPractitionerProfile(selectedStaffUser.id, editPractitionerProfile);

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
      queryClient.invalidateQueries({ queryKey: ["staff-user-permissions", selectedStaffUser.id] }),
      queryClient.invalidateQueries({ queryKey: ["staff-user-practitioner-profile", selectedStaffUser.id] }),
    ]);
    setSelectedStaffId(null);
  };

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 font-display text-2xl font-bold text-foreground">Staff Users</h1>
          <p className="text-sm text-muted-foreground font-body">
            Create Acapolite admin and practitioner accounts, then control exactly what each practitioner can see or do.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" className="rounded-xl" onClick={() => setIsCreateOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Staff User
          </Button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.5fr_repeat(3,minmax(0,180px))]">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Access Control</p>
          <h2 className="mt-3 font-display text-lg font-semibold text-foreground">Staff account management</h2>
          <p className="mt-2 text-sm text-muted-foreground font-body">
            Admins can create login-ready staff accounts, assign roles, and set practitioner visibility, actions, and assigned-client scope.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Admins</p>
          <p className="mt-3 font-display text-3xl text-foreground">{adminCount}</p>
          <p className="mt-1 text-sm text-muted-foreground font-body">Full platform managers</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Practitioners</p>
          <p className="mt-3 font-display text-3xl text-foreground">{consultantCount}</p>
          <p className="mt-1 text-sm text-muted-foreground font-body">Permission-controlled staff</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Active Staff</p>
          <p className="mt-3 font-display text-3xl text-foreground">{activeCount}</p>
          <p className="mt-1 text-sm text-muted-foreground font-body">Profiles currently marked active</p>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search name, email, phone, or role..."
            className="rounded-xl pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground font-body">Loading...</div>
      ) : filteredStaffUsers.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredStaffUsers.map((staffUser) => {
            const role = staffUser.role as StaffRole;
            const isCurrentUser = staffUser.id === user?.id;

            return (
              <button
                key={staffUser.id}
                type="button"
                onClick={() => setSelectedStaffId(staffUser.id)}
                className="rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-all hover:border-primary/25 hover:shadow-elevated"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-display text-lg font-semibold text-foreground">
                        {staffUser.full_name || staffUser.email || "Staff user"}
                      </h2>
                      {isCurrentUser ? (
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                          You
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground font-body">{staffUser.email || "No email"}</p>
                  </div>

                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getRoleBadgeClass(role)}`}>
                    {getRoleLabel(role)}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-accent/30 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Phone</p>
                    <p className="mt-2 text-sm text-foreground font-body">{staffUser.phone || "Not provided"}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-accent/30 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Status</p>
                    <p className="mt-2 text-sm font-semibold text-foreground font-body">
                      {staffUser.is_active ? "Active" : "Inactive"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground font-body">{getRoleDescription(role)}</p>
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                    <UserCog className="h-4 w-4" />
                    Manage
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-card">
          <p className="text-muted-foreground font-body">
            {searchQuery.trim() ? "No staff users matched your search." : "No admin or practitioner users found yet."}
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
                <p className="text-sm font-semibold text-foreground font-body">Secure staff account creation</p>
                <p className="mt-1 text-sm text-muted-foreground font-body">
                  This creates the auth user, stores the chosen role in the profile, and saves practitioner permissions at the same time.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Full Name</label>
              <Input
                value={createForm.fullName}
                onChange={(event) => setCreateForm((current) => ({ ...current, fullName: event.target.value }))}
                placeholder="Example: Sarah Naidoo"
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Email</label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="staff@acapolite.com"
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Phone</label>
              <Input
                value={createForm.phone}
                onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="+27 ..."
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Password</label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="At least 8 characters"
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground font-body">Role</label>
              <Select
                value={createForm.role}
                onValueChange={(value) => setCreateForm((current) => ({ ...current, role: value as StaffRole }))}
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
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Selected Role</p>
            <p className="mt-2 font-display text-lg text-foreground">{getRoleLabel(createForm.role)}</p>
            <p className="mt-2 text-sm text-muted-foreground font-body">{getRoleDescription(createForm.role)}</p>
          </div>

          <PermissionEditor
            role={createForm.role}
            permissions={createForm.role === "admin" ? fullStaffPermissions : createPermissions}
            onToggle={handleCreatePermissionToggle}
          />

          {createForm.role === "consultant" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Practitioner Profile Setup</p>
                <p className="mt-2 text-sm text-muted-foreground font-body">
                  Set up the practitioner profile that clients will see when this practitioner responds to marketplace leads.
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
            <Button type="button" className="rounded-xl" onClick={createStaffUser} disabled={isCreating}>
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
        title={selectedStaffUser?.full_name || selectedStaffUser?.email || "Staff Member"}
        description="Review and update this staff profile. Practitioner page access, action rights, and client scope are controlled here."
      >
        {selectedStaffUser ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Email</p>
                <p className="mt-2 break-all text-sm text-foreground font-body">{selectedStaffUser.email || "No email"}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Created</p>
                <p className="mt-2 text-sm text-foreground font-body">{new Date(selectedStaffUser.created_at).toLocaleString()}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Full Name</label>
                <Input
                  value={editForm.fullName}
                  onChange={(event) => setEditForm((current) => ({ ...current, fullName: event.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Phone</label>
                <Input
                  value={editForm.phone}
                  onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))}
                  placeholder="+27 ..."
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-foreground font-body">Role</label>
                <Select
                  value={editForm.role}
                  onValueChange={(value) => {
                    const nextRole = value as StaffRole;
                    setEditForm((current) => ({ ...current, role: nextRole }));
                    setEditPermissions(getPermissionPreset(nextRole, nextRole === "admin" ? fullStaffPermissions : selectedPermissionRow));
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
                  <p className="text-sm font-semibold text-foreground font-body">Profile Active</p>
                  <p className="mt-1 text-sm text-muted-foreground font-body">
                    Use this flag to mark internal staff accounts active or inactive inside the portal.
                  </p>
                </div>
                <Switch
                  checked={editForm.isActive}
                  onCheckedChange={(checked) => setEditForm((current) => ({ ...current, isActive: checked }))}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Access Summary</p>
              <p className="mt-2 font-display text-lg text-foreground">{getRoleLabel(editForm.role)}</p>
              <p className="mt-2 text-sm text-muted-foreground font-body">{getRoleDescription(editForm.role)}</p>
            </div>

            <PermissionEditor
              role={editForm.role}
              permissions={editForm.role === "admin" ? fullStaffPermissions : editPermissions}
              onToggle={handleEditPermissionToggle}
            />

            {editForm.role === "consultant" ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body">Practitioner Profile</p>
                  <p className="mt-2 text-sm text-muted-foreground font-body">
                    Update public practitioner details, verification status, availability, services, and internal notes.
                  </p>
                </div>
                <PractitionerProfileFields
                  value={editPractitionerProfile}
                  onChange={setEditPractitionerProfile}
                />
              </div>
            ) : null}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setSelectedStaffId(null)} disabled={isSaving}>
                Close
              </Button>
              <Button type="button" className="rounded-xl" onClick={updateStaffUser} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Staff Profile"}
              </Button>
            </div>
          </div>
        ) : null}
      </DashboardItemDialog>
    </div>
  );
}

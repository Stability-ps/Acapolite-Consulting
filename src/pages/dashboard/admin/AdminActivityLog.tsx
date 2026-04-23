import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";

type ActivityLogRecord = {
  id: string;
  actor_profile_id: string | null;
  actor_role: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

type TargetDetails =
  | { kind: "invoice"; label: string; sublabel?: string | null }
  | { kind: "case"; label: string; sublabel?: string | null }
  | { kind: "document"; label: string; sublabel?: string | null }
  | { kind: "service_request"; label: string; sublabel?: string | null }
  | { kind: "message"; label: string; sublabel?: string | null }
  | { kind: "generic"; label: string; sublabel?: string | null };

const actionLabels: Record<string, string> = {
  case_status_updated: "Case updated",
  case_assignment_updated: "Case assignment updated",
  document_uploaded: "Document uploaded",
  document_approved: "Document approved",
  document_rejected: "Document rejected",
  document_missing_requested: "Missing document requested",
  invoice_created: "Invoice created",
  invoice_sent: "Invoice sent",
  invoice_marked_paid: "Invoice marked as paid",
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  consultant: "Practitioner",
  client: "Client",
};

const actionOptions = [
  { value: "all", label: "All Activity" },
  { value: "case_status_updated", label: "Case Updated" },
  { value: "case_assignment_updated", label: "Case Assignment" },
  { value: "document_uploaded", label: "Document Uploaded" },
  { value: "document_approved", label: "Document Approved" },
  { value: "document_rejected", label: "Document Rejected" },
  { value: "document_missing_requested", label: "Missing Document Requested" },
  { value: "invoice_created", label: "Invoice Created" },
  { value: "invoice_sent", label: "Invoice Sent" },
  { value: "invoice_marked_paid", label: "Invoice Marked Paid" },
];

function getActorLabel(record: ActivityLogRecord) {
  return record.actor?.full_name || record.actor?.email || record.actor_profile_id || "System";
}

function getRoleLabel(role?: string | null) {
  if (!role) return "System";
  return roleLabels[role] || role.charAt(0).toUpperCase() + role.slice(1);
}

function formatActivityTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  if (diffHours < 24) {
    return `${diffHours} hr${diffHours === 1 ? "" : "s"} ago`;
  }

  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  return date.toLocaleString();
}

function toSentenceCase(value?: string | null) {
  const text = value?.replace(/_/g, " ").trim() || "";
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getActivitySentence(record: ActivityLogRecord, targetDetails?: TargetDetails | null) {
  const actor = getActorLabel(record);
  const targetLabel = targetDetails?.label || toSentenceCase(record.target_type) || "item";
  const targetNote = targetDetails?.sublabel ? ` for ${targetDetails.sublabel}` : "";
  const metadata = record.metadata ?? {};

  switch (record.action) {
    case "invoice_created":
      return `${actor} created ${targetLabel}${targetNote}.`;
    case "invoice_sent":
      return `${actor} sent ${targetLabel}${targetNote}.`;
    case "invoice_marked_paid":
      return `${actor} marked ${targetLabel}${targetNote} as paid.`;
    case "document_uploaded":
      return `${actor} uploaded ${targetLabel}${targetNote}.`;
    case "document_approved":
      return `${actor} approved ${targetLabel}${targetNote}.`;
    case "document_rejected":
      return `${actor} rejected ${targetLabel}${targetNote}.`;
    case "document_missing_requested":
      return `${actor} requested follow-up information for ${targetLabel}${targetNote}.`;
    case "case_status_updated": {
      const previousStatus = typeof metadata.previousStatus === "string" ? toSentenceCase(metadata.previousStatus) : "";
      const newStatus = typeof metadata.newStatus === "string" ? toSentenceCase(metadata.newStatus) : "";

      if (previousStatus && newStatus) {
        return `${actor} changed ${targetLabel}${targetNote} from ${previousStatus.toLowerCase()} to ${newStatus.toLowerCase()}.`;
      }

      return `${actor} updated ${targetLabel}${targetNote}.`;
    }
    case "case_assignment_updated":
      return `${actor} updated the practitioner assignment for ${targetLabel}${targetNote}.`;
    default:
      return `${actor} completed ${toSentenceCase(record.action).toLowerCase()} on ${targetLabel}${targetNote}.`;
  }
}

function formatClientName(client?: {
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  client_code?: string | null;
} | null) {
  return (
    client?.company_name
    || [client?.first_name, client?.last_name].filter(Boolean).join(" ")
    || client?.client_code
    || "Client"
  );
}

export default function AdminActivityLog() {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["system-activity-log"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_activity_log")
        .select("*, actor:profiles(full_name, email)")
        .order("created_at", { ascending: false });

      return (data ?? []) as ActivityLogRecord[];
    },
  });

  const filteredLogs = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return (logs ?? []).filter((record) => {
      if (actionFilter !== "all" && record.action !== actionFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const actorLabel = getActorLabel(record).toLowerCase();
      const actionLabel = (actionLabels[record.action] || record.action).toLowerCase();
      const roleLabel = record.actor_role.toLowerCase();
      const targetLabel = `${record.target_type} ${record.target_id ?? ""}`.toLowerCase();

      return (
        actorLabel.includes(normalizedSearch)
        || actionLabel.includes(normalizedSearch)
        || roleLabel.includes(normalizedSearch)
        || targetLabel.includes(normalizedSearch)
      );
    });
  }, [actionFilter, logs, searchQuery]);

  const displayLogs = useMemo(
    () => filteredLogs.map((record) => ({ ...record, target_id: null })),
    [filteredLogs],
  );

  const selectedLog = filteredLogs.find((record) => record.id === selectedLogId)
    || logs?.find((record) => record.id === selectedLogId)
    || null;

  const { data: targetDetails } = useQuery({
    queryKey: ["activity-target-details", selectedLog?.target_type, selectedLog?.target_id],
    queryFn: async () => {
      if (!selectedLog?.target_id) return null;

      switch (selectedLog.target_type) {
        case "invoice": {
          const { data } = await supabase
            .from("invoices")
            .select("invoice_number, title, clients(company_name, first_name, last_name, client_code)")
            .eq("id", selectedLog.target_id)
            .maybeSingle();
          if (!data) return null;
          return {
            kind: "invoice",
            label: data.invoice_number || "Invoice",
            sublabel: data.title || formatClientName(data.clients),
          } as TargetDetails;
        }
        case "case": {
          const { data } = await supabase
            .from("cases")
            .select("case_title, case_type, clients(company_name, first_name, last_name, client_code)")
            .eq("id", selectedLog.target_id)
            .maybeSingle();
          if (!data) return null;
          return {
            kind: "case",
            label: data.case_title || "Case",
            sublabel: formatClientName(data.clients),
          } as TargetDetails;
        }
        case "document": {
          const { data } = await supabase
            .from("documents")
            .select("title, category, file_name, clients(company_name, first_name, last_name, client_code)")
            .eq("id", selectedLog.target_id)
            .maybeSingle();
          if (!data) return null;
          return {
            kind: "document",
            label: data.title || data.category || data.file_name || "Document",
            sublabel: formatClientName(data.clients),
          } as TargetDetails;
        }
        case "service_request": {
          const { data } = await supabase
            .from("service_requests")
            .select("service_needed, full_name, email")
            .eq("id", selectedLog.target_id)
            .maybeSingle();
          if (!data) return null;
          return {
            kind: "service_request",
            label: data.service_needed?.replace(/_/g, " ") || "Service request",
            sublabel: data.full_name || data.email || null,
          } as TargetDetails;
        }
        case "message": {
          const { data } = await supabase
            .from("messages")
            .select("message_text, conversation_id")
            .eq("id", selectedLog.target_id)
            .maybeSingle();
          if (!data) return null;
          return {
            kind: "message",
            label: "Message",
            sublabel: data.message_text?.slice(0, 80) || null,
          } as TargetDetails;
        }
        default:
          return null;
      }
    },
    enabled: !!selectedLog?.target_id,
  });

  const targetDisplay = selectedLog
    ? (targetDetails ?? { kind: "generic", label: selectedLog.target_type.replace(/_/g, " ") })
    : null;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">System Activity Log</h1>
          <p className="text-muted-foreground font-body text-sm">
            Read recent staff activity as a simple timeline of what happened, who did it, and when.
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by person, role, or activity..."
            className="rounded-xl pl-9"
          />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {actionOptions.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={actionFilter === option.value ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setActionFilter(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground font-body">Loading...</div>
      ) : displayLogs.length > 0 ? (
        <div className="space-y-3">
          {displayLogs.map((record) => (
            <button
              key={record.id}
              type="button"
              onClick={() => setSelectedLogId(record.id)}
              className="w-full text-left rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-elevated hover:border-primary/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-sm font-semibold text-foreground font-body leading-6">
                    {getActivitySentence(record)}
                  </p>
                  <p className="text-xs text-muted-foreground font-body mt-1">
                    {getRoleLabel(record.actor_role)}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground font-body whitespace-nowrap">
                  {formatActivityTime(record.created_at)}
                </p>
              </div>
              <div className="text-xs text-muted-foreground font-body">
                {new Date(record.created_at).toLocaleDateString()} at {new Date(record.created_at).toLocaleTimeString()}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground font-body">
            {searchQuery.trim() ? "No activity matched your search." : "No activity logged yet."}
          </p>
        </div>
      )}

      <DashboardItemDialog
        open={!!selectedLog}
        onOpenChange={(open) => {
          if (!open) setSelectedLogId(null);
        }}
        title={selectedLog ? (actionLabels[selectedLog.action] || selectedLog.action.replace(/_/g, " ")) : "Activity Details"}
        description="Review the activity summary and supporting details."
      >
        {selectedLog ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground font-body leading-6">
                {getActivitySentence(selectedLog, targetDisplay)}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Actor</p>
                <p className="font-body text-foreground">{getActorLabel(selectedLog)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Role</p>
                <p className="font-body text-foreground">{getRoleLabel(selectedLog.actor_role)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Target</p>
                <p className="font-body text-foreground">
                  {targetDisplay?.label ?? selectedLog.target_type.replace(/_/g, " ")}
                </p>
                {targetDisplay?.sublabel ? (
                  <p className="text-xs text-muted-foreground font-body mt-1">
                    {targetDisplay.sublabel}
                  </p>
                ) : null}
              </div>
              <div className="rounded-2xl border border-border bg-accent/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Time</p>
                <p className="font-body text-foreground">{new Date(selectedLog.created_at).toLocaleString()}</p>
              </div>
            </div>

            {selectedLog.metadata ? (
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">Technical Details</p>
                <div className="rounded-2xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground font-body">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </DashboardItemDialog>
    </div>
  );
}

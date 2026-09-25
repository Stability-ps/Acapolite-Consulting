/* eslint-disable @typescript-eslint/no-explicit-any -- Prospect Hub tables are not in the generated Supabase types yet, so rows follow the explicit select list in each query. */
import type { ComponentType, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { stageLabel, stageTone } from "@/lib/prospectHub";

export const prospectDb = supabase as any;

export function useProspectPermissions() {
  const { role, hasStaffPermission, user } = useAuth();
  const isAdmin = role === "admin";
  return {
    userId: user?.id ?? null,
    isAdmin,
    canView: isAdmin || hasStaffPermission("can_view_prospect_hub"),
    canManage: isAdmin || hasStaffPermission("can_manage_prospect_hub"),
    canSend: isAdmin || hasStaffPermission("can_send_prospect_campaigns"),
    canManageClients: isAdmin || hasStaffPermission("can_manage_clients"),
    canViewInvoices: isAdmin || hasStaffPermission("can_view_invoices"),
  };
}

export type StaffMember = { id: string; full_name: string | null; email: string | null; role: string };

export function useStaffMembers() {
  return useQuery({
    queryKey: ["prospect-hub-staff"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,email,role")
        .in("role", ["admin", "consultant"])
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as StaffMember[];
    },
  });
}

export function staffName(staff: StaffMember[] | undefined, id: string | null | undefined) {
  if (!id) return "Unassigned";
  const s = staff?.find((m) => m.id === id);
  return s?.full_name || s?.email || "Staff member";
}

export function StageBadge({ stage, className }: { stage: string; className?: string }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", stageTone(stage), className)}>{stageLabel(stage)}</span>;
}

export function ScoreBadge({ score, title }: { score: number; title?: string }) {
  const tone = score >= 70 ? "bg-emerald-100 text-emerald-800" : score >= 45 ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground";
  return <span title={title ?? "Fit score: how relevant this business is as a potential Acapolite customer"} className={cn("inline-flex min-w-[2.5rem] justify-center rounded-full px-2 py-0.5 text-xs font-semibold", tone)}>{score}</span>;
}

export function StatCard({ label, value, hint, icon: Icon, tone }: { label: string; value: ReactNode; hint?: string; icon?: ComponentType<{ className?: string }>; tone?: "warn" | "good" }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon ? <Icon className={cn("h-4 w-4", tone === "warn" ? "text-amber-600" : tone === "good" ? "text-emerald-600" : "text-primary")} /> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Panel({ title, description, actions, children, className }: { title: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-4 shadow-sm", className)}>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return <tr><td colSpan={colSpan} className="p-8 text-center text-sm text-muted-foreground">{children}</td></tr>;
}

export function errorMessage(error: unknown, fallback = "Something went wrong") {
  if (error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return fallback;
}

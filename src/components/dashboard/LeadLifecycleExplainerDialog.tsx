import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BellRing,
  Clock3,
  RefreshCcw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

interface LeadLifecycleExplainerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type LifecycleSettings = Tables<"service_request_lifecycle_settings">;

const goals = [
  "Protect urgent SARS matters",
  "Improve response rates",
  "Reward active practitioners",
  "Create fair marketplace exposure",
  "Prevent leads from being ignored",
] as const;

const stageRules = [
  "Lead status changes automatically when a stage timer expires",
  "Access expands to the next marketplace stage without staff intervention",
  "Each new stage starts with a fresh timer",
  "Expired leads leave practitioner visibility immediately",
  "Staff can revive expired leads and reset active timers when needed",
  "Practitioner and client notifications can fire as the lifecycle changes",
] as const;

function formatHoursLabel(hours: number | null | undefined, fallback: number) {
  const safeHours = typeof hours === "number" && hours > 0 ? hours : fallback;
  return safeHours === 1 ? "1 hour" : `${safeHours} hours`;
}

export function LeadLifecycleExplainerDialog({
  open,
  onOpenChange,
}: LeadLifecycleExplainerDialogProps) {
  const { data: lifecycleSettings } = useQuery({
    queryKey: ["service-request-lifecycle-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_request_lifecycle_settings")
        .select("*")
        .eq("settings_key", "default")
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as LifecycleSettings | null;
    },
    staleTime: 60_000,
  });

  const lifecycleStages = useMemo(() => {
    const businessHours = lifecycleSettings?.business_stage_hours ?? 48;
    const professionalHours = lifecycleSettings?.professional_stage_hours ?? 48;
    const openHours = lifecycleSettings?.open_marketplace_hours ?? 72;
    const confirmationHours = lifecycleSettings?.pending_client_confirmation_hours ?? 24;

    return [
      {
        step: "1",
        title: "Business Exclusive",
        duration: formatHoursLabel(businessHours, 48),
        access: "Business plan practitioners only",
        purpose: "New marketplace leads begin here so Business practitioners receive the earliest access window.",
        timerExample: `Expires in ${formatHoursLabel(businessHours, 48)}`,
        accent: "border-amber-200 bg-amber-50",
        badgeClassName: "bg-amber-100 text-amber-800 hover:bg-amber-100",
        during: [
          "Lead displays a Business Exclusive badge",
          "Only Business subscribers can unlock the lead",
          "The lifecycle countdown starts immediately after validation",
          "No staff action is required while the timer runs",
        ],
        expiry: [
          "Status changes to Professional Access",
          "Professional practitioners gain visibility automatically",
          "The next stage timer starts from zero",
          "Notifications can be sent to newly eligible practitioners",
        ],
      },
      {
        step: "2",
        title: "Professional Access",
        duration: formatHoursLabel(professionalHours, 48),
        access: "Business + Professional practitioners",
        purpose: "If the lead is still unattended, access expands to Professional subscribers without removing Business access.",
        timerExample: `Expires in ${formatHoursLabel(professionalHours, 48)}`,
        accent: "border-sky-200 bg-sky-50",
        badgeClassName: "bg-sky-100 text-sky-800 hover:bg-sky-100",
        during: [
          "Business practitioners keep access",
          "Professional practitioners become eligible automatically",
          "The stage uses its own independent timer",
          "Lifecycle history records the stage change",
        ],
        expiry: [
          "Status changes to Open Marketplace",
          "All qualifying practitioners gain visibility",
          "The final unattended marketplace timer starts",
          "Further notifications can be sent automatically",
        ],
      },
      {
        step: "3",
        title: "Open Marketplace",
        duration: formatHoursLabel(openHours, 72),
        access: "All qualifying practitioners",
        purpose: "This is the broadest visibility window and the final unattended marketplace stage before expiry.",
        timerExample: `Expires in ${formatHoursLabel(openHours, 72)}`,
        accent: "border-emerald-200 bg-emerald-50",
        badgeClassName: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
        during: [
          "The lead is visible across the marketplace",
          "Eligible practitioners may unlock and respond",
          "The lead remains active until the Open Marketplace timer ends",
        ],
        expiry: [
          "Status changes to Expired if the lead is still unattended",
          "The lead leaves practitioner visibility",
          "The full lifecycle history stays available to staff",
          "Staff may manually reactivate the lead later",
        ],
      },
      {
        step: "4",
        title: "Pending Client Confirmation",
        duration: formatHoursLabel(confirmationHours, 24),
        access: "Client action required",
        purpose: "When client confirmation is requested, the lead pauses here until the client responds or the deadline closes.",
        timerExample: `Client response due in ${formatHoursLabel(confirmationHours, 24)}`,
        accent: "border-orange-200 bg-orange-50",
        badgeClassName: "bg-orange-100 text-orange-800 hover:bg-orange-100",
        during: [
          "The lead is hidden from new practitioner access",
          "The client receives an in-platform confirmation request",
          "A confirmation deadline is tracked separately from marketplace timers",
        ],
        expiry: [
          "If the client confirms they still need assistance, the lead returns to the marketplace with a reset timer",
          "If the client declines, the lead expires and leaves the marketplace",
        ],
      },
    ] as const;
  }, [lifecycleSettings]);

  const reminderHours = lifecycleSettings?.reminder_hours ?? 6;
  const reactivationAlertThreshold = lifecycleSettings?.reactivation_alert_threshold ?? 3;

  return (
    <DashboardItemDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Lead Lifecycle Explained"
      description="How Acapolite escalates unattended marketplace leads, expires them, and lets staff revive them when needed."
    >
      <div className="space-y-6">
        <section className="rounded-[24px] border border-border bg-gradient-to-br from-slate-50 via-white to-slate-100 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <ShieldCheck className="h-4 w-4" />
                How the Acapolite Marketplace Works
              </div>
              <p className="mt-3 text-sm leading-7 text-muted-foreground font-body">
                Marketplace leads move through Business Exclusive, Professional Access, and Open Marketplace automatically.
                Each stage uses its own timer, and the lifecycle processor advances or expires unattended leads without staff intervention.
              </p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground font-body">
                Staff can change the stage durations, reset timers, and revive expired leads from the dashboard.
              </p>
            </div>

            <div className="grid min-w-[230px] gap-2">
              {goals.map((item) => (
                <div key={item} className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[22px] border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Clock3 className="h-4 w-4 text-primary" />
              Each stage has a configurable timer
            </div>
            <p className="mt-3 text-sm leading-7 text-muted-foreground font-body">
              Staff can adjust Business, Professional, Open Marketplace, and client confirmation timers from the admin dashboard.
            </p>
          </div>

          <div className="rounded-[22px] border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <BellRing className="h-4 w-4 text-primary" />
              Notifications follow stage changes
            </div>
            <p className="mt-3 text-sm leading-7 text-muted-foreground font-body">
              Newly eligible practitioners can be notified as access expands, and clients can be notified when lifecycle actions affect their lead.
            </p>
          </div>

          <div className="rounded-[22px] border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <RefreshCcw className="h-4 w-4 text-primary" />
              Expired leads can be revived manually
            </div>
            <p className="mt-3 text-sm leading-7 text-muted-foreground font-body">
              Staff can re-enter an expired lead at Business, Professional, or Open Marketplace and reset its timer instantly.
            </p>
          </div>
        </section>

        <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground">When a lifecycle action triggers</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {stageRules.map((rule) => (
              <div key={rule} className="rounded-2xl border border-border bg-accent/20 px-4 py-3 text-sm text-foreground font-body">
                {rule}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          {lifecycleStages.map((stage) => (
            <article key={stage.title} className={`rounded-[24px] border p-5 shadow-sm ${stage.accent}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge className={stage.badgeClassName}>{`${stage.step}. ${stage.title}`}</Badge>
                    <span className="text-sm font-medium text-foreground">{stage.duration}</span>
                  </div>

                  <p className="mt-3 text-sm font-semibold text-foreground">Access: {stage.access}</p>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground font-body">{stage.purpose}</p>
                </div>

                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm font-semibold text-foreground shadow-sm">
                  Timer Example: "{stage.timerExample}"
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                  <p className="text-sm font-semibold text-foreground">During this stage</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground font-body">
                    {stage.during.map((point) => (
                      <li key={point}>- {point}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                  <p className="text-sm font-semibold text-foreground">If the timer ends</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground font-body">
                    {stage.expiry.map((point) => (
                      <li key={point}>- {point}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-[24px] border border-violet-200 bg-violet-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-900">
            <TriangleAlert className="h-4 w-4" />
            Expired Leads and Reactivation
          </div>
          <p className="mt-3 text-sm leading-7 text-violet-900/80 font-body">
            Once a lead expires, it leaves practitioner visibility and stays archived until staff revive it.
            The lifecycle configuration stores {formatHoursLabel(reminderHours, 6)} as the reminder window
            before expiry and a threshold of {reactivationAlertThreshold} unsuccessful cycles for repeated reactivation review.
          </p>
        </section>
      </div>
    </DashboardItemDialog>
  );
}

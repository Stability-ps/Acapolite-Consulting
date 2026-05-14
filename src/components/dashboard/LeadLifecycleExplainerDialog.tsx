import {
  BellRing,
  Clock3,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { Badge } from "@/components/ui/badge";

interface LeadLifecycleExplainerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const goals = [
  "Protect urgent SARS matters",
  "Improve response rates",
  "Reward active practitioners",
  "Create fair marketplace exposure",
  "Prevent leads from being ignored",
] as const;

const stageRules = [
  "Lead status automatically changes",
  "Access expands to the next subscription level",
  "Countdown timer resets for the next stage",
  "Practitioner permissions update automatically",
  "Lead visibility updates automatically",
  "New notifications may be triggered automatically",
] as const;

const lifecycleStages = [
  {
    step: "1",
    title: "Business Exclusive",
    duration: "0 - 12 Hours",
    access: "Business Plan practitioners only",
    purpose: "This gives premium practitioners priority access to high-value and urgent opportunities.",
    timerExample: "Expires in 12 hours",
    accent: "border-amber-200 bg-amber-50",
    badgeClassName: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    during: [
      "Lead displays a Business Exclusive badge",
      "Countdown timer is active",
      "Professional and Starter users cannot respond",
      "Lead remains protected for Business subscribers",
    ],
    expiry: [
      "Status changes to Professional Access",
      "Access permissions update",
      "Professional practitioners may unlock and respond",
      "Countdown resets to 24 hours",
      "Lead visibility expands",
      "New notifications may be triggered",
    ],
  },
  {
    step: "2",
    title: "Professional Access",
    duration: "12 - 36 Hours",
    access: "Business + Professional practitioners",
    purpose: "If no Business practitioner attends to the lead, access automatically expands to Professional subscribers.",
    timerExample: "Expires in 24 hours",
    accent: "border-sky-200 bg-sky-50",
    badgeClassName: "bg-sky-100 text-sky-800 hover:bg-sky-100",
    during: [
      "Lead status changes to Professional Access",
      "More practitioners gain visibility",
      "Additional notifications may be sent",
      "The stage timer resets automatically",
    ],
    expiry: [
      "Status changes to Open Marketplace",
      "Starter practitioners may unlock and respond",
      "Access expands to all qualifying practitioners",
      "Countdown resets again",
      "Visibility increases further",
      "Additional notifications may be triggered",
    ],
  },
  {
    step: "3",
    title: "Open Marketplace",
    duration: "36 - 60 Hours",
    access: "All practitioners including Starter plans",
    purpose: "This ensures important leads never remain locked or hidden for too long.",
    timerExample: "Expires in 24 hours",
    accent: "border-emerald-200 bg-emerald-50",
    badgeClassName: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
    during: [
      "Lead becomes publicly accessible inside the marketplace",
      "All qualifying practitioners may respond",
      "Marketplace visibility increases significantly",
    ],
    expiry: [
      "Status changes to Reactivated Lead",
      "Lead moves back to the top of the marketplace",
      "Visibility is boosted again",
      "Fresh notifications may be triggered",
    ],
  },
  {
    step: "4",
    title: "Reactivated Lead",
    duration: "After 60 Hours Unattended",
    access: "Reintroduced to the marketplace",
    purpose: "This prevents valuable SARS matters from being buried or forgotten.",
    timerExample: "Boosted back to the top of the feed",
    accent: "border-violet-200 bg-violet-50",
    badgeClassName: "bg-violet-100 text-violet-800 hover:bg-violet-100",
    during: [
      "Lead status changes to Reactivated Lead",
      "Lead returns to the top of the marketplace feed",
      "Visibility is boosted again",
      "Practitioners may receive fresh notifications",
    ],
    expiry: [
      "First full lifecycle expiry reactivates immediately",
      "Second full lifecycle expiry requires client confirmation first",
    ],
  },
] as const;

export function LeadLifecycleExplainerDialog({
  open,
  onOpenChange,
}: LeadLifecycleExplainerDialogProps) {
  return (
    <DashboardItemDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Lead Lifecycle Explained"
      description="How the Acapolite marketplace escalates unattended leads and keeps urgent SARS matters visible."
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
                To ensure that important SARS matters are never left unattended, Acapolite uses a smart
                Lead Lifecycle system. Marketplace leads automatically escalate between subscription
                levels if no practitioner responds within the allocated stage window.
              </p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground font-body">
                Every lead moves through different lifecycle stages automatically. Each stage has its own
                countdown timer, and everything is handled by the lifecycle system.
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
              Each stage has a countdown
            </div>
            <p className="mt-3 text-sm leading-7 text-muted-foreground font-body">
              Each lead stage has its own timer. When a stage expires, the next stage opens automatically.
            </p>
          </div>

          <div className="rounded-[22px] border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <BellRing className="h-4 w-4 text-primary" />
              Access and visibility expand
            </div>
            <p className="mt-3 text-sm leading-7 text-muted-foreground font-body">
              Practitioner permissions, lead visibility, and notifications can all update automatically
              when a stage changes.
            </p>
          </div>

          <div className="rounded-[22px] border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <RefreshCcw className="h-4 w-4 text-primary" />
              Leads do not stay hidden forever
            </div>
            <p className="mt-3 text-sm leading-7 text-muted-foreground font-body">
              The lifecycle is designed to recycle unattended leads so valuable client matters keep
              getting visibility.
            </p>
          </div>
        </section>

        <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground">When a stage expires</p>
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
                  <p className="text-sm font-semibold text-foreground">If no practitioner responds</p>
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

      </div>
    </DashboardItemDialog>
  );
}

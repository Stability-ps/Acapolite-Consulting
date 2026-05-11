import {
  Activity,
  BellRing,
  Clock3,
  FileText,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { DashboardItemDialog } from "@/components/dashboard/DashboardItemDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface LeadLifecycleExplainerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const lifecycleStages = [
  {
    title: "Business Exclusive",
    duration: "0 - 12 Hours",
    access: "Business Plan practitioners only",
    accent: "border-amber-200 bg-amber-50",
    badgeClassName: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    description: "Business practitioners receive first-priority access to high-value and urgent SARS matters.",
    points: [
      "Lead displays a Business Exclusive badge",
      "Countdown timer stays active for 12 hours",
      "Professional and Starter plans cannot respond yet",
      "Lead remains protected for Business subscribers",
    ],
    expiry: [
      "Status changes to Professional Access",
      "Professional practitioners gain access",
      "Countdown resets to the next 24-hour window",
      "Visibility and notifications expand automatically",
    ],
  },
  {
    title: "Professional Access",
    duration: "12 - 36 Hours",
    access: "Business + Professional practitioners",
    accent: "border-sky-200 bg-sky-50",
    badgeClassName: "bg-sky-100 text-sky-800 hover:bg-sky-100",
    description: "If no Business practitioner responds, access expands to Professional subscribers.",
    points: [
      "Lead status changes to Professional Access",
      "More practitioners gain visibility",
      "Additional notifications may be sent",
      "The stage timer resets automatically",
    ],
    expiry: [
      "Status changes to Open Marketplace",
      "Starter practitioners may unlock and respond",
      "Access expands to all qualifying practitioners",
      "Visibility increases again",
    ],
  },
  {
    title: "Open Marketplace",
    duration: "36 - 60 Hours",
    access: "All practitioners including Starter plans",
    accent: "border-emerald-200 bg-emerald-50",
    badgeClassName: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
    description: "This stage ensures important leads never remain locked or hidden for too long.",
    points: [
      "Lead becomes available across the marketplace",
      "All qualifying plans may respond",
      "Marketplace visibility increases significantly",
      "This is the final standard access window",
    ],
    expiry: [
      "Lead moves into Reactivated Lead status",
      "Lead returns to the top of the marketplace",
      "Fresh notifications may be triggered",
      "Visibility receives another boost",
    ],
  },
  {
    title: "Reactivated Lead",
    duration: "After 60 Hours Unattended",
    access: "Reintroduced to the marketplace",
    accent: "border-violet-200 bg-violet-50",
    badgeClassName: "bg-violet-100 text-violet-800 hover:bg-violet-100",
    description: "If no practitioner responds after all stages, the system boosts the lead again instead of letting it disappear.",
    points: [
      "Lead receives a Reactivated badge",
      "Lead returns to the top of the feed",
      "Visibility is boosted again",
      "Fresh practitioner notifications may be sent",
    ],
    expiry: [
      "After a second full unattended lifecycle, client confirmation is required",
      "Unconfirmed leads are removed from the active marketplace",
    ],
  },
] as const;

const whyLifecycleExists = [
  "Protect urgent SARS matters",
  "Improve response rates",
  "Reward active practitioners",
  "Create fair marketplace exposure",
  "Prevent leads from being ignored",
] as const;

const activityBoosts = [
  "Client uploads documents",
  "Client replies to messages",
  "Client updates information",
  "Client becomes active again",
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
      description="A practitioner-facing overview of how Acapolite escalates unattended marketplace leads."
    >
      <div className="space-y-6">
        <section className="rounded-[24px] border border-border bg-gradient-to-br from-slate-50 via-white to-slate-100 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <ShieldCheck className="h-4 w-4" />
                How the marketplace works
              </div>
              <p className="mt-3 text-sm leading-7 text-muted-foreground font-body">
                Every marketplace lead moves through timed access stages when no practitioner responds.
                The system expands visibility automatically, resets the countdown for each stage, and
                keeps urgent SARS matters from being forgotten.
              </p>
            </div>

            <div className="grid min-w-[220px] gap-2">
              {whyLifecycleExists.map((item) => (
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
              Each stage has its own timer
            </div>
            <p className="mt-3 text-sm leading-7 text-muted-foreground font-body">
              When a timer expires, the lead automatically changes stage, access expands to more
              practitioners, and the countdown resets for the new stage.
            </p>
          </div>

          <div className="rounded-[22px] border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <BellRing className="h-4 w-4 text-primary" />
              Visibility updates automatically
            </div>
            <p className="mt-3 text-sm leading-7 text-muted-foreground font-body">
              Permissions, marketplace placement, and notifications update automatically as the lead
              moves through the lifecycle.
            </p>
          </div>

          <div className="rounded-[22px] border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <RefreshCcw className="h-4 w-4 text-primary" />
              Leads never stay locked forever
            </div>
            <p className="mt-3 text-sm leading-7 text-muted-foreground font-body">
              If a lead is unattended, it escalates automatically instead of remaining hidden behind
              one subscription tier.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          {lifecycleStages.map((stage, index) => (
            <article key={stage.title} className={`rounded-[24px] border p-5 shadow-sm ${stage.accent}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge className={stage.badgeClassName}>{`${index + 1}. ${stage.title}`}</Badge>
                    <span className="text-sm font-medium text-foreground">{stage.duration}</span>
                  </div>

                  <p className="mt-3 text-sm font-semibold text-foreground">Access: {stage.access}</p>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground font-body">
                    {stage.description}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm font-semibold text-foreground shadow-sm">
                  Timer example: "Expires in {index === 0 ? "12 hours" : "24 hours"}"
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                  <p className="text-sm font-semibold text-foreground">During this stage</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground font-body">
                    {stage.points.map((point) => (
                      <li key={point}>• {point}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                  <p className="text-sm font-semibold text-foreground">If no practitioner responds</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground font-body">
                    {stage.expiry.map((point) => (
                      <li key={point}>• {point}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Activity className="h-4 w-4 text-primary" />
            After the second full unattended lifecycle
          </div>
          <p className="mt-3 text-sm leading-7 text-muted-foreground font-body">
            The first full expiry reactivates the lead immediately. The second full expiry does not.
            Before a second reactivation, the system must confirm with the client that assistance is
            still required.
          </p>

          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">Client clicks YES</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-emerald-800 font-body">
                <li>• Lead is reactivated</li>
                <li>• Lifecycle timers restart</li>
                <li>• Practitioners receive notifications again</li>
                <li>• Visibility increases again</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-semibold text-rose-900">Client clicks NO</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-rose-800 font-body">
                <li>• Lead expires permanently</li>
                <li>• Lead moves out of the active marketplace</li>
                <li>• Further practitioner responses are blocked</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">No reply within 24 hours</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700 font-body">
                <li>• Lead expires permanently</li>
                <li>• Lead is removed from the active marketplace</li>
                <li>• Practitioner time and credits are protected</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText className="h-4 w-4 text-primary" />
              Lead activity can boost visibility
            </div>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground font-body">
              {activityBoosts.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
            <p className="text-sm font-semibold text-foreground">Important notes</p>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground font-body">
              <li>• Timers reset automatically at every stage.</li>
              <li>• Practitioner permissions update automatically as access expands.</li>
              <li>• Priority, risk, and document indicators help you assess urgency quickly.</li>
              <li>• The system is designed to keep the marketplace active and efficient.</li>
            </ul>
          </div>
        </section>

        <section className="rounded-[24px] border border-border bg-slate-50 p-5 shadow-sm">
          <p className="text-sm font-semibold text-foreground">Close this window</p>
          <p className="mt-2 text-sm leading-7 text-muted-foreground font-body">
            Click <span className="font-semibold text-foreground">Close</span>, use the top-right close
            button, or click outside the popup to return to the marketplace.
          </p>
          <div className="mt-4">
            <Button type="button" className="rounded-xl" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </section>
      </div>
    </DashboardItemDialog>
  );
}

import { ElevenLabsWidget } from "@/components/dashboard/ElevenLabsWidget";
import { useAuth } from "@/hooks/useAuth";

export default function TaxCoachAIStaff() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card sm:p-8">
        <p className="text-sm uppercase tracking-[0.2em] text-primary/70 font-body">
          {isAdmin ? "Admin Tools" : "Practitioner Tools"}
        </p>
        <h1 className="mt-2 font-display text-3xl text-foreground">
          {isAdmin
            ? "Tax Coach AI - Admin Assistance Tools"
            : "Tax Coach AI - Practitioner Assistance Tools"}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground font-body">
          {isAdmin
            ? "This space will support internal reviews, SARS response drafting, and staff decision-making."
            : "This space will support SARS letter interpretation, client response drafting, and case guidance."}
        </p>
      </section>

      <section className="rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-card">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground font-body">
            Tax Coach AI is live below. More assistance tools are coming soon.
          </p>
        </div>
      </section>
      <ElevenLabsWidget />
    </div>
  );
}

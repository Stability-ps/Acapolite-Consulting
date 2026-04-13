import { ElevenLabsWidget } from "@/components/dashboard/ElevenLabsWidget";

export default function TaxCoachAIClient() {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-border bg-card p-6 shadow-card sm:p-8">
        <p className="text-sm uppercase tracking-[0.2em] text-primary/70 font-body">Client Tools</p>
        <h1 className="mt-2 font-display text-3xl text-foreground">
          Tax Coach AI - Client Assistance Tools
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground font-body">
          This area will help with SARS questions, document explanations, and guided tax support.
        </p>
      </section>

      <section className="rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-card">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground font-body">
            Tax Coach AI is live below. More client guidance features are coming soon.
          </p>
        </div>
      </section>
      <ElevenLabsWidget />
    </div>
  );
}

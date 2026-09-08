import { useState } from "react";
import { Mic } from "lucide-react";
import { ElevenLabsWidget } from "@/components/dashboard/ElevenLabsWidget";
import { TaxAIChat } from "@/components/dashboard/TaxAIChat";
import { useAuth } from "@/hooks/useAuth";

export default function TaxCoachAIStaff() {
  const { role, hasStaffPermission } = useAuth();
  const isAdmin = role === "admin";
  const canUseTaxAI = isAdmin || hasStaffPermission("can_use_tax_coach_ai");
  const [voiceAssistantEnabled, setVoiceAssistantEnabled] = useState(false);

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
          General Tax AI draws on the approved Tax Knowledge Library and approved Past Cases. It never has access to
          any client's active case documents — open a case to get case-specific answers with source citations.
        </p>
      </section>

      {canUseTaxAI ? (
        <TaxAIChat scope="general" />
      ) : (
        <section className="rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-card">
          <p className="text-base font-semibold text-foreground font-body">Tax Coach AI is not enabled for your account.</p>
          <p className="text-sm text-muted-foreground font-body mt-2">
            Ask an administrator to enable Tax Coach AI in your staff permissions.
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <button
          type="button"
          onClick={() => setVoiceAssistantEnabled((enabled) => !enabled)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-3">
            <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground font-body">Voice Assistant (ElevenLabs)</p>
              <p className="text-xs text-muted-foreground font-body mt-1 max-w-2xl">
                A separate, ElevenLabs-hosted voice assistant. It is not connected to Acapolite case data, the Tax
                Knowledge Library, or Past Cases, and is not source-cited — use Tax Coach AI above for grounded
                answers. {voiceAssistantEnabled ? "Enabled" : "Tap to enable"} as a floating widget.
              </p>
            </div>
          </div>
        </button>
        {voiceAssistantEnabled ? <ElevenLabsWidget /> : null}
      </section>
    </div>
  );
}

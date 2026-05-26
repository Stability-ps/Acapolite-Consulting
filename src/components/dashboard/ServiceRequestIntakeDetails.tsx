import { getIntakeDetailRows } from "@/lib/serviceRequestIntake";
import type { Json } from "@/integrations/supabase/types";

type ServiceRequestIntakeDetailsProps = {
  intakePayload: Json | null | undefined;
  title?: string;
  emptyMessage?: string;
  className?: string;
};

export function ServiceRequestIntakeDetails({
  intakePayload,
  title = "Intake questionnaire",
  emptyMessage = "No structured intake answers were captured for this request.",
  className = "",
}: ServiceRequestIntakeDetailsProps) {
  const rows = getIntakeDetailRows(intakePayload);

  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-body mb-2">
        {title}
      </p>
      {rows.length > 0 ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="rounded-2xl border border-border bg-accent/20 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground font-body">
                {row.label}
              </p>
              <p className="mt-1 text-sm text-foreground font-body">{row.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground font-body">{emptyMessage}</p>
      )}
    </div>
  );
}

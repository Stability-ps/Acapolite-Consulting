export type JsonRecord = Record<string, unknown>;

export type IncomingStatus = {
  metaMessageId: string;
  status: string;
  errors: JsonRecord[];
};

const TRACKED_STATUSES = new Set(["sent", "delivered", "read", "failed"]);

// Meta only ever moves a message forward through sent -> delivered -> read.
// Webhook retries can redeliver an older status after a newer one already
// landed, so a plain "last write wins" update would let a late duplicate
// regress the UI back to an earlier state. Rank guards against that, and a
// failed message is treated as terminal so a stray late progress event can't
// resurrect it.
const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3 };

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function incomingStatuses(payload: unknown): IncomingStatus[] {
  const out: IncomingStatus[] = [];
  for (const entryValue of asArray(asRecord(payload).entry)) {
    const entry = asRecord(entryValue);
    for (const changeValue of asArray(entry.changes)) {
      const change = asRecord(changeValue);
      const value = asRecord(change.value);
      for (const statusValue of asArray(value.statuses)) {
        const s = asRecord(statusValue);
        const metaMessageId = String(s.id || "").trim();
        const status = String(s.status || "").trim().toLowerCase();
        if (!metaMessageId || !status) continue;
        const errors = asArray(s.errors).map((e) => asRecord(e));
        out.push({ metaMessageId, status, errors });
      }
    }
  }
  return out;
}

export function isTrackedStatus(status: string): boolean {
  return TRACKED_STATUSES.has(status);
}

export function shouldApplyStatus(current: string | null | undefined, next: string): boolean {
  const currentValue = (current || "").toLowerCase();
  if (currentValue === "failed") return false;
  if (next === "failed") return true;
  return (STATUS_RANK[next] ?? 0) >= (STATUS_RANK[currentValue] ?? 0);
}

export function formatStatusFailureDetail(errors: JsonRecord[]): string {
  const first = errors[0];
  if (!first) return "";
  const code = first.code ?? "";
  const title = String(first.title || "").trim();
  const message = String(first.message || "").trim();
  const details = String(asRecord(first.error_data).details || "").trim();
  const reason = [title, message, details].filter(Boolean).join(" - ");
  const label = reason || "WhatsApp did not provide further detail.";
  return `WhatsApp reported this message as failed${code ? ` (code ${code})` : ""}: ${label}`.slice(0, 300);
}

// Supabase's real query builder is a "thenable" (has .then()) rather than a
// true Promise, and its generics get excessively deep once a Database type
// isn't supplied - matching that shape exactly here fights the compiler
// without adding real safety (this whole file already relies on that same
// looseness, see `SupabaseClient = ReturnType<typeof createClient>` in
// index.ts). Kept intentionally minimal so a lightweight fake object, not a
// full Supabase client, is enough to unit test the branches below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StatusDbClient = { from: (table: string) => any };

/**
 * Applies one Meta status callback to the matching outbound whatsapp_messages
 * row. Safe to call repeatedly with the same event: shouldApplyStatus()
 * rejects late/duplicate/regressive updates, and the whatsapp_alerts insert
 * for a failure relies on the table's existing unique (alert_type,
 * message_id) index (23505 on a duplicate) instead of creating a second
 * alert row.
 */
export async function applyStatusUpdate(sb: StatusDbClient, status: IncomingStatus): Promise<void> {
  if (!isTrackedStatus(status.status)) return;

  const { data: message, error: lookupError } = await sb
    .from("whatsapp_messages")
    .select("id,conversation_id,delivery_status")
    .eq("meta_message_id", status.metaMessageId)
    .maybeSingle();
  if (lookupError) {
    console.error("WhatsApp status lookup failed", lookupError.message);
    return;
  }
  if (!message) return; // unknown meta_message_id (e.g. a message Acapolite never sent) - nothing to update

  if (!shouldApplyStatus(message.delivery_status as string | null, status.status)) return;

  if (status.status === "failed" && status.errors.length) {
    const detail = formatStatusFailureDetail(status.errors);
    if (detail) {
      const { error: alertError } = await sb.from("whatsapp_alerts").insert({
        conversation_id: message.conversation_id,
        alert_type: "message_failed",
        severity: "critical",
        title: "WhatsApp message failed",
        body: detail,
        message_id: message.id,
      });
      // 23505 = the unique (alert_type, message_id) index already has this alert (duplicate status callback) - safe to ignore
      if (alertError && alertError.code !== "23505") console.error("WhatsApp failure alert insert failed", alertError.message);
    }
  }

  const { error: updateError } = await sb.from("whatsapp_messages").update({ delivery_status: status.status }).eq("id", message.id);
  if (updateError) console.error("WhatsApp status update failed", updateError.message);
}

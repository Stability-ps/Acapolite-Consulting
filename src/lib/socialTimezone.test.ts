import { describe, expect, it } from "vitest";
import { formatInBusinessTimezone, parseLocalDateTimeInZone, toLocalDateTimeInputValue, zonedDateTimeToUtc } from "./socialTimezone";

const JHB = "Africa/Johannesburg";

describe("socialTimezone", () => {
  it("converts a local wall-clock time to the correct UTC instant for Africa/Johannesburg (UTC+2, no DST)", () => {
    const utc = zonedDateTimeToUtc(2026, 9, 1, 9, 0, JHB);
    expect(utc.toISOString()).toBe("2026-09-01T07:00:00.000Z");
  });

  it("parses a datetime-local input value as local time in the given zone", () => {
    const utc = parseLocalDateTimeInZone("2026-09-01T09:00", JHB);
    expect(utc?.toISOString()).toBe("2026-09-01T07:00:00.000Z");
  });

  it("round-trips: parsing then formatting back to a datetime-local value returns the original wall-clock string", () => {
    const utc = parseLocalDateTimeInZone("2026-09-01T14:30", JHB)!;
    expect(toLocalDateTimeInputValue(utc, JHB)).toBe("2026-09-01T14:30");
  });

  it("is DST-safe for a zone that does observe DST (America/New_York spring-forward)", () => {
    const before = zonedDateTimeToUtc(2026, 3, 6, 9, 0, "America/New_York"); // EST, before transition
    const after = zonedDateTimeToUtc(2026, 3, 9, 9, 0, "America/New_York"); // EDT, after transition
    // Both represent 09:00 local time, but the UTC offset differs by 1 hour
    // across the transition - a naive "+3 days" would get this wrong.
    const diffHours = (after.getTime() - before.getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBe(3 * 24 - 1); // one hour less than 3 full days, because of spring-forward
  });

  it("formats an instant in the business timezone for display", () => {
    const formatted = formatInBusinessTimezone("2026-09-01T07:00:00.000Z");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("09:00");
  });

  it("returns null for a malformed datetime-local value instead of throwing", () => {
    expect(parseLocalDateTimeInZone("not-a-date", JHB)).toBeNull();
  });
});

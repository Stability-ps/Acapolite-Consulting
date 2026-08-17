import { describe, expect, it } from "vitest";
import {
  buildStaffPermissionsUpsert,
  defaultConsultantPermissions,
  fullStaffPermissions,
  hasStaffPermission,
  resolveStaffPermissions,
} from "./staffPermissions";

describe("Tax Coach staff permission", () => {
  it("always grants admins access", () => {
    expect(hasStaffPermission("admin", null, "can_use_tax_coach_ai")).toBe(true);
    expect(resolveStaffPermissions("admin", { can_use_tax_coach_ai: false })).toEqual(fullStaffPermissions);
  });

  it("grants an enabled practitioner access", () => {
    expect(hasStaffPermission(
      "consultant",
      { ...defaultConsultantPermissions, can_use_tax_coach_ai: true },
      "can_use_tax_coach_ai",
    )).toBe(true);
  });

  it("denies a disabled practitioner access", () => {
    expect(hasStaffPermission(
      "consultant",
      defaultConsultantPermissions,
      "can_use_tax_coach_ai",
    )).toBe(false);
  });

  it("persists the toggle in the staff permission upsert", () => {
    const payload = buildStaffPermissionsUpsert(
      "practitioner-id",
      "consultant",
      { ...defaultConsultantPermissions, can_use_tax_coach_ai: true },
    );

    expect(payload.profile_id).toBe("practitioner-id");
    expect(payload.can_use_tax_coach_ai).toBe(true);
  });
});

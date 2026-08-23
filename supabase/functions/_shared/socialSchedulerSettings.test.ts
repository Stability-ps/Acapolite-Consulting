import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeEffectiveAutoPublish, decideSetAutoPublish } from "./socialSchedulerSettings.ts";

Deno.test("env false + db false => publishing not allowed", () => {
  assertEquals(computeEffectiveAutoPublish(false, false), false);
});

Deno.test("env false + db true => publishing not allowed (env kill switch wins)", () => {
  assertEquals(computeEffectiveAutoPublish(false, true), false);
});

Deno.test("env true + db false => publishing not allowed (admin switch is off)", () => {
  assertEquals(computeEffectiveAutoPublish(true, false), false);
});

Deno.test("env true + db true => publishing allowed", () => {
  assertEquals(computeEffectiveAutoPublish(true, true), true);
});

// --- decideSetAutoPublish ----------------------------------------------

Deno.test("REGRESSION: a non-admin caller is refused regardless of the requested value", () => {
  assertEquals(decideSetAutoPublish({ isAdmin: false, currentEnabled: false, requestedEnabled: true }), { action: "forbidden" });
  assertEquals(decideSetAutoPublish({ isAdmin: false, currentEnabled: true, requestedEnabled: false }), { action: "forbidden" });
});

Deno.test("admin can enable: false -> true is an update", () => {
  assertEquals(decideSetAutoPublish({ isAdmin: true, currentEnabled: false, requestedEnabled: true }), { action: "update", enabled: true });
});

Deno.test("admin can disable: true -> false is an update", () => {
  assertEquals(decideSetAutoPublish({ isAdmin: true, currentEnabled: true, requestedEnabled: false }), { action: "update", enabled: false });
});

Deno.test("REGRESSION: repeated enable request (true -> true) is idempotent - no_change, not another update", () => {
  assertEquals(decideSetAutoPublish({ isAdmin: true, currentEnabled: true, requestedEnabled: true }), { action: "no_change", enabled: true });
});

Deno.test("REGRESSION: repeated disable request (false -> false) is idempotent - no_change, not another update", () => {
  assertEquals(decideSetAutoPublish({ isAdmin: true, currentEnabled: false, requestedEnabled: false }), { action: "no_change", enabled: false });
});

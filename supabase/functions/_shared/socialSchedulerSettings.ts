// Two independent switches gate automatic publishing:
//  - SOCIAL_AUTO_PUBLISH_ENABLED (env var, emergency kill switch): only an
//    operator with production environment access can flip this. It exists
//    so publishing can be killed even if the database or the admin UI is
//    compromised or misbehaving.
//  - social_scheduler_settings.auto_publish_enabled (DB row, admin toggle):
//    what the Social Media Overview ON/OFF switch actually controls.
// Both must independently allow publishing for the worker to do anything -
// see computeEffectiveAutoPublish. Manual "Publish now" bypasses this
// entirely (it's a single, explicit, one-post admin action - see
// social-publish-now), so this module only matters for the automatic
// cron path.
export function computeEffectiveAutoPublish(envKillSwitchAllows: boolean, dbAutoPublishEnabled: boolean): boolean {
  return envKillSwitchAllows === true && dbAutoPublishEnabled === true;
}

export function envKillSwitchAllowsPublishing(): boolean {
  return (Deno.env.get("SOCIAL_AUTO_PUBLISH_ENABLED") || "false").trim().toLowerCase() === "true";
}

// The business decision behind social-scheduler-settings' "set" action,
// pulled out as a pure function so it's directly testable: non-admins are
// refused regardless of the requested value, and repeating the same
// enable/disable request is a no-op (idempotent) rather than a fresh write
// + a fresh audit log entry every time.
export type SetAutoPublishDecision =
  | { action: "forbidden" }
  | { action: "no_change"; enabled: boolean }
  | { action: "update"; enabled: boolean };

export function decideSetAutoPublish(params: { isAdmin: boolean; currentEnabled: boolean; requestedEnabled: boolean }): SetAutoPublishDecision {
  if (!params.isAdmin) return { action: "forbidden" };
  if (params.currentEnabled === params.requestedEnabled) return { action: "no_change", enabled: params.requestedEnabled };
  return { action: "update", enabled: params.requestedEnabled };
}

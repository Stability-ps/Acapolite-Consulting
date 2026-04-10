import { BellRing, CheckCircle2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useWebPushNotifications } from "@/hooks/useWebPushNotifications";

type WebPushPromptProps = {
  profileLink?: string;
};

export function WebPushPrompt({ profileLink }: WebPushPromptProps) {
  const { enableNotifications, isConfigured, isSubscribed, isSupported, loading, permission } = useWebPushNotifications();

  if (!isSupported) {
    return null;
  }

  return (
    <section className="rounded-[28px] border border-border bg-card p-6 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.16em] text-primary/70 font-body">Browser Notifications</p>
          <h2 className="mt-2 font-display text-2xl text-foreground">
            {isSubscribed ? "Notifications are active" : "Stay on top of portal updates"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground font-body">
            {isSubscribed
              ? "New assignments, messages, invoices, and document requests can now reach this browser instantly."
              : !isConfigured
                ? "Push delivery will activate once the deployment VAPID keys are configured."
                : permission === "denied"
                  ? "Browser permission is currently blocked. Re-enable notifications in your browser settings to receive live updates."
                  : "Enable live browser alerts for new messages, case activity, invoices, and document requests."}
          </p>
        </div>

        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
          isSubscribed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-primary/20 bg-primary/10 text-primary"
        }`}>
          {isSubscribed ? <CheckCircle2 className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {!isSubscribed && isConfigured && permission !== "denied" ? (
          <Button type="button" className="rounded-xl" disabled={loading} onClick={() => void enableNotifications()}>
            {loading ? "Enabling..." : "Enable Notifications"}
          </Button>
        ) : null}

        {profileLink ? (
          <Button asChild type="button" variant="outline" className="rounded-xl">
            <Link to={profileLink}>
              Open My Profile
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}

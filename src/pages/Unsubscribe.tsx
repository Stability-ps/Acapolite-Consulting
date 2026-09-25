import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";

// Public page linked from Prospect Hub marketing emails. It only removes the
// address from Acapolite's marketing (prospect outreach) list; it never
// affects service emails to existing clients.
export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);

  const unsubscribe = async () => {
    setState("working");
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prospect-unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || "We could not process this request.");
      setMessage(data.message);
      setState("done");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not process this request.");
      setState("error");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm">
        <h1 className="font-display text-xl font-bold">Acapolite Consulting email preferences</h1>
        {!valid ? (
          <p className="mt-4 text-sm text-muted-foreground">This unsubscribe link is incomplete. Please use the link from the email, or email support@acapoliteconsulting.co.za and we will remove you.</p>
        ) : state === "done" ? (
          <p className="mt-4 text-sm text-foreground">{message}</p>
        ) : (
          <>
            <p className="mt-4 text-sm text-muted-foreground">Click below to stop receiving marketing emails from Acapolite Consulting.</p>
            <Button className="mt-5 w-full" disabled={state === "working"} onClick={() => void unsubscribe()}>{state === "working" ? "Unsubscribing…" : "Unsubscribe"}</Button>
            {state === "error" ? <p className="mt-3 text-sm text-destructive">{message}</p> : null}
          </>
        )}
      </div>
    </main>
  );
}

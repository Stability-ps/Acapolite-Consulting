import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getAppBaseUrl } from "@/lib/siteUrl";
import { toast } from "sonner";

interface GoogleAuthButtonProps {
  disabled?: boolean;
  onLoadingChange?: (loading: boolean) => void;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        fill="#EA4335"
        d="M12.24 10.285v3.821h5.445c-.234 1.23-.938 2.273-2 2.974l3.233 2.509c1.885-1.737 2.971-4.295 2.971-7.346 0-.704-.064-1.381-.182-2.045H12.24z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.965-.896 6.62-2.411l-3.233-2.509c-.896.6-2.045.955-3.387.955-2.609 0-4.82-1.761-5.61-4.128H3.048v2.59A9.996 9.996 0 0 0 12 22z"
      />
      <path
        fill="#4A90E2"
        d="M6.39 13.907A5.996 5.996 0 0 1 6.073 12c0-.663.114-1.307.317-1.907v-2.59H3.048A9.996 9.996 0 0 0 2 12c0 1.611.386 3.135 1.048 4.497l3.342-2.59z"
      />
      <path
        fill="#FBBC05"
        d="M12 5.965c1.468 0 2.786.505 3.823 1.496l2.868-2.868C16.96 2.982 14.696 2 12 2a9.996 9.996 0 0 0-8.952 5.503l3.342 2.59C7.18 7.726 9.391 5.965 12 5.965z"
      />
    </svg>
  );
}

export function GoogleAuthButton({ disabled, onLoadingChange }: GoogleAuthButtonProps) {
  const handleGoogleAuth = async () => {
    onLoadingChange?.(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${getAppBaseUrl()}/dashboard`,
        },
      });

      if (error) {
        toast.error(error.message);
        onLoadingChange?.(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to continue with Google.");
      onLoadingChange?.(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      onClick={() => void handleGoogleAuth()}
      className="w-full py-5 text-base font-semibold rounded-xl border-border bg-white"
    >
      <GoogleIcon />
      Continue with Google
    </Button>
  );
}

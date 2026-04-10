import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

export function useWebPushNotifications() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );

  const isSupported = useMemo(
    () =>
      typeof window !== "undefined"
      && typeof navigator !== "undefined"
      && "serviceWorker" in navigator
      && "PushManager" in window
      && "Notification" in window,
    [],
  );

  const syncCurrentSubscription = async () => {
    if (!user || !isSupported) {
      setIsSubscribed(false);
      return;
    }

    const { data, error } = await supabase.functions.invoke("web-push-config", {
      body: {},
    });

    if (error) {
      console.error("Unable to load web push config.", error);
      setIsConfigured(false);
      return;
    }

    const nextPublicKey = typeof data?.publicKey === "string" ? data.publicKey.trim() : "";
    setPublicKey(nextPublicKey || null);
    setIsConfigured(Boolean(data?.configured && nextPublicKey));
    setPermission(Notification.permission);

    if (!nextPublicKey) {
      setIsSubscribed(false);
      return;
    }

    const registration = await navigator.serviceWorker.register("/web-push-sw.js");
    const existingSubscription = await registration.pushManager.getSubscription();

    if (!existingSubscription) {
      setIsSubscribed(false);
      return;
    }

    setIsSubscribed(true);

    const subscriptionPayload = existingSubscription.toJSON();

    await supabase.from("push_subscriptions").upsert(
      {
        profile_id: user.id,
        endpoint: existingSubscription.endpoint,
        subscription: subscriptionPayload as Json,
        user_agent: navigator.userAgent,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
  };

  useEffect(() => {
    void syncCurrentSubscription();
  }, [user?.id, isSupported]);

  const enableNotifications = async () => {
    if (!user || !isSupported) {
      toast.error("This browser does not support push notifications.");
      return false;
    }

    if (!publicKey) {
      toast.error("Push notifications are not configured yet.");
      return false;
    }

    setLoading(true);

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== "granted") {
        toast.error("Notification permission was not granted.");
        setLoading(false);
        return false;
      }

      const registration = await navigator.serviceWorker.register("/web-push-sw.js");
      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription =
        existingSubscription
        ?? await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

      await supabase.from("push_subscriptions").upsert(
        {
          profile_id: user.id,
          endpoint: subscription.endpoint,
          subscription: subscription.toJSON() as Json,
          user_agent: navigator.userAgent,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );

      setIsSubscribed(true);
      setLoading(false);
      toast.success("Browser notifications are enabled.");
      return true;
    } catch (error) {
      console.error("Unable to enable notifications.", error);
      setLoading(false);
      toast.error("Unable to enable notifications on this browser.");
      return false;
    }
  };

  return {
    enableNotifications,
    isConfigured,
    isSubscribed,
    isSupported,
    loading,
    permission,
  };
}

import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";

export type AppNotification = Tables<"notifications">;
export type NotificationSection = "general" | "messages" | "requests" | "cases" | "documents";

function appendQueryParam(path: string, key: string, value: string) {
  if (!value || path.includes(`${key}=`)) {
    return path;
  }

  return `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

function resolveNotificationLink(notification: AppNotification) {
  const link = notification.link ?? "";
  const entityId = notification.entity_id ?? "";

  if (!link || !entityId) {
    return notification.link;
  }

  if (notification.entity_type === "conversation" || notification.section === "messages") {
    return appendQueryParam(link, "conversationId", entityId);
  }

  if (notification.entity_type === "service_request" || notification.section === "requests") {
    if (link.includes("/service-requests")) {
      return appendQueryParam(link, "leadId", entityId);
    }

    return appendQueryParam(link, "requestId", entityId);
  }

  if (notification.entity_type === "case" || notification.section === "cases") {
    return appendQueryParam(link, "caseId", entityId);
  }

  if (notification.entity_type === "document" || notification.section === "documents") {
    return appendQueryParam(link, "documentId", entityId);
  }

  if (notification.entity_type === "invoice") {
    return appendQueryParam(link, "invoiceId", entityId);
  }

  return notification.link;
}

function sanitizePractitionerNotification(notification: AppNotification) {
  if (notification.section !== "requests" || notification.entity_type !== "service_request") {
    return notification;
  }

  if (notification.category === "new_service_request") {
    return {
      ...notification,
      body: "A new service request is available in the marketplace.",
      link: resolveNotificationLink(notification),
    } satisfies AppNotification;
  }

  if (notification.category === "practitioner_assignment") {
    return {
      ...notification,
      body: "You were assigned to a service request.",
      link: resolveNotificationLink(notification),
    } satisfies AppNotification;
  }

  return {
    ...notification,
    link: resolveNotificationLink(notification),
  } satisfies AppNotification;
}

export function useNotifications() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return [];
      }

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_profile_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      return (data ?? []) as AppNotification[];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const channel = supabase.channel(`notifications-${user.id}-${crypto.randomUUID()}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `recipient_profile_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  const notifications = useMemo(() => {
    const items = query.data ?? [];

    if (role !== "consultant") {
      return items.map((notification) => ({
        ...notification,
        link: resolveNotificationLink(notification),
      }));
    }

    return items.map((notification) => sanitizePractitionerNotification(notification));
  }, [query.data, role]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications],
  );

  const unreadBySection = useMemo(() => {
    return notifications.reduce<Record<string, number>>((accumulator, notification) => {
      if (notification.is_read) {
        return accumulator;
      }

      accumulator[notification.section] = (accumulator[notification.section] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [notifications]);

  const markAsRead = useCallback(async (notificationIds: string[]) => {
    if (!user?.id || !notificationIds.length) {
      return;
    }

    const { error } = await supabase
      .from("notifications")
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq("recipient_profile_id", user.id)
      .in("id", notificationIds);

    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
    }
  }, [queryClient, user?.id]);

  const markSectionAsRead = useCallback(async (section: NotificationSection) => {
    if (!user?.id) {
      return;
    }

    const unreadIds = notifications
      .filter((notification) => notification.section === section && !notification.is_read)
      .map((notification) => notification.id);

    if (!unreadIds.length) {
      return;
    }

    await markAsRead(unreadIds);
  }, [markAsRead, notifications, user?.id]);

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    const unreadIds = notifications
      .filter((notification) => !notification.is_read)
      .map((notification) => notification.id);

    if (!unreadIds.length) {
      return;
    }

    await markAsRead(unreadIds);
  }, [markAsRead, notifications, user?.id]);

  return {
    notifications,
    unreadCount,
    unreadBySection,
    isLoading: query.isLoading,
    markAsRead,
    markSectionAsRead,
    markAllAsRead,
  };
}

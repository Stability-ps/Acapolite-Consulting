import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";

export type AppNotification = Tables<"notifications">;
export type NotificationSection = "general" | "messages" | "requests" | "cases" | "documents";

export function useNotifications() {
  const { user } = useAuth();
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

  const notifications = query.data ?? [];

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

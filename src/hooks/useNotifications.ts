import { useCallback, useEffect, useMemo } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";

export type AppNotification = Tables<"notifications">;
export type NotificationSection = "general" | "messages" | "requests" | "cases" | "documents";

const NOTIFICATIONS_PAGE_SIZE = 15;

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

function isVisibleToPractitioner(notification: AppNotification, profileId?: string) {
  if (!profileId) {
    return false;
  }

  const isAdminOnlyReactivationReview =
    notification.section === "requests"
    && notification.entity_type === "service_request"
    && (
      notification.title === "Lead needs reactivation review"
      || notification.body?.toLowerCase().includes("repeated reactivation threshold")
      || notification.category === "lead_reactivation_review"
    );

  if (isAdminOnlyReactivationReview) {
    return false;
  }

  const isPractitionerBlockedReactivationNotice =
    notification.section === "requests"
    && notification.entity_type === "service_request"
    && (
      notification.category === "lead_reactivated"
      || notification.title === "Lead reactivated"
      || notification.title === "Lead reactivated by client confirmation"
      || notification.body?.toLowerCase().includes("reactivated and returned")
    );

  if (isPractitionerBlockedReactivationNotice) {
    return false;
  }

  if (notification.section !== "documents") {
    return true;
  }

  if (notification.category === "document_uploaded") {
    const assignedPractitionerId = typeof notification.metadata === "object" && notification.metadata
      && "assigned_practitioner_id" in notification.metadata
      && typeof notification.metadata.assigned_practitioner_id === "string"
      ? notification.metadata.assigned_practitioner_id
      : null;

    return assignedPractitionerId === profileId;
  }

  if (notification.category === "document_status_changed") {
    return false;
  }

  return true;
}

export function useNotifications() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();

  const listQuery = useInfiniteQuery({
    queryKey: ["notifications", user?.id, "list"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (!user?.id) {
        return [];
      }

      const from = (pageParam as number) * NOTIFICATIONS_PAGE_SIZE;
      const to = from + NOTIFICATIONS_PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_profile_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        throw error;
      }

      return (data ?? []) as AppNotification[];
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < NOTIFICATIONS_PAGE_SIZE ? undefined : allPages.length,
    enabled: !!user?.id,
  });

  // Unread notifications are fetched separately so badge/section counts stay
  // accurate regardless of how many pages of the list have been loaded.
  const unreadQuery = useQuery({
    queryKey: ["notifications", user?.id, "unread"],
    queryFn: async () => {
      if (!user?.id) {
        return [];
      }

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_profile_id", user.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(200);

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

  const transformNotifications = useCallback((items: AppNotification[]) => {
    if (role !== "consultant") {
      return items.map((notification) => ({
        ...notification,
        link: resolveNotificationLink(notification),
      }));
    }

    return items
      .filter((notification) => isVisibleToPractitioner(notification, user?.id))
      .map((notification) => sanitizePractitionerNotification(notification));
  }, [role, user?.id]);

  const notifications = useMemo(
    () => transformNotifications(listQuery.data?.pages.flat() ?? []),
    [listQuery.data, transformNotifications],
  );

  const unreadNotifications = useMemo(
    () => transformNotifications(unreadQuery.data ?? []),
    [unreadQuery.data, transformNotifications],
  );

  const unreadCount = unreadNotifications.length;

  const unreadBySection = useMemo(() => {
    return unreadNotifications.reduce<Record<string, number>>((accumulator, notification) => {
      accumulator[notification.section] = (accumulator[notification.section] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [unreadNotifications]);

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

    const unreadIds = unreadNotifications
      .filter((notification) => notification.section === section)
      .map((notification) => notification.id);

    if (!unreadIds.length) {
      return;
    }

    await markAsRead(unreadIds);
  }, [markAsRead, unreadNotifications, user?.id]);

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    const unreadIds = unreadNotifications.map((notification) => notification.id);

    if (!unreadIds.length) {
      return;
    }

    await markAsRead(unreadIds);
  }, [markAsRead, unreadNotifications, user?.id]);

  return {
    notifications,
    unreadCount,
    unreadBySection,
    isLoading: listQuery.isLoading,
    hasMore: listQuery.hasNextPage,
    isLoadingMore: listQuery.isFetchingNextPage,
    loadMore: () => {
      if (listQuery.hasNextPage && !listQuery.isFetchingNextPage) {
        void listQuery.fetchNextPage();
      }
    },
    markAsRead,
    markSectionAsRead,
    markAllAsRead,
  };
}

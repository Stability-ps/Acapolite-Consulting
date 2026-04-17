import { useEffect } from "react";
import type { NotificationSection } from "@/hooks/useNotifications";
import { useNotifications } from "@/hooks/useNotifications";

export function useNotificationSectionRead(section: NotificationSection) {
  const { markSectionAsRead } = useNotifications();

  useEffect(() => {
    void markSectionAsRead(section);
  }, [markSectionAsRead, section]);
}

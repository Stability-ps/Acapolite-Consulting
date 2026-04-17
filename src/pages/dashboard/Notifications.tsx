import { useMemo, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNotifications, type NotificationSection } from "@/hooks/useNotifications";

type FilterValue = "all" | "unread" | NotificationSection;

function formatNotificationTime(value: string) {
  return new Date(value).toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSectionLabel(section: NotificationSection) {
  switch (section) {
    case "messages":
      return "Messages";
    case "requests":
      return "Requests";
    case "cases":
      return "Cases";
    case "documents":
      return "Documents";
    default:
      return "General";
  }
}

export default function Notifications() {
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, markAllAsRead, markAsRead } = useNotifications();
  const [filter, setFilter] = useState<FilterValue>("all");

  const filteredNotifications = useMemo(() => {
    if (filter === "all") {
      return notifications;
    }

    if (filter === "unread") {
      return notifications.filter((notification) => !notification.is_read);
    }

    return notifications.filter((notification) => notification.section === filter);
  }, [filter, notifications]);

  const openNotification = async (notificationId: string, link?: string | null) => {
    await markAsRead([notificationId]);

    if (link) {
      navigate(link);
    }
  };

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-1 font-display text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground font-body">Review recent activity, unread updates, and system alerts in one place.</p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-xs font-semibold">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </Badge>
          <div className="flex flex-wrap gap-2">
            <Select value={filter} onValueChange={(value) => setFilter(value as FilterValue)}>
              <SelectTrigger className="w-[180px] rounded-xl">
                <SelectValue placeholder="Filter notifications" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All notifications</SelectItem>
                <SelectItem value="unread">Unread only</SelectItem>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="messages">Messages</SelectItem>
                <SelectItem value="requests">Requests</SelectItem>
                <SelectItem value="cases">Cases</SelectItem>
                <SelectItem value="documents">Documents</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => void markAllAsRead()} disabled={unreadCount === 0}>
              <CheckCheck className="mr-2 h-4 w-4" />
              Mark all read
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground font-body">Loading notifications...</div>
      ) : filteredNotifications.length > 0 ? (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => void openNotification(notification.id, notification.link)}
              className={`w-full rounded-2xl border p-5 text-left transition hover:border-primary/30 hover:bg-accent/15 ${
                notification.is_read ? "border-border bg-card" : "border-primary/20 bg-primary/5"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <p className="font-body text-base font-semibold text-foreground">{notification.title}</p>
                    <Badge variant="secondary" className="rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em]">
                      {formatSectionLabel(notification.section)}
                    </Badge>
                  </div>
                  {notification.body ? (
                    <p className="text-sm leading-6 text-muted-foreground">{notification.body}</p>
                  ) : null}
                  <p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {formatNotificationTime(notification.created_at)}
                  </p>
                </div>
                {!notification.is_read ? (
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                ) : null}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-12 text-center">
          <Bell className="mx-auto mb-4 h-10 w-10 text-muted-foreground/60" />
          <p className="font-body text-foreground">No notifications found for this filter.</p>
          <p className="mt-2 text-sm text-muted-foreground">New activity will appear here automatically.</p>
        </div>
      )}
    </div>
  );
}

import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/hooks/useNotifications";

function formatNotificationTime(value: string) {
  return new Date(value).toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllAsRead, markAsRead } = useNotifications();

  const openNotification = async (notificationId: string, link?: string | null) => {
    await markAsRead([notificationId]);

    if (link) {
      navigate(link);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="relative h-11 rounded-full border-border/70 bg-white/80 px-4">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-sm">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] rounded-2xl p-0">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              <p className="text-xs text-muted-foreground">{unreadCount ? `${unreadCount} unread` : "All caught up"}</p>
            </div>
            {unreadCount > 0 ? (
              <Button type="button" variant="ghost" className="h-auto px-0 text-xs text-primary" onClick={() => void markAllAsRead()}>
                Mark all read
              </Button>
            ) : null}
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-2">
          {notifications.length ? notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() => void openNotification(notification.id, notification.link)}
              className={`w-full rounded-2xl border p-3 text-left transition hover:border-primary/30 hover:bg-accent/20 ${
                notification.is_read ? "border-transparent" : "border-primary/15 bg-primary/5"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                  {notification.body ? (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{notification.body}</p>
                  ) : null}
                  <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {`${notification.section} | ${formatNotificationTime(notification.created_at)}`}
                  </p>
                </div>
                {!notification.is_read ? (
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                ) : null}
              </div>
            </button>
          )) : (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

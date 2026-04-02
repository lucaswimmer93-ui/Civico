import React, { useMemo, useState } from "react";
import { useNotifications } from "../hooks/useNotifications";
import NotificationBell from "./NotificationBell";
import NotificationPanel from "./NotificationPanel";

/**
 * Erwartet den eingeloggten Supabase-Auth-User.
 * Wichtig: user.id muss auth.users.id sein.
 */
export default function NotificationsContainer({ user }) {
  const [open, setOpen] = useState(false);
  const userId = useMemo(() => user?.id ?? null, [user]);

  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  } = useNotifications(userId);

  if (!userId) return null;

  return (
    <div style={{ position: "relative" }}>
      <NotificationBell
        unreadCount={unreadCount}
        onClick={() => setOpen((prev) => !prev)}
      />

      {open && (
        <div
          style={{
            position: "absolute",
            top: "42px",
            right: 0,
            zIndex: 1000,
          }}
        >
          <NotificationPanel
            notifications={notifications}
            loading={loading}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
          />
        </div>
      )}
    </div>
  );
}

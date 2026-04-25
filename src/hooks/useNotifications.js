import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../lib/notifications";

/**
 * Erwartet auth.users.id als userId.
 */
export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(null);

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    const data = await fetchNotifications(userId);
    setNotifications(data);
  }, [userId]);

  const loadUnreadCount = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    const count = await fetchUnreadNotificationCount(userId);
    setUnreadCount(count);
  }, [userId]);

  const loadAll = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      await Promise.all([loadNotifications(), loadUnreadCount()]);
    } finally {
      setLoading(false);
    }
  }, [userId, loadNotifications, loadUnreadCount]);

  const recalcUnreadCount = useCallback((list) => {
    return list.filter((item) => !item.read_at && item.gelesen !== true).length;
  }, []);

  const markAsRead = useCallback(
    async (notificationId) => {
      await markNotificationAsRead(notificationId);

      setNotifications((prev) => {
        const next = prev.map((item) =>
          item.id === notificationId
            ? {
                ...item,
                read_at: new Date().toISOString(),
                gelesen: true,
              }
            : item
        );
        setUnreadCount(recalcUnreadCount(next));
        return next;
      });
    },
    [recalcUnreadCount]
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    await markAllNotificationsAsRead(userId);

    const now = new Date().toISOString();

    setNotifications((prev) => {
      const next = prev.map((item) => ({
        ...item,
        read_at: item.read_at ?? now,
        gelesen: true,
      }));
      setUnreadCount(0);
      return next;
    });
  }, [userId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new;

          setNotifications((prev) => {
            const exists = prev.some((item) => item.id === newNotification.id);
            const next = exists ? prev : [newNotification, ...prev];
            setUnreadCount(recalcUnreadCount(next));
            return next;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new;

          setNotifications((prev) => {
            const next = prev.map((item) =>
              item.id === updated.id ? updated : item
            );
            setUnreadCount(recalcUnreadCount(next));
            return next;
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, recalcUnreadCount]);

  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.read_at && item.gelesen !== true),
    [notifications]
  );

  return {
    notifications,
    unreadNotifications,
    unreadCount,
    loading,
    reload: loadAll,
    markAsRead,
    markAllAsRead,
  };
}

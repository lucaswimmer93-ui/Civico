import { supabase } from "./supabaseClient";

/**
 * Lädt alle Notifications des aktuell eingeloggten auth.users-Users.
 */
export async function fetchNotifications(userId) {
  const { data, error } = await supabase
    .from("notifications")
    .select(`
      id,
      titel,
      text,
      typ,
      gelesen,
      read_at,
      created_at,
      payload,
      stelle_id,
      termin_id
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Zählt ungelesene Notifications.
 * Hybrid-sicher: Primär read_at = null.
 */
export async function fetchUnreadNotificationCount(userId) {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) throw error;
  return count ?? 0;
}

/**
 * Markiert genau eine Notification als gelesen.
 */
export async function markNotificationAsRead(notificationId) {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("notifications")
    .update({
      read_at: now,
      gelesen: true,
    })
    .eq("id", notificationId);

  if (error) throw error;
}

/**
 * Markiert alle ungelesenen Notifications des Users als gelesen.
 */
export async function markAllNotificationsAsRead(userId) {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("notifications")
    .update({
      read_at: now,
      gelesen: true,
    })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) throw error;
}

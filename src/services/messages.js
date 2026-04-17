// FINAL CLEAN messages.js PATCH (read + unread stable, no broken exports)

import { supabase } from "../core/shared";

/**
 * Letzte Nachricht pro Thread holen (performant)
 */
export async function getLastMessagesForThreads(threadIds = []) {
  if (!threadIds.length) return {};

  const map = {};

  for (const threadId of threadIds) {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      map[threadId] = data;
    }
  }

  return map;
}

/**
 * Read Status für Threads
 */
export async function getReadStatesForThreads(threadIds = []) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !threadIds.length) return {};

  const { data, error } = await supabase
    .from("message_read_status")
    .select("thread_id, user_id, last_read_at")
    .in("thread_id", threadIds);

  if (error) throw error;

  const map = {};

  for (const row of data || []) {
    if (row.user_id === user.id) {
      map[row.thread_id] = row.last_read_at;
    }
  }

  return map;
}

/**
 * Zentrale Unread-Logik (für alle Rollen gleich)
 */
export async function enrichThreadsWithMeta(threads = []) {
  if (!threads.length) return [];

  const threadIds = threads.map((t) => t.id);

  const lastMessages = await getLastMessagesForThreads(threadIds);
  const readStates = await getReadStatesForThreads(threadIds);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return threads.map((thread) => {
    const lastMessage = lastMessages[thread.id];
    const lastRead = readStates[thread.id];

    const hasUnread =
      lastMessage &&
      lastMessage.sender_user_id !== user?.id &&
      (!lastRead || lastMessage.created_at > lastRead);

    return {
      ...thread,
      last_message: lastMessage || null,
      has_unread: !!hasUnread,
    };
  });
}

/**
 * Einzelner Thread Read State (für Chat-Ansicht)
 */
export async function getThreadReadState(threadId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("message_read_status")
    .select("user_id, last_read_at")
    .eq("thread_id", threadId);

  if (error) throw error;

  const others = (data || []).filter((r) => r.user_id !== user.id);

  const lastReadByOthersAt = others.reduce((max, r) => {
    if (!r.last_read_at) return max;
    return !max || r.last_read_at > max ? r.last_read_at : max;
  }, null);

  return {
    currentUserId: user.id,
    lastReadByOthersAt,
  };
}

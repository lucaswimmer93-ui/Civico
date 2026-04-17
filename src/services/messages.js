import { supabase } from "../core/shared";

let authUserCache = null;
let authUserCacheAt = 0;
let actorCache = null;
let actorCacheAt = 0;
const AUTH_CACHE_TTL_MS = 5000;
const ACTOR_CACHE_TTL_MS = 5000;
const supportThreadCache = new Map();

function isFresh(timestamp, ttl) {
  return Date.now() - timestamp < ttl;
}

export async function getAuthUserOrThrow(forceRefresh = false) {
  if (!forceRefresh && authUserCache && isFresh(authUserCacheAt, AUTH_CACHE_TTL_MS)) {
    return authUserCache;
  }

  const sessionRes = await supabase.auth.getSession();
  const sessionError = sessionRes?.error;
  const session = sessionRes?.data?.session || null;

  if (sessionError) throw sessionError;
  if (session?.user) {
    authUserCache = session.user;
    authUserCacheAt = Date.now();
    return session.user;
  }

  const userRes = await supabase.auth.getUser();
  const userError = userRes?.error;
  const user = userRes?.data?.user || null;

  if (userError) throw userError;
  if (!user) throw new Error("Kein eingeloggter User");

  authUserCache = user;
  authUserCacheAt = Date.now();
  return user;
}

export function clearMessageServiceCache() {
  authUserCache = null;
  authUserCacheAt = 0;
  actorCache = null;
  actorCacheAt = 0;
  supportThreadCache.clear();
}

if (typeof window !== "undefined" && !window.__civicoMessagesAuthListenerBound) {
  window.__civicoMessagesAuthListenerBound = true;
  supabase.auth.onAuthStateChange(() => {
    clearMessageServiceCache();
  });
}

function getStoredLastRole() {
  if (typeof window === "undefined") return null;

  try {
    return (
      window.localStorage?.getItem("civico_last_role") ||
      window.sessionStorage?.getItem("civico_last_role") ||
      null
    );
  } catch {
    return null;
  }
}

/**
 * Aktuellen User bestimmen
 * Reihenfolge bewusst:
 * 1. Verein
 * 2. Gemeinde
 * 3. Admin
 * 4. Freiwilliger
 */
export async function getCurrentActor(forceRefresh = false) {
  if (!forceRefresh && actorCache && isFresh(actorCacheAt, ACTOR_CACHE_TTL_MS)) {
    return actorCache;
  }

  const user = await getAuthUserOrThrow(forceRefresh);

  const authId = user.id;

  const [vereinRes, gemeindeRes, adminRes, freiwilligerRes] = await Promise.all([
    supabase.from("vereine").select("id, name, gemeinde_id, auth_id").eq("auth_id", authId).maybeSingle(),
    supabase.from("gemeinden").select("id, name, email, telefon, ansprechpartner_name, auth_id").eq("auth_id", authId).maybeSingle(),
    supabase.from("admins").select("id, email, auth_id").eq("auth_id", authId).maybeSingle(),
    supabase.from("freiwillige").select("id, name, email, auth_id").eq("auth_id", authId).maybeSingle(),
  ]);

  if (vereinRes.error) throw vereinRes.error;
  if (gemeindeRes.error) throw gemeindeRes.error;
  if (adminRes.error) throw adminRes.error;
  if (freiwilligerRes.error) throw freiwilligerRes.error;

  const roleMap = {
    verein: vereinRes.data
      ? {
          role: "verein",
          userId: authId,
          organizationId: vereinRes.data.id,
          data: vereinRes.data,
          name: vereinRes.data.name,
        }
      : null,
    gemeinde: gemeindeRes.data
      ? {
          role: "gemeinde",
          userId: authId,
          organizationId: gemeindeRes.data.id,
          data: gemeindeRes.data,
          name: gemeindeRes.data.name,
        }
      : null,
    admin: adminRes.data
      ? {
          role: "admin",
          userId: authId,
          organizationId: adminRes.data.id,
          data: adminRes.data,
          name: adminRes.data.email || "Admin",
        }
      : null,
    freiwilliger: freiwilligerRes.data
      ? {
          role: "freiwilliger",
          userId: authId,
          organizationId: freiwilligerRes.data.id,
          data: freiwilligerRes.data,
          name: freiwilligerRes.data.name,
        }
      : null,
  };

  const preferredRole = getStoredLastRole();
  if (preferredRole && roleMap[preferredRole]) {
    return roleMap[preferredRole];
  }

  return (
    roleMap.verein ||
    roleMap.gemeinde ||
    roleMap.admin ||
    roleMap.freiwilliger ||
    (() => {
      throw new Error("User hat keine gültige Rolle");
    })()
  );
}

/**
 * Verein <-> Gemeinde Thread
 */
export async function getOrCreateVereinGemeindeThread(vereinId = null) {
  const actor = await getCurrentActor();

  let finalVereinId = vereinId;
  let finalGemeindeId = null;

  if (actor.role === "verein") {
    finalVereinId = actor.organizationId;

    const { data: verein, error: vereinError } = await supabase
      .from("vereine")
      .select("id, gemeinde_id")
      .eq("id", actor.organizationId)
      .single();

    if (vereinError) throw vereinError;
    if (!verein) throw new Error("Verein nicht gefunden.");

    finalGemeindeId = verein.gemeinde_id;
  } else if (actor.role === "gemeinde") {
    if (!vereinId) throw new Error("vereinId fehlt");

    const { data: verein, error: vereinError } = await supabase
      .from("vereine")
      .select("id, gemeinde_id")
      .eq("id", vereinId)
      .maybeSingle();

    if (vereinError) throw vereinError;
    if (!verein) throw new Error("Verein nicht gefunden.");
    if (verein.gemeinde_id !== actor.organizationId) {
      throw new Error("Dieser Verein gehört nicht zu deiner Gemeinde.");
    }

    finalGemeindeId = actor.organizationId;
  } else if (actor.role === "admin") {
    if (!vereinId) throw new Error("vereinId fehlt");

    const { data: verein, error: vereinError } = await supabase
      .from("vereine")
      .select("id, gemeinde_id")
      .eq("id", vereinId)
      .single();

    if (vereinError) throw vereinError;
    if (!verein) throw new Error("Verein nicht gefunden.");

    finalGemeindeId = verein.gemeinde_id;
  } else {
    throw new Error("Ungültige Rolle.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("message_threads")
    .select("*")
    .eq("thread_type", "verein_gemeinde")
    .eq("verein_id", finalVereinId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) {
    supportThreadCache.set(cacheKey, existing);
    return existing;
  }

  const { data: created, error: createError } = await supabase
    .from("message_threads")
    .insert([
      {
        thread_type: "verein_gemeinde",
        verein_id: finalVereinId,
        gemeinde_id: finalGemeindeId,
        created_by_user_id: actor.userId,
        last_message_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (createError) throw createError;

  return created;
}

/**
 * Support-Thread
 */
export async function getOrCreateSupportThread() {
  const actor = await getCurrentActor();

  if (actor.role === "admin") {
    throw new Error("Admin benötigt keinen eigenen Support-Thread.");
  }

  const matchField =
    actor.role === "verein"
      ? { verein_id: actor.organizationId }
      : actor.role === "gemeinde"
      ? { gemeinde_id: actor.organizationId }
      : actor.role === "freiwilliger"
      ? { freiwilliger_id: actor.organizationId }
      : null;

  if (!matchField) {
    throw new Error("Ungültige Rolle für Support-Thread.");
  }

  const cacheKey = `${actor.role}:${actor.organizationId}`;
  if (supportThreadCache.has(cacheKey)) {
    return supportThreadCache.get(cacheKey);
  }

  const { data: existing, error: existingError } = await supabase
    .from("message_threads")
    .select("*")
    .eq("thread_type", "support")
    .match(matchField)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) {
    supportThreadCache.set(cacheKey, existing);
    return existing;
  }

  const payload = {
    thread_type: "support",
    verein_id: actor.role === "verein" ? actor.organizationId : null,
    gemeinde_id: actor.role === "gemeinde" ? actor.organizationId : null,
    freiwilliger_id: actor.role === "freiwilliger" ? actor.organizationId : null,
    created_by_user_id: actor.userId,
    last_message_at: new Date().toISOString(),
  };

  const { data: created, error: createError } = await supabase
    .from("message_threads")
    .insert([payload])
    .select()
    .single();

  if (createError) throw createError;

  supportThreadCache.set(cacheKey, created);
  return created;
}

/**
 * Meine Gemeinde für Verein
 */
export async function getMeineGemeinde() {
  const actor = await getCurrentActor();

  if (actor.role !== "verein") {
    throw new Error("Nur Vereine haben 'Meine Gemeinde'.");
  }

  const { data: verein, error: vereinError } = await supabase
    .from("vereine")
    .select("id, gemeinde_id")
    .eq("id", actor.organizationId)
    .single();

  if (vereinError) throw vereinError;
  if (!verein?.gemeinde_id) {
    throw new Error("Diesem Verein ist keine Gemeinde zugeordnet.");
  }

  const { data, error } = await supabase
    .from("gemeinden")
    .select("id, name, email, telefon, ansprechpartner_name")
    .eq("id", verein.gemeinde_id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Gemeindeliste der Vereine
 */
export async function getGemeindeVereine() {
  const actor = await getCurrentActor();

  if (actor.role !== "gemeinde" && actor.role !== "admin") {
    throw new Error("Nur Gemeinde oder Admin darf Vereinslisten abrufen.");
  }

  if (actor.role === "gemeinde") {
    const { data, error } = await supabase
      .from("vereine")
      .select("id, name, email, telefon, gemeinde_id")
      .eq("gemeinde_id", actor.organizationId)
      .order("name", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  const { data, error } = await supabase
    .from("vereine")
    .select("id, name, email, telefon, gemeinde_id")
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Admin Support Threads
 */
export async function getAdminSupportThreads() {
  const user = await getAuthUserOrThrow();

  const { data: admin, error: adminError } = await supabase
    .from("admins")
    .select("id, auth_id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (adminError) throw adminError;
  if (!admin) {
    throw new Error("Nur Admin darf Support-Threads abrufen.");
  }

  const { data, error } = await supabase
    .from("message_threads")
    .select(`
      *,
      vereine ( id, name, email ),
      gemeinden ( id, name, email ),
      freiwillige ( id, name, email )
    `)
    .eq("thread_type", "support")
    .order("last_message_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Neuer Direktchat:
 * 1 Termin + 1 Verein + 1 Freiwilliger = 1 Thread
 */
export async function getOrCreateTerminDirectThread(terminId, freiwilligerId = null) {
  const actor = await getCurrentActor();

  if (!terminId) throw new Error("terminId fehlt");

  const { data: termin, error: terminError } = await supabase
    .from("termine")
    .select("id, stelle_id, stellen!inner(id, verein_id)")
    .eq("id", terminId)
    .single();

  if (terminError) throw terminError;
  if (!termin) throw new Error("Termin nicht gefunden.");

  const vereinId = Array.isArray(termin.stellen)
    ? termin.stellen[0]?.verein_id
    : termin.stellen?.verein_id;

  if (!vereinId) {
    throw new Error("Verein konnte nicht ermittelt werden.");
  }

  let finalFreiwilligerId = freiwilligerId;

  if (actor.role === "freiwilliger") {
    finalFreiwilligerId = actor.organizationId;

    const { data: bewerbung, error: bewerbungError } = await supabase
      .from("bewerbungen")
      .select("id, status")
      .eq("termin_id", terminId)
      .eq("freiwilliger_id", finalFreiwilligerId)
      .maybeSingle();

    if (bewerbungError) throw bewerbungError;
    if (!bewerbung) {
      throw new Error("Du bist für diesen Termin nicht angemeldet.");
    }

    const status = String(bewerbung.status || "").toLowerCase();
    if (["storniert", "abgesagt", "cancelled", "canceled"].includes(status)) {
      throw new Error("Für diesen Termin besteht keine aktive Anmeldung.");
    }
  }

  if (actor.role === "verein") {
    if (vereinId !== actor.organizationId) {
      throw new Error("Termin gehört nicht zu deinem Verein.");
    }

    if (!finalFreiwilligerId) {
      throw new Error("freiwilligerId fehlt");
    }

    const { data: bewerbung, error: bewerbungError } = await supabase
      .from("bewerbungen")
      .select("id, status")
      .eq("termin_id", terminId)
      .eq("freiwilliger_id", finalFreiwilligerId)
      .maybeSingle();

    if (bewerbungError) throw bewerbungError;
    if (!bewerbung) {
      throw new Error("Dieser Freiwillige ist für den Termin nicht angemeldet.");
    }

    const status = String(bewerbung.status || "").toLowerCase();
    if (["storniert", "abgesagt", "cancelled", "canceled"].includes(status)) {
      throw new Error("Für diesen Freiwilligen besteht keine aktive Anmeldung.");
    }
  }

  if (actor.role === "admin") {
    if (!finalFreiwilligerId) {
      throw new Error("freiwilligerId fehlt");
    }
  }

  const { data: existing, error: existingError } = await supabase
    .from("message_threads")
    .select("*")
    .eq("thread_type", "termin_direct")
    .eq("termin_id", terminId)
    .eq("verein_id", vereinId)
    .eq("freiwilliger_id", finalFreiwilligerId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) {
    supportThreadCache.set(cacheKey, existing);
    return existing;
  }

  const { data: created, error: createError } = await supabase
    .from("message_threads")
    .insert([
      {
        thread_type: "termin_direct",
        termin_id: terminId,
        verein_id: vereinId,
        freiwilliger_id: finalFreiwilligerId,
        created_by_user_id: actor.userId,
        last_message_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (createError) throw createError;

  return created;
}

/**
 * Meine Direktchats als Freiwilliger
 */
export async function getMyTerminDirectThreads() {
  const actor = await getCurrentActor();

  if (actor.role !== "freiwilliger") return [];

  const { data, error } = await supabase
    .from("message_threads")
    .select(`
      *,
      termine ( id, datum, startzeit, endzeit, stelle_id ),
      vereine ( id, name )
    `)
    .eq("thread_type", "termin_direct")
    .eq("freiwilliger_id", actor.organizationId)
    .order("last_message_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Direktchats eines Vereins für einen Termin
 */
export async function getTerminDirectThreadsForVerein(terminId) {
  const actor = await getCurrentActor();

  if (actor.role !== "verein") return [];

  const { data: threads, error: threadsError } = await supabase
    .from("message_threads")
    .select("*")
    .eq("thread_type", "termin_direct")
    .eq("termin_id", terminId)
    .eq("verein_id", actor.organizationId)
    .order("last_message_at", { ascending: false });

  if (threadsError) throw threadsError;

  const threadList = threads ?? [];

  const freiwilligerIds = [
    ...new Set(threadList.map((t) => t.freiwilliger_id).filter(Boolean)),
  ];

  if (freiwilligerIds.length === 0) {
    return threadList;
  }

  const { data: freiwillige, error: freiwilligeError } = await supabase
    .from("freiwillige")
    .select("id, name, email")
    .in("id", freiwilligerIds);

  if (freiwilligeError) throw freiwilligeError;

  const map = new Map(
    (freiwillige ?? []).map((f) => [f.id, f])
  );

  return threadList.map((thread) => ({
    ...thread,
    freiwillige: map.get(thread.freiwilliger_id) || null,
  }));
}

/**
 * Nachrichten laden
 */
export async function getThreadMessages(threadId) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Nachricht senden
 */
export async function sendMessage(threadId, body) {
  const actor = await getCurrentActor();

  if (!body?.trim()) {
    throw new Error("Nachricht leer");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert([
      {
        thread_id: threadId,
        sender_user_id: actor.userId,
        sender_role: actor.role,
        body: body.trim(),
      },
    ])
    .select()
    .single();

  if (error) throw error;

  const { error: threadUpdateError } = await supabase
    .from("message_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", threadId);

  if (threadUpdateError) throw threadUpdateError;

  return data;
}

/**
 * Read-Status setzen
 */
export async function markThreadAsRead(threadId) {
  const actor = await getCurrentActor();

  const { error } = await supabase
    .from("message_read_status")
    .upsert(
      [
        {
          thread_id: threadId,
          user_id: actor.userId,
          last_read_at: new Date().toISOString(),
        },
      ],
      {
        onConflict: "thread_id,user_id",
      }
    );

  if (error) throw error;
}


export async function getUnreadCountsForThreads(threadIds = [], authUserId = null) {
  const cleanThreadIds = [...new Set((threadIds || []).filter(Boolean))];
  const userId = authUserId || (await getAuthUserOrThrow()).id;

  if (!cleanThreadIds.length || !userId) {
    return { unreadByThread: new Map(), unreadTotal: 0 };
  }

  const [
    { data: readRows, error: readError },
    { data: threadRows, error: threadError },
    { data: messageRows, error: messageError },
  ] = await Promise.all([
    supabase
      .from("message_read_status")
      .select("thread_id, last_read_at")
      .eq("user_id", userId)
      .in("thread_id", cleanThreadIds),
    supabase
      .from("message_threads")
      .select("id, last_message_at")
      .in("id", cleanThreadIds),
    supabase
      .from("messages")
      .select("thread_id, sender_user_id, created_at")
      .in("thread_id", cleanThreadIds)
      .order("created_at", { ascending: false }),
  ]);

  if (readError) throw readError;
  if (threadError) throw threadError;
  if (messageError) throw messageError;

  const readMap = new Map(
    (readRows || []).map((row) => [
      row.thread_id,
      row.last_read_at ? new Date(row.last_read_at).getTime() : 0,
    ])
  );

  const latestMessageByThread = new Map();
  for (const row of messageRows || []) {
    if (!row?.thread_id || latestMessageByThread.has(row.thread_id)) continue;
    latestMessageByThread.set(row.thread_id, row);
  }

  const unreadByThread = new Map();

  for (const thread of threadRows || []) {
    const threadId = thread?.id;
    if (!threadId) continue;

    const lastMessageAt = thread?.last_message_at
      ? new Date(thread.last_message_at).getTime()
      : 0;
    const lastReadAt = readMap.get(threadId) || 0;
    const latestMessage = latestMessageByThread.get(threadId);
    const lastMessageFromSomeoneElse =
      latestMessage?.sender_user_id && latestMessage.sender_user_id !== userId;

    unreadByThread.set(
      threadId,
      lastMessageAt && lastMessageAt > lastReadAt && lastMessageFromSomeoneElse ? 1 : 0
    );
  }

  const unreadTotal = Array.from(unreadByThread.values()).reduce(
    (sum, value) => sum + value,
    0
  );

  return { unreadByThread, unreadTotal };
}

export async function getThreadReadMeta(threadId, currentUserId = null) {
  const userId = currentUserId || (await getAuthUserOrThrow()).id;

  if (!threadId || !userId) {
    return {
      currentUserId: userId || null,
      myLastReadAt: null,
      otherLastReadAt: null,
      hasOtherReader: false,
    };
  }

  const { data, error } = await supabase
    .from("message_read_status")
    .select("user_id, last_read_at")
    .eq("thread_id", threadId);

  if (error) throw error;

  let myLastReadAt = null;
  let otherLastReadAt = null;
  let hasOtherReader = false;

  for (const row of data || []) {
    const ts = row?.last_read_at ? new Date(row.last_read_at).getTime() : null;
    if (!ts) continue;

    if (row.user_id === userId) {
      myLastReadAt = ts;
    } else {
      hasOtherReader = true;
      if (!otherLastReadAt || ts > otherLastReadAt) {
        otherLastReadAt = ts;
      }
    }
  }

  return {
    currentUserId: userId,
    myLastReadAt,
    otherLastReadAt,
    hasOtherReader,
  };
}

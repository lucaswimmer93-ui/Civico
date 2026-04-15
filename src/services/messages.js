import { supabase } from "../lib/supabaseclient";

/**
 * Aktuellen User bestimmen
 * Reihenfolge bewusst:
 * 1. Verein
 * 2. Gemeinde
 * 3. Admin
 * 4. Freiwilliger
 */
export async function getCurrentActor() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("Kein eingeloggter User");

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

  if (vereinRes.data) {
    return {
      role: "verein",
      userId: authId,
      organizationId: vereinRes.data.id,
      data: vereinRes.data,
      name: vereinRes.data.name,
    };
  }

  if (gemeindeRes.data) {
    return {
      role: "gemeinde",
      userId: authId,
      organizationId: gemeindeRes.data.id,
      data: gemeindeRes.data,
      name: gemeindeRes.data.name,
    };
  }

  if (adminRes.data) {
    return {
      role: "admin",
      userId: authId,
      organizationId: adminRes.data.id,
      data: adminRes.data,
      name: adminRes.data.email || "Admin",
    };
  }

  if (freiwilligerRes.data) {
    return {
      role: "freiwilliger",
      userId: authId,
      organizationId: freiwilligerRes.data.id,
      data: freiwilligerRes.data,
      name: freiwilligerRes.data.name,
    };
  }

  throw new Error("User hat keine gültige Rolle");
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
  if (existing) return existing;

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
        : { freiwilliger_id: actor.organizationId };

  const { data: existing, error: existingError } = await supabase
    .from("message_threads")
    .select("*")
    .eq("thread_type", "support")
    .match(matchField)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

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
  const actor = await getCurrentActor();

  if (actor.role !== "admin") {
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
  if (existing) return existing;

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

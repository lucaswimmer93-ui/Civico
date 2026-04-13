import { supabase } from "../lib/supabaseclient";

/**
 * Aktuellen User bestimmen
 */
export async function getCurrentActor() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Kein eingeloggter User");

  const authId = user.id;

  // Wichtig: Reihenfolge!
  const { data: verein } = await supabase
    .from("vereine")
    .select("id, name, auth_id")
    .eq("auth_id", authId)
    .maybeSingle();

  if (verein) {
    return {
      role: "verein",
      userId: authId,
      organizationId: verein.id,
      name: verein.name,
    };
  }

  const { data: freiwilliger } = await supabase
    .from("freiwillige")
    .select("id, name, auth_id")
    .eq("auth_id", authId)
    .maybeSingle();

  if (freiwilliger) {
    return {
      role: "freiwilliger",
      userId: authId,
      organizationId: freiwilliger.id,
      name: freiwilliger.name,
    };
  }

  throw new Error("User hat keine gültige Rolle");
}

/**
 * 🔥 NEU: Direktchat pro Termin + User
 */
export async function getOrCreateTerminDirectThread(
  terminId,
  freiwilligerId = null
) {
  const actor = await getCurrentActor();

  if (!terminId) throw new Error("terminId fehlt");

  // Termin laden
  const { data: termin, error: terminError } = await supabase
    .from("termine")
    .select("id, stellen!inner(verein_id)")
    .eq("id", terminId)
    .single();

  if (terminError) throw terminError;

  const vereinId = Array.isArray(termin.stellen)
    ? termin.stellen[0].verein_id
    : termin.stellen.verein_id;

  let finalFreiwilligerId = freiwilligerId;

  // 👤 Freiwilliger
  if (actor.role === "freiwilliger") {
    finalFreiwilligerId = actor.organizationId;

    const { data: bewerbung } = await supabase
      .from("bewerbungen")
      .select("id")
      .eq("termin_id", terminId)
      .eq("freiwilliger_id", finalFreiwilligerId)
      .maybeSingle();

    if (!bewerbung) {
      throw new Error("Du bist für diesen Termin nicht angemeldet.");
    }
  }

  // 🏢 Verein
  if (actor.role === "verein") {
    if (vereinId !== actor.organizationId) {
      throw new Error("Termin gehört nicht zu deinem Verein.");
    }

    if (!finalFreiwilligerId) {
      throw new Error("freiwilligerId fehlt");
    }
  }

  // 🔎 bestehenden Thread suchen
  const { data: existing } = await supabase
    .from("message_threads")
    .select("*")
    .eq("thread_type", "termin_direct")
    .eq("termin_id", terminId)
    .eq("verein_id", vereinId)
    .eq("freiwilliger_id", finalFreiwilligerId)
    .maybeSingle();

  if (existing) return existing;

  // ➕ neuen Thread erstellen
  const { data: created, error } = await supabase
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

  if (error) throw error;

  return created;
}

/**
 * 📥 Nachrichten laden
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
 * 📤 Nachricht senden
 */
export async function sendMessage(threadId, body) {
  const actor = await getCurrentActor();

  if (!body?.trim()) throw new Error("Nachricht leer");

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

  await supabase
    .from("message_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", threadId);

  return data;
}

/**
 * 📥 Meine Chats (Freiwilliger)
 */
export async function getMyTerminDirectThreads() {
  const actor = await getCurrentActor();

  if (actor.role !== "freiwilliger") return [];

  const { data, error } = await supabase
    .from("message_threads")
    .select(`
      *,
      termine (id, datum),
      vereine (name)
    `)
    .eq("thread_type", "termin_direct")
    .eq("freiwilliger_id", actor.organizationId)
    .order("last_message_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

/**
 * 📥 Verein sieht Chats pro Termin
 */
export async function getTerminDirectThreadsForVerein(terminId) {
  const actor = await getCurrentActor();

  if (actor.role !== "verein") return [];

  const { data, error } = await supabase
    .from("message_threads")
    .select(`
      *,
      freiwillige (id, name)
    `)
    .eq("thread_type", "termin_direct")
    .eq("termin_id", terminId)
    .eq("verein_id", actor.organizationId)
    .order("last_message_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

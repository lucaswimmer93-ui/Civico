import { supabase } from "../lib/supabase";

/**
 * Hilfsfunktion: Rolle des aktuellen Users bestimmen
 * Erwartet, dass auth.uid() in genau einer der Tabellen existiert:
 * - vereine.auth_id
 * - gemeinden.auth_id
 * - admins.auth_id
 */
export async function getCurrentActor() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("Kein eingeloggter User gefunden.");

  const authId = user.id;

  const [vereinRes, gemeindeRes, adminRes] = await Promise.all([
    supabase
      .from("vereine")
      .select("id, name, gemeinde_id, auth_id")
      .eq("auth_id", authId)
      .maybeSingle(),

    supabase
      .from("gemeinden")
      .select("id, name, email, telefon, ansprechpartner_name, auth_id")
      .eq("auth_id", authId)
      .maybeSingle(),

    supabase
      .from("admins")
      .select("id, email, auth_id")
      .eq("auth_id", authId)
      .maybeSingle(),
  ]);

  if (vereinRes.error) throw vereinRes.error;
  if (gemeindeRes.error) throw gemeindeRes.error;
  if (adminRes.error) throw adminRes.error;

  if (vereinRes.data) {
    return {
      role: "verein",
      userId: authId,
      organizationId: vereinRes.data.id,
      data: vereinRes.data,
    };
  }

  if (gemeindeRes.data) {
    return {
      role: "gemeinde",
      userId: authId,
      organizationId: gemeindeRes.data.id,
      data: gemeindeRes.data,
    };
  }

  if (adminRes.data) {
    return {
      role: "admin",
      userId: authId,
      organizationId: adminRes.data.id,
      data: adminRes.data,
    };
  }

  throw new Error("Der aktuelle User ist keiner Rolle zugeordnet.");
}

/**
 * Verein <-> Gemeinde:
 * Genau 1 Thread pro Verein
 */
export async function getOrCreateVereinGemeindeThread(vereinId = null) {
  const actor = await getCurrentActor();

  // Verein-ID und Gemeinde-ID sauber bestimmen
  let finalVereinId = vereinId;
  let finalGemeindeId = null;

  if (actor.role === "verein") {
    finalVereinId = actor.organizationId;
    finalGemeindeId = actor.data.gemeinde_id;
  } else if (actor.role === "gemeinde") {
    const { data: verein, error: vereinError } = await supabase
      .from("vereine")
      .select("id, gemeinde_id")
      .eq("id", vereinId)
      .single();

    if (vereinError) throw vereinError;
    if (!verein) throw new Error("Verein nicht gefunden.");

    if (verein.gemeinde_id !== actor.organizationId) {
      throw new Error("Dieser Verein gehört nicht zu deiner Gemeinde.");
    }

    finalGemeindeId = actor.organizationId;
  } else if (actor.role === "admin") {
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

  const { data: existingThread, error: existingError } = await supabase
    .from("message_threads")
    .select("*")
    .eq("thread_type", "verein_gemeinde")
    .eq("verein_id", finalVereinId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existingThread) return existingThread;

  const { data: createdThread, error: createError } = await supabase
    .from("message_threads")
    .insert([
      {
        thread_type: "verein_gemeinde",
        verein_id: finalVereinId,
        gemeinde_id: finalGemeindeId,
        created_by_user_id: actor.userId,
      },
    ])
    .select()
    .single();

  if (createError) throw createError;

  return createdThread;
}

/**
 * Support-Thread:
 * Genau 1 Support-Thread pro Organisation
 */
export async function getOrCreateSupportThread() {
  const actor = await getCurrentActor();

  if (actor.role === "admin") {
    throw new Error("Admin benötigt keinen eigenen Support-Thread.");
  }

  const matchField =
    actor.role === "verein"
      ? { verein_id: actor.organizationId }
      : { gemeinde_id: actor.organizationId };

  const { data: existingThread, error: existingError } = await supabase
    .from("message_threads")
    .select("*")
    .eq("thread_type", "support")
    .match(matchField)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existingThread) return existingThread;

  const insertPayload = {
    thread_type: "support",
    verein_id: actor.role === "verein" ? actor.organizationId : null,
    gemeinde_id: actor.role === "gemeinde" ? actor.organizationId : null,
    created_by_user_id: actor.userId,
  };

  const { data: createdThread, error: createError } = await supabase
    .from("message_threads")
    .insert([insertPayload])
    .select()
    .single();

  if (createError) throw createError;

  return createdThread;
}

export async function getThreadMessages(threadId) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(threadId, body) {
  const actor = await getCurrentActor();

  const trimmedBody = body?.trim();
  if (!trimmedBody) {
    throw new Error("Nachricht darf nicht leer sein.");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert([
      {
        thread_id: threadId,
        sender_user_id: actor.userId,
        sender_role: actor.role,
        body: trimmedBody,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  const { error: updateThreadError } = await supabase
    .from("message_threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", threadId);

  if (updateThreadError) throw updateThreadError;

  await upsertReadStatus(threadId, actor.userId);

  return data;
}

export async function upsertReadStatus(threadId, userId) {
  const { error } = await supabase
    .from("message_read_status")
    .upsert(
      [
        {
          thread_id: threadId,
          user_id: userId,
          last_read_at: new Date().toISOString(),
        },
      ],
      {
        onConflict: "thread_id,user_id",
      }
    );

  if (error) throw error;
}

export async function markThreadAsRead(threadId) {
  const actor = await getCurrentActor();
  await upsertReadStatus(threadId, actor.userId);
}

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

export async function getMeineGemeinde() {
  const actor = await getCurrentActor();

  if (actor.role !== "verein") {
    throw new Error("Nur Vereine haben 'Meine Gemeinde'.");
  }

  const { data, error } = await supabase
    .from("gemeinden")
    .select("id, name, email, telefon, ansprechpartner_name")
    .eq("id", actor.data.gemeinde_id)
    .single();

  if (error) throw error;
  return data;
}

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
      gemeinden ( id, name, email )
    `)
    .eq("thread_type", "support")
    .order("last_message_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
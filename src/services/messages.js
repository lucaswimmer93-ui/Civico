import { supabase } from "../lib/supabaseclient";

/**
 * Hilfsfunktion: Rolle des aktuellen Users bestimmen
 * Erwartet, dass auth.uid() in genau einer der Tabellen existiert:
 * - vereine.auth_id
 * - gemeinden.auth_id
 * - admins.auth_id
 * - freiwillige.auth_id
 */
export async function getCurrentActor() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("Kein eingeloggter User gefunden.");

  const authId = user.id;

  const [vereinRes, gemeindeRes, adminRes, freiwilligerRes] = await Promise.all([
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

    supabase
      .from("freiwillige")
      .select("id, name, email, gemeinde_id, auth_id")
      .eq("auth_id", authId)
      .maybeSingle(),
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

  if (freiwilligerRes.data) {
    return {
      role: "freiwilliger",
      userId: authId,
      organizationId: freiwilligerRes.data.id,
      data: freiwilligerRes.data,
    };
  }

  throw new Error("Der aktuelle User ist keiner Rolle zugeordnet.");
}

async function getTerminForAccess(terminId) {
  const { data, error } = await supabase
    .from("termine")
    .select(`
      id,
      stelle_id,
      stellen ( id, verein_id )
    `)
    .eq("id", terminId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Termin nicht gefunden.");
  return data;
}

async function actorHasTerminAccess(actor, terminId) {
  if (!terminId) return false;

  if (actor.role === "verein") {
    const termin = await getTerminForAccess(terminId);
    const vereinId = Array.isArray(termin.stellen)
      ? termin.stellen[0]?.verein_id
      : termin.stellen?.verein_id;
    return vereinId === actor.organizationId;
  }

  if (actor.role === "freiwilliger") {
    const { data, error } = await supabase
      .from("bewerbungen")
      .select("id, status")
      .eq("termin_id", terminId)
      .eq("freiwilliger_id", actor.organizationId)
      .in("status", ["angemeldet", "erschienen", "no_show"])
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  }

  return actor.role === "admin";
}

async function getThreadById(threadId) {
  const { data, error } = await supabase
    .from("message_threads")
    .select("*")
    .eq("id", threadId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Thread nicht gefunden.");
  return data;
}

async function ensureThreadAccess(threadId, actor = null) {
  const currentActor = actor || (await getCurrentActor());
  const thread = await getThreadById(threadId);

  if (thread.thread_type === "verein_gemeinde") {
    if (currentActor.role === "admin") return { actor: currentActor, thread };
    if (currentActor.role === "verein" && thread.verein_id === currentActor.organizationId) {
      return { actor: currentActor, thread };
    }
    if (currentActor.role === "gemeinde" && thread.gemeinde_id === currentActor.organizationId) {
      return { actor: currentActor, thread };
    }
    throw new Error("Kein Zugriff auf diesen Nachrichtenverlauf.");
  }

  if (thread.thread_type === "support") {
    if (currentActor.role === "admin") return { actor: currentActor, thread };
    if (currentActor.role === "verein" && thread.verein_id === currentActor.organizationId) {
      return { actor: currentActor, thread };
    }
    if (currentActor.role === "gemeinde" && thread.gemeinde_id === currentActor.organizationId) {
      return { actor: currentActor, thread };
    }
    throw new Error("Kein Zugriff auf diesen Support-Thread.");
  }

  if (thread.thread_type === "termin") {
    const hasAccess = await actorHasTerminAccess(currentActor, thread.termin_id);
    if (!hasAccess) {
      throw new Error("Kein Zugriff auf diesen Termin-Chat.");
    }
    return { actor: currentActor, thread };
  }

  throw new Error("Unbekannter Thread-Typ.");
}

/**
 * Verein <-> Gemeinde:
 * Genau 1 Thread pro Verein
 */
export async function getOrCreateVereinGemeindeThread(vereinId = null) {
  const actor = await getCurrentActor();

  let finalVereinId = vereinId;
  let finalGemeindeId = null;

  if (actor.role === "verein") {
    finalVereinId = actor.organizationId;
    finalGemeindeId = actor.data.gemeinde_id;
  } else if (actor.role === "gemeinde") {
    if (!vereinId) {
      throw new Error("vereinId fehlt");
    }

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

/**
 * Termin-Thread:
 * Genau 1 Thread pro Termin
 */
export async function getOrCreateTerminThread(terminId) {
  const actor = await getCurrentActor();

  if (!terminId) {
    throw new Error("terminId fehlt");
  }

  const hasAccess = await actorHasTerminAccess(actor, terminId);
  if (!hasAccess) {
    throw new Error("Kein Zugriff auf diesen Termin-Chat.");
  }

  const termin = await getTerminForAccess(terminId);
  const vereinId = Array.isArray(termin.stellen)
    ? termin.stellen[0]?.verein_id || null
    : termin.stellen?.verein_id || null;

  const { data: existingThread, error: existingError } = await supabase
    .from("message_threads")
    .select("*")
    .eq("thread_type", "termin")
    .eq("termin_id", terminId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existingThread) return existingThread;

  const { data: createdThread, error: createError } = await supabase
    .from("message_threads")
    .insert([
      {
        thread_type: "termin",
        termin_id: terminId,
        stelle_id: termin.stelle_id || null,
        verein_id: vereinId,
        created_by_user_id: actor.userId,
      },
    ])
    .select()
    .single();

  if (createError) throw createError;

  return createdThread;
}

export async function getThreadMessages(threadId) {
  await ensureThreadAccess(threadId);

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(threadId, body) {
  const { actor } = await ensureThreadAccess(threadId);

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
  const { actor } = await ensureThreadAccess(threadId);
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

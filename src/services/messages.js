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
    finalGemeindeId = verein.gemeinde_id;
  } else {
    throw new Error("Nur Vereine können diesen Thread öffnen.");
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

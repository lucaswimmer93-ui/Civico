// src/screens/VolunteerScreens.jsx (FINAL)

const handleSave = async () => {
  try {
    let newGemeindeId = null;

    if (plz) {
      const { data: gemeinde } = await supabase
        .from("gemeinde_plz")
        .select("gemeinde_id")
        .eq("plz", plz)
        .limit(1)
        .single();

      newGemeindeId = gemeinde?.gemeinde_id || null;
    }

    await supabase
      .from("freiwillige")
      .update({
        name,
        plz,
        umkreis,
        faehigkeiten,
        sprachen,
        gemeinde_id: newGemeindeId,
      })
      .eq("id", userId);

    window.location.reload();
  } catch (err) {
    console.error("Fehler beim Speichern", err);
  }
};

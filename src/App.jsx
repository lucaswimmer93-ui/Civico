// src/App.jsx (FINAL)

import { supabase } from "./core/shared";

const loadStellen = async (gemeindeId, userPlz, umkreisKm) => {
  try {
    if (!gemeindeId && !userPlz) {
      const { data } = await supabase.from("stellen").select("*");
      setStellen(data || []);
      return;
    }

    if (gemeindeId && !userPlz) {
      const { data } = await supabase
        .from("stellen")
        .select("*")
        .eq("gemeinde_id", gemeindeId);

      setStellen(data || []);
      return;
    }

    if (userPlz) {
      const { data: coords } = await supabase
        .from("plz_koordinaten")
        .select("lat, lng")
        .eq("plz", userPlz)
        .single();

      if (!coords) {
        console.error("Keine Koordinaten gefunden");
        setStellen([]);
        return;
      }

      const { data: ids } = await supabase.rpc("stellen_in_umkreis", {
        user_lat: coords.lat,
        user_lng: coords.lng,
        radius_km: umkreisKm,
      });

      if (!ids || ids.length === 0) {
        setStellen([]);
        return;
      }

      const stelleIds = ids.map((i) => i.stelle_id);

      const { data: stellenData } = await supabase
        .from("stellen")
        .select("*")
        .in("id", stelleIds);

      setStellen(stellenData || []);
    }
  } catch (err) {
    console.error("Fehler loadStellen", err);
    setStellen([]);
  }
};

import React, { useState, useEffect } from 'react';
import {
  supabase,
  T,
  KATEGORIEN,
  SKILLS,
  getSkillLabel,
  getKat,
  getMedaille,
  getNextMedaille,
  getMedailleName,
  IMPRESSUM_TEXT,
  DATENSCHUTZ_TEXT,
  AGB_TEXT,
  formatDate,
  getGemeindeByPlz,
  isKlarname,
  isTerminNochNichtGestartet,
  isTerminAktuell,
} from './core/shared';
import LoginScreen from './screens/LoginScreen';
import {
  DetailScreen,
  VereinProfilPublic,
  FreiwilligerProfil,
  EinstellungenScreen,
  FreiwilligerProfilVerein,
} from './screens/VolunteerScreens';
import {
  VereinDashboard,
  VereinStelleDetail,
  StelleErstellenScreen,
  VereinProfilEdit,
  StelleBearbeitenScreen,
  AnalyseDashboard,
} from './screens/OrganizationScreens';
import RechtlicheSeite from './screens/LegalScreens';
import GemeindeDashboard from './screens/GemeindeDashboard';
import AdminDashboard from './screens/AdminDashboard';
import { Chip } from './components/ui';

export default function App() {
  const [lang, setLang] = useState("de");
  const t = T[lang];
  const [showLangMenu, setShowLangMenu] = useState(false);

  const LangSwitcher = () => (
    <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setShowLangMenu(!showLangMenu)}
        style={{
          background: "rgba(255,255,255,0.1)",
          border: "none",
          color: "#F4F0E8",
          fontSize: 18,
          cursor: "pointer",
          borderRadius: 20,
          padding: "4px 8px",
        }}
      >
        {T[lang].flag}
      </button>
      {showLangMenu && (
        <div
          style={{
            position: "absolute",
            top: 36,
            right: 0,
            background: "#FAF7F2",
            borderRadius: 12,
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            zIndex: 300,
            overflow: "hidden",
            minWidth: 140,
          }}
        >
          {Object.keys(T).map((l) => (
            <button
              key={l}
              onClick={() => {
                setLang(l);
                setShowLangMenu(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "10px 14px",
                border: "none",
                background: lang === l ? "#EDE8DE" : "#FAF7F2",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                color: "#2C2416",
              }}
            >
              <span style={{ fontSize: 18 }}>{T[l].flag}</span> {T[l].name}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const [user, setUser] = useState(null);
  const [stellen, setStellen] = useState([]);
  const [screen, setScreen] = useState("home");
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedVerein, setSelectedVerein] = useState(null);
  const [selectedFreiwilliger, setSelectedFreiwilliger] = useState(null);
  const [filterKat, setFilterKat] = useState(null);
  const [filterPlz, setFilterPlz] = useState("");
  const [filterUmkreis, setFilterUmkreis] = useState(9999);
  const [filterName, setFilterName] = useState("");
  const [toast, setToast] = useState(null);
  const [gemeindeId, setGemeindeId] = useState(null);
  const [terminWechselModus, setTerminWechselModus] = useState(false);
  const [homeTab, setHomeTab] = useState("stellen");
  const [vereinFollowers, setVereinFollowers] = useState([]);
  const [vereinNotifications, setVereinNotifications] = useState([]);
  const [showVereinNotifications, setShowVereinNotifications] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [adminInbox, setAdminInbox] = useState([]);
  const [follows, setFollows] = useState({ vereine: [], kategorien: [] });
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // ── Notifications ─────────────────────────────────────────────────────────
  const loadNotifications = async (userId) => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) setNotifications(data);
  };

  const markAllRead = async () => {
    if (!user?.data?.id) return;
    await supabase
      .from("notifications")
      .update({ gelesen: true })
      .eq("user_id", user.data.id)
      .eq("gelesen", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, gelesen: true })));
  };

  const addNotification = async (userId, titel, text, typ) => {
    const { data } = await supabase
      .from("notifications")
      .insert({ user_id: userId, titel, text, typ, gelesen: false })
      .select()
      .single();
    if (data && user?.data?.id === userId) {
      setNotifications((prev) => [data, ...prev]);
    }
  };

  // ── Follows ────────────────────────────────────────────────────────────────
  const loadFollows = async (userId) => {
    const { data } = await supabase
      .from("follows")
      .select("*")
      .eq("freiwilliger_id", userId);
    if (data) {
      setFollows({
        vereine: data.filter((f) => f.typ === "verein").map((f) => f.ziel_id),
        kategorien: data
          .filter((f) => f.typ === "kategorie")
          .map((f) => f.ziel_wert),
      });
    }
  };

  const toggleFollowVerein = async (vereinId) => {
    if (!user?.data?.id) return;
    const isFollowing = follows.vereine.includes(vereinId);
    if (isFollowing) {
      await supabase
        .from("follows")
        .delete()
        .eq("freiwilliger_id", user.data.id)
        .eq("typ", "verein")
        .eq("ziel_id", vereinId);
      setFollows((prev) => ({
        ...prev,
        vereine: prev.vereine.filter((id) => id !== vereinId),
      }));
    } else {
      await supabase
        .from("follows")
        .insert({
          freiwilliger_id: user.data.id,
          typ: "verein",
          ziel_id: vereinId,
        });
      setFollows((prev) => ({ ...prev, vereine: [...prev.vereine, vereinId] }));
    }
  };

  const toggleFollowKategorie = async (katId) => {
    if (!user?.data?.id) return;
    const isFollowing = follows.kategorien.includes(katId);
    if (isFollowing) {
      await supabase
        .from("follows")
        .delete()
        .eq("freiwilliger_id", user.data.id)
        .eq("typ", "kategorie")
        .eq("ziel_wert", katId);
      setFollows((prev) => ({
        ...prev,
        kategorien: prev.kategorien.filter((k) => k !== katId),
      }));
    } else {
      await supabase
        .from("follows")
        .insert({
          freiwilliger_id: user.data.id,
          typ: "kategorie",
          ziel_wert: katId,
        });
      setFollows((prev) => ({
        ...prev,
        kategorien: [...prev.kategorien, katId],
      }));
    }
  };

  // ── Warteliste ─────────────────────────────────────────────────────────────
  const handleWarteliste = async (stelleId, terminId) => {
    if (!user) {
      navigateTo("login");
      return;
    }
    const { data: existing } = await supabase
      .from("warteliste")
      .select("id, position")
      .eq("termin_id", terminId)
      .eq("freiwilliger_id", user.data.id)
      .single();
    if (existing) {
      showToast(`Wartelistenplatz ${existing.position}`, "#E8A87C");
      return;
    }
    const { data: count } = await supabase
      .from("warteliste")
      .select("id", { count: "exact" })
      .eq("termin_id", terminId);
    const position = (count?.length || 0) + 1;
    await supabase.from("warteliste").insert({
      stelle_id: stelleId,
      termin_id: terminId,
      freiwilliger_id: user.data.id,
      name: user.data.name,
      email: user.data.email,
      position,
    });
    showToast(`✓ Wartelistenplatz ${position}`, "#E8A87C");
    await loadStellen(gemeindeId, user.data.plz, user.data.umkreis);
  };

  const logout = async () => {
    if (user?.type === "freiwilliger") await unregisterPush(user.data.id);
    await supabase.auth.signOut();
    setUser(null);
    setHistory([]);
    setScreen("home");
  };

  // ── Push Notifications ────────────────────────────────────────────────────
  const VAPID_PUBLIC_KEY =
    "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBHoLThSIqcWqGqlzqc";

  const urlBase64ToUint8Array = (base64String) => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const rawData = window.atob(base64);
    return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
  };

  const registerPush = async (userId) => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const subJson = JSON.stringify(sub);
      await supabase
        .from("freiwillige")
        .update({ push_token: subJson })
        .eq("id", userId);
    } catch (e) {
      console.log("Push registration failed:", e);
    }
  };

  const unregisterPush = async (userId) => {
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      }
      if (userId)
        await supabase
          .from("freiwillige")
          .update({ push_token: null })
          .eq("id", userId);
    } catch (e) {}
  };

  // ── Navigation ──────────────────────────────────────────────────────────
  const navigateTo = (newScreen) => {
    setHistory((prev) => [...prev, screen]);
    setScreen(newScreen);
  };
  const goBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setScreen(prev);
    } else {
      setScreen("home");
    }
  };
  const goHome = () => {
    setHistory([]);
    setScreen("home");
  };

  const showToast = (msg, color = "#3A7D44") => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3000);
  };

  const loadStellen = async (
    gemeinde_id = null,
    plz = null,
    umkreis = null
  ) => {
    // Umkreisbasiert laden wenn PLZ + Umkreis vorhanden
    if (plz && umkreis) {
      try {
        const { data: plzData } = await supabase
          .from("plz_koordinaten")
          .select("lat, lng")
          .eq("plz", plz)
          .single();
        if (plzData) {
          const { data: ids } = await supabase.rpc("stellen_in_umkreis", {
            lat: plzData.lat,
            lng: plzData.lng,
            radius_km: umkreis >= 9999 ? 9999 : umkreis,
          });
          if (ids && ids.length > 0) {
            const stelleIds = ids.map((r) => r.stelle_id || r.id || r);
            const { data } = await supabase
              .from("stellen")
              .select("*, vereine(*), termine(*, bewerbungen(*))")
              .in("id", stelleIds)
              .order("created_at", { ascending: false });
            if (data) {
              setStellen(data);
              return;
            }
          } else {
            setStellen([]);
            return;
          }
        }
      } catch (e) {
        /* fallback */
      }
    }
    // Fallback: alle Stellen oder nach Gemeinde
    let query = supabase
      .from("stellen")
      .select("*, vereine(*), termine(*, bewerbungen(*))")
      .eq("archiviert", false)
      .order("created_at", { ascending: false });
    if (gemeinde_id) query = query.eq("gemeinde_id", gemeinde_id);
    const { data } = await query;
    if (data) setStellen(data);
  };

  const reloadSelected = async (stelleId) => {
    const { data } = await supabase
      .from("stellen")
      .select("*, vereine(*), termine(*, bewerbungen(*))")
      .eq("id", stelleId)
      .single();
    if (data) setSelected(data);
  };

  const autoArchivieren = async (vereinId) => {
    const { data: vereinStellen } = await supabase
      .from("stellen")
      .select("id, termine(datum, endzeit, startzeit)")
      .eq("verein_id", vereinId)
      .eq("archiviert", false);
    if (!vereinStellen) return;
    const jetzt = new Date();
    for (const s of vereinStellen) {
      if (!s.termine || s.termine.length === 0) continue;
      const alleVergangen = s.termine.every(
        (t) =>
          new Date(t.datum + "T" + (t.endzeit || t.startzeit || "23:59")) <
          jetzt
      );
      if (alleVergangen)
        await supabase
          .from("stellen")
          .update({ archiviert: true })
          .eq("id", s.id);
    }
  };

  useEffect(() => {
    // Service Worker registrieren (PWA + Push)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/civico-sw.js")
        .then((reg) => console.log("SW registered:", reg.scope))
        .catch((err) => console.log("SW failed:", err));
    }

    loadStellen();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: profil } = await supabase
          .from("freiwillige")
          .select("*")
          .eq("auth_id", session.user.id)
          .single();
        if (profil) {
          setUser({ type: "freiwilliger", data: profil });
          setGemeindeId(profil.gemeinde_id);
          loadStellen(profil.gemeinde_id, profil.plz, profil.umkreis);
          loadFollows(profil.id);
          loadNotifications(profil.id);
          setScreen("home");
          return;
        }
        const { data: verein } = await supabase
          .from("vereine")
          .select("*")
          .eq("auth_id", session.user.id)
          .single();
        if (verein) {
          setUser({ type: "verein", data: verein });
          setGemeindeId(verein.gemeinde_id);
          loadStellen(verein.gemeinde_id);
          setScreen("dashboard");
          autoArchivieren(verein.id);
          supabase
            .from("follows")
            .select("freiwilliger_id, freiwillige(name)")
            .eq("typ", "verein")
            .eq("ziel_id", verein.id)
            .then(({ data }) => {
              if (data) setVereinFollowers(data);
            });
        }

        const { data: gemeinde } = await supabase
          .from("gemeinden")
          .select("*")
          .eq("auth_id", session.user.id)
          .single();
        if (gemeinde) {
          setUser({ type: "gemeinde", data: gemeinde });
          setGemeindeId(gemeinde.id);
          loadStellen(gemeinde.id);
          setScreen("gemeinde-dashboard");
          return;
        }

        const { data: admin } = await supabase
          .from("admins")
          .select("*")
          .eq("auth_id", session.user.id)
          .single();
        if (admin) {
          setUser({ type: "admin", data: admin });
          loadStellen();
          setScreen("admin-dashboard");
          return;
        }
      }
    });
  }, []);

  // Realtime subscription
  useEffect(() => {
    const reloadSelectedRealtime = () => {
      setSelected((prev) => {
        if (prev?.id) {
          supabase
            .from("stellen")
            .select("*, vereine(*), termine(*, bewerbungen(*))")
            .eq("id", prev.id)
            .single()
            .then(({ data }) => {
              if (data) setSelected(data);
            });
        }
        return prev;
      });
    };
    const channel = supabase
      .channel("civico-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bewerbungen" },
        () => {
          loadStellen();
          reloadSelectedRealtime();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "termine" },
        () => {
          loadStellen();
          reloadSelectedRealtime();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter
  const plzMatch = (s) => {
    if (!filterPlz || filterPlz.length < 2) return true;
    const input = filterPlz.toLowerCase().trim();
    if (/^[0-9]+$/.test(input)) {
      if (!s.plz) return true;
      return (
        Math.abs(parseInt(s.plz) - parseInt(input)) <=
        Math.ceil(filterUmkreis / 10) * 10
      );
    }
    return (s.ort || "").toLowerCase().includes(input);
  };
  const gefilterteStellen = stellen.filter(
    (s) =>
      (!filterKat || s.kategorie === filterKat) &&
      plzMatch(s) &&
      (!filterName ||
        s.titel?.toLowerCase().includes(filterName.toLowerCase()) ||
        s.vereine?.name?.toLowerCase().includes(filterName.toLowerCase()))
  );

  // Handlers
  const handleBuchen = async (stelleId, terminId, isNew) => {
    if (!user) {
      navigateTo("login");
      return;
    }
    try {
      const isEchteNeuanmeldung = isNew && !terminWechselModus;
      if (isNew) {
        if (!terminWechselModus) {
          // Prüfe auf JEDER Stelle und JEDEM Termin ob bereits angemeldet
          const bereitsAngemeldet = stellen
            .find((s) => s.id === stelleId)
            ?.termine?.some((t) =>
              (t.bewerbungen || []).some(
                (b) => b.freiwilliger_id === user.data.id
              )
            );
          if (bereitsAngemeldet) {
            showToast(
              "Du bist bereits bei dieser Stelle angemeldet!",
              "#E8A87C"
            );
            return;
          }
          // Extra Sicherheit: direkt in DB prüfen
          const { data: dbCheck } = await supabase
            .from("bewerbungen")
            .select("id")
            .eq("freiwilliger_id", user.data.id)
            .in(
              "termin_id",
              stellen
                .find((s) => s.id === stelleId)
                ?.termine?.map((t) => t.id) || []
            );
          if (dbCheck && dbCheck.length > 0) {
            showToast(
              "Du bist bereits bei dieser Stelle angemeldet!",
              "#E8A87C"
            );
            return;
          }
        }
        const { data: erfolg, error } = await supabase.rpc("book_slot", {
          p_stelle_id: stelleId,
          p_termin_id: terminId,
          p_freiwilliger_id: user.data.id,
          p_name: user.data.name,
          p_email: user.data.email,
        });
        if (error) throw error;
        if (!erfolg) {
          showToast("Leider ausgebucht!", "#E85C5C");
          return;
        }
        if (isEchteNeuanmeldung) {
          await supabase
            .from("freiwillige")
            .update({
              punkte: (user.data.punkte || 0) + 10,
              aktionen: (user.data.aktionen || 0) + 1,
            })
            .eq("id", user.data.id);
          setUser((prev) => ({
            ...prev,
            data: {
              ...prev.data,
              punkte: (prev.data.punkte || 0) + 10,
              aktionen: (prev.data.aktionen || 0) + 1,
            },
          }));
          showToast("✓ Angemeldet! +10 Punkte 🎉");
          // Verein benachrichtigen
          const stelle = stellen.find((s) => s.id === stelleId);
          if (stelle?.vereine?.auth_id) {
            await supabase
              .from("verein_notifications")
              .insert({
                verein_id: stelle.verein_id,
                titel: "🎉 Neue Anmeldung!",
                text: `${user.data.name} hat sich für "${stelle.titel}" angemeldet.`,
                typ: "anmeldung",
                gelesen: false,
              })
              .catch(() => {});
          }
        } else {
          setTerminWechselModus(false);
          showToast("✓ Termin geändert!");
          // Verein über Terminwechsel benachrichtigen
          const stelle = stellen.find((s) => s.id === stelleId);
          if (stelle) {
            await supabase
              .from("verein_notifications")
              .insert({
                verein_id: stelle.verein_id,
                titel: "📅 Termin geändert",
                text: `${user.data.name} hat den Termin für "${stelle.titel}" geändert.`,
                typ: "termin_wechsel",
                gelesen: false,
              })
              .catch(() => {});
          }
        }
      }
      await loadStellen(gemeindeId);
      await reloadSelected(stelleId);
    } catch (err) {
      showToast("Fehler beim Buchen.", "#E85C5C");
    }
  };

  const handleTerminWechsel = async (bewId, alterTerminId) => {
    await supabase.from("bewerbungen").delete().eq("id", bewId);
    await supabase.rpc("increment_plaetze", { termin_id: alterTerminId });
    setTerminWechselModus(true);
    showToast("Wähle einen neuen Termin →");
    await loadStellen(gemeindeId, user?.data?.plz, user?.data?.umkreis);
    if (selected?.id) await reloadSelected(selected.id);
  };

  const handleAbmelden = async (bewId, terminId) => {
    try {
      await supabase.from("bewerbungen").delete().eq("id", bewId);
      await supabase.rpc("increment_plaetze", { termin_id: terminId });
      await supabase
        .from("freiwillige")
        .update({
          punkte: Math.max(0, (user.data.punkte || 0) - 10),
          aktionen: Math.max(0, (user.data.aktionen || 0) - 1),
        })
        .eq("id", user.data.id);
      setUser((prev) => ({
        ...prev,
        data: {
          ...prev.data,
          punkte: Math.max(0, (prev.data.punkte || 0) - 10),
          aktionen: Math.max(0, (prev.data.aktionen || 0) - 1),
        },
      }));
      showToast("Abgemeldet. -10 Punkte", "#E85C5C");
      // Verein benachrichtigen
      const abmeldeStelle = stellen.find((s) =>
        (s.termine || []).some((t) => t.id === terminId)
      );
      if (abmeldeStelle) {
        await supabase
          .from("verein_notifications")
          .insert({
            verein_id: abmeldeStelle.verein_id,
            titel: "❌ Abmeldung",
            text: `${user.data.name} hat sich von "${abmeldeStelle.titel}" abgemeldet.`,
            typ: "abmeldung",
            gelesen: false,
          })
          .catch(() => {});
      }
      // Warteliste prüfen
      const { data: nextOnList } = await supabase
        .from("warteliste")
        .select("*")
        .eq("termin_id", terminId)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();
      if (nextOnList) {
        // Automatisch nachbuchen
        const { data: erfolg } = await supabase.rpc("book_slot", {
          p_stelle_id: nextOnList.stelle_id,
          p_termin_id: terminId,
          p_freiwilliger_id: nextOnList.freiwilliger_id,
          p_name: nextOnList.freiwilliger_name,
          p_email: nextOnList.freiwilliger_email,
        });
        if (erfolg) {
          // Freiwilligen benachrichtigen
          await supabase.from("notifications").insert({
            user_id: nextOnList.freiwilliger_id,
            titel: "🎉 Du wurdest nachgerückt!",
            text: `Ein Platz bei "${
              selected?.titel || "einer Stelle"
            }" ist frei geworden – du wurdest automatisch angemeldet! +10 Punkte`,
            typ: "platz_frei",
            gelesen: false,
          });
          // Punkte vergeben
          await supabase
            .from("freiwillige")
            .update({ punkte: supabase.rpc("increment", { x: 10 }) })
            .eq("id", nextOnList.freiwilliger_id)
            .catch(() => {});
          // Verein benachrichtigen
          if (selected) {
            await notifyVerein(
              selected.verein_id,
              "🔄 Warteliste nachgerückt",
              `${nextOnList.freiwilliger_name} ist automatisch von der Warteliste nachgerückt.`,
              "warteliste"
            );
          }
        } else {
          // Falls book_slot fehlschlägt - nur Benachrichtigung
          await supabase.from("notifications").insert({
            user_id: nextOnList.freiwilliger_id,
            titel: "🎉 Platz frei geworden!",
            text: `Ein Platz bei "${
              selected?.titel || "einer Stelle"
            }" ist frei – jetzt schnell anmelden!`,
            typ: "platz_frei",
            gelesen: false,
          });
        }
        await supabase.from("warteliste").delete().eq("id", nextOnList.id);
        // Positionen der restlichen Warteliste aktualisieren
        const { data: restListe } = await supabase
          .from("warteliste")
          .select("id")
          .eq("termin_id", terminId)
          .order("created_at", { ascending: true });
        if (restListe) {
          for (let i = 0; i < restListe.length; i++) {
            await supabase
              .from("warteliste")
              .update({ position: i + 1 })
              .eq("id", restListe[i].id);
          }
        }
      }
      await loadStellen(gemeindeId, user?.data?.plz, user?.data?.umkreis);
      if (selected?.id) await reloadSelected(selected.id);
      goBack();
    } catch (err) {
      showToast("Fehler beim Abmelden.", "#E85C5C");
    }
  };

  const handleBestaetigen = async (bewId, erschienen) => {
    const { data: bew } = await supabase
      .from("bewerbungen")
      .select("freiwilliger_id")
      .eq("id", bewId)
      .single();
    await supabase
      .from("bewerbungen")
      .update({ bestaetigt: erschienen, nicht_erschienen: !erschienen })
      .eq("id", bewId);
    if (bew) {
      const { data: fw } = await supabase
        .from("freiwillige")
        .select("punkte")
        .eq("id", bew.freiwilliger_id)
        .single();
      if (fw) {
        const neuePunkte = erschienen
          ? (fw.punkte || 0) + 5
          : Math.max(0, (fw.punkte || 0) - 15);
        await supabase
          .from("freiwillige")
          .update({ punkte: neuePunkte })
          .eq("id", bew.freiwilliger_id);
      }
    }
    showToast(
      erschienen
        ? "✓ Erschienen! +5 Punkte 🎉"
        : "Nicht erschienen. -15 Punkte",
      erschienen ? "#3A7D44" : "#E85C5C"
    );
    await loadStellen(gemeindeId);
    if (selected) await reloadSelected(selected.id);
  };

  const openDetail = async (stelle) => {
    setSelected(stelle);
    navigateTo("detail");
    if (!user || user.type !== "verein" || user.data.id !== stelle.verein_id) {
      await supabase
        .from("stellen")
        .update({ aufrufe: (stelle.aufrufe || 0) + 1 })
        .eq("id", stelle.id);
    }
  };
  const handleGemeindeStelleSpeichern = async (payload) => {
    try {
      const { data: stelle } = await supabase
        .from("stellen")
        .insert({
          titel: payload.titel,
          beschreibung: payload.beschreibung,
          kategorie: payload.kategorie,
          ort: payload.standort,
          treffpunkt: payload.standort,
          verein_id: null,
          gemeinde_id: payload.gemeinde_id || user?.data?.id || gemeindeId,
          created_by_type: "gemeinde",
          archiviert: false,
        })
        .select()
        .single();

      if (stelle && payload.termine?.length) {
        await supabase.from("termine").insert(
          payload.termine
            .filter((t) => t.datum)
            .map((t) => ({
              stelle_id: stelle.id,
              datum: t.datum,
              startzeit: t.startzeit,
              endzeit: t.endzeit || null,
              freie_plaetze: t.plaetze || 5,
              gesamt_plaetze: t.plaetze || 5,
            }))
        );
      }
      showToast("✓ Gemeinde-Stelle gespeichert!");
      await loadStellen(gemeindeId || user?.data?.id);
    } catch (err) {
      console.error(err);
      showToast("Fehler beim Speichern.", "#E85C5C");
    }
  };

  const derivedOrganisationen = Array.from(
    new Map(
      stellen.filter((s) => s.vereine).map((s) => [s.vereine.id, s.vereine])
    ).values()
  );


  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F4F0E8",
        fontFamily: "'Georgia', serif",
        maxWidth: 480,
        margin: "0 auto",
        position: "relative",
      }}
    >
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            background: toast.color,
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 24,
            zIndex: 200,
            fontSize: 13,
            fontWeight: "bold",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* HOME */}
      {screen === "home" && (
        <div>
          <div
            style={{
              background: "linear-gradient(160deg, #1A1208, #2C2416)",
              padding: "20px 20px 16px",
              color: "#F4F0E8",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: "bold", letterSpacing: 2 }}>
              Civico
            </div>
            {user ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {user.type !== "verein" && <LangSwitcher />}
                {user.type === "freiwilliger" && (
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={() => setShowNotifications(!showNotifications)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#F4F0E8",
                        fontSize: 20,
                        cursor: "pointer",
                        padding: "4px 6px",
                      }}
                    >
                      🔔
                      {notifications.filter((n) => !n.gelesen).length > 0 && (
                        <span
                          style={{
                            position: "absolute",
                            top: 0,
                            right: 0,
                            background: "#E85C5C",
                            color: "#fff",
                            fontSize: 9,
                            borderRadius: "50%",
                            width: 16,
                            height: 16,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: "bold",
                          }}
                        >
                          {notifications.filter((n) => !n.gelesen).length > 9
                            ? "9+"
                            : notifications.filter((n) => !n.gelesen).length}
                        </span>
                      )}
                    </button>
                  </div>
                )}
                <button
                  onClick={() =>
                    navigateTo(user.type === "verein" ? "dashboard" : "profil")
                  }
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    border: "none",
                    color: "#F4F0E8",
                    fontSize: 12,
                    padding: "6px 12px",
                    borderRadius: 20,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {user.type === "verein" ? t.dashboard : t.profil}
                </button>
                <button
                  onClick={logout}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#8B7355",
                    fontSize: 12,
                    padding: "6px 12px",
                    borderRadius: 20,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {t.abmelden}
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <LangSwitcher />
                <button
                  onClick={() => navigateTo("login")}
                  style={{
                    background: "#3A7D44",
                    border: "none",
                    color: "#fff",
                    fontSize: 13,
                    padding: "8px 16px",
                    borderRadius: 20,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: "bold",
                  }}
                >
                  {t.anmelden}
                </button>
              </div>
            )}
          </div>
          {showNotifications && user?.type === "freiwilliger" && (
            <div
              style={{
                position: "fixed",
                top: 62,
                right: "calc(50% - 240px + 48px)",
                background: "#FAF7F2",
                borderRadius: 12,
                boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                zIndex: 250,
                width: 280,
                maxHeight: 400,
                overflowY: "auto",
              }}
              onClick={() => setShowNotifications(false)}
            >
              <div
                style={{
                  padding: "12px 14px",
                  borderBottom: "1px solid #E0D8C8",
                  fontSize: 12,
                  fontWeight: "bold",
                  color: "#2C2416",
                }}
              >
                🔔 Benachrichtigungen
              </div>
              {notifications.length === 0 ? (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    fontSize: 12,
                    color: "#8B7355",
                  }}
                >
                  Keine Benachrichtigungen
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid #F0EBE0",
                      background: n.gelesen ? "#FAF7F2" : "#EDE8DE",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: "bold",
                        color: "#2C2416",
                      }}
                    >
                      {n.titel}
                    </div>
                    <div
                      style={{ fontSize: 12, color: "#8B7355", marginTop: 2 }}
                    >
                      {n.text}
                    </div>
                    <div
                      style={{ fontSize: 10, color: "#C4B89A", marginTop: 4 }}
                    >
                      {new Date(n.created_at).toLocaleDateString("de-DE")}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          {/* Tab Bar */}
          <div
            style={{
              background: "#2C2416",
              padding: "0 16px",
              display: "flex",
              gap: 4,
            }}
          >
            {[
              { id: "stellen", label: "🌱 Stellen" },
              { id: "vereine", label: "🏢 Vereine" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setHomeTab(tab.id)}
                style={{
                  padding: "10px 16px",
                  background: "none",
                  border: "none",
                  color: homeTab === tab.id ? "#F4F0E8" : "#8B7355",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: homeTab === tab.id ? "bold" : "normal",
                  borderBottom:
                    homeTab === tab.id
                      ? "2px solid #C8A96E"
                      : "2px solid transparent",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ padding: "16px 16px 100px" }}>
            {/* STELLEN TAB */}
            {homeTab === "stellen" && (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flex: 1,
                      background: "#FAF7F2",
                      borderRadius: 10,
                      padding: "8px 12px",
                      border: "1px solid #E0D8C8",
                    }}
                  >
                    <span>📍</span>
                    <input
                      type="text"
                      placeholder="PLZ oder Ort"
                      value={filterPlz}
                      onChange={(e) => setFilterPlz(e.target.value)}
                      style={{
                        flex: 1,
                        border: "none",
                        background: "transparent",
                        fontFamily: "inherit",
                        fontSize: 13,
                        color: "#2C2416",
                        outline: "none",
                      }}
                    />
                    {filterPlz && (
                      <span
                        onClick={() => setFilterPlz("")}
                        style={{
                          fontSize: 12,
                          color: "#8B7355",
                          cursor: "pointer",
                        }}
                      >
                        ✕
                      </span>
                    )}
                  </div>
                  <select
                    value={filterUmkreis}
                    onChange={(e) => setFilterUmkreis(parseInt(e.target.value))}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #E0D8C8",
                      background: "#FAF7F2",
                      fontFamily: "inherit",
                      fontSize: 13,
                      color: "#2C2416",
                      cursor: "pointer",
                    }}
                  >
                    <option value={10}>10 km</option>
                    <option value={25}>25 km</option>
                    <option value={50}>50 km</option>
                    <option value={9999}>Alle</option>
                  </select>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#FAF7F2",
                    borderRadius: 10,
                    padding: "8px 12px",
                    border: "1px solid #E0D8C8",
                    marginBottom: 12,
                  }}
                >
                  <span>🔍</span>
                  <input
                    type="text"
                    placeholder="Stelle oder Verein suchen..."
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    style={{
                      flex: 1,
                      border: "none",
                      background: "transparent",
                      fontFamily: "inherit",
                      fontSize: 13,
                      color: "#2C2416",
                      outline: "none",
                    }}
                  />
                  {filterName && (
                    <span
                      onClick={() => setFilterName("")}
                      style={{
                        fontSize: 12,
                        color: "#8B7355",
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </span>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    overflowX: "auto",
                    paddingBottom: 4,
                    marginBottom: 16,
                  }}
                >
                  <Chip
                    label="Alle"
                    active={!filterKat}
                    onClick={() => setFilterKat(null)}
                  />
                  {KATEGORIEN.map((k) => (
                    <Chip
                      key={k.id}
                      label={`${k.icon} ${k.label}`}
                      active={filterKat === k.id}
                      onClick={() =>
                        setFilterKat(filterKat === k.id ? null : k.id)
                      }
                    />
                  ))}
                </div>
                <SectionLabel>
                  {gefilterteStellen.length} Stellen gefunden
                </SectionLabel>
                {gefilterteStellen.length === 0 ? (
                  <EmptyState
                    icon="🔍"
                    text="Keine Stellen gefunden"
                    sub="Ändere den Filter oder PLZ"
                  />
                ) : (
                  gefilterteStellen.map((s) => (
                    <StelleCard
                      key={s.id}
                      stelle={s}
                      verein={s.vereine}
                      onClick={() => openDetail(s)}
                      user={user}
                    />
                  ))
                )}
              </>
            )}

            {/* VEREINE TAB */}
            {homeTab === "vereine" && (
              <VereineListe
                stellen={stellen}
                user={user}
                follows={follows}
                onToggleFollow={toggleFollowVerein}
                onVereinClick={(v) => {
                  setSelectedVerein(v);
                  navigateTo("verein-profil");
                }}
                gemeindeId={gemeindeId}
              />
            )}
          </div>
          <BottomBar
            onImpressum={() => navigateTo("impressum")}
            onDatenschutz={() => navigateTo("datenschutz")}
            onAgb={() => navigateTo("agb")}
            t={t}
          />
        </div>
      )}

      {/* DETAIL */}
      {screen === "detail" && selected && (
        <DetailScreen
          stelle={selected}
          verein={selected.vereine}
          user={user}
          onBack={goBack}
          onHome={goHome}
          onLogin={() => navigateTo("login")}
          onBuchen={handleBuchen}
          onAbmelden={handleAbmelden}
          onTerminWechsel={handleTerminWechsel}
          onBestaetigen={handleBestaetigen}
          onVereinProfil={(v) => {
            setSelectedVerein(v);
            navigateTo("verein-profil");
          }}
          showToast={showToast}
          follows={follows}
          onToggleFollowKat={toggleFollowKategorie}
        />
      )}

      {/* VEREIN PROFIL PUBLIC */}
      {screen === "verein-profil" && selectedVerein && (
        <VereinProfilPublic
          verein={selectedVerein}
          stellen={stellen}
          onBack={goBack}
          onHome={goHome}
          onStelleClick={(s) => {
            setSelected(s);
            navigateTo("detail");
          }}
          user={user}
          onLogin={() => navigateTo("login")}
          logout={logout}
          follows={follows}
          onToggleFollow={toggleFollowVerein}
        />
      )}

      {/* LOGIN */}
      {screen === "login" && (
        <LoginScreen
          onLogin={(type, data, gid) => {
            setUser({ type, data });
            setGemeindeId(gid);
            loadStellen(gid);
            setHistory([]);
            if (type === "verein" || type === "organisation") {
              setScreen("dashboard");
            } else if (type === "gemeinde") {
              setScreen("gemeinde-dashboard");
            } else if (type === "admin") {
              setScreen("admin-dashboard");
            } else {
              setScreen("home");
            }
            if (type === "freiwilliger") {
              loadFollows(data.id);
              loadNotifications(data.id);
            }
            if (type === "verein") {
              autoArchivieren(data.id);
              supabase
                .from("follows")
                .select("freiwilliger_id, freiwillige(name)")
                .eq("typ", "verein")
                .eq("ziel_id", data.id)
                .then(({ data: f }) => {
                  if (f) setVereinFollowers(f);
                });
            }
          }}
          onBack={goBack}
          showToast={showToast}
          onImpressum={() => navigateTo("impressum")}
          onDatenschutz={() => navigateTo("datenschutz")}
          onAgb={() => navigateTo("agb")}
        />
      )}

      {/* PROFIL FREIWILLIGER */}
      {screen === "profil" && user?.type === "freiwilliger" && (
        <FreiwilligerProfil
          user={user}
          setUser={setUser}
          stellen={stellen}
          onBack={goBack}
          onHome={goHome}
          loadStellen={loadStellen}
          gemeindeId={gemeindeId}
          onEinstellungen={() => navigateTo("einstellungen")}
          onDelete={async () => {
            await supabase.from("freiwillige").delete().eq("id", user.data.id);
            await supabase.functions.invoke("delete-user", {
              body: { user_id: user.data.auth_id },
            });
            await supabase.auth.signOut();
            logout();
          }}
          logout={logout}
          showToast={showToast}
          t={t}
          lang={lang}
          follows={follows}
          onToggleFollow={toggleFollowVerein}
          onVereinClick={(v) => {
            setSelectedVerein(v);
            navigateTo("verein-profil");
          }}
        />
      )}

      {/* EINSTELLUNGEN */}
      {screen === "einstellungen" && user?.type === "freiwilliger" && (
        <EinstellungenScreen
          user={user}
          setUser={setUser}
          onBack={goBack}
          onHome={goHome}
          logout={logout}
          showToast={showToast}
          onImpressum={() => navigateTo("impressum")}
          onDatenschutz={() => navigateTo("datenschutz")}
          onAgb={() => navigateTo("agb")}
          t={t}
          lang={lang}
          onDelete={async () => {
            await supabase.from("freiwillige").delete().eq("id", user.data.id);
            await supabase.functions.invoke("delete-user", {
              body: { user_id: user.data.auth_id },
            });
            await supabase.auth.signOut();
            logout();
          }}
        />
      )}

      {/* VEREIN DASHBOARD */}
      {screen === "dashboard" && user?.type === "verein" && (
        <div>
          {showVereinNotifications && (
            <div
              style={{
                position: "fixed",
                top: 62,
                right: "calc(50% - 240px + 48px)",
                background: "#FAF7F2",
                borderRadius: 12,
                boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                zIndex: 250,
                width: 300,
                maxHeight: 400,
                overflowY: "auto",
              }}
              onClick={() => setShowVereinNotifications(false)}
            >
              <div
                style={{
                  padding: "12px 14px",
                  borderBottom: "1px solid #E0D8C8",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div
                  style={{ fontSize: 12, fontWeight: "bold", color: "#2C2416" }}
                >
                  🔔 Benachrichtigungen
                </div>
                {vereinNotifications.length > 0 && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await supabase
                        .from("verein_notifications")
                        .update({ gelesen: true })
                        .eq("verein_id", user.data.id);
                      setVereinNotifications([]);
                    }}
                    style={{
                      fontSize: 10,
                      color: "#8B7355",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Alle gelesen
                  </button>
                )}
              </div>
              {vereinNotifications.length === 0 ? (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    fontSize: 12,
                    color: "#8B7355",
                  }}
                >
                  Keine neuen Benachrichtigungen
                </div>
              ) : (
                vereinNotifications.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid #F0EBE0",
                      background: "#EDE8DE",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: "bold",
                        color: "#2C2416",
                      }}
                    >
                      {n.titel}
                    </div>
                    <div
                      style={{ fontSize: 12, color: "#8B7355", marginTop: 2 }}
                    >
                      {n.text}
                    </div>
                    <div
                      style={{ fontSize: 10, color: "#C4B89A", marginTop: 4 }}
                    >
                      {new Date(n.created_at).toLocaleDateString("de-DE")}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          <VereinDashboard
            user={user}
            stellen={stellen}
            loadStellen={loadStellen}
            onBack={goBack}
            onHome={goHome}
            onDetail={(s) => {
              setSelected(s);
              navigateTo("verein-detail");
            }}
            onBearbeiten={(s) => {
              setSelected(s);
              navigateTo("stelle-bearbeiten");
            }}
            onNeu={() => navigateTo("stelle-erstellen")}
            onProfil={() => navigateTo("verein-profil-eigen")}
            onAnalyse={() => navigateTo("analyse")}
            logout={logout}
            showToast={showToast}
            followers={vereinFollowers}
            onNotifications={() =>
              setShowVereinNotifications(!showVereinNotifications)
            }
            unreadCount={vereinNotifications.length}
          />
        </div>
      )}

      {/* VEREIN STELLE DETAIL */}
      {screen === "verein-detail" && selected && user?.type === "verein" && (
        <VereinStelleDetail
          stelle={selected}
          onBack={goBack}
          onHome={goHome}
          onBestaetigen={handleBestaetigen}
          onStornieren={async (bewId, terminId) => {
            await supabase.from("bewerbungen").delete().eq("id", bewId);
            await supabase.rpc("increment_plaetze", { termin_id: terminId });
            // Warteliste prüfen
            const { data: nextOnList } = await supabase
              .from("warteliste")
              .select("*")
              .eq("termin_id", terminId)
              .order("created_at", { ascending: true })
              .limit(1)
              .single();
            if (nextOnList) {
              const { data: erfolg } = await supabase.rpc("book_slot", {
                p_stelle_id: nextOnList.stelle_id,
                p_termin_id: terminId,
                p_freiwilliger_id: nextOnList.freiwilliger_id,
                p_name: nextOnList.freiwilliger_name,
                p_email: nextOnList.freiwilliger_email,
              });
              if (erfolg) {
                await supabase
                  .from("notifications")
                  .insert({
                    user_id: nextOnList.freiwilliger_id,
                    titel: "🎉 Du wurdest nachgerückt!",
                    text: `Du bist von der Warteliste bei "${selected.titel}" nachgerückt und automatisch angemeldet!`,
                    typ: "platz_frei",
                    gelesen: false,
                  });
              }
              await supabase
                .from("warteliste")
                .delete()
                .eq("id", nextOnList.id);
            }
            showToast("✓ Anmeldung storniert.", "#E85C5C");
            await loadStellen(gemeindeId);
            const { data } = await supabase
              .from("stellen")
              .select("*, vereine(*), termine(*, bewerbungen(*))")
              .eq("id", selected.id)
              .single();
            if (data) setSelected(data);
          }}
          onFreiwilligerProfil={async (bew) => {
            const { data: profil } = await supabase
              .from("freiwillige")
              .select("*")
              .eq("email", bew.freiwilliger_email)
              .single();
            setSelectedFreiwilliger({ ...bew, profil: profil || null });
            navigateTo("freiwilliger-profil-verein");
          }}
          onLoeschen={async () => {
            const anmeldungen = (selected.termine || []).reduce(
              (s, t) => s + (t.bewerbungen?.length || 0),
              0
            );
            const erschienen = (selected.termine || []).reduce(
              (s, t) =>
                s + (t.bewerbungen || []).filter((b) => b.bestaetigt).length,
              0
            );
            const nichtErschienen = (selected.termine || []).reduce(
              (s, t) =>
                s +
                (t.bewerbungen || []).filter((b) => b.nicht_erschienen).length,
              0
            );
            await supabase
              .from("analyse_snapshots")
              .insert({
                verein_id: user.data.id,
                stelle_titel: selected.titel,
                kategorie: selected.kategorie,
                aufrufe: selected.aufrufe || 0,
                anmeldungen,
                erschienen,
                nicht_erschienen: nichtErschienen,
              });
            await supabase
              .from("bewerbungen")
              .delete()
              .eq("stelle_id", selected.id);
            await supabase
              .from("termine")
              .delete()
              .eq("stelle_id", selected.id);
            await supabase.from("stellen").delete().eq("id", selected.id);
            showToast("Stelle gelöscht.", "#E85C5C");
            await loadStellen(gemeindeId);
            goBack();
          }}
          logout={logout}
          showToast={showToast}
          t={t}
          lang={lang}
        />
      )}

      {/* FREIWILLIGER PROFIL FÜR VEREIN */}
      {screen === "freiwilliger-profil-verein" &&
        selectedFreiwilliger &&
        user?.type === "verein" && (
          <FreiwilligerProfilVerein
            selectedFreiwilliger={selectedFreiwilliger}
            setSelectedFreiwilliger={setSelectedFreiwilliger}
            onBack={goBack}
            onHome={goHome}
            logout={logout}
            handleBestaetigen={handleBestaetigen}
          />
        )}

      {/* STELLE ERSTELLEN */}
      {screen === "stelle-erstellen" && user?.type === "verein" && (
        <StelleErstellenScreen
          verein={user.data}
          onBack={goBack}
          onSave={async (stelleData, termineData) => {
            const { data: stelle } = await supabase
              .from("stellen")
              .insert({ ...stelleData, verein_id: user.data.id, aufrufe: 0 })
              .select()
              .single();
            if (stelle && termineData.length > 0)
              await supabase
                .from("termine")
                .insert(
                  termineData.map((t) => ({ ...t, stelle_id: stelle.id }))
                );
            showToast("✓ Stelle veröffentlicht!");
            supabase.functions
              .invoke("send-push", {
                body: {
                  gemeinde_id: user.data.gemeinde_id,
                  title: "Neue Ehrenamtsstelle! 🌱",
                  body: `${user.data.name} sucht Freiwillige`,
                  url: "/",
                },
              })
              .catch(() => {});
            await loadStellen(gemeindeId);
            goBack();
          }}
        />
      )}

      {/* VEREIN EIGENES PROFIL (Ansicht) */}
      {screen === "verein-profil-eigen" && user?.type === "verein" && (
        <VereinProfilPublic
          verein={user.data}
          stellen={stellen}
          onBack={goBack}
          onHome={goHome}
          onStelleClick={(s) => {
            setSelected(s);
            navigateTo("verein-detail");
          }}
          user={user}
          onLogin={null}
          logout={logout}
          follows={follows}
          onToggleFollow={null}
          isEigen={true}
          onBearbeiten={() => navigateTo("verein-profil-edit")}
          followers={vereinFollowers}
        />
      )}

      {/* VEREIN PROFIL EDIT */}
      {screen === "verein-profil-edit" && user?.type === "verein" && (
        <VereinProfilEdit
          verein={user.data}
          onBack={goBack}
          onHome={goHome}
          logout={logout}
          showToast={showToast}
          onImpressum={() => navigateTo("impressum")}
          onDatenschutz={() => navigateTo("datenschutz")}
          onAgb={() => navigateTo("agb")}
          onSave={async (updated) => {
            await supabase
              .from("vereine")
              .update(updated)
              .eq("id", user.data.id);
            setUser((prev) => ({
              ...prev,
              data: { ...prev.data, ...updated },
            }));
            showToast("✓ Profil gespeichert!");
            goBack();
          }}
        />
      )}

      {/* STELLE BEARBEITEN */}
      {screen === "stelle-bearbeiten" &&
        selected &&
        user?.type === "verein" && (
          <StelleBearbeitenScreen
            stelle={selected}
            verein={user.data}
            onBack={goBack}
            onSave={async (stelleData, termineData) => {
              await supabase
                .from("stellen")
                .update(stelleData)
                .eq("id", selected.id);
              // Abgesagte Termine löschen + Freiwillige benachrichtigen
              const abgesagt = termineData.filter((t) => t.absagen && t.id);
              for (const t of abgesagt) {
                const { data: bews } = await supabase
                  .from("bewerbungen")
                  .select("freiwilliger_id")
                  .eq("termin_id", t.id);
                if (bews)
                  for (const b of bews) {
                    await supabase
                      .from("notifications")
                      .insert({
                        user_id: b.freiwilliger_id,
                        titel: "❌ Termin abgesagt",
                        text: `Dein Termin für "${selected.titel}" wurde leider abgesagt.`,
                        typ: "termin_abgesagt",
                        gelesen: false,
                      })
                      .catch(() => {});
                  }
                await supabase
                  .from("bewerbungen")
                  .delete()
                  .eq("termin_id", t.id);
                await supabase.from("termine").delete().eq("id", t.id);
              }
              // Verschobene Termine updaten
              const geaendert = termineData.filter((t) => !t.absagen && t.id);
              for (const t of geaendert) {
                const original = (selected.termine || []).find(
                  (ot) => ot.id === t.id
                );
                await supabase
                  .from("termine")
                  .update({
                    datum: t.datum,
                    startzeit: t.startzeit,
                    endzeit: t.endzeit || null,
                  })
                  .eq("id", t.id);
                if (original && original.datum !== t.datum) {
                  const { data: bews } = await supabase
                    .from("bewerbungen")
                    .select("freiwilliger_id")
                    .eq("termin_id", t.id);
                  if (bews)
                    for (const b of bews) {
                      await supabase
                        .from("notifications")
                        .insert({
                          user_id: b.freiwilliger_id,
                          titel: "📅 Termin verschoben",
                          text: `Dein Termin für "${
                            selected.titel
                          }" wurde auf ${new Date(t.datum).toLocaleDateString(
                            "de-DE"
                          )} verschoben.`,
                          typ: "termin_geaendert",
                          gelesen: false,
                        })
                        .catch(() => {});
                    }
                }
              }
              // Neue Termine einfügen
              const neu = termineData.filter(
                (t) => !t.absagen && !t.id && t.datum
              );
              if (neu.length > 0)
                await supabase
                  .from("termine")
                  .insert(
                    neu.map((t) => ({
                      datum: t.datum,
                      startzeit: t.startzeit,
                      endzeit: t.endzeit || null,
                      freie_plaetze: t.plaetze,
                      gesamt_plaetze: t.plaetze,
                      stelle_id: selected.id,
                    }))
                  );
              showToast("✓ Stelle aktualisiert!");
              await loadStellen(gemeindeId);
              goBack();
            }}
          />
        )}

      {/* ANALYSE */}
      {screen === "analyse" && user?.type === "verein" && (
        <AnalyseDashboard
          stellen={stellen.filter((s) => s.verein_id === user.data.id)}
          vereinId={user.data.id}
          onBack={goBack}
          logout={logout}
        />
      )}


      {screen === "gemeinde-dashboard" && user?.type === "gemeinde" && (
        <GemeindeDashboard
          user={user.data}
          stellen={stellen}
          organisationen={derivedOrganisationen}
          inbox={adminInbox}
          onBack={goBack}
          logout={logout}
          onCreateStelle={handleGemeindeStelleSpeichern}
        />
      )}

      {screen === "admin-dashboard" && user?.type === "admin" && (
        <AdminDashboard
          gemeinden={[]}
          organisationen={derivedOrganisationen}
          freiwillige={[]}
          stellen={stellen}
          anfragen={adminInbox}
          onBack={goBack}
          logout={logout}
        />
      )}

      {/* RECHTLICHE SEITEN */}
      {screen === "impressum" && (
        <RechtlicheSeite
          title="Impressum"
          text={IMPRESSUM_TEXT}
          onBack={goBack}
        />
      )}
      {screen === "datenschutz" && (
        <RechtlicheSeite
          title="Datenschutzerklärung"
          text={DATENSCHUTZ_TEXT}
          onBack={goBack}
        />
      )}
      {screen === "agb" && (
        <RechtlicheSeite title="AGB" text={AGB_TEXT} onBack={goBack} />
      )}
    </div>
  );
}
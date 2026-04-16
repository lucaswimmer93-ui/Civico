import React, { useState, useEffect } from 'react';
import { supabase, T, KATEGORIEN, SKILLS, MEDAILLEN, getSkillLabel, getKat, getMedaille, getNextMedaille, getMedailleName, IMPRESSUM_TEXT, DATENSCHUTZ_TEXT, AGB_TEXT, formatDate, getGemeindeByPlz, isKlarname, isTerminNochNichtGestartet, isTerminAktuell } from '../core/shared';
import { Header, StelleCard, VereineListe, BottomBar, DatenschutzBox, Input, BigButton, Chip, InfoChip, SectionLabel, RoleCard, EmptyState, ErrorMsg } from '../components/ui';
import MessageThreadView from '../components/messages/MessageThreadView';
import { getMyTerminDirectThreads, getOrCreateTerminDirectThread } from '../services/messages';

const bewerbungIstErschienen = (bewerbung) =>
  bewerbung?.status === "erschienen" || Boolean(bewerbung?.bestaetigt);

const bewerbungIstNoShow = (bewerbung) =>
  bewerbung?.status === "no_show" || Boolean(bewerbung?.nicht_erschienen);

const bewerbungIstOffen = (bewerbung) =>
  !bewerbungIstErschienen(bewerbung) && !bewerbungIstNoShow(bewerbung);

const bewerbungIstAktiv = (bewerbung) => {
  if (!bewerbung) return false;
  const status = String(bewerbung.status || "").toLowerCase();
  return !["storniert", "abgesagt", "cancelled", "canceled"].includes(status);
};

const getVereinLogoSrc = (verein) => {
  const raw = verein?.logo_url || verein?.logo || "";
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  if (!value) return "";
  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:image/") ||
    value.startsWith("blob:")
  ) {
    return value;
  }
  return "";
};

const getTerminPlaetze = (termin) => {
  const aktiveBewerbungen = (termin?.bewerbungen || []).filter(bewerbungIstAktiv).length;
  const gesamtPlaetze = Number(
    termin?.gesamt_plaetze ??
      termin?.max_helfer ??
      termin?.plaetze ??
      (Number.isFinite(Number(termin?.freie_plaetze))
        ? Number(termin.freie_plaetze) + aktiveBewerbungen
        : 0)
  );
  const freiePlaetze = Math.max(0, gesamtPlaetze - aktiveBewerbungen);

  const angemeldet = gesamtPlaetze > 0
    ? Math.min(gesamtPlaetze, aktiveBewerbungen)
    : aktiveBewerbungen;

  return {
    gesamtPlaetze,
    freiePlaetze,
    angemeldet,
    belegt: freiePlaetze <= 0,
  };
};

const berechneTerminStunden = (termin, stelle = null) => {
  const direkteDauer = Number(termin?.dauer_stunden);
  if (Number.isFinite(direkteDauer) && direkteDauer > 0) return direkteDauer;

  const start = termin?.startzeit;
  const end = termin?.endzeit;
  if (start && end) {
    try {
      const startDate = new Date(`2000-01-01T${start}`);
      const endDate = new Date(`2000-01-01T${end}`);
      const diff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      if (diff > 0) return diff;
    } catch {}
  }

  const standardDauer = Number(stelle?.standard_dauer_stunden);
  if (Number.isFinite(standardDauer) && standardDauer > 0) return standardDauer;

  return 0;
};


async function getUnreadCountsForThreads(threadIds = [], authUserId = null) {
  const cleanThreadIds = [...new Set((threadIds || []).filter(Boolean))];
  if (!cleanThreadIds.length || !authUserId) {
    return { unreadByThread: new Map(), unreadTotal: 0 };
  }

  const [{ data: readRows, error: readError }, { data: threadRows, error: threadError }] = await Promise.all([
    supabase
      .from('message_read_status')
      .select('thread_id, last_read_at')
      .eq('user_id', authUserId)
      .in('thread_id', cleanThreadIds),
    supabase
      .from('message_threads')
      .select('id, last_message_at')
      .in('id', cleanThreadIds),
  ]);

  if (readError) throw readError;
  if (threadError) throw threadError;

  const readMap = new Map(
    (readRows || []).map((row) => [
      row.thread_id,
      row.last_read_at ? new Date(row.last_read_at).getTime() : 0,
    ])
  );

  const unreadByThread = new Map();

  for (const thread of threadRows || []) {
    const threadId = thread?.id;
    if (!threadId) continue;

    const lastMessageAt = thread?.last_message_at
      ? new Date(thread.last_message_at).getTime()
      : 0;
    const lastReadAt = readMap.get(threadId) || 0;

    unreadByThread.set(
      threadId,
      lastMessageAt && lastMessageAt > lastReadAt ? 1 : 0
    );
  }

  const unreadTotal = Array.from(unreadByThread.values()).reduce(
    (sum, value) => sum + value,
    0
  );
  return { unreadByThread, unreadTotal };
}

async function loadVolunteerDirectThreadsWithUnread({ freiwilligerId, authUserId }) {
  const { data: threads, error: threadsError } = await supabase
    .from('message_threads')
    .select('*')
    .eq('thread_type', 'termin_direct')
    .eq('freiwilliger_id', freiwilligerId)
    .order('last_message_at', { ascending: false });

  if (threadsError) throw threadsError;

  const threadList = threads || [];
  const terminIds = [...new Set(threadList.map((t) => t.termin_id).filter(Boolean))];
  const vereinIds = [...new Set(threadList.map((t) => t.verein_id).filter(Boolean))];

  let termineMap = new Map();
  let vereineMap = new Map();
  let stellenMap = new Map();

  if (terminIds.length > 0) {
    const { data: termineRows, error: termineError } = await supabase
      .from('termine')
      .select('id, datum, startzeit, endzeit, stelle_id')
      .in('id', terminIds);

    if (termineError) throw termineError;
    termineMap = new Map((termineRows || []).map((t) => [t.id, t]));
  }

  const stelleIds = [...new Set(Array.from(termineMap.values()).map((t) => t?.stelle_id).filter(Boolean))];

  if (stelleIds.length > 0) {
    const { data: stellenRows, error: stellenError } = await supabase
      .from('stellen')
      .select('id, titel')
      .in('id', stelleIds);

    if (stellenError) throw stellenError;
    stellenMap = new Map((stellenRows || []).map((s) => [s.id, s]));
  }

  if (vereinIds.length > 0) {
    const { data: vereineRows, error: vereineError } = await supabase
      .from('vereine')
      .select('id, name')
      .in('id', vereinIds);

    if (vereineError) throw vereineError;
    vereineMap = new Map((vereineRows || []).map((v) => [v.id, v]));
  }

  const { unreadByThread, unreadTotal } = await getUnreadCountsForThreads(
    threadList.map((thread) => thread.id),
    authUserId
  );

  const data = threadList.map((thread) => {
    const termin = termineMap.get(thread.termin_id) || null;
    return {
      ...thread,
      unread_count: unreadByThread.get(thread.id) || 0,
      termine: termin,
      vereine: vereineMap.get(thread.verein_id) || null,
      stellen: termin?.stelle_id ? stellenMap.get(termin.stelle_id) || null : null,
    };
  });

  return { threads: data, unreadTotal };
}

function DetailScreen({
  stelle,
  verein,
  user,
  onBack,
  onHome,
  onLogin,
  onBuchen,
  onAbmelden,
  onTerminWechsel,
  onBestaetigen,
  onVereinProfil,
  showToast,
  follows,
  onToggleFollowKat,
  onWarteliste,
}) {
  const kat = getKat(stelle.kategorie);
  const lang = "de";
  const termine = (stelle.termine || []).filter((t) => isTerminAktuell(t));
  const [detailTerminChats, setDetailTerminChats] = useState({});
  const [detailTerminChatLoading, setDetailTerminChatLoading] = useState({});
  const [detailTerminChatErrors, setDetailTerminChatErrors] = useState({});
  const [detailTerminChatOpen, setDetailTerminChatOpen] = useState({});

  const openDetailTerminChat = async (terminId) => {
    if (!terminId) return null;

    setDetailTerminChatOpen((prev) => ({ ...prev, [terminId]: true }));
    setDetailTerminChatLoading((prev) => ({ ...prev, [terminId]: true }));
    setDetailTerminChatErrors((prev) => ({ ...prev, [terminId]: "" }));

    try {
      const thread = await getOrCreateTerminDirectThread(terminId);
      setDetailTerminChats((prev) => ({ ...prev, [terminId]: thread }));
      return thread;
    } catch (err) {
      console.error("Fehler beim Laden des Direktchats im DetailScreen:", err);
      setDetailTerminChatErrors((prev) => ({
        ...prev,
        [terminId]: err?.message || "Chat konnte nicht geladen werden.",
      }));
      return null;
    } finally {
      setDetailTerminChatLoading((prev) => ({ ...prev, [terminId]: false }));
    }
  };

  return (
    <div>
      <div
        style={{
          background: "linear-gradient(160deg, #1A1208, #2C2416)",
          padding: "20px 20px 28px",
          color: "#F4F0E8",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              color: "#8B7355",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ← Zurück
          </button>
          <button
            onClick={onHome}
            style={{
              background: "none",
              border: "none",
              color: "#8B7355",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            🏠 Home
          </button>
        </div>
        <div style={{ fontSize: 36, marginBottom: 8 }}>{kat?.icon}</div>
        <div style={{ fontSize: 22, fontWeight: "bold", lineHeight: 1.3 }}>
          {stelle.titel}
        </div>
        {verein ? (
          <div
            onClick={() => onVereinProfil && onVereinProfil(verein)}
            style={{
              color: "#8B7355",
              fontSize: 14,
              marginTop: 4,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {verein?.name} →
          </div>
        ) : (
          <div
            style={{
              color: "#8B7355",
              fontSize: 14,
              marginTop: 4,
            }}
          >
            {`Gemeinde ${stelle.ort || ""}`.trim()}
          </div>
        )}
        {user?.type === "freiwilliger" && (
          <button
            onClick={() =>
              onToggleFollowKat && onToggleFollowKat(stelle.kategorie)
            }
            style={{
              marginTop: 8,
              padding: "5px 14px",
              borderRadius: 20,
              border: "1px solid #8B7355",
              background: "transparent",
              color: "#C8A96E",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {follows?.kategorien?.includes(stelle.kategorie)
              ? "✓ Kategorie gefolgt"
              : `+ ${kat?.label} folgen`}
          </button>
        )}
      </div>
      <div style={{ padding: "20px 20px 100px", background: "#F4F0E8" }}>
        <div
          style={{
            background: "#FAF7F2",
            borderRadius: 14,
            padding: "16px",
            marginBottom: 16,
            border: "1px solid #E0D8C8",
          }}
        >
          <div style={{ fontSize: 14, color: "#5C4A2A", lineHeight: 1.7 }}>
            {stelle.beschreibung}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <InfoChip icon="📍" label={stelle.ort} />
          {stelle.typ === "dauerhaft" && stelle.aufwand && (
            <InfoChip icon="⏱" label={stelle.aufwand} />
          )}
          <InfoChip
            icon={stelle.typ === "dauerhaft" ? "🔄" : "📅"}
            label={stelle.typ === "dauerhaft" ? "Dauerhaft" : "Event"}
            color={kat?.color}
          />
        </div>
        {stelle.standort && (
          <div
            style={{
              background: "#FAF7F2",
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 16,
              border: "1px solid #E0D8C8",
              display: "flex",
              gap: 10,
            }}
          >
            <span>📌</span>
            <div>
              <div style={{ fontSize: 11, color: "#8B7355" }}>TREFFPUNKT</div>
              <div
                style={{ fontSize: 14, color: "#2C2416", fontWeight: "bold" }}
              >
                {stelle.standort}
              </div>
            </div>
          </div>
        )}
        {stelle.ansprechpartner && (
          <div
            style={{
              background: "#FAF7F2",
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 16,
              border: "1px solid #E0D8C8",
              display: "flex",
              gap: 10,
            }}
          >
            <span>👤</span>
            <div>
              <div style={{ fontSize: 11, color: "#8B7355", marginBottom: 4 }}>
                ANSPRECHPARTNER
              </div>
              <div
                style={{ fontSize: 14, color: "#2C2416", fontWeight: "bold" }}
              >
                {stelle.ansprechpartner}
              </div>
              {stelle.kontakt_email && (
                <a
                  href={`mailto:${stelle.kontakt_email}`}
                  style={{
                    fontSize: 13,
                    color: "#3A7D44",
                    textDecoration: "none",
                    display: "block",
                    marginTop: 3,
                  }}
                >
                  ✉️ {stelle.kontakt_email}
                </a>
              )}
            </div>
          </div>
        )}
        {stelle.required_skills?.length > 0 && (
          <div
            style={{
              background: "#FAF7F2",
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 16,
              border: "1px solid #E0D8C8",
            }}
          >
            <div style={{ fontSize: 11, color: "#8B7355", marginBottom: 8 }}>
              ERFORDERLICHE KENNTNISSE
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {stelle.required_skills.map((sid) => {
                const skill = SKILLS.find((s) => s.id === sid);
                return skill ? (
                  <span
                    key={sid}
                    style={{
                      background: "#EDE8DE",
                      padding: "5px 12px",
                      borderRadius: 20,
                      fontSize: 12,
                      color: "#5C4A2A",
                    }}
                  >
                    {skill.icon} {getSkillLabel(skill, lang)}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}
        <SectionLabel>Verfügbare Termine</SectionLabel>
        {termine.length === 0 ? (
          <div style={{ fontSize: 13, color: "#8B7355", marginBottom: 16 }}>
            Keine Termine verfügbar.
          </div>
        ) : (
          termine.map((t) => {
            const meineBew = user
              ? (t.bewerbungen || []).find(
                  (b) =>
                    b.freiwilliger_id === user?.data?.id &&
                    bewerbungIstAktiv(b)
                )
              : null;
            const { freiePlaetze, angemeldet, belegt } = getTerminPlaetze(t);
            return (
              <div
                key={t.id}
                style={{
                  background: "#FAF7F2",
                  borderRadius: 12,
                  padding: "14px",
                  marginBottom: 10,
                  border: `1px solid ${meineBew ? "#3A7D4444" : "#E0D8C8"}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 8,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: "bold",
                        color: "#2C2416",
                      }}
                    >
                      📅 {formatDate(t.datum)}
                    </div>
                    <div
                      style={{ fontSize: 12, color: "#8B7355", marginTop: 2 }}
                    >
                      🕐 {t.startzeit}
                      {t.endzeit ? ` – ${t.endzeit}` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#8B7355",
                        fontWeight: "bold",
                        marginBottom: 2,
                      }}
                    >
                      {angemeldet} Helfer kommen schon
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: belegt ? "#E85C5C" : "#3A7D44",
                        fontWeight: "bold",
                      }}
                    >
                      {belegt
                        ? "Ausgebucht"
                        : `Noch ${freiePlaetze} Helfer gesucht`}
                    </div>
                  </div>
                </div>
                {meineBew ? (() => {
                  const detailThread = detailTerminChats[t.id];
                  const detailLoading = Boolean(detailTerminChatLoading[t.id]);
                  const detailError = detailTerminChatErrors[t.id] || "";
                  const detailOpen = Boolean(detailTerminChatOpen[t.id]);

                  return (
                    <div
                      style={{ display: "flex", flexDirection: "column", gap: 8 }}
                    >
                      <div
                        style={{
                          padding: "8px",
                          background: "#3A7D4418",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "#3A7D44",
                          fontWeight: "bold",
                          textAlign: "center",
                        }}
                      >
                        ✓ Du bist für diesen Termin angemeldet
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {termine.filter((x) => {
                          if (x.id === t.id) return false;
                          return getTerminPlaetze(x).freiePlaetze > 0;
                        }).length > 0 && (
                          <button
                            onClick={() => onTerminWechsel(meineBew.id, t.id)}
                            style={{
                              flex: 1,
                              padding: "8px",
                              borderRadius: 8,
                              border: "1px solid #2C2416",
                              background: "transparent",
                              color: "#2C2416",
                              fontSize: 12,
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            📅 Termin ändern
                          </button>
                        )}
                        <button
                          onClick={() => openDetailTerminChat(t.id)}
                          style={{
                            flex: 1,
                            padding: "8px",
                            borderRadius: 8,
                            border: "1px solid #2C2416",
                            background: "#2C2416",
                            color: "#FAF7F2",
                            fontSize: 12,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            fontWeight: "bold",
                          }}
                        >
                          💬 Chat
                        </button>
                        <button
                          onClick={() => onAbmelden(meineBew.id, t.id)}
                          style={{
                            flex: 1,
                            padding: "8px",
                            borderRadius: 8,
                            border: "1px solid #E85C5C",
                            background: "transparent",
                            color: "#E85C5C",
                            fontSize: 12,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          Abmelden
                        </button>
                      </div>

                      {detailOpen && (
                        <div
                          style={{
                            marginTop: 4,
                            background: "#FFFDFC",
                            border: "1px solid #E0D8C8",
                            borderRadius: 12,
                            padding: 12,
                          }}
                        >
                          {detailLoading ? (
                            <div style={{ fontSize: 12, color: "#8B7355" }}>
                              Chat wird geladen …
                            </div>
                          ) : detailError ? (
                            <div style={{ fontSize: 12, color: "#B53A2D", fontWeight: "bold" }}>
                              {detailError}
                            </div>
                          ) : detailThread?.id ? (
                            <MessageThreadView
                              threadId={detailThread.id}
                              title="Chat mit dem Verein"
                              emptyText="Noch keine Nachrichten vorhanden."
                              height={260}
                              senderLabels={{
                                freiwilliger: user?.data?.name || "Du",
                                verein: verein?.name || "Verein",
                              }}
                            />
                          ) : (
                            <div style={{ fontSize: 12, color: "#8B7355" }}>
                              Kein Chat verfügbar.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })() : !belegt && isTerminNochNichtGestartet(t) ? (
                  <button
                    onClick={() => {
                      if (user?.type === "verein") return;
                      if (!user) {
                        onLogin();
                        return;
                      }
                      onBuchen(stelle.id, t.id, true);
                    }}
                    disabled={user?.type === "verein"}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: 10,
                      border: "none",
                      background: user?.type === "verein" ? "#D9D1C2" : "#3A7D44",
                      color: user?.type === "verein" ? "#8B7355" : "#fff",
                      fontSize: 13,
                      fontFamily: "inherit",
                      fontWeight: "bold",
                      cursor: user?.type === "verein" ? "not-allowed" : "pointer",
                      opacity: user?.type === "verein" ? 0.9 : 1,
                    }}
                  >
                    {user?.type === "verein" ? "Nur für Freiwillige" : user ? "Dabei sein & helfen →" : "Registrieren & helfen →"}
                  </button>
                ) : !belegt && !isTerminNochNichtGestartet(t) ? (
                  <div
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: 10,
                      background: "#F0EBE0",
                      color: "#8B7355",
                      fontSize: 13,
                      fontFamily: "inherit",
                      textAlign: "center",
                    }}
                  >
                    ⏳ Termin läuft gerade – Anmeldung nicht mehr möglich
                  </div>
                ) : user && user?.type !== "verein" ? (
                  <button
                    onClick={() =>
                      onWarteliste && onWarteliste(stelle.id, t.id)
                    }
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: 10,
                      border: "1px solid #E8A87C",
                      background: "transparent",
                      color: "#E8A87C",
                      fontSize: 13,
                      fontFamily: "inherit",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    📋 Auf die Warteliste
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function VereinProfilPublic({
  verein,
  stellen,
  onBack,
  onHome,
  onStelleClick,
  user,
  onLogin,
  logout,
  follows,
  onToggleFollow,
  isEigen = false,
  onBearbeiten,
  followers = [],
}) {
  const vereinStellen = stellen.filter(
    (s) => s.verein_id === verein.id && !s.archiviert
  );
  const istGefolgt = follows?.vereine?.includes(verein.id);

  return (
    <div>
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(160deg,#1A1208,#2C2416)",
          padding: "20px 20px 16px",
          color: "#F4F0E8",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              color: "#8B7355",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ←
          </button>
          <div style={{ fontSize: 18, fontWeight: "bold" }}>Vereinsprofil</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onHome}
            style={{
              background: "none",
              border: "none",
              color: "#8B7355",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            🏠
          </button>
          {user ? (
            <button
              onClick={logout}
              style={{
                background: "transparent",
                border: "none",
                color: "#8B7355",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Abmelden
            </button>
          ) : (
            onLogin && (
              <button
                onClick={onLogin}
                style={{
                  background: "#3A7D44",
                  border: "none",
                  color: "#fff",
                  fontSize: 12,
                  padding: "6px 14px",
                  borderRadius: 16,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Anmelden
              </button>
            )
          )}
        </div>
      </div>

      <div style={{ padding: "20px 20px 100px" }}>
        {/* Profil-Karte – wie Freiwilligen-Profil */}
        <div
          style={{
            background: "linear-gradient(135deg,#2C2416,#4A3C28)",
            borderRadius: 16,
            padding: "24px 20px",
            marginBottom: 16,
            textAlign: "center",
            color: "#F4F0E8",
          }}
        >
          <div
            style={{
              position: "relative",
              display: "inline-block",
              marginBottom: 4,
            }}
          >
            {getVereinLogoSrc(verein) ? (
              <img
                src={getVereinLogoSrc(verein)}
                alt="Logo"
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "3px solid #C8A96E",
                }}
              />
            ) : (
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 44,
                  margin: "0 auto",
                }}
              >
                {verein.logo || "🏢"}
              </div>
            )}
          </div>
          <div style={{ fontSize: 20, fontWeight: "bold", marginTop: 8 }}>
            {verein.name}
          </div>
          <div style={{ fontSize: 13, color: "#8B7355", marginTop: 4 }}>
            📍 {verein.ort}
          </div>
          {/* Stats */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 24,
              marginTop: 16,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{ fontSize: 24, fontWeight: "bold", color: "#E8A87C" }}
              >
                {verein.mitglieder || 0}
              </div>
              <div style={{ fontSize: 11, color: "#8B7355" }}>Mitglieder</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div
                style={{ fontSize: 24, fontWeight: "bold", color: "#B07EC4" }}
              >
                {vereinStellen.length}
              </div>
              <div style={{ fontSize: 11, color: "#8B7355" }}>Aktionen</div>
            </div>
            {verein.gegruendet > 0 && (
              <div style={{ textAlign: "center" }}>
                <div
                  style={{ fontSize: 24, fontWeight: "bold", color: "#6BAF7A" }}
                >
                  {verein.gegruendet}
                </div>
                <div style={{ fontSize: 11, color: "#8B7355" }}>Gegründet</div>
              </div>
            )}
            {isEigen && followers.length > 0 && (
              <div style={{ textAlign: "center" }}>
                <div
                  style={{ fontSize: 24, fontWeight: "bold", color: "#C8A96E" }}
                >
                  {followers.length}
                </div>
                <div style={{ fontSize: 11, color: "#8B7355" }}>Follower</div>
              </div>
            )}
          </div>
          {/* Button */}
          {isEigen ? (
            <button
              onClick={onBearbeiten}
              style={{
                marginTop: 14,
                padding: "8px 22px",
                borderRadius: 20,
                border: "1px solid #C8A96E",
                background: "transparent",
                color: "#C8A96E",
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: "bold",
              }}
            >
              ✏️ Profil bearbeiten
            </button>
          ) : (
            user?.type === "freiwilliger" && (
              <button
                onClick={() => onToggleFollow && onToggleFollow(verein.id)}
                style={{
                  marginTop: 14,
                  padding: "8px 22px",
                  borderRadius: 20,
                  border: "none",
                  background: istGefolgt ? "#C8A96E" : "rgba(255,255,255,0.2)",
                  color: "#F4F0E8",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: "bold",
                }}
              >
                {istGefolgt ? "✓ Gefolgt" : "+ Folgen"}
              </button>
            )
          )}
        </div>

        {/* Follower (nur eigenes Profil) */}
        {isEigen && followers.length > 0 && (
          <div
            style={{
              background: "#FAF7F2",
              borderRadius: 14,
              padding: "16px",
              marginBottom: 14,
              border: "1px solid #E0D8C8",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#8B7355",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              👥 FOLGEN DIR
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {followers.slice(0, 6).map((f, i) => (
                <div
                  key={i}
                  style={{
                    background: "#EDE8DE",
                    borderRadius: 20,
                    padding: "5px 12px",
                    fontSize: 12,
                    color: "#5C4A2A",
                  }}
                >
                  👤 {f.freiwillige?.name || "Freiwilliger"}
                </div>
              ))}
              {followers.length > 6 && (
                <div
                  style={{ fontSize: 12, color: "#8B7355", padding: "5px 6px" }}
                >
                  +{followers.length - 6} weitere
                </div>
              )}
            </div>
          </div>
        )}

        {/* Über uns – immer anzeigen */}
        <div
          style={{
            background: "#FAF7F2",
            borderRadius: 14,
            padding: "16px",
            marginBottom: 14,
            border: "1px solid #E0D8C8",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#8B7355",
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            ÜBER UNS
          </div>
          {verein.beschreibung ? (
            <div style={{ fontSize: 14, color: "#2C2416", lineHeight: 1.7 }}>
              {verein.beschreibung}
            </div>
          ) : (
            <div
              style={{ fontSize: 13, color: "#C4B89A", fontStyle: "italic" }}
            >
              {isEigen
                ? "Noch keine Beschreibung. Klick auf ✏️ Profil bearbeiten um eine hinzuzufügen."
                : "Dieser Verein hat noch keine Beschreibung hinterlegt."}
            </div>
          )}
        </div>

        {/* Kontakt & Infos */}
        {(verein.strasse ||
          verein.kontakt_email ||
          verein.telefon ||
          verein.website) && (
          <div
            style={{
              background: "#FAF7F2",
              borderRadius: 14,
              padding: "16px",
              marginBottom: 14,
              border: "1px solid #E0D8C8",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#8B7355",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              KONTAKT & INFOS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {verein.strasse && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    fontSize: 14,
                    color: "#2C2416",
                  }}
                >
                  <span>📍</span>
                  <span>
                    {verein.strasse}, {verein.plz} {verein.ort}
                  </span>
                </div>
              )}
              {verein.kontakt_email && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    fontSize: 14,
                    color: "#2C2416",
                  }}
                >
                  <span>📧</span>
                  <a
                    href={`mailto:${verein.kontakt_email}`}
                    style={{ color: "#3A7D44", textDecoration: "none" }}
                  >
                    {verein.kontakt_email}
                  </a>
                </div>
              )}
              {verein.telefon && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    fontSize: 14,
                    color: "#2C2416",
                  }}
                >
                  <span>📞</span>
                  <a
                    href={`tel:${verein.telefon}`}
                    style={{ color: "#3A7D44", textDecoration: "none" }}
                  >
                    {verein.telefon}
                  </a>
                </div>
              )}
              {verein.website && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    fontSize: 14,
                    color: "#2C2416",
                  }}
                >
                  <span>🌐</span>
                  <a
                    href={
                      verein.website.startsWith("http")
                        ? verein.website
                        : "https://" + verein.website
                    }
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#3A7D44", textDecoration: "none" }}
                  >
                    {verein.website}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Kontakt */}
        {(verein.regStrasse || verein.kontakt_email) && (
          <div
            style={{
              background: "#FAF7F2",
              borderRadius: 14,
              padding: "16px",
              marginBottom: 14,
              border: "1px solid #E0D8C8",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#8B7355",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              KONTAKT & ADRESSE
            </div>
            {verein.regStrasse && (
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 18 }}>📍</span>
                <div style={{ fontSize: 14, color: "#2C2416" }}>
                  {verein.strasse}, {verein.plz} {verein.ort}
                </div>
              </div>
            )}
            {verein.kontakt_email && (
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 18 }}>✉️</span>
                <a
                  href={`mailto:${verein.kontakt_email}`}
                  style={{
                    fontSize: 14,
                    color: "#3A7D44",
                    textDecoration: "none",
                  }}
                >
                  {verein.kontakt_email}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Kategorien des Vereins */}
        {(() => {
          const kats = [
            ...new Set(vereinStellen.map((s) => s.kategorie).filter(Boolean)),
          ];
          if (kats.length === 0) return null;
          return (
            <div
              style={{
                background: "#FAF7F2",
                borderRadius: 14,
                padding: "16px",
                marginBottom: 14,
                border: "1px solid #E0D8C8",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#8B7355",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                TÄTIGKEITSBEREICHE
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {kats.map((kid) => {
                  const kat = KATEGORIEN.find((k) => k.id === kid);
                  return kat ? (
                    <span
                      key={kid}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 20,
                        background: kat.color + "22",
                        color: kat.color,
                        fontSize: 12,
                        fontWeight: "bold",
                      }}
                    >
                      {kat.icon} {kat.label}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          );
        })()}

        {/* Kontakt */}
        {(verein.kontakt_email ||
          verein.regStrasse ||
          verein.regTelefon ||
          verein.regWebsite) && (
          <div
            style={{
              background: "#FAF7F2",
              borderRadius: 14,
              padding: "16px",
              marginBottom: 14,
              border: "1px solid #E0D8C8",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#8B7355",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              📬 KONTAKT & ADRESSE
            </div>
            {verein.regStrasse && (
              <div
                style={{
                  fontSize: 13,
                  color: "#2C2416",
                  marginBottom: 6,
                  display: "flex",
                  gap: 8,
                }}
              >
                <span>📍</span> {verein.strasse}, {verein.plz} {verein.ort}
              </div>
            )}
            {verein.kontakt_email && (
              <div
                style={{
                  fontSize: 13,
                  color: "#2C2416",
                  marginBottom: 6,
                  display: "flex",
                  gap: 8,
                }}
              >
                <span>✉️</span>
                <a
                  href={`mailto:${verein.kontakt_email}`}
                  style={{ color: "#3A7D44", textDecoration: "none" }}
                >
                  {verein.kontakt_email}
                </a>
              </div>
            )}
            {verein.regTelefon && (
              <div
                style={{
                  fontSize: 13,
                  color: "#2C2416",
                  marginBottom: 6,
                  display: "flex",
                  gap: 8,
                }}
              >
                <span>📞</span>
                <a
                  href={`tel:${verein.telefon}`}
                  style={{ color: "#3A7D44", textDecoration: "none" }}
                >
                  {verein.telefon}
                </a>
              </div>
            )}
            {verein.regWebsite && (
              <div
                style={{
                  fontSize: 13,
                  color: "#2C2416",
                  display: "flex",
                  gap: 8,
                }}
              >
                <span>🌐</span>
                <a
                  href={
                    verein.website.startsWith("http")
                      ? verein.regWebsite
                      : "https://" + verein.website
                  }
                  target="_blank"
                  rel="noopener"
                  style={{ color: "#3A7D44", textDecoration: "none" }}
                >
                  {verein.website}
                </a>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}


function FreiwilligenDashboard({
  user,
  stellen,
  follows = { vereine: [], kategorien: [] },
  onOpenDetail,
  onOpenKommunikation,
  onOpenVerein,
  onOpenStellen,
  onOpenProfil,
}) {
  const [meineChats, setMeineChats] = useState([]);
  const [meineChatsLoading, setMeineChatsLoading] = useState(false);
  const [historicalStats, setHistoricalStats] = useState({ bestaetigteEinsaetze: 0, geleisteteStunden: 0 });

  useEffect(() => {
    let active = true;

    async function loadMyChats() {
      setMeineChatsLoading(true);
      try {
        const { threads } = await loadVolunteerDirectThreadsWithUnread({
          freiwilligerId: user.data.id,
          authUserId: user.data.auth_id,
        });

        if (!active) return;
        setMeineChats(threads || []);
      } catch (err) {
        console.error("Dashboard-Chats konnten nicht geladen werden:", err);
        if (!active) return;
        setMeineChats([]);
      } finally {
        if (active) setMeineChatsLoading(false);
      }
    }

    loadMyChats();

    const channel = supabase
      .channel(`freiwilligen-dashboard-chats-${user?.data?.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        loadMyChats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_threads' }, () => {
        loadMyChats();
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user?.data?.id, user?.data?.auth_id]);

  const aktiveEinsaetze = (stellen || [])
    .flatMap((stelle) =>
      (stelle.termine || [])
        .filter((termin) => isTerminAktuell(termin))
        .map((termin) => {
          const bewerbung = (termin.bewerbungen || []).find(
            (b) => b.freiwilliger_id === user?.data?.id && bewerbungIstAktiv(b)
          );
          if (!bewerbung) return null;
          return {
            stelle,
            termin,
          };
        })
        .filter(Boolean)
    )
    .sort((a, b) => {
      const aTime = new Date(`${a.termin.datum}T${a.termin.startzeit || "00:00"}`).getTime();
      const bTime = new Date(`${b.termin.datum}T${b.termin.startzeit || "00:00"}`).getTime();
      return aTime - bTime;
    });

  const naechsteEinsaetze = aktiveEinsaetze.slice(0, 3);

  const vergangeneEinsaetzeAusStellen = (stellen || [])
    .flatMap((stelle) =>
      (stelle.termine || [])
        .map((termin) => {
          const bewerbung = (termin.bewerbungen || []).find(
            (b) => b.freiwilliger_id === user?.data?.id && bewerbungIstErschienen(b)
          );
          if (!bewerbung) return null;
          return { stelle, termin };
        })
        .filter(Boolean)
    );

  const lokaleBestaetigteEinsaetze = vergangeneEinsaetzeAusStellen.length;
  const lokaleGeleisteteStunden = vergangeneEinsaetzeAusStellen.reduce(
    (sum, item) => sum + berechneTerminStunden(item?.termin, item?.stelle),
    0
  );

  useEffect(() => {
    let active = true;

    async function loadHistoricalStats() {
      if (!user?.data?.id) {
        if (active) setHistoricalStats({ bestaetigteEinsaetze: 0, geleisteteStunden: 0 });
        return;
      }

      try {
        const { data: bewerbungen, error: bewerbungenError } = await supabase
          .from("bewerbungen")
          .select("id, termin_id, stelle_id, status, bestaetigt")
          .eq("freiwilliger_id", user.data.id)
          .or("status.eq.erschienen,bestaetigt.eq.true");

        if (bewerbungenError) throw bewerbungenError;

        const rows = bewerbungen || [];
        const terminIds = [...new Set(rows.map((row) => row.termin_id).filter(Boolean))];
        const stelleIds = [...new Set(rows.map((row) => row.stelle_id).filter(Boolean))];

        let termineMap = new Map();
        let stellenMap = new Map();

        if (terminIds.length > 0) {
          const { data: termineRows, error: termineError } = await supabase
            .from("termine")
            .select("id, startzeit, endzeit, dauer_stunden")
            .in("id", terminIds);

          if (termineError) throw termineError;
          termineMap = new Map((termineRows || []).map((termin) => [termin.id, termin]));
        }

        if (stelleIds.length > 0) {
          const { data: stellenRows, error: stellenError } = await supabase
            .from("stellen")
            .select("id, standard_dauer_stunden")
            .in("id", stelleIds);

          if (stellenError) throw stellenError;
          stellenMap = new Map((stellenRows || []).map((stelle) => [stelle.id, stelle]));
        }

        const bestaetigteEinsaetze = rows.length;
        const geleisteteStunden = rows.reduce((sum, row) => {
          const termin = termineMap.get(row.termin_id) || null;
          const stelle = stellenMap.get(row.stelle_id) || null;
          return sum + berechneTerminStunden(termin, stelle);
        }, 0);

        if (!active) return;
        setHistoricalStats({
          bestaetigteEinsaetze,
          geleisteteStunden,
        });
      } catch (err) {
        console.error("Historische Freiwilligen-Statistiken konnten nicht geladen werden:", err);
        if (!active) return;
        setHistoricalStats({
          bestaetigteEinsaetze: lokaleBestaetigteEinsaetze,
          geleisteteStunden: lokaleGeleisteteStunden,
        });
      }
    }

    loadHistoricalStats();
    return () => {
      active = false;
    };
  }, [user?.data?.id, lokaleBestaetigteEinsaetze, lokaleGeleisteteStunden]);

  const bestaetigteEinsaetzeGesamt = Math.max(
    lokaleBestaetigteEinsaetze,
    Number(historicalStats?.bestaetigteEinsaetze || 0)
  );
  const geleisteteStundenGesamt = Math.max(
    lokaleGeleisteteStunden,
    Number(historicalStats?.geleisteteStunden || 0)
  );

  const gefolgteVereine = [...new Set(follows?.vereine || [])]
    .map((vereinId) => (stellen || []).find((s) => s.verein_id === vereinId)?.vereine)
    .filter(Boolean)
    .slice(0, 3);

  const gefolgteKategorien = (follows?.kategorien || [])
    .map((katId) => KATEGORIEN.find((k) => k.id === katId))
    .filter(Boolean)
    .slice(0, 3);

  return (
    <div>
      <div
        style={{
          background: "linear-gradient(160deg,#1A1208,#2C2416)",
          padding: "20px 20px 18px",
          color: "#F4F0E8",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: "bold", marginBottom: 4 }}>
          Dashboard
        </div>
        <div style={{ fontSize: 13, color: "#C4B89A" }}>
          Willkommen zurück, {user?.data?.name || "Helfer"} 👋
        </div>
      </div>

      <div style={{ padding: "16px 16px 100px" }}>
        <div
          style={{
            background: "linear-gradient(135deg,#2C2416,#4A3C28)",
            borderRadius: 16,
            padding: "18px 16px",
            marginBottom: 16,
            color: "#F4F0E8",
          }}
        >
          <div style={{ fontSize: 13, color: "#C4B89A", marginBottom: 12 }}>
            Dein Überblick
          </div>
          <div style={{ display: "flex", gap: 18, justifyContent: "space-between" }}>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "#E8A87C" }}>
                {naechsteEinsaetze.length}
              </div>
              <div style={{ fontSize: 11, color: "#C4B89A" }}>aktive Einsätze</div>
            </div>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "#6BAF7A" }}>
                {geleisteteStundenGesamt.toFixed(1)}h
              </div>
              <div style={{ fontSize: 11, color: "#C4B89A" }}>geleistet</div>
            </div>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: "bold", color: "#C8A96E" }}>
                {user?.data?.punkte || 0}
              </div>
              <div style={{ fontSize: 11, color: "#C4B89A" }}>Punkte</div>
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#FAF7F2",
            borderRadius: 14,
            padding: "16px",
            marginBottom: 14,
            border: "1px solid #E0D8C8",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: "center" }}>
            <div style={{ fontSize: 11, color: "#8B7355", letterSpacing: 2, textTransform: "uppercase" }}>
              🤝 HIER HELFE ICH
            </div>
            <button
              onClick={onOpenStellen}
              style={{
                background: "none",
                border: "none",
                color: "#3A7D44",
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
                fontWeight: "bold",
              }}
            >
              Alle Stellen →
            </button>
          </div>

          {naechsteEinsaetze.length === 0 ? (
            <div style={{ fontSize: 13, color: "#8B7355" }}>
              Aktuell hast du keine aktiven Einsätze.
            </div>
          ) : (
            naechsteEinsaetze.map(({ stelle, termin }) => (
              <button
                key={termin.id}
                onClick={() => onOpenDetail && onOpenDetail(stelle)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "12px",
                  borderRadius: 12,
                  border: "1px solid #E0D8C8",
                  background: "#FFFDFC",
                  marginBottom: 8,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: "bold", color: "#2C2416", marginBottom: 4 }}>
                  {stelle.titel}
                </div>
                <div style={{ fontSize: 12, color: "#8B7355", marginBottom: 4 }}>
                  {stelle.vereine?.name || "Verein"}
                </div>
                <div style={{ fontSize: 11, color: "#3A7D44" }}>
                  📅 {formatDate(termin.datum)} · 🕐 {termin.startzeit}
                  {termin.endzeit ? ` – ${termin.endzeit}` : ""}
                </div>
              </button>
            ))
          )}
        </div>

        <div
          style={{
            background: "#FAF7F2",
            borderRadius: 14,
            padding: "16px",
            marginBottom: 14,
            border: "1px solid #E0D8C8",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: "center" }}>
            <div style={{ fontSize: 11, color: "#8B7355", letterSpacing: 2, textTransform: "uppercase" }}>
              💬 KOMMUNIKATION
            </div>
            <button
              onClick={onOpenKommunikation}
              style={{
                background: "none",
                border: "none",
                color: "#3A7D44",
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>Alle Chats</span>
              {meineChats.reduce((sum, thread) => sum + (thread.unread_count || 0), 0) > 0 && (
                <span
                  style={{
                    minWidth: 18,
                    height: 18,
                    padding: "0 6px",
                    borderRadius: 999,
                    background: "#E85C5C",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: "bold",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {meineChats.reduce((sum, thread) => sum + (thread.unread_count || 0), 0)}
                </span>
              )}
            </button>
          </div>

          {meineChatsLoading ? (
            <div style={{ fontSize: 13, color: "#8B7355" }}>Chats werden geladen …</div>
          ) : meineChats.length === 0 ? (
            <div style={{ fontSize: 13, color: "#8B7355" }}>
              Noch keine direkten Chats mit Vereinen vorhanden.
            </div>
          ) : (
            meineChats.slice(0, 2).map((thread) => {
              const termin = thread.termine;
              return (
                <button
                  key={thread.id}
                  onClick={onOpenKommunikation}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "12px",
                    borderRadius: 12,
                    border: "1px solid #E0D8C8",
                    background: "#FFFDFC",
                    marginBottom: 8,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: "bold", color: "#2C2416" }}>
                      {thread.vereine?.name || "Verein"}
                    </div>
                    {thread.unread_count > 0 && (
                      <span style={{ minWidth: 18, height: 18, padding: "0 6px", borderRadius: 999, background: "#E85C5C", color: "#fff", fontSize: 10, fontWeight: "bold", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        {thread.unread_count}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#3A7D44" }}>
                    📅 {termin?.datum ? formatDate(termin.datum) : "-"} · 🕐 {termin?.startzeit || "-"}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div
          style={{
            background: "#FAF7F2",
            borderRadius: 14,
            padding: "16px",
            marginBottom: 14,
            border: "1px solid #E0D8C8",
          }}
        >
          <div style={{ fontSize: 11, color: "#8B7355", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
            ⭐ FOLGE ICH
          </div>

          {gefolgteVereine.length === 0 && gefolgteKategorien.length === 0 ? (
            <div style={{ fontSize: 13, color: "#8B7355" }}>
              Du folgst aktuell noch keinen Vereinen oder Kategorien.
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {gefolgteVereine.map((verein) => (
                <button
                  key={verein.id}
                  onClick={() => onOpenVerein && onOpenVerein(verein)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 20,
                    border: "1px solid #C8A96E",
                    background: "#C8A96E22",
                    color: "#8B6800",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  🏢 {verein.name}
                </button>
              ))}
              {gefolgteKategorien.map((kat) => (
                <span
                  key={kat.id}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 20,
                    background: kat.color + "22",
                    color: kat.color,
                    fontSize: 12,
                  }}
                >
                  {kat.icon} {kat.label}
                </span>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            background: "#FAF7F2",
            borderRadius: 14,
            padding: "16px",
            marginBottom: 14,
            border: "1px solid #E0D8C8",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, alignItems: "center" }}>
            <div style={{ fontSize: 11, color: "#8B7355", letterSpacing: 2, textTransform: "uppercase" }}>
              🏆 ERFOLGE
            </div>
            <button
              onClick={onOpenProfil}
              style={{
                background: "none",
                border: "none",
                color: "#3A7D44",
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
                fontWeight: "bold",
              }}
            >
              Profil →
            </button>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, background: "#FFFDFC", border: "1px solid #E0D8C8", borderRadius: 12, padding: "12px" }}>
              <div style={{ fontSize: 20, fontWeight: "bold", color: "#E8A87C", marginBottom: 4 }}>
                {bestaetigteEinsaetzeGesamt}
              </div>
              <div style={{ fontSize: 11, color: "#8B7355" }}>bestätigte Einsätze</div>
            </div>
            <div style={{ flex: 1, background: "#FFFDFC", border: "1px solid #E0D8C8", borderRadius: 12, padding: "12px" }}>
              <div style={{ fontSize: 20, fontWeight: "bold", color: "#6BAF7A", marginBottom: 4 }}>
                {geleisteteStundenGesamt.toFixed(1)}h
              </div>
              <div style={{ fontSize: 11, color: "#8B7355" }}>geleistete Zeit</div>
            </div>
            <div style={{ flex: 1, background: "#FFFDFC", border: "1px solid #E0D8C8", borderRadius: 12, padding: "12px" }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>
                {getMedaille(user?.data?.punkte || 0).icon}
              </div>
              <div style={{ fontSize: 11, color: "#8B7355" }}>aktuelle Medaille</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FreiwilligenKommunikation({
  user,
}) {
  const [meineChats, setMeineChats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedChat, setSelectedChat] = useState(null);
  const [kommunikationTab, setKommunikationTab] = useState("vereine");
  const [supportThreadId, setSupportThreadId] = useState(null);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportError, setSupportError] = useState("");
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadMyChats() {
      setLoading(true);
      setError("");

      try {
        const { threads } = await loadVolunteerDirectThreadsWithUnread({
          freiwilligerId: user.data.id,
          authUserId: user.data.auth_id,
        });

        if (!active) return;
        setMeineChats(threads || []);
        setSelectedChat((prev) => {
          if (prev?.id && (threads || []).some((item) => item.id === prev.id)) {
            return (threads || []).find((item) => item.id === prev.id) || prev;
          }
          return (threads || [])[0] || null;
        });
      } catch (err) {
        if (!active) return;
        console.error("Kommunikation konnte nicht geladen werden:", err);
        setError(err?.message || "Chats konnten nicht geladen werden.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadMyChats();

    const channel = supabase
      .channel(`freiwilligen-kommunikation-${user?.data?.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        loadMyChats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_threads' }, () => {
        loadMyChats();
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [user?.data?.id, user?.data?.auth_id]);

  const ensureSupportThread = async () => {
    if (!user?.data?.id) return;

    try {
      setSupportLoading(true);
      setSupportError("");

      const { data: existing, error: existingError } = await supabase
        .from("message_threads")
        .select("id")
        .eq("thread_type", "support")
        .eq("freiwilliger_id", user.data.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing?.id) {
        setSupportThreadId(existing.id);
        setSupportUnreadCount(0);
        return;
      }

      const { data: created, error: createError } = await supabase
        .from("message_threads")
        .insert([
          {
            thread_type: "support",
            freiwilliger_id: user.data.id,
            created_by_user_id: user?.data?.auth_id || null,
            last_message_at: new Date().toISOString(),
          },
        ])
        .select("id")
        .single();

      if (createError) throw createError;

      setSupportThreadId(created?.id || null);
      setSupportUnreadCount(0);
    } catch (err) {
      console.error("Support konnte nicht geladen werden:", err);
      setSupportError(err?.message || "Support konnte nicht geladen werden.");
    } finally {
      setSupportLoading(false);
    }
  };

  useEffect(() => {
    if (kommunikationTab === "support" && !supportThreadId && !supportLoading) {
      ensureSupportThread();
    }
  }, [kommunikationTab, supportThreadId, supportLoading, user?.data?.id]);

  useEffect(() => {
    let active = true;

    async function loadSupportUnread() {
      if (!supportThreadId || !user?.data?.auth_id) {
        if (active) setSupportUnreadCount(0);
        return;
      }

      try {
        const { unreadByThread } = await getUnreadCountsForThreads([supportThreadId], user.data.auth_id);
        if (!active) return;
        setSupportUnreadCount(unreadByThread.get(supportThreadId) || 0);
      } catch (err) {
        console.error('Support unread count konnte nicht geladen werden:', err);
        if (active) setSupportUnreadCount(0);
      }
    }

    loadSupportUnread();

    const channel = supabase
      .channel(`freiwilligen-support-unread-${user?.data?.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        loadSupportUnread();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_threads' }, () => {
        loadSupportUnread();
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [supportThreadId, user?.data?.auth_id, user?.data?.id]);

  return (
    <div>
      <div
        style={{
          background: "linear-gradient(160deg,#1A1208,#2C2416)",
          padding: "20px 20px 18px",
          color: "#F4F0E8",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: "bold", marginBottom: 4 }}>
          Kommunikation
        </div>
        <div style={{ fontSize: 13, color: "#C4B89A" }}>
          Deine Chats mit Vereinen und der Support an Civico
        </div>
      </div>

      <div style={{ padding: "16px 16px 100px" }}>
        <div
          style={{
            background: "#FAF7F2",
            borderRadius: 14,
            padding: "16px",
            border: "1px solid #E0D8C8",
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {[
              ["vereine", "🏢 Vereins-Chats", meineChats.reduce((sum, thread) => sum + (thread.unread_count || 0), 0)],
              ["support", "🛟 Support", supportUnreadCount],
            ].map(([key, label, unreadCount]) => (
              <button
                key={key}
                onClick={() => setKommunikationTab(key)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: kommunikationTab === key ? "none" : "1px solid #E0D8C8",
                  background: kommunikationTab === key ? "#2C2416" : "#FFFDFC",
                  color: kommunikationTab === key ? "#FAF7F2" : "#2C2416",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: "bold",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span>{label}</span>
                  {unreadCount > 0 && (
                    <span style={{ minWidth: 18, height: 18, padding: "0 6px", borderRadius: 999, background: kommunikationTab === key ? "#E85C5C" : "#E85C5C", color: "#fff", fontSize: 10, fontWeight: "bold", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      {unreadCount}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>

          {kommunikationTab === "vereine" ? (
            loading ? (
              <div style={{ fontSize: 13, color: "#8B7355" }}>Chats werden geladen …</div>
            ) : error ? (
              <div style={{ fontSize: 13, color: "#B53A2D", fontWeight: "bold" }}>{error}</div>
            ) : meineChats.length === 0 ? (
              <div style={{ fontSize: 13, color: "#8B7355" }}>
                Noch keine direkten Chats vorhanden.
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                  {meineChats.map((thread) => {
                    const termin = thread.termine;
                    const stelleTitel = thread.stellen?.titel || "Stelle";
                    const vereinName = thread.vereine?.name || "Verein";
                    const isActive = selectedChat?.id === thread.id;

                    return (
                      <button
                        key={thread.id}
                        onClick={() => {
                          setSelectedChat(thread);
                        }}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          border: isActive ? "2px solid #2C2416" : "1px solid #E0D8C8",
                          background: isActive ? "#F3EBDD" : "#FFFDFC",
                          borderRadius: 12,
                          padding: "12px",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 4 }}>
                          <div style={{ fontSize: 13, fontWeight: "bold", color: "#2C2416" }}>
                            {stelleTitel || "Stelle"}
                          </div>
                          {thread.unread_count > 0 && (
                            <span style={{ minWidth: 18, height: 18, padding: "0 6px", borderRadius: 999, background: "#E85C5C", color: "#fff", fontSize: 10, fontWeight: "bold", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                              {thread.unread_count}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "#8B7355", marginBottom: 4 }}>
                          {vereinName}
                        </div>
                        <div style={{ fontSize: 11, color: "#3A7D44" }}>
                          📅 {termin?.datum ? formatDate(termin.datum) : "-"} · 🕐 {termin?.startzeit || "-"}
                          {termin?.endzeit ? ` – ${termin.endzeit}` : ""}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedChat?.id ? (
                  <MessageThreadView
                    threadId={selectedChat.id}
                    title="Chat mit dem Verein"
                    emptyText="Noch keine Nachrichten vorhanden."
                    height={320}
                    onMessageSent={async () => {
                      const { threads } = await loadVolunteerDirectThreadsWithUnread({
                        freiwilligerId: user.data.id,
                        authUserId: user.data.auth_id,
                      });
                      setMeineChats(threads || []);
                    }}
                    onThreadRead={async () => {
                      const { threads } = await loadVolunteerDirectThreadsWithUnread({
                        freiwilligerId: user.data.id,
                        authUserId: user.data.auth_id,
                      });
                      setMeineChats(threads || []);
                    }}
                  />
                ) : null}
              </>
            )
          ) : (
            supportLoading ? (
              <div style={{ fontSize: 13, color: "#8B7355" }}>Support wird geladen …</div>
            ) : supportError ? (
              <div style={{ background: "#FFF4F2", borderRadius: 12, padding: 14, border: "1px solid #F0C9C3" }}>
                <div style={{ fontSize: 13, color: "#B53A2D", fontWeight: "bold", marginBottom: 10 }}>{supportError}</div>
                <button
                  onClick={ensureSupportThread}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: "#2C2416",
                    color: "#FAF7F2",
                    fontSize: 12,
                    fontWeight: "bold",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Erneut versuchen
                </button>
              </div>
            ) : supportThreadId ? (
              <MessageThreadView
                threadId={supportThreadId}
                title="Support"
                emptyText="Noch keine Nachrichten vorhanden."
                height={320}
                onMessageSent={async () => {
                  const { unreadByThread } = await getUnreadCountsForThreads([supportThreadId], user.data.auth_id);
                  setSupportUnreadCount(unreadByThread.get(supportThreadId) || 0);
                }}
                onThreadRead={async () => {
                  const { unreadByThread } = await getUnreadCountsForThreads([supportThreadId], user.data.auth_id);
                  setSupportUnreadCount(unreadByThread.get(supportThreadId) || 0);
                }}
              />
            ) : (
              <div style={{ fontSize: 13, color: "#8B7355" }}>
                Noch kein Support-Chat vorhanden.
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}


function FreiwilligerProfil({
  user,
  setUser,
  stellen,
  onBack,
  onHome,
  onDelete,
  logout,
  showToast,
  loadStellen,
  gemeindeId,
  onEinstellungen,
  t = T["de"],
  lang = "de",
  follows = { vereine: [], kategorien: [] },
  onToggleFollow,
  onVereinClick,
}) {
  const [terminWechselStelle, setTerminWechselStelle] = useState(null);
  const [meineWarteliste, setMeineWarteliste] = useState([]);
  const [meineChats, setMeineChats] = useState([]);
  const [meineChatsLoading, setMeineChatsLoading] = useState(false);
  const [meineChatsError, setMeineChatsError] = useState("");
  const [selectedChat, setSelectedChat] = useState(null);
  const jetzt = new Date();

  useEffect(() => {
    supabase
      .from("warteliste")
      .select("*")
      .eq("freiwilliger_id", user.data.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setMeineWarteliste(data);
      });
  }, []);


  useEffect(() => {
    let active = true;

    async function loadMyChats() {
      setMeineChatsLoading(true);
      setMeineChatsError("");

      try {
        const data = await getMyTerminDirectThreads();
        if (!active) return;
        setMeineChats(data || []);
        setSelectedChat((prev) => {
          if (prev?.id && (data || []).some((item) => item.id === prev.id)) return prev;
          return (data || [])[0] || null;
        });
      } catch (err) {
        if (!active) return;
        console.error("Fehler beim Laden von Meine Chats:", err);
        setMeineChatsError(err?.message || "Chats konnten nicht geladen werden.");
      } finally {
        if (active) setMeineChatsLoading(false);
      }
    }

    loadMyChats();
    return () => {
      active = false;
    };
  }, [user.data.id]);

  const meineStellen = stellen.filter((s) =>
    (s.termine || []).some((t) =>
      (t.bewerbungen || []).some((b) => b.freiwilliger_id === user.data.id && bewerbungIstAktiv(b))
    )
  );

  const handleFotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Bitte ein Bild auswählen.", "#E85C5C");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast("Max. 2MB erlaubt.", "#E85C5C");
      return;
    }
    const ext = file.name.split(".").pop();
    const path = `avatars/${user.data.id}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (upErr) {
      showToast("Upload fehlgeschlagen.", "#E85C5C");
      return;
    }
    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);
    const avatar_url = urlData.publicUrl + "?t=" + Date.now();
    const { error: profilErr } = await supabase
      .from("freiwillige")
      .update({ avatar_url })
      .eq("id", user.data.id);
    if (profilErr) {
      console.error("Profilbild speichern fehlgeschlagen:", profilErr);
      showToast(profilErr.message || "Profilbild konnte nicht gespeichert werden.", "#E85C5C");
      return;
    }
    setUser((prev) => ({ ...prev, data: { ...prev.data, avatar_url } }));
    showToast("✓ Foto gespeichert!");
  };
  const aktiveStellen = meineStellen.filter((s) =>
    (s.termine || []).some((t) => {
      const hatBew = (t.bewerbungen || []).some(
        (b) => b.freiwilliger_id === user.data.id && bewerbungIstAktiv(b)
      );
      return hatBew && isTerminAktuell(t);
    })
  );

  return (
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              color: "#8B7355",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ←
          </button>
          <div style={{ fontSize: 18, fontWeight: "bold" }}>{t.meinProfil}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onEinstellungen}
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
            {t.einstellungen}
          </button>
          <button
            onClick={logout}
            style={{
              background: "rgba(232,92,92,0.16)",
              border: "1px solid rgba(232,92,92,0.45)",
              color: "#F4F0E8",
              fontSize: 12,
              padding: "6px 12px",
              borderRadius: 20,
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: "bold",
            }}
          >
            Abmelden
          </button>
        </div>
      </div>
      <div style={{ padding: "20px 20px 100px" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #2C2416, #4A3C28)",
            borderRadius: 16,
            padding: "24px 20px",
            marginBottom: 16,
            textAlign: "center",
            color: "#F4F0E8",
          }}
        >
          <div
            style={{
              position: "relative",
              display: "inline-block",
              marginBottom: 4,
            }}
          >
            {user.data.avatar_url ? (
              <img
                src={user.data.avatar_url}
                alt="Profilbild"
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "3px solid #C8A96E",
                }}
              />
            ) : (
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 40,
                  margin: "0 auto",
                }}
              >
                👤
              </div>
            )}
            <label
              htmlFor="foto-upload"
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                background: "#C8A96E",
                borderRadius: "50%",
                width: 26,
                height: 26,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              📷
            </label>
            <input
              id="foto-upload"
              type="file"
              accept="image/*"
              onChange={handleFotoUpload}
              style={{ display: "none" }}
            />
          </div>
          <div style={{ fontSize: 20, fontWeight: "bold", marginTop: 4 }}>
            {user.data.name}
          </div>
          <div style={{ fontSize: 13, color: "#8B7355", marginTop: 2 }}>
            {user.data.email}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 24,
              marginTop: 16,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{ fontSize: 24, fontWeight: "bold", color: "#E8A87C" }}
              >
                {user.data.punkte || 0}
              </div>
              <div style={{ fontSize: 11, color: "#8B7355" }}>{t.punkte}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32 }}>
                {getMedaille(user.data.punkte || 0).icon}
              </div>
              <div style={{ fontSize: 11, color: "#8B7355" }}>{t.medaille}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div
                style={{ fontSize: 24, fontWeight: "bold", color: "#3A7D44" }}
              >
                {user.data.aktionen || 0}
              </div>
              <div style={{ fontSize: 11, color: "#8B7355" }}>{t.aktionen}</div>
            </div>
          </div>
        </div>

        {/* Medaillen */}
        <div
          style={{
            background: "#FAF7F2",
            borderRadius: 14,
            padding: "16px",
            marginBottom: 14,
            border: "1px solid #E0D8C8",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#8B7355",
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            {t.meineMedaille}
          </div>
          {(() => {
            const punkte = user.data.punkte || 0;
            const aktuelle = getMedaille(punkte);
            const naechste = getNextMedaille(punkte);
            const fortschritt = naechste
              ? Math.round(
                  ((punkte - aktuelle.punkte) /
                    (naechste.punkte - aktuelle.punkte)) *
                    100
                )
              : 100;
            return (
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontSize: 40 }}>{aktuelle.icon}</div>
                  <div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: "bold",
                        color: aktuelle.farbe,
                      }}
                    >
                      {getMedailleName(aktuelle, lang)}
                    </div>
                    <div style={{ fontSize: 12, color: "#8B7355" }}>
                      {punkte} {t.punkte}
                    </div>
                  </div>
                </div>
                {naechste && (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#8B7355" }}>
                        {t.naechste} {naechste.icon}{" "}
                        {getMedailleName(naechste, lang)}
                      </div>
                      <div style={{ fontSize: 11, color: "#8B7355" }}>
                        {naechste.punkte - punkte} {t.punkteFehlen}
                      </div>
                    </div>
                    <div
                      style={{
                        height: 8,
                        background: "#EDE8DE",
                        borderRadius: 4,
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${fortschritt}%`,
                          background: `linear-gradient(90deg, ${aktuelle.farbe}, ${naechste.farbe})`,
                          borderRadius: 4,
                        }}
                      />
                    </div>
                  </div>
                )}
                {!naechste && (
                  <div
                    style={{
                      fontSize: 13,
                      color: "#3A7D44",
                      fontWeight: "bold",
                      textAlign: "center",
                      marginTop: 4,
                    }}
                  >
                    {t.hoechsteStufe}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: 12,
                  }}
                >
                  {MEDAILLEN.slice(1).map((m) => (
                    <div
                      key={m.nameKey}
                      style={{
                        textAlign: "center",
                        opacity: punkte >= m.punkte ? 1 : 0.3,
                      }}
                    >
                      <div style={{ fontSize: 20 }}>{m.icon}</div>
                      <div style={{ fontSize: 9, color: "#8B7355" }}>
                        {m.punkte}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Skills & Sprachen */}
        {user.data.skills?.length > 0 && (
          <div
            style={{
              background: "#FAF7F2",
              borderRadius: 14,
              padding: "16px",
              marginBottom: 14,
              border: "1px solid #E0D8C8",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#8B7355",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              {t.faehigkeitenLabel}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {user.data.skills.map((sid) => {
                const s = SKILLS.find((x) => x.id === sid);
                return s ? (
                  <span
                    key={sid}
                    style={{
                      background: "#EDE8DE",
                      padding: "5px 12px",
                      borderRadius: 20,
                      fontSize: 12,
                      color: "#5C4A2A",
                    }}
                  >
                    {s.icon} {getSkillLabel(s, lang)}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}
        {user.data.sprachen && (
          <div
            style={{
              background: "#FAF7F2",
              borderRadius: 14,
              padding: "16px",
              marginBottom: 14,
              border: "1px solid #E0D8C8",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#8B7355",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              🗣️ Sprachen
            </div>
            <div style={{ fontSize: 14, color: "#2C2416" }}>
              {user.data.sprachen}
            </div>
          </div>
        )}

        {/* Alle Aktionen (inkl. vergangene) */}
        <div
          style={{
            background: "#FAF7F2",
            borderRadius: 14,
            padding: "16px",
            marginBottom: 14,
            border: "1px solid #E0D8C8",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#8B7355",
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            Historie & Erfolge
          </div>
          {meineStellen.length === 0 ? (
            <div style={{ fontSize: 13, color: "#8B7355" }}>
              Noch keine Aktionen.
            </div>
          ) : (
            meineStellen.map((s) => {
              const kat = getKat(s.kategorie);
              return (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "8px 0",
                    borderTop: "1px solid #F0EBE0",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: kat?.color + "22",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                    }}
                  >
                    {kat?.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: "bold" }}>
                      {s.titel}
                    </div>
                    <div style={{ fontSize: 11, color: "#8B7355" }}>
                      {s.ort}
                    </div>
                  </div>
                  <div
                    style={{
                      marginLeft: "auto",
                      fontSize: 11,
                      color: "#3A7D44",
                    }}
                  >
                    +10 Pkt
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Punktesystem */}
        <div
          style={{
            background: "#FAF7F2",
            borderRadius: 14,
            padding: "16px",
            marginBottom: 14,
            border: "1px solid #E0D8C8",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#8B7355",
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            {t.punktesystem}
          </div>
          <div style={{ fontSize: 13, color: "#2C2416", lineHeight: 1.8 }}>
            🎯 {t.anmeldungLabel}: <b>+10 {t.punkte}</b>
            <br />✅ {t.erschieenenBestaetigt}: <b>+5 {t.punkte}</b>
            <br />❌ {t.abmelden}: <b>-10 {t.punkte}</b>
            <br />✗ {t.nichtErschienen}
          </div>
        </div>
      </div>

      {/* Termin Wechsel Modal */}
      {terminWechselStelle && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "#F4F0E8",
              borderRadius: "20px 20px 0 0",
              padding: "24px 20px 40px",
              width: "100%",
              maxWidth: 480,
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: "bold",
                marginBottom: 16,
                color: "#2C2416",
              }}
            >
              {t.neuenTerminWaehlen}
            </div>
            {(terminWechselStelle.termine || [])
              .filter((terminOption) => {
                const meineAktiveBewerbung = (terminOption.bewerbungen || []).find(
                  (b) => b.freiwilliger_id === user.data.id && bewerbungIstAktiv(b)
                );
                return (
                  !meineAktiveBewerbung &&
                  getTerminPlaetze(terminOption).freiePlaetze > 0 &&
                  isTerminNochNichtGestartet(terminOption)
                );
              })
              .map((terminOption) => {
                const { freiePlaetze } = getTerminPlaetze(terminOption);
                return (
                  <button
                    key={terminOption.id}
                    onClick={async () => {
                      try {
                        const meinAlterTermin = (terminWechselStelle.termine || [])
                          .flatMap((x) =>
                            (x.bewerbungen || [])
                              .filter(
                                (b) =>
                                  b.freiwilliger_id === user.data.id &&
                                  bewerbungIstAktiv(b)
                              )
                              .map((b) => ({ ...b, termin: x }))
                          )
                          .find(Boolean);

                        if (meinAlterTermin) {
                          const { error: stornoError } = await supabase
                            .from("bewerbungen")
                            .update({
                              status: "storniert",
                              cancelled_at: new Date().toISOString(),
                            })
                            .eq("id", meinAlterTermin.id);
                          if (stornoError) throw stornoError;

                          const { error: plaetzeError } = await supabase.rpc("increment_plaetze", {
                            termin_id: meinAlterTermin.termin.id,
                          });
                          if (plaetzeError) throw plaetzeError;
                        }

                        const { data: erfolg, error: buchungError } = await supabase.rpc("book_slot", {
                          p_stelle_id: terminWechselStelle.id,
                          p_termin_id: terminOption.id,
                          p_freiwilliger_id: user.data.id,
                          p_name: user.data.name,
                          p_email: user.data.email,
                        });
                        if (buchungError) throw buchungError;
                        if (!erfolg) throw new Error("Termin konnte nicht gebucht werden.");

                        showToast("✓ Termin geändert!");
                        await loadStellen(gemeindeId, user.data.plz, user.data.umkreis);
                        setTerminWechselStelle(null);
                      } catch (err) {
                        console.error("Terminwechsel fehlgeschlagen:", err);
                        showToast(err?.message || "Fehler beim Terminwechsel.", "#E85C5C");
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: 12,
                      border: "1px solid #E0D8C8",
                      background: "#FAF7F2",
                      marginBottom: 10,
                      textAlign: "left",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: 14,
                      color: "#2C2416",
                    }}
                  >
                    📅 {formatDate(terminOption.datum)} · 🕐 {terminOption.startzeit}
                    {terminOption.endzeit ? ` – ${terminOption.endzeit}` : ""} ·{" "}
                    <span style={{ color: "#3A7D44" }}>
                      Noch {freiePlaetze} Helfer gesucht
                    </span>
                  </button>
                );
              })}
            <button
              onClick={() => setTerminWechselStelle(null)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 12,
                border: "none",
                background: "#EDE8DE",
                color: "#8B7355",
                fontSize: 14,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {t.abbrechen}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EinstellungenScreen({
  user,
  setUser,
  onBack,
  onHome,
  logout,
  showToast,
  onDelete,
  onDatenschutz,
  onAgb,
  onImpressum,
  t = T["de"],
  lang = "de",
}) {
  const [activeTab, setActiveTab] = useState("profil");
  const [name, setName] = useState(user.data.name || "");
  const [plz, setPlz] = useState(user.data.plz || "");
  const [umkreis, setUmkreis] = useState(user.data.umkreis || 25);
  const [selectedSkills, setSelectedSkills] = useState(user.data.skills || []);
  const [sprachen, setSprachen] = useState(user.data.sprachen || "");
  const [neuesPasswort, setNeuesPasswort] = useState("");
  const [passwortWiederholen, setPasswortWiederholen] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [notifSettings, setNotifSettings] = useState({
    push_enabled: true,
    email_enabled: false,
    termin_erinnerung: true,
    neue_stellen: true,
    freie_plaetze: true,
    vereins_news: true,
  });
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    supabase
      .from("notification_settings")
      .select("*")
      .eq("freiwilliger_id", user.data.id)
      .single()
      .then(({ data }) => {
        if (data) setNotifSettings(data);
      });
  }, []);

  const saveNotifSettings = async (newSettings) => {
    setNotifLoading(true);
    await supabase.from("notification_settings").upsert(
      {
        freiwilliger_id: user.data.id,
        ...newSettings,
      },
      { onConflict: "freiwilliger_id" }
    );
    setNotifSettings(newSettings);
    setNotifLoading(false);
    showToast("✓ Einstellungen gespeichert!");
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Bitte ein Bild auswählen.", "#E85C5C");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast("Max. 2MB erlaubt.", "#E85C5C");
      return;
    }
    setAvatarUploading(true);
    const ext = file.name.split(".").pop();
    const path = `avatars/${user.data.id}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (upErr) {
      showToast("Upload fehlgeschlagen.", "#E85C5C");
      setAvatarUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);
    const avatar_url = urlData.publicUrl + "?t=" + Date.now();
    await supabase
      .from("freiwillige")
      .update({ avatar_url })
      .eq("id", user.data.id);
    setUser((prev) => ({ ...prev, data: { ...prev.data, avatar_url } }));
    setAvatarUploading(false);
    showToast("✓ Foto gespeichert!");
  };

  const handleProfilSpeichern = async () => {
    if (!isKlarname(name)) {
      setError(t.klarname);
      return;
    }
    setLoading(true);
    const { error: err } = await supabase
      .from("freiwillige")
      .update({ name, plz, umkreis, skills: selectedSkills, sprachen })
      .eq("id", user.data.id);
    setLoading(false);
    if (err) {
      setError(t.fehlerSpeichern);
      return;
    }
    setUser((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        name,
        plz,
        umkreis,
        skills: selectedSkills,
        sprachen,
      },
    }));
    setError("");
    showToast(t.profilGespeichert);
  };

  const handlePasswortAendern = async () => {
    if (!neuesPasswort || !passwortWiederholen) {
      setError(t.alleFelder);
      return;
    }
    if (neuesPasswort.length < 6) {
      setError(t.passwortLaenge);
      return;
    }
    if (neuesPasswort !== passwortWiederholen) {
      setError(t.passwortStimmenNicht);
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({
      password: neuesPasswort,
    });
    setLoading(false);
    if (err) {
      setError(t.fehlerPasswort);
      return;
    }
    setNeuesPasswort("");
    setPasswortWiederholen("");
    setError("");
    showToast(t.passwortGeaendert);
  };

  return (
    <div>
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(160deg,#1A1208,#2C2416)",
          padding: "20px 20px 16px",
          color: "#F4F0E8",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              color: "#8B7355",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ←
          </button>
          <div style={{ fontSize: 18, fontWeight: "bold" }}>
            {t.einstellungenTitle}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onHome}
            style={{
              background: "none",
              border: "none",
              color: "#8B7355",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            🏠
          </button>
          <button
            onClick={logout}
            style={{
              background: "rgba(255,255,255,0.1)",
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
      </div>

      <div style={{ padding: "16px 16px 100px" }}>
        {/* Profilbild oben */}
        {activeTab === "profil" && (
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              {user.data.avatar_url ? (
                <img
                  src={user.data.avatar_url}
                  alt="Avatar"
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "3px solid #C8A96E",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg,#2C2416,#4A3C28)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 36,
                    margin: "0 auto",
                  }}
                >
                  👤
                </div>
              )}
              <label
                htmlFor="avatar-einst"
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  background: "#C8A96E",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                {avatarUploading ? "⏳" : "📷"}
              </label>
              <input
                id="avatar-einst"
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                style={{ display: "none" }}
              />
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: "bold",
                color: "#2C2416",
                marginTop: 8,
              }}
            >
              {user.data.name}
            </div>
            <div style={{ fontSize: 12, color: "#8B7355" }}>
              {user.data.email}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 20,
            background: "#EDE8DE",
            borderRadius: 12,
            padding: 4,
          }}
        >
          {[
            { id: "profil", label: t.profilTab },
            { id: "passwort", label: t.passwortTab },
            { id: "konto", label: t.kontoTab },
            { id: "benachrichtigungen", label: "🔔" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setError("");
              }}
              style={{
                flex: 1,
                padding: "9px 6px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                background: activeTab === tab.id ? "#FAF7F2" : "transparent",
                color: activeTab === tab.id ? "#2C2416" : "#8B7355",
                fontSize: 12,
                fontFamily: "inherit",
                fontWeight: activeTab === tab.id ? "bold" : "normal",
                boxShadow:
                  activeTab === tab.id ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Profil Tab */}
        {activeTab === "profil" && (
          <div>
            <Input
              label={t.vollstaendigerName}
              value={name}
              onChange={setName}
              placeholder="Max Mustermann"
            />
            <Input
              label="PLZ"
              value={plz}
              onChange={setPlz}
              placeholder="z.B. 64683"
            />
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 12,
                  color: "#8B7355",
                  marginBottom: 6,
                  letterSpacing: 0.5,
                }}
              >
                {t.umkreis}
              </div>
              <select
                value={umkreis}
                onChange={(e) => setUmkreis(parseInt(e.target.value))}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 10,
                  border: "1px solid #E0D8C8",
                  background: "#FAF7F2",
                  fontFamily: "inherit",
                  fontSize: 14,
                  color: "#2C2416",
                  boxSizing: "border-box",
                }}
              >
                <option value={10}>10 km</option>
                <option value={25}>25 km</option>
                <option value={50}>50 km</option>
                <option value={9999}>Alle</option>
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 12,
                  color: "#8B7355",
                  marginBottom: 8,
                  letterSpacing: 0.5,
                }}
              >
                {t.faehigkeitenLabel}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {SKILLS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setSelectedSkills((prev) =>
                        prev.includes(s.id)
                          ? prev.filter((x) => x !== s.id)
                          : [...prev, s.id]
                      )
                    }
                    style={{
                      padding: "7px 12px",
                      borderRadius: 20,
                      border: "none",
                      cursor: "pointer",
                      background: selectedSkills.includes(s.id)
                        ? "#2C2416"
                        : "#EDE8DE",
                      color: selectedSkills.includes(s.id)
                        ? "#FAF7F2"
                        : "#8B7355",
                      fontSize: 12,
                      fontFamily: "inherit",
                    }}
                  >
                    {s.icon} {getSkillLabel(s, lang)}
                  </button>
                ))}
              </div>
            </div>
            <Input
              label={t.sprachen}
              value={sprachen}
              onChange={setSprachen}
              placeholder="z.B. Englisch, Türkisch"
            />
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <BigButton onClick={handleProfilSpeichern} disabled={loading} green>
              {loading ? t.speichern : t.profilSpeichern}
            </BigButton>
          </div>
        )}

        {/* Passwort Tab */}
        {activeTab === "passwort" && (
          <div>
            <div
              style={{
                background: "#FAF7F2",
                borderRadius: 14,
                padding: "14px 16px",
                marginBottom: 20,
                border: "1px solid #E0D8C8",
              }}
            >
              <div style={{ fontSize: 13, color: "#8B7355" }}>
                {t.passwortMindestp}
              </div>
            </div>
            <Input
              label={t.neuesPasswort}
              value={neuesPasswort}
              onChange={setNeuesPasswort}
              type="password"
              placeholder="••••••"
            />
            <Input
              label={t.passwortWiederholen}
              value={passwortWiederholen}
              onChange={setPasswortWiederholen}
              type="password"
              placeholder="••••••"
            />
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <BigButton onClick={handlePasswortAendern} disabled={loading}>
              {loading ? t.aendern : t.passwortAendern}
            </BigButton>
          </div>
        )}

        {/* Benachrichtigungen Tab */}
        {activeTab === "benachrichtigungen" && (
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: "bold",
                color: "#2C2416",
                marginBottom: 16,
              }}
            >
              🔔 Benachrichtigungen
            </div>

            {/* Push / Email */}
            <div
              style={{
                background: "#FAF7F2",
                borderRadius: 14,
                padding: "16px",
                marginBottom: 14,
                border: "1px solid #E0D8C8",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#8B7355",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                KANÄLE
              </div>
              {[
                {
                  key: "push_enabled",
                  label: "📱 Push-Benachrichtigungen",
                  sub: "Direkt aufs Gerät",
                },
                {
                  key: "email_enabled",
                  label: "📧 E-Mail",
                  sub: "Zusammenfassung per E-Mail",
                },
              ].map((item) => (
                <div
                  key={item.key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingBottom: 12,
                    marginBottom: 12,
                    borderBottom: "1px solid #F0EBE0",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#2C2416",
                        fontWeight: "bold",
                      }}
                    >
                      {item.label}
                    </div>
                    <div style={{ fontSize: 11, color: "#8B7355" }}>
                      {item.sub}
                    </div>
                  </div>
                  <div
                    onClick={() =>
                      saveNotifSettings({
                        ...notifSettings,
                        [item.key]: !notifSettings[item.key],
                      })
                    }
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      background: notifSettings[item.key]
                        ? "#3A7D44"
                        : "#E0D8C8",
                      cursor: "pointer",
                      position: "relative",
                      transition: "background 0.2s",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 2,
                        left: notifSettings[item.key] ? 22 : 2,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "#fff",
                        transition: "left 0.2s",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Typen */}
            <div
              style={{
                background: "#FAF7F2",
                borderRadius: 14,
                padding: "16px",
                marginBottom: 14,
                border: "1px solid #E0D8C8",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#8B7355",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                WAS MÖCHTEST DU ERHALTEN?
              </div>
              {[
                {
                  key: "termin_erinnerung",
                  label: "⏰ Termin-Erinnerungen",
                  sub: "Morgen ist dein Einsatz 🙌",
                },
                {
                  key: "neue_stellen",
                  label: "🌱 Neue Stellen",
                  sub: "Benachrichtigungen zu neuen Stellen in gefolgten Vereinen und Kategorien",
                },
                {
                  key: "freie_plaetze",
                  label: "🎉 Freie Plätze",
                  sub: "Nur für gefolgte Vereine oder Kategorien",
                },
                {
                  key: "vereins_news",
                  label: "📣 Vereins-News",
                  sub: "Updates von gefolgten Vereinen",
                },
              ].map((item) => (
                <div
                  key={item.key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingBottom: 12,
                    marginBottom: 12,
                    borderBottom: "1px solid #F0EBE0",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#2C2416",
                        fontWeight: "bold",
                      }}
                    >
                      {item.label}
                    </div>
                    <div style={{ fontSize: 11, color: "#8B7355" }}>
                      {item.sub}
                    </div>
                  </div>
                  <div
                    onClick={() =>
                      saveNotifSettings({
                        ...notifSettings,
                        [item.key]: !notifSettings[item.key],
                      })
                    }
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      background: notifSettings[item.key]
                        ? "#3A7D44"
                        : "#E0D8C8",
                      cursor: "pointer",
                      position: "relative",
                      transition: "background 0.2s",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 2,
                        left: notifSettings[item.key] ? 22 : 2,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "#fff",
                        transition: "left 0.2s",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {notifLoading && (
              <div
                style={{ textAlign: "center", fontSize: 12, color: "#8B7355" }}
              >
                Speichern...
              </div>
            )}
          </div>
        )}

        {/* Konto Tab */}
        {activeTab === "konto" && (
          <div>
            <div
              style={{
                background: "#FAF7F2",
                borderRadius: 14,
                padding: "16px",
                marginBottom: 14,
                border: "1px solid #E0D8C8",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#8B7355",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                {t.kontoInfo}
              </div>
              <div style={{ fontSize: 14, color: "#2C2416" }}>
                📧 {user.data.email}
              </div>
              <div style={{ fontSize: 12, color: "#8B7355", marginTop: 4 }}>
                {t.registriertAls}
              </div>
            </div>
            <div
              style={{
                background: "#FAF7F2",
                borderRadius: 14,
                padding: "16px",
                marginBottom: 14,
                border: "1px solid #E0D8C8",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#8B7355",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                {t.rechtliches}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={onDatenschutz}
                  style={{
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    color: "#2C2416",
                    fontSize: 14,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    padding: 0,
                  }}
                >
                  {t.datenschutz} →
                </button>
                <button
                  onClick={onAgb}
                  style={{
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    color: "#2C2416",
                    fontSize: 14,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    padding: 0,
                  }}
                >
                  {t.agb} →
                </button>
                <button
                  onClick={onImpressum}
                  style={{
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    color: "#2C2416",
                    fontSize: 14,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    padding: 0,
                  }}
                >
                  {t.impressum} →
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowDelete(true)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 12,
                border: "1px solid #E85C5C",
                background: "transparent",
                color: "#E85C5C",
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {t.kontoLoeschen}
            </button>
            {showDelete && (
              <div
                style={{
                  background: "#FFF0F0",
                  borderRadius: 12,
                  padding: "16px",
                  marginTop: 10,
                  border: "1px solid #E85C5C",
                }}
              >
                <div
                  style={{ fontSize: 13, color: "#C0392B", marginBottom: 12 }}
                >
                  {t.allesWirdGeloescht}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={onDelete}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: 8,
                      border: "none",
                      background: "#E85C5C",
                      color: "#fff",
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontWeight: "bold",
                    }}
                  >
                    {t.jaLoeschen}
                  </button>
                  <button
                    onClick={() => setShowDelete(false)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: 8,
                      border: "1px solid #E0D8C8",
                      background: "transparent",
                      color: "#8B7355",
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {t.abbrechen}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FreiwilligerProfilVerein({
  selectedFreiwilliger,
  setSelectedFreiwilliger,
  onBack,
  onHome,
  logout,
  handleBestaetigen,
}) {
  const termin = selectedFreiwilliger.termin;
  const istVergangen = termin ? !isTerminAktuell(termin) : false;
  const nochNichtGestartet = termin
    ? isTerminNochNichtGestartet(termin)
    : false;
  const profil = selectedFreiwilliger.profil;

  return (
    <div>
      <div
        style={{
          background: "linear-gradient(160deg,#1A1208,#2C2416)",
          padding: "20px 20px 16px",
          color: "#F4F0E8",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              color: "#8B7355",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ←
          </button>
          <div style={{ fontSize: 18, fontWeight: "bold" }}>
            Freiwilligen-Profil
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onHome}
            style={{
              background: "none",
              border: "none",
              color: "#8B7355",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            🏠
          </button>
          <button
            onClick={logout}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              color: "#8B7355",
              fontSize: 12,
              padding: "6px 12px",
              borderRadius: 20,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Abmelden
          </button>
        </div>
      </div>

      <div style={{ padding: "20px 20px 100px" }}>
        {/* Profil-Karte */}
        <div
          style={{
            background: "linear-gradient(135deg,#2C2416,#4A3C28)",
            borderRadius: 16,
            padding: "24px 20px",
            marginBottom: 16,
            textAlign: "center",
            color: "#F4F0E8",
          }}
        >
          {profil?.avatar_url ? (
            <img
              src={profil.avatar_url}
              alt="Avatar"
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                objectFit: "cover",
                border: "3px solid #C8A96E",
                margin: "0 auto",
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 40,
                margin: "0 auto",
              }}
            >
              👤
            </div>
          )}
          <div style={{ fontSize: 20, fontWeight: "bold", marginTop: 8 }}>
            {selectedFreiwilliger.freiwilliger_name}
          </div>
          <div style={{ fontSize: 13, color: "#8B7355", marginTop: 2 }}>
            {selectedFreiwilliger.freiwilliger_email}
          </div>
          {profil && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 24,
                marginTop: 12,
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{ fontSize: 20, fontWeight: "bold", color: "#E8A87C" }}
                >
                  {profil.punkte || 0}
                </div>
                <div style={{ fontSize: 11, color: "#8B7355" }}>Punkte</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28 }}>
                  {getMedaille(profil.punkte || 0).icon}
                </div>
                <div style={{ fontSize: 11, color: "#8B7355" }}>Medaille</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{ fontSize: 20, fontWeight: "bold", color: "#3A7D44" }}
                >
                  {profil.aktionen || 0}
                </div>
                <div style={{ fontSize: 11, color: "#8B7355" }}>Aktionen</div>
              </div>
            </div>
          )}
        </div>

        {/* Gebuchter Termin */}
        {termin && (
          <div
            style={{
              background: "#FAF7F2",
              borderRadius: 14,
              padding: "16px",
              marginBottom: 14,
              border: "1px solid #E0D8C8",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#8B7355",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              {istVergangen ? "Vergangener Termin" : "Bevorstehender Termin"}
            </div>
            <div style={{ fontSize: 14, color: "#2C2416", fontWeight: "bold" }}>
              📅 {formatDate(termin.datum)} · 🕐 {termin.startzeit}
              {termin.endzeit ? ` – ${termin.endzeit}` : ""}
            </div>
            <div
              style={{
                fontSize: 12,
                color: istVergangen ? "#8B7355" : "#5B9BD5",
                marginTop: 4,
                fontWeight: "bold",
              }}
            >
              {istVergangen ? "⏰ Vergangen" : "📅 Bevorstehend"}
            </div>
          </div>
        )}

        {/* Fähigkeiten */}
        {profil?.skills?.length > 0 && (
          <div
            style={{
              background: "#FAF7F2",
              borderRadius: 14,
              padding: "16px",
              marginBottom: 14,
              border: "1px solid #E0D8C8",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#8B7355",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Fähigkeiten
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {profil.skills.map((sid) => {
                const skill = SKILLS.find((s) => s.id === sid);
                return skill ? (
                  <span
                    key={sid}
                    style={{
                      background: "#EDE8DE",
                      padding: "5px 12px",
                      borderRadius: 20,
                      fontSize: 12,
                      color: "#5C4A2A",
                    }}
                  >
                    {skill.icon} {skill.label}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}

        {/* Sprachen */}
        {profil?.sprachen && (
          <div
            style={{
              background: "#FAF7F2",
              borderRadius: 14,
              padding: "16px",
              marginBottom: 14,
              border: "1px solid #E0D8C8",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#8B7355",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              🗣️ Sprachen
            </div>
            <div style={{ fontSize: 14, color: "#2C2416" }}>
              {profil.sprachen}
            </div>
          </div>
        )}

        {/* PLZ / Wohnort */}
        {profil?.plz && (
          <div
            style={{
              background: "#FAF7F2",
              borderRadius: 14,
              padding: "16px",
              marginBottom: 14,
              border: "1px solid #E0D8C8",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#8B7355",
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              📍 Wohnort
            </div>
            <div style={{ fontSize: 14, color: "#2C2416" }}>
              PLZ {profil.plz} · Umkreis {profil.umkreis} km
            </div>
          </div>
        )}

        {!profil?.skills?.length && !profil?.sprachen && (
          <div
            style={{
              background: "#FAF7F2",
              borderRadius: 14,
              padding: "16px",
              marginBottom: 14,
              border: "1px solid #E0D8C8",
            }}
          >
            <div style={{ fontSize: 13, color: "#8B7355" }}>
              Keine weiteren Angaben hinterlegt.
            </div>
          </div>
        )}

        {/* Anwesenheit bestätigen - NUR bei vergangenem Termin */}
        {istVergangen && bewerbungIstOffen(selectedFreiwilliger) && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={async () => {
                  await handleBestaetigen(selectedFreiwilliger.id, true);
                  setSelectedFreiwilliger((prev) => ({
                    ...prev,
                    bestaetigt: true,
                    nicht_erschienen: false,
                    status: "erschienen",
                  }));
                }}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 12,
                  border: "none",
                  background: "#3A7D44",
                  color: "#fff",
                  fontSize: 14,
                  fontFamily: "inherit",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                ✓ Erschienen (+5)
              </button>
              <button
                onClick={async () => {
                  await handleBestaetigen(selectedFreiwilliger.id, false);
                  setSelectedFreiwilliger((prev) => ({
                    ...prev,
                    bestaetigt: false,
                    nicht_erschienen: true,
                    status: "no_show",
                  }));
                }}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 12,
                  border: "none",
                  background: "#E85C5C",
                  color: "#fff",
                  fontSize: 14,
                  fontFamily: "inherit",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                ✗ Nicht erschienen
              </button>
            </div>
          )}
        {istVergangen && bewerbungIstErschienen(selectedFreiwilliger) && (
          <div
            style={{
              textAlign: "center",
              padding: "12px",
              background: "#3A7D4418",
              borderRadius: 12,
              color: "#3A7D44",
              fontWeight: "bold",
            }}
          >
            ✓ Erschienen bestätigt
          </div>
        )}
        {istVergangen && bewerbungIstNoShow(selectedFreiwilliger) && (
          <div
            style={{
              textAlign: "center",
              padding: "12px",
              background: "#E85C5C18",
              borderRadius: 12,
              color: "#E85C5C",
              fontWeight: "bold",
            }}
          >
            ✗ Nicht erschienen
          </div>
        )}
        {!istVergangen && (
          <div
            style={{
              textAlign: "center",
              padding: "12px",
              background: "#EDE8DE",
              borderRadius: 12,
              color: "#8B7355",
              fontSize: 13,
            }}
          >
            📅 Termin noch nicht stattgefunden – Bestätigung danach möglich
          </div>
        )}
      </div>
    </div>
  );
}

export {
  DetailScreen,
  VereinProfilPublic,
  FreiwilligenDashboard,
  FreiwilligenKommunikation,
  FreiwilligerProfil,
  EinstellungenScreen,
  FreiwilligerProfilVerein
};

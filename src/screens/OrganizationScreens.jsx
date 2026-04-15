import React, { useState, useEffect } from 'react';
import MeineGemeindePanel from "../components/messages/MeineGemeindePanel";
import MessageThreadView from "../components/messages/MessageThreadView";
import { getTerminDirectThreadsForVerein, getOrCreateTerminDirectThread } from "../services/messages";
import { supabase, T, KATEGORIEN, SKILLS, getSkillLabel, getKat, getMedaille, getNextMedaille, getMedailleName, IMPRESSUM_TEXT, DATENSCHUTZ_TEXT, AGB_TEXT, formatDate, getGemeindeByPlz, isKlarname, isTerminNochNichtGestartet, isTerminAktuell } from '../core/shared';
import { Header, StelleCard, VereineListe, BottomBar, DatenschutzBox, Input, BigButton, Chip, InfoChip, SectionLabel, RoleCard, EmptyState, ErrorMsg } from '../components/ui';

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

const aktiveBewerbungen = (bewerbungen = []) =>
  (bewerbungen || []).filter(bewerbungIstAktiv);

const getTerminPlaetze = (termin) => {
  const aktive = aktiveBewerbungen(termin?.bewerbungen || []);
  const gesamtPlaetze = Number(
    termin?.gesamt_plaetze ??
      termin?.max_helfer ??
      termin?.plaetze ??
      (Number.isFinite(Number(termin?.freie_plaetze))
        ? Number(termin.freie_plaetze) + aktive.length
        : 0)
  );
  const freiePlaetze = Math.max(0, gesamtPlaetze - aktive.length);
  return {
    freiePlaetze,
    angemeldet: gesamtPlaetze > 0 ? Math.min(gesamtPlaetze, aktive.length) : aktive.length,
  };
};
function VereinDashboard({
  user,
  stellen,
  loadStellen,
  onBack,
  onHome,
  onDetail,
  onBearbeiten,
  onNeu,
  onProfil,
  onAnalyse,
  onMeineGemeinde,
  logout,
  showToast,
  followers,
  notifications = [],
  onMarkNotifRead,
  unreadCount = null,
  onNotifications = null,
}) {
  const [showNotif, setShowNotif] = useState(false);
  const meineStellen = stellen.filter(
    (s) => s.verein_id === user.data.id && !s.archiviert
  );
  const archivierteStellen = stellen.filter(
    (s) => s.verein_id === user.data.id && s.archiviert
  );
  const [zeigeArchiv, setZeigeArchiv] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportThreadId, setSupportThreadId] = useState(null);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportError, setSupportError] = useState('');
  const [dashboardTab, setDashboardTab] = useState('stellen');
  const [kommunikationTab, setKommunikationTab] = useState('termine');
  const [vereinKommunikationLoading, setVereinKommunikationLoading] = useState(false);
  const [vereinKommunikationError, setVereinKommunikationError] = useState('');
  const [terminChatThreads, setTerminChatThreads] = useState([]);
  const [selectedCommunicationThread, setSelectedCommunicationThread] = useState(null);


  const supportOrganisation = {
    type: 'verein',
    name: user?.data?.name || 'Verein',
    email: user?.data?.kontakt_email || user?.email || '',
  };

  const ensureSupportThread = async () => {
    if (!user?.data?.id) return;
    try {
      setSupportLoading(true);
      setSupportError('');

      const { data: existing, error: existingError } = await supabase
        .from('message_threads')
        .select('id')
        .eq('thread_type', 'support')
        .eq('verein_id', user.data.id)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing?.id) {
        setSupportThreadId(existing.id);
        return;
      }

      const { data: created, error: createError } = await supabase
        .from('message_threads')
        .insert([
          {
            thread_type: 'support',
            verein_id: user.data.id,
            last_message_at: new Date().toISOString(),
          },
        ])
        .select('id')
        .single();

      if (createError) throw createError;
      setSupportThreadId(created?.id || null);
    } catch (err) {
      console.error('Fehler beim Laden des Support-Threads:', err);
      setSupportError(err.message || 'Support konnte nicht geladen werden.');
    } finally {
      setSupportLoading(false);
    }
  };

  const loadKommunikationHub = async () => {
    if (!user?.data?.id) return;
    try {
      setVereinKommunikationLoading(true);
      setVereinKommunikationError('');

      const termineMitStelle = meineStellen.flatMap((stelle) =>
        (stelle.termine || []).map((termin) => ({ stelle, termin }))
      );

      const chatResults = await Promise.all(
        termineMitStelle.map(async ({ stelle, termin }) => {
          try {
            const rows = await getTerminDirectThreadsForVerein(termin.id);
            return (rows || []).map((thread) => ({
              ...thread,
              stelleTitel: stelle?.titel || 'Stelle',
              terminDatum: termin?.datum || '',
              terminStartzeit: termin?.startzeit || '',
              terminEndzeit: termin?.endzeit || '',
            }));
          } catch (err) {
            console.error('Termin-Chats konnten nicht geladen werden:', err);
            return [];
          }
        })
      );

      const flatChats = chatResults
        .flat()
        .sort((a, b) => {
          const aTime = new Date(a.last_message_at || a.created_at || 0).getTime();
          const bTime = new Date(b.last_message_at || b.created_at || 0).getTime();
          return bTime - aTime;
        });

      setTerminChatThreads(flatChats);
      setSelectedCommunicationThread((prev) => {
        if (prev?.id && flatChats.some((item) => item.id === prev.id)) return prev;
        return flatChats[0] || null;
      });

      if (!supportThreadId) {
        await ensureSupportThread();
      }
    } catch (err) {
      console.error('Kommunikations-Hub konnte nicht geladen werden:', err);
      setVereinKommunikationError(err?.message || 'Kommunikation konnte nicht geladen werden.');
    } finally {
      setVereinKommunikationLoading(false);
    }
  };

  useEffect(() => {
    if (dashboardTab === 'kommunikation') {
      loadKommunikationHub();
    }
  }, [dashboardTab, user?.data?.id]);

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
        <div>
          <div style={{ fontSize: 18, fontWeight: "bold" }}>
            {user.data.name}
          </div>
          <div style={{ fontSize: 12, color: "#8B7355" }}>Dashboard</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
          <div style={{ position: "relative" }}>
            <button
              onClick={() => {
                setShowNotif((p) => !p);
                if (typeof onNotifications === "function") {
                  onNotifications();
                }
                if (notifications.some((n) => !n.gelesen))
                  onMarkNotifRead && onMarkNotifRead();
              }}
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
              {((unreadCount ?? notifications.filter((n) => !n.gelesen).length) > 0) && (
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
                  {(unreadCount ?? notifications.filter((n) => !n.gelesen).length) > 9
                    ? "9+"
                    : (unreadCount ?? notifications.filter((n) => !n.gelesen).length)}
                </span>
              )}
            </button>
          </div>
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
      {/* Notification Dropdown */}
      {showNotif && (
        <div
          style={{
            position: "fixed",
            top: 62,
            right: "calc(50% - 240px + 16px)",
            background: "#FAF7F2",
            borderRadius: 12,
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            zIndex: 250,
            width: 300,
            maxHeight: 400,
            overflowY: "auto",
          }}
          onClick={() => setShowNotif(false)}
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
                  style={{ fontSize: 13, fontWeight: "bold", color: "#2C2416" }}
                >
                  {n.titel}
                </div>
                <div style={{ fontSize: 12, color: "#8B7355", marginTop: 2 }}>
                  {n.text}
                </div>
                <div style={{ fontSize: 10, color: "#C4B89A", marginTop: 4 }}>
                  {new Date(n.created_at).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
      <div style={{ padding: "16px 16px 100px" }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => setDashboardTab('stellen')}
            style={{
              flex: 2,
              padding: "12px",
              borderRadius: 12,
              border: dashboardTab === 'stellen' ? "none" : "1px solid #E0D8C8",
              background: dashboardTab === 'stellen'
                ? "linear-gradient(135deg, #2C2416, #4A3C28)"
                : "#FAF7F2",
              color: dashboardTab === 'stellen' ? "#F4F0E8" : "#2C2416",
              fontSize: 14,
              fontFamily: "inherit",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            📋 Meine Stellen
          </button>
          <button
            onClick={() => setDashboardTab('kommunikation')}
            style={{
              flex: 1.4,
              padding: "12px",
              borderRadius: 12,
              border: dashboardTab === 'kommunikation' ? "none" : "1px solid #E8A87C",
              background: dashboardTab === 'kommunikation' ? "#E8A87C" : "transparent",
              color: dashboardTab === 'kommunikation' ? "#2C2416" : "#E8A87C",
              fontSize: 13,
              fontFamily: "inherit",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            💬 Kommunikation
          </button>
          <button
            onClick={onAnalyse}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: 12,
              border: "1px solid #5B9BD5",
              background: "transparent",
              color: "#5B9BD5",
              fontSize: 13,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            📊 Analyse
          </button>
          <button
            onClick={() => {
              if (!user.data.verifiziert) {
                showToast(
                  "Dein Verein muss erst freigeschaltet werden.",
                  "#E8A87C"
                );
                return;
              }
              onNeu();
            }}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: 12,
              border: "none",
              background: user.data.verifiziert
                ? "linear-gradient(135deg, #2C2416, #4A3C28)"
                : "#C4B89A",
              color: "#F4F0E8",
              fontSize: 14,
              fontFamily: "inherit",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            + Neue Stelle
          </button>
          <button
            onClick={onProfil}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: 12,
              border: "1px solid #8B7355",
              background: "transparent",
              color: "#8B7355",
              fontSize: 13,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            👤 Profil
          </button>
        </div>
        {!user.data.verifiziert && (
          <div
            style={{
              background: "#FFF8E8",
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 16,
              border: "1px solid #E8C84A",
            }}
          >
            <div style={{ fontSize: 13, color: "#8B6800", fontWeight: "bold" }}>
              ⏳ Verifizierung ausstehend
            </div>
            <div style={{ fontSize: 12, color: "#8B6800", marginTop: 4 }}>
              Dein Verein wird geprüft. Wir melden uns per Email sobald du
              freigeschaltet wirst.
            </div>
          </div>
        )}
        {/* Follower Übersicht */}
        {followers?.length > 0 && (
          <div
            style={{
              background: "#FAF7F2",
              borderRadius: 14,
              padding: "14px 16px",
              marginBottom: 16,
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
              👥 FOLGEN DIR
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div>
                <div
                  style={{ fontSize: 28, fontWeight: "bold", color: "#C8A96E" }}
                >
                  {followers.length}
                </div>
                <div style={{ fontSize: 12, color: "#8B7355" }}>
                  Freiwillige
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                marginTop: 8,
              }}
            >
              {followers.slice(0, 5).map((f, i) => (
                <div
                  key={i}
                  style={{
                    background: "#EDE8DE",
                    borderRadius: 20,
                    padding: "4px 10px",
                    fontSize: 11,
                    color: "#5C4A2A",
                  }}
                >
                  👤 {f.freiwillige?.name || "Freiwilliger"}
                </div>
              ))}
              {followers.length > 5 && (
                <div
                  style={{ fontSize: 11, color: "#8B7355", padding: "4px 6px" }}
                >
                  +{followers.length - 5} weitere
                </div>
              )}
            </div>
          </div>
        )}
        {dashboardTab === 'stellen' ? (
          <>
            <SectionLabel>Deine Stellen ({meineStellen.length})</SectionLabel>
            {meineStellen.length === 0 ? (
              <EmptyState
                icon="📋"
                text="Noch keine Stellen"
                sub="Erstelle deine erste Ehrenamtsstelle!"
              />
            ) : (
              meineStellen.map((s) => {
                const gesamtAnmeldungen = (s.termine || []).reduce(
                  (sum, t) => sum + aktiveBewerbungen(t.bewerbungen || []).length,
                  0
                );
                return (
                  <div
                    key={s.id}
                    style={{
                      background: "#FAF7F2",
                      borderRadius: 14,
                      padding: "14px",
                      marginBottom: 10,
                      border: "1px solid #E0D8C8",
                    }}
                  >
                    <div
                      onClick={() => onDetail(s)}
                      style={{ cursor: "pointer", marginBottom: 10 }}
                    >
                      <div style={{ fontWeight: "bold", fontSize: 14 }}>
                        {s.titel}
                      </div>
                      <div style={{ fontSize: 12, color: "#8B7355", marginTop: 4 }}>
                        📍 {s.ort} · 👥 {gesamtAnmeldungen} Anmeldungen · 👁️ {s.aufrufe || 0} Aufrufe
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => onDetail(s)}
                        style={{
                          flex: 1,
                          padding: "7px",
                          borderRadius: 8,
                          border: "1px solid #E0D8C8",
                          background: "transparent",
                          color: "#2C2416",
                          fontSize: 12,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        👥 Anmeldungen
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onBearbeiten(s);
                        }}
                        style={{
                          flex: 1,
                          padding: "7px",
                          borderRadius: 8,
                          border: "1px solid #5B9BD5",
                          background: "transparent",
                          color: "#5B9BD5",
                          fontSize: 12,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        ✏️ Bearbeiten
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </>
        ) : (
          <div>
            <div style={{ background: "#FAF7F2", borderRadius: 14, padding: "16px", marginBottom: 14, border: "1px solid #E0D8C8" }}>
              <div style={{ fontSize: 20, fontWeight: "bold", color: "#2C2416", marginBottom: 6 }}>Kommunikation</div>
              <div style={{ fontSize: 13, color: "#8B7355", lineHeight: 1.6 }}>
                Hier bündelst du Termin-Chats, die Kommunikation mit deiner Gemeinde und Support an Civico.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {[
                ['termine', '💬 Termin-Chats'],
                ['gemeinde', '🏛 Meine Gemeinde'],
                ['support', '🛟 Support'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setKommunikationTab(key);
                    if (key === 'support' && !supportThreadId) ensureSupportThread();
                  }}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: kommunikationTab === key ? "none" : "1px solid #E0D8C8",
                    background: kommunikationTab === key ? "#2C2416" : "#FAF7F2",
                    color: kommunikationTab === key ? "#FAF7F2" : "#2C2416",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: "bold",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {kommunikationTab === 'termine' && (
              <>
                {vereinKommunikationLoading ? (
                  <div style={{ background: "#FAF7F2", borderRadius: 14, padding: 16, border: "1px solid #E0D8C8", color: "#8B7355", fontSize: 13 }}>
                    Chats werden geladen …
                  </div>
                ) : vereinKommunikationError ? (
                  <div style={{ background: "#FFF4F2", borderRadius: 14, padding: 16, border: "1px solid #F0C9C3", color: "#B53A2D", fontSize: 13, fontWeight: "bold" }}>
                    {vereinKommunikationError}
                  </div>
                ) : terminChatThreads.length === 0 ? (
                  <EmptyState
                    icon="💬"
                    text="Noch keine Termin-Chats vorhanden"
                    sub="Sobald Freiwillige bei deinen Terminen schreiben, erscheinen die Chats hier gesammelt."
                  />
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14 }}>
                    <div style={{ background: "#FAF7F2", borderRadius: 14, padding: 14, border: "1px solid #E0D8C8" }}>
                      {terminChatThreads.map((thread) => {
                        const isActive = selectedCommunicationThread?.id === thread.id;
                        return (
                          <button
                            key={thread.id}
                            onClick={() => setSelectedCommunicationThread(thread)}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              padding: "12px",
                              borderRadius: 12,
                              border: isActive ? "2px solid #2C2416" : "1px solid #E0D8C8",
                              background: isActive ? "#F3EBDD" : "#FFFDFC",
                              marginBottom: 8,
                              cursor: "pointer",
                              fontFamily: "inherit",
                            }}
                          >
                            <div style={{ fontSize: 13, fontWeight: "bold", color: "#2C2416", marginBottom: 4 }}>
                              {thread.freiwillige?.name || "Freiwilliger"}
                            </div>
                            <div style={{ fontSize: 12, color: "#8B7355", marginBottom: 4 }}>
                              {thread.stelleTitel || "Stelle"}
                            </div>
                            <div style={{ fontSize: 11, color: "#3A7D44" }}>
                              📅 {thread.terminDatum ? formatDate(thread.terminDatum) : "-"} · 🕐 {thread.terminStartzeit || "-"}{thread.terminEndzeit ? ` – ${thread.terminEndzeit}` : ""}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div style={{ background: "#FAF7F2", borderRadius: 14, padding: 14, border: "1px solid #E0D8C8" }}>
                      {selectedCommunicationThread?.id ? (
                        <MessageThreadView
                          threadId={selectedCommunicationThread.id}
                          title={selectedCommunicationThread.stelleTitel || "Direktchat"}
                          emptyText="Noch keine Nachrichten vorhanden."
                          height={420}
                          senderLabels={{
                            verein: user?.data?.name || "Verein",
                            freiwilliger: selectedCommunicationThread?.freiwillige?.name || "Freiwilliger",
                          }}
                        />
                      ) : (
                        <EmptyState
                          icon="💬"
                          text="Kein Chat ausgewählt"
                          sub="Wähle links einen Termin-Chat aus."
                        />
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {kommunikationTab === 'gemeinde' && (
              <MeineGemeindePanel onBack={() => setKommunikationTab('termine')} onHome={onHome} />
            )}

            {kommunikationTab === 'support' && (
              <div style={{ background: "#FAF7F2", borderRadius: 14, padding: 16, border: "1px solid #E0D8C8" }}>
                <div style={{ fontSize: 18, fontWeight: "bold", color: "#2C2416", marginBottom: 8 }}>Support an Civico</div>
                <div style={{ fontSize: 13, color: "#8B7355", marginBottom: 14, lineHeight: 1.6 }}>
                  Technische Probleme, Rückfragen oder organisatorische Anliegen direkt an den Admin.
                </div>

                {supportLoading ? (
                  <div style={{ color: "#8B7355", fontSize: 13 }}>Lade Support-Verlauf...</div>
                ) : supportError ? (
                  <div style={{ background: "#FFF4F2", border: "1px solid #F0C9C3", borderRadius: 14, padding: 16 }}>
                    <div style={{ color: "#B53A2D", fontSize: 13, fontWeight: "bold", marginBottom: 10 }}>{supportError}</div>
                    <button
                      onClick={ensureSupportThread}
                      style={{
                        background: "#2C2416",
                        border: "none",
                        color: "#fff",
                        borderRadius: 12,
                        padding: "10px 14px",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontWeight: "bold",
                      }}
                    >
                      Erneut versuchen
                    </button>
                  </div>
                ) : supportThreadId ? (
                  <MessageThreadView
                    threadId={supportThreadId}
                    title="Support"
                    emptyText="Noch keine Support-Nachrichten vorhanden."
                    height={420}
                  />
                ) : (
                  <EmptyState
                    icon="🛟"
                    text="Noch kein Support-Thread"
                    sub="Sobald der Support initialisiert ist, erscheint er hier."
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function VereinStelleDetail({
  stelle,
  onBack,
  onHome,
  onBestaetigen,
  onStornieren,
  onLoeschen,
  onFreiwilligerProfil,
  onTerminAbsagen,
  onTerminVerschieben,
  logout,
  showToast,
}) {
  const alleTermine = stelle.termine || [];
  const [verschiebeTermin, setVerschiebeTermin] = useState(null);
  const [wartelisten, setWartelisten] = useState({});

  useEffect(() => {
    // Warteliste für alle Termine laden
    const terminIds = alleTermine.map((t) => t.id).filter(Boolean);
    if (terminIds.length === 0) return;
    supabase
      .from("warteliste")
      .select("*")
      .in("termin_id", terminIds)
      .order("position", { ascending: true })
      .then(({ data }) => {
        if (!data) return;
        const grouped = {};
        data.forEach((w) => {
          if (!grouped[w.termin_id]) grouped[w.termin_id] = [];
          grouped[w.termin_id].push(w);
        });
        setWartelisten(grouped);
      });
  }, [stelle]);
  const [neuesDatum, setNeuesDatum] = useState("");
  const [neueStartzeit, setNeueStartzeit] = useState("");
  const [neueEndzeit, setNeueEndzeit] = useState("");
  const [terminTabs, setTerminTabs] = useState({});
  const [terminChatLists, setTerminChatLists] = useState({});
  const [terminChatLoading, setTerminChatLoading] = useState({});
  const [terminChatErrors, setTerminChatErrors] = useState({});
  const [selectedTerminChat, setSelectedTerminChat] = useState({});

  const loadTerminChats = async (terminId) => {
    if (!terminId) return [];
    setTerminChatLoading((prev) => ({ ...prev, [terminId]: true }));
    setTerminChatErrors((prev) => ({ ...prev, [terminId]: "" }));
    try {
      const chats = await getTerminDirectThreadsForVerein(terminId);
      setTerminChatLists((prev) => ({ ...prev, [terminId]: chats || [] }));
      setSelectedTerminChat((prev) => ({
        ...prev,
        [terminId]: prev?.[terminId] && (chats || []).some((c) => c.id === prev[terminId]?.id)
          ? prev[terminId]
          : (chats || [])[0] || null,
      }));
      return chats || [];
    } catch (err) {
      console.error("Fehler beim Laden der Termin-Chats:", err);
      setTerminChatErrors((prev) => ({
        ...prev,
        [terminId]: err?.message || "Chats konnten nicht geladen werden.",
      }));
      return [];
    } finally {
      setTerminChatLoading((prev) => ({ ...prev, [terminId]: false }));
    }
  };

  const openTerminDirectChat = async (terminId, freiwilliger) => {
    if (!terminId || !freiwilliger?.id) return null;
    setTerminTabs((prev) => ({ ...prev, [terminId]: "chats" }));
    try {
      const thread = await getOrCreateTerminDirectThread(terminId, freiwilliger.id);
      const chats = await loadTerminChats(terminId);
      const selected = (chats || []).find((item) => item.id === thread.id) || {
        ...thread,
        freiwillige: freiwilliger,
      };
      setSelectedTerminChat((prev) => ({ ...prev, [terminId]: selected }));
      return selected;
    } catch (err) {
      console.error("Fehler beim Öffnen des Direktchats:", err);
      setTerminChatErrors((prev) => ({
        ...prev,
        [terminId]: err?.message || "Direktchat konnte nicht geöffnet werden.",
      }));
      return null;
    }
  };

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
          <div style={{ fontSize: 18, fontWeight: "bold" }}>Stelle Details</div>
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
        <div
          style={{
            background: "#FAF7F2",
            borderRadius: 14,
            padding: "16px",
            marginBottom: 16,
            border: "1px solid #E0D8C8",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: "bold" }}>{stelle.titel}</div>
          <div style={{ fontSize: 13, color: "#8B7355", marginTop: 4 }}>
            {stelle.ort} · 👁️ {stelle.aufrufe || 0} Aufrufe
          </div>
        </div>

        {alleTermine.length === 0 && (
          <div style={{ fontSize: 13, color: "#8B7355" }}>
            Keine Termine vorhanden.
          </div>
        )}

        {alleTermine.map((t) => {
          const istVergangen = !isTerminAktuell(t);
          const nochNichtGestartet = isTerminNochNichtGestartet(t);

          return (
            <div
              key={t.id}
              style={{
                background: "#FAF7F2",
                borderRadius: 14,
                padding: "14px",
                marginBottom: 12,
                border: `1px solid ${istVergangen ? "#E0D8C8" : "#C8D8E8"}`,
              }}
            >
              {/* Termin Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <div style={{ fontWeight: "bold", fontSize: 14 }}>
                  📅 {formatDate(t.datum)} · 🕐 {t.startzeit}
                  {t.endzeit ? ` – ${t.endzeit}` : ""}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: istVergangen ? "#8B7355" : "#5B9BD5",
                    fontWeight: "bold",
                  }}
                >
                  {istVergangen ? "Vergangen" : "Bevorstehend"}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#3A7D44", marginBottom: 10 }}>
                {getTerminPlaetze(t).freiePlaetze} Plätze frei
              </div>

              {/* Termin-Aktionen für bevorstehende Termine */}
              {nochNichtGestartet && (
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <button
                    onClick={() => {
                      setVerschiebeTermin(t);
                      setNeuesDatum(t.datum);
                      setNeueStartzeit(t.startzeit);
                      setNeueEndzeit(t.endzeit || "");
                    }}
                    style={{
                      flex: 1,
                      padding: "7px",
                      borderRadius: 8,
                      border: "1px solid #5B9BD5",
                      background: "transparent",
                      color: "#5B9BD5",
                      fontSize: 12,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontWeight: "bold",
                    }}
                  >
                    📅 Verschieben
                  </button>
                  <button
                    onClick={() => onTerminAbsagen && onTerminAbsagen(t.id)}
                    style={{
                      flex: 1,
                      padding: "7px",
                      borderRadius: 8,
                      border: "1px solid #E85C5C",
                      background: "transparent",
                      color: "#E85C5C",
                      fontSize: 12,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontWeight: "bold",
                    }}
                  >
                    ✗ Absagen
                  </button>
                </div>
              )}

              {(() => {
                const aktiveTeilnehmer = aktiveBewerbungen(t.bewerbungen || []);
                const activeTab = terminTabs[t.id] || "teilnehmer";
                const chatList = terminChatLists[t.id] || [];
                const selectedChat = selectedTerminChat[t.id] || null;
                const isChatLoading = Boolean(terminChatLoading[t.id]);
                const chatError = terminChatErrors[t.id] || "";

                return (
                  <>
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      <button
                        onClick={() => setTerminTabs((prev) => ({ ...prev, [t.id]: "teilnehmer" }))}
                        style={{
                          flex: 1,
                          padding: "8px",
                          borderRadius: 10,
                          border: activeTab === "teilnehmer" ? "none" : "1px solid #E0D8C8",
                          background: activeTab === "teilnehmer" ? "#2C2416" : "transparent",
                          color: activeTab === "teilnehmer" ? "#FAF7F2" : "#2C2416",
                          fontSize: 12,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          fontWeight: "bold",
                        }}
                      >
                        👥 Teilnehmer
                      </button>
                      <button
                        onClick={async () => {
                          setTerminTabs((prev) => ({ ...prev, [t.id]: "chats" }));
                          await loadTerminChats(t.id);
                        }}
                        style={{
                          flex: 1,
                          padding: "8px",
                          borderRadius: 10,
                          border: activeTab === "chats" ? "none" : "1px solid #E0D8C8",
                          background: activeTab === "chats" ? "#2C2416" : "transparent",
                          color: activeTab === "chats" ? "#FAF7F2" : "#2C2416",
                          fontSize: 12,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          fontWeight: "bold",
                        }}
                      >
                        💬 Chats
                      </button>
                    </div>

                    {activeTab === "chats" ? (
                      <div style={{ marginBottom: 12 }}>
                        {isChatLoading ? (
                          <div style={{ fontSize: 12, color: "#8B7355" }}>Chats werden geladen …</div>
                        ) : chatError ? (
                          <div style={{ fontSize: 12, color: "#B53A2D", fontWeight: "bold" }}>{chatError}</div>
                        ) : aktiveTeilnehmer.length === 0 ? (
                          <div style={{ fontSize: 12, color: "#8B7355" }}>Noch niemand angemeldet.</div>
                        ) : (
                          <>
                            <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                              {aktiveTeilnehmer.map((b) => {
                                const existing = chatList.find((item) => item.freiwilliger_id === b.freiwilliger_id);
                                const isSelected = selectedChat?.freiwilliger_id === b.freiwilliger_id;
                                return (
                                  <button
                                    key={b.id}
                                    onClick={() => openTerminDirectChat(t.id, {
                                      id: b.freiwilliger_id,
                                      name: b.freiwilliger_name,
                                      email: b.freiwilliger_email,
                                    })}
                                    style={{
                                      width: "100%",
                                      textAlign: "left",
                                      border: isSelected ? "2px solid #2C2416" : "1px solid #E0D8C8",
                                      background: isSelected ? "#F3EBDD" : "#FFFDFC",
                                      borderRadius: 12,
                                      padding: "12px",
                                      cursor: "pointer",
                                      fontFamily: "inherit",
                                    }}
                                  >
                                    <div style={{ fontSize: 13, fontWeight: "bold", color: "#2C2416", marginBottom: 4 }}>
                                      {b.freiwilliger_name || "Freiwilliger"}
                                    </div>
                                    <div style={{ fontSize: 12, color: "#8B7355", marginBottom: 4 }}>
                                      {b.freiwilliger_email || "Keine E-Mail"}
                                    </div>
                                    <div style={{ fontSize: 11, color: existing ? "#3A7D44" : "#8B7355" }}>
                                      {existing ? "Chat öffnen" : "Direktchat starten"}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>

                            {selectedChat?.id ? (
                              <MessageThreadView
                                threadId={selectedChat.id}
                                title="Direktchat"
                                emptyText="Noch keine Nachrichten vorhanden."
                                height={280}
                                senderLabels={{
                                  verein: stelle?.vereine?.name || stelle?.verein_name || "Verein",
                                  freiwilliger: selectedChat?.freiwillige?.name || "Freiwilliger",
                                }}
                              />
                            ) : (
                              <div style={{ fontSize: 12, color: "#8B7355" }}>
                                Wähle einen Teilnehmer aus, um den Chat zu öffnen.
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <>
                        <SectionLabel>
                          Angemeldete ({aktiveTeilnehmer.length})
                        </SectionLabel>
                        {aktiveTeilnehmer.length === 0 ? (
                          <div style={{ fontSize: 12, color: "#8B7355" }}>
                            Noch niemand angemeldet.
                          </div>
                        ) : (
                          aktiveTeilnehmer.map((b) => (
                            <div
                              key={b.id}
                              style={{
                                background: "#F4F0E8",
                                borderRadius: 10,
                                padding: "12px",
                                marginBottom: 8,
                              }}
                            >
                              <div
                                onClick={() => onFreiwilligerProfil({ ...b, termin: t })}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  cursor: "pointer",
                                  marginBottom: 8,
                                }}
                              >
                                <div>
                                  <div style={{ fontWeight: "bold", fontSize: 13 }}>
                                    👤 {b.freiwilliger_name}
                                  </div>
                                  <div style={{ fontSize: 12, color: "#8B7355" }}>
                                    📧 {b.freiwilliger_email}
                                  </div>
                                </div>
                                <div style={{ color: "#8B7355", fontSize: 18 }}>›</div>
                              </div>
                              {nochNichtGestartet && (
                                <button
                                  onClick={() => onStornieren && onStornieren(b.id, t.id)}
                                  style={{
                                    width: "100%",
                                    padding: "7px",
                                    borderRadius: 8,
                                    border: "1px solid #E85C5C",
                                    background: "transparent",
                                    color: "#E85C5C",
                                    fontSize: 12,
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                  }}
                                >
                                  🗑 Anmeldung stornieren
                                </button>
                              )}
                              {istVergangen && bewerbungIstOffen(b) && (
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button
                                    onClick={() => onBestaetigen(b.id, true)}
                                    style={{
                                      flex: 1,
                                      padding: "8px",
                                      borderRadius: 8,
                                      border: "none",
                                      background: "#3A7D44",
                                      color: "#fff",
                                      fontSize: 12,
                                      fontFamily: "inherit",
                                      cursor: "pointer",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    ✓ Erschienen (+5)
                                  </button>
                                  <button
                                    onClick={() => onBestaetigen(b.id, false)}
                                    style={{
                                      flex: 1,
                                      padding: "8px",
                                      borderRadius: 8,
                                      border: "none",
                                      background: "#E85C5C",
                                      color: "#fff",
                                      fontSize: 12,
                                      fontFamily: "inherit",
                                      cursor: "pointer",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    ✗ Nicht erschienen
                                  </button>
                                </div>
                              )}
                              {istVergangen && bewerbungIstErschienen(b) && (
                                <div style={{ fontSize: 12, color: "#3A7D44", fontWeight: "bold" }}>
                                  ✓ Erschienen bestätigt
                                </div>
                              )}
                              {istVergangen && bewerbungIstNoShow(b) && (
                                <div style={{ fontSize: 12, color: "#E85C5C", fontWeight: "bold" }}>
                                  ✗ Nicht erschienen
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </>
                    )}

                  </>
                );
              })()}

              {/* Warteliste */}
              {(wartelisten[t.id] || []).length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#E8A87C",
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      marginBottom: 6,
                      fontWeight: "bold",
                    }}
                  >
                    📋 WARTELISTE ({(wartelisten[t.id] || []).length})
                  </div>
                  {(wartelisten[t.id] || []).map((w, i) => (
                    <div
                      key={w.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 8px",
                        background: "#FFF8EE",
                        borderRadius: 8,
                        marginBottom: 4,
                        border: "1px solid #E8A87C44",
                      }}
                    >
                      <div
                        style={{
                          background: "#E8A87C",
                          color: "#fff",
                          borderRadius: "50%",
                          width: 20,
                          height: 20,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          fontWeight: "bold",
                          flexShrink: 0,
                        }}
                      >
                        {w.position}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: "bold",
                            color: "#2C2416",
                          }}
                        >
                          {w.freiwilliger_name}
                        </div>
                        <div style={{ fontSize: 10, color: "#8B7355" }}>
                          {w.freiwilliger_email}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <button
          onClick={onLoeschen}
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
            marginTop: 8,
          }}
        >
          Stelle löschen
        </button>
      </div>

      {/* Verschieben Modal */}
      {verschiebeTermin && (
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
                marginBottom: 4,
                color: "#2C2416",
              }}
            >
              📅 Termin verschieben
            </div>
            <div style={{ fontSize: 12, color: "#8B7355", marginBottom: 16 }}>
              Alle Angemeldeten werden automatisch benachrichtigt.
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#8B7355", marginBottom: 6 }}>
                NEUES DATUM
              </div>
              <input
                type="date"
                value={neuesDatum}
                onChange={(e) => setNeuesDatum(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #E0D8C8",
                  background: "#FAF7F2",
                  fontFamily: "inherit",
                  fontSize: 14,
                  color: "#2C2416",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <div
                  style={{ fontSize: 12, color: "#8B7355", marginBottom: 6 }}
                >
                  STARTZEIT
                </div>
                <input
                  type="time"
                  value={neueStartzeit}
                  onChange={(e) => setNeueStartzeit(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #E0D8C8",
                    background: "#FAF7F2",
                    fontFamily: "inherit",
                    fontSize: 14,
                    color: "#2C2416",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{ fontSize: 12, color: "#8B7355", marginBottom: 6 }}
                >
                  ENDZEIT
                </div>
                <input
                  type="time"
                  value={neueEndzeit}
                  onChange={(e) => setNeueEndzeit(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #E0D8C8",
                    background: "#FAF7F2",
                    fontFamily: "inherit",
                    fontSize: 14,
                    color: "#2C2416",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setVerschiebeTermin(null)}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 12,
                  border: "1px solid #E0D8C8",
                  background: "transparent",
                  color: "#8B7355",
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={() => {
                  if (!neuesDatum) return;
                  onTerminVerschieben &&
                    onTerminVerschieben(
                      verschiebeTermin.id,
                      neuesDatum,
                      neueStartzeit,
                      neueEndzeit
                    );
                  setVerschiebeTermin(null);
                }}
                style={{
                  flex: 2,
                  padding: "12px",
                  borderRadius: 12,
                  border: "none",
                  background: "#3A7D44",
                  color: "#fff",
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: "bold",
                }}
              >
                ✓ Verschieben & benachrichtigen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StelleErstellenScreen({ verein, onBack, onSave }) {
  const [titel, setTitel] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [kategorie, setKategorie] = useState("sozial");
  const [typ, setTyp] = useState("event");
  const [aufwand, setAufwand] = useState("");
  const [standort, setStandort] = useState("");
  const [ansprechpartner, setAnsprechpartner] = useState("");
  const [kontaktEmail, setKontaktEmail] = useState("");
  const [plz, setPlz] = useState(verein.plz || "");
  const [dringend, setDringend] = useState(false);
  const [requiredSkills, setRequiredSkills] = useState([]);
  const [termine, setTermine] = useState([
    { datum: "", startzeit: "", endzeit: "", plaetze: 5 },
  ]);
  const [error, setError] = useState("");

  const addTermin = () =>
    setTermine((prev) => [
      ...prev,
      { datum: "", startzeit: "", endzeit: "", plaetze: 5 },
    ]);
  const updateTermin = (i, field, val) =>
    setTermine((prev) => {
      const n = [...prev];
      n[i] = { ...n[i], [field]: val };
      return n;
    });
  const removeTermin = (i) =>
    setTermine((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = () => {
    if (!titel || !beschreibung) {
      setError("Bitte Titel und Beschreibung ausfüllen.");
      return;
    }
    if (typ === "dauerhaft" && !aufwand) {
      setError("Bitte Zeitaufwand pro Woche angeben.");
      return;
    }
    const aufwandFormatted =
      typ === "dauerhaft" && aufwand ? `${aufwand}h / Woche` : "";
    const stelleData = {
      titel,
      beschreibung,
      kategorie,
      typ,
      aufwand: aufwandFormatted,
      ort: verein.ort,
      plz,
      standort,
      ansprechpartner: ansprechpartner || null,
      kontakt_email: kontaktEmail || null,
      dringend,
      gemeinde_id: verein.gemeinde_id,
    };
    const termineData = termine
      .filter((t) => t.datum)
      .map((t) => ({
        datum: t.datum,
        startzeit: t.startzeit,
        endzeit: t.endzeit || null,
        freie_plaetze: t.plaetze,
        gesamt_plaetze: t.plaetze,
      }));
    onSave(stelleData, termineData);
  };

  return (
    <div>
      <Header title="Neue Stelle" onBack={onBack} />
      <div style={{ padding: "20px 20px 100px" }}>
        <Input
          label="Titel"
          value={titel}
          onChange={setTitel}
          placeholder="z.B. Bachpatenschaft"
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
            BESCHREIBUNG
          </div>
          <textarea
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
            placeholder="Was erwartet die Freiwilligen?"
            rows={3}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #E0D8C8",
              background: "#FAF7F2",
              fontFamily: "inherit",
              fontSize: 14,
              color: "#2C2416",
              resize: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#8B7355", marginBottom: 8 }}>
            TYP
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setTyp("event")}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                background: typ === "event" ? "#2C2416" : "#EDE8DE",
                color: typ === "event" ? "#FAF7F2" : "#8B7355",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: "bold",
              }}
            >
              📅 Einmaliges Event
            </button>
            <button
              onClick={() => setTyp("dauerhaft")}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                background: typ === "dauerhaft" ? "#2C2416" : "#EDE8DE",
                color: typ === "dauerhaft" ? "#FAF7F2" : "#8B7355",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: "bold",
              }}
            >
              🔄 Dauerhaft
            </button>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#8B7355", marginBottom: 8 }}>
            KATEGORIE
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {KATEGORIEN.map((k) => (
              <button
                key={k.id}
                onClick={() => setKategorie(k.id)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  border: "none",
                  cursor: "pointer",
                  background: kategorie === k.id ? k.color : "#EDE8DE",
                  color: kategorie === k.id ? "#fff" : "#8B7355",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              >
                {k.icon} {k.label}
              </button>
            ))}
          </div>
        </div>
        {typ === "dauerhaft" && (
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 12,
                color: "#8B7355",
                marginBottom: 6,
                letterSpacing: 0.5,
              }}
            >
              ZEITAUFWAND PRO WOCHE (PFLICHT)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={aufwand}
                onChange={(e) => setAufwand(e.target.value)}
                placeholder="z.B. 2"
                style={{
                  width: 100,
                  padding: "11px 14px",
                  borderRadius: 10,
                  border: "1px solid #E0D8C8",
                  background: "#FAF7F2",
                  fontFamily: "inherit",
                  fontSize: 14,
                  color: "#2C2416",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
              <div
                style={{ fontSize: 14, color: "#8B7355", fontWeight: "bold" }}
              >
                Stunden / Woche
              </div>
            </div>
          </div>
        )}
        <Input
          label="Standort / Treffpunkt"
          value={standort}
          onChange={setStandort}
          placeholder="z.B. Parkplatz Rathaus"
        />
        <Input
          label="Ansprechpartner (optional)"
          value={ansprechpartner}
          onChange={setAnsprechpartner}
          placeholder="z.B. Max Mustermann"
        />
        <Input
          label="Kontakt-Email (optional)"
          value={kontaktEmail}
          onChange={setKontaktEmail}
          placeholder="z.B. max@verein.de"
        />
        <Input
          label="PLZ"
          value={plz}
          onChange={setPlz}
          placeholder="z.B. 64683"
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 14,
            padding: "12px 14px",
            background: "#FAF7F2",
            borderRadius: 10,
            border: "1px solid #E0D8C8",
          }}
        >
          <input
            type="checkbox"
            checked={dringend}
            onChange={(e) => setDringend(e.target.checked)}
            id="dringend"
            style={{ width: 18, height: 18 }}
          />
          <label
            htmlFor="dringend"
            style={{ fontSize: 14, color: "#2C2416", cursor: "pointer" }}
          >
            🔴 Als dringend markieren
          </label>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 12,
              color: "#8B7355",
              marginBottom: 8,
              letterSpacing: 0.5,
            }}
          >
            ERFORDERLICHE KENNTNISSE (optional)
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {SKILLS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() =>
                  setRequiredSkills((prev) =>
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
                  background: requiredSkills.includes(s.id)
                    ? "#2C2416"
                    : "#EDE8DE",
                  color: requiredSkills.includes(s.id) ? "#FAF7F2" : "#8B7355",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              >
                {s.icon} {getSkillLabel(s, "de")}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 12, color: "#8B7355", letterSpacing: 0.5 }}>
              {typ === "dauerhaft"
                ? "TERMIN ZUM ERST- / EINFÜHRUNGSGESPRÄCH"
                : "TERMINE"}
            </div>
            <button
              onClick={addTermin}
              style={{
                padding: "4px 12px",
                borderRadius: 8,
                border: "1px solid #2C2416",
                background: "transparent",
                color: "#2C2416",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              + {typ === "dauerhaft" ? "Einführungsgespräch" : "Termin"}
            </button>
          </div>
          {termine.map((t, i) => (
            <div
              key={i}
              style={{
                background: "#FAF7F2",
                borderRadius: 12,
                padding: "12px",
                marginBottom: 10,
                border: "1px solid #E0D8C8",
              }}
            >
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  type="date"
                  value={t.datum}
                  onChange={(e) => updateTermin(i, "datum", e.target.value)}
                  style={{
                    flex: 2,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #E0D8C8",
                    background: "#fff",
                    fontFamily: "inherit",
                    fontSize: 13,
                    color: "#2C2416",
                    boxSizing: "border-box",
                  }}
                />
                {termine.length > 1 && (
                  <button
                    onClick={() => removeTermin(i)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "none",
                      background: "#FFF0F0",
                      color: "#E85C5C",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div
                    style={{ fontSize: 10, color: "#8B7355", marginBottom: 3 }}
                  >
                    STARTZEIT
                  </div>
                  <input
                    type="time"
                    value={t.startzeit}
                    onChange={(e) =>
                      updateTermin(i, "startzeit", e.target.value)
                    }
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #E0D8C8",
                      background: "#fff",
                      fontFamily: "inherit",
                      fontSize: 13,
                      color: "#2C2416",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{ fontSize: 10, color: "#8B7355", marginBottom: 3 }}
                  >
                    ENDZEIT (optional)
                  </div>
                  <input
                    type="time"
                    value={t.endzeit}
                    onChange={(e) => updateTermin(i, "endzeit", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #E0D8C8",
                      background: "#fff",
                      fontFamily: "inherit",
                      fontSize: 13,
                      color: "#2C2416",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 12, color: "#8B7355" }}>
                  Freie Plätze:
                </div>
                <input
                  type="number"
                  min="1"
                  value={t.plaetze}
                  onChange={(e) =>
                    updateTermin(i, "plaetze", parseInt(e.target.value) || 1)
                  }
                  style={{
                    width: 70,
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #E0D8C8",
                    background: "#fff",
                    fontFamily: "inherit",
                    fontSize: 13,
                    color: "#2C2416",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        {error && <ErrorMsg>{error}</ErrorMsg>}
        <BigButton onClick={handleSave} green>
          Stelle veröffentlichen ✓
        </BigButton>
      </div>
    </div>
  );
}

function VereinProfilEdit({
  verein,
  onBack,
  onHome,
  onSave,
  showToast,
  logout,
  onImpressum,
  onDatenschutz,
  onAgb,
}) {
  const [name, setName] = useState(verein.name || "");
  const [beschreibung, setBeschreibung] = useState(verein.beschreibung || "");
  const [strasse, setStrasse] = useState(verein.strasse || "");
  const [telefon, setTelefon] = useState(verein.telefon || "");
  const [website, setWebsite] = useState(verein.website || "");
  const [kontaktEmail, setKontaktEmailEdit] = useState(
    verein.kontakt_email || ""
  );
  const [ort, setOrt] = useState(verein.ort || "");
  const [plz, setPlz] = useState(verein.plz || "");
  const [mitglieder, setMitglieder] = useState(
    verein.mitglieder ? String(verein.mitglieder) : ""
  );
  const [gegruendet, setGegruendet] = useState(
    verein.gegruendet ? String(verein.gegruendet) : ""
  );
  const [logoUrl, setLogoUrl] = useState(verein.logo_url || "");
  const [logoUploading, setLogoUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("profil");
  const [neuesPasswort, setNeuesPasswort] = useState("");
  const [passwortWiederholen, setPasswortWiederholen] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast && showToast("Bitte ein Bild auswählen.", "#E85C5C");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast && showToast("Max. 2MB erlaubt.", "#E85C5C");
      return;
    }
    setLogoUploading(true);
    const ext = file.name.split(".").pop();
    const path = `logos/${verein.id}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (upErr) {
      showToast && showToast("Upload fehlgeschlagen.", "#E85C5C");
      setLogoUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);
    setLogoUrl(urlData.publicUrl + "?t=" + Date.now());
    setLogoUploading(false);
    showToast && showToast("✓ Logo gespeichert!");
  };

  const handlePasswortAendern = async () => {
    if (!neuesPasswort || !passwortWiederholen) {
      setError("Bitte alle Felder ausfüllen.");
      return;
    }
    if (neuesPasswort.length < 6) {
      setError("Passwort mind. 6 Zeichen.");
      return;
    }
    if (neuesPasswort !== passwortWiederholen) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({
      password: neuesPasswort,
    });
    setLoading(false);
    if (err) {
      setError("Fehler. Bitte neu einloggen.");
      return;
    }
    setNeuesPasswort("");
    setPasswortWiederholen("");
    setError("");
    showToast && showToast("✓ Passwort geändert!");
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
          <div style={{ fontSize: 18, fontWeight: "bold" }}>Einstellungen</div>
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
          {logout && (
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
          )}
        </div>
      </div>

      <div style={{ padding: "16px 16px 100px" }}>
        {/* Profil-Karte oben */}
        {activeTab === "profil" && (
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
              {logoUrl ? (
                <img
                  src={logoUrl}
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
                    fontSize: 40,
                    margin: "0 auto",
                  }}
                >
                  {verein.logo || "🏢"}
                </div>
              )}
              <label
                htmlFor="logo-upload"
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
                {logoUploading ? "⏳" : "📷"}
              </label>
              <input
                id="logo-upload"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                style={{ display: "none" }}
              />
            </div>
            <div style={{ fontSize: 20, fontWeight: "bold", marginTop: 4 }}>
              {verein.name}
            </div>
            <div style={{ fontSize: 13, color: "#8B7355", marginTop: 2 }}>
              📍 {verein.ort}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 24,
                marginTop: 12,
              }}
            >
              {verein.mitglieder > 0 && (
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: "bold",
                      color: "#E8A87C",
                    }}
                  >
                    {verein.mitglieder}
                  </div>
                  <div style={{ fontSize: 11, color: "#8B7355" }}>
                    Mitglieder
                  </div>
                </div>
              )}
              {verein.gegruendet > 0 && (
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: "bold",
                      color: "#6BAF7A",
                    }}
                  >
                    {verein.gegruendet}
                  </div>
                  <div style={{ fontSize: 11, color: "#8B7355" }}>
                    Gegründet
                  </div>
                </div>
              )}
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
            { id: "profil", label: "👤 Profil" },
            { id: "passwort", label: "🔑 Passwort" },
            { id: "konto", label: "⚙️ Konto" },
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
            {!verein.verifiziert && (
              <div
                style={{
                  background: "#FFF8E8",
                  borderRadius: 10,
                  padding: "12px 14px",
                  marginBottom: 16,
                  border: "1px solid #E8C84A",
                  fontSize: 13,
                  color: "#8B6800",
                }}
              >
                ⏳ Verifizierung ausstehend
              </div>
            )}
            <Input
              label="Vereinsname"
              value={name}
              onChange={setName}
              placeholder="Name des Vereins"
            />
            <Input
              label="Ort"
              value={ort}
              onChange={setOrt}
              placeholder="z.B. Einhausen"
            />
            <Input
              label="PLZ"
              value={plz}
              onChange={setPlz}
              placeholder="z.B. 64683"
            />
            <Input
              label="Straße & Hausnummer (Pflicht)"
              value={strasse}
              onChange={setStrasse}
              placeholder="Hauptstraße 1"
            />
            <Input
              label="Öffentliche Kontakt-Email (Pflicht)"
              value={kontaktEmail}
              onChange={setKontaktEmailEdit}
              type="email"
              placeholder="kontakt@verein.de"
            />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <Input
                  label="Telefon (optional)"
                  value={telefon}
                  onChange={setTelefon}
                  placeholder="+49 6251 ..."
                />
              </div>
              <div style={{ flex: 1 }}>
                <Input
                  label="Website (optional)"
                  value={website}
                  onChange={setWebsite}
                  placeholder="www.verein.de"
                />
              </div>
            </div>
            <Input
              label="Mitgliederzahl"
              value={mitglieder}
              onChange={setMitglieder}
              type="number"
              placeholder="z.B. 120"
            />
            <Input
              label="Gegründet"
              value={gegruendet}
              onChange={setGegruendet}
              type="number"
              placeholder="z.B. 1990"
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
                ÜBER UNS
              </div>
              <textarea
                value={beschreibung}
                onChange={(e) => setBeschreibung(e.target.value)}
                placeholder="Beschreibt euren Verein..."
                rows={4}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #E0D8C8",
                  background: "#FAF7F2",
                  fontFamily: "inherit",
                  fontSize: 14,
                  color: "#2C2416",
                  resize: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <BigButton
              onClick={() =>
                onSave({
                  name,
                  beschreibung,
                  ort,
                  plz,
                  strasse,
                  telefon,
                  website,
                  kontakt_email: kontaktEmail,
                  mitglieder: parseInt(mitglieder) || 0,
                  gegruendet: parseInt(gegruendet) || 0,
                  logo_url: logoUrl || null,
                })
              }
              green
            >
              Speichern ✓
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
                🔒 Mindestens 6 Zeichen.
              </div>
            </div>
            <Input
              label="Neues Passwort"
              value={neuesPasswort}
              onChange={setNeuesPasswort}
              type="password"
              placeholder="••••••"
            />
            <Input
              label="Passwort wiederholen"
              value={passwortWiederholen}
              onChange={setPasswortWiederholen}
              type="password"
              placeholder="••••••"
            />
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <BigButton onClick={handlePasswortAendern} disabled={loading}>
              {loading ? "Ändern..." : "Passwort ändern"}
            </BigButton>
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
                KONTO INFO
              </div>
              <div style={{ fontSize: 14, color: "#2C2416" }}>
                📧 {verein.email}
              </div>
              <div style={{ fontSize: 12, color: "#8B7355", marginTop: 4 }}>
                Registriert als Verein
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
                RECHTLICHES
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
                  Datenschutz →
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
                  AGB →
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
                  Impressum →
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
              Konto löschen
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
                  ⚠️ Alle Daten werden unwiderruflich gelöscht.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={async () => {
                      await supabase
                        .from("vereine")
                        .delete()
                        .eq("id", verein.id);
                      await supabase.auth.signOut();
                      window.location.reload();
                    }}
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
                    Ja, löschen
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
                    Abbrechen
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

function StelleBearbeitenScreen({ stelle, verein, onBack, onSave }) {
  const [titel, setTitel] = useState(stelle.titel || "");
  const [beschreibung, setBeschreibung] = useState(stelle.beschreibung || "");
  const [aufwand, setAufwand] = useState(stelle.aufwand || "");
  const [standort, setStandort] = useState(stelle.standort || "");
  const [dringend, setDringend] = useState(stelle.dringend || false);
  const [kategorie, setKategorie] = useState(stelle.kategorie || "sozial");
  const [termine, setTermine] = useState(
    (stelle.termine || []).map((t) => ({
      id: t.id,
      datum: t.datum || "",
      startzeit: t.startzeit || "",
      endzeit: t.endzeit || "",
      plaetze: t.freie_plaetze || 5,
      absagen: false,
    }))
  );
  const [error, setError] = useState("");

  const addTermin = () =>
    setTermine((prev) => [
      ...prev,
      {
        id: null,
        datum: "",
        startzeit: "",
        endzeit: "",
        plaetze: 5,
        absagen: false,
      },
    ]);
  const updateTermin = (i, field, val) =>
    setTermine((prev) => {
      const n = [...prev];
      n[i] = { ...n[i], [field]: val };
      return n;
    });
  const toggleAbsagen = (i) =>
    setTermine((prev) => {
      const n = [...prev];
      n[i] = { ...n[i], absagen: !n[i].absagen };
      return n;
    });

  return (
    <div>
      <Header title="Stelle bearbeiten" onBack={onBack} />
      <div style={{ padding: "20px 20px 100px" }}>
        <Input
          label="Titel"
          value={titel}
          onChange={setTitel}
          placeholder="z.B. Bachpatenschaft"
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
            BESCHREIBUNG
          </div>
          <textarea
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
            rows={4}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #E0D8C8",
              background: "#FAF7F2",
              fontFamily: "inherit",
              fontSize: 14,
              color: "#2C2416",
              resize: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "#8B7355", marginBottom: 8 }}>
            KATEGORIE
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {KATEGORIEN.map((k) => (
              <button
                key={k.id}
                onClick={() => setKategorie(k.id)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  border: "none",
                  cursor: "pointer",
                  background: kategorie === k.id ? k.color : "#EDE8DE",
                  color: kategorie === k.id ? "#fff" : "#8B7355",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              >
                {k.icon} {k.label}
              </button>
            ))}
          </div>
        </div>
        {stelle.typ === "dauerhaft" && (
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 12,
                color: "#8B7355",
                marginBottom: 6,
                letterSpacing: 0.5,
              }}
            >
              ZEITAUFWAND PRO WOCHE
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={aufwand}
                onChange={(e) => setAufwand(e.target.value)}
                style={{
                  width: 100,
                  padding: "11px 14px",
                  borderRadius: 10,
                  border: "1px solid #E0D8C8",
                  background: "#FAF7F2",
                  fontFamily: "inherit",
                  fontSize: 14,
                  color: "#2C2416",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
              <div
                style={{ fontSize: 14, color: "#8B7355", fontWeight: "bold" }}
              >
                Stunden / Woche
              </div>
            </div>
          </div>
        )}
        <Input
          label="Standort / Treffpunkt"
          value={standort}
          onChange={setStandort}
          placeholder="z.B. Parkplatz Rathaus"
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 20,
            padding: "12px 14px",
            background: "#FAF7F2",
            borderRadius: 10,
            border: "1px solid #E0D8C8",
          }}
        >
          <input
            type="checkbox"
            checked={dringend}
            onChange={(e) => setDringend(e.target.checked)}
            id="dringend-edit"
            style={{ width: 18, height: 18 }}
          />
          <label
            htmlFor="dringend-edit"
            style={{ fontSize: 14, color: "#2C2416", cursor: "pointer" }}
          >
            🔴 Als dringend markieren
          </label>
        </div>

        {/* Termine */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 12, color: "#8B7355", letterSpacing: 0.5 }}>
              {stelle.typ === "dauerhaft"
                ? "ERST- / EINFÜHRUNGSGESPRÄCHE"
                : "TERMINE"}
            </div>
            <button
              onClick={addTermin}
              style={{
                padding: "4px 12px",
                borderRadius: 8,
                border: "1px solid #2C2416",
                background: "transparent",
                color: "#2C2416",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              + {stelle.typ === "dauerhaft" ? "Einführungsgespräch" : "Termin"}{" "}
              hinzufügen
            </button>
          </div>
          {termine.map((t, i) => (
            <div
              key={i}
              style={{
                background: t.absagen ? "#FFF0F0" : "#FAF7F2",
                borderRadius: 12,
                padding: "12px",
                marginBottom: 10,
                border: `1px solid ${t.absagen ? "#E85C5C" : "#E0D8C8"}`,
                opacity: t.absagen ? 0.6 : 1,
              }}
            >
              {/* Datum + Absagen Toggle */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: "bold",
                    color: t.absagen ? "#E85C5C" : "#2C2416",
                  }}
                >
                  {t.datum
                    ? `📅 ${new Date(t.datum).toLocaleDateString("de-DE", {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                      })}`
                    : "Neuer Termin"}
                  {t.absagen && " – WIRD ABGESAGT"}
                </div>
                <button
                  onClick={() => toggleAbsagen(i)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 8,
                    border: `1px solid ${t.absagen ? "#3A7D44" : "#E85C5C"}`,
                    background: "transparent",
                    color: t.absagen ? "#3A7D44" : "#E85C5C",
                    fontSize: 11,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {t.absagen ? "↩ Rückgängig" : "✗ Absagen"}
                </button>
              </div>
              {!t.absagen && (
                <>
                  <input
                    type="date"
                    value={t.datum}
                    onChange={(e) => updateTermin(i, "datum", e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid #E0D8C8",
                      background: "#fff",
                      fontFamily: "inherit",
                      fontSize: 13,
                      color: "#2C2416",
                      boxSizing: "border-box",
                      marginBottom: 8,
                    }}
                  />
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#8B7355",
                          marginBottom: 3,
                        }}
                      >
                        STARTZEIT
                      </div>
                      <input
                        type="time"
                        value={t.startzeit}
                        onChange={(e) =>
                          updateTermin(i, "startzeit", e.target.value)
                        }
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid #E0D8C8",
                          background: "#fff",
                          fontFamily: "inherit",
                          fontSize: 13,
                          color: "#2C2416",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#8B7355",
                          marginBottom: 3,
                        }}
                      >
                        ENDZEIT (optional)
                      </div>
                      <input
                        type="time"
                        value={t.endzeit}
                        onChange={(e) =>
                          updateTermin(i, "endzeit", e.target.value)
                        }
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: 8,
                          border: "1px solid #E0D8C8",
                          background: "#fff",
                          fontFamily: "inherit",
                          fontSize: 13,
                          color: "#2C2416",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <div style={{ fontSize: 12, color: "#8B7355" }}>
                      Freie Plätze:
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={t.plaetze}
                      onChange={(e) =>
                        updateTermin(
                          i,
                          "plaetze",
                          parseInt(e.target.value) || 1
                        )
                      }
                      style={{
                        width: 70,
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #E0D8C8",
                        background: "#fff",
                        fontFamily: "inherit",
                        fontSize: 13,
                        color: "#2C2416",
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {error && <ErrorMsg>{error}</ErrorMsg>}
        <BigButton
          green
          onClick={() => {
            if (!titel || !beschreibung) {
              setError("Titel und Beschreibung ausfüllen.");
              return;
            }
            onSave(
              { titel, beschreibung, aufwand, standort, dringend, kategorie },
              termine
            );
          }}
        >
          Änderungen speichern ✓
        </BigButton>
      </div>
    </div>
  );
}

function AnalyseDashboard({ stellen, onBack, logout, vereinId }) {
  const [snapshots, setSnapshots] = useState([]);
  const [followerAnalyse, setFollowerAnalyse] = useState(null);
  const [stelleFollower, setStelleFollower] = useState([]);
  const [wochenanalyse, setWochenanalyse] = useState([]);
  const [wochenInsights, setWochenInsights] = useState({
    besterTag: null,
    besteQuote: 0,
    schwaechsterTag: null,
    schwaechsteQuote: 0,
    topZusageTag: null,
    topZusagen: 0,
  });
  const [activeTab, setActiveTab] = useState("uebersicht");

  useEffect(() => {
    if (!vereinId) return;
    supabase
      .from("analyse_snapshots")
      .select("*")
      .eq("verein_id", vereinId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setSnapshots(data);
      });

    supabase
      .from("verein_follower_analyse")
      .select("*")
      .eq("verein_id", vereinId)
      .single()
      .then(({ data }) => {
        if (data) setFollowerAnalyse(data);
      });

    supabase
      .from("stelle_follower_analyse")
      .select("*")
      .eq("verein_id", vereinId)
      .then(({ data }) => {
        if (data) setStelleFollower(data);
      });

    supabase.rpc("get_verein_wochenanalyse", {
      p_verein_id: vereinId,
      p_monate: 12,
    }).then(({ data, error }) => {
      if (error) {
        console.error("Wochenanalyse konnte nicht geladen werden:", error);
        return;
      }

      const rows = Array.isArray(data) ? data : [];
      setWochenanalyse(rows);

      if (!rows.length) {
        setWochenInsights({
          besterTag: null,
          besteQuote: 0,
          schwaechsterTag: null,
          schwaechsteQuote: 0,
          topZusageTag: null,
          topZusagen: 0,
        });
        return;
      }

      const bestaRow = [...rows].sort((a, b) => {
        if ((b.quote || 0) !== (a.quote || 0)) return (b.quote || 0) - (a.quote || 0);
        return (b.erschienen || 0) - (a.erschienen || 0);
      })[0];

      const schwachRow = [...rows].sort((a, b) => {
        if ((a.quote || 0) !== (b.quote || 0)) return (a.quote || 0) - (b.quote || 0);
        return (b.no_show || 0) - (a.no_show || 0);
      })[0];

      const topZusageRow = [...rows].sort((a, b) => {
        if ((b.zusagen || 0) !== (a.zusagen || 0)) return (b.zusagen || 0) - (a.zusagen || 0);
        return (b.erschienen || 0) - (a.erschienen || 0);
      })[0];

      setWochenInsights({
        besterTag: bestaRow?.wochentag || null,
        besteQuote: Number(bestaRow?.quote || 0),
        schwaechsterTag: schwachRow?.wochentag || null,
        schwaechsteQuote: Number(schwachRow?.quote || 0),
        topZusageTag: topZusageRow?.wochentag || null,
        topZusagen: Number(topZusageRow?.zusagen || 0),
      });
    });
  }, [vereinId]);

  const aktiveBewerbungen = (bewerbungen = []) =>
    bewerbungen.filter((b) => {
      const status = String(b?.status || "").toLowerCase();
      return !["storniert", "abgesagt", "cancelled", "canceled"].includes(status);
    });

  const gesamtAufrufe =
    stellen.reduce((s, x) => s + (x.aufrufe || 0), 0) +
    snapshots.reduce((s, x) => s + (x.aufrufe || 0), 0);

  const gesamtAnmeldungen =
    stellen.reduce(
      (summe, stelle) =>
        summe +
        (stelle.termine || []).reduce(
          (terminSumme, termin) => terminSumme + aktiveBewerbungen(termin.bewerbungen || []).length,
          0
        ),
      0
    ) + snapshots.reduce((s, x) => s + (x.anmeldungen || 0), 0);

  const gesamtErschienen =
    stellen.reduce(
      (summe, stelle) =>
        summe +
        (stelle.termine || []).reduce(
          (terminSumme, termin) =>
            terminSumme + (termin.bewerbungen || []).filter((b) => bewerbungIstErschienen(b)).length,
          0
        ),
      0
    ) + snapshots.reduce((s, x) => s + (x.erschienen || 0), 0);

  const gesamtNichtErschienen =
    stellen.reduce(
      (summe, stelle) =>
        summe +
        (stelle.termine || []).reduce(
          (terminSumme, termin) =>
            terminSumme + (termin.bewerbungen || []).filter((b) => bewerbungIstNoShow(b)).length,
          0
        ),
      0
    ) + snapshots.reduce((s, x) => s + (x.nicht_erschienen || 0), 0);

  const erscheinenQuote =
    gesamtAnmeldungen > 0 ? Math.round((gesamtErschienen / gesamtAnmeldungen) * 100) : 0;

  const noShowQuote =
    gesamtAnmeldungen > 0 ? Math.round((gesamtNichtErschienen / gesamtAnmeldungen) * 100) : 0;

  const liveStellen = stellen.filter((stelle) => (stelle.termine || []).length > 0);

  return (
    <div>
      <Header title="Analyse" onBack={onBack} onLogout={logout} />
      <div style={{ padding: "16px 16px 100px" }}>
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
            { id: "uebersicht", label: "📊 Übersicht" },
            { id: "follower", label: "👥 Follower" },
            { id: "stellen", label: "🌱 Stellen" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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

        {activeTab === "uebersicht" && (
          <div>
            <SectionLabel>Verlässlichkeit & Nachfrage</SectionLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 18,
              }}
            >
              {[
                {
                  label: "Anmeldungen",
                  val: gesamtAnmeldungen,
                  icon: "✅",
                  color: "#3A7D44",
                },
                {
                  label: "Erschienen",
                  val: gesamtErschienen,
                  icon: "🎯",
                  color: "#6BAF7A",
                },
                {
                  label: "No-Show",
                  val: gesamtNichtErschienen,
                  icon: "❌",
                  color: "#E85C5C",
                },
                {
                  label: "Aufrufe",
                  val: gesamtAufrufe,
                  icon: "👁️",
                  color: "#5B9BD5",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    background: "#FAF7F2",
                    borderRadius: 12,
                    padding: "16px",
                    border: "1px solid #E0D8C8",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 24 }}>{item.icon}</div>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: "bold",
                      color: item.color,
                      marginTop: 4,
                    }}
                  >
                    {item.val}
                  </div>
                  <div style={{ fontSize: 11, color: "#8B7355", marginTop: 2 }}>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                background: "#FAF7F2",
                borderRadius: 14,
                padding: "16px",
                marginBottom: 16,
                border: "1px solid #E0D8C8",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: "bold", color: "#2C2416" }}>
                  🎯 Erscheinungsquote
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: "bold",
                    color:
                      erscheinenQuote >= 70
                        ? "#3A7D44"
                        : erscheinenQuote >= 40
                        ? "#E8A87C"
                        : "#E85C5C",
                  }}
                >
                  {erscheinenQuote}%
                </div>
              </div>
              <div style={{ height: 10, background: "#EDE8DE", borderRadius: 5 }}>
                <div
                  style={{
                    height: "100%",
                    width: `${erscheinenQuote}%`,
                    background:
                      erscheinenQuote >= 70
                        ? "#3A7D44"
                        : erscheinenQuote >= 40
                        ? "#E8A87C"
                        : "#E85C5C",
                    borderRadius: 5,
                    transition: "width 0.5s",
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: "#8B7355", marginTop: 6 }}>
                {erscheinenQuote >= 70
                  ? "🌟 Stark – deine Zusagen sind zuverlässig."
                  : erscheinenQuote >= 40
                  ? "👍 Solide – aber da geht noch mehr."
                  : "⚠️ Viele Zusagen werden nicht eingehalten."}
              </div>
            </div>

            <div
              style={{
                background: "#FAF7F2",
                borderRadius: 14,
                padding: "16px",
                marginBottom: 18,
                border: "1px solid #E0D8C8",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: "bold", color: "#2C2416" }}>
                  ❌ No-Show-Quote
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: "bold",
                    color:
                      noShowQuote <= 15
                        ? "#3A7D44"
                        : noShowQuote <= 35
                        ? "#E8A87C"
                        : "#E85C5C",
                  }}
                >
                  {noShowQuote}%
                </div>
              </div>
              <div style={{ height: 10, background: "#EDE8DE", borderRadius: 5 }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(noShowQuote, 100)}%`,
                    background:
                      noShowQuote <= 15
                        ? "#3A7D44"
                        : noShowQuote <= 35
                        ? "#E8A87C"
                        : "#E85C5C",
                    borderRadius: 5,
                    transition: "width 0.5s",
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: "#8B7355", marginTop: 6 }}>
                {noShowQuote <= 15
                  ? "✅ Sehr wenig Ausfälle."
                  : noShowQuote <= 35
                  ? "⚠️ Ein paar Ausfälle – beobachte die Muster."
                  : "🚨 Viele Ausfälle – hier lohnt sich Gegensteuerung."}
              </div>
            </div>

            <SectionLabel>Durchschnittliche Woche (letzte 12 Monate)</SectionLabel>
            <div
              style={{
                background: "#FAF7F2",
                borderRadius: 14,
                padding: "16px",
                marginBottom: 16,
                border: "1px solid #E0D8C8",
              }}
            >
              {wochenanalyse.length === 0 ? (
                <EmptyState
                  icon="📅"
                  text="Noch keine Wochenmuster verfügbar"
                  sub="Sobald Termine bestätigt oder ausgewertet wurden, siehst du hier deine stärksten Tage."
                />
              ) : (
                wochenanalyse.map((row) => {
                  const quoteColor =
                    row.quote >= 70 ? "#3A7D44" : row.quote >= 40 ? "#E8A87C" : "#E85C5C";
                  return (
                    <div
                      key={row.wochentag_num}
                      style={{
                        padding: "10px 0",
                        borderBottom: row.wochentag_num === 7 ? "none" : "1px solid #F0EBE0",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          marginBottom: 6,
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: "bold", color: "#2C2416", minWidth: 84 }}>
                          {row.wochentag}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <span style={{ fontSize: 11, background: "#EDE8DE", padding: "4px 8px", borderRadius: 6, color: "#2C2416" }}>
                            ✅ {row.zusagen} Zusagen
                          </span>
                          <span style={{ fontSize: 11, background: "#E8F3EA", padding: "4px 8px", borderRadius: 6, color: "#3A7D44" }}>
                            🎯 {row.erschienen} erschienen
                          </span>
                          <span style={{ fontSize: 11, background: "#FFF0F0", padding: "4px 8px", borderRadius: 6, color: "#E85C5C" }}>
                            ❌ {row.no_show} No-Show
                          </span>
                          <span style={{ fontSize: 11, background: "#F0EBE0", padding: "4px 8px", borderRadius: 6, color: quoteColor, fontWeight: "bold" }}>
                            📊 {Number(row.quote || 0).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div style={{ height: 8, background: "#EDE8DE", borderRadius: 4, overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(Number(row.quote || 0), 100)}%`,
                            background: quoteColor,
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div
              style={{
                background: "#FAF7F2",
                borderRadius: 14,
                padding: "16px",
                marginBottom: 16,
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
                INSIGHTS
              </div>
              <div style={{ fontSize: 13, color: "#2C2416", lineHeight: 1.9 }}>
                🥇 <b>{wochenInsights.besterTag || "-"}</b>
                {wochenInsights.besterTag ? ` ist dein verlässlichster Tag (${Number(wochenInsights.besteQuote || 0).toFixed(0)}% Quote).` : ""}
                <br />
                📅 <b>{wochenInsights.topZusageTag || "-"}</b>
                {wochenInsights.topZusageTag ? ` bringt dir die meiste Nachfrage (${wochenInsights.topZusagen} Zusagen).` : ""}
                <br />
                ⚠️ <b>{wochenInsights.schwaechsterTag || "-"}</b>
                {wochenInsights.schwaechsterTag ? ` ist aktuell dein schwächster Tag (${Number(wochenInsights.schwaechsteQuote || 0).toFixed(0)}% Quote).` : ""}
              </div>
            </div>
          </div>
        )}

        {activeTab === "follower" && (
          <div>
            <div
              style={{
                background: "linear-gradient(135deg,#2C2416,#4A3C28)",
                borderRadius: 18,
                padding: "28px 20px",
                textAlign: "center",
                color: "#F4F0E8",
                marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 38, fontWeight: "bold", color: "#C8A96E", marginBottom: 4 }}>
                {followerAnalyse?.gesamt_follower || 0}
              </div>
              <div style={{ fontSize: 14, color: "#C4B89A" }}>
                Freiwillige folgen deinem Verein
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
                  marginBottom: 10,
                }}
              >
                ANGEMELDETE & FOLLOWER
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div style={{ background: "#E8F3EA", borderRadius: 12, padding: "14px", textAlign: "center" }}>
                  <div style={{ fontSize: 30, fontWeight: "bold", color: "#3A7D44" }}>
                    {followerAnalyse?.gesamt_follower || 0}
                  </div>
                  <div style={{ fontSize: 12, color: "#5C4A2A" }}>Angemeldete die folgen</div>
                </div>
                <div style={{ background: "#FFF0F0", borderRadius: 12, padding: "14px", textAlign: "center" }}>
                  <div style={{ fontSize: 30, fontWeight: "bold", color: "#E85C5C" }}>
                    {Math.max(0, (followerAnalyse?.gesamt_angemeldete || 0) - (followerAnalyse?.gesamt_follower || 0))}
                  </div>
                  <div style={{ fontSize: 12, color: "#5C4A2A" }}>Angemeldete ohne Follow</div>
                </div>
              </div>

              {(() => {
                const quote =
                  followerAnalyse?.gesamt_angemeldete > 0
                    ? Math.round(
                        ((followerAnalyse?.gesamt_follower || 0) /
                          followerAnalyse.gesamt_angemeldete) *
                          100
                      )
                    : 0;
                return (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <div style={{ fontSize: 12, color: "#8B7355" }}>
                        Follow-Quote deiner Teilnehmer
                      </div>
                      <div style={{ fontSize: 14, fontWeight: "bold", color: quote >= 50 ? "#3A7D44" : "#E8A87C" }}>
                        {quote}%
                      </div>
                    </div>
                    <div style={{ height: 10, background: "#EDE8DE", borderRadius: 5, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${quote}%`,
                          background: "linear-gradient(90deg,#3A7D44,#6BAF7A)",
                          borderRadius: 5,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: "#8B7355", marginTop: 6 }}>
                      {quote >= 70
                        ? "🌟 Super – die meisten Teilnehmer folgen dir!"
                        : quote >= 40
                        ? "👍 Guter Wert – noch Potenzial."
                        : "💡 Tipp: Erinnere Teilnehmer beim nächsten Event ans Folgen!"}
                    </div>
                  </div>
                );
              })()}
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
                REICHWEITE
              </div>
              <div style={{ fontSize: 13, color: "#2C2416", lineHeight: 1.8 }}>
                👥 <b>{followerAnalyse?.gesamt_angemeldete || 0}</b> verschiedene Freiwillige haben sich je angemeldet
                <br />
                💛 <b>{followerAnalyse?.gesamt_follower || 0}</b> davon folgen deinem Verein
                <br />
                📣 <b>{Math.max(0, (followerAnalyse?.gesamt_angemeldete || 0) - (followerAnalyse?.gesamt_follower || 0))}</b> erreichst du noch nicht über Follows
              </div>
            </div>
          </div>
        )}

        {activeTab === "stellen" && (
          <div>
            <SectionLabel>Aktive Stellen</SectionLabel>
            {liveStellen.length === 0 ? (
              <EmptyState
                icon="🌱"
                text="Noch keine aktiven Stellen"
                sub="Sobald dein Verein neue Termine veröffentlicht, erscheinen sie hier mit Quote und Reichweite."
              />
            ) : (
              liveStellen.map((stelle) => {
                const anmeldungen = (stelle.termine || []).reduce(
                  (summe, termin) => summe + aktiveBewerbungen(termin.bewerbungen || []).length,
                  0
                );
                const erschienen = (stelle.termine || []).reduce(
                  (summe, termin) => summe + (termin.bewerbungen || []).filter((b) => bewerbungIstErschienen(b)).length,
                  0
                );
                const auslastung = anmeldungen > 0 ? Math.round((erschienen / anmeldungen) * 100) : 0;
                const sfData = stelleFollower.find((row) => row.stelle_id === stelle.id);
                const followQuote = anmeldungen > 0 ? Math.round(((sfData?.anmeldungen_mit_follow || 0) / anmeldungen) * 100) : 0;
                return (
                  <div
                    key={stelle.id}
                    style={{
                      background: "#FAF7F2",
                      borderRadius: 14,
                      padding: "16px",
                      marginBottom: 12,
                      border: "1px solid #E0D8C8",
                    }}
                  >
                    <div style={{ fontSize: 18, fontWeight: "bold", color: "#2C2416", marginBottom: 10 }}>
                      {stelle.titel}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                      <span style={{ fontSize: 11, background: "#EDE8DE", padding: "3px 8px", borderRadius: 6, color: "#5B9BD5" }}>
                        👁️ {stelle.aufrufe || 0} Aufrufe
                      </span>
                      <span style={{ fontSize: 11, background: "#EDE8DE", padding: "3px 8px", borderRadius: 6, color: "#3A7D44" }}>
                        ✅ {anmeldungen} Anmeldungen
                      </span>
                      <span style={{ fontSize: 11, background: "#EDE8DE", padding: "3px 8px", borderRadius: 6, color: "#6BAF7A" }}>
                        🎯 {erschienen} Erschienen
                      </span>
                      <span style={{ fontSize: 11, background: "#EDE8DE", padding: "3px 8px", borderRadius: 6, color: auslastung > 70 ? "#3A7D44" : "#E8A87C" }}>
                        📊 {auslastung}% Quote
                      </span>
                    </div>
                    {anmeldungen > 0 && (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <div style={{ fontSize: 11, color: "#8B7355" }}>
                            👥 {sfData?.anmeldungen_mit_follow || 0} von {anmeldungen} Teilnehmern folgen dir
                          </div>
                          <div style={{ fontSize: 11, fontWeight: "bold", color: followQuote >= 50 ? "#3A7D44" : "#E8A87C" }}>
                            {followQuote}%
                          </div>
                        </div>
                        <div style={{ height: 6, background: "#EDE8DE", borderRadius: 3, overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${followQuote}%`,
                              background: "linear-gradient(90deg,#C8A96E,#E8A87C)",
                              borderRadius: 3,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export {
  VereinDashboard,
  VereinStelleDetail,
  StelleErstellenScreen,
  VereinProfilEdit,
  StelleBearbeitenScreen,
  AnalyseDashboard
};

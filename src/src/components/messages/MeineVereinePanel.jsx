import React, { useEffect, useMemo, useState } from "react";
import {
  getGemeindeVereine,
  getOrCreateVereinGemeindeThread,
} from "../../services/messages";
import MessageThreadView from "./MessageThreadView";
import { EmptyState } from "../ui";

const cardStyle = {
  background: "#FAF7F2",
  borderRadius: 18,
  padding: 18,
  border: "1px solid #E6D9C2",
};

export default function MeineVereinePanel() {
  const [vereine, setVereine] = useState([]);
  const [selectedVerein, setSelectedVerein] = useState(null);
  const [thread, setThread] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        const data = await getGemeindeVereine();
        setVereine(data || []);
      } catch (err) {
        console.error(err);
        setError(err?.message || "Vereine konnten nicht geladen werden.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const filteredVereine = useMemo(() => {
    const lower = search.toLowerCase().trim();
    if (!lower) return vereine;
    return vereine.filter((v) => (v.name || "").toLowerCase().includes(lower));
  }, [search, vereine]);

  async function openThread(verein) {
    setSelectedVerein(verein);
    setLoadingThread(true);
    setError("");

    try {
      const threadData = await getOrCreateVereinGemeindeThread(verein.id);
      setThread(threadData);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Thread konnte nicht geöffnet werden.");
    } finally {
      setLoadingThread(false);
    }
  }

  if (loading) {
    return <div style={{ color: "#8B7355", fontSize: 14 }}>Vereine werden geladen …</div>;
  }

  if (error) {
    return <div style={{ color: "#B53A2D", fontSize: 14, fontWeight: 700 }}>{error}</div>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 18 }}>
      <div style={cardStyle}>
        <div style={{ fontSize: 12, color: "#8B7355", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
          Organisationen
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#2C2416", marginBottom: 12 }}>
          Meine Vereine
        </div>

        <input
          type="text"
          placeholder="Verein suchen …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            borderRadius: 14,
            border: "1px solid #D8CBB6",
            padding: 12,
            fontFamily: "inherit",
            fontSize: 14,
            boxSizing: "border-box",
            marginBottom: 14,
          }}
        />

        <div style={{ display: "grid", gap: 10, maxHeight: 520, overflowY: "auto", paddingRight: 4 }}>
          {filteredVereine.length === 0 ? (
            <EmptyState
              icon="🏛"
              text="Keine Vereine gefunden"
              sub="Passe die Suche an oder warte auf freigeschaltete Organisationen."
            />
          ) : (
            filteredVereine.map((verein) => {
              const isActive = selectedVerein?.id === verein.id;

              return (
                <button
                  key={verein.id}
                  onClick={() => openThread(verein)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: isActive ? "2px solid #2C2416" : "1px solid #E6D9C2",
                    background: isActive ? "#F3EBDD" : "#FFFDFC",
                    borderRadius: 16,
                    padding: 14,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#2C2416", marginBottom: 4 }}>
                    {verein.name || "Verein"}
                  </div>
                  <div style={{ fontSize: 13, color: "#8B7355", marginBottom: 10 }}>
                    {verein.email || "Keine E-Mail hinterlegt"}
                  </div>
                  <div style={{ fontSize: 12, color: "#5C4A32", fontWeight: 700 }}>
                    Nachrichten öffnen →
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div style={{ ...cardStyle, minHeight: 520 }}>
        {loadingThread ? (
          <div style={{ color: "#8B7355", fontSize: 14 }}>Nachrichten werden geladen …</div>
        ) : selectedVerein && thread ? (
          <>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#2C2416", marginBottom: 6 }}>
                Nachrichten mit {selectedVerein.name}
              </div>
              <div style={{ fontSize: 13, color: "#8B7355" }}>
                Direkte Abstimmung zwischen Gemeinde und Organisation.
              </div>
            </div>

            <MessageThreadView
              threadId={thread.id}
              title=""
              emptyText={`Noch keine Nachrichten mit ${selectedVerein.name} vorhanden.`}
            />
          </>
        ) : (
          <EmptyState
            icon="💬"
            text="Kein Verein ausgewählt"
            sub="Wähle links einen Verein aus, um den Nachrichtenverlauf zu öffnen."
          />
        )}
      </div>
    </div>
  );
}

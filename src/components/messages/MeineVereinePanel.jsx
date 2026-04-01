import React, { useEffect, useState } from "react";
import {
  getGemeindeVereine,
  getOrCreateVereinGemeindeThread,
} from "../../services/messages";
import MessageThreadView from "./MessageThreadView";

const cardStyle = {
  background: "#FAF7F2",
  borderRadius: 18,
  padding: 18,
  border: "1px solid #E6D9C2",
};

export default function MeineVereinePanel() {
  const [vereine, setVereine] = useState([]);
  const [filteredVereine, setFilteredVereine] = useState([]);
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
        setFilteredVereine(data || []);
      } catch (err) {
        console.error(err);
        setError(err?.message || "Vereine konnten nicht geladen werden.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    const lower = search.toLowerCase();

    const filtered = vereine.filter((v) =>
      v.name?.toLowerCase().includes(lower) ||
      v.email?.toLowerCase().includes(lower)
    );

    setFilteredVereine(filtered);
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

  if (error && !selectedVerein) {
    return <div style={{ color: "#B53A2D", fontSize: 14, fontWeight: 700 }}>{error}</div>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 18 }}>
      <div style={cardStyle}>
        <div style={{ fontSize: 12, color: "#8B7355", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
          Organisationen
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#2C2416", marginBottom: 14 }}>
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

        <div style={{ display: "grid", gap: 10, maxHeight: 520, overflowY: "auto" }}>
          {filteredVereine.length === 0 ? (
            <div style={{ color: "#8B7355", fontSize: 14 }}>
              Keine Vereine gefunden.
            </div>
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
                    background: isActive ? "#F3EBDD" : "#FFFDF8",
                    borderRadius: 14,
                    padding: 14,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#2C2416", marginBottom: 4 }}>
                    {verein.name}
                  </div>
                  <div style={{ fontSize: 13, color: "#8B7355", marginBottom: 10 }}>
                    {verein.email || "Keine E-Mail hinterlegt"}
                  </div>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 999,
                      padding: "6px 10px",
                      background: isActive ? "#2C2416" : "#EFE8DB",
                      color: isActive ? "#fff" : "#5C4A32",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Nachrichten öffnen
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div style={cardStyle}>
        {error && selectedVerein ? (
          <div style={{ color: "#B53A2D", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{error}</div>
        ) : null}

        {loadingThread ? (
          <div style={{ color: "#8B7355", fontSize: 14 }}>
            Nachrichten werden geladen …
          </div>
        ) : selectedVerein && thread ? (
          <>
            <div style={{ fontSize: 12, color: "#8B7355", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
              Nachrichtenverlauf
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#2C2416", marginBottom: 6 }}>
              {selectedVerein.name}
            </div>
            <div style={{ fontSize: 13, color: "#8B7355", marginBottom: 14 }}>
              {selectedVerein.email || "Keine E-Mail hinterlegt"}
            </div>

            <MessageThreadView
              threadId={thread.id}
              title=""
              emptyText={`Noch keine Nachrichten mit ${selectedVerein.name} vorhanden.`}
            />
          </>
        ) : (
          <div
            style={{
              minHeight: 280,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              color: "#8B7355",
              fontSize: 14,
            }}
          >
            Wähle links einen Verein aus, um den Nachrichtenverlauf zu öffnen.
          </div>
        )}
      </div>
    </div>
  );
}

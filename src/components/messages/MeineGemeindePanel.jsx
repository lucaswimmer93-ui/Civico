import React, { useEffect, useState } from "react";
import { Header, EmptyState } from "../ui";
import MessageThreadView from "./MessageThreadView";
import {
  getMeineGemeinde,
  getOrCreateVereinGemeindeThread,
} from "../../services/messages";

const cardStyle = {
  background: "#FAF7F2",
  borderRadius: 18,
  padding: 18,
  border: "1px solid #E6D9C2",
};

export default function MeineGemeindePanel({ onBack }) {
  const [gemeinde, setGemeinde] = useState(null);
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.reload();
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      try {
        const gemeindeData = await getMeineGemeinde();
        const threadData = await getOrCreateVereinGemeindeThread();

        setGemeinde(gemeindeData);
        setThread(threadData);
      } catch (err) {
        console.error("Fehler beim Laden von MeineGemeindePanel:", err);
        setError(err?.message || "Bereich konnte nicht geladen werden.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <div>
        <Header title="Meine Gemeinde" subtitle="Gemeinde-Bereich" onBack={handleBack} />
        <div style={{ padding: "0 16px 24px", color: "#8B7355", fontSize: 14 }}>
          Gemeinde-Bereich wird geladen …
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Header title="Meine Gemeinde" subtitle="Gemeinde-Bereich" onBack={handleBack} />
        <div style={{ padding: "0 16px 24px", color: "#B53A2D", fontSize: 14, fontWeight: 700 }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Meine Gemeinde"
        subtitle={gemeinde?.name || "Kommunaler Ansprechpartner"}
        onBack={handleBack}
      />

      <div style={{ padding: "0 16px 24px", display: "grid", gap: 14 }}>
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: "#8B7355", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
                Ansprechpartner
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#2C2416", marginBottom: 6 }}>
                {gemeinde?.name || "-"}
              </div>
              <div style={{ fontSize: 14, color: "#5C4A32", lineHeight: 1.7 }}>
                {gemeinde?.ansprechpartner_name ? `👤 ${gemeinde.ansprechpartner_name}` : "👤 Kein Ansprechpartner hinterlegt"}
                <br />
                {gemeinde?.telefon ? `📞 ${gemeinde.telefon}` : "📞 Keine Telefonnummer hinterlegt"}
                <br />
                {gemeinde?.email ? `✉️ ${gemeinde.email}` : "✉️ Keine E-Mail hinterlegt"}
              </div>
            </div>

            <div
              style={{
                minWidth: 220,
                background: "#F4EBDD",
                border: "1px solid #E6D9C2",
                borderRadius: 14,
                padding: 14,
              }}
            >
              <div style={{ fontSize: 12, color: "#8B7355", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
                Hinweis
              </div>
              <div style={{ fontSize: 14, color: "#5C4A32", lineHeight: 1.6 }}>
                Nutze diesen Bereich für Rückfragen, Abstimmungen und kurze Nachrichten an deine Gemeinde.
              </div>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#2C2416", marginBottom: 6 }}>
            Nachrichten an die Gemeinde
          </div>
          <div style={{ fontSize: 13, color: "#8B7355", marginBottom: 14 }}>
            Hier könnt ihr euch direkt mit eurer Gemeinde abstimmen.
          </div>

          {thread?.id ? (
            <MessageThreadView
              threadId={thread.id}
              title=""
              emptyText="Noch keine Nachrichten mit deiner Gemeinde vorhanden."
            />
          ) : (
            <EmptyState
              icon="💬"
              text="Kein Nachrichtenverlauf vorhanden"
              sub="Sobald der Thread bereit ist, erscheint er hier."
            />
          )}
        </div>
      </div>
    </div>
  );
}

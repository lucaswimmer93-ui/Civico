import React, { useEffect, useState } from "react";
import { EmptyState } from "../ui";
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

export default function MeineGemeindePanel({ onBack, onHome }) {
  const [gemeinde, setGemeinde] = useState(null);
  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div style={{ padding: "0 16px 24px", display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={onBack}
          style={{
            border: "none",
            background: "#EFE8DB",
            color: "#2C2416",
            borderRadius: 12,
            padding: "10px 14px",
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          ← Zurück
        </button>

        {typeof onHome === "function" && (
          <button
            onClick={onHome}
            style={{
              border: "none",
              background: "#2C2416",
              color: "#FAF7F2",
              borderRadius: 12,
              padding: "10px 14px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            🏠 Home
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ color: "#8B7355", fontSize: 14 }}>
          Gemeinde-Bereich wird geladen …
        </div>
      ) : error ? (
        <div style={{ color: "#B53A2D", fontSize: 14, fontWeight: 700 }}>
          {error}
        </div>
      ) : (
        <>
          <div style={cardStyle}>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#2C2416",
                marginBottom: 12,
              }}
            >
              Meine Gemeinde
            </div>

            <div
              style={{
                display: "grid",
                gap: 8,
                color: "#5C4A32",
                fontSize: 14,
              }}
            >
              <div>
                <strong>Name:</strong> {gemeinde?.name || "-"}
              </div>
              <div>
                <strong>Ansprechpartner:</strong>{" "}
                {gemeinde?.ansprechpartner_name || "-"}
              </div>
              <div>
                <strong>Telefon:</strong> {gemeinde?.telefon || "-"}
              </div>
              <div>
                <strong>E-Mail:</strong> {gemeinde?.email || "-"}
              </div>
            </div>
          </div>

          <div style={cardStyle}>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#2C2416",
                marginBottom: 6,
              }}
            >
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
        </>
      )}
    </div>
  );
}

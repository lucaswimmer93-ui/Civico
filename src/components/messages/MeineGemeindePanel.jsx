import React, { useEffect, useState } from "react";
import MessageThreadView from "./MessageThreadView";
import {
  getMeineGemeinde,
  getOrCreateVereinGemeindeThread,
} from "../../services/messages";

export default function MeineGemeindePanel() {
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

  if (loading) {
    return (
      <div style={{ padding: "0 16px 24px", color: "#8B7355", fontSize: 14 }}>
        Gemeinde-Bereich wird geladen …
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "0 16px 24px", color: "#B53A2D", fontSize: 14, fontWeight: 700 }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ padding: "0 16px 24px", display: "grid", gap: 14 }}>
      <div
        style={{
          background: "#FAF7F2",
          borderRadius: 18,
          padding: 18,
          border: "1px solid #E6D9C2",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, color: "#2C2416", marginBottom: 12 }}>
          Meine Gemeinde
        </div>

        <div style={{ display: "grid", gap: 8, color: "#5C4A32", fontSize: 14 }}>
          <div>
            <strong>Name:</strong> {gemeinde?.name || "-"}
          </div>
          <div>
            <strong>Ansprechpartner:</strong> {gemeinde?.ansprechpartner_name || "-"}
          </div>
          <div>
            <strong>Telefon:</strong> {gemeinde?.telefon || "-"}
          </div>
          <div>
            <strong>E-Mail:</strong> {gemeinde?.email || "-"}
          </div>
        </div>
      </div>

      <MessageThreadView
        threadId={thread?.id}
        title="Nachrichten an die Gemeinde"
        emptyText="Noch keine Nachrichten mit deiner Gemeinde vorhanden."
      />
    </div>
  );
}
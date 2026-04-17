import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../core/shared";
import {
  getThreadMessages,
  sendMessage,
  markThreadAsRead,
  getAuthUserOrThrow,
  getThreadReadMeta,
} from "../../services/messages";

function formatTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function MessageThreadView({
  threadId,
  title = "Chat",
  emptyText = "Noch keine Nachrichten vorhanden.",
  className = "",
  height = 360,
  onMessageSent,
  onThreadRead,
}) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [currentUserId, setCurrentUserId] = useState(null);
  const [otherLastReadAt, setOtherLastReadAt] = useState(null);
  const scrollRef = useRef(null);

  const hasThread = useMemo(() => Boolean(threadId), [threadId]);

  async function loadCurrentUser() {
    const user = await getAuthUserOrThrow();
    setCurrentUserId(user?.id || null);
    return user?.id || null;
  }

  async function loadReadMeta(nextUserId = null) {
    if (!threadId) return;
    try {
      const meta = await getThreadReadMeta(threadId, nextUserId || currentUserId || null);
      setOtherLastReadAt(meta?.otherLastReadAt || null);
      if (meta?.currentUserId && meta.currentUserId !== currentUserId) {
        setCurrentUserId(meta.currentUserId);
      }
    } catch (err) {
      console.error("Fehler beim Laden des Read-Status:", err);
    }
  }

  async function loadMessages() {
    if (!threadId) return;

    setLoading(true);
    setError("");

    try {
      const userId = currentUserId || (await loadCurrentUser());
      const data = await getThreadMessages(threadId);
      setMessages(data || []);

      loadReadMeta(userId);
      markThreadAsRead(threadId)
        .then(() => {
          if (typeof onThreadRead === "function") {
            onThreadRead(threadId);
          }
          loadReadMeta(userId);
        })
        .catch((err) => {
          console.error("Read-Status konnte nicht gesetzt werden:", err);
        });
    } catch (err) {
      console.error("Fehler beim Laden der Nachrichten:", err);
      setError(err?.message || "Nachrichten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCurrentUser().catch((err) => {
      console.error("Fehler beim Laden des aktuellen Users:", err);
    });
  }, []);

  useEffect(() => {
    loadMessages();
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return;

    const channel = supabase
      .channel(`messages-thread-${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `thread_id=eq.${threadId}`,
        },
        async () => {
          try {
            const data = await getThreadMessages(threadId);
            setMessages(data || []);
            loadReadMeta();
            const latest = (data || [])[data.length - 1];
            if (latest?.sender_user_id && latest.sender_user_id !== currentUserId) {
              markThreadAsRead(threadId)
                .then(() => {
                  if (typeof onThreadRead === "function") {
                    onThreadRead(threadId);
                  }
                  loadReadMeta();
                })
                .catch((err) => console.error("Realtime Read-Status fehlgeschlagen:", err));
            }
          } catch (err) {
            console.error("Realtime-Update fehlgeschlagen:", err);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_read_status",
          filter: `thread_id=eq.${threadId}`,
        },
        async () => {
          loadReadMeta();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, currentUserId]);


  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function handleSend(event) {
    event.preventDefault();

    if (!threadId || sending) return;
    if (!draft.trim()) return;

    const body = draft.trim();
    const tempId = `temp-${Date.now()}`;

    setSending(true);
    setError("");
    setDraft("");
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        thread_id: threadId,
        sender_user_id: currentUserId,
        body,
        created_at: new Date().toISOString(),
        _localStatus: "sending",
      },
    ]);

    try {
      const newMessage = await sendMessage(threadId, body);
      setMessages((prev) => prev.map((message) => (
        message.id === tempId
          ? { ...newMessage, _localStatus: "sent" }
          : message
      )));

      if (typeof onMessageSent === "function") {
        onMessageSent(newMessage);
      }
    } catch (err) {
      console.error("Fehler beim Senden:", err);
      setMessages((prev) => prev.filter((message) => message.id !== tempId));
      setDraft(body);
      setError(err?.message || "Nachricht konnte nicht gesendet werden.");
    } finally {
      setSending(false);
    }
  }

  function isOwnMessage(message) {
    return currentUserId && message?.sender_user_id === currentUserId;
  }


  function getOwnMessageStatus(message) {
    if (!message) return "";

    if (message._localStatus === "sending") return "Wird gesendet";
    const createdAt = message?.created_at ? new Date(message.created_at).getTime() : 0;

    if (otherLastReadAt && createdAt && otherLastReadAt >= createdAt) {
      return "Gelesen";
    }

    return "Gesendet";
  }

  if (!hasThread) {
    return (
      <div
        className={className}
        style={{
          background: "#FFFDFC",
          border: "1px solid #E0D8C8",
          borderRadius: 14,
          padding: 16,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: "bold", color: "#2C2416", marginBottom: 6 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: "#8B7355" }}>
          Es ist noch kein Chat verfügbar.
        </div>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        background: "#FFFDFC",
        border: "1px solid #E0D8C8",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid #F0EBE0",
          background: "#FAF7F2",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: "bold", color: "#2C2416" }}>
          {title}
        </div>
      </div>

      {error ? (
        <div
          style={{
            margin: "12px 12px 0",
            padding: "10px 12px",
            borderRadius: 10,
            background: "#FFF4F2",
            border: "1px solid #F0C9C3",
            color: "#B53A2D",
            fontSize: 12,
            fontWeight: "bold",
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        style={{
          height,
          overflowY: "auto",
          padding: 12,
          background: "#F7F3EC",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {loading ? (
          <div style={{ fontSize: 13, color: "#8B7355" }}>
            Nachrichten werden geladen …
          </div>
        ) : messages.length === 0 ? (
          <div style={{ fontSize: 13, color: "#8B7355" }}>{emptyText}</div>
        ) : (
          messages.map((message) => {
            const own = isOwnMessage(message);

            return (
              <div
                key={message.id}
                style={{
                  display: "flex",
                  justifyContent: own ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "78%",
                    padding: "10px 12px",
                    borderRadius: 16,
                    background: own ? "#2C2416" : "#FFFFFF",
                    color: own ? "#FAF7F2" : "#2C2416",
                    border: own ? "none" : "1px solid #E0D8C8",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {message.body}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 10,
                      color: own ? "#D9CDB7" : "#8B7355",
                      textAlign: "right",
                    }}
                  >
                    {formatTime(message.created_at)}{own ? ` · ${getOwnMessageStatus(message)}` : ""}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={handleSend}
        style={{
          borderTop: "1px solid #F0EBE0",
          padding: 12,
          background: "#FAF7F2",
        }}
      >
        <div style={{ fontSize: 12, color: "#8B7355", marginBottom: 6 }}>
          Neue Nachricht
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Nachricht eingeben …"
          rows={3}
          disabled={sending}
          style={{
            width: "100%",
            resize: "none",
            borderRadius: 12,
            border: "1px solid #D8CFBF",
            padding: "10px 12px",
            fontFamily: "inherit",
            fontSize: 14,
            color: "#2C2416",
            boxSizing: "border-box",
            outline: "none",
            background: "#FFFFFF",
          }}
        />
        <div
          style={{
            marginTop: 10,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "none",
              background: sending || !draft.trim() ? "#CBBFAE" : "#2C2416",
              color: "#FAF7F2",
              fontSize: 13,
              fontWeight: "bold",
              cursor: sending || !draft.trim() ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {sending ? "Wird gesendet …" : "Nachricht senden"}
          </button>
        </div>
      </form>
    </div>
  );
}

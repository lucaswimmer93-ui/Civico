import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getThreadMessages,
  sendMessage,
  markThreadAsRead,
} from "../../services/messages";

function formatDateTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("de-DE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function roleLabel(role) {
  switch (role) {
    case "verein":
      return "Verein";
    case "gemeinde":
      return "Gemeinde";
    case "admin":
      return "Support";
    default:
      return role || "Unbekannt";
  }
}

export default function MessageThreadView({
  threadId,
  title = "Nachrichten",
  emptyText = "Noch keine Nachrichten vorhanden.",
  className = "",
  height = 420,
  onMessageSent,
}) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  const hasThread = useMemo(() => Boolean(threadId), [threadId]);

  async function loadMessages() {
    if (!threadId) return;

    setLoading(true);
    setError("");

    try {
      const data = await getThreadMessages(threadId);
      setMessages(data);
      await markThreadAsRead(threadId);
    } catch (err) {
      console.error("Fehler beim Laden der Nachrichten:", err);
      setError(err?.message || "Nachrichten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMessages();
  }, [threadId]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();

    if (!threadId || sending) return;
    if (!draft.trim()) return;

    setSending(true);
    setError("");

    try {
      const newMessage = await sendMessage(threadId, draft);
      setMessages((prev) => [...prev, newMessage]);
      setDraft("");

      if (typeof onMessageSent === "function") {
        onMessageSent(newMessage);
      }
    } catch (err) {
      console.error("Fehler beim Senden der Nachricht:", err);
      setError(err?.message || "Nachricht konnte nicht gesendet werden.");
    } finally {
      setSending(false);
    }
  }

  if (!hasThread) {
    return (
      <div
        className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}
      >
        <h3 className="mb-2 text-lg font-semibold">{title}</h3>
        <p className="text-sm text-gray-500">
          Es ist noch kein Nachrichtenverlauf verfügbar.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white shadow-sm ${className}`}
    >
      <div className="border-b border-gray-100 px-4 py-3">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>

      {error ? (
        <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="space-y-3 overflow-y-auto px-4 py-4"
        style={{ height }}
      >
        {loading ? (
          <div className="text-sm text-gray-500">Nachrichten werden geladen …</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-gray-500">{emptyText}</div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3"
            >
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-gray-900">
                  {roleLabel(message.sender_role)}
                </span>
                <span className="text-xs text-gray-500">
                  {formatDateTime(message.created_at)}
                </span>
              </div>

              <p className="whitespace-pre-wrap text-sm leading-6 text-gray-800">
                {message.body}
              </p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSend} className="border-t border-gray-100 p-4">
        <label htmlFor="message-draft" className="mb-2 block text-sm font-medium text-gray-700">
          Neue Nachricht
        </label>

        <textarea
          id="message-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Nachricht eingeben …"
          rows={4}
          disabled={sending}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500"
        />

        <div className="mt-3 flex items-center justify-end">
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? "Wird gesendet …" : "Nachricht senden"}
          </button>
        </div>
      </form>
    </div>
  );
}

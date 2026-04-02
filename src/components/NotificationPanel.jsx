import React from "react";

function formatDate(dateString) {
  if (!dateString) return "";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(dateString));
  } catch {
    return dateString;
  }
}

function getMetaLabel(notification) {
  if (notification?.payload?.verein_name) return notification.payload.verein_name;
  if (notification?.payload?.kategorie_name) return notification.payload.kategorie_name;
  return null;
}

export default function NotificationPanel({
  notifications = [],
  loading = false,
  onMarkAsRead,
  onMarkAllAsRead,
}) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "420px",
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: "16px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid #f0f0f0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <strong>Benachrichtigungen</strong>

        <button
          type="button"
          onClick={onMarkAllAsRead}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Alle gelesen
        </button>
      </div>

      <div style={{ maxHeight: "500px", overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: "16px" }}>Lade Benachrichtigungen…</div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: "16px", color: "#666" }}>
            Noch keine Benachrichtigungen vorhanden.
          </div>
        ) : (
          notifications.map((notification) => {
            const unread = !notification.read_at && notification.gelesen !== true;
            const metaLabel = getMetaLabel(notification);

            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => unread && onMarkAsRead?.(notification.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "14px 16px",
                  border: "none",
                  borderBottom: "1px solid #f7f7f7",
                  background: unread ? "#f8fbff" : "#fff",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "10px",
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: unread ? 700 : 600,
                        marginBottom: "4px",
                      }}
                    >
                      {notification.titel || "Benachrichtigung"}
                    </div>

                    <div
                      style={{
                        fontSize: "14px",
                        color: "#444",
                        marginBottom: "6px",
                        lineHeight: 1.4,
                      }}
                    >
                      {notification.text || ""}
                    </div>

                    {metaLabel && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#888",
                          marginBottom: "4px",
                        }}
                      >
                        {metaLabel}
                      </div>
                    )}

                    <div
                      style={{
                        fontSize: "12px",
                        color: "#888",
                      }}
                    >
                      {formatDate(notification.created_at)}
                    </div>
                  </div>

                  {unread && (
                    <span
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "999px",
                        background: "#2f80ed",
                        marginTop: "6px",
                        flexShrink: 0,
                      }}
                    />
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

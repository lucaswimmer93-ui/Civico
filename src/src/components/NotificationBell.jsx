import React from "react";

export default function NotificationBell({ unreadCount = 0, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Benachrichtigungen öffnen"
      style={{
        position: "relative",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontSize: "22px",
        lineHeight: 1,
      }}
    >
      🔔

      {unreadCount > 0 && (
        <span
          style={{
            position: "absolute",
            top: "-6px",
            right: "-8px",
            minWidth: "18px",
            height: "18px",
            borderRadius: "999px",
            background: "#e53935",
            color: "#fff",
            fontSize: "11px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 5px",
            fontWeight: 700,
          }}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}

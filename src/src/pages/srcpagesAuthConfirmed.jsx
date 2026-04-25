import React from "react";

export default function AuthConfirmed() {
  const goToLogin = () => {
    window.location.href = "/login";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(160deg, #1A1208 0%, #2C2416 60%, #3D3020 100%)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "#F4F0E8",
          padding: 40,
          borderRadius: 20,
          maxWidth: 420,
          width: "100%",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 50, marginBottom: 16 }}>✅</div>

        <h2 style={{ marginBottom: 10, color: "#2C2416" }}>
          E-Mail bestätigt
        </h2>

        <p style={{ color: "#8B7355", fontSize: 14, marginBottom: 24 }}>
          Dein Konto wurde erfolgreich verifiziert.
          <br />
          Du kannst dich jetzt anmelden.
        </p>

        <button
          onClick={goToLogin}
          style={{
            padding: "12px 24px",
            borderRadius: 12,
            border: "none",
            background: "#2C2416",
            color: "#FAF7F2",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Zum Login
        </button>
      </div>
    </div>
  );
}
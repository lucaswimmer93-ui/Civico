import { useEffect } from "react";
import { supabase } from "../core/shared";

export default function AuthCallbackScreen() {
  useEffect(() => {
    const handleAuth = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hash);

        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        }

        // Wichtig:
        // In deiner App wird /auth/confirmed bereits separat für normale
        // E-Mail-Bestätigungen genutzt.
        // /auth/callback ist damit nur noch für Invite / Passwort-Reset da.
        // Deshalb hier IMMER auf /set-password weiterleiten.
        window.location.replace("/set-password");
      } catch (err) {
        console.error("Auth Fehler:", err);
        alert("Link ungültig oder abgelaufen");
        window.location.replace("/");
      }
    };

    handleAuth();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #1A1208 0%, #2C2416 60%, #3D3020 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#F4F0E8",
          borderRadius: 24,
          padding: "36px 28px",
          textAlign: "center",
          boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{ fontSize: 52, marginBottom: 12 }}>🔄</div>
        <div style={{ fontSize: 24, fontWeight: "bold", color: "#2C2416", marginBottom: 10 }}>
          Authentifizierung läuft
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.6, color: "#8B7355" }}>
          Bitte kurz warten ...
        </div>
      </div>
    </div>
  );
}

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
        const type = url.searchParams.get("type") || hashParams.get("type");

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

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error("Keine Session aus dem Auth-Link hergestellt.");
        }

        if (type === "recovery" || type === "invite") {
          window.location.replace("/set-password");
          return;
        }

        window.location.replace("/");
      } catch (error) {
        console.error("Auth callback failed:", error);
        window.alert("Link ungültig oder abgelaufen.");
        window.location.replace("/");
      }
    };

    handleAuth();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, #1A1208 0%, #2C2416 60%, #3D3020 100%)",
        color: "#F4F0E8",
        fontFamily: "inherit",
      }}
    >
      Authentifizierung läuft ...
    </div>
  );
}

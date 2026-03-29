import { useEffect } from "react";
import { supabase } from "../core/shared";

export default function AuthCallbackScreen() {
  useEffect(() => {
    const handleAuth = async () => {
      try {
        const url = new URL(window.location.href);

        const code = url.searchParams.get("code");

        // 🔥 HASH auslesen (WICHTIG)
        const hash = window.location.hash.replace("#", "");
        const hashParams = new URLSearchParams(hash);

        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");
        const type = hashParams.get("type"); // 🔥 HIER kommt recovery / invite

        console.log("TYPE:", type);

        // PKCE Flow
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        // HASH Flow
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) throw error;
        }

        // 🔥 ENTSCHEIDUNG
        if (type === "recovery" || type === "invite") {
          window.location.replace("/set-password");
        } else {
          window.location.replace("/");
        }
      } catch (err) {
        console.error("Auth Fehler:", err);
        alert("Link ungültig oder abgelaufen");
        window.location.replace("/");
      }
    };

    handleAuth();
  }, []);

  return <div style={{ padding: 40 }}>Authentifizierung läuft...</div>;
}

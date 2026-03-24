import React, { useState, useEffect } from 'react';
import { supabase, T, KATEGORIEN, SKILLS, getSkillLabel, getKat, getMedaille, getNextMedaille, getMedailleName, IMPRESSUM_TEXT, DATENSCHUTZ_TEXT, AGB_TEXT, formatDate, getGemeindeByPlz, isKlarname, isTerminNochNichtGestartet, isTerminAktuell } from '../core/shared';
import { Header, StelleCard, VereineListe, BottomBar, DatenschutzBox, Input, BigButton, Chip, InfoChip, SectionLabel, RoleCard, EmptyState, ErrorMsg } from '../components/ui';

function LoginScreen({
  initialMode = null,
  onLogin,
  onBack,
  showToast,
  onImpressum,
  onDatenschutz,
  onAgb,
}) {
  const [mode, setMode] = useState("auswahl");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [ort, setOrt] = useState("");
  const [plz, setPlz] = useState("");
  const [regStrasse, setRegStrasse] = useState("");
  const [hausnummer, setHausnummer] = useState("");
  const [kontaktEmail, setKontaktEmailReg] = useState("");
  const [regTelefon, setRegTelefon] = useState("");
  const [regWebsite, setRegWebsite] = useState("");
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [sprachen, setSprachen] = useState("");
  const [datenschutz, setDatenschutz] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const lang = "de";

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
      setError("");
    } else {
      setMode("auswahl");
    }
  }, [initialMode]);

  const handleLogin = async (type) => {
    if (!email || !password) {
      setError("Bitte Email und Passwort eingeben.");
      return;
    }
    setLoading(true);
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setLoading(false);
      setError("Email oder Passwort falsch. Email zuerst bestätigen!");
      return;
    }
    const table = type === "freiwilliger" ? "freiwillige" : type === "verein" ? "vereine" : type === "gemeinde" ? "gemeinden" : "admins";
    const { data: profil } = await supabase
      .from(table)
      .select("*")
      .eq("auth_id", authData.user.id)
      .single();
    setLoading(false);
    if (!profil) {
      setError("Profil nicht gefunden.");
      return;
    }
    onLogin(type, profil, profil.gemeinde_id);
  };

  const handleRegisterFreiwilliger = async () => {
    if (!name || !email || !password) {
      setError("Bitte alle Felder ausfüllen.");
      return;
    }
    if (!isKlarname(name)) {
      setError("Bitte Vor- und Nachname eingeben (z.B. Max Mustermann).");
      return;
    }
    if (password.length < 6) {
      setError("Passwort muss mindestens 6 Zeichen haben.");
      return;
    }
    if (!datenschutz) {
      setError("Bitte Datenschutzerklärung und AGB akzeptieren.");
      return;
    }
    setLoading(true);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, type: "freiwilliger" } },
    });
    if (authError) {
      setLoading(false);
      setError("Email bereits registriert.");
      return;
    }
    const gemeinde_id = await getGemeindeByPlz(plz);
    if (!gemeinde_id) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Für diese PLZ wurde noch keine Gemeinde gefunden.");
      return;
    }
    await supabase
      .from("freiwillige")
      .insert({
        auth_id: authData.user.id,
        gemeinde_id,
        name,
        email,
        plz,
        umkreis: 25,
        punkte: 0,
        aktionen: 0,
        skills: selectedSkills,
        sprachen,
      });
    setLoading(false);
    setEmailSent(true);
  };

  const handleRegisterVerein = async () => {
    if (
      !orgName ||
      !email ||
      !ort ||
      !plz ||
      !regStrasse ||
      !kontaktEmail ||
      !password
    ) {
      setError("Bitte alle Pflichtfelder ausfüllen.");
      return;
    }
    if (password.length < 6) {
      setError("Passwort muss mindestens 6 Zeichen haben.");
      return;
    }
    if (!datenschutz) {
      setError("Bitte Datenschutzerklärung und AGB akzeptieren.");
      return;
    }
    setLoading(true);
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: orgName, type: "verein" } },
    });
    if (authError) {
      setLoading(false);
      setError("Email bereits registriert.");
      return;
    }
    const gemeinde_id = await getGemeindeByPlz(plz);
    if (!gemeinde_id) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Für diese PLZ wurde noch keine Gemeinde gefunden.");
      return;
    }
    await supabase
      .from("vereine")
      .insert({
        auth_id: authData.user.id,
        gemeinde_id,
        name: orgName,
        email,
        ort,
        plz,
        strasse: regStrasse + " " + hausnummer,
        kontakt_email: kontaktEmail,
        telefon: regTelefon || null,
        website: regWebsite || null,
        logo: "🏢",
        verifiziert: false,
      });
    setLoading(false);
    setEmailSent(true);
  };

  const handleReset = async () => {
    if (!email) {
      setError("Bitte Email eingeben.");
      return;
    }
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://mycivico.de/reset",
    });
    setLoading(false);
    showToast("✓ Reset-Link gesendet!");
    setResetMode(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(160deg, #1A1208 0%, #2C2416 60%, #3D3020 100%)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "48px 28px 24px", color: "#F4F0E8" }}>
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: "#8B7355",
            fontSize: 13,
            cursor: "pointer",
            padding: "0 0 16px",
            fontFamily: "inherit",
          }}
        >
          ← Zurück
        </button>
        <div style={{ fontSize: 40, fontWeight: "bold", letterSpacing: 3 }}>
          Civico
        </div>
        <div style={{ fontSize: 13, color: "#8B7355", marginTop: 6 }}>
          Wir machen Ehrenamt.
        </div>
      </div>
      <div
        style={{
          flex: 1,
          background: "#F4F0E8",
          borderRadius: "28px 28px 0 0",
          padding: "28px 24px 40px",
          overflowY: "auto",
        }}
      >
        {emailSent && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
            <div
              style={{
                fontSize: 20,
                fontWeight: "bold",
                color: "#2C2416",
                marginBottom: 10,
              }}
            >
              Email bestätigen!
            </div>
            <div style={{ fontSize: 14, color: "#8B7355", lineHeight: 1.7 }}>
              Wir haben dir eine Bestätigungsmail geschickt.
              <br />
              Bitte klick auf den Link bevor du dich anmeldest.
            </div>
            <button
              onClick={() => {
                setEmailSent(false);
                setMode("auswahl");
              }}
              style={{
                marginTop: 24,
                padding: "12px 28px",
                borderRadius: 12,
                border: "none",
                background: "#2C2416",
                color: "#FAF7F2",
                fontSize: 14,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              Zurück zum Login
            </button>
          </div>
        )}
        {!emailSent && resetMode && (
          <div>
            <button
              onClick={() => {
                setResetMode(false);
                setError("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#8B7355",
                fontSize: 13,
                cursor: "pointer",
                padding: "0 0 16px",
                fontFamily: "inherit",
              }}
            >
              ← Zurück
            </button>
            <div
              style={{
                fontSize: 18,
                fontWeight: "bold",
                marginBottom: 20,
                color: "#2C2416",
              }}
            >
              🔑 Passwort vergessen
            </div>
            <Input
              label="Email"
              value={email}
              onChange={setEmail}
              type="email"
              placeholder="deine@email.de"
            />
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <BigButton onClick={handleReset} disabled={loading}>
              {loading ? "Senden..." : "Reset-Link senden"}
            </BigButton>
          </div>
        )}
        {!emailSent && !resetMode && mode === "auswahl" && (
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: "bold",
                marginBottom: 6,
                color: "#2C2416",
              }}
            >
              Willkommen!
            </div>
            <div style={{ fontSize: 13, color: "#8B7355", marginBottom: 24 }}>
              Wie möchtest du die App nutzen?
            </div>
            <RoleCard
              icon="🙋"
              title="Ich bin Freiwilliger"
              sub="Ehrenamtsstellen entdecken & anmelden"
              onClick={() => setMode("freiwilliger")}
            />
            <RoleCard
              icon="🏢"
              title="Ich bin ein Verein"
              sub="Stellen ausschreiben & Freiwillige finden"
              onClick={() => setMode("verein")}
            />
            <RoleCard
              icon="🏛️"
              title="Ich bin eine Gemeinde"
              sub="Organisationen verwalten & eigene Stellen veröffentlichen"
              onClick={() => setMode("gemeinde")}
            />
          </div>
        )}
        {!emailSent &&
          !resetMode &&
          (mode === "freiwilliger" || mode === "verein" || mode === "gemeinde" || mode === "admin") && (
            <div>
              <button
                onClick={() => {
                  setMode("auswahl");
                  setError("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#8B7355",
                  fontSize: 13,
                  cursor: "pointer",
                  padding: "0 0 16px",
                  fontFamily: "inherit",
                }}
              >
                ← Zurück
              </button>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: "bold",
                  marginBottom: 20,
                  color: "#2C2416",
                }}
              >
                {mode === "freiwilliger" ? "🙋 Anmelden" : mode === "verein" ? "🏢 Anmelden" : mode === "gemeinde" ? "🏛️ Gemeinde-Anmeldung" : "⚙️ Admin-Anmeldung"}
              </div>
              <Input
                label="Email"
                value={email}
                onChange={setEmail}
                type="email"
                placeholder="deine@email.de"
              />
              <Input
                label="Passwort"
                value={password}
                onChange={setPassword}
                type="password"
                placeholder="••••••"
              />
              {error && <ErrorMsg>{error}</ErrorMsg>}
              <BigButton onClick={() => handleLogin(mode)} disabled={loading}>
                {loading ? "Laden..." : "Anmelden"}
              </BigButton>
              <div style={{ textAlign: "center", marginTop: 12 }}>
                <button
                  onClick={() => {
                    setResetMode(true);
                    setError("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#8B7355",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textDecoration: "underline",
                  }}
                >
                  Passwort vergessen?
                </button>
              </div>
              {(mode === "freiwilliger" || mode === "verein") && (
                <div style={{ textAlign: "center", marginTop: 8 }}>
                  <button
                    onClick={() =>
                      setMode(
                        mode === "freiwilliger" ? "register-f" : "register-v"
                      )
                    }
                    style={{
                      background: "none",
                      border: "none",
                      color: "#8B7355",
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textDecoration: "underline",
                    }}
                  >
                    Noch kein Konto? Registrieren
                  </button>
                </div>
              )}
            </div>
          )}
        {!emailSent && !resetMode && mode === "register-f" && (
          <div>
            <button
              onClick={() => {
                setMode("freiwilliger");
                setError("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#8B7355",
                fontSize: 13,
                cursor: "pointer",
                padding: "0 0 16px",
                fontFamily: "inherit",
              }}
            >
              ← Zurück
            </button>
            <div
              style={{
                fontSize: 18,
                fontWeight: "bold",
                marginBottom: 20,
                color: "#2C2416",
              }}
            >
              🙋 Registrieren
            </div>
            <Input
              label="Vollständiger Name (Pflicht)"
              value={name}
              onChange={setName}
              placeholder="Max Mustermann"
            />
            <Input
              label="PLZ deines Wohnorts"
              value={plz}
              onChange={setPlz}
              placeholder="z.B. 64683"
            />
            <Input
              label="Email"
              value={email}
              onChange={setEmail}
              type="email"
              placeholder="deine@email.de"
            />
            <Input
              label="Passwort (min. 6 Zeichen)"
              value={password}
              onChange={setPassword}
              type="password"
              placeholder="••••••"
            />
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 12,
                  color: "#8B7355",
                  marginBottom: 8,
                  letterSpacing: 0.5,
                }}
              >
                FÄHIGKEITEN (optional)
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {SKILLS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setSelectedSkills((prev) =>
                        prev.includes(s.id)
                          ? prev.filter((x) => x !== s.id)
                          : [...prev, s.id]
                      )
                    }
                    style={{
                      padding: "7px 12px",
                      borderRadius: 20,
                      border: "none",
                      cursor: "pointer",
                      background: selectedSkills.includes(s.id)
                        ? "#2C2416"
                        : "#EDE8DE",
                      color: selectedSkills.includes(s.id)
                        ? "#FAF7F2"
                        : "#8B7355",
                      fontSize: 12,
                      fontFamily: "inherit",
                    }}
                  >
                    {s.icon} {getSkillLabel(s, lang)}
                  </button>
                ))}
              </div>
            </div>
            <Input
              label="🗣️ Sprachen (optional)"
              value={sprachen}
              onChange={setSprachen}
              placeholder="z.B. Englisch, Türkisch"
            />
            <DatenschutzBox
              datenschutz={datenschutz}
              setDatenschutz={setDatenschutz}
              onDatenschutz={onDatenschutz}
              onAgb={onAgb}
            />
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <BigButton
              onClick={handleRegisterFreiwilliger}
              disabled={loading}
              green
            >
              {loading ? "Laden..." : "Konto erstellen"}
            </BigButton>
          </div>
        )}
        {!emailSent && !resetMode && mode === "register-v" && (
          <div>
            <button
              onClick={() => {
                setMode("verein");
                setError("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#8B7355",
                fontSize: 13,
                cursor: "pointer",
                padding: "0 0 16px",
                fontFamily: "inherit",
              }}
            >
              ← Zurück
            </button>
            <div
              style={{
                fontSize: 18,
                fontWeight: "bold",
                marginBottom: 4,
                color: "#2C2416",
              }}
            >
              🏢 Verein registrieren
            </div>
            <div style={{ fontSize: 12, color: "#8B7355", marginBottom: 20 }}>
              Dein Verein wird nach Prüfung freigeschaltet.
            </div>
            <Input
              label="Name des Vereins *"
              value={orgName}
              onChange={setOrgName}
              placeholder="z.B. NABU Einhausen"
            />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 2 }}>
                <Input
                  label="Straße *"
                  value={regStrasse}
                  onChange={setRegStrasse}
                  placeholder="Hauptstraße"
                />
              </div>
              <div style={{ flex: 1 }}>
                <Input
                  label="Nr. *"
                  value={hausnummer}
                  onChange={setHausnummer}
                  placeholder="12"
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <Input
                  label="PLZ *"
                  value={plz}
                  onChange={setPlz}
                  placeholder="64683"
                />
              </div>
              <div style={{ flex: 2 }}>
                <Input
                  label="Ort *"
                  value={ort}
                  onChange={setOrt}
                  placeholder="Einhausen"
                />
              </div>
            </div>
            <Input
              label="Öffentliche Kontakt-Email *"
              value={kontaktEmail}
              onChange={setKontaktEmailReg}
              type="email"
              placeholder="kontakt@verein.de"
            />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <Input
                  label="Telefon (optional)"
                  value={regTelefon}
                  onChange={setRegTelefon}
                  placeholder="+49 6251 ..."
                />
              </div>
              <div style={{ flex: 1 }}>
                <Input
                  label="Website (optional)"
                  value={regWebsite}
                  onChange={setRegWebsite}
                  placeholder="www.verein.de"
                />
              </div>
            </div>
            <Input
              label="Login-Email *"
              value={email}
              onChange={setEmail}
              type="email"
              placeholder="login@verein.de"
            />
            <Input
              label="Passwort (min. 6 Zeichen)"
              value={password}
              onChange={setPassword}
              type="password"
              placeholder="••••••"
            />
            <DatenschutzBox
              datenschutz={datenschutz}
              setDatenschutz={setDatenschutz}
              onDatenschutz={onDatenschutz}
              onAgb={onAgb}
            />
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <BigButton onClick={handleRegisterVerein} disabled={loading} green>
              {loading ? "Laden..." : "Antrag stellen"}
            </BigButton>
          </div>
        )}
      </div>
    </div>
  );
}

export default LoginScreen;

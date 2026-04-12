import React, { useState, useEffect } from 'react';
import { T, KATEGORIEN, SKILLS, getSkillLabel, getKat, getMedaille, getNextMedaille, getMedailleName, IMPRESSUM_TEXT, DATENSCHUTZ_TEXT, AGB_TEXT, formatDate, isTerminNochNichtGestartet, isTerminAktuell, supabase } from '../core/shared';

function Header({ title, subtitle, onLogout, onBack }) {
  return (
    <div
      style={{
        background: "linear-gradient(160deg, #1A1208, #2C2416)",
        padding: "20px 20px 16px",
        color: "#F4F0E8",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              color: "#8B7355",
              fontSize: 18,
              cursor: "pointer",
            }}
          >
            ←
          </button>
        )}
        <div>
          <div style={{ fontSize: 18, fontWeight: "bold" }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 12, color: "#8B7355" }}>{subtitle}</div>
          )}
        </div>
      </div>
      {onLogout && (
        <button
          onClick={onLogout}
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "none",
            color: "#8B7355",
            fontSize: 12,
            padding: "6px 12px",
            borderRadius: 20,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Abmelden
        </button>
      )}
    </div>
  );
}

function StelleCard({ stelle, verein, onClick, user }) {
  const kat = getKat(stelle.kategorie);
  const jetzt = new Date();
  const freieTermine = (stelle.termine || []).filter(
    (t) => (t.freie_plaetze || 0) > 0 && isTerminAktuell(t)
  ).length;
  return (
    <div
      onClick={onClick}
      style={{
        background: "#FAF7F2",
        borderRadius: 14,
        padding: "14px",
        marginBottom: 10,
        border: "1px solid #E0D8C8",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {stelle.dringend && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            background: "#E85C5C",
            color: "#fff",
            fontSize: 9,
            padding: "3px 10px",
            borderRadius: "0 14px 0 8px",
            letterSpacing: 1,
            fontWeight: "bold",
          }}
        >
          DRINGEND
        </div>
      )}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: kat?.color + "22",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          {kat?.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: "bold", fontSize: 14, marginBottom: 2 }}>
            {stelle.titel}
          </div>
          <div style={{ color: "#8B7355", fontSize: 12, marginBottom: 6 }}>
            {verein?.name}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 10,
                color: "#8B7355",
                background: "#EDE8DE",
                padding: "2px 7px",
                borderRadius: 5,
              }}
            >
              📍 {stelle.ort}
            </span>
            <span
              style={{
                fontSize: 10,
                color: "#8B7355",
                background: "#EDE8DE",
                padding: "2px 7px",
                borderRadius: 5,
              }}
            >
              ⏱ {stelle.aufwand}
            </span>
            <span
              style={{
                fontSize: 10,
                color: stelle.typ === "dauerhaft" ? "#5B9BD5" : "#3A7D44",
                background:
                  stelle.typ === "dauerhaft" ? "#5B9BD518" : "#3A7D4418",
                padding: "2px 7px",
                borderRadius: 5,
              }}
            >
              {stelle.typ === "dauerhaft"
                ? "🔄 Dauerhaft"
                : `📅 ${freieTermine} Termin${
                    freieTermine !== 1 ? "e" : ""
                  } frei`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function VereineListe({
  stellen,
  user,
  follows,
  onToggleFollow,
  onVereinClick,
  gemeindeId,
}) {
  // Unique Vereine aus Stellen extrahieren
  const vereineMap = {};
  stellen.forEach((s) => {
    if (s.vereine && s.verein_id) {
      if (!vereineMap[s.verein_id]) {
        vereineMap[s.verein_id] = {
          ...s.vereine,
          stellenAnzahl: 0,
          kategorien: [],
        };
      }
      vereineMap[s.verein_id].stellenAnzahl++;
      if (
        s.kategorie &&
        !vereineMap[s.verein_id].kategorien.includes(s.kategorie)
      ) {
        vereineMap[s.verein_id].kategorien.push(s.kategorie);
      }
    }
  });
  const vereine = Object.values(vereineMap);

  const [vereinSearch, setVereinSearch] = useState("");
  const gefilterteVereine = vereine.filter(
    (v) =>
      !vereinSearch ||
      v.name?.toLowerCase().includes(vereinSearch.toLowerCase()) ||
      v.ort?.toLowerCase().includes(vereinSearch.toLowerCase())
  );

  if (vereine.length === 0) {
    return (
      <EmptyState
        icon="🏢"
        text="Keine Vereine gefunden"
        sub="In deiner Nähe gibt es noch keine Vereine auf Civico"
      />
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "#FAF7F2",
          borderRadius: 10,
          padding: "8px 12px",
          border: "1px solid #E0D8C8",
          marginBottom: 14,
        }}
      >
        <span>🔍</span>
        <input
          type="text"
          placeholder="Verein suchen..."
          value={vereinSearch}
          onChange={(e) => setVereinSearch(e.target.value)}
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            fontFamily: "inherit",
            fontSize: 13,
            color: "#2C2416",
            outline: "none",
          }}
        />
        {vereinSearch && (
          <span
            onClick={() => setVereinSearch("")}
            style={{ fontSize: 12, color: "#8B7355", cursor: "pointer" }}
          >
            ✕
          </span>
        )}
      </div>
      <SectionLabel>
        {gefilterteVereine.length} Vereine in deiner Nähe
      </SectionLabel>
      {gefilterteVereine.map((v) => {
        const istGefolgt = follows?.vereine?.includes(v.id);
        return (
          <div
            key={v.id}
            style={{
              background: "#FAF7F2",
              borderRadius: 14,
              padding: "14px",
              marginBottom: 10,
              border: "1px solid #E0D8C8",
            }}
          >
            <div
              onClick={() => onVereinClick(v)}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                cursor: "pointer",
                marginBottom: 10,
              }}
            >
              {/* Logo */}
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: "linear-gradient(135deg,#2C2416,#4A3C28)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                {(() => {
                  const rawLogoUrl =
                    typeof v.logo_url === "string" ? v.logo_url.trim() : "";
                  const logoUrlIstBild =
                    rawLogoUrl &&
                    (rawLogoUrl.startsWith("http://") ||
                      rawLogoUrl.startsWith("https://") ||
                      rawLogoUrl.startsWith("data:image/") ||
                      rawLogoUrl.startsWith("blob:"));

                  if (logoUrlIstBild) {
                    return (
                      <img
                        src={rawLogoUrl}
                        alt={v.name || "Logo"}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    );
                  }

                  const rawLogo =
                    typeof v.logo === "string" ? v.logo.trim() : "";

                  if (
                    rawLogo &&
                    (rawLogo.startsWith("http://") ||
                      rawLogo.startsWith("https://") ||
                      rawLogo.startsWith("data:image/") ||
                      rawLogo.startsWith("blob:"))
                  ) {
                    return (
                      <img
                        src={rawLogo}
                        alt={v.name || "Logo"}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    );
                  }

                  if (rawLogo && rawLogo.length <= 3) {
                    return rawLogo;
                  }

                  return "🏢";
                })()}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{ fontWeight: "bold", fontSize: 14, color: "#2C2416" }}
                >
                  {v.name}
                </div>
                <div style={{ fontSize: 12, color: "#8B7355", marginTop: 2 }}>
                  📍 {v.ort}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginTop: 4,
                    flexWrap: "wrap",
                  }}
                >
                  {v.kategorien.slice(0, 3).map((kid) => {
                    const kat = KATEGORIEN.find((k) => k.id === kid);
                    return kat ? (
                      <span
                        key={kid}
                        style={{
                          fontSize: 10,
                          background: kat.color + "22",
                          color: kat.color,
                          padding: "2px 7px",
                          borderRadius: 5,
                        }}
                      >
                        {kat.icon} {kat.label}
                      </span>
                    ) : null;
                  })}
                  <span
                    style={{
                      fontSize: 10,
                      background: "#EDE8DE",
                      color: "#8B7355",
                      padding: "2px 7px",
                      borderRadius: 5,
                    }}
                  >
                    🌱 {v.stellenAnzahl} Stelle
                    {v.stellenAnzahl !== 1 ? "n" : ""}
                  </span>
                </div>
              </div>
              <div style={{ color: "#C4B89A", fontSize: 18 }}>›</div>
            </div>
            {user?.type === "freiwilliger" && (
              <button
                onClick={() => onToggleFollow && onToggleFollow(v.id)}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: 10,
                  border: `1px solid ${istGefolgt ? "#C8A96E" : "#E0D8C8"}`,
                  background: istGefolgt ? "#C8A96E22" : "transparent",
                  color: istGefolgt ? "#8B6800" : "#8B7355",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: "bold",
                }}
              >
                {istGefolgt ? "✓ Gefolgt" : "+ Folgen"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BottomBar({ onImpressum, onDatenschutz, onAgb, t = T["de"] }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 480,
        background: "#2C2416",
        padding: "10px 16px 20px",
        display: "flex",
        justifyContent: "center",
        gap: 20,
      }}
    >
      <button
        onClick={onImpressum}
        style={{
          background: "none",
          border: "none",
          color: "#6B5840",
          fontSize: 11,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {t?.impressum || "Impressum"}
      </button>
      <button
        onClick={onDatenschutz}
        style={{
          background: "none",
          border: "none",
          color: "#6B5840",
          fontSize: 11,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {t?.datenschutz || "Datenschutz"}
      </button>
      <button
        onClick={onAgb}
        style={{
          background: "none",
          border: "none",
          color: "#6B5840",
          fontSize: 11,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {t?.agb || "AGB"}
      </button>
    </div>
  );
}

function DatenschutzBox({ datenschutz, setDatenschutz, onDatenschutz, onAgb }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        marginBottom: 16,
        padding: "12px 14px",
        background: "#FAF7F2",
        borderRadius: 10,
        border: "1px solid #E0D8C8",
      }}
    >
      <input
        type="checkbox"
        checked={datenschutz}
        onChange={(e) => setDatenschutz(e.target.checked)}
        id="datenschutz"
        style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0 }}
      />
      <label
        htmlFor="datenschutz"
        style={{
          fontSize: 12,
          color: "#5C4A2A",
          cursor: "pointer",
          lineHeight: 1.5,
        }}
      >
        Ich akzeptiere die{" "}
        <span
          onClick={onDatenschutz}
          style={{
            textDecoration: "underline",
            color: "#2C2416",
            cursor: "pointer",
          }}
        >
          Datenschutzerklärung
        </span>{" "}
        und{" "}
        <span
          onClick={onAgb}
          style={{
            textDecoration: "underline",
            color: "#2C2416",
            cursor: "pointer",
          }}
        >
          AGB
        </span>{" "}
        von Civico.
      </label>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontSize: 12,
          color: "#8B7355",
          marginBottom: 6,
          letterSpacing: 0.5,
        }}
      >
        {label.toUpperCase()}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "11px 14px",
          borderRadius: 10,
          border: "1px solid #E0D8C8",
          background: "#FAF7F2",
          fontFamily: "inherit",
          fontSize: 14,
          color: "#2C2416",
          boxSizing: "border-box",
          outline: "none",
          caretColor: "#2C2416",
          WebkitTextFillColor: "#2C2416",
        }}
      />
    </div>
  );
}

function BigButton({ onClick, children, disabled, green }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "15px",
        borderRadius: 14,
        border: "none",
        background: disabled ? "#E0D8C8" : green ? "#3A7D44" : "#2C2416",
        color: disabled ? "#8B7355" : "#FAF7F2",
        fontSize: 16,
        fontFamily: "inherit",
        fontWeight: "bold",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 14px",
        borderRadius: 20,
        border: "1px solid #E0D8C8",
        cursor: "pointer",
        whiteSpace: "nowrap",
        background: active ? "#2C2416" : "#FAF7F2",
        color: active ? "#FAF7F2" : "#2C2416",
        fontSize: 12,
        fontFamily: "inherit",
        fontWeight: active ? "bold" : "normal",
      }}
    >
      {label}
    </button>
  );
}

function InfoChip({ icon, label, color }) {
  return (
    <div
      style={{
        flex: 1,
        textAlign: "center",
        background: "#FAF7F2",
        border: "1px solid #E0D8C8",
        borderRadius: 10,
        padding: "10px 6px",
      }}
    >
      <div style={{ fontSize: 18 }}>{icon}</div>
      <div style={{ fontSize: 11, color: color || "#8B7355", marginTop: 3 }}>
        {label}
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: "#9A9A9A",
        letterSpacing: 2,
        textTransform: "uppercase",
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function RoleCard({ icon, title, sub, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "#FAF7F2",
        borderRadius: 16,
        padding: "18px 20px",
        marginBottom: 12,
        border: "1px solid #E0D8C8",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div style={{ fontSize: 32 }}>{icon}</div>
      <div>
        <div style={{ fontWeight: "bold", fontSize: 16, color: "#2C2416" }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: "#8B7355", marginTop: 2 }}>
          {sub}
        </div>
      </div>
      <div style={{ marginLeft: "auto", color: "#C4B89A", fontSize: 20 }}>
        ›
      </div>
    </div>
  );
}

function EmptyState({ icon, text, sub }) {
  return (
    <div
      style={{ textAlign: "center", padding: "50px 20px", color: "#8B7355" }}
    >
      <div style={{ fontSize: 44, marginBottom: 12 }}>{icon}</div>
      <div
        style={{
          fontSize: 16,
          fontWeight: "bold",
          marginBottom: 6,
          color: "#2C2416",
        }}
      >
        {text}
      </div>
      <div style={{ fontSize: 13 }}>{sub}</div>
    </div>
  );
}

function ErrorMsg({ children }) {
  return (
    <div
      style={{
        color: "#E85C5C",
        fontSize: 12,
        marginBottom: 12,
        padding: "8px 12px",
        background: "#FFF0F0",
        borderRadius: 8,
      }}
    >
      {children}
    </div>
  );
}

export {
  Header,
  StelleCard,
  VereineListe,
  BottomBar,
  DatenschutzBox,
  Input,
  BigButton,
  Chip,
  InfoChip,
  SectionLabel,
  RoleCard,
  EmptyState,
  ErrorMsg
};

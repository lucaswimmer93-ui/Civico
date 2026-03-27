import React, { useMemo, useState } from 'react';

const COLORS = {
  panel: '#FAF7F2',
  border: '#E6D9C2',
  muted: '#8B7355',
  text: '#2C2416',
  ok: '#3A7D44',
  warn: '#C47F17',
  danger: '#B65353',
  info: '#5B9BD5',
};

function card(extra = {}) {
  return {
    background: COLORS.panel,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 18,
    padding: 18,
    ...extra,
  };
}

function badge(tone = 'default') {
  const map = {
    default: { bg: '#F1ECE2', color: COLORS.muted },
    ok: { bg: '#ECF7EE', color: COLORS.ok },
    warn: { bg: '#FFF7E9', color: '#8B6800' },
    danger: { bg: '#FFF0F0', color: COLORS.danger },
    info: { bg: '#EEF5FB', color: '#30516D' },
  };
  const s = map[tone] || map.default;
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 9px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    background: s.bg,
    color: s.color,
  };
}

function button(kind = 'secondary') {
  const styles = {
    primary: {
      background: 'linear-gradient(135deg,#1A1208,#2C2416)',
      color: '#F4F0E8',
      border: 'none',
    },
    secondary: {
      background: 'transparent',
      color: COLORS.muted,
      border: `1px solid ${COLORS.border}`,
    },
    success: {
      background: '#ECF7EE',
      color: COLORS.ok,
      border: '1px solid #B8D8BE',
    },
    danger: {
      background: '#FFF0F0',
      color: COLORS.danger,
      border: '1px solid #E5BBBB',
    },
  };
  return {
    padding: '9px 12px',
    borderRadius: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 700,
    fontSize: 12,
    ...styles[kind],
  };
}

function EmptyBlock({ title, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '26px 16px', color: COLORS.muted }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>{sub}</div>
    </div>
  );
}

function SearchField({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '12px 14px',
        borderRadius: 12,
        border: `1px solid ${COLORS.border}`,
        background: '#fff',
        fontFamily: 'inherit',
        fontSize: 14,
      }}
    />
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div style={card()}>
      <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: COLORS.text }}>{value}</div>
      {sub ? <div style={{ marginTop: 8, fontSize: 12, color: COLORS.muted }}>{sub}</div> : null}
    </div>
  );
}

function SectionTitle({ kicker, title, sub, right }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-end', marginBottom: 14, flexWrap: 'wrap' }}>
      <div>
        {kicker ? <div style={{ fontSize: 11, color: COLORS.muted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>{kicker}</div> : null}
        <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text, marginBottom: 4 }}>{title}</div>
        {sub ? <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.6 }}>{sub}</div> : null}
      </div>
      {right}
    </div>
  );
}

export default function AdminDashboard({
  admin,
  gemeinden = [],
  organisationen = [],
  freiwillige = [],
  stellen = [],
  anfragen = [],
  loading = false,
  zustandeMap = new Map(),
  onVerifyVerein,
  onTogglePlan,
  onRefresh,
}) {
  const [tab, setTab] = useState('uebersicht');
  const [gemeindeSearch, setGemeindeSearch] = useState('');
  const [vereinSearch, setVereinSearch] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [inboxSearch, setInboxSearch] = useState('');

  const tabs = [
    ['uebersicht', 'Übersicht'],
    ['gemeinden', 'Gemeinden'],
    ['vereine', 'Vereine'],
    ['payments', 'Payments'],
    ['inbox', 'Inbox'],
  ];

  const metrics = useMemo(() => {
    const activeStellen = stellen.filter((s) => !s.archiviert).length;
    const verifiziert = organisationen.filter((v) => v.verifiziert).length;
    const unverified = organisationen.length - verifiziert;
    const dueForReminder = organisationen.filter((v) => (zustandeMap.get(v.id) || 0) >= 3 && !v.plan_aktiv).length;
    const offeneEinladungen = anfragen.filter((a) => (a.status || '').toLowerCase() !== 'angenommen').length;
    return { activeStellen, verifiziert, unverified, dueForReminder, offeneEinladungen };
  }, [stellen, organisationen, anfragen, zustandeMap]);

  const gemeindeRows = useMemo(() => {
    return gemeinden
      .filter((g) => {
        const hay = `${g.name || ''} ${g.ort || ''} ${g.plz || ''} ${g.email || ''}`.toLowerCase();
        return !gemeindeSearch || hay.includes(gemeindeSearch.toLowerCase());
      })
      .map((g) => {
        const vereinCount = organisationen.filter((o) => o.gemeinde_id === g.id).length;
        const volunteerCount = freiwillige.filter((f) => f.gemeinde_id === g.id).length;
        const stellenCount = stellen.filter((s) => s.gemeinde_id === g.id || s.vereine?.gemeinde_id === g.id).length;
        return { ...g, vereinCount, volunteerCount, stellenCount };
      })
      .sort((a, b) => (b.stellenCount + b.volunteerCount) - (a.stellenCount + a.volunteerCount));
  }, [gemeinden, organisationen, freiwillige, stellen, gemeindeSearch]);

  const vereinRows = useMemo(() => {
    return organisationen
      .filter((v) => {
        const hay = `${v.name || ''} ${v.ort || ''} ${v.email || ''} ${v.plz || ''}`.toLowerCase();
        return !vereinSearch || hay.includes(vereinSearch.toLowerCase());
      })
      .map((v) => ({
        ...v,
        einsaetze: zustandeMap.get(v.id) || 0,
        offeneStellen: stellen.filter((s) => s.verein_id === v.id && !s.archiviert).length,
      }))
      .sort((a, b) => (b.einsaetze + b.offeneStellen) - (a.einsaetze + a.offeneStellen));
  }, [organisationen, stellen, zustandeMap, vereinSearch]);

  const paymentRows = useMemo(() => {
    return organisationen
      .map((v) => ({
        ...v,
        einsaetze: zustandeMap.get(v.id) || 0,
      }))
      .filter((v) => {
        const hay = `${v.name || ''} ${v.email || ''} ${v.ort || ''}`.toLowerCase();
        return (!paymentSearch || hay.includes(paymentSearch.toLowerCase())) && v.einsaetze > 0;
      })
      .sort((a, b) => b.einsaetze - a.einsaetze);
  }, [organisationen, zustandeMap, paymentSearch]);

  const inboxRows = useMemo(() => {
    return anfragen.filter((a) => {
      const hay = `${a.org_name || a.verein_name || a.name || ''} ${a.email || ''} ${a.kontakt_name || ''} ${a.plz || ''}`.toLowerCase();
      return !inboxSearch || hay.includes(inboxSearch.toLowerCase());
    });
  }, [anfragen, inboxSearch]);

  const topGemeinden = gemeindeRows.slice(0, 5);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              ...button(tab === id ? 'primary' : 'secondary'),
              padding: '10px 14px',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ ...card({ marginBottom: 16 }), color: COLORS.muted }}>Daten werden geladen …</div>
      ) : null}

      {tab === 'uebersicht' ? (
        <div>
          <SectionTitle
            kicker="Systemstatus"
            title="Zentrale Übersicht"
            sub="Hier siehst du direkt, wo Freischaltungen fehlen, welche Vereine in die Pay-Erinnerung laufen und wie sich das Netzwerk entwickelt."
            right={<button onClick={onRefresh} style={button('secondary')}>Aktualisieren</button>}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 18 }}>
            <StatCard label="Gemeinden" value={gemeinden.length} sub="angeschlossene Orte" />
            <StatCard label="Vereine" value={organisationen.length} sub={`${metrics.verifiziert} verifiziert · ${metrics.unverified} offen`} />
            <StatCard label="Freiwillige" value={freiwillige.length} sub="registrierte Helfer" />
            <StatCard label="Aktive Stellen" value={metrics.activeStellen} sub="nicht archiviert" />
            <StatCard label="Offene Inbox" value={metrics.offeneEinladungen} sub="Einladungen / Rückläufer" />
            <StatCard label="Pay Reminder" value={metrics.dueForReminder} sub="ab 3 Einsätzen ohne aktiven Plan" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
            <div style={card()}>
              <SectionTitle kicker="Hotspots" title="Top 5 Gemeinden" sub="Sortiert nach Aktivität aus Stellen und Freiwilligen." />
              {topGemeinden.length === 0 ? (
                <EmptyBlock title="Noch keine Gemeindedaten" sub="Sobald Gemeinden, Vereine und Freiwillige verknüpft sind, erscheint hier das Ranking." />
              ) : topGemeinden.map((g) => (
                <div key={g.id || g.name} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 1fr', gap: 10, padding: '10px 0', borderBottom: '1px solid #EFE8DB' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{g.name || g.ort || 'Gemeinde'}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>{g.plz || 'ohne PLZ'} {g.ort ? `· ${g.ort}` : ''}</div>
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>{g.volunteerCount} Freiwillige</div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>{g.vereinCount} Vereine</div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>{g.stellenCount} Stellen</div>
                </div>
              ))}
            </div>

            <div style={card()}>
              <SectionTitle kicker="Nächste To-dos" title="Was gerade wichtig ist" />
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ ...card({ padding: 14 }) }}>
                  <div style={badge(metrics.unverified > 0 ? 'warn' : 'ok')}>{metrics.unverified > 0 ? 'Freischaltung offen' : 'Alles frei'}</div>
                  <div style={{ fontWeight: 700, marginTop: 10 }}>{metrics.unverified} Vereine warten auf Prüfung</div>
                  <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 6, lineHeight: 1.6 }}>Hier steuerst du Vertrauen. Erst saubere Vereine freischalten, dann live lassen.</div>
                </div>
                <div style={{ ...card({ padding: 14 }) }}>
                  <div style={badge(metrics.dueForReminder > 0 ? 'info' : 'ok')}>{metrics.dueForReminder > 0 ? 'Monetarisierung aktiv' : 'Noch kein Reminder fällig'}</div>
                  <div style={{ fontWeight: 700, marginTop: 10 }}>{metrics.dueForReminder} Vereine haben 3+ Einsätze ohne Plan</div>
                  <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 6, lineHeight: 1.6 }}>Das ist dein sauberer Hebel für die Pay-Erinnerung, ohne die Nutzer-App zu überladen.</div>
                </div>
                <div style={{ ...card({ padding: 14 }) }}>
                  <div style={badge(metrics.offeneEinladungen > 0 ? 'warn' : 'ok')}>{metrics.offeneEinladungen > 0 ? 'Inbox prüfen' : 'Inbox leer'}</div>
                  <div style={{ fontWeight: 700, marginTop: 10 }}>{metrics.offeneEinladungen} offene Rückmeldungen</div>
                  <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 6, lineHeight: 1.6 }}>Einladungen und Rückläufer zentral halten, statt sie in der Haupt-App zu verstecken.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'gemeinden' ? (
        <div>
          <SectionTitle kicker="Kommunen" title="Gemeinden verwalten" sub="Sauber getrennt von Vereinen. Hier siehst du, welche Gemeinde wie stark im Netzwerk ist." />
          <div style={{ ...card({ marginBottom: 16 }) }}>
            <SearchField value={gemeindeSearch} onChange={setGemeindeSearch} placeholder="Nach Name, Ort, PLZ oder E-Mail suchen" />
          </div>
          <div style={card()}>
            {gemeindeRows.length === 0 ? (
              <EmptyBlock title="Keine Gemeinden gefunden" sub="Passe den Suchbegriff an oder lege oben eine neue Gemeinde an." />
            ) : gemeindeRows.map((g) => (
              <div key={g.id || `${g.name}-${g.plz}`} style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(4,1fr)', gap: 12, padding: '12px 0', borderBottom: '1px solid #EFE8DB', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{g.name || g.ort || 'Gemeinde'}</div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>{g.email || 'keine E-Mail'} {g.plz ? `· ${g.plz}` : ''} {g.ort ? `· ${g.ort}` : ''}</div>
                </div>
                <div style={{ fontSize: 13, color: COLORS.muted }}>{g.vereinCount} Vereine</div>
                <div style={{ fontSize: 13, color: COLORS.muted }}>{g.volunteerCount} Freiwillige</div>
                <div style={{ fontSize: 13, color: COLORS.muted }}>{g.stellenCount} Stellen</div>
                <div>
                  <span style={badge(g.auth_id ? 'ok' : 'warn')}>{g.auth_id ? 'Login verbunden' : 'Nur Datensatz'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'vereine' ? (
        <div>
          <SectionTitle kicker="Organisationen" title="Vereine freischalten" sub="Hier entscheidest du, wer live gehen darf. Außerdem siehst du direkt Aktivität und Plan-Status." />
          <div style={{ ...card({ marginBottom: 16 }) }}>
            <SearchField value={vereinSearch} onChange={setVereinSearch} placeholder="Nach Verein, Ort, E-Mail oder PLZ suchen" />
          </div>
          <div style={card()}>
            {vereinRows.length === 0 ? (
              <EmptyBlock title="Keine Vereine gefunden" sub="Aktuell gibt es zu diesem Suchbegriff keinen Treffer." />
            ) : vereinRows.map((v) => (
              <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 100px 110px 110px auto', gap: 12, padding: '12px 0', borderBottom: '1px solid #EFE8DB', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{v.name}</div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>{v.email || 'keine E-Mail'} {v.ort ? `· ${v.ort}` : ''} {v.plz ? `· ${v.plz}` : ''}</div>
                </div>
                <div style={{ fontSize: 13, color: COLORS.muted }}>{v.einsaetze} Einsätze</div>
                <div style={{ fontSize: 13, color: COLORS.muted }}>{v.offeneStellen} Stellen</div>
                <div>
                  <span style={badge(v.plan_aktiv ? 'ok' : (v.einsaetze >= 3 ? 'warn' : 'default'))}>{v.plan_aktiv ? 'Plan aktiv' : (v.einsaetze >= 3 ? 'Reminder fällig' : 'Free')}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button onClick={() => onVerifyVerein && onVerifyVerein(v.id, !v.verifiziert)} style={button(v.verifiziert ? 'secondary' : 'success')}>
                    {v.verifiziert ? 'Freischaltung entfernen' : 'Freischalten'}
                  </button>
                  <button onClick={() => onTogglePlan && onTogglePlan(v.id, !v.plan_aktiv)} style={button(v.plan_aktiv ? 'secondary' : 'primary')}>
                    {v.plan_aktiv ? 'Plan deaktivieren' : 'Plan aktiv setzen'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'payments' ? (
        <div>
          <SectionTitle kicker="Monetarisierung" title="Pay-Erinnerungen steuern" sub="Ab dem dritten zustande gekommenen Einsatz wird der Verein hier relevant. Genau diese Logik ziehst du im Backend später endgültig fest." />
          <div style={{ ...card({ marginBottom: 16 }) }}>
            <SearchField value={paymentSearch} onChange={setPaymentSearch} placeholder="Nach Verein oder E-Mail suchen" />
          </div>
          <div style={card()}>
            {paymentRows.length === 0 ? (
              <EmptyBlock title="Noch keine Zahlungsdaten" sub="Sobald Einsätze bestätigt wurden, erscheinen Vereine hier automatisch." />
            ) : paymentRows.map((v) => (
              <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 110px 150px auto', gap: 12, padding: '12px 0', borderBottom: '1px solid #EFE8DB', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{v.name}</div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>{v.email || 'keine E-Mail'} {v.ort ? `· ${v.ort}` : ''}</div>
                </div>
                <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 700 }}>{v.einsaetze} Einsätze</div>
                <div>
                  <span style={badge(v.plan_aktiv ? 'ok' : (v.einsaetze >= 3 ? 'warn' : 'info'))}>
                    {v.plan_aktiv ? 'Plan aktiv' : (v.einsaetze >= 3 ? 'Reminder senden' : 'Noch free')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => onTogglePlan && onTogglePlan(v.id, !v.plan_aktiv)} style={button(v.plan_aktiv ? 'secondary' : 'primary')}>
                    {v.plan_aktiv ? 'Als unpaid markieren' : 'Als paid markieren'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'inbox' ? (
        <div>
          <SectionTitle kicker="Rückläufer" title="Inbox" sub="Einladungen, Rückmeldungen und offene Anfragen an einem Ort. So musst du nicht in verschiedene Dashboards springen." />
          <div style={{ ...card({ marginBottom: 16 }) }}>
            <SearchField value={inboxSearch} onChange={setInboxSearch} placeholder="Nach Verein, Kontakt oder E-Mail suchen" />
          </div>
          <div style={card()}>
            {inboxRows.length === 0 ? (
              <EmptyBlock title="Keine offenen Einträge" sub="Aktuell gibt es keine passenden Anfragen oder Einladungen." />
            ) : inboxRows.map((a, idx) => {
              const title = a.org_name || a.verein_name || a.name || 'Eintrag';
              const status = (a.status || 'offen').toLowerCase();
              const tone = status === 'angenommen' ? 'ok' : status === 'abgelehnt' ? 'danger' : 'warn';
              return (
                <div key={a.id || idx} style={{ padding: '12px 0', borderBottom: '1px solid #EFE8DB' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{title}</div>
                      <div style={{ fontSize: 12, color: COLORS.muted }}>
                        {a.email || 'keine E-Mail'}
                        {a.kontakt_name ? ` · ${a.kontakt_name}` : ''}
                        {a.telefon ? ` · ${a.telefon}` : ''}
                        {a.plz ? ` · ${a.plz}` : ''}
                      </div>
                    </div>
                    <span style={badge(tone)}>{status}</span>
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.6 }}>{a.nachricht || a.message || a.text || 'Keine Nachricht hinterlegt.'}</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 16, ...card() }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.muted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Admin-Kontext</div>
            <div style={{ fontWeight: 700 }}>{admin?.name || admin?.email || 'Admin'}</div>
            <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>Dieses Panel ist bewusst getrennt von der Nutzer-App gebaut.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={badge('info')}>Separate Admin-Anwendung</span>
            <span style={badge('ok')}>Gleiche Supabase-Basis</span>
            <span style={badge('warn')}>Backend-Freischaltungen folgen</span>
          </div>
        </div>
      </div>
    </div>
  );
}

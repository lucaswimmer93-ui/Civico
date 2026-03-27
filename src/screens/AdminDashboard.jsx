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

function Table({ columns, rows, emptyTitle, emptySub }) {
  if (!rows?.length) {
    return <EmptyBlock title={emptyTitle} sub={emptySub} />;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{ textAlign: 'left', padding: '0 0 10px', color: COLORS.muted, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', borderBottom: '1px solid #EFE8DB' }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id || row.key || idx}>
              {columns.map((col) => (
                <td key={col.key} style={{ padding: '12px 0', borderBottom: '1px solid #EFE8DB', verticalAlign: 'top' }}>
                  {col.render ? col.render(row) : row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '0';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(num);
}

function miniBar(value, max) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ width: '100%', minWidth: 120 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{formatNumber(value)}</div>
      <div style={{ height: 8, background: '#EEE5D8', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(135deg,#1A1208,#5B9BD5)' }} />
      </div>
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
  analytics = {},
  onGeneratePdf,
}) {
  const [tab, setTab] = useState('uebersicht');
  const [gemeindeSearch, setGemeindeSearch] = useState('');
  const [vereinSearch, setVereinSearch] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [inboxSearch, setInboxSearch] = useState('');
  const [analyticsSearch, setAnalyticsSearch] = useState('');

  const tabs = [
    ['uebersicht', 'Übersicht'],
    ['gemeinden', 'Gemeinden'],
    ['vereine', 'Vereine'],
    ['payments', 'Payments'],
    ['analytics', 'Analyse'],
    ['inbox', 'Inbox'],
  ];

  const stats = analytics.dashboard || {};
  const funnel = analytics.funnel || {};
  const vereineStats = analytics.vereineStats || [];
  const gemeindenStats = analytics.gemeindenStats || [];
  const altersStats = analytics.altersStats || [];
  const altersRegionStats = analytics.altersRegionStats || [];
  const regionStats = analytics.regionStats || [];
  const csrStats = analytics.csrStats || [];
  const monatsStats = analytics.monatsStats || [];

  const metrics = useMemo(() => {
    const activeStellen = Number(stats.aktive_stellen_count ?? stellen.filter((s) => !s.archiviert).length);
    const verifiziert = organisationen.filter((v) => v.verifiziert).length;
    const unverified = organisationen.length - verifiziert;
    const dueForReminder = Number(stats.pay_relevante_vereine_count ?? organisationen.filter((v) => (zustandeMap.get(v.id) || 0) >= 3 && !v.plan_aktiv).length);
    const offeneEinladungen = anfragen.filter((a) => (a.status || '').toLowerCase() !== 'angenommen').length;
    return { activeStellen, verifiziert, unverified, dueForReminder, offeneEinladungen };
  }, [stellen, organisationen, anfragen, zustandeMap, stats]);

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

  const filteredVereineStats = useMemo(() => {
    return vereineStats.filter((v) => {
      const hay = `${v.name || ''} ${v.email || ''} ${v.gemeinde_name || ''} ${v.region_name || ''}`.toLowerCase();
      return !analyticsSearch || hay.includes(analyticsSearch.toLowerCase());
    });
  }, [vereineStats, analyticsSearch]);

  const filteredGemeindenStats = useMemo(() => {
    return gemeindenStats.filter((g) => {
      const hay = `${g.name || ''} ${g.ort || ''} ${g.region_name || ''} ${g.bundesland || ''} ${g.landkreis || ''}`.toLowerCase();
      return !analyticsSearch || hay.includes(analyticsSearch.toLowerCase());
    });
  }, [gemeindenStats, analyticsSearch]);

  const topGemeinden = gemeindeRows.slice(0, 5);
  const maxRegionHours = Math.max(0, ...regionStats.map((r) => Number(r.gesamtstunden || 0)));
  const maxCsrHours = Math.max(0, ...csrStats.map((r) => Number(r.gesamtstunden || 0)));

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{ ...button(tab === id ? 'primary' : 'secondary'), padding: '10px 14px' }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? <div style={{ ...card({ marginBottom: 16 }), color: COLORS.muted }}>Daten werden geladen …</div> : null}

      {tab === 'uebersicht' ? (
        <div>
          <SectionTitle
            kicker="Systemstatus"
            title="Zentrale Übersicht"
            sub="Hier siehst du direkt, wo Freischaltungen fehlen, welche Vereine in die Pay-Erinnerung laufen und wie sich das Netzwerk entwickelt."
            right={<button onClick={onRefresh} style={button('secondary')}>Aktualisieren</button>}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 18 }}>
            <StatCard label="Gemeinden" value={formatNumber(stats.gemeinden_count ?? gemeinden.length)} sub="angeschlossene Orte" />
            <StatCard label="Vereine" value={formatNumber(stats.vereine_count ?? organisationen.length)} sub={`${metrics.verifiziert} verifiziert · ${metrics.unverified} offen`} />
            <StatCard label="Freiwillige" value={formatNumber(stats.freiwillige_count ?? freiwillige.length)} sub="registrierte Helfer" />
            <StatCard label="Aktive Stellen" value={formatNumber(metrics.activeStellen)} sub="nicht archiviert" />
            <StatCard label="Stunden" value={formatNumber(stats.gesamtstunden || 0)} sub="erfasste Einsatzstunden" />
            <StatCard label="Pay Reminder" value={formatNumber(metrics.dueForReminder)} sub="ab 3 Einsätzen ohne aktiven Plan" />
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
          <SectionTitle kicker="Monetarisierung" title="Pay-Erinnerungen steuern" sub="Ab dem dritten zustande gekommenen Einsatz wird der Verein hier relevant." />
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

      {tab === 'analytics' ? (
        <div>
          <SectionTitle
            kicker="Steuerung & Reporting"
            title="Analyse, Regionen, CSR und Demografie"
            sub="Hier steuerst du die Plattform wirklich. Wachstum, regionale Wirkung, Altersstruktur und PDF-Berichte laufen an einem Ort zusammen."
            right={
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => onGeneratePdf && onGeneratePdf('plattform')} style={button('secondary')}>Plattform-PDF</button>
                <button onClick={() => onGeneratePdf && onGeneratePdf('regionen')} style={button('secondary')}>Regionen-PDF</button>
                <button onClick={() => onGeneratePdf && onGeneratePdf('csr')} style={button('secondary')}>CSR-PDF</button>
                <button onClick={() => onGeneratePdf && onGeneratePdf('alter')} style={button('primary')}>Demografie-PDF</button>
              </div>
            }
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 18 }}>
            <StatCard label="Zustande gekommene Einsätze" value={formatNumber(stats.zustande_gekommene_einsaetze_count || 0)} sub="aus Einsatzreports" />
            <StatCard label="Erfasste Stunden" value={formatNumber(stats.gesamtstunden || 0)} sub="für CSR und Regionalreports" />
            <StatCard label="Pay-relevante Vereine" value={formatNumber(stats.pay_relevante_vereine_count || 0)} sub="3+ Einsätze" />
            <StatCard label="Angenommene Einladungen" value={formatNumber(funnel.angenommene_einladungen || 0)} sub={`von ${formatNumber(funnel.verein_einladungen || 0)} Einladungen`} />
          </div>

          <div style={{ ...card({ marginBottom: 16 }) }}>
            <SearchField value={analyticsSearch} onChange={setAnalyticsSearch} placeholder="Analyse nach Gemeinde, Region, Verein oder Bundesland filtern" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={card()}>
              <SectionTitle kicker="Funnel" title="Vom Invite bis zur Nutzung" />
              <div style={{ display: 'grid', gap: 10 }}>
                {[
                  ['Gemeinden', funnel.gemeinden || 0],
                  ['Vereinseinladungen', funnel.verein_einladungen || 0],
                  ['Angenommene Einladungen', funnel.angenommene_einladungen || 0],
                  ['Registrierte Vereine', funnel.registrierte_vereine || 0],
                  ['Vereine mit Stelle', funnel.vereine_mit_stelle || 0],
                  ['Vereine mit Einsatz', funnel.vereine_mit_einsatz || 0],
                  ['Vereine pay-relevant', funnel.vereine_pay_relevant || 0],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 8, borderBottom: '1px solid #EFE8DB' }}>
                    <div style={{ color: COLORS.text, fontWeight: 700 }}>{label}</div>
                    <div style={{ color: COLORS.muted }}>{formatNumber(value)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={card()}>
              <SectionTitle kicker="Demografie" title="Altersgruppen" sub="Nicht öffentlich im Profil, aber zentral für regionale Wirkung und Zielgruppenanalyse." />
              <Table
                columns={[
                  { key: 'altersgruppe', label: 'Altersgruppe' },
                  { key: 'freiwillige_count', label: 'Freiwillige', render: (r) => formatNumber(r.freiwillige_count) },
                  { key: 'teilnahmen_count', label: 'Teilnahmen', render: (r) => formatNumber(r.teilnahmen_count) },
                  { key: 'nicht_erschienen_count', label: 'No-Shows', render: (r) => formatNumber(r.nicht_erschienen_count) },
                ]}
                rows={altersStats}
                emptyTitle="Noch keine Altersdaten"
                emptySub="Sobald Freiwillige mit Geburtsdatum registriert sind, siehst du hier die Verteilung."
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={card()}>
              <SectionTitle kicker="Regionen" title="Regionale Wirkung" sub="Das ist die Basis für deine regionalen Statistiken und spätere PDF-Reports für Kommunen." />
              {regionStats.length === 0 ? (
                <EmptyBlock title="Noch keine Regionaldaten" sub="Sobald Einsatzreports vorliegen und Gemeinden Regionen zugewiesen sind, erscheint hier die Wirkung nach Region." />
              ) : regionStats.map((row, idx) => (
                <div key={`${row.region_name}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1.3fr 140px 120px 120px', gap: 12, padding: '12px 0', borderBottom: '1px solid #EFE8DB', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{row.region_name || 'Unbekannt'}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>{row.bundesland || 'ohne Bundesland'} · {formatNumber(row.gemeinden_count || 0)} Gemeinden</div>
                  </div>
                  <div>{miniBar(Number(row.gesamtstunden || 0), maxRegionHours)}</div>
                  <div style={{ color: COLORS.muted }}>{formatNumber(row.completed_einsaetze_count || 0)} Einsätze</div>
                  <div style={{ color: COLORS.muted }}>{formatNumber(row.betreute_personen || 0)} Personen</div>
                </div>
              ))}
            </div>

            <div style={card()}>
              <SectionTitle kicker="CSR" title="Wirkungsbereiche" sub="Zeigt dir, wo gesellschaftliche Wirkung entsteht und wie viele Stunden je Themenfeld laufen." />
              {csrStats.length === 0 ? (
                <EmptyBlock title="Noch keine CSR-Daten" sub="Sobald Einsatzreports mit Wirkungsbereich erzeugt sind, wird hier deine Impact-Sicht aufgebaut." />
              ) : csrStats.map((row, idx) => (
                <div key={`${row.wirkungsbereich}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1.2fr 140px 120px 120px', gap: 12, padding: '12px 0', borderBottom: '1px solid #EFE8DB', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{row.wirkungsbereich || 'Unbekannt'}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>{formatNumber(row.helfer_tatsaechlich_summe || 0)} Helfer insgesamt</div>
                  </div>
                  <div>{miniBar(Number(row.gesamtstunden || 0), maxCsrHours)}</div>
                  <div style={{ color: COLORS.muted }}>{formatNumber(row.completed_einsaetze_count || 0)} Einsätze</div>
                  <div style={{ color: COLORS.muted }}>{formatNumber(row.betreute_personen || 0)} Personen</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
            <div style={card()}>
              <SectionTitle kicker="Gemeinden" title="Gemeindestatistik" />
              <Table
                columns={[
                  { key: 'name', label: 'Gemeinde', render: (r) => <div><div style={{ fontWeight: 700 }}>{r.name}</div><div style={{ fontSize: 12, color: COLORS.muted }}>{r.region_name || 'ohne Region'}{r.bundesland ? ` · ${r.bundesland}` : ''}</div></div> },
                  { key: 'vereine_count', label: 'Vereine', render: (r) => formatNumber(r.vereine_count) },
                  { key: 'freiwillige_count', label: 'Freiwillige', render: (r) => formatNumber(r.freiwillige_count) },
                  { key: 'completed_einsaetze_count', label: 'Einsätze', render: (r) => formatNumber(r.completed_einsaetze_count) },
                  { key: 'gesamtstunden', label: 'Stunden', render: (r) => formatNumber(r.gesamtstunden) },
                ]}
                rows={filteredGemeindenStats}
                emptyTitle="Noch keine Gemeindestatistik"
                emptySub="Sobald Gemeinden und Einsatzreports vorhanden sind, erscheint hier deine regionale Gemeindesicht."
              />
            </div>

            <div style={card()}>
              <SectionTitle kicker="Vereine" title="Vereinsstatistik" />
              <Table
                columns={[
                  { key: 'name', label: 'Verein', render: (r) => <div><div style={{ fontWeight: 700 }}>{r.name}</div><div style={{ fontSize: 12, color: COLORS.muted }}>{r.gemeinde_name || 'ohne Gemeinde'}{r.region_name ? ` · ${r.region_name}` : ''}</div></div> },
                  { key: 'stellen_count', label: 'Stellen', render: (r) => formatNumber(r.stellen_count) },
                  { key: 'completed_einsaetze_count', label: 'Einsätze', render: (r) => formatNumber(r.completed_einsaetze_count) },
                  { key: 'gesamtstunden', label: 'Stunden', render: (r) => formatNumber(r.gesamtstunden) },
                  { key: 'status', label: 'Status', render: (r) => <span style={badge(r.plan_aktiv ? 'ok' : (Number(r.completed_einsaetze_count || 0) >= 3 ? 'warn' : 'default'))}>{r.plan_aktiv ? 'Plan aktiv' : (Number(r.completed_einsaetze_count || 0) >= 3 ? 'Pay relevant' : 'Free')}</span> },
                ]}
                rows={filteredVereineStats}
                emptyTitle="Noch keine Vereinsstatistik"
                emptySub="Sobald Vereine Stellen und Einsatzreports haben, erscheint hier die Auswertung."
              />
            </div>

            <div style={card()}>
              <SectionTitle kicker="Zeitverlauf" title="Monatliche Entwicklung" sub="Hilft dir später bei Förderanträgen, Quartalsberichten und Vorstandspräsentationen." />
              <Table
                columns={[
                  { key: 'monat', label: 'Monat' },
                  { key: 'completed_einsaetze_count', label: 'Einsätze', render: (r) => formatNumber(r.completed_einsaetze_count) },
                  { key: 'gesamtstunden', label: 'Stunden', render: (r) => formatNumber(r.gesamtstunden) },
                  { key: 'helfer_tatsaechlich_summe', label: 'Helfer', render: (r) => formatNumber(r.helfer_tatsaechlich_summe) },
                  { key: 'betreute_personen', label: 'Personen', render: (r) => formatNumber(r.betreute_personen) },
                ]}
                rows={monatsStats}
                emptyTitle="Noch kein Monatsverlauf"
                emptySub="Sobald Einsatzreports vorliegen, kann das System echte Zeitverläufe ausgeben."
              />
            </div>

            <div style={card()}>
              <SectionTitle kicker="Region x Alter" title="Altersgruppen nach Gemeinde / Region" />
              <Table
                columns={[
                  { key: 'gemeinde_name', label: 'Gemeinde' },
                  { key: 'region_name', label: 'Region' },
                  { key: 'altersgruppe', label: 'Altersgruppe' },
                  { key: 'freiwillige_count', label: 'Freiwillige', render: (r) => formatNumber(r.freiwillige_count) },
                  { key: 'teilnahmen_count', label: 'Teilnahmen', render: (r) => formatNumber(r.teilnahmen_count) },
                ]}
                rows={altersRegionStats}
                emptyTitle="Noch keine regionalen Altersdaten"
                emptySub="Sobald Freiwillige mit Geburtsdatum und Einsatzdaten vorhanden sind, wird hier die regionale Demografie sichtbar."
              />
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'inbox' ? (
        <div>
          <SectionTitle kicker="Rückläufer" title="Inbox" sub="Einladungen, Rückmeldungen und offene Anfragen an einem Ort." />
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
            <span style={badge('warn')}>PDF-Reports aktiviert</span>
          </div>
        </div>
      </div>
    </div>
  );
}

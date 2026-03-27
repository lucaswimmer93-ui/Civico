
import React, { useMemo, useState } from 'react';
import { Input, EmptyState } from '../components/ui';

function defaultTermin() {
  return { datum: '', startzeit: '', endzeit: '', plaetze: 5 };
}

export default function GemeindeDashboard({
  user,
  stellen = [],
  organisationen = [],
  inbox = [],
  onBack,
  logout,
  onCreateStelle,
}) {
  const [tab, setTab] = useState('overview');
  const [form, setForm] = useState({
    titel: '',
    beschreibung: '',
    typ: 'event',
    kategorie: 'sozial',
    standort: '',
    ansprechpartner: '',
    plz: user?.plz || '',
    aufwand: '',
    termine: [defaultTermin()],
  });

  const gemeindeStellen = useMemo(
    () => stellen.filter((s) => s.gemeinde_id === user?.id || s.created_by_type === 'gemeinde'),
    [stellen, user]
  );

  const totalBewerbungen = gemeindeStellen.reduce(
    (sum, s) => sum + (s.termine || []).reduce((tSum, t) => tSum + ((t.bewerbungen || []).length), 0),
    0
  );
  const totalStunden = gemeindeStellen.reduce(
    (sum, s) =>
      sum +
      (s.termine || []).reduce((inner, t) => {
        const teilnehmer = (t.bewerbungen || []).filter((b) => b.bestaetigt).length;
        if (!t.startzeit || !t.endzeit) return inner;
        const [sh, sm] = t.startzeit.split(':').map(Number);
        const [eh, em] = t.endzeit.split(':').map(Number);
        const stunden = Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
        return inner + stunden * teilnehmer;
      }, 0),
    0
  );

  const tabs = [
    ['overview', '📊 Übersicht'],
    ['stellen', '🌱 Stellen'],
    ['vereine', '🏢 Vereine'],
    ['anfragen', '✉️ Anfragen'],
    ['csr', '📋 CSR Report'],
    ['erstellen', '➕ Neue Stelle'],
  ];

  const handleSave = () => {
    const payload = {
      ...form,
      created_by_type: 'gemeinde',
      gemeinde_id: user?.id,
      plz: form.plz || user?.plz || '',
    };
    onCreateStelle?.(payload);
    setForm({
      titel: '',
      beschreibung: '',
      typ: 'event',
      kategorie: 'sozial',
      standort: '',
      ansprechpartner: '',
      plz: user?.plz || '',
      aufwand: '',
      termine: [defaultTermin()],
    });
    setTab('stellen');
  };

  const updateTermin = (idx, field, value) =>
    setForm((f) => ({
      ...f,
      termine: f.termine.map((t, i) => (i === idx ? { ...t, [field]: value } : t)),
    }));

  const removeTermin = (idx) =>
    setForm((f) => ({
      ...f,
      termine: f.termine.filter((_, i) => i !== idx),
    }));

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F4F0E8',
        display: 'grid',
        gridTemplateColumns: '220px minmax(0,1fr)',
      }}
    >
      <aside
        style={{
          background: '#1A1208',
          color: '#F4F0E8',
          padding: '22px 14px 16px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          position: 'sticky',
          top: 0,
        }}
      >
        <div style={{ padding: '0 8px 16px', borderBottom: '1px solid rgba(200,169,110,.18)' }}>
          <div style={{ fontFamily: "'Georgia', serif", fontSize: 22, letterSpacing: 2 }}>Civico</div>
          <div style={{ fontSize: 12, color: '#8B7355', marginTop: 6 }}>{user?.name || user?.ort || 'Gemeinde'}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 12, flex: 1 }}>
          {tabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                border: 'none',
                background: tab === key ? 'rgba(200,169,110,.15)' : 'transparent',
                color: tab === key ? '#C8A96E' : '#8B7355',
                borderRadius: 10,
                padding: '10px 12px',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                fontSize: 13,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ borderTop: '1px solid rgba(200,169,110,.15)', paddingTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: '2px solid #C8A96E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg,#2C2416,#4A3C28)',
                fontSize: 18,
              }}
            >
              🏛️
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#F4F0E8' }}>{user?.name || 'Gemeinde'}</div>
              <div style={{ fontSize: 10, color: '#8B7355' }}>{user?.ort || 'Hessen'}</div>
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              width: '100%',
              border: '1px solid rgba(255,255,255,.12)',
              background: 'transparent',
              color: '#8B7355',
              borderRadius: 9,
              padding: '8px 10px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 11,
            }}
          >
            ← Abmelden
          </button>
        </div>
      </aside>

      <main style={{ minWidth: 0 }}>
        <div
          style={{
            background: 'linear-gradient(160deg,#1A1208,#2C2416)',
            color: '#F4F0E8',
            padding: '22px 24px 18px',
          }}
        >
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: '#8B7355',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
              marginBottom: 12,
            }}
          >
            ← Zurück
          </button>
          <div style={{ fontFamily: "'Georgia', serif", fontSize: 28, marginBottom: 4 }}>
            {tab === 'overview'
              ? 'Übersicht'
              : tab === 'stellen'
              ? 'Gemeinde-Stellen'
              : tab === 'vereine'
              ? 'Vereine'
              : tab === 'anfragen'
              ? 'Anfragen'
              : tab === 'csr'
              ? 'CSR Report'
              : 'Neue Gemeinde-Stelle'}
          </div>
          <div style={{ fontSize: 13, color: '#8B7355' }}>
            {tab === 'overview'
              ? `Willkommen bei der Demo, ${user?.name || user?.ort || 'Gemeinde'}!`
              : tab === 'stellen'
              ? 'Eigene Aktionen und Ehrenamtsangebote direkt aus der Gemeinde veröffentlichen'
              : tab === 'vereine'
              ? 'Alle Vereine deiner Gemeinde'
              : tab === 'anfragen'
              ? 'Partner- und Kontaktanfragen aus der Website'
              : tab === 'csr'
              ? 'Ehrenamtliche Leistungen und Auswertungen'
              : 'Erstelle eine neue Gemeinde-Stelle im Stil der Demo'}
          </div>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            {tabs.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  border: 'none',
                  borderRadius: 18,
                  padding: '8px 14px',
                  cursor: 'pointer',
                  background: tab === key ? '#C8A96E' : '#EFE8DB',
                  color: tab === key ? '#1A1208' : '#5C4A32',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 18 }}>
                {[
                  ['🏢', 'Vereine', organisationen.length],
                  ['🌱', 'Aktive Stellen', gemeindeStellen.length],
                  ['👥', 'Anmeldungen', totalBewerbungen],
                  ['⏱️', 'Geleistete Stunden', `${totalStunden.toFixed(1)}h`],
                ].map(([icon, label, value]) => (
                  <div key={label} style={{ background: '#FAF7F2', border: '1px solid #E0D8C8', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                    <div style={{ fontFamily: "'Georgia', serif", fontSize: 28, color: label === 'Geleistete Stunden' ? '#C8A96E' : '#2C2416' }}>{value}</div>
                    <div style={{ fontSize: 11, color: '#8B7355' }}>{label}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: '#FAF7F2', border: '1px solid #E0D8C8', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 10, color: '#8B7355', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
                  Aktive Vereine
                </div>
                {organisationen.length === 0 ? (
                  <EmptyState icon="🏢" text="Noch keine Organisationen" sub="Hier erscheinen Vereine und Organisationen deiner Gemeinde." />
                ) : (
                  organisationen.map((org) => (
                    <div key={org.id || org.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F0EBE0' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{org.logo || '🏢'} {org.name || org.vereinsname}</div>
                        <div style={{ fontSize: 11, color: '#8B7355' }}>{org.plz || ''} · {org.ort || ''}</div>
                      </div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500, background: org.verifiziert === false ? 'rgba(200,169,110,.2)' : 'rgba(58,125,68,.12)', color: org.verifiziert === false ? '#8B6800' : '#3A7D44' }}>
                        {org.verifiziert === false ? 'Ausstehend' : 'Aktiv'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {tab === 'stellen' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontFamily: "'Georgia', serif", fontSize: 24, color: '#2C2416' }}>Gemeinde-Stellen</div>
                  <div style={{ fontSize: 13, color: '#8B7355' }}>Eigene Aktionen und Ehrenamtsangebote direkt aus der Gemeinde veröffentlichen</div>
                </div>
                <button
                  onClick={() => setTab('erstellen')}
                  style={{ background: '#C8A96E', color: '#1A1208', border: 'none', padding: '9px 16px', borderRadius: 20, fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer' }}
                >
                  + Neue Stelle
                </button>
              </div>

              {gemeindeStellen.length === 0 ? (
                <EmptyState icon="📍" text="Noch keine eigenen Stellen" sub="Gemeinden können hier selbst Aktionen und Ehrenamtsangebote veröffentlichen." />
              ) : (
                gemeindeStellen.map((s) => (
                  <div key={s.id || s.titel} style={{ background: '#FAF7F2', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #E0D8C8' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{s.titel}</div>
                        <div style={{ fontSize: 11, color: '#8B7355' }}>{s.plz || user?.plz || ''} · {(s.termine || []).length} Termin(e)</div>
                      </div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500, background: 'rgba(58,125,68,.12)', color: '#3A7D44' }}>
                        Aktiv
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#5C4A32', marginBottom: 10 }}>{s.beschreibung}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(s.termine || []).map((t, idx) => (
                        <span key={t.id || idx} style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500, background: (t.freie_plaetze || 0) === 0 ? 'rgba(232,92,92,.12)' : 'rgba(91,155,213,.15)', color: (t.freie_plaetze || 0) === 0 ? '#E85C5C' : '#185FA5' }}>
                          📅 {new Date(t.datum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} {t.startzeit} · {(t.freie_plaetze || 0) === 0 ? 'Ausgebucht' : `Noch ${t.freie_plaetze || t.gesamt_plaetze || 0} gesucht`}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'vereine' && (
            <div>
              {organisationen.length === 0 ? (
                <EmptyState icon="🏢" text="Noch keine Organisationen" sub="Hier erscheinen Vereine und Organisationen deiner Gemeinde." />
              ) : (
                organisationen.map((org) => (
                  <div key={org.id || org.name} style={{ background: '#FAF7F2', borderRadius: 12, padding: 16, marginBottom: 10, border: '1px solid #E0D8C8' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{org.logo || '🏢'} {org.name || org.vereinsname}</div>
                        <div style={{ fontSize: 11, color: '#8B7355' }}>{org.plz || ''} · {org.ort || ''}</div>
                      </div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500, background: org.verifiziert === false ? 'rgba(200,169,110,.2)' : 'rgba(58,125,68,.12)', color: org.verifiziert === false ? '#8B6800' : '#3A7D44' }}>
                        {org.verifiziert === false ? 'Ausstehend' : 'Aktiv'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'anfragen' && (
            <div style={{ background: '#FAF7F2', borderRadius: 12, padding: 16, border: '1px solid #E0D8C8' }}>
              <div style={{ fontSize: 10, color: '#8B7355', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Eingegangene Anfragen</div>
              {inbox.length === 0 ? (
                <EmptyState icon="📬" text="Keine offenen Nachrichten" sub="Partneranfragen und Hinweise landen hier." />
              ) : (
                inbox.map((msg, idx) => (
                  <div key={msg.id || idx} style={{ padding: '12px 0', borderBottom: '1px solid #F0EBE0' }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{msg.title || msg.betreff || 'Anfrage'}</div>
                    <div style={{ fontSize: 11, color: '#8B7355', margin: '4px 0 8px' }}>{msg.email || msg.absender || 'unbekannt'}</div>
                    <div style={{ fontSize: 13, color: '#5C4A32' }}>{msg.message || msg.text || ''}</div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'csr' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 18 }}>
                {[
                  ['⏱️', 'Geleistete Stunden', `${totalStunden.toFixed(1)}h`],
                  ['👥', 'Freiwillige', totalBewerbungen],
                  ['📅', 'Einsätze', gemeindeStellen.reduce((sum, s) => sum + (s.termine || []).length, 0)],
                  ['🏢', 'Vereine', organisationen.length],
                ].map(([icon, label, value]) => (
                  <div key={label} style={{ background: '#FAF7F2', border: '1px solid #E0D8C8', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                    <div style={{ fontFamily: "'Georgia', serif", fontSize: 28, color: label === 'Geleistete Stunden' ? '#C8A96E' : '#2C2416' }}>{value}</div>
                    <div style={{ fontSize: 11, color: '#8B7355' }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#FAF7F2', borderRadius: 12, padding: 16, border: '1px solid #E0D8C8' }}>
                <div style={{ fontSize: 10, color: '#8B7355', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>CSR Report</div>
                <div style={{ fontSize: 14, color: '#5C4A32', lineHeight: 1.7 }}>
                  Dieser Bereich ist vorbereitet für kommunale Auswertungen, Partner-Nachweise und spätere Reporting-Exports.
                </div>
              </div>
            </>
          )}

          {tab === 'erstellen' && (
            <div style={{ background: '#FAF7F2', borderRadius: 12, padding: 16, border: '1px solid #E0D8C8' }}>
              <div style={{ fontSize: 10, color: '#8B7355', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Neue Gemeinde-Stelle</div>

              <Input label="Titel" value={form.titel} onChange={(e) => setForm((f) => ({ ...f, titel: e.target ? e.target.value : e }))} />
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#8B7355', marginBottom: 8 }}>Beschreibung</div>
                <textarea
                  value={form.beschreibung}
                  onChange={(e) => setForm((f) => ({ ...f, beschreibung: e.target.value }))}
                  rows={4}
                  style={{ width: '100%', borderRadius: 10, border: '1px solid #D8CBB6', padding: 12, fontFamily: 'inherit', background: '#F4F0E8' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  onClick={() => setForm((f) => ({ ...f, typ: 'event' }))}
                  style={{ padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: form.typ === 'event' ? '#2C2416' : '#EDE8DE', color: form.typ === 'event' ? '#FAF7F2' : '#8B7355', fontFamily: 'inherit', fontSize: 13, fontWeight: 'bold' }}
                >
                  📅 Einmaliges Event
                </button>
                <button
                  onClick={() => setForm((f) => ({ ...f, typ: 'dauerhaft' }))}
                  style={{ padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: form.typ === 'dauerhaft' ? '#2C2416' : '#EDE8DE', color: form.typ === 'dauerhaft' ? '#FAF7F2' : '#8B7355', fontFamily: 'inherit', fontSize: 13, fontWeight: 'bold' }}
                >
                  🔄 Dauerhaft
                </button>
              </div>

              {form.typ === 'dauerhaft' && (
                <Input label="Zeitaufwand pro Woche" value={form.aufwand} onChange={(e) => setForm((f) => ({ ...f, aufwand: e.target ? e.target.value : e }))} />
              )}

              <Input label="Kategorie" value={form.kategorie} onChange={(e) => setForm((f) => ({ ...f, kategorie: e.target ? e.target.value : e }))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Input label="PLZ" value={form.plz} onChange={(e) => setForm((f) => ({ ...f, plz: e.target ? e.target.value : e }))} />
                <Input label="Standort" value={form.standort} onChange={(e) => setForm((f) => ({ ...f, standort: e.target ? e.target.value : e }))} />
                <Input label="Ansprechpartner" value={form.ansprechpartner} onChange={(e) => setForm((f) => ({ ...f, ansprechpartner: e.target ? e.target.value : e }))} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: '#8B7355', letterSpacing: 2, textTransform: 'uppercase' }}>
                  {form.typ === 'dauerhaft' ? 'Einführungsgespräch' : 'Termine'}
                </div>
                <button onClick={() => setForm((f) => ({ ...f, termine: [...f.termine, defaultTermin()] }))} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #2C2416', background: 'transparent', color: '#2C2416', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  + {form.typ === 'dauerhaft' ? 'Einführungsgespräch' : 'Termin'}
                </button>
              </div>

              {form.termine.map((t, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8, border: '1px solid #E0D8C8', borderRadius: 10, padding: 12, background: '#F4F0E8' }}>
                  <input type="date" value={t.datum} onChange={(e) => updateTermin(idx, 'datum', e.target.value)} style={{ borderRadius: 8, border: '1px solid #D8CBB6', padding: 10, fontFamily: 'inherit' }} />
                  <input type="time" value={t.startzeit} onChange={(e) => updateTermin(idx, 'startzeit', e.target.value)} style={{ borderRadius: 8, border: '1px solid #D8CBB6', padding: 10, fontFamily: 'inherit' }} />
                  <input type="time" value={t.endzeit} onChange={(e) => updateTermin(idx, 'endzeit', e.target.value)} style={{ borderRadius: 8, border: '1px solid #D8CBB6', padding: 10, fontFamily: 'inherit' }} />
                  <input type="number" min="1" value={t.plaetze} onChange={(e) => updateTermin(idx, 'plaetze', Number(e.target.value))} style={{ borderRadius: 8, border: '1px solid #D8CBB6', padding: 10, fontFamily: 'inherit' }} />
                  {form.termine.length > 1 && (
                    <button onClick={() => removeTermin(idx)} style={{ padding: '10px', borderRadius: 8, border: '1px solid #D8B7B7', background: 'transparent', color: '#C95F5F', cursor: 'pointer', fontFamily: 'inherit' }}>
                      ✕
                    </button>
                  )}
                </div>
              ))}

              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button onClick={() => setTab('stellen')} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid #E0D8C8', background: 'transparent', color: '#8B7355', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Abbrechen
                </button>
                <button onClick={handleSave} style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: '#C8A96E', color: '#1A1208', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 'bold' }}>
                  Stelle speichern ✓
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

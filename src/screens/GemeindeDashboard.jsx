
import React, { useMemo, useState } from 'react';
import { Header, Input, SectionLabel, EmptyState, Chip } from '../components/ui';

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
  const [tab, setTab] = useState('dashboard');
  const [form, setForm] = useState({
    titel: '',
    beschreibung: '',
    typ: 'einmalig',
    kategorie: 'sozial',
    standort: '',
    ansprechpartner: '',
    plz: user?.plz || '',
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
      typ: 'einmalig',
      kategorie: 'sozial',
      standort: '',
      ansprechpartner: '',
      plz: user?.plz || '',
      termine: [defaultTermin()],
    });
    setTab('stellen');
  };

  return (
    <div>
      <Header title="Gemeinde-Dashboard" subtitle={user?.name || user?.ort || 'Gemeinde'} onBack={onBack} onLogout={logout} />
      <div style={{ display:'flex', gap:8, padding:'0 16px 16px', flexWrap:'wrap' }}>
        {[
          ['dashboard','Übersicht'],
          ['stellen','Eigene Stellen'],
          ['erstellen','Stelle erstellen'],
          ['organisationen','Organisationen'],
          ['postfach','Postfach'],
          ['csr','CSR-Report'],
        ].map(([key,label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ border:'none', borderRadius:18, padding:'8px 14px', cursor:'pointer', background: tab===key ? '#C8A96E' : '#EFE8DB', color: tab===key ? '#1A1208' : '#5C4A32', fontFamily:'inherit', fontSize:13, fontWeight:600 }}>{label}</button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div style={{ padding:'0 16px 24px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {[
              ['Organisationen', organisationen.length],
              ['Eigene Stellen', gemeindeStellen.length],
              ['Anmeldungen', totalBewerbungen],
              ['Anfragen', inbox.length],
            ].map(([label, value]) => (
              <div key={label} style={{ background:'#FAF7F2', borderRadius:18, padding:18, border:'1px solid #E6D9C2' }}>
                <div style={{ color:'#8B7355', fontSize:12, marginBottom:8 }}>{label}</div>
                <div style={{ fontSize:28, fontWeight:700, color:'#2C2416' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'stellen' && (
        <div style={{ padding:'0 16px 24px' }}>
          {gemeindeStellen.length === 0 ? (
            <EmptyState icon="📍" text="Noch keine eigenen Stellen" sub="Gemeinden können hier selbst Aktionen und Ehrenamtsangebote veröffentlichen." />
          ) : gemeindeStellen.map((s) => (
            <div key={s.id || s.titel} style={{ background:'#FAF7F2', borderRadius:18, padding:18, marginBottom:12, border:'1px solid #E6D9C2' }}>
              <div style={{ fontWeight:700, color:'#2C2416' }}>{s.titel}</div>
              <div style={{ fontSize:13, color:'#8B7355', marginTop:6 }}>{s.beschreibung}</div>
              <div style={{ fontSize:12, color:'#8B7355', marginTop:8 }}>{s.plz || user?.plz || ''} · {(s.termine || []).length} Termin(e)</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'erstellen' && (
        <div style={{ padding:'0 16px 24px' }}>
          <div style={{ background:'#FAF7F2', borderRadius:18, padding:18, border:'1px solid #E6D9C2' }}>
            <Input label="Titel" value={form.titel} onChange={(e) => setForm((f) => ({...f, titel:e.target ? e.target.value : e}))} />
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#8B7355', marginBottom:8 }}>Beschreibung</div>
              <textarea value={form.beschreibung} onChange={(e) => setForm((f) => ({...f, beschreibung:e.target.value}))} rows={4} style={{ width:'100%', borderRadius:14, border:'1px solid #D8CBB6', padding:12, fontFamily:'inherit' }} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <Input label="Kategorie" value={form.kategorie} onChange={(e) => setForm((f)=>({...f, kategorie:e.target ? e.target.value : e}))} />
              <Input label="PLZ" value={form.plz} onChange={(e) => setForm((f)=>({...f, plz:e.target ? e.target.value : e}))} />
              <Input label="Standort" value={form.standort} onChange={(e) => setForm((f)=>({...f, standort:e.target ? e.target.value : e}))} />
              <Input label="Ansprechpartner" value={form.ansprechpartner} onChange={(e) => setForm((f)=>({...f, ansprechpartner:e.target ? e.target.value : e}))} />
            </div>
            <SectionLabel>Termine</SectionLabel>
            {form.termine.map((t, idx) => (
              <div key={idx} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 90px', gap:8, marginBottom:8 }}>
                <input type="date" value={t.datum} onChange={(e)=>setForm((f)=>({...f, termine:f.termine.map((x,i)=>i===idx?{...x, datum:e.target.value}:x)}))} style={{borderRadius:12,border:'1px solid #D8CBB6',padding:10}} />
                <input type="time" value={t.startzeit} onChange={(e)=>setForm((f)=>({...f, termine:f.termine.map((x,i)=>i===idx?{...x, startzeit:e.target.value}:x)}))} style={{borderRadius:12,border:'1px solid #D8CBB6',padding:10}} />
                <input type="time" value={t.endzeit} onChange={(e)=>setForm((f)=>({...f, termine:f.termine.map((x,i)=>i===idx?{...x, endzeit:e.target.value}:x)}))} style={{borderRadius:12,border:'1px solid #D8CBB6',padding:10}} />
                <input type="number" min="1" value={t.plaetze} onChange={(e)=>setForm((f)=>({...f, termine:f.termine.map((x,i)=>i===idx?{...x, plaetze:Number(e.target.value)}:x)}))} style={{borderRadius:12,border:'1px solid #D8CBB6',padding:10}} />
              </div>
            ))}
            <button onClick={()=>setForm((f)=>({...f, termine:[...f.termine, defaultTermin()]}))} style={{ border:'none', background:'#EFE8DB', borderRadius:14, padding:'10px 14px', cursor:'pointer', fontFamily:'inherit', marginBottom:14 }}>+ Termin hinzufügen</button>
            <BigButton onClick={handleSave} green>Als Gemeinde-Stelle speichern</BigButton>
          </div>
        </div>
      )}

      {tab === 'organisationen' && (
        <div style={{ padding:'0 16px 24px' }}>
          {organisationen.length === 0 ? (
            <EmptyState icon="🏢" text="Noch keine Organisationen" sub="Hier erscheinen Vereine und Organisationen deiner Gemeinde." />
          ) : organisationen.map((org)=>(
            <div key={org.id || org.name} style={{ background:'#FAF7F2', borderRadius:18, padding:16, marginBottom:10, border:'1px solid #E6D9C2' }}>
              <div style={{ fontWeight:700 }}>{org.name || org.vereinsname}</div>
              <div style={{ fontSize:12, color:'#8B7355' }}>{org.plz || ''} · {org.ort || ''}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'postfach' && (
        <div style={{ padding:'0 16px 24px' }}>
          {inbox.length === 0 ? (
            <EmptyState icon="📬" text="Keine offenen Nachrichten" sub="Partneranfragen und Hinweise landen hier." />
          ) : inbox.map((msg, idx)=>(
            <div key={msg.id || idx} style={{ background:'#FAF7F2', borderRadius:18, padding:16, marginBottom:10, border:'1px solid #E6D9C2' }}>
              <div style={{ fontWeight:700 }}>{msg.title || msg.betreff || 'Anfrage'}</div>
              <div style={{ fontSize:12, color:'#8B7355', margin:'4px 0 8px' }}>{msg.email || msg.absender || 'unbekannt'}</div>
              <div style={{ fontSize:13, color:'#5C4A32' }}>{msg.message || msg.text || ''}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'csr' && (
        <div style={{ padding:'0 16px 24px' }}>
          <div style={{ background:'#FAF7F2', borderRadius:18, padding:18, border:'1px solid #E6D9C2' }}>
            <SectionLabel>CSR-Report</SectionLabel>
            <div style={{ color:'#5C4A32', fontSize:14, lineHeight:1.6 }}>
              Dieser Bereich ist vorbereitet für kommunale Auswertungen, Partner-Nachweise und spätere Reporting-Exports.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

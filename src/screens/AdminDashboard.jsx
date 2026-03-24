
import React, { useMemo, useState } from 'react';
import { Header, Input, SectionLabel, EmptyState,chip } from '../components/ui';

export default function AdminDashboard({
  gemeinden = [],
  organisationen = [],
  freiwillige = [],
  stellen = [],
  anfragen = [],
  onBack,
  logout,
}) {
  const [plzFilter, setPlzFilter] = useState('');

  const normalize = (v) => String(v || '').trim();

  const topGemeinden = useMemo(() => {
    const map = new Map();
    gemeinden.forEach((g) => {
      map.set(g.id || g.name || g.ort, {
        id: g.id || g.name || g.ort,
        name: g.name || g.ort || 'Gemeinde',
        freiwillige: 0,
        organisationen: 0,
        stellen: 0,
      });
    });
    freiwillige.forEach((f) => {
      const key = f.gemeinde_id || f.gemeinde || f.ort;
      if (!map.has(key)) map.set(key, { id:key, name:key || 'Gemeinde', freiwillige:0, organisationen:0, stellen:0 });
      map.get(key).freiwillige += 1;
    });
    organisationen.forEach((o) => {
      const key = o.gemeinde_id || o.gemeinde || o.ort;
      if (!map.has(key)) map.set(key, { id:key, name:key || 'Gemeinde', freiwillige:0, organisationen:0, stellen:0 });
      map.get(key).organisationen += 1;
    });
    stellen.forEach((s) => {
      const key = s.gemeinde_id || s.gemeinde || s.ort;
      if (!map.has(key)) map.set(key, { id:key, name:key || 'Gemeinde', freiwillige:0, organisationen:0, stellen:0 });
      map.get(key).stellen += 1;
    });
    return [...map.values()].sort((a,b) => (b.freiwillige + b.stellen) - (a.freiwillige + a.stellen)).slice(0,5);
  }, [gemeinden, organisationen, freiwillige, stellen]);

  const plzRows = useMemo(() => {
    const buckets = new Map();
    const add = (type, item) => {
      const key = normalize(item.plz) || 'ohne PLZ';
      if (!buckets.has(key)) buckets.set(key, { plz:key, freiwillige:0, organisationen:0, stellen:0 });
      buckets.get(key)[type] += 1;
    };
    freiwillige.forEach((x) => add('freiwillige', x));
    organisationen.forEach((x) => add('organisationen', x));
    stellen.forEach((x) => add('stellen', x));
    return [...buckets.values()].filter((row) => !plzFilter || row.plz.startsWith(normalize(plzFilter))).sort((a,b) => a.plz.localeCompare(b.plz));
  }, [freiwillige, organisationen, stellen, plzFilter]);

  return (
    <div>
      <Header title="Admin-Dashboard" subtitle="Systemübersicht" onBack={onBack} onLogout={logout} />
      <div style={{ padding:'0 16px 24px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:18 }}>
          {[
            ['Gemeinden', gemeinden.length],
            ['Organisationen', organisationen.length],
            ['Freiwillige', freiwillige.length],
            ['Stellen', stellen.length],
          ].map(([label, value]) => (
            <div key={label} style={{ background:'#FAF7F2', borderRadius:18, padding:18, border:'1px solid #E6D9C2' }}>
              <div style={{ color:'#8B7355', fontSize:12, marginBottom:8 }}>{label}</div>
              <div style={{ fontSize:28, fontWeight:700 }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ background:'#FAF7F2', borderRadius:18, padding:18, border:'1px solid #E6D9C2', marginBottom:18 }}>
          <SectionLabel>Top 5 Gemeinden</SectionLabel>
          {topGemeinden.length === 0 ? (
            <EmptyState icon="📊" text="Noch keine Gemeindedaten" sub="Sobald Gemeinden, Freiwillige und Stellen vorhanden sind, erscheint hier das Ranking." />
          ) : topGemeinden.map((g) => (
            <div key={g.id} style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr 1fr', gap:10, padding:'10px 0', borderBottom:'1px solid #EFE8DB' }}>
              <div style={{ fontWeight:700 }}>{g.name}</div>
              <div style={{ fontSize:12, color:'#8B7355' }}>{g.freiwillige} Freiwillige</div>
              <div style={{ fontSize:12, color:'#8B7355' }}>{g.organisationen} Organisationen</div>
              <div style={{ fontSize:12, color:'#8B7355' }}>{g.stellen} Stellen</div>
            </div>
          ))}
        </div>

        <div style={{ background:'#FAF7F2', borderRadius:18, padding:18, border:'1px solid #E6D9C2', marginBottom:18 }}>
          <SectionLabel>PLZ-Analyse</SectionLabel>
          <Input label="PLZ-Filter" value={plzFilter} onChange={(e)=>setPlzFilter(e.target ? e.target.value : e)} />
          {plzRows.length === 0 ? (
            <EmptyState icon="📍" text="Keine Daten zur gewählten PLZ" sub="Passe den Filter an oder ergänze Gemeinden und Nutzer." />
          ) : plzRows.map((row) => (
            <div key={row.plz} style={{ display:'grid', gridTemplateColumns:'90px 1fr 1fr 1fr', gap:10, padding:'10px 0', borderBottom:'1px solid #EFE8DB' }}>
              <div style={{ fontWeight:700 }}>{row.plz}</div>
              <div style={{ fontSize:12, color:'#8B7355' }}>{row.freiwillige} Freiwillige</div>
              <div style={{ fontSize:12, color:'#8B7355' }}>{row.organisationen} Organisationen</div>
              <div style={{ fontSize:12, color:'#8B7355' }}>{row.stellen} Stellen</div>
            </div>
          ))}
        </div>

        <div style={{ background:'#FAF7F2', borderRadius:18, padding:18, border:'1px solid #E6D9C2' }}>
          <SectionLabel>Offene Anfragen</SectionLabel>
          {anfragen.length === 0 ? (
            <EmptyState icon="📬" text="Keine offenen Anfragen" sub="Partneranfragen und Kontaktformulare können hier zentral bearbeitet werden." />
          ) : anfragen.filter((a) => !plzFilter || String(a.plz || '').startsWith(plzFilter)).map((a, idx) => (
            <div key={a.id || idx} style={{ padding:'10px 0', borderBottom:'1px solid #EFE8DB' }}>
              <div style={{ fontWeight:700 }}>{a.title || a.betreff || 'Anfrage'}</div>
              <div style={{ fontSize:12, color:'#8B7355' }}>{a.email || a.absender || 'unbekannt'} · {a.plz || 'ohne PLZ'}</div>
              <div style={{ fontSize:13, color:'#5C4A32', marginTop:6 }}>{a.message || a.text || ''}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


import React, { useEffect, useMemo, useState } from 'react';
import MeineVereinePanel from '../components/messages/MeineVereinePanel';
import MessageThreadView from '../components/messages/MessageThreadView';
import { supabase } from '../core/shared';
import { Header, Input, BigButton, SectionLabel, EmptyState } from '../components/ui';

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
  onSaveProfile,
  onChangePassword,
  showToast,
}) {
  const [tab, setTab] = useState('dashboard');
  const [settingsForm, setSettingsForm] = useState({
    name: user?.name || '',
    ort: user?.ort || '',
    plz: user?.plz || '',
    kontakt_email: user?.kontakt_email || user?.email || '',
    telefon: user?.telefon || '',
    website: user?.website || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    password: '',
    confirmPassword: '',
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [passwordError, setPasswordError] = useState('');
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

  const [supportThreadId, setSupportThreadId] = useState(null);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportError, setSupportError] = useState('');


  const gemeindeStellen = useMemo(
    () => stellen.filter((s) => s.gemeinde_id === user?.id),
    [stellen, user]
  );

  const totalBewerbungen = gemeindeStellen.reduce(
    (sum, s) => sum + (s.termine || []).reduce((tSum, t) => tSum + ((t.bewerbungen || []).length), 0),
    0
  );

  const dashboardKpis = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const einsaetzeDiesenMonat = gemeindeStellen.reduce((sum, stelle) => {
      const termineImMonat = (stelle.termine || []).filter((termin) => {
        if (!termin?.datum) return false;
        const d = new Date(termin.datum);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });
      return sum + termineImMonat.length;
    }, 0);

    const helperSet = new Set();
    gemeindeStellen.forEach((stelle) => {
      (stelle.termine || []).forEach((termin) => {
        (termin.bewerbungen || []).forEach((bewerbung) => {
          const key =
            bewerbung?.freiwilliger_id ||
            bewerbung?.freiwilliger_email ||
            bewerbung?.email;
          if (key) helperSet.add(key);
        });
      });
    });

    let angemeldetVergangen = 0;
    let erschienenVergangen = 0;

    gemeindeStellen.forEach((stelle) => {
      (stelle.termine || []).forEach((termin) => {
        if (!termin?.datum) return;

        const terminEnde = new Date(
          `${termin.datum}T${termin.endzeit || termin.startzeit || '23:59'}`
        );

        if (terminEnde > now) return;

        const bewerbungen = termin.bewerbungen || [];
        angemeldetVergangen += bewerbungen.length;
        erschienenVergangen += bewerbungen.filter((bewerbung) => bewerbung?.bestaetigt === true).length;
      });
    });

    const verlässlichkeit =
      angemeldetVergangen > 0
        ? Math.round((erschienenVergangen / angemeldetVergangen) * 100)
        : null;

    const vereinsRanking = {};
    gemeindeStellen.forEach((stelle) => {
      const vereinName =
        stelle?.vereine?.name ||
        stelle?.verein_name ||
        (stelle?.created_by_type === 'gemeinde' ? 'Gemeinde' : null);

      if (!vereinName) return;

      vereinsRanking[vereinName] = (vereinsRanking[vereinName] || 0) + (stelle.termine?.length || 0);
    });

    const aktivsterVerein = Object.entries(vereinsRanking).sort((a, b) => b[1] - a[1])[0] || null;

    return {
      einsaetzeDiesenMonat,
      engagierteHelfer: helperSet.size,
      verlässlichkeit,
      aktivsterVereinName: aktivsterVerein?.[0] || null,
      aktivsterVereinWert: aktivsterVerein?.[1] || 0,
    };
  }, [gemeindeStellen]);

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


  const handleSettingsSave = async () => {
    setSettingsError('');
    setSettingsLoading(true);

    const result = await onSaveProfile?.(settingsForm);

    setSettingsLoading(false);

    if (!result?.success) {
      setSettingsError(result?.message || 'Profil konnte nicht gespeichert werden.');
      return;
    }

    showToast?.('✓ Gemeinde-Profil gespeichert!');
  };

  const handlePasswordSave = async () => {
    setPasswordError('');

    if (!passwordForm.password || !passwordForm.confirmPassword) {
      setPasswordError('Bitte beide Passwortfelder ausfüllen.');
      return;
    }

    if (passwordForm.password.length < 8) {
      setPasswordError('Das Passwort muss mindestens 8 Zeichen haben.');
      return;
    }

    if (passwordForm.password !== passwordForm.confirmPassword) {
      setPasswordError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setPasswordLoading(true);
    const result = await onChangePassword?.(passwordForm.password);
    setPasswordLoading(false);

    if (!result?.success) {
      setPasswordError(result?.message || 'Passwort konnte nicht geändert werden.');
      return;
    }

    setPasswordForm({ password: '', confirmPassword: '' });
    showToast?.('✓ Passwort erfolgreich geändert!');
  };


  const supportOrganisation = {
    type: 'gemeinde',
    name: settingsForm.name || user?.name || user?.ort || 'Gemeinde',
    email: settingsForm.kontakt_email || user?.kontakt_email || user?.email || '',
  };

  const ensureSupportThread = async () => {
    if (!user?.id) return;
    try {
      setSupportLoading(true);
      setSupportError('');

      const { data: existing, error: existingError } = await supabase
        .from('message_threads')
        .select('id')
        .eq('thread_type', 'support')
        .eq('gemeinde_id', user.id)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing?.id) {
        setSupportThreadId(existing.id);
        return;
      }

      const { data: created, error: createError } = await supabase
        .from('message_threads')
        .insert([
          {
            thread_type: 'support',
            gemeinde_id: user.id,
            last_message_at: new Date().toISOString(),
          },
        ])
        .select('id')
        .single();

      if (createError) throw createError;
      setSupportThreadId(created?.id || null);
    } catch (err) {
      console.error('Fehler beim Laden des Support-Threads:', err);
      setSupportError(err.message || 'Support konnte nicht geladen werden.');
    } finally {
      setSupportLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'support' && !supportThreadId) {
      ensureSupportThread();
    }
  }, [tab, supportThreadId, user?.id]);

  return (
    <div>
      <Header title="Gemeinde-Dashboard" subtitle={user?.name || user?.ort || 'Gemeinde'} onBack={onBack} onLogout={logout} />
      <div style={{ display:'flex', gap:8, padding:'0 16px 16px', flexWrap:'wrap' }}>
        {[
          ['dashboard','Übersicht'],
          ['stellen','Eigene Stellen'],
          ['erstellen','Stelle erstellen'],
          ['organisationen','Organisationen'],
          ['support','Support'],
          ['csr','CSR-Report'],
          ['settings','Einstellungen'],
        ].map(([key,label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ border:'none', borderRadius:18, padding:'8px 14px', cursor:'pointer', background: tab===key ? '#C8A96E' : '#EFE8DB', color: tab===key ? '#1A1208' : '#5C4A32', fontFamily:'inherit', fontSize:13, fontWeight:600 }}>{label}</button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div style={{ padding:'0 16px 24px' }}>
          <div
            style={{
              background:'#FAF7F2',
              borderRadius:20,
              padding:18,
              border:'1px solid #E6D9C2',
              marginBottom:14
            }}
          >
            <div style={{ fontSize:20, fontWeight:700, color:'#2C2416', marginBottom:6 }}>
              Wirkung auf einen Blick
            </div>
            <div style={{ fontSize:13, color:'#8B7355', lineHeight:1.6 }}>
              Hier sehen Sie auf einen Blick, wie viel Engagement in Ihrer Gemeinde aktuell zusammenkommt.
            </div>
          </div>

          <div
            style={{
              display:'grid',
              gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))',
              gap:12,
              marginBottom:14
            }}
          >
            <div style={{ background:'#FAF7F2', borderRadius:18, padding:18, border:'1px solid #E6D9C2' }}>
              <div style={{ fontSize:34, fontWeight:700, color:'#2C2416', marginBottom:6 }}>
                {dashboardKpis.einsaetzeDiesenMonat}
              </div>
              <div style={{ color:'#2C2416', fontSize:15, fontWeight:700, marginBottom:4 }}>Einsätze</div>
              <div style={{ color:'#8B7355', fontSize:12 }}>diesen Monat</div>
            </div>

            <div style={{ background:'#FAF7F2', borderRadius:18, padding:18, border:'1px solid #E6D9C2' }}>
              <div style={{ fontSize:34, fontWeight:700, color:'#2C2416', marginBottom:6 }}>
                {dashboardKpis.engagierteHelfer}
              </div>
              <div style={{ color:'#2C2416', fontSize:15, fontWeight:700, marginBottom:4 }}>Engagierte Helfer</div>
              <div style={{ color:'#8B7355', fontSize:12 }}>haben sich beteiligt</div>
            </div>

            <div style={{ background:'#FAF7F2', borderRadius:18, padding:18, border:'1px solid #E6D9C2' }}>
              <div style={{ fontSize:34, fontWeight:700, color:'#2C2416', marginBottom:6 }}>
                {dashboardKpis.verlässlichkeit === null ? '–' : `${dashboardKpis.verlässlichkeit} %`}
              </div>
              <div style={{ color:'#2C2416', fontSize:15, fontWeight:700, marginBottom:4 }}>Verlässlichkeit</div>
              <div style={{ color:'#8B7355', fontSize:12 }}>
                {dashboardKpis.verlässlichkeit === null ? 'noch nicht genug Daten' : 'sind erschienen'}
              </div>
            </div>

            <div style={{ background:'#FAF7F2', borderRadius:18, padding:18, border:'1px solid #E6D9C2' }}>
              <div style={{ fontSize:24, fontWeight:700, color:'#2C2416', marginBottom:6, lineHeight:1.25 }}>
                {dashboardKpis.aktivsterVereinName || '–'}
              </div>
              <div style={{ color:'#2C2416', fontSize:15, fontWeight:700, marginBottom:4 }}>Aktivster Verein</div>
              <div style={{ color:'#8B7355', fontSize:12 }}>
                {dashboardKpis.aktivsterVereinName
                  ? `${dashboardKpis.aktivsterVereinWert} Einsatz${dashboardKpis.aktivsterVereinWert === 1 ? '' : 'e'} im System`
                  : 'noch keine Auswertung möglich'}
              </div>
            </div>
          </div>

          <div style={{ background:'#FAF7F2', borderRadius:18, padding:18, border:'1px solid #E6D9C2' }}>
            <div style={{ fontSize:15, fontWeight:700, color:'#2C2416', marginBottom:6 }}>Nächster Schritt</div>
            <div style={{ color:'#8B7355', fontSize:13, lineHeight:1.6 }}>
              Für die detaillierte Entwicklung, Teilnahmequoten und Vereinsaktivität steht der CSR-Bereich bereit.
            </div>
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
    <MeineVereinePanel />
  </div>
)}

      {tab === 'support' && (
        <div style={{ padding:'0 16px 24px' }}>
          <div style={{ background:'#FAF7F2', borderRadius:18, padding:18, border:'1px solid #E6D9C2', marginBottom:14 }}>
            <div style={{ fontSize:18, fontWeight:700, color:'#2C2416', marginBottom:8 }}>Support an Civico</div>
            <div style={{ fontSize:13, color:'#8B7355', lineHeight:1.6 }}>
              Stelle hier Rückfragen, technische Probleme oder organisatorische Anliegen direkt an den Admin.
            </div>
          </div>

          {supportLoading ? (
            <div style={{ background:'#FAF7F2', borderRadius:18, padding:18, border:'1px solid #E6D9C2' }}>
              <div style={{ color:'#8B7355', fontSize:13 }}>Lade Support-Verlauf...</div>
            </div>
          ) : supportError ? (
            <div style={{ background:'#FFF4F2', borderRadius:18, padding:18, border:'1px solid #F0C9C3' }}>
              <div style={{ color:'#B53A2D', fontSize:13, fontWeight:700, marginBottom:10 }}>{supportError}</div>
              <button
                onClick={ensureSupportThread}
                style={{ border:'none', background:'#2C2416', color:'#fff', borderRadius:12, padding:'10px 14px', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}
              >
                Erneut versuchen
              </button>
            </div>
          ) : supportThreadId ? (
            <div style={{ background:'#FAF7F2', borderRadius:18, padding:18, border:'1px solid #E6D9C2' }}>
              <MessageThreadView
                threadId={supportThreadId}
                currentUserRole="gemeinde"
                contextType="support"
                organisation={supportOrganisation}
                onMessageSent={ensureSupportThread}
              />
            </div>
          ) : (
            <EmptyState icon="💬" text="Noch kein Support-Thread" sub="Sobald der Support initialisiert ist, kannst du hier direkt schreiben." />
          )}

          {inbox.length > 0 && (
            <div style={{ marginTop:14, background:'#FAF7F2', borderRadius:18, padding:18, border:'1px solid #E6D9C2' }}>
              <SectionLabel>Frühere Hinweise</SectionLabel>
              {inbox.map((msg, idx)=>(
                <div key={msg.id || idx} style={{ background:'#F7F1E6', borderRadius:14, padding:14, marginBottom:10, border:'1px solid #E6D9C2' }}>
                  <div style={{ fontWeight:700 }}>{msg.title || msg.betreff || 'Hinweis'}</div>
                  <div style={{ fontSize:12, color:'#8B7355', margin:'4px 0 8px' }}>{msg.email || msg.absender || 'unbekannt'}</div>
                  <div style={{ fontSize:13, color:'#5C4A32' }}>{msg.message || msg.text || ''}</div>
                </div>
              ))}
            </div>
          )}
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


      {tab === 'settings' && (
        <div style={{ padding:'0 16px 24px' }}>
          <div style={{ background:'#FAF7F2', borderRadius:18, padding:18, border:'1px solid #E6D9C2', marginBottom:14 }}>
            <SectionLabel>Gemeinde-Profil</SectionLabel>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <Input label="Name" value={settingsForm.name} onChange={(e) => setSettingsForm((f)=>({...f, name:e.target ? e.target.value : e}))} />
              <Input label="Ort" value={settingsForm.ort} onChange={(e) => setSettingsForm((f)=>({...f, ort:e.target ? e.target.value : e}))} />
              <Input label="PLZ" value={settingsForm.plz} onChange={(e) => setSettingsForm((f)=>({...f, plz:e.target ? e.target.value : e}))} />
              <Input label="Kontakt-E-Mail" value={settingsForm.kontakt_email} onChange={(e) => setSettingsForm((f)=>({...f, kontakt_email:e.target ? e.target.value : e}))} />
              <Input label="Telefon" value={settingsForm.telefon} onChange={(e) => setSettingsForm((f)=>({...f, telefon:e.target ? e.target.value : e}))} />
              <Input label="Website" value={settingsForm.website} onChange={(e) => setSettingsForm((f)=>({...f, website:e.target ? e.target.value : e}))} />
            </div>
            {settingsError ? (
              <div style={{ color:'#B53A2D', fontSize:13, fontWeight:700, marginBottom:12 }}>{settingsError}</div>
            ) : null}
            <BigButton onClick={handleSettingsSave} green>
              {settingsLoading ? 'Speichern...' : 'Gemeinde-Profil speichern'}
            </BigButton>
          </div>

          <div style={{ background:'#FAF7F2', borderRadius:18, padding:18, border:'1px solid #E6D9C2' }}>
            <SectionLabel>Passwort ändern</SectionLabel>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#8B7355', marginBottom:8 }}>NEUES PASSWORT</div>
              <input
                type="password"
                value={passwordForm.password}
                onChange={(e) => setPasswordForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Mindestens 8 Zeichen"
                style={{ width:'100%', borderRadius:14, border:'1px solid #D8CBB6', padding:12, fontFamily:'inherit', boxSizing:'border-box' }}
              />
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#8B7355', marginBottom:8 }}>PASSWORT WIEDERHOLEN</div>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="Passwort wiederholen"
                style={{ width:'100%', borderRadius:14, border:'1px solid #D8CBB6', padding:12, fontFamily:'inherit', boxSizing:'border-box' }}
              />
            </div>
            {passwordError ? (
              <div style={{ color:'#B53A2D', fontSize:13, fontWeight:700, marginBottom:12 }}>{passwordError}</div>
            ) : null}
            <BigButton onClick={handlePasswordSave}>
              {passwordLoading ? 'Speichern...' : 'Passwort ändern'}
            </BigButton>
          </div>
        </div>
      )}
    </div>
  );
}

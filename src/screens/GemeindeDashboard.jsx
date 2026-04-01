
import React, { useEffect, useMemo, useState } from 'react';
import MeineVereinePanel from '../components/messages/MeineVereinePanel';
import MessageThreadView from '../components/messages/MessageThreadView';
import { supabase, KATEGORIEN, formatDate, isTerminNochNichtGestartet, isTerminAktuell } from '../core/shared';
import { Header, Input, BigButton, SectionLabel, EmptyState } from '../components/ui';

function defaultTermin() {
  return { datum: '', startzeit: '', endzeit: '', plaetze: 5 };
}

function buildEditForm(stelle) {
  return {
    titel: stelle?.titel || '',
    beschreibung: stelle?.beschreibung || '',
    typ: stelle?.typ || 'event',
    kategorie: stelle?.kategorie || 'sozial',
    aufwand:
      stelle?.typ === 'dauerhaft' && stelle?.aufwand
        ? String(stelle.aufwand).replace('h / Woche', '').trim()
        : '',
    standort: stelle?.standort || '',
    ansprechpartner: stelle?.ansprechpartner || '',
    kontakt_email: stelle?.kontakt_email || '',
    plz: stelle?.plz || '',
    dringend: Boolean(stelle?.dringend),
    termine: (stelle?.termine || []).map((t) => ({
      id: t.id,
      datum: t.datum || '',
      startzeit: t.startzeit || '',
      endzeit: t.endzeit || '',
      plaetze: t.gesamt_plaetze || t.freie_plaetze || 5,
      absagen: false,
    })),
  };
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
  onReloadStellen,
  showToast,
}) {
  const [tab, setTab] = useState('dashboard');
  const [selectedStelle, setSelectedStelle] = useState(null);
  const [editForm, setEditForm] = useState(null);
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
  const [detailActionLoading, setDetailActionLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [form, setForm] = useState({
    titel: '',
    beschreibung: '',
    typ: 'event',
    kategorie: 'sozial',
    aufwand: '',
    standort: '',
    ansprechpartner: '',
    kontakt_email: '',
    plz: user?.plz || '',
    dringend: false,
    termine: [defaultTermin()],
  });

  const [supportThreadId, setSupportThreadId] = useState(null);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportError, setSupportError] = useState('');

  useEffect(() => {
    setSettingsForm({
      name: user?.name || '',
      ort: user?.ort || '',
      plz: user?.plz || '',
      kontakt_email: user?.kontakt_email || user?.email || '',
      telefon: user?.telefon || '',
      website: user?.website || '',
    });
    setForm((prev) => ({ ...prev, plz: user?.plz || '' }));
  }, [user]);

  const gemeindeStellen = useMemo(
    () => stellen.filter((s) => s.gemeinde_id === user?.id),
    [stellen, user]
  );

  useEffect(() => {
    if (!selectedStelle?.id) return;
    const fresh = gemeindeStellen.find((s) => s.id === selectedStelle.id);
    if (fresh) {
      setSelectedStelle(fresh);
    }
  }, [gemeindeStellen, selectedStelle?.id]);

  const totalBewerbungen = gemeindeStellen.reduce(
    (sum, s) => sum + (s.termine || []).reduce((tSum, t) => tSum + ((t.bewerbungen || []).length), 0),
    0
  );

  const handleHeaderBack = () => {
    if (tab === 'stellen-detail' || tab === 'stellen-bearbeiten') {
      setTab('stellen');
      return;
    }
    if (tab !== 'dashboard') {
      setTab('dashboard');
      return;
    }
  };

  const refreshStellen = async () => {
    await onReloadStellen?.();
  };

  const openStelleDetail = (stelle) => {
    setSelectedStelle(stelle);
    setTab('stellen-detail');
  };

  const openStelleEdit = (stelle) => {
    setSelectedStelle(stelle);
    setEditForm(buildEditForm(stelle));
    setTab('stellen-bearbeiten');
  };

  const handleSave = async () => {
    const payload = {
      ...form,
      created_by_type: 'gemeinde',
      gemeinde_id: user?.id,
      plz: form.plz || user?.plz || '',
    };
    await onCreateStelle?.(payload);
    setForm({
      titel: '',
      beschreibung: '',
      typ: 'event',
      kategorie: 'sozial',
      aufwand: '',
      standort: '',
      ansprechpartner: '',
      kontakt_email: '',
      plz: user?.plz || '',
      dringend: false,
      termine: [defaultTermin()],
    });
    await refreshStellen();
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

  const handleBestaetigen = async (bewerbungId, erschienen) => {
    try {
      setDetailActionLoading(true);
      const { error } = await supabase
        .from('bewerbungen')
        .update({ bestaetigt: erschienen, nicht_erschienen: !erschienen })
        .eq('id', bewerbungId);
      if (error) throw error;
      showToast?.(erschienen ? '✓ Erschienen bestätigt' : '✗ Nicht erschienen bestätigt');
      await refreshStellen();
    } catch (err) {
      console.error(err);
      showToast?.('Fehler beim Bestätigen.', '#E85C5C');
    } finally {
      setDetailActionLoading(false);
    }
  };

  const handleStornieren = async (bewerbungId, terminId) => {
    try {
      setDetailActionLoading(true);
      const { error: deleteError } = await supabase.from('bewerbungen').delete().eq('id', bewerbungId);
      if (deleteError) throw deleteError;

      const { error: incError } = await supabase.rpc('increment_plaetze', { termin_id: terminId });
      if (incError) throw incError;

      showToast?.('✓ Anmeldung storniert.', '#E85C5C');
      await refreshStellen();
    } catch (err) {
      console.error(err);
      showToast?.('Fehler beim Stornieren.', '#E85C5C');
    } finally {
      setDetailActionLoading(false);
    }
  };

  const handleTerminAbsagen = async (terminId) => {
    try {
      setDetailActionLoading(true);
      const { error: bewerbungenError } = await supabase.from('bewerbungen').delete().eq('termin_id', terminId);
      if (bewerbungenError) throw bewerbungenError;

      const { error: terminError } = await supabase.from('termine').delete().eq('id', terminId);
      if (terminError) throw terminError;

      showToast?.('✓ Termin abgesagt.', '#E85C5C');
      await refreshStellen();
    } catch (err) {
      console.error(err);
      showToast?.('Fehler beim Absagen.', '#E85C5C');
    } finally {
      setDetailActionLoading(false);
    }
  };

  const handleTerminVerschieben = async (terminId, datum, startzeit, endzeit) => {
    try {
      setDetailActionLoading(true);
      const { error } = await supabase
        .from('termine')
        .update({ datum, startzeit, endzeit: endzeit || null })
        .eq('id', terminId);
      if (error) throw error;

      showToast?.('✓ Termin verschoben!');
      await refreshStellen();
    } catch (err) {
      console.error(err);
      showToast?.('Fehler beim Verschieben.', '#E85C5C');
    } finally {
      setDetailActionLoading(false);
    }
  };

  const handleDeleteStelle = async () => {
    if (!selectedStelle?.id) return;
    try {
      setDetailActionLoading(true);
      const { error: bewerbungenError } = await supabase.from('bewerbungen').delete().eq('stelle_id', selectedStelle.id);
      if (bewerbungenError) throw bewerbungenError;

      const { error: termineError } = await supabase.from('termine').delete().eq('stelle_id', selectedStelle.id);
      if (termineError) throw termineError;

      const { error: stelleError } = await supabase.from('stellen').delete().eq('id', selectedStelle.id);
      if (stelleError) throw stelleError;

      showToast?.('Stelle gelöscht.', '#E85C5C');
      setSelectedStelle(null);
      await refreshStellen();
      setTab('stellen');
    } catch (err) {
      console.error(err);
      showToast?.('Fehler beim Löschen.', '#E85C5C');
    } finally {
      setDetailActionLoading(false);
    }
  };

  const handleEditSave = async () => {
    if (!selectedStelle?.id || !editForm) return;

    if (!editForm.titel || !editForm.beschreibung) {
      showToast?.('Titel und Beschreibung ausfüllen.', '#E85C5C');
      return;
    }

    try {
      setEditLoading(true);

      const aufwandFormatted =
        editForm.typ === 'dauerhaft' && editForm.aufwand
          ? `${editForm.aufwand}h / Woche`
          : '';

      const { error: stelleError } = await supabase
        .from('stellen')
        .update({
          titel: editForm.titel,
          beschreibung: editForm.beschreibung,
          kategorie: editForm.kategorie,
          typ: editForm.typ,
          aufwand: aufwandFormatted,
          standort: editForm.standort,
          plz: editForm.plz,
          ansprechpartner: editForm.ansprechpartner || null,
          kontakt_email: editForm.kontakt_email || null,
          dringend: Boolean(editForm.dringend),
          ort: user?.ort || user?.name || '',
        })
        .eq('id', selectedStelle.id);

      if (stelleError) throw stelleError;

      const abgesagteTermine = editForm.termine.filter((t) => t.id && t.absagen);
      for (const termin of abgesagteTermine) {
        const { error: bewerbungenError } = await supabase.from('bewerbungen').delete().eq('termin_id', termin.id);
        if (bewerbungenError) throw bewerbungenError;

        const { error: terminDeleteError } = await supabase.from('termine').delete().eq('id', termin.id);
        if (terminDeleteError) throw terminDeleteError;
      }

      const bestehendeTermine = editForm.termine.filter((t) => t.id && !t.absagen);
      for (const termin of bestehendeTermine) {
        const { error: terminUpdateError } = await supabase
          .from('termine')
          .update({
            datum: termin.datum,
            startzeit: termin.startzeit,
            endzeit: termin.endzeit || null,
            freie_plaetze: termin.plaetze,
            gesamt_plaetze: termin.plaetze,
          })
          .eq('id', termin.id);
        if (terminUpdateError) throw terminUpdateError;
      }

      const neueTermine = editForm.termine.filter((t) => !t.id && !t.absagen && t.datum);
      if (neueTermine.length) {
        const { error: neueTermineError } = await supabase.from('termine').insert(
          neueTermine.map((termin) => ({
            stelle_id: selectedStelle.id,
            datum: termin.datum,
            startzeit: termin.startzeit,
            endzeit: termin.endzeit || null,
            freie_plaetze: termin.plaetze,
            gesamt_plaetze: termin.plaetze,
          }))
        );
        if (neueTermineError) throw neueTermineError;
      }

      showToast?.('✓ Stelle aktualisiert!');
      await refreshStellen();
      setTab('stellen');
    } catch (err) {
      console.error(err);
      showToast?.('Fehler beim Speichern.', '#E85C5C');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div>
      <Header
        title="Gemeinde-Dashboard"
        subtitle={user?.name || user?.ort || 'Gemeinde'}
        onBack={handleHeaderBack}
        onLogout={logout}
      />

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
          <div style={{ background:'#FAF7F2', borderRadius:18, padding:18, border:'1px solid #E6D9C2', marginBottom:12 }}>
            <div style={{ fontSize:20, fontWeight:700, color:'#2C2416', marginBottom:6 }}>Wirkung in Ihrer Gemeinde</div>
            <div style={{ fontSize:13, color:'#8B7355', lineHeight:1.6 }}>
              Hier sehen Sie kompakt, wie viel Engagement aktuell über Civico in Ihrer Gemeinde sichtbar wird.
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12 }}>
            {[
              ['Einsätze', gemeindeStellen.length, 'aktuell aktiv'],
              ['Engagierte Helfer', totalBewerbungen, 'haben sich beteiligt'],
              ['Verlässlichkeit', '–', 'noch nicht genug Daten'],
              ['Aktivster Verein', '–', 'noch keine Auswertung möglich'],
            ].map(([label, value, sub]) => (
              <div key={label} style={{ background:'#FAF7F2', borderRadius:18, padding:18, border:'1px solid #E6D9C2' }}>
                <div style={{ fontSize:28, fontWeight:700, color:'#2C2416', marginBottom:8 }}>{value}</div>
                <div style={{ fontWeight:700, color:'#2C2416' }}>{label}</div>
                <div style={{ fontSize:12, color:'#8B7355', marginTop:4 }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'stellen' && (
        <div style={{ padding:'0 16px 24px' }}>
          {gemeindeStellen.length === 0 ? (
            <EmptyState icon="📍" text="Noch keine eigenen Stellen" sub="Gemeinden können hier selbst Aktionen und Ehrenamtsangebote veröffentlichen." />
          ) : gemeindeStellen.map((s) => {
            const gesamtAnmeldungen = (s.termine || []).reduce(
              (sum, t) => sum + (t.bewerbungen?.length || 0),
              0
            );
            return (
              <div key={s.id || s.titel} style={{ background:'#FAF7F2', borderRadius:18, padding:18, marginBottom:12, border:'1px solid #E6D9C2' }}>
                <div style={{ fontWeight:700, color:'#2C2416', fontSize:22 }}>{s.titel}</div>
                <div style={{ fontSize:13, color:'#8B7355', marginTop:6 }}>{s.beschreibung}</div>
                <div style={{ fontSize:12, color:'#8B7355', marginTop:8 }}>
                  📍 {s.ort || s.standort || user?.ort || ''} · 👥 {gesamtAnmeldungen} Anmeldungen · 📅 {(s.termine || []).length} Termin(e)
                </div>
                <div style={{ display:'flex', gap:8, marginTop:12 }}>
                  <button
                    onClick={() => openStelleDetail(s)}
                    style={{ flex:1, padding:'8px 10px', borderRadius:10, border:'1px solid #E0D8C8', background:'transparent', color:'#2C2416', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}
                  >
                    👥 Anmeldungen
                  </button>
                  <button
                    onClick={() => openStelleEdit(s)}
                    style={{ flex:1, padding:'8px 10px', borderRadius:10, border:'1px solid #5B9BD5', background:'transparent', color:'#5B9BD5', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}
                  >
                    ✏️ Bearbeiten
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'stellen-detail' && selectedStelle && (
        <div style={{ padding:'0 16px 24px' }}>
          <div style={{ background:'#FAF7F2', borderRadius:18, padding:18, marginBottom:12, border:'1px solid #E6D9C2' }}>
            <div style={{ fontSize:22, fontWeight:700, color:'#2C2416' }}>{selectedStelle.titel}</div>
            <div style={{ fontSize:13, color:'#8B7355', marginTop:6 }}>
              📍 {selectedStelle.ort || selectedStelle.standort || user?.ort || ''} · 👁️ {selectedStelle.aufrufe || 0} Aufrufe
            </div>
          </div>

          {(selectedStelle.termine || []).length === 0 ? (
            <EmptyState icon="📅" text="Keine Termine vorhanden" sub="Lege in der Bearbeitung neue Termine an." />
          ) : (
            selectedStelle.termine.map((termin) => {
              const istVergangen = !isTerminAktuell(termin);
              const nochNichtGestartet = isTerminNochNichtGestartet(termin);
              return (
                <div key={termin.id} style={{ background:'#FAF7F2', borderRadius:14, padding:14, marginBottom:12, border:'1px solid #E0D8C8' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <div style={{ fontWeight:'bold', color:'#2C2416' }}>
                      📅 {formatDate(termin.datum)} · 🕐 {termin.startzeit}{termin.endzeit ? ` – ${termin.endzeit}` : ''}
                    </div>
                    <div style={{ fontSize:11, color:istVergangen ? '#8B7355' : '#5B9BD5', fontWeight:'bold' }}>
                      {istVergangen ? 'Vergangen' : 'Bevorstehend'}
                    </div>
                  </div>

                  <div style={{ fontSize:12, color:'#3A7D44', marginBottom:10 }}>
                    {termin.freie_plaetze} Plätze frei
                  </div>

                  {nochNichtGestartet && (
                    <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                      <button
                        disabled={detailActionLoading}
                        onClick={() => {
                          const neuesDatum = window.prompt('Neues Datum (YYYY-MM-DD):', termin.datum || '');
                          if (!neuesDatum) return;
                          const neueStartzeit = window.prompt('Neue Startzeit (HH:MM):', termin.startzeit || '') || '';
                          const neueEndzeit = window.prompt('Neue Endzeit (optional HH:MM):', termin.endzeit || '') || '';
                          handleTerminVerschieben(termin.id, neuesDatum, neueStartzeit, neueEndzeit);
                        }}
                        style={{ flex:1, padding:'8px 10px', borderRadius:10, border:'1px solid #5B9BD5', background:'transparent', color:'#5B9BD5', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}
                      >
                        📅 Verschieben
                      </button>
                      <button
                        disabled={detailActionLoading}
                        onClick={() => handleTerminAbsagen(termin.id)}
                        style={{ flex:1, padding:'8px 10px', borderRadius:10, border:'1px solid #E85C5C', background:'transparent', color:'#E85C5C', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}
                      >
                        ✗ Absagen
                      </button>
                    </div>
                  )}

                  <SectionLabel>Angemeldete ({(termin.bewerbungen || []).length})</SectionLabel>
                  {(termin.bewerbungen || []).length === 0 ? (
                    <div style={{ fontSize:12, color:'#8B7355' }}>Noch niemand angemeldet.</div>
                  ) : (
                    (termin.bewerbungen || []).map((bewerbung) => (
                      <div key={bewerbung.id} style={{ background:'#F4F0E8', borderRadius:10, padding:12, marginBottom:8 }}>
                        <div style={{ fontWeight:'bold', fontSize:13 }}>👤 {bewerbung.freiwilliger_name}</div>
                        <div style={{ fontSize:12, color:'#8B7355', margin:'4px 0 8px' }}>📧 {bewerbung.freiwilliger_email}</div>

                        {nochNichtGestartet && (
                          <button
                            disabled={detailActionLoading}
                            onClick={() => handleStornieren(bewerbung.id, termin.id)}
                            style={{ width:'100%', padding:'7px', borderRadius:8, border:'1px solid #E85C5C', background:'transparent', color:'#E85C5C', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}
                          >
                            🗑 Anmeldung stornieren
                          </button>
                        )}

                        {istVergangen && !bewerbung.bestaetigt && !bewerbung.nicht_erschienen && (
                          <div style={{ display:'flex', gap:8 }}>
                            <button
                              disabled={detailActionLoading}
                              onClick={() => handleBestaetigen(bewerbung.id, true)}
                              style={{ flex:1, padding:'8px', borderRadius:8, border:'none', background:'#3A7D44', color:'#fff', fontSize:12, fontFamily:'inherit', cursor:'pointer', fontWeight:'bold' }}
                            >
                              ✓ Erschienen
                            </button>
                            <button
                              disabled={detailActionLoading}
                              onClick={() => handleBestaetigen(bewerbung.id, false)}
                              style={{ flex:1, padding:'8px', borderRadius:8, border:'none', background:'#E85C5C', color:'#fff', fontSize:12, fontFamily:'inherit', cursor:'pointer', fontWeight:'bold' }}
                            >
                              ✗ Nicht erschienen
                            </button>
                          </div>
                        )}

                        {istVergangen && bewerbung.bestaetigt && (
                          <div style={{ fontSize:12, color:'#3A7D44', fontWeight:'bold' }}>✓ Erschienen bestätigt</div>
                        )}

                        {istVergangen && bewerbung.nicht_erschienen && (
                          <div style={{ fontSize:12, color:'#E85C5C', fontWeight:'bold' }}>✗ Nicht erschienen</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              );
            })
          )}

          <button
            disabled={detailActionLoading}
            onClick={handleDeleteStelle}
            style={{ width:'100%', padding:'12px', borderRadius:12, border:'1px solid #E85C5C', background:'transparent', color:'#E85C5C', fontSize:13, cursor:'pointer', fontFamily:'inherit', marginTop:8 }}
          >
            Stelle löschen
          </button>
        </div>
      )}

      {tab === 'stellen-bearbeiten' && selectedStelle && editForm && (
        <div style={{ padding:'0 16px 24px' }}>
          <div style={{ background:'#FAF7F2', borderRadius:22, padding:22, border:'1px solid #E6D9C2' }}>
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:24, fontWeight:700, color:'#2C2416', marginBottom:6 }}>Gemeinde-Stelle bearbeiten</div>
              <div style={{ fontSize:14, color:'#8B7355', lineHeight:1.6 }}>
                Termine, Inhalte und Plätze können hier ähnlich wie im Vereinsbereich verwaltet werden.
              </div>
            </div>

            <Input label="Titel" value={editForm.titel} onChange={(e) => setEditForm((f) => ({ ...f, titel: e.target ? e.target.value : e }))} />
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, color:'#8B7355', marginBottom:6, letterSpacing:0.5 }}>BESCHREIBUNG</div>
              <textarea
                value={editForm.beschreibung}
                onChange={(e) => setEditForm((f) => ({ ...f, beschreibung: e.target.value }))}
                rows={4}
                style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid #E0D8C8', background:'#FAF7F2', fontFamily:'inherit', fontSize:14, color:'#2C2416', resize:'none', boxSizing:'border-box' }}
              />
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, color:'#8B7355', marginBottom:8 }}>KATEGORIE</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {KATEGORIEN.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => setEditForm((f) => ({ ...f, kategorie: k.id }))}
                    style={{
                      padding:'6px 12px',
                      borderRadius:20,
                      border:'none',
                      cursor:'pointer',
                      background: editForm.kategorie === k.id ? k.color : '#EDE8DE',
                      color: editForm.kategorie === k.id ? '#fff' : '#8B7355',
                      fontSize:12,
                      fontFamily:'inherit',
                    }}
                  >
                    {k.icon} {k.label}
                  </button>
                ))}
              </div>
            </div>

            {editForm.typ === 'dauerhaft' && (
              <Input
                label="Zeitaufwand pro Woche"
                value={editForm.aufwand}
                onChange={(e) => setEditForm((f) => ({ ...f, aufwand: e.target ? e.target.value : e }))}
                placeholder="z. B. 2"
              />
            )}

            <Input label="Standort / Treffpunkt" value={editForm.standort} onChange={(e) => setEditForm((f) => ({ ...f, standort: e.target ? e.target.value : e }))} />
            <Input label="Ansprechpartner" value={editForm.ansprechpartner} onChange={(e) => setEditForm((f) => ({ ...f, ansprechpartner: e.target ? e.target.value : e }))} />
            <Input label="Kontakt-E-Mail" value={editForm.kontakt_email} onChange={(e) => setEditForm((f) => ({ ...f, kontakt_email: e.target ? e.target.value : e }))} />
            <Input label="PLZ" value={editForm.plz} onChange={(e) => setEditForm((f) => ({ ...f, plz: e.target ? e.target.value : e }))} />

            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, padding:'12px 14px', background:'#FAF7F2', borderRadius:10, border:'1px solid #E0D8C8' }}>
              <input
                type="checkbox"
                checked={editForm.dringend}
                onChange={(e) => setEditForm((f) => ({ ...f, dringend: e.target.checked }))}
                id="gemeinde-dringend-edit"
                style={{ width:18, height:18 }}
              />
              <label htmlFor="gemeinde-dringend-edit" style={{ fontSize:14, color:'#2C2416', cursor:'pointer' }}>
                🔴 Als dringend markieren
              </label>
            </div>

            <div style={{ marginBottom:20 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div style={{ fontSize:12, color:'#8B7355', letterSpacing:0.5 }}>TERMINE</div>
                <button
                  onClick={() => setEditForm((f) => ({ ...f, termine: [...f.termine, { id:null, datum:'', startzeit:'', endzeit:'', plaetze:5, absagen:false }] }))}
                  style={{ padding:'4px 12px', borderRadius:8, border:'1px solid #2C2416', background:'transparent', color:'#2C2416', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}
                >
                  + Termin hinzufügen
                </button>
              </div>

              {editForm.termine.map((t, idx) => (
                <div key={idx} style={{ background:t.absagen ? '#FFF0F0' : '#FAF7F2', borderRadius:12, padding:12, marginBottom:10, border:`1px solid ${t.absagen ? '#E85C5C' : '#E0D8C8'}`, opacity:t.absagen ? 0.65 : 1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <div style={{ fontSize:12, fontWeight:'bold', color:t.absagen ? '#E85C5C' : '#2C2416' }}>
                      {t.datum ? `📅 ${t.datum}` : 'Neuer Termin'} {t.absagen ? '– WIRD ABGESAGT' : ''}
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      {t.id ? (
                        <button
                          onClick={() => setEditForm((f) => ({ ...f, termine: f.termine.map((x, i) => i === idx ? { ...x, absagen: !x.absagen } : x) }))}
                          style={{ padding:'4px 10px', borderRadius:8, border:`1px solid ${t.absagen ? '#3A7D44' : '#E85C5C'}`, background:'transparent', color:t.absagen ? '#3A7D44' : '#E85C5C', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}
                        >
                          {t.absagen ? '↩ Rückgängig' : '✗ Absagen'}
                        </button>
                      ) : (
                        <button
                          onClick={() => setEditForm((f) => ({ ...f, termine: f.termine.filter((_, i) => i !== idx) }))}
                          style={{ padding:'4px 10px', borderRadius:8, border:'1px solid #E85C5C', background:'transparent', color:'#E85C5C', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}
                        >
                          Entfernen
                        </button>
                      )}
                    </div>
                  </div>

                  {!t.absagen && (
                    <>
                      <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                        <input
                          type="date"
                          value={t.datum}
                          onChange={(e) => setEditForm((f) => ({ ...f, termine: f.termine.map((x, i) => i === idx ? { ...x, datum: e.target.value } : x) }))}
                          style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid #E0D8C8', background:'#fff', fontFamily:'inherit', fontSize:13, color:'#2C2416', boxSizing:'border-box' }}
                        />
                        <input
                          type="time"
                          value={t.startzeit}
                          onChange={(e) => setEditForm((f) => ({ ...f, termine: f.termine.map((x, i) => i === idx ? { ...x, startzeit: e.target.value } : x) }))}
                          style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid #E0D8C8', background:'#fff', fontFamily:'inherit', fontSize:13, color:'#2C2416', boxSizing:'border-box' }}
                        />
                        <input
                          type="time"
                          value={t.endzeit}
                          onChange={(e) => setEditForm((f) => ({ ...f, termine: f.termine.map((x, i) => i === idx ? { ...x, endzeit: e.target.value } : x) }))}
                          style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid #E0D8C8', background:'#fff', fontFamily:'inherit', fontSize:13, color:'#2C2416', boxSizing:'border-box' }}
                        />
                      </div>

                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ fontSize:12, color:'#8B7355' }}>Freie Plätze:</div>
                        <input
                          type="number"
                          min="1"
                          value={t.plaetze}
                          onChange={(e) => setEditForm((f) => ({ ...f, termine: f.termine.map((x, i) => i === idx ? { ...x, plaetze: parseInt(e.target.value, 10) || 1 } : x) }))}
                          style={{ width:70, padding:'6px 10px', borderRadius:8, border:'1px solid #E0D8C8', background:'#fff', fontFamily:'inherit', fontSize:13, color:'#2C2416' }}
                        />
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <BigButton onClick={handleEditSave} green>
              {editLoading ? 'Speichern...' : 'Änderungen speichern ✓'}
            </BigButton>
          </div>
        </div>
      )}

      {tab === 'erstellen' && (
        <div style={{ padding:'0 16px 24px' }}>
          <div style={{ background:'#FAF7F2', borderRadius:22, padding:22, border:'1px solid #E6D9C2' }}>
            <div style={{ marginBottom:18, padding:'0 2px' }}>
              <div style={{ fontSize:24, fontWeight:700, color:'#2C2416', marginBottom:6 }}>
                Neue Gemeinde-Stelle
              </div>
              <div style={{ fontSize:14, color:'#8B7355', lineHeight:1.6 }}>
                Erstellen Sie hier einmalige Einsätze oder dauerhafte Unterstützungsmöglichkeiten für Ihre Gemeinde.
              </div>
            </div>

            <Input
              label="Titel"
              value={form.titel}
              onChange={(e) => setForm((f) => ({ ...f, titel: e.target ? e.target.value : e }))}
              placeholder="z. B. Unterstützung beim Bürgerfest"
            />

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, color:'#8B7355', marginBottom:6, letterSpacing:0.5 }}>BESCHREIBUNG</div>
              <textarea
                value={form.beschreibung}
                onChange={(e) => setForm((f) => ({ ...f, beschreibung: e.target.value }))}
                placeholder="Was erwartet die Helferinnen und Helfer?"
                rows={4}
                style={{
                  width:'100%',
                  padding:'10px 12px',
                  borderRadius:10,
                  border:'1px solid #E0D8C8',
                  background:'#FAF7F2',
                  fontFamily:'inherit',
                  fontSize:14,
                  color:'#2C2416',
                  resize:'none',
                  boxSizing:'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, color:'#8B7355', marginBottom:8 }}>TYP</div>
              <div style={{ display:'flex', gap:8 }}>
                <button
                  onClick={() => setForm((f) => ({ ...f, typ: 'event', aufwand: '' }))}
                  style={{
                    flex:1,
                    padding:'10px',
                    borderRadius:10,
                    border:'none',
                    cursor:'pointer',
                    background: form.typ === 'event' ? '#2C2416' : '#EDE8DE',
                    color: form.typ === 'event' ? '#FAF7F2' : '#8B7355',
                    fontFamily:'inherit',
                    fontSize:13,
                    fontWeight:'bold',
                  }}
                >
                  📅 Einmaliger Einsatz
                </button>
                <button
                  onClick={() => setForm((f) => ({ ...f, typ: 'dauerhaft' }))}
                  style={{
                    flex:1,
                    padding:'10px',
                    borderRadius:10,
                    border:'none',
                    cursor:'pointer',
                    background: form.typ === 'dauerhaft' ? '#2C2416' : '#EDE8DE',
                    color: form.typ === 'dauerhaft' ? '#FAF7F2' : '#8B7355',
                    fontFamily:'inherit',
                    fontSize:13,
                    fontWeight:'bold',
                  }}
                >
                  🔄 Dauerhafte Unterstützung
                </button>
              </div>
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:12, color:'#8B7355', marginBottom:8 }}>KATEGORIE</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {KATEGORIEN.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => setForm((f) => ({ ...f, kategorie: k.id }))}
                    style={{
                      padding:'6px 12px',
                      borderRadius:20,
                      border:'none',
                      cursor:'pointer',
                      background: form.kategorie === k.id ? k.color : '#EDE8DE',
                      color: form.kategorie === k.id ? '#fff' : '#8B7355',
                      fontSize:12,
                      fontFamily:'inherit',
                    }}
                  >
                    {k.icon} {k.label}
                  </button>
                ))}
              </div>
            </div>

            {form.typ === 'dauerhaft' && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, color:'#8B7355', marginBottom:6, letterSpacing:0.5 }}>
                  ZEAITAUFWAND PRO WOCHE (PFLICHT)
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={form.aufwand}
                    onChange={(e) => setForm((f) => ({ ...f, aufwand: e.target.value }))}
                    placeholder="z. B. 2"
                    style={{
                      width:100,
                      padding:'11px 14px',
                      borderRadius:10,
                      border:'1px solid #E0D8C8',
                      background:'#FAF7F2',
                      fontFamily:'inherit',
                      fontSize:14,
                      color:'#2C2416',
                      boxSizing:'border-box',
                      outline:'none',
                    }}
                  />
                  <div style={{ fontSize:14, color:'#8B7355', fontWeight:'bold' }}>Stunden / Woche</div>
                </div>
              </div>
            )}

            <Input
              label="Standort / Treffpunkt"
              value={form.standort}
              onChange={(e) => setForm((f) => ({ ...f, standort: e.target ? e.target.value : e }))}
              placeholder="z. B. Bürgerhaus Einhausen"
            />
            <Input
              label="Ansprechpartner (optional)"
              value={form.ansprechpartner}
              onChange={(e) => setForm((f) => ({ ...f, ansprechpartner: e.target ? e.target.value : e }))}
              placeholder="z. B. Max Mustermann"
            />
            <Input
              label="Kontakt-E-Mail (optional)"
              value={form.kontakt_email}
              onChange={(e) => setForm((f) => ({ ...f, kontakt_email: e.target ? e.target.value : e }))}
              placeholder="z. B. ordnungsamt@gemeinde.de"
            />
            <Input
              label="PLZ"
              value={form.plz}
              onChange={(e) => setForm((f) => ({ ...f, plz: e.target ? e.target.value : e }))}
              placeholder="z. B. 64683"
            />

            <div
              style={{
                display:'flex',
                alignItems:'center',
                gap:12,
                marginBottom:20,
                padding:'12px 14px',
                background:'#FAF7F2',
                borderRadius:10,
                border:'1px solid #E0D8C8',
              }}
            >
              <input
                type="checkbox"
                checked={form.dringend}
                onChange={(e) => setForm((f) => ({ ...f, dringend: e.target.checked }))}
                id="gemeinde-dringend"
                style={{ width:18, height:18 }}
              />
              <label htmlFor="gemeinde-dringend" style={{ fontSize:14, color:'#2C2416', cursor:'pointer' }}>
                🔴 Als dringend markieren
              </label>
            </div>

            <div style={{ marginBottom:20 }}>
              <div
                style={{
                  display:'flex',
                  justifyContent:'space-between',
                  alignItems:'center',
                  marginBottom:8,
                }}
              >
                <div style={{ fontSize:12, color:'#8B7355', letterSpacing:0.5 }}>
                  {form.typ === 'dauerhaft' ? 'TERMIN ZUM ERST- / EINFÜHRUNGSGESPRÄCH' : 'TERMINE'}
                </div>
                <button
                  onClick={() => setForm((f) => ({ ...f, termine: [...f.termine, defaultTermin()] }))}
                  style={{
                    padding:'4px 12px',
                    borderRadius:8,
                    border:'1px solid #2C2416',
                    background:'transparent',
                    color:'#2C2416',
                    fontSize:12,
                    cursor:'pointer',
                    fontFamily:'inherit',
                  }}
                >
                  + {form.typ === 'dauerhaft' ? 'Einführungsgespräch' : 'Termin'}
                </button>
              </div>

              {form.termine.map((t, idx) => (
                <div
                  key={idx}
                  style={{
                    background:'#FAF7F2',
                    borderRadius:12,
                    padding:'12px',
                    marginBottom:10,
                    border:'1px solid #E0D8C8',
                  }}
                >
                  <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                    <input
                      type="date"
                      value={t.datum}
                      onChange={(e)=>setForm((f)=>({...f, termine:f.termine.map((x,i)=>i===idx?{...x, datum:e.target.value}:x)}))}
                      style={{
                        flex:2,
                        padding:'8px 10px',
                        borderRadius:8,
                        border:'1px solid #E0D8C8',
                        background:'#fff',
                        fontFamily:'inherit',
                        fontSize:13,
                        color:'#2C2416',
                        boxSizing:'border-box',
                      }}
                    />
                    {form.termine.length > 1 && (
                      <button
                        onClick={() => setForm((f) => ({ ...f, termine: f.termine.filter((_, i) => i !== idx) }))}
                        style={{
                          padding:'6px 10px',
                          borderRadius:8,
                          border:'none',
                          background:'#FFF0F0',
                          color:'#E85C5C',
                          fontSize:12,
                          cursor:'pointer',
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, color:'#8B7355', marginBottom:3 }}>STARTZEIT</div>
                      <input
                        type="time"
                        value={t.startzeit}
                        onChange={(e)=>setForm((f)=>({...f, termine:f.termine.map((x,i)=>i===idx?{...x, startzeit:e.target.value}:x)}))}
                        style={{
                          width:'100%',
                          padding:'8px 10px',
                          borderRadius:8,
                          border:'1px solid #E0D8C8',
                          background:'#fff',
                          fontFamily:'inherit',
                          fontSize:13,
                          color:'#2C2416',
                          boxSizing:'border-box',
                        }}
                      />
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, color:'#8B7355', marginBottom:3 }}>ENDZEIT (optional)</div>
                      <input
                        type="time"
                        value={t.endzeit}
                        onChange={(e)=>setForm((f)=>({...f, termine:f.termine.map((x,i)=>i===idx?{...x, endzeit:e.target.value}:x)}))}
                        style={{
                          width:'100%',
                          padding:'8px 10px',
                          borderRadius:8,
                          border:'1px solid #E0D8C8',
                          background:'#fff',
                          fontFamily:'inherit',
                          fontSize:13,
                          color:'#2C2416',
                          boxSizing:'border-box',
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ fontSize:12, color:'#8B7355' }}>Freie Plätze:</div>
                    <input
                      type="number"
                      min="1"
                      value={t.plaetze}
                      onChange={(e)=>setForm((f)=>({...f, termine:f.termine.map((x,i)=>i===idx?{...x, plaetze:parseInt(e.target.value) || 1}:x)}))}
                      style={{
                        width:70,
                        padding:'6px 10px',
                        borderRadius:8,
                        border:'1px solid #E0D8C8',
                        background:'#fff',
                        fontFamily:'inherit',
                        fontSize:13,
                        color:'#2C2416',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <BigButton onClick={handleSave} green>
              Stelle veröffentlichen ✓
            </BigButton>
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

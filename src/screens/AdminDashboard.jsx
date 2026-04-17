import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../core/shared';
import { Header, Input, SectionLabel, EmptyState } from '../components/ui';
import MessageThreadView from '../components/messages/MessageThreadView';
import { getAdminSupportThreads } from '../services/messages';

const cardStyle = {
  background: '#FAF7F2',
  borderRadius: 18,
  padding: 18,
  border: '1px solid #E6D9C2',
};

function StatCard({ label, value, sub }) {
  return (
    <div style={cardStyle}>
      <div style={{ color: '#8B7355', fontSize: 12, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      {sub ? <div style={{ color: '#8B7355', fontSize: 12, marginTop: 6 }}>{sub}</div> : null}
    </div>
  );
}

const firstItem = (value) => (Array.isArray(value) ? value[0] : value || null);

const pickFirst = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
};

const normalizeSupportThread = (thread) => {
  const vereinSource = firstItem(thread?.verein) || firstItem(thread?.vereine);
  const gemeindeSource = firstItem(thread?.gemeinde) || firstItem(thread?.gemeinden);
  const freiwilligerSource = firstItem(thread?.freiwilliger) || firstItem(thread?.freiwillige);

  const vereinName = pickFirst(vereinSource?.name, thread?.verein_name, thread?.vereinsname);
  const vereinEmail = pickFirst(vereinSource?.kontakt_email, vereinSource?.email, thread?.verein_email);

  const gemeindeName = pickFirst(gemeindeSource?.name, thread?.gemeinde_name);
  const gemeindeEmail = pickFirst(gemeindeSource?.email, thread?.gemeinde_email);

  const freiwilligerName = pickFirst(freiwilligerSource?.name, thread?.freiwilliger_name);
  const freiwilligerEmail = pickFirst(freiwilligerSource?.email, thread?.freiwilliger_email);

  if (thread?.freiwilliger_id) {
    return {
      ...thread,
      organisation: {
        type: 'freiwilliger',
        id: pickFirst(freiwilligerSource?.id, thread?.freiwilliger_id) || null,
        name: pickFirst(freiwilligerName, 'Freiwilliger'),
        email: pickFirst(freiwilligerEmail, ''),
      },
    };
  }

  if (thread?.verein_id) {
    return {
      ...thread,
      organisation: {
        type: 'verein',
        id: pickFirst(vereinSource?.id, thread?.verein_id) || null,
        name: pickFirst(vereinName, 'Verein'),
        email: pickFirst(vereinEmail, ''),
      },
    };
  }

  if (thread?.gemeinde_id) {
    return {
      ...thread,
      organisation: {
        type: 'gemeinde',
        id: pickFirst(gemeindeSource?.id, thread?.gemeinde_id) || null,
        name: pickFirst(gemeindeName, 'Gemeinde'),
        email: pickFirst(gemeindeEmail, ''),
      },
    };
  }

  return {
    ...thread,
    organisation: {
      type: 'unbekannt',
      id: null,
      name: 'Unbekannt',
      email: '',
    },
  };
};

// ── ANFRAGEN TAB ──────────────────────────────────────────────────────────
function AnfragenTab() {
  const [anfragen, setAnfragen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('alle');

  const loadAnfragen = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('website_anfragen')
      .select('*')
      .order('created_at', { ascending: false });
    setAnfragen(data || []);
    setLoading(false);
  };

  useEffect(() => { loadAnfragen(); }, []);

  const markRead = async (id) => {
    await supabase.from('website_anfragen').update({ gelesen: true }).eq('id', id);
    setAnfragen(prev => prev.map(a => a.id === id ? { ...a, gelesen: true } : a));
    if (selected?.id === id) setSelected(prev => ({ ...prev, gelesen: true }));
  };

  const filtered = anfragen.filter(a => filter === 'alle' ? true : filter === 'ungelesen' ? !a.gelesen : a.typ === filter);
  const unreadCount = anfragen.filter(a => !a.gelesen).length;

  const typLabel = { gemeinde: '🏛️ Gemeinde', verein: '🌱 Verein', partner: '🤝 Partner', kontakt: '💬 Kontakt' };
  const typColor = { gemeinde: '#5B9BD5', verein: '#3A7D44', partner: '#C8A96E', kontakt: '#8B7355' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 18 }}>
      {/* Liste */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <SectionLabel>Website-Anfragen {unreadCount > 0 && <span style={{ background: '#E85C5C', color: '#fff', borderRadius: 8, padding: '2px 7px', fontSize: 11, marginLeft: 6 }}>{unreadCount}</span>}</SectionLabel>
          <button onClick={loadAnfragen} style={{ background: 'none', border: '1px solid #E6D9C2', borderRadius: 8, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>↻</button>
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
          {['alle', 'ungelesen', 'gemeinde', 'verein', 'partner', 'kontakt'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? '#2C2416' : '#F3EEE4', color: filter === f ? '#fff' : '#8B7355', border: '1px solid #E6D9C2', borderRadius: 8, padding: '4px 9px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ color: '#8B7355', fontSize: 13 }}>Lade Anfragen...</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: '#8B7355', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
            Keine Anfragen
          </div>
        ) : filtered.map(a => (
          <button key={a.id} onClick={() => { setSelected(a); if (!a.gelesen) markRead(a.id); }} style={{
            width: '100%', textAlign: 'left', border: selected?.id === a.id ? '2px solid #2C2416' : '1px solid #E6D9C2',
            background: selected?.id === a.id ? '#F3EBDD' : a.gelesen ? '#FAF7F2' : '#EDE8DE',
            borderRadius: 14, padding: 12, marginBottom: 8, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{a.name || 'Unbekannt'}</div>
              {!a.gelesen && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E85C5C', flexShrink: 0 }} />}
            </div>
            <div style={{ fontSize: 11, color: typColor[a.typ] || '#8B7355', marginBottom: 4, fontWeight: 600 }}>
              {typLabel[a.typ] || a.typ}
            </div>
            <div style={{ fontSize: 12, color: '#5C4A32', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {a.nachricht || a.email}
            </div>
            <div style={{ fontSize: 11, color: '#8B7355', marginTop: 6 }}>
              {new Date(a.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </button>
        ))}
      </div>

      {/* Detail */}
      <div style={cardStyle}>
        {!selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8B7355', gap: 8 }}>
            <div style={{ fontSize: 36 }}>📨</div>
            <div style={{ fontSize: 14 }}>Anfrage auswählen</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{selected.name}</div>
                <div style={{ fontSize: 13, color: typColor[selected.typ] || '#8B7355', fontWeight: 600 }}>
                  {typLabel[selected.typ] || selected.typ}
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#8B7355' }}>
                {new Date(selected.created_at).toLocaleString('de-DE')}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
              <div style={{ background: '#F3EEE4', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, color: '#8B7355', marginBottom: 4 }}>E-Mail</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  <a href={`mailto:${selected.email}`} style={{ color: '#2C2416', textDecoration: 'none' }}>{selected.email}</a>
                </div>
              </div>
              {selected.telefon && (
                <div style={{ background: '#F3EEE4', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: '#8B7355', marginBottom: 4 }}>Telefon</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{selected.telefon}</div>
                </div>
              )}
              {selected.organisation && (
                <div style={{ background: '#F3EEE4', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: '#8B7355', marginBottom: 4 }}>Organisation</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{selected.organisation}</div>
                </div>
              )}
              {selected.paket && (
                <div style={{ background: '#F3EEE4', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: '#8B7355', marginBottom: 4 }}>Paket / Interesse</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{selected.paket}</div>
                </div>
              )}
            </div>

            {selected.nachricht && (
              <div style={{ background: '#F3EEE4', borderRadius: 12, padding: 16, marginBottom: 18 }}>
                <div style={{ fontSize: 11, color: '#8B7355', marginBottom: 8 }}>NACHRICHT</div>
                <div style={{ fontSize: 14, lineHeight: 1.7, color: '#2C2416', whiteSpace: 'pre-wrap' }}>{selected.nachricht}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <a href={`mailto:${selected.email}?subject=Re: Civico Anfrage`} style={{
                background: '#2C2416', color: '#F4F0E8', borderRadius: 12, padding: '10px 18px',
                fontSize: 13, fontWeight: 700, textDecoration: 'none', display: 'inline-block',
              }}>
                📧 Antworten
              </a>
              {!selected.gelesen && (
                <button onClick={() => markRead(selected.id)} style={{ background: 'transparent', border: '1px solid #E6D9C2', borderRadius: 12, padding: '10px 18px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ✓ Als gelesen markieren
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── SO TICKT CIVICO EDITOR ────────────────────────────────────────────────
function SoTicktCivicoTab() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const defaultBlocks = [
    { id: '1', titel: 'Warum Civico existiert', text: '', reihenfolge: 1 },
    { id: '2', titel: 'Wer hinter Civico steckt', text: '', reihenfolge: 2 },
    { id: '3', titel: 'Wo es hingeht', text: '', reihenfolge: 3 },
  ];

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('civico_content')
        .select('*')
        .eq('seite', 'so_tickt_civico')
        .order('reihenfolge');
      if (data && data.length > 0) {
        setBlocks(data);
      } else {
        setBlocks(defaultBlocks);
      }
      setLoading(false);
    };
    load();
  }, []);

  const updateBlock = (id, field, value) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const addBlock = () => {
    const newBlock = {
      id: `new_${Date.now()}`,
      titel: 'Neuer Abschnitt',
      text: '',
      reihenfolge: blocks.length + 1,
      seite: 'so_tickt_civico',
    };
    setBlocks(prev => [...prev, newBlock]);
  };

  const removeBlock = (id) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // Delete all existing for this page
      await supabase.from('civico_content').delete().eq('seite', 'so_tickt_civico');

      // Insert all current blocks
      const toInsert = blocks.map((b, i) => ({
        seite: 'so_tickt_civico',
        titel: b.titel,
        text: b.text,
        reihenfolge: i + 1,
      }));

      const { error: insertError } = await supabase.from('civico_content').insert(toInsert);
      if (insertError) throw insertError;

      setSuccess('✓ Gespeichert! Die Änderungen sind live auf der Website.');
    } catch (e) {
      setError(e.message || 'Speichern fehlgeschlagen.');
    }
    setSaving(false);
  };

  if (loading) return <div style={{ color: '#8B7355', padding: 24 }}>Lade Inhalte...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>„So tickt Civico" – Editor</div>
          <div style={{ fontSize: 13, color: '#8B7355' }}>Diese Texte erscheinen auf der Website unter dem Reiter „So tickt Civico".</div>
        </div>
        <button onClick={save} disabled={saving} style={{
          background: saving ? '#8B7355' : '#2C2416', color: '#F4F0E8', border: 'none',
          borderRadius: 12, padding: '11px 20px', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
        }}>
          {saving ? 'Speichern...' : '💾 Speichern & live schalten'}
        </button>
      </div>

      {success && <div style={{ background: '#ECF7EE', border: '1px solid #B8D8BE', color: '#2F6638', borderRadius: 12, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{success}</div>}
      {error && <div style={{ background: '#FFF0F0', border: '1px solid #E5BBBB', color: '#8C3E3E', borderRadius: 12, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{error}</div>}

      {blocks.map((block, i) => (
        <div key={block.id} style={{ ...cardStyle, marginBottom: 14, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#8B7355', letterSpacing: 1, textTransform: 'uppercase' }}>Abschnitt {i + 1}</div>
            <button onClick={() => removeBlock(block.id)} style={{ background: 'none', border: 'none', color: '#E85C5C', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>✕</button>
          </div>
          <input
            value={block.titel}
            onChange={e => updateBlock(block.id, 'titel', e.target.value)}
            placeholder="Überschrift des Abschnitts"
            style={{ width: '100%', boxSizing: 'border-box', background: '#fff', border: '1px solid #E6D9C2', borderRadius: 10, padding: '10px 12px', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: '#2C2416', marginBottom: 10 }}
          />
          <textarea
            value={block.text}
            onChange={e => updateBlock(block.id, 'text', e.target.value)}
            placeholder="Schreib hier deinen Text... Du kannst so persönlich und direkt sein wie du möchtest."
            rows={5}
            style={{ width: '100%', boxSizing: 'border-box', background: '#fff', border: '1px solid #E6D9C2', borderRadius: 10, padding: '10px 12px', fontFamily: 'inherit', fontSize: 14, color: '#2C2416', lineHeight: 1.7, resize: 'vertical' }}
          />
        </div>
      ))}

      <button onClick={addBlock} style={{ width: '100%', border: '1.5px dashed #E6D9C2', background: 'transparent', borderRadius: 14, padding: '12px', fontSize: 13, color: '#8B7355', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8 }}>
        + Abschnitt hinzufügen
      </button>

      <div style={{ background: '#FFF7E9', border: '1px solid #F0D7A2', borderRadius: 12, padding: '12px 14px', fontSize: 12, color: '#8B6800', marginTop: 8 }}>
        💡 <strong>Tipp:</strong> Schreib so wie du redest – keine Corporate-Sprache. Leser von Civico wollen verstehen wer du bist und warum du das machst. Ehrlichkeit schlägt jede Marketingformel.
      </div>
    </div>
  );
}

// ── MAIN ADMIN DASHBOARD ──────────────────────────────────────────────────
export default function AdminDashboard({ onBack, logout }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [debugInfo, setDebugInfo] = useState('DEBUG aktiv');
  const [sessionInfo, setSessionInfo] = useState('Session noch nicht geprüft');

  const [gemeindeName, setGemeindeName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [plz, setPlz] = useState('');
  const [ort, setOrt] = useState('');
  const [bundesland, setBundesland] = useState('Hessen');
  const [nachricht, setNachricht] = useState('Kurze Info für die Gemeinde');
  const [savingGemeinde, setSavingGemeinde] = useState(false);

  const [dashboardStats, setDashboardStats] = useState(null);
  const [funnelStats, setFunnelStats] = useState(null);
  const [gemeindenStats, setGemeindenStats] = useState([]);
  const [vereineStats, setVereineStats] = useState([]);
  const [altersgruppenStats, setAltersgruppenStats] = useState([]);
  const [regionStats, setRegionStats] = useState([]);
  const [csrStats, setCsrStats] = useState([]);
  const [plzFilter, setPlzFilter] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [supportThreads, setSupportThreads] = useState([]);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportError, setSupportError] = useState('');
  const [selectedThread, setSelectedThread] = useState(null);
  const [selectedOrganisation, setSelectedOrganisation] = useState(null);
  const [unreadAnfragen, setUnreadAnfragen] = useState(0);

  useEffect(() => {
    // Load unread count for badge
    supabase.from('website_anfragen').select('id', { count: 'exact' }).eq('gelesen', false)
      .then(({ count }) => setUnreadAnfragen(count || 0));
  }, [activeTab]);

  const loadAdminData = async () => {
    setLoading(true);
    setError('');
    const [dashboardRes, funnelRes, gemeindenRes, vereineRes, altersgruppenRes, regionRes, csrRes] = await Promise.all([
      supabase.from('admin_dashboard_stats').select('*').maybeSingle(),
      supabase.from('admin_funnel_stats').select('*').maybeSingle(),
      supabase.from('admin_gemeinden_stats').select('*').order('gesamtstunden', { ascending: false }),
      supabase.from('admin_vereine_stats').select('*').order('gesamtstunden', { ascending: false }),
      supabase.from('admin_altersgruppen_stats').select('*'),
      supabase.from('admin_regionale_impact_stats').select('*').order('gesamtstunden', { ascending: false }),
      supabase.from('admin_csr_stats').select('*').order('gesamtstunden', { ascending: false }),
    ]);
    const firstError = [dashboardRes.error, funnelRes.error, gemeindenRes.error, vereineRes.error, altersgruppenRes.error, regionRes.error, csrRes.error].find(Boolean);
    if (firstError) setError(firstError.message || 'Admin-Daten konnten nicht geladen werden.');
    setDashboardStats(dashboardRes.data || null);
    setFunnelStats(funnelRes.data || null);
    setGemeindenStats(gemeindenRes.data || []);
    setVereineStats(vereineRes.data || []);
    setAltersgruppenStats(altersgruppenRes.data || []);
    setRegionStats(regionRes.data || []);
    setCsrStats(csrRes.data || []);
    setLoading(false);
  };

  const loadSupportThreads = async () => {
    try {
      setSupportLoading(true);
      setSupportError('');
      const data = (await getAdminSupportThreads()) || [];
      const normalized = data.map(normalizeSupportThread);
      setSupportThreads(normalized);
      if (normalized.length > 0) {
        const currentSelectedId = selectedThread?.id;
        const selectedMatch = currentSelectedId ? normalized.find((t) => t.id === currentSelectedId) : null;
        const nextThread = selectedMatch || normalized[0];
        setSelectedThread(nextThread);
        setSelectedOrganisation(nextThread.organisation || null);
      } else {
        setSelectedThread(null);
        setSelectedOrganisation(null);
      }
    } catch (err) {
      setSupportError(err.message || 'Support-Threads konnten nicht geladen werden.');
    } finally {
      setSupportLoading(false);
    }
  };

  useEffect(() => { loadAdminData(); loadSupportThreads(); }, []);

  const handleCreateGemeinde = async () => {
    const cleanName = String(gemeindeName || '').trim();
    const cleanEmail = String(adminEmail || '').trim().toLowerCase();
    const cleanPlz = String(plz || '').trim();
    const cleanOrt = String(ort || '').trim();
    const cleanBundesland = String(bundesland || '').trim() || 'Hessen';
    if (!cleanName || !cleanEmail) { setError('Gemeindename und Admin-E-Mail sind Pflichtfelder.'); return; }
    const { data: { session } } = await supabase.auth.getSession();
    setSessionInfo(session ? `Session vorhanden: ${session.user?.email || 'ohne Email'}` : 'KEINE SESSION');
    if (!session) { setError('Keine aktive Supabase-Session gefunden.'); setSuccess(''); return; }
    setSavingGemeinde(true); setError(''); setSuccess(''); setInviteLink(''); setDebugInfo('Function-Aufruf läuft ...');
    const { data, error: invokeError } = await supabase.functions.invoke('admin-create-gemeinde-invite', {
      body: { name: cleanName, email: cleanEmail, plz: cleanPlz, ort: cleanOrt, bundesland: cleanBundesland, nachricht },
    });
    setSavingGemeinde(false);
    if (invokeError) { setError(`DEBUG INVOKE FEHLER: ${invokeError.message}`); setDebugInfo(`InvokeError: ${invokeError.message}`); return; }
    if (!data?.ok) { setError(`DEBUG BACKEND FEHLER: ${data?.error}`); setDebugInfo(`BackendError: ${data?.error}`); return; }
    setSuccess(`Gemeinde gespeichert. Einladung für ${data.email} wurde erzeugt.`);
    setInviteLink(data.action_link || '');
    setDebugInfo('Erfolg');
    setGemeindeName(''); setAdminEmail(''); setPlz(''); setOrt(''); setNachricht('Kurze Info für die Gemeinde');
    await loadAdminData();
  };

  const plzRows = useMemo(() => {
    return gemeindenStats
      .map((g) => ({ plz: String(g.plz || 'ohne PLZ'), gemeinde_name: g.name || g.ort || 'Gemeinde', freiwillige: g.freiwillige_count || 0, vereine: g.vereine_count || 0, stellen: g.stellen_count || 0, gesamtstunden: g.gesamtstunden || 0 }))
      .filter((row) => !plzFilter || row.plz.startsWith(String(plzFilter).trim()))
      .sort((a, b) => a.plz.localeCompare(b.plz));
  }, [gemeindenStats, plzFilter]);

  const topGemeinden = useMemo(() => {
    return [...gemeindenStats].sort((a, b) => ((b.gesamtstunden || 0) + (b.completed_einsaetze_count || 0)) - ((a.gesamtstunden || 0) + (a.completed_einsaetze_count || 0))).slice(0, 5);
  }, [gemeindenStats]);

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    try { await navigator.clipboard.writeText(inviteLink); setSuccess('Einladungslink kopiert.'); }
    catch (e) { setError('Link konnte nicht automatisch kopiert werden.'); }
  };

  const tabButtonStyle = (isActive) => ({
    background: isActive ? '#2C2416' : '#FAF7F2',
    color: isActive ? '#fff' : '#2C2416',
    border: '1px solid #E6D9C2',
    borderRadius: 12,
    padding: '10px 14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 700,
    fontSize: 13,
    position: 'relative',
  });

  return (
    <div>
      <Header title="Admin-Dashboard" subtitle="CSR, Gemeinden, Vereine und Demografie" onBack={onBack} onLogout={logout} />

      {/* Tab Bar */}
      <div style={{ padding: '0 16px 16px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button style={tabButtonStyle(activeTab === 'overview')} onClick={() => setActiveTab('overview')}>📊 Übersicht</button>
        <button style={tabButtonStyle(activeTab === 'anfragen')} onClick={() => setActiveTab('anfragen')}>
          📨 Anfragen
          {unreadAnfragen > 0 && (
            <span style={{ background: '#E85C5C', color: '#fff', borderRadius: 8, padding: '1px 6px', fontSize: 10, marginLeft: 6, fontWeight: 700 }}>
              {unreadAnfragen}
            </span>
          )}
        </button>
        <button style={tabButtonStyle(activeTab === 'support')} onClick={() => setActiveTab('support')}>💬 Support</button>
        <button style={tabButtonStyle(activeTab === 'sotickts')} onClick={() => setActiveTab('sotickts')}>✍️ So tickt Civico</button>
      </div>

      <div style={{ padding: '0 16px 24px' }}>

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <>
            <div style={{ ...cardStyle, marginBottom: 18, border: '2px solid #C8A96E' }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Debug-Status</div>
              <div style={{ fontSize: 13, color: '#5C4A32', marginBottom: 6 }}>{debugInfo}</div>
              <div style={{ fontSize: 13, color: '#5C4A32' }}>{sessionInfo}</div>
            </div>

            <div style={{ ...cardStyle, marginBottom: 18 }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Gemeinde anlegen</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.8fr 1fr', gap: 12, marginBottom: 12 }}>
                <Input label="Gemeindename" value={gemeindeName} onChange={(e) => setGemeindeName(e.target ? e.target.value : e)} />
                <Input label="Admin-E-Mail" value={adminEmail} onChange={(e) => setAdminEmail(e.target ? e.target.value : e)} />
                <Input label="PLZ" value={plz} onChange={(e) => setPlz(e.target ? e.target.value : e)} />
                <Input label="Ort" value={ort} onChange={(e) => setOrt(e.target ? e.target.value : e)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 12, marginBottom: 12 }}>
                <Input label="Nachricht" value={nachricht} onChange={(e) => setNachricht(e.target ? e.target.value : e)} />
                <Input label="Bundesland" value={bundesland} onChange={(e) => setBundesland(e.target ? e.target.value : e)} />
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={handleCreateGemeinde} disabled={savingGemeinde} style={{ background: '#2C2416', color: '#fff', border: 'none', borderRadius: 14, padding: '12px 18px', cursor: savingGemeinde ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                  {savingGemeinde ? 'Speichern...' : 'Gemeinde speichern'}
                </button>
                {inviteLink ? (
                  <button onClick={copyInviteLink} style={{ background: '#FAF7F2', color: '#2C2416', border: '1px solid #E6D9C2', borderRadius: 14, padding: '12px 18px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                    Einladungslink kopieren
                  </button>
                ) : null}
              </div>
              {success ? <div style={{ marginTop: 12, color: '#2C6B36', fontSize: 13, fontWeight: 700 }}>{success}</div> : null}
              {error ? <div style={{ marginTop: 12, color: '#B53A2D', fontSize: 13, fontWeight: 700 }}>{error}</div> : null}
              {inviteLink ? <div style={{ marginTop: 10, fontSize: 12, color: '#8B7355', wordBreak: 'break-all' }}>{inviteLink}</div> : null}
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: '#8B7355', marginBottom: 8 }}>Systemübersicht</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <StatCard label="Gemeinden" value={dashboardStats?.gemeinden_count ?? 0} sub="kommunale Accounts" />
                <StatCard label="Organisationen" value={dashboardStats?.vereine_count ?? 0} sub="registrierte Vereine" />
                <StatCard label="Freiwillige" value={dashboardStats?.freiwillige_count ?? 0} sub="aktive Nutzerbasis" />
                <StatCard label="Stellen" value={dashboardStats?.aktive_stellen_count ?? 0} sub="aktive Ehrenamtsstellen" />
                <StatCard label="Zustande gekommene Einsätze" value={dashboardStats?.zustande_gekommene_einsaetze_count ?? 0} sub="abgeschlossene Termine" />
                <StatCard label="Gesamtstunden" value={dashboardStats?.gesamtstunden ?? 0} sub="geleistete Ehrenamtsstunden" />
                <StatCard label="Pay-relevante Vereine" value={dashboardStats?.pay_relevante_vereine_count ?? 0} sub="ab 3 Einsätzen" />
                <StatCard label="Angenommene Einladungen" value={funnelStats?.angenommene_einladungen ?? 0} sub={`von ${funnelStats?.verein_einladungen ?? 0} Einladungen`} />
              </div>
            </div>

            <div style={{ ...cardStyle, marginBottom: 18 }}>
              <SectionLabel>Top 5 Gemeinden</SectionLabel>
              {loading ? <div style={{ color: '#8B7355', fontSize: 13 }}>Lade Gemeindedaten...</div>
                : topGemeinden.length === 0 ? <EmptyState icon="📊" text="Noch keine Gemeindedaten" sub="Sobald Gemeinden und Einsätze vorhanden sind, erscheint hier das Ranking." />
                : topGemeinden.map((g) => (
                  <div key={g.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.9fr 0.9fr 0.9fr 0.9fr', gap: 10, padding: '10px 0', borderBottom: '1px solid #EFE8DB' }}>
                    <div style={{ fontWeight: 700 }}>{g.name || g.ort || 'Gemeinde'}</div>
                    <div style={{ fontSize: 12, color: '#8B7355' }}>{g.freiwillige_count || 0} Freiwillige</div>
                    <div style={{ fontSize: 12, color: '#8B7355' }}>{g.vereine_count || 0} Vereine</div>
                    <div style={{ fontSize: 12, color: '#8B7355' }}>{g.stellen_count || 0} Stellen</div>
                    <div style={{ fontSize: 12, color: '#8B7355' }}>{g.gesamtstunden || 0} Std.</div>
                  </div>
                ))}
            </div>

            <div style={{ ...cardStyle, marginBottom: 18 }}>
              <SectionLabel>CSR- & Wirkungsdashboard</SectionLabel>
              {csrStats.length === 0 ? <EmptyState icon="🌍" text="Noch keine CSR-Daten" sub="Sobald Einsatzreports vorhanden sind, siehst du hier Wirkungsbereiche und Stunden." />
                : csrStats.map((row) => (
                  <div key={row.wirkungsbereich} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.9fr 0.9fr 0.9fr', gap: 10, padding: '10px 0', borderBottom: '1px solid #EFE8DB' }}>
                    <div style={{ fontWeight: 700 }}>{row.wirkungsbereich}</div>
                    <div style={{ fontSize: 12, color: '#8B7355' }}>{row.completed_einsaetze_count || 0} Einsätze</div>
                    <div style={{ fontSize: 12, color: '#8B7355' }}>{row.helfer_tatsaechlich_summe || 0} Helfer</div>
                    <div style={{ fontSize: 12, color: '#8B7355' }}>{row.gesamtstunden || 0} Std.</div>
                    <div style={{ fontSize: 12, color: '#8B7355' }}>{row.orga_ersparnis_stunden || 0} Std. Ersparnis</div>
                  </div>
                ))}
            </div>

            <div style={{ ...cardStyle, marginBottom: 18 }}>
              <SectionLabel>Altersgruppen</SectionLabel>
              {altersgruppenStats.length === 0 ? <EmptyState icon="🧑‍🤝‍🧑" text="Noch keine Demografie-Daten" sub="Sobald Geburtsdaten und Teilnahmen vorhanden sind, erscheint hier die Verteilung." />
                : altersgruppenStats.map((row) => (
                  <div key={row.altersgruppe} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, padding: '10px 0', borderBottom: '1px solid #EFE8DB' }}>
                    <div style={{ fontWeight: 700 }}>{row.altersgruppe}</div>
                    <div style={{ fontSize: 12, color: '#8B7355' }}>{row.freiwillige_count || 0} Freiwillige</div>
                    <div style={{ fontSize: 12, color: '#8B7355' }}>{row.teilnahmen_count || 0} Teilnahmen</div>
                    <div style={{ fontSize: 12, color: '#8B7355' }}>{row.nicht_erschienen_count || 0} No-Shows</div>
                  </div>
                ))}
            </div>

            <div style={{ ...cardStyle, marginBottom: 18 }}>
              <SectionLabel>PLZ-Analyse</SectionLabel>
              <Input label="PLZ-Filter" value={plzFilter} onChange={(e) => setPlzFilter(e.target ? e.target.value : e)} />
              {plzRows.length === 0 ? <EmptyState icon="📍" text="Keine Daten zur gewählten PLZ" sub="Passe den Filter an oder ergänze Gemeinden und Nutzer." />
                : plzRows.map((row) => (
                  <div key={`${row.plz}-${row.gemeinde_name}`} style={{ display: 'grid', gridTemplateColumns: '90px 1.2fr 0.9fr 0.9fr 0.9fr 0.9fr', gap: 10, padding: '10px 0', borderBottom: '1px solid #EFE8DB' }}>
                    <div style={{ fontWeight: 700 }}>{row.plz}</div>
                    <div style={{ fontSize: 12, color: '#5C4A32' }}>{row.gemeinde_name}</div>
                    <div style={{ fontSize: 12, color: '#8B7355' }}>{row.freiwillige} Freiwillige</div>
                    <div style={{ fontSize: 12, color: '#8B7355' }}>{row.vereine} Vereine</div>
                    <div style={{ fontSize: 12, color: '#8B7355' }}>{row.stellen} Stellen</div>
                    <div style={{ fontSize: 12, color: '#8B7355' }}>{row.gesamtstunden} Std.</div>
                  </div>
                ))}
            </div>
          </>
        )}

        {/* ── ANFRAGEN ── */}
        {activeTab === 'anfragen' && <AnfragenTab />}

        {/* ── SUPPORT ── */}
        {activeTab === 'support' && (
          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 18 }}>
            <div style={{ ...cardStyle }}>
              <SectionLabel>Support-Anfragen</SectionLabel>
              {supportLoading ? <div style={{ color: '#8B7355', fontSize: 13 }}>Lade Support-Anfragen...</div>
                : supportError ? <div style={{ color: '#B53A2D', fontSize: 13, fontWeight: 700 }}>{supportError}</div>
                : supportThreads.length === 0 ? <EmptyState icon="💬" text="Noch keine Support-Anfragen" sub="Sobald Vereine, Gemeinden oder Freiwillige schreiben, erscheinen die Threads hier." />
                : supportThreads.map((thread) => {
                  const organisation = thread.organisation || normalizeSupportThread(thread).organisation;
                  const isSelected = selectedThread?.id === thread.id;
                  return (
                    <button key={thread.id} onClick={() => { setSelectedThread(thread); setSelectedOrganisation(organisation || null); }} style={{ width: '100%', textAlign: 'left', border: isSelected ? '2px solid #2C2416' : '1px solid #E6D9C2', background: isSelected ? '#F3EBDD' : '#FAF7F2', borderRadius: 14, padding: 12, marginBottom: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
                      <div style={{ fontWeight: 700 }}>{organisation?.name || 'Unbekannt'}</div>
                      <div style={{ fontSize: 12, color: '#8B7355', marginTop: 4 }}>{organisation?.type === 'verein' ? 'Verein' : organisation?.type === 'freiwilliger' ? 'Freiwilliger' : organisation?.type === 'gemeinde' ? 'Gemeinde' : 'Unbekannt'}{organisation?.email ? ` • ${organisation.email}` : ''}</div>
                      <div style={{ fontSize: 12, color: '#5C4A32', marginTop: 6 }}>{thread.last_message_preview || 'Keine Vorschau verfügbar'}</div>
                      <div style={{ fontSize: 11, color: '#8B7355', marginTop: 8 }}>{thread.last_message_at ? new Date(thread.last_message_at).toLocaleString('de-DE') : 'Keine Aktivität'}</div>
                    </button>
                  );
                })}
            </div>
            <div style={{ ...cardStyle, minHeight: 520 }}>
              {selectedThread ? (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedOrganisation?.name || 'Support-Verlauf'}</div>
                    <div style={{ fontSize: 12, color: '#8B7355', marginTop: 4 }}>{selectedOrganisation?.type === 'verein' ? 'Verein' : selectedOrganisation?.type === 'freiwilliger' ? 'Freiwilliger' : selectedOrganisation?.type === 'gemeinde' ? 'Gemeinde' : 'Unbekannt'}{selectedOrganisation?.email ? ` • ${selectedOrganisation.email}` : ''}</div>
                  </div>
                  <MessageThreadView threadId={selectedThread.id} currentUserRole="admin" contextType="support" organisation={selectedOrganisation} onMessageSent={loadSupportThreads} />
                </>
              ) : <EmptyState icon="📨" text="Kein Thread ausgewählt" sub="Wähle links eine Support-Anfrage aus." />}
            </div>
          </div>
        )}

        {/* ── SO TICKT CIVICO ── */}
        {activeTab === 'sotickts' && <SoTicktCivicoTab />}

      </div>
    </div>
  );
}

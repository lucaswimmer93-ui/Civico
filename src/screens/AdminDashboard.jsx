import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../core/shared';
import { Header, Input, SectionLabel, EmptyState } from '../components/ui';
import MessageThreadView from '../components/MessageThreadView';
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
  
  useEffect(() => {
    console.log('ADMIN DASHBOARD DEBUG VISIBLE AKTIV');
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    setError('');

    const [
      dashboardRes,
      funnelRes,
      gemeindenRes,
      vereineRes,
      altersgruppenRes,
      regionRes,
      csrRes,
    ] = await Promise.all([
      supabase.from('admin_dashboard_stats').select('*').maybeSingle(),
      supabase.from('admin_funnel_stats').select('*').maybeSingle(),
      supabase.from('admin_gemeinden_stats').select('*').order('gesamtstunden', { ascending: false }),
      supabase.from('admin_vereine_stats').select('*').order('gesamtstunden', { ascending: false }),
      supabase.from('admin_altersgruppen_stats').select('*'),
      supabase.from('admin_regionale_impact_stats').select('*').order('gesamtstunden', { ascending: false }),
      supabase.from('admin_csr_stats').select('*').order('gesamtstunden', { ascending: false }),
    ]);

    const firstError = [
      dashboardRes.error,
      funnelRes.error,
      gemeindenRes.error,
      vereineRes.error,
      altersgruppenRes.error,
      regionRes.error,
      csrRes.error,
    ].find(Boolean);

    if (firstError) {
      setError(firstError.message || 'Admin-Daten konnten nicht geladen werden.');
    }

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

      const data = await getAdminSupportThreads();
      setSupportThreads(data || []);

      if (data?.length > 0 && !selectedThread) {
        const first = data[0];
        setSelectedThread(first);
        setSelectedOrganisation(
          first.verein
            ? { type: 'verein', ...first.verein }
            : first.gemeinde
            ? { type: 'gemeinde', ...first.gemeinde }
            : null
        );
      }
    } catch (err) {
      console.error('Fehler beim Laden der Support-Threads:', err);
      setSupportError(err.message || 'Support-Threads konnten nicht geladen werden.');
    } finally {
      setSupportLoading(false);
    }
  };
  
useEffect(() => {
  loadAdminData();
  loadSupportThreads();
}, []);

  const handleCreateGemeinde = async () => {
    const cleanName = String(gemeindeName || '').trim();
    const cleanEmail = String(adminEmail || '').trim().toLowerCase();
    const cleanPlz = String(plz || '').trim();
    const cleanOrt = String(ort || '').trim();
    const cleanBundesland = String(bundesland || '').trim() || 'Hessen';

    if (!cleanName || !cleanEmail) {
      setError('Gemeindename und Admin-E-Mail sind Pflichtfelder.');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    console.log('ADMIN SESSION CHECK:', session);
    setSessionInfo(session ? `Session vorhanden: ${session.user?.email || 'ohne Email'}` : 'KEINE SESSION');

    if (!session) {
      setError('Keine aktive Supabase-Session gefunden. Bitte als echter Admin neu einloggen.');
      setSuccess('');
      return;
    }

    setSavingGemeinde(true);
    setError('');
    setSuccess('');
    setInviteLink('');
    setDebugInfo('Function-Aufruf läuft ...');

    const { data, error: invokeError } = await supabase.functions.invoke('admin-create-gemeinde-invite', {
      body: {
        name: cleanName,
        email: cleanEmail,
        plz: cleanPlz,
        ort: cleanOrt,
        bundesland: cleanBundesland,
        nachricht,
      },
    });

    console.log('ADMIN CREATE GEMEINDE RESPONSE:', data);
    console.log('ADMIN CREATE GEMEINDE ERROR:', invokeError);

    setSavingGemeinde(false);

    if (invokeError) {
      const msg = invokeError.message || 'Gemeinde konnte nicht angelegt werden.';
      setError(`DEBUG INVOKE FEHLER: ${msg}`);
      setDebugInfo(`InvokeError: ${msg}`);
      return;
    }

    if (!data?.ok) {
      const msg = data?.error || 'Gemeinde konnte nicht angelegt werden.';
      setError(`DEBUG BACKEND FEHLER: ${msg}`);
      setDebugInfo(`BackendError: ${msg}`);
      return;
    }

    setSuccess(`Gemeinde gespeichert. Einladung für ${data.email} wurde erzeugt.`);
    setInviteLink(data.action_link || '');
    setDebugInfo('Erfolg');
    setGemeindeName('');
    setAdminEmail('');
    setPlz('');
    setOrt('');
    setNachricht('Kurze Info für die Gemeinde');

    await loadAdminData();
  };

  const plzRows = useMemo(() => {
    return gemeindenStats
      .map((g) => ({
        plz: String(g.plz || 'ohne PLZ'),
        gemeinde_name: g.name || g.ort || 'Gemeinde',
        freiwillige: g.freiwillige_count || 0,
        vereine: g.vereine_count || 0,
        stellen: g.stellen_count || 0,
        gesamtstunden: g.gesamtstunden || 0,
      }))
      .filter((row) => !plzFilter || row.plz.startsWith(String(plzFilter).trim()))
      .sort((a, b) => a.plz.localeCompare(b.plz));
  }, [gemeindenStats, plzFilter]);

  const topGemeinden = useMemo(() => {
    return [...gemeindenStats]
      .sort((a, b) => ((b.gesamtstunden || 0) + (b.completed_einsaetze_count || 0)) - ((a.gesamtstunden || 0) + (a.completed_einsaetze_count || 0)))
      .slice(0, 5);
  }, [gemeindenStats]);

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setSuccess('Einladungslink kopiert.');
    } catch (e) {
      setError('Link konnte nicht automatisch kopiert werden.');
    }
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
});
  
  return (
    <div>
      <Header title="Admin-Dashboard DEBUG VISIBLE" subtitle="CSR, Gemeinden, Vereine und Demografie" onBack={onBack} onLogout={logout} />
            <div style={{ padding: '0 16px 16px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button style={tabButtonStyle(activeTab === 'overview')} onClick={() => setActiveTab('overview')}>
          Übersicht
        </button>
        <button style={tabButtonStyle(activeTab === 'support')} onClick={() => setActiveTab('support')}>
          Support
        </button>
      </div>
      <div style={{ padding: '0 16px 24px' }}>
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
            <button
              onClick={handleCreateGemeinde}
              disabled={savingGemeinde}
              style={{
                background: '#2C2416',
                color: '#fff',
                border: 'none',
                borderRadius: 14,
                padding: '12px 18px',
                cursor: savingGemeinde ? 'default' : 'pointer',
                fontFamily: 'inherit',
                fontWeight: 700,
              }}
            >
              {savingGemeinde ? 'Speichern...' : 'Gemeinde speichern'}
            </button>
            {inviteLink ? (
              <button
                onClick={copyInviteLink}
                style={{
                  background: '#FAF7F2',
                  color: '#2C2416',
                  border: '1px solid #E6D9C2',
                  borderRadius: 14,
                  padding: '12px 18px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontWeight: 700,
                }}
              >
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
          {loading ? (
            <div style={{ color: '#8B7355', fontSize: 13 }}>Lade Gemeindedaten...</div>
          ) : topGemeinden.length === 0 ? (
            <EmptyState icon="📊" text="Noch keine Gemeindedaten" sub="Sobald Gemeinden und Einsätze vorhanden sind, erscheint hier das Ranking." />
          ) : topGemeinden.map((g) => (
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
          {csrStats.length === 0 ? (
            <EmptyState icon="🌍" text="Noch keine CSR-Daten" sub="Sobald Einsatzreports vorhanden sind, siehst du hier Wirkungsbereiche und Stunden." />
          ) : csrStats.map((row) => (
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
          <SectionLabel>Altersgruppen: Wo wird am meisten Ehrenamt gemacht?</SectionLabel>
          {altersgruppenStats.length === 0 ? (
            <EmptyState icon="🧑‍🤝‍🧑" text="Noch keine Demografie-Daten" sub="Sobald Geburtsdaten und Teilnahmen vorhanden sind, erscheint hier die Verteilung." />
          ) : altersgruppenStats.map((row) => (
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
          {plzRows.length === 0 ? (
            <EmptyState icon="📍" text="Keine Daten zur gewählten PLZ" sub="Passe den Filter an oder ergänze Gemeinden und Nutzer." />
          ) : plzRows.map((row) => (
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
      </div>
          </>
  )}
        
        {activeTab === 'support' && (
  <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 18 }}>
    
    {/* LINK: Thread-Liste */}
    <div style={{ ...cardStyle }}>
      <SectionLabel>Support-Anfragen</SectionLabel>

      {supportLoading ? (
        <div style={{ color: '#8B7355', fontSize: 13 }}>
          Lade Support-Anfragen...
        </div>
      ) : supportError ? (
        <div style={{ color: '#B53A2D', fontSize: 13, fontWeight: 700 }}>
          {supportError}
        </div>
      ) : supportThreads.length === 0 ? (
        <EmptyState
          icon="💬"
          text="Noch keine Support-Anfragen"
          sub="Sobald Vereine oder Gemeinden schreiben, erscheinen die Threads hier."
        />
      ) : (
        supportThreads.map((thread) => {
          const organisation = thread.verein || thread.gemeinde;
          const organisationType = thread.verein ? 'Verein' : 'Gemeinde';
          const isSelected = selectedThread?.id === thread.id;

          return (
            <button
              key={thread.id}
              onClick={() => {
                setSelectedThread(thread);
                setSelectedOrganisation(
                  thread.verein
                    ? { type: 'verein', ...thread.verein }
                    : { type: 'gemeinde', ...thread.gemeinde }
                );
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                border: isSelected ? '2px solid #2C2416' : '1px solid #E6D9C2',
                background: isSelected ? '#F3EBDD' : '#FAF7F2',
                borderRadius: 14,
                padding: 12,
                marginBottom: 10,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ fontWeight: 700 }}>
                {organisation?.name || 'Unbekannt'}
              </div>

              <div style={{ fontSize: 12, color: '#8B7355', marginTop: 4 }}>
                {organisationType}
                {organisation?.email ? ` • ${organisation.email}` : ''}
              </div>

              <div style={{ fontSize: 12, color: '#5C4A32', marginTop: 6 }}>
                {thread.last_message_preview || 'Keine Vorschau verfügbar'}
              </div>

              <div style={{ fontSize: 11, color: '#8B7355', marginTop: 8 }}>
                {thread.last_message_at
                  ? new Date(thread.last_message_at).toLocaleString('de-DE')
                  : 'Keine Aktivität'}
              </div>
            </button>
          );
        })
      )}
    </div>

    {/* RECHTS: Thread */}
    <div style={{ ...cardStyle, minHeight: 520 }}>
      {selectedThread ? (
        <>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {selectedOrganisation?.name || 'Support-Verlauf'}
            </div>

            <div style={{ fontSize: 12, color: '#8B7355', marginTop: 4 }}>
              {selectedOrganisation?.type === 'verein' ? 'Verein' : 'Gemeinde'}
              {selectedOrganisation?.email
                ? ` • ${selectedOrganisation.email}`
                : ''}
            </div>
          </div>

          <MessageThreadView
            threadId={selectedThread.id}
            currentUserRole="admin"
            contextType="support"
            organisation={selectedOrganisation}
            onMessageSent={loadSupportThreads}
          />
        </>
      ) : (
        <EmptyState
          icon="📨"
          text="Kein Thread ausgewählt"
          sub="Wähle links eine Support-Anfrage aus."
        />
      )}
    </div>

  </div>
)}
    </div>
  );
}

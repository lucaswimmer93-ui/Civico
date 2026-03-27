import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './core/shared';
import AdminDashboard from './screens/AdminDashboard';

const shell = {
  bg: '#F3EEE4',
  panel: '#FAF7F2',
  border: '#E6D9C2',
  text: '#2C2416',
  muted: '#8B7355',
  dark: '#1A1208',
  dark2: '#2C2416',
  ok: '#3A7D44',
  warn: '#C47F17',
  danger: '#B65353',
  info: '#5B9BD5',
};

function cardStyle(extra = {}) {
  return {
    background: shell.panel,
    border: `1px solid ${shell.border}`,
    borderRadius: 18,
    padding: 18,
    ...extra,
  };
}

function buttonStyle(kind = 'primary') {
  const styles = {
    primary: {
      background: `linear-gradient(135deg, ${shell.dark}, ${shell.dark2})`,
      color: '#F4F0E8',
      border: 'none',
    },
    secondary: {
      background: 'transparent',
      color: shell.muted,
      border: `1px solid ${shell.border}`,
    },
    success: {
      background: '#ECF7EE',
      color: shell.ok,
      border: '1px solid #B8D8BE',
    },
    danger: {
      background: '#FFF0F0',
      color: shell.danger,
      border: '1px solid #E5BBBB',
    },
  };
  return {
    padding: '11px 14px',
    borderRadius: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontWeight: 700,
    fontSize: 13,
    ...styles[kind],
  };
}

function Field({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, color: shell.muted, marginBottom: 6 }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          background: '#fff',
          border: `1px solid ${shell.border}`,
          borderRadius: 12,
          padding: '12px 14px',
          fontFamily: 'inherit',
          fontSize: 14,
          color: shell.text,
        }}
      />
    </label>
  );
}

function Message({ tone = 'info', children }) {
  const toneMap = {
    info: { bg: '#EEF5FB', border: '#C8DDF1', color: '#30516D' },
    ok: { bg: '#ECF7EE', border: '#B8D8BE', color: '#2F6638' },
    warn: { bg: '#FFF7E9', border: '#F0D7A2', color: '#8B6800' },
    danger: { bg: '#FFF0F0', border: '#E5BBBB', color: '#8C3E3E' },
  };
  const c = toneMap[tone] || toneMap.info;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color, borderRadius: 14, padding: '12px 14px', fontSize: 13 }}>
      {children}
    </div>
  );
}

function safeSingle(table, builder) {
  let query = supabase.from(table).select('*');
  if (builder) query = builder(query);
  return query.single();
}

function safeSelect(table, select = '*', builder) {
  let query = supabase.from(table).select(select);
  if (builder) query = builder(query);
  return query;
}

function AdminLogin({ onLoggedIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Bitte E-Mail und Passwort eingeben.');
      return;
    }
    setLoading(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError || !data?.user) {
      setLoading(false);
      setError('Login fehlgeschlagen. Bitte prüfe E-Mail und Passwort.');
      return;
    }

    const userId = data.user.id;
    const userEmail = data.user.email || email;

    const { data: adminByAuth } = await safeSingle('admins', (q) => q.eq('auth_id', userId));
    const admin = adminByAuth || (await safeSingle('admins', (q) => q.eq('email', userEmail)).then((r) => r.data).catch(() => null));

    if (!admin) {
      await supabase.auth.signOut();
      setLoading(false);
      setError('Dieser Account ist nicht als Admin freigeschaltet.');
      return;
    }

    onLoggedIn({ ...admin, email: admin.email || userEmail, auth_id: admin.auth_id || userId });
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: shell.bg, color: shell.text }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '56px 16px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 12, color: shell.muted, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Civico Backoffice</div>
          <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Admin-Anwendung</div>
          <div style={{ fontSize: 14, color: shell.muted, lineHeight: 1.6 }}>
            Separater Zugang für dich. Vereine, Gemeinden und Freiwillige bleiben in der normalen App.
          </div>
        </div>

        <form onSubmit={handleLogin} style={cardStyle()}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Anmelden</div>
          <div style={{ display: 'grid', gap: 14 }}>
            <Field label="Admin-E-Mail" value={email} onChange={setEmail} type="email" placeholder="admin@mycivico.de" />
            <Field label="Passwort" value={password} onChange={setPassword} type="password" placeholder="••••••••" />
            {error ? <Message tone="danger">{error}</Message> : null}
            <button type="submit" disabled={loading} style={{ ...buttonStyle('primary'), width: '100%', opacity: loading ? 0.75 : 1 }}>
              {loading ? 'Anmeldung läuft …' : 'Admin-Login'}
            </button>
          </div>
        </form>

        <div style={{ marginTop: 16 }}>
          <Message tone="warn">
            Öffentliche Registrierung gibt es hier bewusst nicht. Ein Admin-Account muss im Backend in der Tabelle <b>admins</b> freigeschaltet sein.
          </Message>
        </div>
      </div>
    </div>
  );
}

export default function AdminApp() {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const [gemeinden, setGemeinden] = useState([]);
  const [vereine, setVereine] = useState([]);
  const [freiwillige, setFreiwillige] = useState([]);
  const [stellen, setStellen] = useState([]);
  const [einladungen, setEinladungen] = useState([]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePlz, setInvitePlz] = useState('');
  const [inviteOrt, setInviteOrt] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data?.session;
      if (!active) return;
      if (!session?.user) {
        setSessionChecked(true);
        return;
      }
      const userId = session.user.id;
      const userEmail = session.user.email;
      const { data: adminByAuth } = await safeSingle('admins', (q) => q.eq('auth_id', userId));
      const adminRow = adminByAuth || (await safeSingle('admins', (q) => q.eq('email', userEmail)).then((r) => r.data).catch(() => null));
      if (adminRow) setAdmin({ ...adminRow, email: adminRow.email || userEmail, auth_id: adminRow.auth_id || userId });
      else await supabase.auth.signOut();
      setSessionChecked(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadData = async () => {
    setLoading(true);
    const [gemeindenRes, vereineRes, freiwilligeRes, stellenRes, einladungenRes] = await Promise.all([
      safeSelect('gemeinden', '*', (q) => q.order('created_at', { ascending: false })),
      safeSelect('vereine', '*', (q) => q.order('created_at', { ascending: false })),
      safeSelect('freiwillige', '*', (q) => q.order('created_at', { ascending: false })),
      safeSelect('stellen', '*, vereine(id, name, gemeinde_id), termine(id, datum, startzeit, endzeit, freie_plaetze, gesamt_plaetze, bewerbungen(id, freiwilliger_id, bestaetigt, nicht_erschienen))', (q) => q.order('created_at', { ascending: false })),
      safeSelect('verein_einladungen', '*', (q) => q.order('created_at', { ascending: false })),
    ]);

    setGemeinden(gemeindenRes.data || []);
    setVereine(vereineRes.data || []);
    setFreiwillige(freiwilligeRes.data || []);
    setStellen(stellenRes.data || []);
    setEinladungen(einladungenRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (admin) loadData();
  }, [admin]);

  const logout = async () => {
    await supabase.auth.signOut();
    setAdmin(null);
  };

  const zustandeMap = useMemo(() => {
    const map = new Map();
    stellen.forEach((stelle) => {
      const vereinId = stelle.verein_id || stelle.vereine?.id;
      if (!vereinId) return;
      const value = (stelle.termine || []).filter((termin) => (termin.bewerbungen || []).some((b) => b.bestaetigt)).length;
      map.set(vereinId, (map.get(vereinId) || 0) + value);
    });
    return map;
  }, [stellen]);

  const onVerifyVerein = async (vereinId, nextValue) => {
    const { error } = await supabase.from('vereine').update({ verifiziert: nextValue }).eq('id', vereinId);
    if (error) {
      setToast({ text: 'Freischaltung konnte nicht gespeichert werden.', tone: 'danger' });
      return;
    }
    setVereine((prev) => prev.map((v) => (v.id === vereinId ? { ...v, verifiziert: nextValue } : v)));
    setToast({ text: nextValue ? 'Verein freigeschaltet.' : 'Freischaltung entfernt.', tone: 'ok' });
  };

  const onTogglePlan = async (vereinId, nextValue) => {
    const { error } = await supabase.from('vereine').update({ plan_aktiv: nextValue }).eq('id', vereinId);
    if (error) {
      setToast({ text: 'Plan-Status konnte nicht gespeichert werden.', tone: 'danger' });
      return;
    }
    setVereine((prev) => prev.map((v) => (v.id === vereinId ? { ...v, plan_aktiv: nextValue } : v)));
    setToast({ text: nextValue ? 'Plan als aktiv markiert.' : 'Plan als inaktiv markiert.', tone: 'ok' });
  };

  const createGemeindeInvite = async () => {
    if (!inviteName || !inviteEmail) {
      setToast({ text: 'Name und E-Mail sind Pflicht.', tone: 'danger' });
      return;
    }
    setInviteLoading(true);

    const payload = {
      name: inviteName,
      email: inviteEmail,
      plz: invitePlz || null,
      ort: inviteOrt || null,
      nachricht: inviteMessage || null,
      status: 'eingeladen',
      invited_by: admin?.id || null,
    };

    const { data, error } = await supabase.from('gemeinden').insert(payload).select().single();
    if (error) {
      setToast({ text: 'Einladung konnte nicht gespeichert werden. Das Backend braucht dafür noch die passende Tabelle/Spalten.', tone: 'warn' });
      setInviteLoading(false);
      return;
    }

    setGemeinden((prev) => [data, ...prev]);
    setInviteName('');
    setInviteEmail('');
    setInvitePlz('');
    setInviteOrt('');
    setInviteMessage('');
    setInviteOpen(false);
    setInviteLoading(false);
    setToast({ text: 'Gemeinde angelegt. Den Auth-Account legen wir im Backend im nächsten Schritt sauber nach.', tone: 'ok' });
  };

  if (!sessionChecked) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: shell.bg, color: shell.text }}>Admin-Anwendung wird geladen …</div>;
  }

  return (
    <>
      {!admin ? (
        <AdminLogin onLoggedIn={setAdmin} />
      ) : (
        <div style={{ minHeight: '100vh', background: shell.bg, color: shell.text }}>
          <div style={{ maxWidth: 1180, margin: '0 auto', paddingBottom: 24 }}>
            <div style={{
              background: `linear-gradient(160deg, ${shell.dark}, ${shell.dark2})`,
              color: '#F4F0E8',
              padding: '24px 20px 18px',
              borderBottomLeftRadius: 22,
              borderBottomRightRadius: 22,
              marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#B9A891', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Civico Admin</div>
                  <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Backoffice</div>
                  <div style={{ fontSize: 14, color: '#D7C7B3', maxWidth: 700, lineHeight: 1.6 }}>
                    Eigene Anwendung nur für dich. Hier steuerst du Freischaltungen, Einladungen, Gemeinden und Pay-Erinnerungen zentral – getrennt von der Nutzer-App.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '10px 12px', fontSize: 12 }}>
                    {admin.name || admin.email}
                  </div>
                  <button onClick={() => loadData()} style={buttonStyle('secondary')}>Neu laden</button>
                  <button onClick={() => setInviteOpen((p) => !p)} style={buttonStyle('secondary')}>+ Gemeinde anlegen</button>
                  <button onClick={logout} style={buttonStyle('secondary')}>Abmelden</button>
                </div>
              </div>
            </div>

            <div style={{ padding: '0 16px' }}>
              {inviteOpen ? (
                <div style={{ ...cardStyle({ marginBottom: 16 }) }}>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Gemeinde anlegen</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12, marginBottom: 12 }}>
                    <Field label="Gemeindename" value={inviteName} onChange={setInviteName} placeholder="z. B. Einhausen" />
                    <Field label="Admin-E-Mail" value={inviteEmail} onChange={setInviteEmail} type="email" placeholder="gemeinde@..." />
                    <Field label="PLZ" value={invitePlz} onChange={setInvitePlz} placeholder="64683" />
                    <Field label="Ort" value={inviteOrt} onChange={setInviteOrt} placeholder="Einhausen" />
                  </div>
                  <label style={{ display: 'block', marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: shell.muted, marginBottom: 6 }}>Nachricht</div>
                    <textarea value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)} rows={4} style={{ width: '100%', boxSizing: 'border-box', borderRadius: 12, padding: 12, border: `1px solid ${shell.border}`, fontFamily: 'inherit', fontSize: 14 }} placeholder="Kurze Info für die Gemeinde" />
                  </label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={createGemeindeInvite} disabled={inviteLoading} style={buttonStyle('primary')}>
                      {inviteLoading ? 'Speichern …' : 'Gemeinde speichern'}
                    </button>
                    <button onClick={() => setInviteOpen(false)} style={buttonStyle('secondary')}>Schließen</button>
                  </div>
                </div>
              ) : null}

              <AdminDashboard
                admin={admin}
                gemeinden={gemeinden}
                organisationen={vereine}
                freiwillige={freiwillige}
                stellen={stellen}
                anfragen={einladungen}
                loading={loading}
                zustandeMap={zustandeMap}
                onVerifyVerein={onVerifyVerein}
                onTogglePlan={onTogglePlan}
                onRefresh={loadData}
              />
            </div>
          </div>

          {toast ? (
            <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 20, zIndex: 999, minWidth: 280, maxWidth: '90vw' }}>
              <Message tone={toast.tone || 'info'}>{toast.text}</Message>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}

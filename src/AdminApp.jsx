// FULL FIXED AdminApp.jsx

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './core/shared';
import AdminDashboard from './screens/AdminDashboard';

// (rest of file unchanged except function below)

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

  const loadData = async () => {
    const { data } = await supabase.from('gemeinden').select('*');
    setGemeinden(data || []);
  };

  const createGemeindeInvite = async () => {
    if (!inviteName || !inviteEmail) {
      setToast({ text: 'Name und E-Mail sind Pflicht.', tone: 'danger' });
      return;
    }

    setInviteLoading(true);

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      setToast({ text: 'Keine aktive Admin-Session gefunden.', tone: 'danger' });
      setInviteLoading(false);
      return;
    }

    const { data, error } = await supabase.functions.invoke('admin-create-gemeinde-invite', {
      body: {
        name: inviteName,
        email: String(inviteEmail).trim().toLowerCase(),
        plz: invitePlz || null,
        ort: inviteOrt || null,
        bundesland: null,
        nachricht: inviteMessage || null,
      },
    });

    if (error) {
      setToast({ text: error.message || 'Einladung konnte nicht erstellt werden.', tone: 'danger' });
      setInviteLoading(false);
      return;
    }

    if (!data?.ok) {
      setToast({ text: data?.error || 'Einladung konnte nicht erstellt werden.', tone: 'danger' });
      setInviteLoading(false);
      return;
    }

    setInviteName('');
    setInviteEmail('');
    setInvitePlz('');
    setInviteOrt('');
    setInviteMessage('');
    setInviteOpen(false);
    setInviteLoading(false);

    await loadData();

    setToast({
      text: `Gemeinde gespeichert. Einladung für ${data.email} wurde erzeugt.`,
      tone: 'ok',
    });
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Gemeinde anlegen</h2>

      <input placeholder="Name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
      <input placeholder="Email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />

      <button onClick={createGemeindeInvite}>
        Gemeinde speichern
      </button>

      {toast && <div>{toast.text}</div>}
    </div>
  );
}

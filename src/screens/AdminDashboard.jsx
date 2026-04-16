import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../core/shared';
import { Header, Input, SectionLabel, EmptyState } from '../components/ui';
import MessageThreadView from '../components/messages/MessageThreadView';

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

  const vereinName = pickFirst(vereinSource?.name, thread?.verein_name, thread?.vereinsname, thread?.organisation_name, thread?.name);
  const vereinEmail = pickFirst(vereinSource?.kontakt_email, vereinSource?.email, thread?.verein_email, thread?.kontakt_email, thread?.organisation_email, thread?.email);

  const gemeindeName = pickFirst(gemeindeSource?.name, thread?.gemeinde_name, thread?.organisation_name, thread?.name);
  const gemeindeEmail = pickFirst(gemeindeSource?.email, thread?.gemeinde_email, thread?.kontakt_email, thread?.organisation_email, thread?.email);

  const freiwilligerName = pickFirst(freiwilligerSource?.name, thread?.freiwilliger_name, thread?.organisation_name, thread?.name);
  const freiwilligerEmail = pickFirst(freiwilligerSource?.email, thread?.freiwilliger_email, thread?.kontakt_email, thread?.organisation_email, thread?.email);

  const detectedType = pickFirst(
    thread?.organisation_type,
    thread?.sender_type,
    thread?.thread_type === 'support_verein' ? 'verein' : '',
    thread?.thread_type === 'support_gemeinde' ? 'gemeinde' : '',
    thread?.thread_type === 'support_freiwilliger' ? 'freiwilliger' : ''
  );

  const hasVereinData = Boolean(vereinName || vereinEmail || thread?.verein_id || vereinSource);
  const hasGemeindeData = Boolean(gemeindeName || gemeindeEmail || thread?.gemeinde_id || gemeindeSource);
  const hasFreiwilligerData = Boolean(freiwilligerName || freiwilligerEmail || thread?.freiwilliger_id || freiwilligerSource);

  let type = 'gemeinde';
  if (detectedType === 'freiwilliger' || hasFreiwilligerData) type = 'freiwilliger';
  else if (detectedType === 'verein' || hasVereinData) type = 'verein';
  else if (detectedType === 'gemeinde' || hasGemeindeData) type = 'gemeinde';

  const organisation =
    type === 'verein'
      ? { type: 'verein', id: pickFirst(vereinSource?.id, thread?.verein_id, thread?.organisation_id) || null, name: pickFirst(vereinName, 'Verein'), email: pickFirst(vereinEmail, '') }
      : type === 'freiwilliger'
      ? { type: 'freiwilliger', id: pickFirst(freiwilligerSource?.id, thread?.freiwilliger_id, thread?.organisation_id) || null, name: pickFirst(freiwilligerName, 'Freiwilliger'), email: pickFirst(freiwilligerEmail, '') }
      : { type: 'gemeinde', id: pickFirst(gemeindeSource?.id, thread?.gemeinde_id, thread?.organisation_id) || null, name: pickFirst(gemeindeName, 'Gemeinde'), email: pickFirst(gemeindeEmail, '') };

  return { ...thread, organisation };
};  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAdminAuthUserId(data?.session?.user?.id || null);
    }).catch(() => {
      setAdminAuthUserId(null);
    });
  }, []);

  const fetchSupportThreads = async () => {
    const { data, error } = await supabase
      .from('message_threads')
      .select(`
        *,
        vereine ( id, name, kontakt_email, email ),
        gemeinden ( id, name, email ),
        freiwillige ( id, name, email )
      `)
      .eq('thread_type', 'support')
      .order('last_message_at', { ascending: false });

    if (error) throw error;
    return data || [];
  };

  const computeSupportUnreadCount = async (threadList) => {
    if (!adminAuthUserId || !threadList?.length) {
      setSupportUnreadCount(0);
      return;
    }

    const threadIds = threadList.map((thread) => thread.id).filter(Boolean);
    if (!threadIds.length) {
      setSupportUnreadCount(0);
      return;
    }

    const { data: readRows, error } = await supabase
      .from('message_read_status')
      .select('thread_id, last_read_at')
      .eq('user_id', adminAuthUserId)
      .in('thread_id', threadIds);

    if (error) throw error;

    const readMap = new Map((readRows || []).map((row) => [
      row.thread_id,
      row.last_read_at ? new Date(row.last_read_at).getTime() : 0,
    ]));

    const count = (threadList || []).reduce((sum, thread) => {
      const lastMessageAt = thread?.last_message_at ? new Date(thread.last_message_at).getTime() : 0;
      const lastReadAt = readMap.get(thread.id) || 0;
      return sum + (lastMessageAt && lastMessageAt > lastReadAt ? 1 : 0);
    }, 0);

    setSupportUnreadCount(count);
  };

  const loadSupportThreads = async () => {
    try {
      setSupportLoading(true);
      setSupportError('');
      const data = await fetchSupportThreads();
      const normalized = data.map(normalizeSupportThread);
      setSupportThreads(normalized);
      await computeSupportUnreadCount(normalized);

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

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const S = {
  bg: '#0A0A0A', surface: '#111111', border: '#2A2A2A',
  text: '#ffffff', muted: '#888888', dim: '#444444', yellow: '#F5C400',
  heading: "'Barlow Condensed', sans-serif", body: "'DM Sans', system-ui, sans-serif",
};

const APPT_STATUS = {
  confirmed: { bg: '#0d1f18', border: '#1a3d2a', color: '#1D9E75' },
  booked:    { bg: '#0d1f18', border: '#1a3d2a', color: '#1D9E75' },
  cancelled: { bg: '#1a0808', border: '#3a1010', color: '#cc4444' },
  showed:    { bg: '#0d1525', border: '#1a2a40', color: '#378ADD' },
  'no-show': { bg: '#1a1000', border: '#3a2200', color: '#cc8800' },
};

function fmtDate(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function StatusBadge({ status = '' }) {
  const s = status.toLowerCase();
  const c = APPT_STATUS[s] || { bg: '#161616', border: S.border, color: S.muted };
  return <span style={{ padding: '2px 9px', borderRadius: 3, background: c.bg, border: `1px solid ${c.border}`, color: c.color, fontSize: '0.68rem', fontFamily: S.heading, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{s || 'booked'}</span>;
}

function Skeleton() {
  return <tr>{[160, 110, 100, 80].map((w, i) => <td key={i} style={{ padding: '13px 16px' }}><div style={{ height: 13, width: w, borderRadius: 3, background: '#1a1a1a', animation: 'p 1.4s ease-in-out infinite' }} /></td>)}</tr>;
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('upcoming');

  useEffect(() => {
    fetch('/api/appointments-ghl')
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setAppointments(d.appointments ?? []); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const now = Date.now();
  const upcoming = appointments.filter((a) => (a.startTime || 0) >= now).sort((a, b) => a.startTime - b.startTime);
  const past     = appointments.filter((a) => (a.startTime || 0) <  now).sort((a, b) => b.startTime - a.startTime);
  const rows = tab === 'upcoming' ? upcoming : past;

  const TAB = (active) => ({
    padding: '6px 18px', border: 'none', borderRadius: 3, cursor: 'pointer',
    fontFamily: S.heading, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.1em', textTransform: 'uppercase',
    background: active ? S.yellow : 'transparent', color: active ? '#000' : S.muted,
  });

  return (
    <div style={{ minHeight: '100vh', background: S.bg, fontFamily: S.body, color: S.text }}>
      <div style={{ background: S.surface, borderBottom: `1px solid ${S.border}`, padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 14 }}>
        <Link href="/dashboard" style={{ color: S.muted, fontSize: '0.78rem', textDecoration: 'none' }}>← Dashboard</Link>
        <span style={{ color: S.border }}>|</span>
        <span style={{ fontFamily: S.heading, fontWeight: 700, fontSize: '1rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Appointments</span>
        {!loading && <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: S.dim }}>{upcoming.length} upcoming · {past.length} past</span>}
      </div>

      <div style={{ padding: '28px 24px', maxWidth: 1100, margin: '0 auto' }}>
        {error && <div style={{ padding: '12px 16px', background: '#1a0808', border: '1px solid #5a1a1a', borderRadius: 4, color: '#ff8080', fontSize: '0.8rem', marginBottom: 20 }}>⚠ {error}</div>}

        <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: S.surface, border: `1px solid ${S.border}`, borderRadius: 5, padding: 4, width: 'fit-content' }}>
          <button style={TAB(tab === 'upcoming')} onClick={() => setTab('upcoming')}>Upcoming ({loading ? '…' : upcoming.length})</button>
          <button style={TAB(tab === 'past')}     onClick={() => setTab('past')}>Past ({loading ? '…' : past.length})</button>
        </div>

        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 6, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${S.border}` }}>
                {['Contact', 'Date', 'Time', 'Status'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: S.heading, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: S.dim, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} />)
                : rows.length === 0
                  ? <tr><td colSpan={4} style={{ padding: '48px 16px', textAlign: 'center', color: S.dim, fontSize: '0.82rem' }}>{tab === 'upcoming' ? 'No upcoming appointments.' : 'No past appointments.'}</td></tr>
                  : rows.map((a) => (
                    <tr key={a.id} style={{ borderBottom: `1px solid ${S.border}` }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#161616'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '11px 16px', fontWeight: 500 }}>{a.contact?.name || a.title || '—'}</td>
                      <td style={{ padding: '11px 16px', color: S.muted, whiteSpace: 'nowrap' }}>{fmtDate(a.startTime)}</td>
                      <td style={{ padding: '11px 16px', color: S.muted, whiteSpace: 'nowrap' }}>{fmtTime(a.startTime)}</td>
                      <td style={{ padding: '11px 16px' }}><StatusBadge status={a.appointmentStatus || a.status} /></td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
      <style>{`@keyframes p{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );
}

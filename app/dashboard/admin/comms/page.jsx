'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import styles from '@/styles/dashboard.module.css';

const SIDEBAR = [
  ['/dashboard', '← Dashboard'],
  ['/dashboard/admin/clients', 'Client Health'],
  ['/dashboard/admin/calls', 'Call Analytics'],
  ['/dashboard/admin/comms', 'Comms Log'],
  ['/dashboard/admin/highlevel', 'GHL Provisioning'],
  ['/dashboard/admin/retell', 'Retell / Sarah'],
  ['/dashboard/admin/widget', 'Widget Embed'],
];

const TYPE_LABELS = {
  automation: { label: 'Automation', color: '#378ADD' },
  missed_call_text: { label: 'Missed Call Text', color: '#FF8C00' },
  review_request: { label: 'Review Request', color: '#4CAF50' },
  appointment_reminder: { label: 'Appt Reminder', color: '#FFD000' },
};

export default function CommsLogPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [filter, setFilter] = useState('all');

  useEffect(() => { if (status === 'unauthenticated') router.replace('/login'); }, [status, router]);
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (session?.user?.role !== 'super_admin') { router.replace('/dashboard'); return; }
    load();
  }, [status, session, days]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/comms?days=${days}`);
      const data = await res.json();
      setEvents(data.events || []);
    } finally { setLoading(false); }
  }

  if (status === 'loading' || session?.user?.role !== 'super_admin') return null;

  const filtered = filter === 'all' ? events : events.filter(e => e.type === filter);
  const counts = events.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {});

  return (
    <div className={styles.dashboardRoot}>
      <header className={styles.topbar}>
        <span className={styles.topbarLogo}>THE HYPE BOX</span>
        <span style={{ fontSize: '0.75rem', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Admin — Comms Log</span>
      </header>
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>
        <nav className={styles.sidebar}>
          {SIDEBAR.map(([href, label]) => <a key={href} href={href} className={styles.sidebarLink}>{label}</a>)}
        </nav>
        <main className={styles.mainContent} style={{ padding: 32 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>Communications Log</h1>
              <p style={{ fontSize: '0.85rem', color: '#555', margin: 0 }}>{events.length} events in last {days} days</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[7, 30, 90].map(d => (
                <button key={d} onClick={() => setDays(d)} style={{ background: days === d ? '#FFD000' : '#111', color: days === d ? '#000' : '#555', border: `1px solid ${days === d ? '#FFD000' : '#222'}`, borderRadius: 4, padding: '5px 12px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[['all', `All (${events.length})`], ...Object.entries(TYPE_LABELS).map(([k, v]) => [k, `${v.label} (${counts[k] || 0})`])].map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)} style={{ background: filter === k ? '#FFD000' : '#111', color: filter === k ? '#000' : '#555', border: `1px solid ${filter === k ? '#FFD000' : '#222'}`, borderRadius: 4, padding: '5px 12px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #222' }}>
                  {['Type', 'Contact / Info', 'Business', 'Time'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.68rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: '#444' }}>Loading…</td></tr>}
                {!loading && !filtered.length && <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: '#444' }}>No events found.</td></tr>}
                {filtered.map((e, i) => {
                  const meta = TYPE_LABELS[e.type] || { label: e.type, color: '#666' };
                  const contact = e.phone_number || e.from_number || e.customer_name || '—';
                  const biz = e.business_name || e.automation || '—';
                  return (
                    <tr key={e.id || i} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #1a1a1a' : 'none' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.05em', background: meta.color + '20', color: meta.color, border: `1px solid ${meta.color}40` }}>
                          {meta.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '0.82rem', color: '#ddd', fontFamily: 'monospace' }}>{contact}</td>
                      <td style={{ padding: '12px 14px', fontSize: '0.8rem', color: '#666' }}>{biz}</td>
                      <td style={{ padding: '12px 14px', fontSize: '0.75rem', color: '#444' }}>
                        {e.ts ? new Date(e.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}

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

function BarChart({ data, valueKey, labelKey, color = '#FFD000', height = 80 }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height, width: '100%' }}>
      {data.map((d, i) => (
        <div key={i} title={`${d[labelKey]}: ${d[valueKey]}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ width: '100%', background: color, borderRadius: '2px 2px 0 0', opacity: 0.85, height: `${Math.max((d[valueKey] / max) * height, d[valueKey] ? 3 : 1)}px` }} />
        </div>
      ))}
    </div>
  );
}

function fmtDuration(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function CallAnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { if (status === 'unauthenticated') router.replace('/login'); }, [status, router]);
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (session?.user?.role !== 'super_admin') { router.replace('/dashboard'); return; }
    load();
  }, [status, session, days]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/calls?days=${days}`);
      setData(await res.json());
    } finally { setLoading(false); }
  }

  if (status === 'loading' || session?.user?.role !== 'super_admin') return null;

  const { stats, daily, calls } = data || {};

  return (
    <div className={styles.dashboardRoot}>
      <header className={styles.topbar}>
        <span className={styles.topbarLogo}>THE HYPE BOX</span>
        <span style={{ fontSize: '0.75rem', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Admin — Call Analytics</span>
      </header>
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>
        <nav className={styles.sidebar}>
          {SIDEBAR.map(([href, label]) => <a key={href} href={href} className={styles.sidebarLink}>{label}</a>)}
        </nav>
        <main className={styles.mainContent} style={{ padding: 32 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: 0 }}>Call Analytics</h1>
            <div style={{ display: 'flex', gap: 8 }}>
              {[7, 30, 90].map(d => (
                <button key={d} onClick={() => setDays(d)} style={{ background: days === d ? '#FFD000' : '#111', color: days === d ? '#000' : '#555', border: `1px solid ${days === d ? '#FFD000' : '#222'}`, borderRadius: 4, padding: '5px 12px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total Calls', value: stats?.total ?? '—', color: '#fff' },
              { label: 'Booked', value: stats?.booked ?? '—', color: '#4CAF50' },
              { label: 'Booking Rate', value: stats?.bookingRate != null ? `${stats.bookingRate}%` : '—', color: '#FFD000' },
              { label: 'Avg Duration', value: fmtDuration(stats?.avgDuration), color: '#888' },
              { label: 'Missed', value: stats?.missed ?? '—', color: '#E24B4A' },
            ].map(s => (
              <div key={s.label} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 6, padding: '14px 16px' }}>
                <div style={{ fontSize: '0.68rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{loading ? '…' : s.value}</div>
              </div>
            ))}
          </div>

          {/* Volume chart */}
          {daily?.length > 0 && (
            <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: '16px 20px', marginBottom: 24 }}>
              <div style={{ fontSize: '0.68rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Call Volume — Last {days} Days</div>
              <BarChart data={daily} valueKey="count" labelKey="date" height={80} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: '0.65rem', color: '#333' }}>{daily[0]?.date}</span>
                <span style={{ fontSize: '0.65rem', color: '#333' }}>{daily[daily.length - 1]?.date}</span>
              </div>
            </div>
          )}

          {/* Call log */}
          <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #222' }}>
                  {['Client', 'Caller', 'Duration', 'Status', 'Summary', 'Date'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.68rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#444' }}>Loading…</td></tr>
                )}
                {!loading && !calls?.length && (
                  <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#444' }}>No calls in this period.</td></tr>
                )}
                {(calls || []).map((c, i) => (
                  <tr key={c.call_id} style={{ borderBottom: i < calls.length - 1 ? '1px solid #1a1a1a' : 'none', cursor: c.call_summary ? 'pointer' : 'default' }}
                    onClick={() => setExpanded(expanded === c.call_id ? null : c.call_id)}>
                    <td style={{ padding: '12px 14px', fontSize: '0.8rem', color: '#fff' }}>{c.clientName}</td>
                    <td style={{ padding: '12px 14px', fontSize: '0.8rem', color: '#888', fontFamily: 'monospace' }}>{c.caller_phone_number || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: '0.8rem', color: '#666' }}>{fmtDuration(c.durationSec)}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.05em', background: c.call_status === 'ended' ? '#0a2a0a' : '#1a1a1a', color: c.call_status === 'ended' ? '#4CAF50' : '#666' }}>
                        {c.call_status || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '0.78rem', color: '#666', maxWidth: 240 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: expanded === c.call_id ? 'normal' : 'nowrap' }}>
                        {c.call_summary || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '0.75rem', color: '#444' }}>
                      {c.start_timestamp ? new Date(c.start_timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}

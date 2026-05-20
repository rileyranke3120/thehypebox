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

function MiniBarChart({ data, valueKey, labelKey, color = '#FFD000', projectedColor }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 48 }}>
      {data.map((d, i) => {
        const isProjected = !!d.projected;
        const bg = isProjected ? (projectedColor || color) : color;
        return (
          <div key={i} title={`${d[labelKey]}: ${d[valueKey]}${isProjected ? ' (projected)' : ''}`}
            style={{
              flex: 1, background: bg, borderRadius: '2px 2px 0 0',
              opacity: isProjected ? 0.35 : 0.8,
              border: isProjected ? `1px dashed ${bg}` : 'none',
              height: `${Math.max((d[valueKey] / max) * 48, d[valueKey] ? 4 : 1)}px`,
            }} />
        );
      })}
    </div>
  );
}

const PLAN_LABELS = {
  launch: 'Launch Box', rocket: 'Rocket Box', velocity: 'Velocity Box',
  starter: 'Launch Box', growth: 'Rocket Box', pro: 'Velocity Box',
};

const STATUS_COLORS = {
  active:    { bg: '#0a2a0a', border: '#1a4a1a', text: '#4CAF50' },
  trialing:  { bg: '#1a1600', border: '#3a3000', text: '#FFD000' },
  past_due:  { bg: '#2a1400', border: '#5a2a00', text: '#FF8C00' },
  canceled:  { bg: '#2a0a0a', border: '#4a1a1a', text: '#E24B4A' },
  inactive:  { bg: '#1a1a1a', border: '#2a2a2a', text: '#666' },
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.inactive;
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px',
      borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.05em',
      whiteSpace: 'nowrap',
    }}>
      {status || 'unknown'}
    </span>
  );
}

function TrialCountdown({ trialEndsAt }) {
  if (!trialEndsAt) return <span style={{ color: '#444' }}>—</span>;
  const days = Math.ceil((new Date(trialEndsAt) - Date.now()) / 86400000);
  if (days < 0) return <span style={{ color: '#E24B4A', fontSize: '0.8rem' }}>Expired</span>;
  const color = days <= 3 ? '#FF8C00' : days <= 7 ? '#FFD000' : '#666';
  return <span style={{ color, fontSize: '0.8rem', fontWeight: days <= 3 ? 700 : 400 }}>{days}d left</span>;
}

export default function ClientsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (session?.user?.role !== 'super_admin') { router.replace('/dashboard'); return; }
    load();
  }, [status, session]);

  async function load() {
    setLoading(true);
    try {
      const [clientsRes, statsRes] = await Promise.all([
        fetch('/api/admin/clients'),
        fetch('/api/admin/stats'),
      ]);
      const clientsData = await clientsRes.json();
      const statsData = await statsRes.json();
      setClients(clientsData.clients || []);
      setChartData(statsData);
    } finally {
      setLoading(false);
    }
  }

  if (status === 'loading' || session?.user?.role !== 'super_admin') return null;

  const filtered = filter === 'all' ? clients : clients.filter(c => c.plan_status === filter);

  const counts = clients.reduce((acc, c) => {
    acc[c.plan_status] = (acc[c.plan_status] || 0) + 1;
    return acc;
  }, {});

  const mrr = clients
    .filter(c => c.plan_status === 'active' || c.plan_status === 'trialing')
    .reduce((sum, c) => {
      const prices = { launch: 97, starter: 97, rocket: 297, growth: 297, velocity: 497, pro: 497 };
      return sum + (prices[c.plan] || 0);
    }, 0);

  return (
    <div className={styles.dashboardRoot}>
      <header className={styles.topbar}>
        <span className={styles.topbarLogo}>THE HYPE BOX</span>
        <span style={{ fontSize: '0.75rem', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Admin — Client Health
        </span>
      </header>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>
        <nav className={styles.sidebar}>
          {SIDEBAR.map(([href, label]) => <a key={href} href={href} className={styles.sidebarLink}>{label}</a>)}
        </nav>

        <main className={styles.mainContent} style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>
                Client Health
              </h1>
              <p style={{ fontSize: '0.85rem', color: '#555', margin: 0 }}>
                {clients.length} total clients
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              style={{ fontSize: '0.8rem', color: '#FFD000', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Active', value: counts.active || 0, color: '#4CAF50' },
              { label: 'Trialing', value: counts.trialing || 0, color: '#FFD000' },
              { label: 'Past Due', value: counts.past_due || 0, color: '#FF8C00' },
              { label: 'MRR', value: `$${mrr.toLocaleString()}`, color: '#fff' },
            ].map(s => (
              <div key={s.label} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 6, padding: '14px 16px' }}>
                <div style={{ fontSize: '0.7rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          {chartData && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                  <span style={{ fontSize: '0.68rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>MRR Trend</span>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.62rem', color: '#444' }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, background: '#FFD000', opacity: 0.35, marginRight: 4, borderRadius: 1 }} />
                      projected
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#FFD000', fontWeight: 700 }}>${chartData.currentMrr?.toLocaleString()}/mo</span>
                  </div>
                </div>
                {(() => {
                  const combined = [
                    ...(chartData.mrrByMonth || []),
                    ...(chartData.mrrProjection || []),
                  ];
                  const lastHistorical = chartData.mrrByMonth?.[chartData.mrrByMonth.length - 1]?.month;
                  const lastProjected = chartData.mrrProjection?.[chartData.mrrProjection.length - 1]?.month;
                  return (
                    <>
                      <MiniBarChart data={combined} valueKey="mrr" labelKey="month" color="#FFD000" />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                        <span style={{ fontSize: '0.62rem', color: '#333' }}>{combined[0]?.month}</span>
                        {lastProjected && lastProjected !== lastHistorical && (
                          <span style={{ fontSize: '0.62rem', color: '#555' }}>{lastProjected}</span>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
              <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                  <span style={{ fontSize: '0.68rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>New Signups</span>
                  <span style={{ fontSize: '0.75rem', color: '#4CAF50', fontWeight: 700 }}>{chartData.recentSignups} this week</span>
                </div>
                <MiniBarChart data={chartData.signupsByMonth} valueKey="count" labelKey="month" color="#4CAF50" />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: '0.62rem', color: '#333' }}>{chartData.signupsByMonth?.[0]?.month}</span>
                  <span style={{ fontSize: '0.62rem', color: '#333', fontWeight: 600, color: '#FFD000' }}>Conv. rate: {chartData.conversionRate}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {['all', 'active', 'trialing', 'past_due', 'canceled'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  background: filter === f ? '#FFD000' : '#111',
                  color: filter === f ? '#000' : '#555',
                  border: `1px solid ${filter === f ? '#FFD000' : '#222'}`,
                  borderRadius: 4, padding: '5px 12px',
                  fontSize: '0.75rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  cursor: 'pointer',
                }}
              >
                {f === 'all' ? `All (${clients.length})` : `${f.replace('_', ' ')} (${counts[f] || 0})`}
              </button>
            ))}
          </div>

          {/* Table */}
          {!loading && filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#444', background: '#111', border: '1px solid #1a1a1a', borderRadius: 8 }}>
              No clients in this category.
            </div>
          ) : (
            <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #222' }}>
                    {['Client', 'Plan', 'Status', 'Trial', 'GHL', 'Joined'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#555' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <tr key={c.id}
                      onClick={() => window.location.href = `/dashboard/admin/clients/${c.id}`}
                      style={{ borderBottom: i < filtered.length - 1 ? '1px solid #1a1a1a' : 'none', cursor: 'pointer' }}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: '0.875rem', color: '#fff', fontWeight: 500 }}>{c.name || '—'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#555', marginTop: 2 }}>{c.email}</div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ background: '#FFD000', color: '#000', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {PLAN_LABELS[c.plan] || c.plan || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <StatusBadge status={c.plan_status} />
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {c.plan_status === 'trialing'
                          ? <TrialCountdown trialEndsAt={c.trial_ends_at} />
                          : <span style={{ color: '#444', fontSize: '0.8rem' }}>—</span>
                        }
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        {c.ghl_location_id ? (
                          <span style={{ color: '#4CAF50', fontSize: '0.75rem', fontFamily: 'monospace' }} title={c.ghl_location_id}>
                            ✓ {c.ghl_location_id.slice(0, 8)}…
                          </span>
                        ) : (
                          <a href="/dashboard/admin/highlevel" style={{ color: '#FF8C00', fontSize: '0.75rem', textDecoration: 'none' }}>
                            Pending →
                          </a>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: '#555' }}>
                        {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
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

const PLAN_LABELS = {
  launch: 'Launch Box', starter: 'Launch Box',
  rocket: 'Rocket Box', growth: 'Rocket Box',
  velocity: 'Velocity Box', pro: 'Velocity Box',
};

const STATUS_COLORS = {
  active:   { bg: '#0a2a0a', border: '#1a4a1a', text: '#4CAF50' },
  trialing: { bg: '#1a1600', border: '#3a3000', text: '#FFD000' },
  past_due: { bg: '#2a1400', border: '#5a2a00', text: '#FF8C00' },
  canceled: { bg: '#2a0a0a', border: '#4a1a1a', text: '#E24B4A' },
  inactive: { bg: '#1a1a1a', border: '#2a2a2a', text: '#666' },
};

function Badge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.inactive;
  return (
    <span style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text, fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {status || 'unknown'}
    </span>
  );
}

function fmtDuration(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function Field({ label, value, mono }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: '0.875rem', color: '#ccc', fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{value}</div>
    </div>
  );
}

export default function ClientDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [editKey, setEditKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [keyMsg, setKeyMsg] = useState('');

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
      const res = await fetch(`/api/admin/clients/${params.id}`);
      if (!res.ok) { router.replace('/dashboard/admin/clients'); return; }
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  if (status === 'loading' || session?.user?.role !== 'super_admin') return null;

  const u = data?.user;

  return (
    <div className={styles.dashboardRoot}>
      <header className={styles.topbar}>
        <span className={styles.topbarLogo}>THE HYPE BOX</span>
        <span style={{ fontSize: '0.75rem', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Admin — Client Detail
        </span>
      </header>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>
        <nav className={styles.sidebar}>
          {SIDEBAR.map(([href, label]) => <a key={href} href={href} className={styles.sidebarLink}>{label}</a>)}
        </nav>

        <main className={styles.mainContent} style={{ padding: 32 }}>
          {loading && <div style={{ color: '#555', padding: 32 }}>Loading…</div>}

          {!loading && u && (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
                <div>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>
                    {u.business_name || u.name || u.email}
                  </h1>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Badge status={u.plan_status} />
                    {u.plan && (
                      <span style={{ background: '#FFD000', color: '#000', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {PLAN_LABELS[u.plan] || u.plan}
                      </span>
                    )}
                    <span style={{ fontSize: '0.8rem', color: '#555' }}>
                      Joined {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <a href="/dashboard/admin/clients" style={{ fontSize: '0.8rem', color: '#FFD000', textDecoration: 'none' }}>← Back</a>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                {/* Identity */}
                <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: '20px 24px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Identity</div>
                  <Field label="Name" value={u.name} />
                  <Field label="Email" value={u.email} mono />
                  <Field label="Business" value={u.business_name} />
                  <Field label="Phone" value={u.business_phone} />
                  <Field label="Address" value={u.address} />
                  <Field label="Google Review URL" value={u.google_review_url} />
                </div>

                {/* Platform */}
                <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: '20px 24px' }}>
                  <div style={{ fontSize: '0.7rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Platform</div>
                  <Field label="GHL Location ID" value={u.ghl_location_id} mono />
                  <Field label="GHL User ID" value={u.ghl_user_id} mono />
                  <Field label="Retell Agent ID" value={u.retell_agent_id} mono />
                  <Field label="Stripe Customer" value={u.stripe_customer_id} mono />
                  <Field label="Stripe Subscription" value={u.stripe_subscription_id} mono />
                  {u.trial_ends_at && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Trial Ends</div>
                      <div style={{ fontSize: '0.875rem', color: '#FFD000' }}>
                        {new Date(u.trial_ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  )}
                  {/* GHL API Key editor */}
                  <div style={{ marginTop: 16, marginBottom: 12 }}>
                    <div style={{ fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                      GHL API Key {u.ghl_api_key ? <span style={{ color: '#4CAF50' }}>✓ set</span> : <span style={{ color: '#FF8C00' }}>⚠ missing</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="password"
                        placeholder={u.ghl_api_key ? '(currently set — paste to update)' : 'Paste GHL location API key…'}
                        value={editKey}
                        onChange={e => setEditKey(e.target.value)}
                        style={{ flex: 1, background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 3, color: '#ccc', fontSize: '0.78rem', padding: '5px 8px', fontFamily: 'monospace', outline: 'none' }}
                      />
                      <button
                        disabled={savingKey || !editKey.trim()}
                        onClick={async () => {
                          setSavingKey(true);
                          setKeyMsg('');
                          try {
                            const r = await fetch(`/api/admin/clients/${params.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ ghl_api_key: editKey.trim() }),
                            });
                            const d = await r.json();
                            if (d.ok) { setKeyMsg('✓ Saved'); setEditKey(''); load(); }
                            else setKeyMsg('✗ ' + (d.error || 'Failed'));
                          } finally { setSavingKey(false); }
                        }}
                        style={{ background: savingKey || !editKey.trim() ? '#1a1a1a' : '#FFD000', color: savingKey || !editKey.trim() ? '#555' : '#000', border: 'none', borderRadius: 3, padding: '5px 12px', fontSize: '0.75rem', fontWeight: 700, cursor: savingKey || !editKey.trim() ? 'default' : 'pointer' }}
                      >
                        {savingKey ? '…' : 'Save'}
                      </button>
                    </div>
                    {keyMsg && <div style={{ fontSize: '0.72rem', marginTop: 4, color: keyMsg.startsWith('✓') ? '#4CAF50' : '#E24B4A' }}>{keyMsg}</div>}
                  </div>

                  <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {!u.ghl_location_id && (
                      <a href="/dashboard/admin/highlevel" style={{ fontSize: '0.75rem', background: '#FF8C00', color: '#000', padding: '6px 12px', borderRadius: 4, textDecoration: 'none', fontWeight: 700 }}>
                        Provision GHL →
                      </a>
                    )}
                    {!u.retell_agent_id && ['rocket', 'velocity', 'growth', 'pro'].includes(u.plan) && (
                      <button
                        disabled={provisioning}
                        onClick={async () => {
                          if (!confirm('Provision Retell AI agent for ' + (u.business_name || u.name || u.email) + '?')) return;
                          setProvisioning(true);
                          try {
                            const r = await fetch('/api/retell/provision', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                client_id: u.id,
                                business_name: u.business_name || u.name || u.email,
                                owner_name: u.name,
                                ghl_api_key: u.ghl_api_key,
                              }),
                            });
                            const d = await r.json();
                            if (d.success) { alert('Retell agent created: ' + d.agent_id); load(); }
                            else alert('Failed: ' + d.error);
                          } finally {
                            setProvisioning(false);
                          }
                        }}
                        style={{ fontSize: '0.75rem', background: provisioning ? '#222' : '#378ADD', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: provisioning ? 'default' : 'pointer', fontWeight: 700 }}
                      >
                        {provisioning ? 'Provisioning…' : 'Provision Retell →'}
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        if (!confirm('Resend welcome email to ' + u.email + '?')) return;
                        const r = await fetch('/api/admin/resend-welcome', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId: u.id }) });
                        const d = await r.json();
                        alert(d.ok ? 'Sent!' : d.error || 'Failed');
                      }}
                      style={{ fontSize: '0.75rem', background: '#111', color: '#FFD000', border: '1px solid #333', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}
                    >
                      Resend Welcome
                    </button>
                  </div>
                </div>
              </div>

              {/* Call history */}
              {data.calls.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: '0.7rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                    Recent Calls ({data.calls.length})
                  </div>
                  <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #222' }}>
                          {['Caller', 'Duration', 'Status', 'Summary', 'Date'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.calls.map((c, i) => {
                          const dur = c.start_timestamp && c.end_timestamp
                            ? Math.round((new Date(c.end_timestamp) - new Date(c.start_timestamp)) / 1000)
                            : null;
                          return (
                            <tr key={c.call_id} style={{ borderBottom: i < data.calls.length - 1 ? '1px solid #1a1a1a' : 'none' }}>
                              <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: '#aaa', fontFamily: 'monospace' }}>{c.caller_phone_number || '—'}</td>
                              <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: '#666' }}>{fmtDuration(dur)}</td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 2, textTransform: 'uppercase', background: c.call_status === 'ended' ? '#0a2a0a' : '#1a1a1a', color: c.call_status === 'ended' ? '#4CAF50' : '#666' }}>
                                  {c.call_status || '—'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', fontSize: '0.75rem', color: '#666', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.call_summary || '—'}
                              </td>
                              <td style={{ padding: '10px 12px', fontSize: '0.72rem', color: '#444' }}>
                                {c.start_timestamp ? new Date(c.start_timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Automation log */}
              {data.automations.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: '0.7rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                    Automation Log ({data.automations.length})
                  </div>
                  <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #222' }}>
                          {['Automation', 'Status', 'Triggered'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.automations.map((a, i) => (
                          <tr key={a.id} style={{ borderBottom: i < data.automations.length - 1 ? '1px solid #1a1a1a' : 'none' }}>
                            <td style={{ padding: '10px 12px', fontSize: '0.8rem', color: '#ccc' }}>{a.automation}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 2, textTransform: 'uppercase', background: a.status === 'sent' ? '#0a2a0a' : '#1a1a1a', color: a.status === 'sent' ? '#4CAF50' : '#666' }}>
                                {a.status || '—'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: '0.75rem', color: '#444' }}>
                              {a.triggered_at ? new Date(a.triggered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Missed calls */}
              {data.missedCalls.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                    Missed Calls ({data.missedCalls.length})
                  </div>
                  <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #222' }}>
                          {['From', 'Text Sent', 'Time'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.missedCalls.map((m, i) => (
                          <tr key={m.id} style={{ borderBottom: i < data.missedCalls.length - 1 ? '1px solid #1a1a1a' : 'none' }}>
                            <td style={{ padding: '10px 12px', fontSize: '0.78rem', color: '#aaa', fontFamily: 'monospace' }}>{m.from_number || '—'}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 2, textTransform: 'uppercase', background: m.text_sent ? '#0a2a0a' : '#1a1a1a', color: m.text_sent ? '#4CAF50' : '#666' }}>
                                {m.text_sent ? 'Sent' : 'No'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', fontSize: '0.75rem', color: '#444' }}>
                              {m.timestamp ? new Date(m.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!data.calls.length && !data.automations.length && !data.missedCalls.length && (
                <div style={{ padding: 32, textAlign: 'center', color: '#444', background: '#111', border: '1px solid #1a1a1a', borderRadius: 8 }}>
                  No activity recorded yet for this client.
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

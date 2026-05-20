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

const FILTERS = ['All', 'Active', 'Trialing'];

export default function WidgetEmbedPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [copied, setCopied] = useState(null);

  useEffect(() => { if (status === 'unauthenticated') router.replace('/login'); }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (session?.user?.role !== 'super_admin') { router.replace('/dashboard'); return; }
    load();
  }, [status, session]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/clients');
      const data = await res.json();
      setClients(data.clients || []);
    } finally {
      setLoading(false);
    }
  }

  function getEmbedScript(locationId) {
    return `<script src="https://thehypeboxllc.com/widget.js" data-client="${locationId}"></script>`;
  }

  async function handleCopy(locationId) {
    try {
      await navigator.clipboard.writeText(getEmbedScript(locationId));
      setCopied(locationId);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // fallback for older browsers
      const el = document.createElement('textarea');
      el.value = getEmbedScript(locationId);
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(locationId);
      setTimeout(() => setCopied(null), 2000);
    }
  }

  if (status === 'loading' || session?.user?.role !== 'super_admin') return null;

  const filtered = clients.filter(c => {
    if (filter === 'All') return true;
    if (filter === 'Active') return c.plan_status === 'active';
    if (filter === 'Trialing') return c.plan_status === 'trialing';
    return true;
  });

  const counts = {
    All: clients.length,
    Active: clients.filter(c => c.plan_status === 'active').length,
    Trialing: clients.filter(c => c.plan_status === 'trialing').length,
  };

  return (
    <div className={styles.dashboardRoot}>
      <header className={styles.topbar}>
        <span className={styles.topbarLogo}>THE HYPE BOX</span>
        <span style={{ fontSize: '0.75rem', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Admin — Widget Embed</span>
      </header>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>
        <nav className={styles.sidebar}>
          {SIDEBAR.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className={styles.sidebarLink}
              style={href === '/dashboard/admin/widget' ? { color: '#FFD000' } : undefined}
            >
              {label}
            </a>
          ))}
        </nav>

        <main className={styles.mainContent} style={{ padding: 32 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>Widget Embed Instructions</h1>
              <p style={{ fontSize: '0.85rem', color: '#555', margin: 0 }}>
                Copy and paste the embed script into each client&apos;s website <code style={{ color: '#FFD000', fontSize: '0.8rem' }}>&lt;body&gt;</code> tag.
              </p>
            </div>
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  background: filter === f ? '#FFD000' : '#111',
                  color: filter === f ? '#000' : '#555',
                  border: `1px solid ${filter === f ? '#FFD000' : '#222'}`,
                  borderRadius: 4,
                  padding: '5px 14px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {f} ({counts[f]})
              </button>
            ))}
          </div>

          {loading && (
            <div style={{ padding: 48, textAlign: 'center', color: '#444' }}>Loading clients…</div>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ padding: 48, textAlign: 'center', color: '#444' }}>No clients found.</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(client => (
              <div
                key={client.id}
                style={{
                  background: '#111',
                  border: '1px solid #1a1a1a',
                  borderRadius: 8,
                  padding: '20px 24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  {/* Client info */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
                        {client.business_name || client.name || client.email}
                      </span>
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 2,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        background: client.plan_status === 'active' ? '#4CAF5020' : '#FFD00020',
                        color: client.plan_status === 'active' ? '#4CAF50' : '#FFD000',
                        border: `1px solid ${client.plan_status === 'active' ? '#4CAF5040' : '#FFD00040'}`,
                      }}>
                        {client.plan_status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#555', marginBottom: 2 }}>{client.email}</div>
                    {client.ghl_location_id ? (
                      <div style={{ fontSize: '0.72rem', color: '#444', fontFamily: 'monospace' }}>
                        GHL: {client.ghl_location_id}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.72rem', color: '#555', fontStyle: 'italic' }}>Pending provisioning</div>
                    )}
                  </div>

                  {/* Embed script + copy button */}
                  {client.ghl_location_id ? (
                    <div style={{ flex: 2, minWidth: 300 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <code style={{
                          flex: 1,
                          display: 'block',
                          background: '#0a0a0a',
                          border: '1px solid #222',
                          borderRadius: 4,
                          padding: '8px 12px',
                          fontSize: '0.72rem',
                          color: '#aaa',
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                          whiteSpace: 'pre-wrap',
                        }}>
                          {getEmbedScript(client.ghl_location_id)}
                        </code>
                        <button
                          onClick={() => handleCopy(client.ghl_location_id)}
                          style={{
                            flexShrink: 0,
                            background: copied === client.ghl_location_id ? '#4CAF50' : '#FFD000',
                            color: '#000',
                            border: 'none',
                            borderRadius: 4,
                            padding: '8px 16px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            transition: 'background 0.2s',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {copied === client.ghl_location_id ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ flex: 2, minWidth: 300, display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: '#333', fontStyle: 'italic' }}>
                        No embed script available — provision a GHL location first.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

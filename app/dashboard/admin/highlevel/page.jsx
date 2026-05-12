'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import styles from '@/styles/dashboard.module.css';

export default function AdminHighLevelPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(null); // email being provisioned
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (session?.user?.role !== 'super_admin') {
      router.replace('/dashboard');
      return;
    }
    fetchPendingUsers();
  }, [status, session]);

  async function fetchPendingUsers() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/highlevel-status');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load users: ' + err.message });
    } finally {
      setLoading(false);
    }
  }

  async function provision(email) {
    setProvisioning(email);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/create-highlevel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET || ''}`,
        },
        body: JSON.stringify({ email, sendAccessEmail: true }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: 'success', text: `✓ Provisioned ${email} → ${data.locationId}` });
        setUsers(prev => prev.filter(u => u.email !== email));
      } else {
        setMessage({ type: 'error', text: data.error || data.message || 'Unknown error' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setProvisioning(null);
    }
  }

  if (status === 'loading') return null;
  if (session?.user?.role !== 'super_admin') return null;

  return (
    <div className={styles.dashboardRoot}>
      {/* Topbar */}
      <header className={styles.topbar}>
        <span className={styles.topbarLogo}>THE HYPE BOX</span>
        <span style={{ fontSize: '0.75rem', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Admin — HighLevel Provisioning
        </span>
      </header>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>
        {/* Sidebar */}
        <nav className={styles.sidebar}>
          <a href="/dashboard" className={styles.sidebarLink}>← Back to Dashboard</a>
        </nav>

        {/* Main */}
        <main className={styles.mainContent} style={{ padding: '32px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>
            HighLevel Provisioning
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#666', margin: '0 0 32px' }}>
            Users with active or trialing subscriptions who don't have a HighLevel sub-account yet.
          </p>

          {message && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 4,
              marginBottom: 24,
              background: message.type === 'success' ? '#0a2a0a' : '#2a0a0a',
              border: `1px solid ${message.type === 'success' ? '#1a4a1a' : '#4a1a1a'}`,
              color: message.type === 'success' ? '#4CAF50' : '#E24B4A',
              fontSize: '0.875rem',
            }}>
              {message.text}
            </div>
          )}

          <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: '#666' }}>
              {loading ? 'Loading…' : `${users.length} pending`}
            </span>
            <button
              onClick={fetchPendingUsers}
              disabled={loading}
              style={{ fontSize: '0.8rem', color: '#FFD000', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Refresh
            </button>
          </div>

          {!loading && users.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#444', background: '#111', border: '1px solid #1a1a1a', borderRadius: 8 }}>
              All active users have been provisioned.
            </div>
          )}

          {users.length > 0 && (
            <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #222' }}>
                    {['Email', 'Name', 'Plan', 'Status', 'Signed Up', 'Action'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#555' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.email} style={{ borderBottom: i < users.length - 1 ? '1px solid #1a1a1a' : 'none' }}>
                      <td style={{ padding: '14px 16px', fontSize: '0.875rem', color: '#fff' }}>{u.email}</td>
                      <td style={{ padding: '14px 16px', fontSize: '0.875rem', color: '#999' }}>{u.name || '—'}</td>
                      <td style={{ padding: '14px 16px', fontSize: '0.875rem' }}>
                        <span style={{ background: '#FFD000', color: '#000', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {u.plan}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: '#666' }}>{u.plan_status}</td>
                      <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: '#555' }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <button
                          onClick={() => provision(u.email)}
                          disabled={provisioning === u.email}
                          style={{
                            background: provisioning === u.email ? '#222' : '#FFD000',
                            color: provisioning === u.email ? '#666' : '#000',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: 4,
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: provisioning === u.email ? 'default' : 'pointer',
                          }}
                        >
                          {provisioning === u.email ? 'Provisioning…' : 'Provision + Email'}
                        </button>
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

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

const VOICES = [
  { id: '11labs-Anna',    label: 'Anna',    provider: 'ElevenLabs', note: 'Current' },
  { id: '11labs-Myra',    label: 'Myra',    provider: 'ElevenLabs', note: '' },
  { id: '11labs-Rachel',  label: 'Rachel',  provider: 'ElevenLabs', note: '' },
  { id: '11labs-Bella',   label: 'Bella',   provider: 'ElevenLabs', note: '' },
  { id: 'openai-Shimmer', label: 'Shimmer', provider: 'OpenAI',     note: '' },
];

export default function RetellAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (session?.user?.role !== 'super_admin') { router.replace('/dashboard'); return; }
    loadAgent();
  }, [status, session]);

  async function loadAgent() {
    setLoading(true);
    try {
      const res = await fetch('/api/retell/agent');
      const data = await res.json();
      if (data.ok === false) throw new Error(data.error);
      setAgent(data);
      setSelectedVoice(data.voice_id || '11labs-Anna');
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function saveVoice() {
    if (selectedVoice === agent?.voice_id) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/retell/agent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_id: selectedVoice }),
      });
      const data = await res.json();
      if (data.ok === false) throw new Error(data.error);
      setAgent(prev => ({ ...prev, voice_id: selectedVoice }));
      const voiceName = VOICES.find(v => v.id === selectedVoice)?.label || selectedVoice;
      setMessage({ type: 'success', text: `✓ Sarah's voice updated to ${voiceName}` });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading' || session?.user?.role !== 'super_admin') return null;

  const currentVoiceName = VOICES.find(v => v.id === agent?.voice_id)?.label || agent?.voice_id || '—';
  const isDirty = selectedVoice && selectedVoice !== agent?.voice_id;

  return (
    <div className={styles.dashboardRoot}>
      <header className={styles.topbar}>
        <span className={styles.topbarLogo}>THE HYPE BOX</span>
        <span style={{ fontSize: '0.75rem', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Admin — Retell / Sarah
        </span>
      </header>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>
        <nav className={styles.sidebar}>
          {SIDEBAR.map(([href, label]) => <a key={href} href={href} className={styles.sidebarLink}>{label}</a>)}
        </nav>

        <main className={styles.mainContent} style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', margin: '0 0 4px' }}>Sarah — AI Receptionist</h1>
              <p style={{ fontSize: '0.85rem', color: '#555', margin: 0 }}>
                Retell agent · {agent?.agent_id || '…'}
              </p>
            </div>
            <button onClick={loadAgent} disabled={loading} style={{ fontSize: '0.8rem', color: '#FFD000', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          {message && (
            <div style={{
              padding: '12px 16px', borderRadius: 4, marginBottom: 24,
              background: message.type === 'success' ? '#0a2a0a' : '#2a0a0a',
              border: `1px solid ${message.type === 'success' ? '#1a4a1a' : '#4a1a1a'}`,
              color: message.type === 'success' ? '#4CAF50' : '#E24B4A',
              fontSize: '0.875rem',
            }}>
              {message.text}
            </div>
          )}

          {/* Agent status */}
          {agent && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
              {[
                { label: 'Status', value: agent.is_published ? 'Published' : 'Draft', color: agent.is_published ? '#4CAF50' : '#FF8C00' },
                { label: 'Current Voice', value: currentVoiceName, color: '#fff' },
                { label: 'Language', value: agent.language || 'en-US', color: '#888' },
              ].map(s => (
                <div key={s.label} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 6, padding: '14px 16px' }}>
                  <div style={{ fontSize: '0.68rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Voice picker */}
          <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: '20px', marginBottom: 20 }}>
            <div style={{ fontSize: '0.7rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Change Voice</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
              {VOICES.map(v => {
                const isActive = agent?.voice_id === v.id;
                const isSelected = selectedVoice === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVoice(v.id)}
                    style={{
                      background: isSelected ? (isActive ? '#0a2a0a' : '#1a1400') : '#0d0d0d',
                      border: `1px solid ${isSelected ? (isActive ? '#4CAF50' : '#FFD000') : '#222'}`,
                      borderRadius: 6,
                      padding: '12px 14px',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', marginBottom: 2 }}>{v.label}</div>
                    <div style={{ fontSize: '0.7rem', color: '#555' }}>{v.provider}</div>
                    {isActive && <div style={{ fontSize: '0.65rem', color: '#4CAF50', marginTop: 4, fontWeight: 600 }}>ACTIVE</div>}
                  </button>
                );
              })}
            </div>
            <button
              onClick={saveVoice}
              disabled={!isDirty || saving}
              style={{
                background: isDirty && !saving ? '#FFD000' : '#222',
                color: isDirty && !saving ? '#000' : '#444',
                border: 'none', borderRadius: 4,
                padding: '10px 24px',
                fontWeight: 900, fontSize: '0.82rem',
                letterSpacing: '0.1em', textTransform: 'uppercase',
                cursor: isDirty && !saving ? 'pointer' : 'default',
              }}
            >
              {saving ? 'Saving…' : 'Save Voice'}
            </button>
          </div>

          {/* Agent prompt — read-only preview */}
          {agent?.general_prompt && (
            <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: '20px' }}>
              <div style={{ fontSize: '0.7rem', color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Agent Prompt (read-only)</div>
              <pre style={{ margin: 0, fontSize: '0.78rem', color: '#888', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 300, overflowY: 'auto' }}>
                {agent.general_prompt}
              </pre>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

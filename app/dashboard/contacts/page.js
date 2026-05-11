'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

const S = {
  bg: '#0A0A0A', surface: '#111111', border: '#2A2A2A',
  text: '#ffffff', muted: '#888888', dim: '#444444', yellow: '#F5C400',
  green: '#1D9E75', red: '#cc4444',
  heading: "'Barlow Condensed', sans-serif", body: "'DM Sans', system-ui, sans-serif",
};

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Avatar({ name = '?', size = 32 }) {
  const initials = name.split(' ').map((n) => n[0] || '').join('').toUpperCase().slice(0, 2) || '?';
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: '#1a1500', border: `1px solid ${S.yellow}`, color: S.yellow, fontSize: size * 0.3 + 'rem', fontWeight: 900, fontFamily: S.heading, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {initials}
    </div>
  );
}

function Skeleton() {
  return (
    <tr>
      {[180, 130, 200, 80, 90].map((w, i) => (
        <td key={i} style={{ padding: '13px 16px' }}>
          <div style={{ height: 13, width: w, borderRadius: 3, background: '#1a1a1a', animation: 'p 1.4s ease-in-out infinite' }} />
        </td>
      ))}
    </tr>
  );
}

function Tag({ label }) {
  return (
    <span style={{ padding: '2px 8px', borderRadius: 3, background: '#1a1500', border: `1px solid #2a2200`, color: S.yellow, fontSize: '0.65rem', fontFamily: S.heading, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

function ContactDrawer({ contact, onClose, businessName }) {
  const [note, setNote] = useState('');
  const [noteMsg, setNoteMsg] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [smsMsg, setSmsMsg] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [smsResult, setSmsResult] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);

  const name = (contact.name || `${contact.firstName ?? ''} ${contact.lastName ?? ''}`).trim() || 'Unknown';

  useEffect(() => {
    setDetailLoading(true);
    fetch(`/api/contacts/${contact.id}`)
      .then(r => r.json())
      .then(d => setDetail(d.contact ?? null))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [contact.id]);

  async function sendNote() {
    if (!note.trim()) return;
    setNoteSaving(true);
    setNoteMsg('');
    const res = await fetch(`/api/contacts/${contact.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'note', text: note }),
    });
    const d = await res.json();
    setNoteMsg(d.ok ? '✓ Note saved' : `✗ ${d.error}`);
    if (d.ok) setNote('');
    setNoteSaving(false);
  }

  async function sendReviewRequest() {
    const phone = contact.phone || detail?.phone;
    if (!phone) { setSmsResult('✗ No phone number on file'); return; }
    setSmsSending(true);
    setSmsResult('');
    const message = smsMsg.trim() || `Hi ${name}! Thanks for working with ${businessName || 'us'}. Could you leave us a quick Google review? It really helps!`;
    const res = await fetch(`/api/contacts/${contact.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sms', phone, message, name }),
    });
    const d = await res.json();
    setSmsResult(d.ok ? '✓ Message sent' : `✗ ${d.error}`);
    setSmsSending(false);
  }

  const tags = detail?.tags ?? contact.tags ?? [];
  const phone = contact.phone || detail?.phone || '—';
  const email = contact.email || detail?.email || '—';
  const source = contact.source || detail?.source || null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 420, background: S.surface, borderLeft: `1px solid ${S.border}`, zIndex: 50, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar name={name} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: S.heading, fontWeight: 800, fontSize: '1.2rem', letterSpacing: '0.05em' }}>{name}</div>
            {source && <Tag label={source} />}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: S.muted, cursor: 'pointer', fontSize: '1.2rem', padding: 4 }}>✕</button>
        </div>

        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${S.border}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <InfoRow label="Phone" value={phone} />
          <InfoRow label="Email" value={email} />
          <InfoRow label="Added" value={fmt(contact.dateAdded || contact.createdAt)} />
          {tags.length > 0 && (
            <div>
              <div style={{ fontSize: '0.65rem', fontFamily: S.heading, letterSpacing: '0.1em', textTransform: 'uppercase', color: S.dim, marginBottom: 6 }}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tags.map((t, i) => <Tag key={i} label={typeof t === 'string' ? t : t.name || t} />)}
              </div>
            </div>
          )}
          {detailLoading && <div style={{ fontSize: '0.72rem', color: S.dim }}>Loading details…</div>}
        </div>

        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${S.border}` }}>
          <SectionTitle>Send Review Request</SectionTitle>
          <textarea
            value={smsMsg}
            onChange={e => setSmsMsg(e.target.value)}
            placeholder="Custom message (optional — leave blank for default)"
            rows={3}
            style={{ width: '100%', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 4, color: S.text, fontSize: '0.82rem', fontFamily: S.body, padding: '10px 12px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
          />
          <ActionBtn onClick={sendReviewRequest} loading={smsSending} color={S.yellow} textColor="#000">
            Send Review Request SMS
          </ActionBtn>
          {smsResult && <ResultMsg text={smsResult} />}
        </div>

        <div style={{ padding: '20px 24px' }}>
          <SectionTitle>Add Note to GHL</SectionTitle>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Type a note…"
            rows={3}
            style={{ width: '100%', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 4, color: S.text, fontSize: '0.82rem', fontFamily: S.body, padding: '10px 12px', resize: 'vertical', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
          />
          <ActionBtn onClick={sendNote} loading={noteSaving} color={S.border} textColor={S.text}>
            Save Note
          </ActionBtn>
          {noteMsg && <ResultMsg text={noteMsg} />}
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ fontSize: '0.65rem', fontFamily: S.heading, letterSpacing: '0.1em', textTransform: 'uppercase', color: S.dim, minWidth: 56, paddingTop: 2 }}>{label}</span>
      <span style={{ fontSize: '0.82rem', color: S.muted, wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }) {
  return <div style={{ fontFamily: S.heading, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: S.dim, marginBottom: 12 }}>{children}</div>;
}

function ActionBtn({ onClick, loading, color, textColor, children }) {
  return (
    <button onClick={onClick} disabled={loading} style={{ display: 'block', width: '100%', padding: '10px 16px', background: color, border: 'none', borderRadius: 4, color: textColor, fontFamily: S.heading, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
      {loading ? 'Sending…' : children}
    </button>
  );
}

function ResultMsg({ text }) {
  const ok = text.startsWith('✓');
  return <div style={{ marginTop: 8, fontSize: '0.78rem', color: ok ? S.green : S.red }}>{text}</div>;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch('/api/contacts')
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setContacts(d.contacts ?? []); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    const name = (c.name || `${c.firstName ?? ''} ${c.lastName ?? ''}`).trim();
    return name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q) || (c.phone ?? '').includes(q);
  });

  return (
    <div style={{ minHeight: '100vh', background: S.bg, fontFamily: S.body, color: S.text }}>
      <div style={{ background: S.surface, borderBottom: `1px solid ${S.border}`, padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 14 }}>
        <Link href="/dashboard" style={{ color: S.muted, fontSize: '0.78rem', textDecoration: 'none' }}>← Dashboard</Link>
        <span style={{ color: S.border }}>|</span>
        <span style={{ fontFamily: S.heading, fontWeight: 700, fontSize: '1rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Contacts</span>
        {!loading && <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: S.dim }}>{filtered.length} of {contacts.length}</span>}
      </div>

      <div style={{ padding: '28px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <input type="search" placeholder="Search name, email, or phone…" value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 20, width: '100%', maxWidth: 340, padding: '9px 14px', background: S.surface, border: `1px solid ${S.border}`, borderRadius: 4, color: S.text, fontSize: '0.82rem', fontFamily: S.body, outline: 'none', display: 'block' }} />

        {error && <div style={{ padding: '12px 16px', background: '#1a0808', border: '1px solid #5a1a1a', borderRadius: 4, color: '#ff8080', fontSize: '0.8rem', marginBottom: 20 }}>⚠ {error}</div>}

        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 6, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${S.border}` }}>
                {['Name', 'Phone', 'Email', 'Source', 'Added', ''].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: S.heading, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: S.dim, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} />)
                : filtered.length === 0
                  ? <tr><td colSpan={6} style={{ padding: '52px 16px', textAlign: 'center', color: S.dim, fontSize: '0.82rem' }}>{search ? 'No contacts match your search.' : 'No contacts found.'}</td></tr>
                  : filtered.map((c) => {
                      const name = (c.name || `${c.firstName ?? ''} ${c.lastName ?? ''}`).trim() || 'Unknown';
                      return (
                        <tr key={c.id}
                          onClick={() => setSelected(c)}
                          style={{ borderBottom: `1px solid ${S.border}`, cursor: 'pointer' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#161616'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '11px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Avatar name={name} />
                              <span style={{ fontWeight: 500 }}>{name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '11px 16px', color: S.muted }}>{c.phone || '—'}</td>
                          <td style={{ padding: '11px 16px', color: S.muted }}>{c.email || '—'}</td>
                          <td style={{ padding: '11px 16px' }}>
                            {c.source ? <Tag label={c.source} /> : <span style={{ color: S.dim }}>—</span>}
                          </td>
                          <td style={{ padding: '11px 16px', color: S.dim, whiteSpace: 'nowrap' }}>{fmt(c.dateAdded || c.createdAt)}</td>
                          <td style={{ padding: '11px 16px' }}>
                            <span style={{ fontSize: '0.72rem', color: S.yellow }}>View →</span>
                          </td>
                        </tr>
                      );
                    })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <ContactDrawer contact={selected} onClose={() => setSelected(null)} businessName="" />
      )}

      <style>{`@keyframes p{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );
}

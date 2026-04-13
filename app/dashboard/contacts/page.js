'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const S = {
  bg: '#0A0A0A', surface: '#111111', border: '#2A2A2A',
  text: '#ffffff', muted: '#888888', dim: '#444444', yellow: '#F5C400',
  heading: "'Barlow Condensed', sans-serif", body: "'DM Sans', system-ui, sans-serif",
};

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Avatar({ name = '?' }) {
  const initials = name.split(' ').map((n) => n[0] || '').join('').toUpperCase().slice(0, 2) || '?';
  return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: '#1a1500', border: `1px solid ${S.yellow}`, color: S.yellow, fontSize: '0.68rem', fontWeight: 900, fontFamily: S.heading, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

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
                {['Name', 'Phone', 'Email', 'Source', 'Added'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: S.heading, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: S.dim, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} />)
                : filtered.length === 0
                  ? <tr><td colSpan={5} style={{ padding: '52px 16px', textAlign: 'center', color: S.dim, fontSize: '0.82rem' }}>{search ? 'No contacts match your search.' : 'No contacts found.'}</td></tr>
                  : filtered.map((c) => {
                      const name = (c.name || `${c.firstName ?? ''} ${c.lastName ?? ''}`).trim() || 'Unknown';
                      return (
                        <tr key={c.id} style={{ borderBottom: `1px solid ${S.border}` }}
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
                            {c.source
                              ? <span style={{ padding: '2px 8px', borderRadius: 3, background: '#1a1500', border: '1px solid #2a2200', color: S.yellow, fontSize: '0.68rem', fontFamily: S.heading, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{c.source}</span>
                              : <span style={{ color: S.dim }}>—</span>}
                          </td>
                          <td style={{ padding: '11px 16px', color: S.dim, whiteSpace: 'nowrap' }}>{fmt(c.dateAdded || c.createdAt)}</td>
                        </tr>
                      );
                    })}
            </tbody>
          </table>
        </div>
      </div>
      <style>{`@keyframes p{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );
}

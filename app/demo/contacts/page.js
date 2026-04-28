'use client';

import { useState } from 'react';
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

// ProCoat Columbus — Columbus, OH — fake contacts
const DEMO_CONTACTS = [
  { id: 'c1',  name: 'James Patterson',   phone: '(614) 555-0291', email: 'james.p@gmail.com',        source: 'Website',   dateAdded: '2026-03-15' },
  { id: 'c2',  name: 'Sandra Hughes',      phone: '(614) 555-0174', email: 'sandra.h@outlook.com',     source: 'Referral',  dateAdded: '2026-03-20' },
  { id: 'c3',  name: 'Tom Lancaster',      phone: '(614) 555-0347', email: 'tlancaster@yahoo.com',     source: 'Google Ads',dateAdded: '2026-03-22' },
  { id: 'c4',  name: 'Diane Foster',       phone: '(614) 555-0428', email: 'diane.foster@gmail.com',   source: 'Phone',     dateAdded: '2026-03-28' },
  { id: 'c5',  name: 'Rob Kim',            phone: '(614) 555-0519', email: 'rob.kim@gmail.com',        source: 'Website',   dateAdded: '2026-04-01' },
  { id: 'c6',  name: 'Chris Vargas',       phone: '(614) 555-0663', email: 'chrisv614@gmail.com',      source: 'Referral',  dateAdded: '2026-04-02' },
  { id: 'c7',  name: 'Mary Watkins',       phone: '(614) 555-0781', email: 'mwatkins@hotmail.com',     source: 'Facebook',  dateAdded: '2026-04-03' },
  { id: 'c8',  name: 'Greg Simmons',       phone: '(614) 555-0832', email: 'gregs@gmail.com',          source: 'Website',   dateAdded: '2026-04-04' },
  { id: 'c9',  name: 'Paula Bowen',        phone: '(614) 555-0918', email: 'paula.bowen@gmail.com',    source: 'Google',    dateAdded: '2026-04-05' },
  { id: 'c10', name: 'Dave Reynolds',      phone: '(614) 555-0143', email: 'dave.r@yahoo.com',         source: 'Referral',  dateAdded: '2026-04-06' },
  { id: 'c11', name: 'Janet Schultz',      phone: '(614) 555-0471', email: 'janetsch@gmail.com',       source: 'Phone',     dateAdded: '2026-02-14' },
  { id: 'c12', name: 'Bret Sommers',       phone: '(614) 555-0537', email: 'bsommers@outlook.com',     source: 'Google Ads',dateAdded: '2026-01-30' },
  { id: 'c13', name: 'Larry Baxter',       phone: '(614) 555-0693', email: 'lbaxter614@gmail.com',     source: 'Website',   dateAdded: '2025-12-10' },
  { id: 'c14', name: 'Tyler Holt',         phone: '(614) 555-0742', email: 'tyler.holt@gmail.com',     source: 'Facebook',  dateAdded: '2026-02-28' },
  { id: 'c15', name: 'Amanda Kowalski',    phone: '(614) 555-0831', email: 'amandak@gmail.com',        source: 'Referral',  dateAdded: '2026-03-05' },
  { id: 'c16', name: 'Greg Norton',        phone: '(614) 555-0917', email: 'gnorton@yahoo.com',        source: 'Website',   dateAdded: '2026-03-09' },
  { id: 'c17', name: 'Marcus Webb',        phone: '(614) 555-0183', email: 'mwebb@gmail.com',          source: 'Google',    dateAdded: '2026-04-07' },
  { id: 'c18', name: 'Dawn Patel',         phone: '(614) 555-0255', email: 'dpatel@outlook.com',       source: 'Referral',  dateAdded: '2026-04-08' },
  { id: 'c19', name: 'Carl Morrison',      phone: '(614) 555-0369', email: 'cmorrison@gmail.com',      source: 'Website',   dateAdded: '2026-04-09' },
  { id: 'c20', name: 'Lisa Chen',          phone: '(614) 555-0614', email: 'lisa.chen@gmail.com',      source: 'Google Ads',dateAdded: '2026-03-17' },
  { id: 'c21', name: 'Nathan Briggs',      phone: '(614) 555-0728', email: 'nbriggs@hotmail.com',      source: 'Phone',     dateAdded: '2026-02-20' },
  { id: 'c22', name: 'Carla Espinoza',     phone: '(614) 555-0849', email: 'carlaes@gmail.com',        source: 'Facebook',  dateAdded: '2026-01-15' },
  { id: 'c23', name: 'Derek Owens',        phone: '(614) 555-0362', email: 'derek.owens@gmail.com',    source: 'Referral',  dateAdded: '2025-11-22' },
  { id: 'c24', name: 'Stacy Mullins',      phone: '(614) 555-0476', email: 'stacym@yahoo.com',         source: 'Website',   dateAdded: '2026-03-01' },
  { id: 'c25', name: 'Frank Deluca',       phone: '(614) 555-0583', email: 'fdeluca@gmail.com',        source: 'Google',    dateAdded: '2026-04-10' },
];

export default function DemoContactsPage() {
  const [search, setSearch] = useState('');

  const filtered = DEMO_CONTACTS.filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q) || (c.phone ?? '').includes(q);
  });

  return (
    <div style={{ minHeight: '100vh', background: S.bg, fontFamily: S.body, color: S.text }}>
      {/* Demo banner */}
      <div style={{ background: '#F5C400', color: '#000', textAlign: 'center', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', padding: '5px 0' }}>
        DEMO MODE — ProCoat Columbus, Columbus OH — No real data
      </div>

      <div style={{ background: S.surface, borderBottom: `1px solid ${S.border}`, padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 14 }}>
        <Link href="/demo" style={{ color: S.muted, fontSize: '0.78rem', textDecoration: 'none' }}>← Dashboard</Link>
        <span style={{ color: S.border }}>|</span>
        <span style={{ fontFamily: S.heading, fontWeight: 700, fontSize: '1rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Contacts</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: S.dim }}>{filtered.length} of {DEMO_CONTACTS.length}</span>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <input
          type="search"
          placeholder="Search name, email, or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 20, width: '100%', maxWidth: 340, padding: '9px 14px', background: S.surface, border: `1px solid ${S.border}`, borderRadius: 4, color: S.text, fontSize: '0.82rem', fontFamily: S.body, outline: 'none', display: 'block' }}
        />

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
              {filtered.length === 0
                ? <tr><td colSpan={5} style={{ padding: '52px 16px', textAlign: 'center', color: S.dim, fontSize: '0.82rem' }}>No contacts match your search.</td></tr>
                : filtered.map((c) => (
                    <tr
                      key={c.id}
                      style={{ borderBottom: `1px solid ${S.border}` }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#161616'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={c.name} />
                          <span style={{ fontWeight: 500 }}>{c.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 16px', color: S.muted }}>{c.phone}</td>
                      <td style={{ padding: '11px 16px', color: S.muted }}>{c.email}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 3, background: '#1a1500', border: '1px solid #2a2200', color: S.yellow, fontSize: '0.68rem', fontFamily: S.heading, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{c.source}</span>
                      </td>
                      <td style={{ padding: '11px 16px', color: S.dim, whiteSpace: 'nowrap' }}>{fmt(c.dateAdded)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

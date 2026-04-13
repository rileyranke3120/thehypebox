'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const S = {
  bg: '#0A0A0A', surface: '#111111', border: '#2A2A2A',
  text: '#ffffff', muted: '#888888', dim: '#444444',
  yellow: '#F5C400', green: '#1D9E75', blue: '#378ADD',
  heading: "'Barlow Condensed', sans-serif", body: "'DM Sans', system-ui, sans-serif",
};

const STATUS = {
  won:  { bg: '#0d1f18', border: '#1a3d2a', color: '#1D9E75' },
  lost: { bg: '#1a0808', border: '#3a1010', color: '#cc4444' },
  open: { bg: '#0d1525', border: '#1a2a40', color: '#378ADD' },
};

function money(v) {
  if (!v && v !== 0) return '—';
  return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 0 });
}

function fmt(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status = 'open' }) {
  const s = status.toLowerCase();
  const c = STATUS[s] || STATUS.open;
  return <span style={{ padding: '2px 9px', borderRadius: 3, background: c.bg, border: `1px solid ${c.border}`, color: c.color, fontSize: '0.68rem', fontFamily: S.heading, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{s}</span>;
}

export default function PipelinePage() {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/pipeline')
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setOpportunities(d.opportunities ?? []); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const stages = {};
  for (const opp of opportunities) {
    const stage = opp.stage?.name || 'Unassigned';
    if (!stages[stage]) stages[stage] = [];
    stages[stage].push(opp);
  }

  const totalValue = opportunities.reduce((s, o) => s + (Number(o.monetaryValue) || 0), 0);
  const wonValue   = opportunities.filter((o) => o.status === 'won').reduce((s, o) => s + (Number(o.monetaryValue) || 0), 0);
  const openCount  = opportunities.filter((o) => o.status !== 'won' && o.status !== 'lost').length;

  return (
    <div style={{ minHeight: '100vh', background: S.bg, fontFamily: S.body, color: S.text }}>
      <div style={{ background: S.surface, borderBottom: `1px solid ${S.border}`, padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 14 }}>
        <Link href="/dashboard" style={{ color: S.muted, fontSize: '0.78rem', textDecoration: 'none' }}>← Dashboard</Link>
        <span style={{ color: S.border }}>|</span>
        <span style={{ fontFamily: S.heading, fontWeight: 700, fontSize: '1rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Pipeline</span>
        {!loading && <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: S.dim }}>{opportunities.length} opportunities</span>}
      </div>

      <div style={{ padding: '28px 24px', maxWidth: 1200, margin: '0 auto' }}>
        {error && <div style={{ padding: '12px 16px', background: '#1a0808', border: '1px solid #5a1a1a', borderRadius: 4, color: '#ff8080', fontSize: '0.8rem', marginBottom: 20 }}>⚠ {error}</div>}

        {!loading && !error && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
            {[
              { label: 'Total Pipeline', value: money(totalValue), color: S.yellow },
              { label: 'Won Revenue',    value: money(wonValue),   color: S.green },
              { label: 'Open Deals',     value: openCount,          color: S.blue },
              { label: 'Total Deals',    value: opportunities.length, color: S.muted },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 6, padding: '16px 22px', minWidth: 150 }}>
                <div style={{ fontSize: '0.65rem', fontFamily: S.heading, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: S.dim, marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: '1.6rem', fontFamily: S.heading, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
            {Array.from({ length: 3 }).map((_, si) => (
              <div key={si}>
                <div style={{ height: 14, width: 120, borderRadius: 3, background: '#1a1a1a', marginBottom: 12, animation: 'p 1.4s ease-in-out infinite' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 5, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[140, 90, 70].map((w, j) => <div key={j} style={{ height: 12, width: w, borderRadius: 3, background: '#1a1a1a', animation: 'p 1.4s ease-in-out infinite' }} />)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : Object.keys(stages).length === 0 ? (
          <div style={{ padding: '60px 16px', textAlign: 'center', color: S.dim, fontSize: '0.82rem' }}>No opportunities found.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 20, alignItems: 'start' }}>
            {Object.entries(stages).map(([stage, opps]) => {
              const stageValue = opps.reduce((s, o) => s + (Number(o.monetaryValue) || 0), 0);
              return (
                <div key={stage}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
                    <span style={{ fontFamily: S.heading, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: S.muted }}>{stage}</span>
                    <span style={{ fontSize: '0.7rem', color: S.dim }}>{opps.length} · {money(stageValue)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {opps.map((opp) => (
                      <div key={opp.id} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 5, padding: '14px 16px' }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3a3a3a'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = S.border}>
                        <div style={{ fontWeight: 600, fontSize: '0.84rem', marginBottom: 5 }}>{opp.name || 'Untitled'}</div>
                        <div style={{ fontSize: '0.76rem', color: S.muted, marginBottom: 10 }}>{opp.contact?.name || opp.contactName || '—'}</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <StatusBadge status={opp.status} />
                          <span style={{ fontFamily: S.heading, fontWeight: 900, fontSize: '0.9rem', color: S.yellow }}>{money(opp.monetaryValue)}</span>
                        </div>
                        {opp.closeDate && <div style={{ marginTop: 8, fontSize: '0.68rem', color: S.dim }}>Close: {fmt(opp.closeDate)}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes p{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );
}

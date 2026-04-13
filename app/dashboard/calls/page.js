'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const D = {
  bg: '#0A0A0A',
  surface: '#111111',
  border: '#2A2A2A',
  text: '#ffffff',
  muted: '#888888',
  dim: '#444444',
  yellow: '#F5C400',
  green: '#1D9E75',
  blue: '#378ADD',
  font: "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)",
  heading: "var(--font-barlow-condensed, 'Barlow Condensed', sans-serif)",
};

function fmt(d) {
  if (!d) return '—';
  return new Date(typeof d === 'number' ? d * 1000 : d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function durFmt(secs) {
  if (!secs && secs !== 0) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function SentimentBadge({ sentiment }) {
  const s = (sentiment || '').toLowerCase();
  const map = {
    positive:  { bg: '#0d1f18', border: '#1a3d2a', color: '#1D9E75' },
    negative:  { bg: '#1a0808', border: '#3a1010', color: '#cc4444' },
    neutral:   { bg: '#0d1525', border: '#1a2a40', color: '#378ADD' },
  };
  const c = map[s] || { bg: '#161616', border: D.border, color: D.muted };
  if (!s) return null;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 3, background: c.bg, border: `1px solid ${c.border}`, color: c.color, fontSize: '0.65rem', fontFamily: D.heading, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
      {s}
    </span>
  );
}

function SourceBadge({ source }) {
  const ai = source === 'retell';
  return (
    <span style={{ padding: '2px 8px', borderRadius: 3, background: ai ? '#0d1a2a' : '#161616', border: `1px solid ${ai ? '#1a3050' : D.border}`, color: ai ? D.blue : D.dim, fontSize: '0.65rem', fontFamily: D.heading, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
      {ai ? 'AI' : 'Missed'}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[80, 120, 80, 70, 60, 200].map((w, i) => (
        <td key={i} style={{ padding: '13px 16px' }}>
          <div style={{ height: 13, width: w, borderRadius: 3, background: '#1a1a1a', animation: 'dashPulse 1.4s ease-in-out infinite' }} />
        </td>
      ))}
    </tr>
  );
}

export default function CallsPage() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    fetch('/api/calls-log')
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setCalls(d.calls ?? []); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function toggle(id) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  const aiCalls     = calls.filter((c) => c.source === 'retell').length;
  const missedCalls = calls.filter((c) => c.source === 'missed').length;

  return (
    <div style={{ minHeight: '100vh', background: D.bg, fontFamily: D.font, color: D.text }}>

      {/* Topbar */}
      <div style={{ background: D.surface, borderBottom: `1px solid ${D.border}`, padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 14 }}>
        <Link href="/dashboard" style={{ color: D.muted, fontSize: '0.78rem', textDecoration: 'none' }}>← Dashboard</Link>
        <span style={{ color: D.border }}>|</span>
        <span style={{ fontFamily: D.heading, fontWeight: 700, fontSize: '1rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Call Log</span>
        {!loading && (
          <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: D.dim }}>{aiCalls} AI · {missedCalls} missed</span>
        )}
      </div>

      <div style={{ padding: '28px 24px', maxWidth: 1100, margin: '0 auto' }}>

        {!loading && !error && calls.length > 0 && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Total Calls',  value: calls.length,   color: D.text },
              { label: 'AI Handled',   value: aiCalls,        color: D.blue },
              { label: 'Missed',       value: missedCalls,    color: '#cc4444' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 6, padding: '14px 20px', minWidth: 130 }}>
                <div style={{ fontSize: '0.65rem', fontFamily: D.heading, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: D.dim, marginBottom: 5 }}>{label}</div>
                <div style={{ fontSize: '1.5rem', fontFamily: D.heading, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 16px', background: '#1a0808', border: '1px solid #5a1a1a', borderRadius: 4, color: '#ff8080', fontSize: '0.8rem', marginBottom: 20 }}>
            ⚠ {error}
          </div>
        )}

        <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 6, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${D.border}` }}>
                {['Type', 'From', 'Duration', 'Sentiment', 'Date', 'Summary'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: D.heading, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: D.dim, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
                : calls.length === 0
                  ? <tr><td colSpan={6} style={{ padding: '52px 16px', textAlign: 'center', color: D.dim, fontSize: '0.82rem' }}>No calls found.</td></tr>
                  : calls.map((call) => {
                    const id = call.id;
                    const isOpen = expanded === id;
                    const summary = call.summary || null;
                    return (
                      <>
                        <tr key={id} style={{ borderBottom: isOpen ? 'none' : `1px solid ${D.border}`, transition: 'background 0.1s', cursor: summary ? 'pointer' : 'default' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#161616'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          onClick={() => summary && toggle(id)}>
                          <td style={{ padding: '11px 16px' }}><SourceBadge source={call.source} /></td>
                          <td style={{ padding: '11px 16px', color: D.muted }}>{call.from || '—'}</td>
                          <td style={{ padding: '11px 16px', color: D.muted, whiteSpace: 'nowrap' }}>{durFmt(call.durationSeconds)}</td>
                          <td style={{ padding: '11px 16px' }}><SentimentBadge sentiment={call.sentiment} /></td>
                          <td style={{ padding: '11px 16px', color: D.dim, whiteSpace: 'nowrap' }}>{fmt(call.startedAt)}</td>
                          <td style={{ padding: '11px 16px', color: D.dim }}>
                            {summary
                              ? <span style={{ color: D.yellow, fontSize: '0.75rem' }}>{isOpen ? '▲ Hide' : '▼ View'}</span>
                              : <span style={{ color: D.dim }}>—</span>}
                          </td>
                        </tr>
                        {isOpen && summary && (
                          <tr key={`${id}-expanded`} style={{ borderBottom: `1px solid ${D.border}` }}>
                            <td colSpan={6} style={{ padding: '0 16px 16px 16px' }}>
                              <div style={{ background: '#0d0d0d', border: `1px solid ${D.border}`, borderRadius: 4, padding: '14px 16px', fontSize: '0.8rem', color: D.muted, lineHeight: 1.7 }}>
                                {summary}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`@keyframes dashPulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );
}

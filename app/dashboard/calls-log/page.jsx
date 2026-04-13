'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const S = {
  bg: '#0A0A0A', surface: '#111111', border: '#2A2A2A',
  text: '#ffffff', muted: '#888888', dim: '#444444',
  yellow: '#F5C400', green: '#1D9E75', blue: '#378ADD',
  heading: "'Barlow Condensed', sans-serif", body: "'DM Sans', system-ui, sans-serif",
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function durFmt(secs) {
  if (!secs && secs !== 0) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function SourceBadge({ source }) {
  const ai = source === 'retell';
  return (
    <span style={{ padding: '2px 8px', borderRadius: 3, background: ai ? '#0d1a2a' : '#161616', border: `1px solid ${ai ? '#1a3050' : S.border}`, color: ai ? S.blue : S.dim, fontSize: '0.65rem', fontFamily: S.heading, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
      {ai ? 'AI' : 'Missed'}
    </span>
  );
}

function StatusBadge({ status = '' }) {
  const s = status.toLowerCase();
  const map = {
    ended:     { bg: '#0d1f18', border: '#1a3d2a', color: '#1D9E75' },
    completed: { bg: '#0d1f18', border: '#1a3d2a', color: '#1D9E75' },
    missed:    { bg: '#1a0808', border: '#3a1010', color: '#cc4444' },
  };
  const c = map[s] || { bg: '#161616', border: S.border, color: S.muted };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 3, background: c.bg, border: `1px solid ${c.border}`, color: c.color, fontSize: '0.65rem', fontFamily: S.heading, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {s || '—'}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[80, 120, 80, 70, 120, 200].map((w, i) => (
        <td key={i} style={{ padding: '13px 16px' }}>
          <div style={{ height: 13, width: w, borderRadius: 3, background: '#1a1a1a', animation: 'p 1.4s ease-in-out infinite' }} />
        </td>
      ))}
    </tr>
  );
}

export default function CallsLogPage() {
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

  const aiCount     = calls.filter((c) => c.source === 'retell').length;
  const missedCount = calls.filter((c) => c.source === 'missed').length;

  return (
    <div style={{ minHeight: '100vh', background: S.bg, fontFamily: S.body, color: S.text }}>
      <div style={{ background: S.surface, borderBottom: `1px solid ${S.border}`, padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', gap: 14 }}>
        <Link href="/dashboard" style={{ color: S.muted, fontSize: '0.78rem', textDecoration: 'none' }}>← Dashboard</Link>
        <span style={{ color: S.border }}>|</span>
        <span style={{ fontFamily: S.heading, fontWeight: 700, fontSize: '1rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Call Log</span>
        {!loading && <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: S.dim }}>{aiCount} AI · {missedCount} missed</span>}
      </div>

      <div style={{ padding: '28px 24px', maxWidth: 1100, margin: '0 auto' }}>
        {!loading && !error && calls.length > 0 && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Total Calls', value: calls.length,   color: S.text },
              { label: 'AI Handled',  value: aiCount,        color: S.blue },
              { label: 'Missed',      value: missedCount,    color: '#cc4444' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 6, padding: '14px 20px', minWidth: 130 }}>
                <div style={{ fontSize: '0.65rem', fontFamily: S.heading, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: S.dim, marginBottom: 5 }}>{label}</div>
                <div style={{ fontSize: '1.5rem', fontFamily: S.heading, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 16px', background: '#1a0808', border: '1px solid #5a1a1a', borderRadius: 4, color: '#ff8080', fontSize: '0.8rem', marginBottom: 20 }}>
            ⚠ {error}
          </div>
        )}

        <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 6, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${S.border}` }}>
                {['Type', 'From', 'Status', 'Duration', 'Date', 'Summary'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontFamily: S.heading, fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: S.dim, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                : calls.length === 0
                  ? <tr><td colSpan={6} style={{ padding: '52px 16px', textAlign: 'center', color: S.dim, fontSize: '0.82rem' }}>No calls found.</td></tr>
                  : calls.map((call) => {
                      const isOpen = expanded === call.id;
                      return (
                        <tr key={call.id} style={{ borderBottom: `1px solid ${S.border}`, cursor: call.summary ? 'pointer' : 'default' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#161616'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          onClick={() => call.summary && setExpanded(isOpen ? null : call.id)}>
                          <td style={{ padding: '11px 16px' }}><SourceBadge source={call.source} /></td>
                          <td style={{ padding: '11px 16px', color: S.muted }}>{call.from}</td>
                          <td style={{ padding: '11px 16px' }}><StatusBadge status={call.status} /></td>
                          <td style={{ padding: '11px 16px', color: S.muted, whiteSpace: 'nowrap' }}>{durFmt(call.durationSeconds)}</td>
                          <td style={{ padding: '11px 16px', color: S.dim, whiteSpace: 'nowrap' }}>{fmtDate(call.startedAt)}</td>
                          <td style={{ padding: '11px 16px', color: S.dim, fontSize: '0.78rem', maxWidth: 260 }}>
                            {call.summary
                              ? <span style={{ color: isOpen ? S.yellow : S.muted }}>{isOpen ? '▲ hide' : '▼ view'}</span>
                              : <span>—</span>}
                          </td>
                        </tr>
                      );
                    })}
            </tbody>
          </table>
          {expanded && calls.find(c => c.id === expanded)?.summary && (
            <div style={{ padding: '14px 16px', background: '#0d0d0d', borderTop: `1px solid ${S.border}`, fontSize: '0.8rem', color: S.muted, lineHeight: 1.7 }}>
              {calls.find(c => c.id === expanded).summary}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes p{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const S = {
  bg: '#0A0A0A', surface: '#111111', border: '#2A2A2A',
  text: '#ffffff', muted: '#888888', dim: '#444444',
  yellow: '#F5C400', green: '#1D9E75', blue: '#378ADD', red: '#cc4444',
  heading: "'Barlow Condensed', sans-serif", body: "'DM Sans', system-ui, sans-serif",
};

const STATUS_STYLE = {
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
  const c = STATUS_STYLE[s] || STATUS_STYLE.open;
  return <span style={{ padding: '2px 9px', borderRadius: 3, background: c.bg, border: `1px solid ${c.border}`, color: c.color, fontSize: '0.65rem', fontFamily: S.heading, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{s}</span>;
}

function OpportunityCard({ opp, stages, onUpdate }) {
  const [updating, setUpdating] = useState(null);
  const [localStatus, setLocalStatus] = useState(opp.status || 'open');
  const [localStage, setLocalStage] = useState(opp.stage?.name || 'Unassigned');

  async function patch(updates) {
    setUpdating(Object.keys(updates)[0]);
    try {
      const res = await fetch(`/api/pipeline/${opp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const d = await res.json();
      if (d.ok) {
        if (updates.status) setLocalStatus(updates.status);
        if (updates.stageId) setLocalStage(stages.find(s => s.id === updates.stageId)?.name || localStage);
        onUpdate?.(opp.id, updates);
      }
    } finally {
      setUpdating(null);
    }
  }

  const stageList = stages.filter(s => s.id !== opp.stage?.id);

  return (
    <div style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 6, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3a3a3a'}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = S.border}>
      <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{opp.name || 'Untitled'}</div>
      <div style={{ fontSize: '0.76rem', color: S.muted }}>{opp.contact?.name || opp.contactName || '—'}</div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <StatusBadge status={localStatus} />
        <span style={{ fontFamily: S.heading, fontWeight: 900, fontSize: '0.92rem', color: S.yellow }}>{money(opp.monetaryValue)}</span>
      </div>

      {opp.closeDate && <div style={{ fontSize: '0.68rem', color: S.dim }}>Close: {fmt(opp.closeDate)}</div>}

      {/* Stage move */}
      {stageList.length > 0 && (
        <div>
          <div style={{ fontSize: '0.62rem', fontFamily: S.heading, letterSpacing: '0.1em', textTransform: 'uppercase', color: S.dim, marginBottom: 5 }}>Move Stage</div>
          <select
            defaultValue=""
            onChange={(e) => { if (e.target.value) patch({ stageId: e.target.value }); }}
            disabled={!!updating}
            style={{ width: '100%', padding: '6px 10px', background: S.bg, border: `1px solid ${S.border}`, borderRadius: 4, color: S.text, fontSize: '0.76rem', fontFamily: S.body, cursor: 'pointer', outline: 'none' }}>
            <option value="" disabled>{updating === 'stageId' ? 'Moving…' : `Currently: ${localStage}`}</option>
            {stageList.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Won / Lost buttons */}
      {localStatus === 'open' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => patch({ status: 'won' })} disabled={!!updating}
            style={{ flex: 1, padding: '6px', background: '#0d1f18', border: `1px solid ${S.green}`, borderRadius: 4, color: S.green, fontFamily: S.heading, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: updating ? 'not-allowed' : 'pointer', opacity: updating ? 0.6 : 1 }}>
            {updating === 'status' ? '…' : '✓ Won'}
          </button>
          <button onClick={() => patch({ status: 'lost' })} disabled={!!updating}
            style={{ flex: 1, padding: '6px', background: '#1a0808', border: `1px solid ${S.red}`, borderRadius: 4, color: S.red, fontFamily: S.heading, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: updating ? 'not-allowed' : 'pointer', opacity: updating ? 0.6 : 1 }}>
            {updating === 'status' ? '…' : '✗ Lost'}
          </button>
        </div>
      )}
      {localStatus !== 'open' && (
        <button onClick={() => patch({ status: 'open' })} disabled={!!updating}
          style={{ width: '100%', padding: '6px', background: '#0d1525', border: `1px solid ${S.blue}`, borderRadius: 4, color: S.blue, fontFamily: S.heading, fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: updating ? 'not-allowed' : 'pointer', opacity: updating ? 0.6 : 1 }}>
          {updating === 'status' ? '…' : '↺ Reopen'}
        </button>
      )}
    </div>
  );
}

export default function PipelinePage() {
  const [opportunities, setOpportunities] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/pipeline').then(r => r.json()),
      fetch('/api/pipeline/stages').then(r => r.json()).catch(() => ({ pipelines: [] })),
    ]).then(([oppData, stageData]) => {
      if (oppData.error) throw new Error(oppData.error);
      setOpportunities(oppData.opportunities ?? []);
      const allStages = (stageData.pipelines ?? []).flatMap(p => p.stages ?? []);
      setStages(allStages);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  function handleUpdate(id, updates) {
    setOpportunities(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  }

  const grouped = {};
  for (const opp of opportunities) {
    const stage = opp.stage?.name || 'Unassigned';
    if (!grouped[stage]) grouped[stage] = [];
    grouped[stage].push(opp);
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

      <div style={{ padding: '28px 24px', maxWidth: 1300, margin: '0 auto' }}>
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
                <div style={{ fontSize: '0.62rem', fontFamily: S.heading, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: S.dim, marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: '1.6rem', fontFamily: S.heading, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 20 }}>
            {Array.from({ length: 3 }).map((_, si) => (
              <div key={si}>
                <div style={{ height: 14, width: 120, borderRadius: 3, background: '#1a1a1a', marginBottom: 12, animation: 'p 1.4s ease-in-out infinite' }} />
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 5, padding: '14px 16px', marginBottom: 10 }}>
                    {[140, 90, 70].map((w, j) => <div key={j} style={{ height: 12, width: w, borderRadius: 3, background: '#1a1a1a', marginBottom: 8, animation: 'p 1.4s ease-in-out infinite' }} />)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div style={{ padding: '60px 16px', textAlign: 'center', color: S.dim, fontSize: '0.82rem' }}>No opportunities found.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20, alignItems: 'start' }}>
            {Object.entries(grouped).map(([stage, opps]) => {
              const stageValue = opps.reduce((s, o) => s + (Number(o.monetaryValue) || 0), 0);
              return (
                <div key={stage}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
                    <span style={{ fontFamily: S.heading, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: S.muted }}>{stage}</span>
                    <span style={{ fontSize: '0.7rem', color: S.dim }}>{opps.length} · {money(stageValue)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {opps.map((opp) => (
                      <OpportunityCard key={opp.id} opp={opp} stages={stages} onUpdate={handleUpdate} />
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

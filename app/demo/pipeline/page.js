'use client';

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

// ProCoat Columbus — Columbus, OH — fake pipeline opportunities
const DEMO_OPPORTUNITIES = [
  { id: 'o1',  name: 'Garage Floor Epoxy — 2-Car',     contact: { name: 'James Patterson' }, status: 'open', monetaryValue: 2400, stage: { name: 'Quoted' },      closeDate: '2026-04-20' },
  { id: 'o2',  name: 'Commercial Floor Coating',        contact: { name: 'Greg Simmons' },    status: 'open', monetaryValue: 8800, stage: { name: 'Quoted' },      closeDate: '2026-04-25' },
  { id: 'o3',  name: 'Garage Epoxy — 3-Car Metallic',  contact: { name: 'Tom Lancaster' },   status: 'open', monetaryValue: 3600, stage: { name: 'Scheduled' },   closeDate: '2026-04-15' },
  { id: 'o4',  name: 'Patio Concrete Coating',         contact: { name: 'Diane Foster' },    status: 'open', monetaryValue: 1400, stage: { name: 'Scheduled' },   closeDate: '2026-04-14' },
  { id: 'o5',  name: 'Driveway Polyaspartic Coating',  contact: { name: 'Nathan Briggs' },   status: 'open', monetaryValue: 1900, stage: { name: 'New Lead' },    closeDate: '2026-05-01' },
  { id: 'o6',  name: 'Pool Deck Resurfacing',          contact: { name: 'Chris Vargas' },    status: 'open', monetaryValue: 2800, stage: { name: 'Scheduled' },   closeDate: '2026-04-18' },
  { id: 'o7',  name: 'Basement Floor Polyaspartic',    contact: { name: 'Rob Kim' },         status: 'open', monetaryValue: 1600, stage: { name: 'Quoted' },      closeDate: '2026-04-16' },
  { id: 'o8',  name: 'Garage Floor — Full Flake',      contact: { name: 'Stacy Mullins' },   status: 'open', monetaryValue: 2100, stage: { name: 'New Lead' },    closeDate: '2026-05-05' },
  { id: 'o9',  name: 'Warehouse Epoxy Floor',          contact: { name: 'Carla Espinoza' },  status: 'open', monetaryValue: 6400, stage: { name: 'New Lead' },    closeDate: '2026-05-10' },
  { id: 'o10', name: 'Driveway Sealer + Crack Fill',   contact: { name: 'Mary Watkins' },    status: 'open', monetaryValue: 850,  stage: { name: 'Scheduled' },   closeDate: '2026-04-18' },
  { id: 'o11', name: 'Restaurant Kitchen Floor',       contact: { name: 'Derek Owens' },     status: 'open', monetaryValue: 5200, stage: { name: 'Quoted' },      closeDate: '2026-04-30' },
  { id: 'o12', name: 'Garage Floor Epoxy — 1-Car',     contact: { name: 'Frank Deluca' },    status: 'open', monetaryValue: 1300, stage: { name: 'New Lead' },    closeDate: '2026-05-08' },
  { id: 'o13', name: 'Patio Epoxy Coat',               contact: { name: 'Sandra Hughes' },   status: 'won',  monetaryValue: 1100, stage: { name: 'Completed' },   closeDate: '2026-04-14' },
  { id: 'o14', name: 'Garage Floor — Metallic Epoxy',  contact: { name: 'Dave Reynolds' },   status: 'won',  monetaryValue: 2900, stage: { name: 'Completed' },   closeDate: '2026-04-10' },
  { id: 'o15', name: 'Basement Floor Coating',         contact: { name: 'Paula Bowen' },     status: 'won',  monetaryValue: 1450, stage: { name: 'Completed' },   closeDate: '2026-04-08' },
  { id: 'o16', name: 'Driveway Polyaspartic',          contact: { name: 'Lisa Chen' },       status: 'won',  monetaryValue: 1750, stage: { name: 'Completed' },   closeDate: '2026-04-05' },
  { id: 'o17', name: 'Garage Floor Quote',             contact: { name: 'Larry Baxter' },    status: 'lost', monetaryValue: 2200, stage: { name: 'Lost' },        closeDate: '2026-03-20' },
  { id: 'o18', name: 'Commercial Epoxy Floor',         contact: { name: 'Bret Sommers' },    status: 'lost', monetaryValue: 7500, stage: { name: 'Lost' },        closeDate: '2026-03-15' },
];

export default function DemoPipelinePage() {
  const stages = {};
  for (const opp of DEMO_OPPORTUNITIES) {
    const stage = opp.stage?.name || 'Unassigned';
    if (!stages[stage]) stages[stage] = [];
    stages[stage].push(opp);
  }

  const totalValue = DEMO_OPPORTUNITIES.reduce((s, o) => s + (Number(o.monetaryValue) || 0), 0);
  const wonValue   = DEMO_OPPORTUNITIES.filter((o) => o.status === 'won').reduce((s, o) => s + (Number(o.monetaryValue) || 0), 0);
  const openCount  = DEMO_OPPORTUNITIES.filter((o) => o.status !== 'won' && o.status !== 'lost').length;

  // Stage display order
  const stageOrder = ['New Lead', 'Quoted', 'Scheduled', 'Completed', 'Lost'];
  const sortedStages = Object.entries(stages).sort(([a], [b]) => {
    const ai = stageOrder.indexOf(a);
    const bi = stageOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
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
        <span style={{ fontFamily: S.heading, fontWeight: 700, fontSize: '1rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Pipeline</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: S.dim }}>{DEMO_OPPORTUNITIES.length} opportunities</span>
      </div>

      <div style={{ padding: '28px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Pipeline', value: money(totalValue), color: S.yellow },
            { label: 'Won Revenue',    value: money(wonValue),   color: S.green },
            { label: 'Open Deals',     value: openCount,          color: S.blue },
            { label: 'Total Deals',    value: DEMO_OPPORTUNITIES.length, color: S.muted },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 6, padding: '16px 22px', minWidth: 150 }}>
              <div style={{ fontSize: '0.65rem', fontFamily: S.heading, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: S.dim, marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: '1.6rem', fontFamily: S.heading, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 20, alignItems: 'start' }}>
          {sortedStages.map(([stage, opps]) => {
            const stageValue = opps.reduce((s, o) => s + (Number(o.monetaryValue) || 0), 0);
            return (
              <div key={stage}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
                  <span style={{ fontFamily: S.heading, fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: S.muted }}>{stage}</span>
                  <span style={{ fontSize: '0.7rem', color: S.dim }}>{opps.length} · {money(stageValue)}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {opps.map((opp) => (
                    <div
                      key={opp.id}
                      style={{ background: S.surface, border: `1px solid ${S.border}`, borderRadius: 5, padding: '14px 16px' }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3a3a3a'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = S.border}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.84rem', marginBottom: 5 }}>{opp.name}</div>
                      <div style={{ fontSize: '0.76rem', color: S.muted, marginBottom: 10 }}>{opp.contact?.name || '—'}</div>
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
      </div>
    </div>
  );
}

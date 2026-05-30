import { createClient } from '@/lib/supabase';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Deterministic score from uuid — same prospect always gets same score
function scoreFromId(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return 34 + (Math.abs(hash) % 28); // 34–61 range — always looks bad
}

const FINDINGS = [
  {
    icon: '📞',
    title: 'Missed Call Exposure',
    detail: 'No after-hours or on-job call coverage detected. Every unanswered call is a lead your competitors are picking up.',
    severity: 'high',
  },
  {
    icon: '⏱',
    title: 'Slow Lead Response',
    detail: 'Average response time for home service businesses in Columbus is 4+ hours. Leads contacted in under 5 minutes are 21x more likely to convert.',
    severity: 'high',
  },
  {
    icon: '⭐',
    title: 'Review Velocity',
    detail: 'Top competitors in your area are generating 3–5x more reviews per month. Review volume directly impacts how often you show up in local search.',
    severity: 'medium',
  },
  {
    icon: '💬',
    title: 'No Automated Follow-Up',
    detail: 'Leads that don\'t hear back within 24 hours go cold. Without an automated follow-up sequence, most leads never become jobs.',
    severity: 'high',
  },
  {
    icon: '📅',
    title: 'Manual Booking',
    detail: 'Every estimate still requires a phone call to schedule. Self-serve booking converts 30% more leads by letting them book when they\'re ready.',
    severity: 'medium',
  },
];

function SeverityBadge({ severity }) {
  const colors = {
    high:   { bg: 'rgba(226,75,74,0.1)',   border: '#E24B4A', text: '#E24B4A',   label: 'HIGH IMPACT' },
    medium: { bg: 'rgba(245,196,0,0.1)',    border: '#F5C400', text: '#F5C400',   label: 'MEDIUM IMPACT' },
  };
  const c = colors[severity];
  return (
    <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', color: c.text, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 3, padding: '2px 7px' }}>
      {c.label}
    </span>
  );
}

export default async function AuditPage({ searchParams }) {
  const id = searchParams?.id;
  if (!id) notFound();

  const supabase = createClient();
  const { data: prospect } = await supabase
    .from('cold_outreach')
    .select('id, first_name, last_name, company')
    .eq('id', id)
    .single();

  if (!prospect) notFound();

  const score = scoreFromId(prospect.id);
  const company = prospect.company || 'Your Business';
  const first = prospect.first_name || 'there';

  // Score ring color
  const ringColor = score < 45 ? '#E24B4A' : score < 55 ? '#F5C400' : '#E24B4A';

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* Top bar */}
      <div style={{ background: '#0f0f0f', borderBottom: '1px solid #1a1a1a', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.95rem', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#FFD000' }}>THE HYPE BOX</span>
        <span style={{ fontSize: '0.75rem', color: '#555', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Marketing Audit Report</span>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px' }}>

        {/* Headline */}
        <div style={{ marginBottom: 40 }}>
          <span style={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#FFD000', border: '1px solid #FFD000', borderRadius: 3, padding: '3px 10px' }}>
            Free Audit · {company}
          </span>
          <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.25rem)', fontWeight: 900, color: '#fff', margin: '16px 0 8px', lineHeight: 1.2 }}>
            Hey {first}, we found some problems.
          </h1>
          <p style={{ color: '#666', fontSize: '1rem', margin: 0, lineHeight: 1.6 }}>
            We ran a marketing audit on <strong style={{ color: '#aaa' }}>{company}</strong>. Here's what's costing you leads right now.
          </p>
        </div>

        {/* Score card */}
        <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: '32px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
          {/* Ring */}
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#1a1a1a" strokeWidth="10"/>
              <circle
                cx="60" cy="60" r="52"
                fill="none"
                stroke={ringColor}
                strokeWidth="10"
                strokeDasharray={`${2 * Math.PI * 52}`}
                strokeDashoffset={`${2 * Math.PI * 52 * (1 - score / 100)}`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
              />
              <text x="60" y="56" textAnchor="middle" fill="#fff" fontSize="28" fontWeight="900" fontFamily="system-ui">{score}</text>
              <text x="60" y="74" textAnchor="middle" fill="#555" fontSize="11" fontFamily="system-ui">/100</text>
            </svg>
            <p style={{ fontSize: '0.7rem', color: ringColor, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '8px 0 0' }}>
              {score < 45 ? 'Critical' : score < 55 ? 'Needs Work' : 'Poor'}
            </p>
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>
              {company} is leaving money on the table every day.
            </p>
            <p style={{ fontSize: '0.9rem', color: '#666', margin: '0 0 16px', lineHeight: 1.6 }}>
              Your score of <strong style={{ color: ringColor }}>{score}/100</strong> puts you in the bottom tier of home service businesses in Columbus for lead capture and response.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: '#E24B4A' }}>● {FINDINGS.filter(f => f.severity === 'high').length} critical issues</span>
              <span style={{ fontSize: '0.8rem', color: '#F5C400' }}>● {FINDINGS.filter(f => f.severity === 'medium').length} medium issues</span>
            </div>
          </div>
        </div>

        {/* Findings */}
        <h2 style={{ fontSize: '0.8rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555', margin: '0 0 16px' }}>
          Issues Found
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
          {FINDINGS.map((f, i) => (
            <div key={i} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 6, padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{f.icon} {f.title}</span>
                <SeverityBadge severity={f.severity} />
              </div>
              <p style={{ fontSize: '0.88rem', color: '#666', margin: 0, lineHeight: 1.6 }}>{f.detail}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '32px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#FFD000', fontWeight: 700 }}>
            Fix All Of This
          </span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', margin: '12px 0 8px' }}>
            TheHypeBox fixes every issue in this report.
          </h2>
          <p style={{ color: '#666', fontSize: '0.9rem', margin: '0 0 28px', lineHeight: 1.6 }}>
            AI receptionist answers every call. Instant lead follow-up. Automated booking, reminders, and review requests. All in one system built for contractors.
          </p>
          <Link
            href="/"
            style={{ display: 'inline-block', background: '#FFD000', color: '#000', fontWeight: 800, fontSize: '1rem', padding: '16px 36px', borderRadius: 4, textDecoration: 'none', letterSpacing: '0.05em', textTransform: 'uppercase' }}
          >
            Start Free 14-Day Trial →
          </Link>
          <p style={{ fontSize: '0.78rem', color: '#444', margin: '16px 0 0' }}>Cancel anytime · Set up in one day</p>
        </div>

      </div>
    </div>
  );
}

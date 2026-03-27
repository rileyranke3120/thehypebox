'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const INDUSTRIES = [
  'Auto Shop', 'Plumbing', 'HVAC', 'Electrical', 'Landscaping',
  'Cleaning', 'Dental', 'Salon/Spa', 'Restaurant', 'Retail', 'Other',
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DEFAULT_HOURS = {
  Mon: { open: '08:00', close: '17:00', closed: false },
  Tue: { open: '08:00', close: '17:00', closed: false },
  Wed: { open: '08:00', close: '17:00', closed: false },
  Thu: { open: '08:00', close: '17:00', closed: false },
  Fri: { open: '08:00', close: '17:00', closed: false },
  Sat: { open: '09:00', close: '14:00', closed: false },
  Sun: { open: '09:00', close: '14:00', closed: true },
};

const s = {
  page: {
    minHeight: '100vh',
    background: '#0a0a0f',
    color: '#e2e8f0',
    fontFamily: "'Inter', system-ui, sans-serif",
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 16px 80px',
  },
  logo: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.5px',
    marginBottom: '36px',
  },
  logoAccent: { color: '#6366f1' },
  card: {
    width: '100%',
    maxWidth: '600px',
    background: '#13131a',
    border: '1px solid #1e1e2e',
    borderRadius: '16px',
    padding: '40px',
  },
  progressBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '36px',
  },
  progressStep: (active, done) => ({
    flex: 1,
    height: '4px',
    borderRadius: '2px',
    background: done ? '#6366f1' : active ? '#6366f1' : '#1e1e2e',
    opacity: active && !done ? 0.6 : 1,
    transition: 'background 0.3s',
  }),
  stepLabel: {
    fontSize: '12px',
    color: '#64748b',
    marginBottom: '24px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#fff',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#64748b',
    marginBottom: '32px',
  },
  fieldGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    color: '#94a3b8',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    background: '#0d0d14',
    border: '1px solid #1e1e2e',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#e2e8f0',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  select: {
    width: '100%',
    background: '#0d0d14',
    border: '1px solid #1e1e2e',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#e2e8f0',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  hoursRow: {
    display: 'grid',
    gridTemplateColumns: '52px 1fr 1fr 80px',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  dayLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#94a3b8',
  },
  timeInput: {
    background: '#0d0d14',
    border: '1px solid #1e1e2e',
    borderRadius: '8px',
    padding: '8px 10px',
    color: '#e2e8f0',
    fontSize: '13px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  closedLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#64748b',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  summaryBlock: {
    background: '#0d0d14',
    border: '1px solid #1e1e2e',
    borderRadius: '10px',
    padding: '20px',
    marginBottom: '20px',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '6px 0',
    borderBottom: '1px solid #1a1a28',
    fontSize: '14px',
  },
  summaryKey: { color: '#64748b', minWidth: '160px' },
  summaryVal: { color: '#e2e8f0', textAlign: 'right', fontWeight: 500 },
  btnRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '32px',
  },
  btnBack: {
    flex: 1,
    padding: '12px',
    background: 'transparent',
    border: '1px solid #1e1e2e',
    borderRadius: '10px',
    color: '#94a3b8',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnNext: {
    flex: 2,
    padding: '12px',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.02em',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  errorMsg: {
    color: '#f87171',
    fontSize: '13px',
    marginTop: '12px',
  },
  successMsg: {
    color: '#4ade80',
    fontSize: '13px',
    marginTop: '12px',
  },
  launchIcon: {
    marginRight: '8px',
  },
};

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const [step1, setStep1] = useState({
    business_name: '',
    business_industry: '',
    business_phone: '',
    business_address: '',
    website_url: '',
  });

  const [step2, setStep2] = useState({
    hours: { ...DEFAULT_HOURS },
    after_hours: 'AI handles everything',
    primary_goal: 'All of the above',
  });

  // Check if onboarding already complete + get user ID
  useEffect(() => {
    if (status === 'loading' || !session?.user?.email) return;
    supabase
      .from('users')
      .select('id, onboarding_complete')
      .eq('email', session.user.email)
      .single()
      .then(({ data }) => {
        if (data?.onboarding_complete) {
          router.replace('/dashboard');
        } else if (data?.id) {
          setUserId(data.id);
        }
      });
  }, [session, status, router]);

  function updateHours(day, field, value) {
    setStep2(prev => ({
      ...prev,
      hours: {
        ...prev.hours,
        [day]: { ...prev.hours[day], [field]: value },
      },
    }));
  }

  function formatHoursString() {
    return DAYS.map(day => {
      const h = step2.hours[day];
      if (h.closed) return `${day}: Closed`;
      return `${day}: ${h.open}–${h.close}`;
    }).join(', ');
  }

  function step1Valid() {
    return step1.business_name.trim() && step1.business_phone.trim();
  }

  async function handleSubmit() {
    if (!userId) {
      setMsg('Could not identify your account. Please refresh and try again.');
      return;
    }
    setSubmitting(true);
    setMsg('');

    try {
      // 1. PATCH /api/clients/[id] with business info
      const patchRes = await fetch(`/api/clients/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: step1.business_name,
          business_phone: step1.business_phone,
          business_hours: formatHoursString(),
          business_industry: step1.business_industry,
          after_hours_handling: step2.after_hours,
          primary_goal: step2.primary_goal,
        }),
      });
      if (!patchRes.ok) {
        const d = await patchRes.json();
        throw new Error(d.error || 'Failed to save business info.');
      }

      // 2. POST /api/retell/provision to create their AI agent
      const provRes = await fetch('/api/retell/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: userId,
          business_name: step1.business_name,
          business_phone: step1.business_phone,
          business_hours: formatHoursString(),
          after_hours: step2.after_hours,
        }),
      });
      // Non-blocking — provision may not exist yet, log but continue
      if (!provRes.ok) {
        console.warn('[onboarding] retell/provision failed — continuing');
      }

      // 3. Set onboarding_complete = true
      const { error: supaErr } = await supabase
        .from('users')
        .update({ onboarding_complete: true })
        .eq('id', userId);
      if (supaErr) throw new Error(supaErr.message);

      // 4. Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      setMsg(err.message || 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  if (status === 'loading') {
    return (
      <div style={{ ...s.page, justifyContent: 'center' }}>
        <p style={{ color: '#64748b' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.logo}>
        Hype<span style={s.logoAccent}>Box</span>
      </div>

      <div style={s.card}>
        {/* Progress bar */}
        <div style={s.progressBar}>
          {[1, 2, 3].map(n => (
            <div key={n} style={s.progressStep(step === n, step > n)} />
          ))}
        </div>

        {/* ── STEP 1: Business Info ── */}
        {step === 1 && (
          <>
            <p style={s.stepLabel}>Step 1 of 3</p>
            <h1 style={s.title}>Tell us about your business</h1>
            <p style={s.subtitle}>We'll use this to set up your AI system.</p>

            <div style={s.fieldGroup}>
              <label style={s.label}>Business Name <span style={{ color: '#f87171' }}>*</span></label>
              <input
                style={s.input}
                value={step1.business_name}
                onChange={e => setStep1(p => ({ ...p, business_name: e.target.value }))}
                placeholder="e.g. Garcia Auto Shop"
              />
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Industry</label>
              <select
                style={s.select}
                value={step1.business_industry}
                onChange={e => setStep1(p => ({ ...p, business_industry: e.target.value }))}
              >
                <option value="">Select your industry</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Business Phone Number <span style={{ color: '#f87171' }}>*</span></label>
              <input
                style={s.input}
                type="tel"
                value={step1.business_phone}
                onChange={e => setStep1(p => ({ ...p, business_phone: e.target.value }))}
                placeholder="(555) 000-0000"
              />
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Business Address</label>
              <input
                style={s.input}
                value={step1.business_address}
                onChange={e => setStep1(p => ({ ...p, business_address: e.target.value }))}
                placeholder="123 Main St, City, State"
              />
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Website URL</label>
              <input
                style={s.input}
                type="url"
                value={step1.website_url}
                onChange={e => setStep1(p => ({ ...p, website_url: e.target.value }))}
                placeholder="https://yourbusiness.com"
              />
            </div>

            <div style={s.btnRow}>
              <button
                style={{ ...s.btnNext, ...(!step1Valid() ? s.btnDisabled : {}) }}
                disabled={!step1Valid()}
                onClick={() => setStep(2)}
              >
                Continue →
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2: Hours & Preferences ── */}
        {step === 2 && (
          <>
            <p style={s.stepLabel}>Step 2 of 3</p>
            <h1 style={s.title}>Hours & preferences</h1>
            <p style={s.subtitle}>Your AI will respect these settings automatically.</p>

            <div style={s.fieldGroup}>
              <label style={{ ...s.label, marginBottom: '12px' }}>Business Hours</label>
              {/* Header row */}
              <div style={{ ...s.hoursRow, marginBottom: '4px' }}>
                <span style={{ ...s.dayLabel, fontSize: '11px', color: '#475569' }}>Day</span>
                <span style={{ fontSize: '11px', color: '#475569' }}>Open</span>
                <span style={{ fontSize: '11px', color: '#475569' }}>Close</span>
                <span style={{ fontSize: '11px', color: '#475569' }}>Closed?</span>
              </div>
              {DAYS.map(day => (
                <div key={day} style={s.hoursRow}>
                  <span style={s.dayLabel}>{day}</span>
                  <input
                    type="time"
                    style={{
                      ...s.timeInput,
                      opacity: step2.hours[day].closed ? 0.3 : 1,
                    }}
                    value={step2.hours[day].open}
                    disabled={step2.hours[day].closed}
                    onChange={e => updateHours(day, 'open', e.target.value)}
                  />
                  <input
                    type="time"
                    style={{
                      ...s.timeInput,
                      opacity: step2.hours[day].closed ? 0.3 : 1,
                    }}
                    value={step2.hours[day].close}
                    disabled={step2.hours[day].closed}
                    onChange={e => updateHours(day, 'close', e.target.value)}
                  />
                  <label style={s.closedLabel}>
                    <input
                      type="checkbox"
                      checked={step2.hours[day].closed}
                      onChange={e => updateHours(day, 'closed', e.target.checked)}
                    />
                    Closed
                  </label>
                </div>
              ))}
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>After Hours Handling</label>
              <select
                style={s.select}
                value={step2.after_hours}
                onChange={e => setStep2(p => ({ ...p, after_hours: e.target.value }))}
              >
                <option>Take a message</option>
                <option>Transfer to owner</option>
                <option>AI handles everything</option>
              </select>
            </div>

            <div style={s.fieldGroup}>
              <label style={s.label}>Primary Goal</label>
              <select
                style={s.select}
                value={step2.primary_goal}
                onChange={e => setStep2(p => ({ ...p, primary_goal: e.target.value }))}
              >
                <option>Answer more calls</option>
                <option>Get more reviews</option>
                <option>Book more appointments</option>
                <option>Win back customers</option>
                <option>All of the above</option>
              </select>
            </div>

            <div style={s.btnRow}>
              <button style={s.btnBack} onClick={() => setStep(1)}>← Back</button>
              <button style={s.btnNext} onClick={() => setStep(3)}>
                Continue →
              </button>
            </div>
          </>
        )}

        {/* ── STEP 3: Confirm & Launch ── */}
        {step === 3 && (
          <>
            <p style={s.stepLabel}>Step 3 of 3</p>
            <h1 style={s.title}>Confirm & launch</h1>
            <p style={s.subtitle}>Review your setup. You can change anything from your dashboard later.</p>

            <div style={s.summaryBlock}>
              {[
                ['Business Name', step1.business_name],
                ['Industry', step1.business_industry || '—'],
                ['Phone', step1.business_phone],
                ['Address', step1.business_address || '—'],
                ['Website', step1.website_url || '—'],
                ['After Hours', step2.after_hours],
                ['Primary Goal', step2.primary_goal],
              ].map(([key, val], i) => (
                <div
                  key={key}
                  style={{
                    ...s.summaryRow,
                    borderBottom: i < 6 ? '1px solid #1a1a28' : 'none',
                  }}
                >
                  <span style={s.summaryKey}>{key}</span>
                  <span style={s.summaryVal}>{val}</span>
                </div>
              ))}
            </div>

            <div style={s.summaryBlock}>
              <p style={{ ...s.label, marginBottom: '10px' }}>Business Hours</p>
              {DAYS.map(day => (
                <div
                  key={day}
                  style={{ ...s.summaryRow, borderBottom: '1px solid #1a1a28' }}
                >
                  <span style={s.summaryKey}>{day}</span>
                  <span style={s.summaryVal}>
                    {step2.hours[day].closed
                      ? 'Closed'
                      : `${step2.hours[day].open} – ${step2.hours[day].close}`}
                  </span>
                </div>
              ))}
            </div>

            {msg && (
              <p style={msg.startsWith('Could') || msg.includes('wrong') || msg.includes('Failed')
                ? s.errorMsg : s.successMsg}>
                {msg}
              </p>
            )}

            <div style={s.btnRow}>
              <button style={s.btnBack} onClick={() => setStep(2)} disabled={submitting}>
                ← Back
              </button>
              <button
                style={{ ...s.btnNext, ...(submitting ? s.btnDisabled : {}) }}
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? 'Launching...' : '🚀 Launch My AI System'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

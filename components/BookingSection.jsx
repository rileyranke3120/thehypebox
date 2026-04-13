'use client';

import { useState } from 'react';
import styles from '@/styles/marketing.module.css';

const GHL_CALENDAR_URL = 'https://api.leadconnectorhq.com/widget/booking/Ws5pQCTkYNNeqtSwGII4';

const INPUT = {
  width: '100%',
  padding: '13px 16px',
  background: '#111111',
  border: '1px solid #2A2A2A',
  borderRadius: '4px',
  color: '#ffffff',
  fontSize: '0.9rem',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

export default function BookingSection() {
  const [step, setStep] = useState('form'); // 'form' | 'loading' | 'calendar'
  const [error, setError] = useState('');
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setStep('loading');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, message: 'Booking form — scheduling a free estimate.' }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong. Please try again.');
        setStep('form');
        return;
      }
    } catch {
      // Non-fatal: still show the calendar even if the API call fails
    }

    setStep('calendar');
  }

  return (
    <section id="booking" className="section" aria-labelledby="booking-heading">
      <div className="container">
        <div className={styles.sectionHeaderCenter}>
          <span className="tag">Book a Call</span>
          <h2 id="booking-heading">Schedule Your Free Estimate</h2>
          <p>Pick a time that works for you. 30 minutes, no commitment, no pressure.</p>
        </div>

        <div style={{ maxWidth: '820px', margin: '3rem auto 0' }}>

          {/* ── Lead capture form ─────────────────────────────────────── */}
          {(step === 'form' || step === 'loading') && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                placeholder="Your name"
                value={form.name}
                onChange={update('name')}
                required
                style={INPUT}
              />
              <input
                type="tel"
                placeholder="Phone number"
                value={form.phone}
                onChange={update('phone')}
                required
                style={INPUT}
              />
              <input
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={update('email')}
                required
                style={INPUT}
              />

              {error && (
                <p style={{ fontSize: '0.78rem', color: '#ff6b6b', marginTop: 2 }}>⚠ {error}</p>
              )}

              <button
                type="submit"
                disabled={step === 'loading'}
                style={{
                  marginTop: 8,
                  padding: '14px 0',
                  background: step === 'loading' ? '#a88900' : '#F5C400',
                  color: '#000000',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 900,
                  fontSize: '0.9rem',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: step === 'loading' ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s ease',
                  width: '100%',
                }}
              >
                {step === 'loading' ? 'Saving…' : 'Continue to Calendar →'}
              </button>

              <p style={{ fontSize: '0.68rem', color: '#444', textAlign: 'center', marginTop: 4 }}>
                No spam. We&rsquo;ll only contact you about your estimate.
              </p>
            </form>
          )}

          {/* ── Calendar iframe ───────────────────────────────────────── */}
          {step === 'calendar' && (
            <div style={{ position: 'relative', background: '#0A0A0A', minHeight: 660 }}>

              {/* Loading skeleton */}
              {!iframeLoaded && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: '#0A0A0A',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 20, zIndex: 2, padding: '40px 32px',
                }}>
                  <div style={{ width: 160, height: 18, borderRadius: 4, background: '#1A1A1A', animation: 'bookingPulse 1.4s ease-in-out infinite' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, width: '100%', maxWidth: 420 }}>
                    {Array.from({ length: 35 }).map((_, i) => (
                      <div key={i} style={{
                        height: 36, borderRadius: 4,
                        background: i % 7 === 0 || i % 7 === 6 ? '#111' : '#161616',
                        animation: `bookingPulse 1.4s ease-in-out ${(i * 0.03).toFixed(2)}s infinite`,
                      }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 300 }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} style={{
                        height: 40, borderRadius: 4,
                        background: '#161616',
                        border: '1px solid #2A2A2A',
                        animation: `bookingPulse 1.4s ease-in-out ${(i * 0.1).toFixed(2)}s infinite`,
                      }} />
                    ))}
                  </div>
                  <p style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: '0.7rem',
                    color: '#444',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginTop: 8,
                  }}>
                    Loading calendar…
                  </p>
                </div>
              )}

              <iframe
                src={GHL_CALENDAR_URL}
                title="Schedule a free estimate"
                onLoad={() => setIframeLoaded(true)}
                style={{
                  width: '100%',
                  height: 660,
                  border: 'none',
                  display: 'block',
                  filter: 'invert(1) hue-rotate(180deg)',
                  opacity: iframeLoaded ? 1 : 0,
                  transition: 'opacity 0.4s ease',
                }}
                loading="lazy"
              />

              {/* Yellow accent line */}
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0,
                height: 2,
                background: 'linear-gradient(90deg, transparent, #F5C400 30%, #F5C400 70%, transparent)',
                pointerEvents: 'none',
                zIndex: 3,
              }} />
            </div>
          )}

        </div>

        {/* Fallback email */}
        <p style={{
          textAlign: 'center',
          fontSize: '0.72rem',
          color: 'var(--grey-500)',
          marginTop: '1.25rem',
          letterSpacing: '0.05em',
        }}>
          Prefer email?{' '}
          <a href="mailto:riley@thehypebox.com?subject=Free Estimate Request" style={{ color: 'var(--grey-300)' }}>
            riley@thehypebox.com
          </a>
        </p>
      </div>

      <style>{`
        @keyframes bookingPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
      `}</style>
    </section>
  );
}

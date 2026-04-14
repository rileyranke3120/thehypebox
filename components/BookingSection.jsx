'use client';

import { useState } from 'react';
import styles from '@/styles/marketing.module.css';

const GHL_CALENDAR_URL = 'https://api.leadconnectorhq.com/widget/booking/Ws5pQCTkYNNeqtSwGII4';

export default function BookingSection() {
  const [iframeLoaded, setIframeLoaded] = useState(false);

  return (
    <section id="booking" className="section" aria-labelledby="booking-heading">
      <div className="container">
        <div className={styles.sectionHeaderCenter}>
          <span className="tag">Book a Call</span>
          <h2 id="booking-heading">Schedule Your Free Estimate</h2>
          <p>Pick a time that works for you. 30 minutes, no commitment, no pressure.</p>
        </div>

        <div style={{ maxWidth: '820px', margin: '3rem auto 0' }}>
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

'use client';

import { useState, useEffect } from 'react';

export default function ExitIntentPopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('exit_popup_shown')) return;

    function handleMouseLeave(e) {
      if (e.clientY > 20) return;
      if (!sessionStorage.getItem('entry_popup_shown')) return;
      if (sessionStorage.getItem('exit_popup_shown')) return;
      sessionStorage.setItem('exit_popup_shown', '1');
      setVisible(true);
      document.removeEventListener('mouseleave', handleMouseLeave);
    }

    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, []);

  function close() { setVisible(false); }

  function goToPricing() {
    close();
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
  }

  if (!visible) return null;

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        backdropFilter: 'blur(4px)',
        animation: 'hbPopupFade 0.3s ease',
      }}
    >
      <style>{`@keyframes hbPopupFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes hbPopupSlide { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}
      </style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0f0f0f',
          border: '1px solid #FFD000',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '460px',
          padding: '2.5rem',
          position: 'relative',
          animation: 'hbPopupSlide 0.35s ease',
        }}
      >
        <button
          onClick={close}
          aria-label="Close"
          style={{
            position: 'absolute', top: '1rem', right: '1rem',
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#555', fontSize: '1.5rem', lineHeight: 1, padding: '0.25rem 0.4rem',
          }}
        >
          ×
        </button>
        <span style={{
          fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase',
          color: '#FFD000', fontWeight: 700, fontFamily: 'var(--font-heading)',
          display: 'block', marginBottom: '0.75rem',
        }}>
          Don&apos;t Leave Empty-Handed
        </span>
        <h2 style={{
          fontFamily: 'var(--font-heading)', fontSize: '1.75rem',
          fontWeight: 900, color: '#fff', marginBottom: '0.75rem', lineHeight: 1.2,
        }}>
          Wait — Don&apos;t Miss Out
        </h2>
        <p style={{ color: '#aaa', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '1.75rem' }}>
          Your competitors are already automating. Start your free trial before they get ahead.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            onClick={goToPricing}
            style={{
              background: '#FFD000', color: '#000', border: 'none',
              borderRadius: '6px', padding: '0.95rem', fontSize: '0.9rem',
              fontWeight: 900, fontFamily: 'var(--font-heading)',
              letterSpacing: '0.1em', cursor: 'pointer', width: '100%',
            }}
          >
            Claim My Free Trial
          </button>
          <button
            onClick={close}
            style={{
              background: 'none', color: '#555', border: 'none',
              cursor: 'pointer', fontSize: '0.85rem', padding: '0.5rem',
              width: '100%',
            }}
          >
            No Thanks
          </button>
        </div>
      </div>
    </div>
  );
}

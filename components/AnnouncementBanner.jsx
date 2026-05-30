'use client';

import { useState, useEffect } from 'react';

const BANNER_HEIGHT = 44;

export default function AnnouncementBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('banner_dismissed')) return;
    setVisible(true);
    document.documentElement.style.setProperty('--banner-offset', `${BANNER_HEIGHT}px`);
  }, []);

  function dismiss() {
    setVisible(false);
    sessionStorage.setItem('banner_dismissed', '1');
    document.documentElement.style.setProperty('--banner-offset', '0px');
  }

  function handleTrialClick() {
    dismiss();
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        height: `${BANNER_HEIGHT}px`,
        background: '#FFD000',
        color: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '0 3.5rem',
        fontSize: '0.82rem',
        fontWeight: 700,
        fontFamily: 'var(--font-heading)',
        letterSpacing: '0.04em',
        flexWrap: 'wrap',
        overflow: 'hidden',
      }}
    >
      <span style={{ whiteSpace: 'nowrap' }}>
        🚀 Start Your 14-Day Free Trial Today — No Setup Fees, Cancel Anytime
      </span>
      <button
        onClick={handleTrialClick}
        style={{
          background: '#000',
          color: '#FFD000',
          border: 'none',
          borderRadius: '4px',
          padding: '0.28rem 0.9rem',
          fontSize: '0.75rem',
          fontWeight: 900,
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.1em',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Start Free Trial
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss announcement"
        style={{
          position: 'absolute',
          right: '0.75rem',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1.25rem',
          color: '#000',
          lineHeight: 1,
          padding: '0.25rem 0.4rem',
          fontWeight: 700,
          opacity: 0.6,
        }}
      >
        ×
      </button>
    </div>
  );
}

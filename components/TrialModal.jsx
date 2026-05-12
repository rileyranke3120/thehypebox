'use client';

import { useEffect } from 'react';
import { useModal } from '@/context/ModalContext';
import StripeCheckoutForm from './StripeCheckoutForm';

const PLAN_LABELS = {
  launch:   { label: 'The Launch Box',   price: '$97/mo' },
  rocket:   { label: 'The Rocket Box',   price: '$297/mo' },
  velocity: { label: 'The Velocity Box', price: '$497/mo' },
};

export default function TrialModal() {
  const { open, plan, closeModal } = useModal();

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') closeModal(); }
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeModal]);

  if (!open) return null;

  const planData = PLAN_LABELS[plan] || PLAN_LABELS.velocity;

  return (
    <div
      onClick={closeModal}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0f0f0f',
          border: '1px solid #222',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ padding: '1.75rem 1.75rem 0', borderBottom: '1px solid #1a1a1a', paddingBottom: '1.25rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#FFD000', fontWeight: 700 }}>
              14-Day Free Trial
            </span>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', color: '#fff', margin: '6px 0 2px' }}>
              {planData.label}
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#666', margin: 0 }}>
              {planData.price} after trial · No charge today
            </p>
          </div>
          <button
            onClick={closeModal}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#555', fontSize: '1.5rem', lineHeight: 1,
              padding: '0 0 0 1rem', flexShrink: 0,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: '1.75rem' }}>
          <StripeCheckoutForm
            plan={plan}
            planLabel={planData.label}
            price={planData.price}
          />
        </div>

        {/* Footer */}
        <div style={{ padding: '0 1.75rem 1.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.78rem', color: '#444', lineHeight: 1.6 }}>
            🔒 Secure checkout powered by Stripe · Cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
}

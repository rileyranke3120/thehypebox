'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import StripeCheckoutForm from '@/components/StripeCheckoutForm';

const PLANS = {
  launch: {
    label: 'The Launch Box',
    price: '$97',
    period: '/mo',
    features: [
      'CRM + contact management',
      'Website + hosting',
      'Unified inbox (text, email, social)',
      'Basic automation',
      'Appointment scheduling',
    ],
  },
  rocket: {
    label: 'The Rocket Box',
    price: '$297',
    period: '/mo',
    features: [
      'Everything in Launch Box',
      'Advanced automation workflows',
      'Lead capture funnels',
      'AI-assisted responses',
      'Review & reputation tools',
    ],
  },
  velocity: {
    label: 'The Velocity Box',
    price: '$497',
    period: '/mo',
    features: [
      'Everything in Rocket Box',
      'AI phone receptionist',
      'Full pipeline tracking',
      'Team access + workflows',
      'Priority support',
    ],
  },
};

function CheckoutContent() {
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');
  const planData = PLANS[plan];

  if (!plan || !planData) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1.5rem' }}>
        <p style={{ color: '#999', fontSize: '1rem' }}>Invalid plan selected.</p>
        <Link href="/#pricing" className="btn btn-primary">See All Plans</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid #1a1a1a', padding: '1.25rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/">
          <Image
            src="/logo.png"
            alt="TheHypeBox"
            height={40}
            width={200}
            style={{ display: 'block', height: '40px', width: 'auto', mixBlendMode: 'screen' }}
          />
        </Link>
        <div style={{ fontSize: '0.85rem', color: '#666' }}>
          🔒 Secure checkout powered by Stripe
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', maxWidth: '1000px', margin: '0 auto', width: '100%', alignItems: 'start' }}>

        {/* Left: plan summary */}
        <div style={{ padding: '3rem 3rem 3rem 2rem', borderRight: '1px solid #1a1a1a' }}>
          <span style={{ display: 'inline-block', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#FFD000', border: '1px solid #FFD000', borderRadius: '4px', padding: '3px 10px', marginBottom: '1.5rem' }}>
            14-Day Free Trial
          </span>

          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', color: '#fff', marginBottom: '0.5rem' }}>
            {planData.label}
          </h1>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '2rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#FFD000' }}>{planData.price}</span>
            <span style={{ color: '#666', fontSize: '0.95rem' }}>{planData.period} after trial</span>
          </div>

          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {planData.features.map((f) => (
              <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1rem', color: '#ccc' }}>
                <img src="/box-icon.png" alt="" style={{ width: '26px', height: '26px', objectFit: 'contain', flexShrink: 0 }} />
                {f}
              </li>
            ))}
          </ul>

          <div style={{ marginTop: '2.5rem', padding: '1.25rem', background: '#111', border: '1px solid #1a1a1a', borderRadius: '8px' }}>
            <p style={{ fontSize: '0.82rem', color: '#555', lineHeight: 1.6, margin: 0 }}>
              Your free trial starts today. After 14 days, your card will be charged {planData.price}/mo. Cancel anytime.
            </p>
          </div>

          <p style={{ marginTop: '1.5rem', fontSize: '0.82rem', color: '#444' }}>
            Wrong plan?{' '}
            <Link href="/#pricing" style={{ color: '#FFD000' }}>
              See all plans →
            </Link>
          </p>
        </div>

        {/* Right: form */}
        <div style={{ padding: '3rem 2rem 3rem 3rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', color: '#fff', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
            Start Your Free Trial
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#666', marginBottom: '2rem' }}>
            No credit card charged today.
          </p>

          <StripeCheckoutForm
            plan={plan}
            planLabel={planData.label}
            price={planData.price}
          />
        </div>

      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0a0a' }} />}>
      <CheckoutContent />
    </Suspense>
  );
}

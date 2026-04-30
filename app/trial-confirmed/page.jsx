'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

const PLAN_LABELS = {
  launch:   'The Launch Box',
  rocket:   'The Rocket Box',
  velocity: 'The Velocity Box',
};

export default function TrialConfirmedPage() {
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan');
  const planLabel = PLAN_LABELS[plan] || 'Your Plan';

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>

      <Link href="/" style={{ marginBottom: '3rem' }}>
        <Image
          src="/logo.png"
          alt="TheHypeBox"
          height={48}
          width={240}
          style={{ display: 'block', height: '48px', width: 'auto', mixBlendMode: 'screen' }}
        />
      </Link>

      <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#1a1500', border: '2px solid #FFD000', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem', fontSize: '2rem', color: '#FFD000' }}>
        ✓
      </div>

      <span style={{ display: 'inline-block', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#FFD000', border: '1px solid #FFD000', borderRadius: '4px', padding: '3px 10px', marginBottom: '1.5rem' }}>
        Trial Active
      </span>

      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.25rem', color: '#fff', marginBottom: '1rem' }}>
        You&apos;re In!
      </h1>

      <p style={{ fontSize: '1rem', color: '#999', maxWidth: '460px', lineHeight: 1.7, marginBottom: '2.5rem' }}>
        Your <strong style={{ color: '#FFD000' }}>{planLabel}</strong> 14-day free trial is now live. We&apos;ll be in touch shortly to get everything set up for your business.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#111', border: '1px solid #1a1a1a', borderRadius: '8px', padding: '1.5rem 2rem', maxWidth: '400px', width: '100%', marginBottom: '2.5rem' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#FFD000', margin: 0 }}>
          What Happens Next
        </h3>
        {[
          "Check your email for a confirmation",
          "We'll reach out within 24 hours to onboard you",
          "Your system goes live — same day",
          "No charge for 14 days. Cancel anytime.",
        ].map((step) => (
          <div key={step} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', textAlign: 'left' }}>
            <span style={{ color: '#FFD000', fontWeight: 700, flexShrink: 0 }}>→</span>
            <span style={{ fontSize: '0.9rem', color: '#aaa' }}>{step}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/login" className="btn btn-primary">Log In to Dashboard</Link>
        <Link href="/" className="btn btn-ghost">Back to Site</Link>
      </div>

    </div>
  );
}

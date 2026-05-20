'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

function OnboardingForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const plan = searchParams.get('plan') || '';
  const email = searchParams.get('email') || '';

  const [form, setForm] = useState({
    business_name: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    google_review_url: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.business_name.trim() || !form.phone.trim()) {
      setError('Business name and phone number are required.');
      return;
    }

    setLoading(true);
    setError('');

    const address = [form.street, form.city, form.state, form.zip]
      .filter(Boolean)
      .join(', ');

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: form.business_name.trim(),
          phone: form.phone.trim(),
          address,
          google_review_url: form.google_review_url.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Something went wrong.');
      router.push(`/trial-confirmed?plan=${plan}`);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  function handleSkip() {
    router.push(`/trial-confirmed?plan=${plan}`);
  }

  const inputStyle = {
    display: 'block',
    width: '100%',
    padding: '13px 16px',
    background: '#111',
    border: '1px solid #2a2a2a',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '1rem',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.72rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#666',
    marginBottom: '6px',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid #1a1a1a', padding: '1.25rem 2rem' }}>
        <Link href="/">
          <Image
            src="/logo.png"
            alt="TheHypeBox"
            height={40}
            width={200}
            style={{ display: 'block', height: '40px', width: 'auto', mixBlendMode: 'screen' }}
          />
        </Link>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4rem 1.5rem 5rem' }}>
        <div style={{ width: '100%', maxWidth: '520px' }}>

          <div style={{ marginBottom: '2.5rem' }}>
            <span style={{
              display: 'inline-block', fontSize: '0.68rem', letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#FFD000', border: '1px solid #FFD000',
              borderRadius: '4px', padding: '3px 10px', marginBottom: '1.25rem',
            }}>
              One Last Step
            </span>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', color: '#fff', margin: '0 0 0.5rem' }}>
              Tell us about your business
            </h1>
            <p style={{ fontSize: '0.95rem', color: '#666', margin: 0 }}>
              We use this to personalize your AI system. Takes 30 seconds.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div>
              <label style={labelStyle}>
                Business Name <span style={{ color: '#FFD000' }}>*</span>
              </label>
              <input
                style={inputStyle}
                type="text"
                placeholder="e.g. Ideal Concrete Coatings"
                value={form.business_name}
                onChange={update('business_name')}
                required
              />
            </div>

            <div>
              <label style={labelStyle}>
                Business Phone <span style={{ color: '#FFD000' }}>*</span>
              </label>
              <input
                style={inputStyle}
                type="tel"
                placeholder="(555) 000-0000"
                value={form.phone}
                onChange={update('phone')}
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Street Address</label>
              <input
                style={{ ...inputStyle, marginBottom: '8px' }}
                type="text"
                placeholder="123 Main St"
                value={form.street}
                onChange={update('street')}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px' }}>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="City"
                  value={form.city}
                  onChange={update('city')}
                />
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="State"
                  value={form.state}
                  onChange={update('state')}
                />
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="ZIP"
                  value={form.zip}
                  onChange={update('zip')}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Google Review Link <span style={{ color: '#444' }}>(optional)</span></label>
              <input
                style={inputStyle}
                type="url"
                placeholder="https://g.page/r/..."
                value={form.google_review_url}
                onChange={update('google_review_url')}
              />
            </div>

            {error && (
              <p style={{ color: '#ff6b6b', fontSize: '0.88rem', margin: 0 }}>⚠ {error}</p>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={handleSkip}
                style={{
                  padding: '14px 20px', background: 'transparent', border: '1px solid #2a2a2a',
                  borderRadius: '4px', color: '#555', fontSize: '0.95rem', cursor: 'pointer',
                  fontFamily: 'inherit', flexShrink: 0,
                }}
              >
                Skip for now
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center', fontSize: '1rem', padding: '14px', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Saving…' : 'Finish Setup →'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#FFD000', fontSize: '0.9rem', letterSpacing: '0.1em' }}>Loading…</span>
      </div>
    }>
      <OnboardingForm />
    </Suspense>
  );
}

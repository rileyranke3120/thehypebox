'use client';

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

const APPEARANCE = {
  theme: 'night',
  variables: {
    colorPrimary: '#FFD000',
    colorBackground: '#111111',
    colorText: '#ffffff',
    colorDanger: '#ff6b6b',
    fontFamily: 'system-ui, sans-serif',
    borderRadius: '4px',
  },
  rules: {
    '.Input': { border: '1px solid #2a2a2a', backgroundColor: '#111' },
    '.Input:focus': { border: '1px solid #FFD000', boxShadow: 'none' },
    '.Label': { color: '#999', fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase' },
  },
};

const inputStyle = {
  padding: '14px 18px',
  background: '#111',
  border: '1px solid #2a2a2a',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '1rem',
  width: '100%',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.75rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#999',
  marginBottom: '6px',
};

// Step 2 inner form — inside <Elements>
function PayForm({ plan, email, name, clientSecret, onBack, onError, error }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Fallback: if onReady never fires within 5s, unblock button anyway
    const t = setTimeout(() => setReady(true), 5000);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) {
      onError('Payment not ready — please refresh the page and try again.');
      return;
    }
    setLoading(true);
    onError('');

    try {
      // Race elements.submit() against a 12s timeout so it never hangs forever
      const submitResult = await Promise.race([
        elements.submit(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Card form took too long — please wait a moment and try again.')), 12000)
        ),
      ]);
      const { error: submitErr } = submitResult;
      if (submitErr) {
        onError(submitErr.message);
        setLoading(false);
        return;
      }

      // Fire account creation before redirect
      fetch('/api/checkout/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, plan }),
      }).catch(() => {});

      const { error: confirmErr } = await stripe.confirmSetup({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/trial-confirmed?plan=${plan}`,
          payment_method_data: { billing_details: { name, email } },
        },
      });

      if (confirmErr) {
        onError(confirmErr.message || 'Card setup failed. Please try again.');
        setLoading(false);
      } else {
        window.location.href = `${window.location.origin}/trial-confirmed?plan=${plan}`;
      }
    } catch (err) {
      onError(err?.message || 'Something went wrong — please try again.');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', background: '#0a0a0a', border: '1px solid #222', borderRadius: '4px' }}>
        <span style={{ fontSize: '0.85rem', color: '#999' }}>Signing up as</span>
        <span style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600 }}>{email}</span>
        <button onClick={onBack} type="button" style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#FFD000', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          Change
        </button>
      </div>

      <PaymentElement options={{ layout: 'tabs' }} onReady={() => setReady(true)} onLoadError={() => onError('Card form failed to load — please refresh.')} />

      {error && <p style={{ color: '#ff6b6b', fontSize: '0.9rem', margin: 0 }}>⚠ {error}</p>}

      <button
        type="submit"
        disabled={!stripe || !ready || loading}
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center', opacity: (!ready || loading) ? 0.7 : 1, fontSize: '1rem', padding: '1rem' }}
      >
        {loading ? 'Processing…' : !ready ? 'Loading…' : 'Start My Free Trial →'}
      </button>

      <p style={{ textAlign: 'center', fontSize: '0.82rem', color: '#666', lineHeight: 1.5 }}>
        Your card is saved but not charged today.<br />
        Trial ends in 14 days — cancel anytime before then.
      </p>
    </form>
  );
}

export default function StripeCheckoutForm({ plan }) {
  const [step, setStep] = useState('info');
  const [info, setInfo] = useState({ name: '', email: '' });
  const [clientSecret, setClientSecret] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function update(field) {
    return (e) => setInfo((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleInfoSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, ...info }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || 'Something went wrong.');
        setLoading(false);
        return;
      }
      setClientSecret(data.clientSecret);
      setStep('payment');
    } catch {
      setError('Network error — please try again.');
    }
    setLoading(false);
  }

  if (step === 'info') {
    return (
      <form onSubmit={handleInfoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={labelStyle}>Full Name</label>
          <input type="text" placeholder="Jane Smith" value={info.name} onChange={update('name')} required style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Email Address</label>
          <input type="email" placeholder="jane@yourbusiness.com" value={info.email} onChange={update('email')} required style={inputStyle} />
        </div>
        {error && <p style={{ color: '#ff6b6b', fontSize: '0.9rem', margin: 0 }}>⚠ {error}</p>}
        <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: loading ? 0.7 : 1, fontSize: '1rem', padding: '1rem' }}>
          {loading ? 'Loading…' : 'Continue to Payment →'}
        </button>
        <p style={{ textAlign: 'center', fontSize: '0.82rem', color: '#666' }}>Free for 14 days · No charge until trial ends</p>
      </form>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: APPEARANCE }}>
      <PayForm
        plan={plan}
        email={info.email}
        name={info.name}
        clientSecret={clientSecret}
        onBack={() => setStep('info')}
        onError={setError}
        error={error}
      />
    </Elements>
  );
}

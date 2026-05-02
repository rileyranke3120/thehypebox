'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

const STRIPE_APPEARANCE = {
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
    '.Input': {
      border: '1px solid #2a2a2a',
      backgroundColor: '#111',
    },
    '.Input:focus': {
      border: '1px solid #FFD000',
      boxShadow: 'none',
    },
    '.Label': {
      color: '#999',
      fontSize: '0.8rem',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
    },
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

// Inner form — must live inside <Elements>
function CardForm({ plan, email, name, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements || !ready) return;

    setLoading(true);
    onError('');

    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/trial-confirmed?plan=${plan}`,
        payment_method_data: {
          billing_details: { name, email },
        },
      },
      redirect: 'if_required',
    });

    if (error) {
      onError(error.message || 'Card setup failed. Please try again.');
      setLoading(false);
    } else {
      // Create account and send welcome email
      await fetch('/api/checkout/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, plan }),
      });
      window.location.href = `${window.location.origin}/trial-confirmed?plan=${plan}`;
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PaymentElement onReady={() => setReady(true)} />

      <button
        type="submit"
        disabled={!stripe || !ready || loading}
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center', opacity: (!ready || loading) ? 0.7 : 1, fontSize: '1rem', padding: '1rem' }}
      >
        {loading ? 'Processing…' : ready ? 'Start My Free Trial →' : 'Loading…'}
      </button>

      <p style={{ textAlign: 'center', fontSize: '0.82rem', color: '#666', lineHeight: 1.5 }}>
        Your card is saved but not charged today.<br />
        Trial ends in 14 days — cancel anytime before then.
      </p>
    </form>
  );
}

export default function StripeCheckoutForm({ plan, planLabel, price }) {
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

  // Step 1: name + email
  if (step === 'info') {
    return (
      <form onSubmit={handleInfoSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#999', marginBottom: '6px' }}>
            Full Name
          </label>
          <input
            type="text"
            placeholder="Jane Smith"
            value={info.name}
            onChange={update('name')}
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#999', marginBottom: '6px' }}>
            Email Address
          </label>
          <input
            type="email"
            placeholder="jane@yourbusiness.com"
            value={info.email}
            onChange={update('email')}
            required
            style={inputStyle}
          />
        </div>

        {error && (
          <p style={{ color: '#ff6b6b', fontSize: '0.9rem', margin: 0 }}>⚠ {error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', opacity: loading ? 0.7 : 1, fontSize: '1rem', padding: '1rem' }}
        >
          {loading ? 'Loading…' : 'Continue to Payment →'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '0.82rem', color: '#666' }}>
          Free for 14 days · No charge until trial ends
        </p>
      </form>
    );
  }

  // Step 2: payment
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', padding: '14px', background: '#0a0a0a', border: '1px solid #222', borderRadius: '4px' }}>
        <span style={{ fontSize: '0.85rem', color: '#999' }}>Signing up as</span>
        <span style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600 }}>{info.email}</span>
        <button
          onClick={() => setStep('info')}
          style={{ marginLeft: 'auto', fontSize: '0.8rem', color: '#FFD000', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          Change
        </button>
      </div>

      {error && (
        <p style={{ color: '#ff6b6b', fontSize: '0.9rem', marginBottom: '16px' }}>⚠ {error}</p>
      )}

      <Elements
        stripe={stripePromise}
        options={{ clientSecret, appearance: STRIPE_APPEARANCE }}
      >
        <CardForm
          plan={plan}
          email={info.email}
          name={info.name}
          onError={setError}
        />
      </Elements>
    </div>
  );
}

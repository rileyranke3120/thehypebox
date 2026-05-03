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

function CheckoutForm({ plan }) {
  const stripe = useStripe();
  const elements = useElements();
  const [info, setInfo] = useState({ name: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 8000);
    return () => clearTimeout(t);
  }, []);

  function update(field) {
    return (e) => setInfo((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError('');

    try {
      // Validate payment form (works because iframe loaded while user filled name/email)
      const { error: submitErr } = await elements.submit();
      if (submitErr) {
        setError(submitErr.message);
        setLoading(false);
        return;
      }

      // Create customer + subscription server-side
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

      // Fire account creation (non-blocking)
      fetch('/api/checkout/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: info.email, name: info.name, plan }),
      }).catch(() => {});

      // Confirm setup with client secret
      const { error: confirmErr } = await stripe.confirmSetup({
        elements,
        clientSecret: data.clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/trial-confirmed?plan=${plan}`,
          payment_method_data: { billing_details: { name: info.name, email: info.email } },
        },
      });

      if (confirmErr) {
        setError(confirmErr.message || 'Card setup failed. Please try again.');
        setLoading(false);
      } else {
        window.location.href = `${window.location.origin}/trial-confirmed?plan=${plan}`;
      }
    } catch (err) {
      setError(err?.message || 'Something went wrong — please try again.');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label style={labelStyle}>Full Name</label>
        <input type="text" placeholder="Jane Smith" value={info.name} onChange={update('name')} required style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Email Address</label>
        <input type="email" placeholder="jane@yourbusiness.com" value={info.email} onChange={update('email')} required style={inputStyle} />
      </div>

      <PaymentElement options={{ layout: 'tabs' }} onReady={() => setReady(true)} />

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
        Free for 14 days · No charge until trial ends
      </p>
    </form>
  );
}

export default function StripeCheckoutForm({ plan }) {
  return (
    <Elements stripe={stripePromise} options={{ mode: 'setup', currency: 'usd', appearance: APPEARANCE }}>
      <CheckoutForm plan={plan} />
    </Elements>
  );
}

'use client';

import { useState } from 'react';

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

const fieldLabel = {
  display: 'block',
  fontSize: '0.75rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#999',
  marginBottom: '6px',
};

export default function StripeCheckoutForm({ plan }) {
  const [info, setInfo] = useState({ name: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function update(field) {
    return (e) => setInfo((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
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

      // Redirect to Stripe hosted checkout
      window.location.href = data.url;
    } catch {
      setError('Network error — please try again.');
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <label style={fieldLabel}>Full Name</label>
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
        <label style={fieldLabel}>Email Address</label>
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
        {loading ? 'Redirecting to checkout…' : 'Continue to Payment →'}
      </button>

      <p style={{ textAlign: 'center', fontSize: '0.82rem', color: '#666' }}>
        Free for 14 days · No charge until trial ends · Cancel anytime
      </p>
    </form>
  );
}

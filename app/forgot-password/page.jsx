'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const inputStyle = {
  width: '100%',
  padding: '14px 16px',
  background: '#111',
  border: '1px solid #2a2a2a',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '1rem',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | success | error
  const [focused, setFocused] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid #1a1a1a', padding: '1.25rem 2rem' }}>
        <Link href="/">
          <Image src="/logo.png" alt="TheHypeBox" height={40} width={200} style={{ display: 'block', height: '40px', width: 'auto', mixBlendMode: 'screen' }} />
        </Link>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.75rem, 5vw, 2.25rem)', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#fff', marginBottom: '0.5rem' }}>
              Reset Password
            </h1>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          {status === 'success' ? (
            <div>
              <div style={{ padding: '1.5rem', background: '#0d1f0d', border: '1px solid #1d3d1d', borderLeft: '3px solid #28C840', borderRadius: '4px', marginBottom: '1.5rem' }}>
                <p style={{ color: '#28C840', fontWeight: 600, margin: '0 0 0.4rem' }}>Check your inbox</p>
                <p style={{ color: '#aaa', fontSize: '0.88rem', margin: 0, lineHeight: 1.6 }}>
                  If an account exists with that email, we&apos;ve sent a password reset link. It expires in 1 hour. Check your spam folder if you don&apos;t see it.
                </p>
              </div>
              <Link href="/login" style={{ display: 'block', textAlign: 'center', color: '#666', fontSize: '0.88rem' }}>
                ← Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#666', marginBottom: '6px', fontFamily: 'var(--font-heading)' }} htmlFor="email">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="you@yourbusiness.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  style={{ ...inputStyle, borderColor: focused ? '#F5C400' : '#2a2a2a' }}
                />
              </div>

              {status === 'error' && (
                <p style={{ color: '#E24B4A', fontSize: '0.88rem', margin: 0 }}>
                  ⚠ Something went wrong. Please try again.
                </p>
              )}

              <button
                type="submit"
                disabled={status === 'sending'}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', fontSize: '1rem', padding: '1rem', opacity: status === 'sending' ? 0.7 : 1 }}
              >
                {status === 'sending' ? 'Sending…' : 'Send Reset Link →'}
              </button>

              <Link href="/login" style={{ textAlign: 'center', color: '#555', fontSize: '0.85rem', display: 'block' }}>
                ← Back to login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

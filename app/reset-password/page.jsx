'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error | invalid
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(null);

  useEffect(() => {
    if (!token) setStatus('invalid');
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setStatus('submitting');
    try {
      const res = await fetch('/api/auth/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setTimeout(() => router.push('/login'), 3000);
      } else {
        setError(data.error || 'Failed to reset password.');
        setStatus('idle');
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setStatus('idle');
    }
  }

  if (status === 'invalid') {
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#E24B4A', marginBottom: '1rem' }}>This reset link is missing or invalid.</p>
        <Link href="/forgot-password" className="btn btn-primary" style={{ fontSize: '0.9rem' }}>
          Request a new link →
        </Link>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div>
        <div style={{ padding: '1.5rem', background: '#0d1f0d', border: '1px solid #1d3d1d', borderLeft: '3px solid #28C840', borderRadius: '4px', marginBottom: '1.5rem' }}>
          <p style={{ color: '#28C840', fontWeight: 600, margin: '0 0 0.4rem' }}>Password updated!</p>
          <p style={{ color: '#aaa', fontSize: '0.88rem', margin: 0 }}>
            Your password has been changed successfully. Redirecting to login…
          </p>
        </div>
        <Link href="/login" style={{ display: 'block', textAlign: 'center', color: '#666', fontSize: '0.88rem' }}>
          Go to login →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <label style={{ display: 'block', fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#666', marginBottom: '6px', fontFamily: 'var(--font-heading)' }} htmlFor="password">
          New Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          placeholder="Minimum 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onFocus={() => setFocused('password')}
          onBlur={() => setFocused(null)}
          style={{ ...inputStyle, borderColor: focused === 'password' ? '#F5C400' : '#2a2a2a' }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#666', marginBottom: '6px', fontFamily: 'var(--font-heading)' }} htmlFor="confirm">
          Confirm Password
        </label>
        <input
          id="confirm"
          type="password"
          required
          placeholder="Re-enter your new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onFocus={() => setFocused('confirm')}
          onBlur={() => setFocused(null)}
          style={{ ...inputStyle, borderColor: focused === 'confirm' ? '#F5C400' : '#2a2a2a' }}
        />
      </div>

      {error && (
        <p style={{ color: '#E24B4A', fontSize: '0.88rem', margin: 0 }}>⚠ {error}</p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center', fontSize: '1rem', padding: '1rem', opacity: status === 'submitting' ? 0.7 : 1 }}
      >
        {status === 'submitting' ? 'Saving…' : 'Set New Password →'}
      </button>

      <Link href="/forgot-password" style={{ textAlign: 'center', color: '#555', fontSize: '0.85rem', display: 'block' }}>
        Request a new link
      </Link>
    </form>
  );
}

export default function ResetPasswordPage() {
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
              New Password
            </h1>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>Choose a strong password for your account.</p>
          </div>
          <Suspense fallback={<div style={{ color: '#555', textAlign: 'center' }}>Loading…</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

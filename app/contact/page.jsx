'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  background: '#111',
  border: '1px solid #2a2a2a',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '0.95rem',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 150ms ease',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.72rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#666',
  marginBottom: '6px',
  fontFamily: 'var(--font-heading)',
};

const SUBJECTS = [
  'General Question',
  'Billing Issue',
  'Technical Support',
  'Cancellation Request',
  'Feature Request',
  'Other',
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: 'General Question', message: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | success | error
  const [focusedField, setFocusedField] = useState(null);

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function focusStyle(field) {
    return { ...inputStyle, borderColor: focusedField === field ? '#F5C400' : '#2a2a2a' };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setStatus('success');
        setForm({ name: '', email: '', subject: 'General Question', message: '' });
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff' }}>
      <header style={{ borderBottom: '1px solid #1a1a1a', padding: '1.25rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/">
          <Image src="/logo.png" alt="TheHypeBox" height={40} width={200} style={{ display: 'block', height: '40px', width: 'auto', mixBlendMode: 'screen' }} />
        </Link>
        <Link href="/faq" style={{ fontSize: '0.82rem', color: '#666' }}>View FAQ →</Link>
      </header>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '4rem 1.5rem 6rem' }}>
        <div style={{ marginBottom: '2.5rem' }}>
          <span style={{ display: 'inline-block', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#F5C400', border: '1px solid #F5C400', borderRadius: '4px', padding: '3px 10px', marginBottom: '1rem' }}>
            Support
          </span>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(2rem, 6vw, 3rem)', textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '0.5rem' }}>
            Contact Us
          </h1>
          <p style={{ color: '#666', fontSize: '0.95rem' }}>
            We&apos;re here to help. Send us a message and we&apos;ll respond within 24 hours — usually much faster.
          </p>
        </div>

        {status === 'success' ? (
          <div style={{ padding: '2rem', background: '#0d1f0d', border: '1px solid #1d3d1d', borderLeft: '3px solid #28C840', borderRadius: '4px', marginBottom: '2rem' }}>
            <p style={{ color: '#28C840', fontWeight: 600, margin: '0 0 0.4rem' }}>Message sent!</p>
            <p style={{ color: '#aaa', fontSize: '0.88rem', margin: 0 }}>
              We&apos;ve received your message and will get back to you within 24 hours. You should also receive a confirmation email.
            </p>
            <button
              onClick={() => setStatus('idle')}
              style={{ marginTop: '1rem', background: 'none', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#888', fontSize: '0.82rem', padding: '0.4rem 0.875rem', cursor: 'pointer' }}
            >
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle} htmlFor="name">Full Name *</label>
                <input
                  id="name"
                  type="text"
                  required
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={update('name')}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  style={focusStyle('name')}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="email">Email Address *</label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="jane@yourbusiness.com"
                  value={form.email}
                  onChange={update('email')}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  style={focusStyle('email')}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle} htmlFor="subject">Subject *</label>
              <select
                id="subject"
                value={form.subject}
                onChange={update('subject')}
                onFocus={() => setFocusedField('subject')}
                onBlur={() => setFocusedField(null)}
                style={{ ...focusStyle('subject'), cursor: 'pointer' }}
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s} style={{ background: '#111' }}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle} htmlFor="message">Message *</label>
              <textarea
                id="message"
                required
                minLength={10}
                rows={6}
                placeholder="Describe your question or issue..."
                value={form.message}
                onChange={update('message')}
                onFocus={() => setFocusedField('message')}
                onBlur={() => setFocusedField(null)}
                style={{ ...focusStyle('message'), resize: 'vertical', minHeight: '120px' }}
              />
              <p style={{ fontSize: '0.72rem', color: '#444', margin: '4px 0 0' }}>Minimum 10 characters</p>
            </div>

            {status === 'error' && (
              <p style={{ color: '#E24B4A', fontSize: '0.88rem', margin: 0 }}>
                ⚠ Something went wrong. Please try again or email{' '}
                <a href="mailto:riley@thehypeboxllc.com" style={{ color: '#F5C400' }}>riley@thehypeboxllc.com</a> directly.
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'sending'}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', fontSize: '1rem', padding: '1rem', opacity: status === 'sending' ? 0.7 : 1 }}
            >
              {status === 'sending' ? 'Sending…' : 'Send Message →'}
            </button>
          </form>
        )}

        {/* Alternative contact */}
        <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid #1a1a1a', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div style={{ padding: '1.25rem', background: '#111', border: '1px solid #1a1a1a', borderRadius: '4px' }}>
            <p style={{ fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#555', margin: '0 0 6px', fontFamily: 'var(--font-heading)' }}>Email</p>
            <a href="mailto:riley@thehypeboxllc.com" style={{ color: '#F5C400', fontSize: '0.88rem' }}>riley@thehypeboxllc.com</a>
            <p style={{ color: '#555', fontSize: '0.8rem', margin: '4px 0 0' }}>Response within 24 hours</p>
          </div>
          <div style={{ padding: '1.25rem', background: '#111', border: '1px solid #1a1a1a', borderRadius: '4px' }}>
            <p style={{ fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#555', margin: '0 0 6px', fontFamily: 'var(--font-heading)' }}>FAQ</p>
            <Link href="/faq" style={{ color: '#F5C400', fontSize: '0.88rem' }}>Browse common questions →</Link>
            <p style={{ color: '#555', fontSize: '0.8rem', margin: '4px 0 0' }}>Instant answers</p>
          </div>
        </div>
      </div>
    </div>
  );
}

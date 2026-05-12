'use client';

import { useState } from 'react';
import styles from '@/styles/marketing.module.css';

const inputStyle = {
  padding: '14px 18px',
  background: '#111',
  border: '1px solid #2a2a2a',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '1rem',
  fontFamily: 'var(--font-body)',
  width: '100%',
  outline: 'none',
  transition: 'border-color 150ms ease',
};

export default function ContactSection() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'Something went wrong.');
        setStatus('error');
      } else {
        setStatus('success');
      }
    } catch {
      setErrorMsg('Network error — please try emailing us directly.');
      setStatus('error');
    }
  }

  return (
    <section id="contact" className="section" style={{ background: '#0a0a0a' }}>
      <div className="container">

        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <span className="tag">Contact Us</span>
          <h2 style={{ marginTop: '16px' }}>Let&apos;s Talk</h2>
          <p style={{ opacity: 0.6, marginTop: '12px', fontSize: '1rem' }}>
            Ready to start your free trial? Have questions? We&apos;re here.
          </p>
        </div>

        <div className={styles.contactGrid}>

          {/* Left — contact info */}
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--yellow)', marginBottom: '1.5rem' }}>Reach Us Directly</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <p style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--grey-500)', marginBottom: '4px' }}>Phone</p>
                <p style={{ fontSize: '1rem', color: 'var(--grey-300)' }}>1-800 number coming soon</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--grey-500)', marginBottom: '4px' }}>Email</p>
                <a href="mailto:riley@thehypeboxllc.com" style={{ display: 'block', fontSize: '1rem', color: 'var(--yellow)', marginBottom: '4px' }}>riley@thehypeboxllc.com</a>
                <a href="mailto:denny@thehypeboxllc.com" style={{ display: 'block', fontSize: '1rem', color: 'var(--yellow)' }}>denny@thehypeboxllc.com</a>
              </div>
            </div>

            {/* Team */}
            <div style={{ marginTop: '2.5rem' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--yellow)', marginBottom: '1.25rem' }}>The Team</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {['Riley — Developer & Co-Founder', 'Denny — Strategy & Co-Founder', 'Barry — Project Manager'].map((name) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: '#111', border: '1px solid #222', borderRadius: '8px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#1a1500', border: '1px solid var(--yellow)', flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: '0.95rem', color: 'var(--white)', fontWeight: 600 }}>{name}</p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--grey-500)', marginTop: '2px' }}>Bio coming soon</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — form */}
          <div>
            <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--yellow)', marginBottom: '1.5rem' }}>Send Us a Message</h3>

            {status === 'success' ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', background: '#111', border: '1px solid #222', borderRadius: '8px' }}>
                <div style={{ fontSize: '2rem', color: 'var(--yellow)', marginBottom: '12px' }}>✓</div>
                <h3 style={{ color: 'var(--white)', marginBottom: '8px' }}>Got it, {form.name.split(' ')[0]}!</h3>
                <p style={{ opacity: 0.6, fontSize: '0.95rem' }}>We&apos;ll be in touch within 24 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <input type="text" placeholder="Your name" value={form.name} onChange={update('name')} required style={inputStyle} />
                  <input type="email" placeholder="Email address" value={form.email} onChange={update('email')} required style={inputStyle} />
                </div>
                <input type="tel" placeholder="Phone number (optional)" value={form.phone} onChange={update('phone')} style={inputStyle} />
                <textarea placeholder="What would you like to know?" value={form.message} onChange={update('message')} rows={4} style={{ ...inputStyle, resize: 'vertical' }} />

                {status === 'error' && (
                  <p style={{ color: '#ff6b6b', fontSize: '0.9rem' }}>⚠ {errorMsg}</p>
                )}

                <button type="submit" disabled={status === 'loading'} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: status === 'loading' ? 0.6 : 1 }}>
                  {status === 'loading' ? 'Sending…' : 'Send Message'}
                </button>
                <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--grey-500)' }}>We respond within 24 hours</p>
              </form>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}

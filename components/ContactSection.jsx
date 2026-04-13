'use client';

import { useState } from 'react';

const inputStyle = {
  padding: '14px 18px',
  background: '#111',
  border: '1px solid #2a2a2a',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '0.95rem',
  fontFamily: 'var(--font-body)',
  width: '100%',
  outline: 'none',
  transition: 'border-color 150ms ease',
};

export default function ContactSection() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
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
      setErrorMsg('Network error — please try calling us directly.');
      setStatus('error');
    }
  }

  return (
    <section id="contact" className="section" style={{ background: '#0a0a0a' }}>
      <div className="container">

        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <span className="tag">Get In Touch</span>
          <h2 style={{ marginTop: '16px' }}>Have a Question? Ask Us Anything.</h2>
          <p style={{ opacity: 0.6, marginTop: '12px' }}>
            Or call Alex directly — our AI receptionist is available 24/7.
          </p>
          <a
            href="tel:+18563630633"
            className="btn btn-primary"
            style={{ marginTop: '20px' }}
          >
            Call Alex — (856) 363-0633
          </a>
        </div>

        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>✓</div>
            <h3 style={{ color: 'var(--yellow)', marginBottom: '8px' }}>Got it, {form.name.split(' ')[0]}!</h3>
            <p style={{ opacity: 0.6 }}>
              You&rsquo;ve been added to our CRM. We&rsquo;ll be in touch shortly.
              <br />Or call Alex now at (856) 363-0633.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ maxWidth: '560px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <input
                type="text"
                placeholder="Your name"
                value={form.name}
                onChange={update('name')}
                required
                style={inputStyle}
              />
              <input
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={update('email')}
                required
                style={inputStyle}
              />
            </div>
            <input
              type="tel"
              placeholder="Phone number (optional)"
              value={form.phone}
              onChange={update('phone')}
              style={inputStyle}
            />
            <textarea
              placeholder="What would you like to know?"
              value={form.message}
              onChange={update('message')}
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
            />

            {status === 'error' && (
              <p style={{ color: '#ff6b6b', fontSize: '0.8rem' }}>⚠ {errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', opacity: status === 'loading' ? 0.6 : 1 }}
            >
              {status === 'loading' ? 'Sending…' : 'Send Message'}
            </button>
          </form>
        )}

      </div>
    </section>
  );
}

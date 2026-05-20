'use client';

import { useState } from 'react';
import Image from 'next/image';

const FIELD = {
  color: '#fff',
  background: '#0d0d0d',
  border: '1px solid #222',
  borderRadius: 4,
  padding: '10px 12px',
  fontSize: '0.9rem',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  outline: 'none',
};

const LABEL = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#555',
  marginBottom: 6,
};

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={LABEL}>{label}{required && <span style={{ color: '#FFD000', marginLeft: 3 }}>*</span>}</label>
      {children}
    </div>
  );
}

export default function IntakePage() {
  const [form, setForm] = useState({
    owner_name: '', business_name: '', phone: '', email: '',
    address: '', ein: '', services: '',
    google_url: '', yelp_url: '', facebook_url: '', other_review_url: '',
    plan: '', notes: '',
  });
  const [status, setStatus] = useState(null); // 'loading' | 'success' | 'error'
  const [error, setError] = useState('');

  function set(field) {
    return (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.owner_name.trim() || !form.business_name.trim() || !form.phone.trim()) {
      setError('Owner name, business name, and phone are required.');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Submission failed.');
      setStatus('success');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }

  const inputStyle = (focused) => ({
    ...FIELD,
    borderColor: focused ? '#FFD000' : '#222',
  });

  if (status === 'success') {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🚀</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFD000', margin: '0 0 12px', fontFamily: 'system-ui' }}>
            Intake Submitted
          </h1>
          <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: 1.6 }}>
            Riley has been notified. Setup will begin shortly.
          </p>
          <button
            onClick={() => { setStatus(null); setForm({ owner_name: '', business_name: '', phone: '', email: '', address: '', ein: '', services: '', google_url: '', yelp_url: '', facebook_url: '', other_review_url: '', plan: '', notes: '' }); }}
            style={{ marginTop: 24, background: '#FFD000', color: '#000', border: 'none', borderRadius: 4, padding: '10px 24px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', padding: '40px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Image src="/hype-box-logo.png" alt="TheHypeBox" width={36} height={36} />
          <div>
            <div style={{ fontSize: '0.65rem', color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase' }}>TheHypeBox</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', letterSpacing: '0.04em' }}>New Client Intake</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>

          {/* Contact Info */}
          <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: '20px', marginBottom: 16 }}>
            <div style={{ fontSize: '0.68rem', color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Contact Info</div>
            <Field label="Owner Name" required>
              <input style={FIELD} value={form.owner_name} onChange={set('owner_name')} placeholder="John Smith" />
            </Field>
            <Field label="Business Name" required>
              <input style={FIELD} value={form.business_name} onChange={set('business_name')} placeholder="Smith Concrete Coatings" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Phone" required>
                <input style={FIELD} value={form.phone} onChange={set('phone')} placeholder="(614) 555-0100" type="tel" />
              </Field>
              <Field label="Email">
                <input style={FIELD} value={form.email} onChange={set('email')} placeholder="john@business.com" type="email" />
              </Field>
            </div>
            <Field label="Business Address">
              <input style={FIELD} value={form.address} onChange={set('address')} placeholder="123 Main St, Columbus OH 43215" />
            </Field>
            <Field label="EIN">
              <input style={FIELD} value={form.ein} onChange={set('ein')} placeholder="12-3456789" />
            </Field>
          </div>

          {/* Plan */}
          <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: '20px', marginBottom: 16 }}>
            <div style={{ fontSize: '0.68rem', color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Plan</div>
            <Field label="Selected Plan">
              <select style={{ ...FIELD, color: form.plan ? '#fff' : '#555' }} value={form.plan} onChange={set('plan')}>
                <option value="">— Select plan —</option>
                <option value="Launch Box — $97/mo">Launch Box — $97/mo</option>
                <option value="Rocket Box — $297/mo">Rocket Box — $297/mo</option>
                <option value="Velocity Box — $497/mo">Velocity Box — $497/mo</option>
                <option value="Founders Box — Custom">Founders Box — Custom</option>
              </select>
            </Field>
          </div>

          {/* Services */}
          <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: '20px', marginBottom: 16 }}>
            <div style={{ fontSize: '0.68rem', color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Services</div>
            <Field label="Services Offered">
              <textarea
                style={{ ...FIELD, minHeight: 80, resize: 'vertical', lineHeight: 1.5 }}
                value={form.services}
                onChange={set('services')}
                placeholder="Concrete coatings, epoxy floors, patio resurfacing…"
              />
            </Field>
          </div>

          {/* Review Links */}
          <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: '20px', marginBottom: 16 }}>
            <div style={{ fontSize: '0.68rem', color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Review Platform Links</div>
            <Field label="Google Reviews URL">
              <input style={FIELD} value={form.google_url} onChange={set('google_url')} placeholder="https://g.page/r/…" type="url" />
            </Field>
            <Field label="Yelp">
              <input style={FIELD} value={form.yelp_url} onChange={set('yelp_url')} placeholder="https://yelp.com/biz/…" type="url" />
            </Field>
            <Field label="Facebook">
              <input style={FIELD} value={form.facebook_url} onChange={set('facebook_url')} placeholder="https://facebook.com/…" type="url" />
            </Field>
            <Field label="Other">
              <input style={FIELD} value={form.other_review_url} onChange={set('other_review_url')} placeholder="HomeAdvisor, Angi, etc." type="url" />
            </Field>
          </div>

          {/* Notes */}
          <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: '20px', marginBottom: 24 }}>
            <div style={{ fontSize: '0.68rem', color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Notes</div>
            <Field label="Anything else Riley should know">
              <textarea
                style={{ ...FIELD, minHeight: 80, resize: 'vertical', lineHeight: 1.5 }}
                value={form.notes}
                onChange={set('notes')}
                placeholder="Special requests, timeline, how they heard about us…"
              />
            </Field>
          </div>

          {error && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: '#2a0a0a', border: '1px solid #4a1a1a', borderRadius: 4, color: '#E24B4A', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            style={{
              width: '100%', background: status === 'loading' ? '#888' : '#FFD000',
              color: '#000', border: 'none', borderRadius: 4,
              padding: '14px', fontWeight: 900, fontSize: '0.9rem',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              cursor: status === 'loading' ? 'default' : 'pointer',
            }}
          >
            {status === 'loading' ? 'Sending…' : 'Submit to Riley →'}
          </button>
        </form>
      </div>
    </div>
  );
}

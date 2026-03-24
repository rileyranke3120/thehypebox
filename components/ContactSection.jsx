'use client';
import { useState } from 'react';

export default function ContactSection() {
  const [name, setName] = useState('');
  const [question, setQuestion] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <section id="contact" className="section" style={{ background: '#0a0a0a' }}>
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <span className="tag">Get In Touch</span>
          <h2 style={{ marginTop: '16px' }}>Have a Question? Ask Us Anything.</h2>
          <p style={{ opacity: 0.6, marginTop: '12px' }}>
            Or call Alex directly. Our AI receptionist is available 24/7.
          </p>
          <a href="tel:+18563630633" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginTop: '20px', padding: '14px 28px', background: '#F5C400', color: '#000', fontWeight: '700', borderRadius: '8px', textDecoration: 'none', fontSize: '1.1rem' }}>
            Call Alex (856) 363-0633
          </a>
        </div>
        {!submitted ? (
          <form onSubmit={handleSubmit} style={{ maxWidth: '560px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required style={{ padding: '14px 18px', background: '#111', border: '1px solid #222', borderRadius: '8px', color: '#fff', fontSize: '1rem' }} />
            <textarea placeholder="What is your question?" value={question} onChange={(e) => setQuestion(e.target.value)} required rows={4} style={{ padding: '14px 18px', background: '#111', border: '1px solid #222', borderRadius: '8px', color: '#fff', fontSize: '1rem', resize: 'vertical' }} />
            <button type="submit" style={{ padding: '14px', background: '#F5C400', color: '#000', fontWeight: '700', border: 'none', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' }}>
              Send Question
            </button>
          </form>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <h3 style={{ color: '#F5C400' }}>Got it, {name}!</h3>
            <p style={{ opacity: 0.6, marginTop: '8px' }}>We will get back to you shortly. Or call Alex at (856) 363-0633.</p>
          </div>
        )}
      </div>
    </section>
  );
}

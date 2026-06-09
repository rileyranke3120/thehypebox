'use client';

import { useState } from 'react';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import mkt from '@/styles/marketing.module.css';
import s from '@/styles/niche.module.css';

const HOW_STEPS = [
  {
    num: '1',
    title: 'We Set Up Sarah',
    desc: 'We configure Sarah in your account and connect her to your existing calendar. Live in 48 hours — no tech knowledge needed.',
  },
  {
    num: '2',
    title: 'Sarah Answers Every Call',
    desc: '24 hours a day, 7 days a week. Sarah picks up, qualifies the job, and books the appointment directly on your calendar.',
  },
  {
    num: '3',
    title: 'Jobs Hit Your Calendar',
    desc: "You finish the job in front of you. Your next one is already booked, confirmed, and waiting.",
  },
];

export default function NicheLandingPage({ niche }) {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
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
        body: JSON.stringify({ ...form, niche: niche.slug }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'Something went wrong. Please try again.');
        setStatus('error');
      } else {
        setStatus('success');
      }
    } catch {
      setErrorMsg('Network error — please email riley@thehypeboxllc.com directly.');
      setStatus('error');
    }
  }

  const firstName = form.name.split(' ')[0];

  return (
    <div className={s.page}>
      <Nav />

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className={mkt.hero}>
        <div className="container">
          <div className={mkt.heroInner}>

            {/* Left — copy */}
            <div>
              <div className={mkt.heroEyebrow}>
                <span className="tag">{niche.eyebrow}</span>
              </div>
              <h1 className={mkt.heroHeadline}>
                {niche.headline} <em>{niche.headlineAccent}</em>
              </h1>
              <p className={mkt.heroSub}>{niche.sub}</p>
              <div className={mkt.heroActions}>
                <button
                  className="btn btn-primary"
                  onClick={() => { window.location.href = `/checkout?plan=rocket&niche=${encodeURIComponent(niche.slug)}`; }}
                >
                  Start Free Trial
                </button>
                <a href="#pricing" className="btn btn-ghost">See Pricing</a>
              </div>
              <div className={mkt.heroDemoBanner}>
                ✓ 14-day free trial &nbsp;·&nbsp; No contract &nbsp;·&nbsp; Setup in 48 hrs
              </div>
            </div>

            {/* Right — call demo terminal */}
            <div>
              <div className={s.liveBadge}>
                <span className={s.liveDot} />
                Live Call Demo
              </div>
              <div className={mkt.heroVisual}>
                <div className={mkt.terminalTitlebar}>
                  <span className={mkt.terminalDot} />
                  <span className={mkt.terminalDot} />
                  <span className={mkt.terminalDot} />
                  <span className={mkt.terminalTitle}>SARAH AI — INCOMING CALL</span>
                </div>
                <div className={mkt.terminalBody}>
                  {niche.callDemo.map((line, i) => {
                    if (line.type === 'ring') {
                      return <p key={i} className={mkt.terminalLineYellow}>{line.text}</p>;
                    }
                    if (line.type === 'dim') {
                      return <p key={i} className={mkt.terminalLineDim}>{line.text}</p>;
                    }
                    if (line.type === 'sarah') {
                      return (
                        <p key={i}>
                          <span className={mkt.terminalLineGreen}>SARAH &nbsp;</span>
                          {line.text}
                        </p>
                      );
                    }
                    if (line.type === 'caller') {
                      return (
                        <p key={i}>
                          <span className={mkt.terminalLineDim}>CALLER &nbsp;</span>
                          {line.text}
                        </p>
                      );
                    }
                    if (line.type === 'success') {
                      return <p key={i} className={mkt.terminalLineGreen}>{line.text}</p>;
                    }
                    return <p key={i}>{line.text}</p>;
                  })}
                  <span className={mkt.terminalCursor} />
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────── */}
      <div className={mkt.stats}>
        <div className="container">
          <div className={mkt.statsGrid} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {niche.stats.map(({ value, label }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div className={mkt.statsValue}>{value}</div>
                <div className={mkt.statsLabel}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Benefits ────────────────────────────────────────── */}
      <section className={s.benefitsSection}>
        <div className="container">
          <div className={mkt.sectionHeaderCenter}>
            <span className="tag">Built for {niche.tradeName}</span>
            <h2 style={{ marginTop: '1rem' }}>What Sarah Does For You</h2>
            <p style={{ marginTop: '0.75rem', maxWidth: '500px', margin: '0.75rem auto 0' }}>
              Sarah isn&apos;t a generic answering service. She knows {niche.tradeNameLower} jobs.
            </p>
          </div>
          <div className={s.benefitsGrid}>
            {niche.benefits.map((b, i) => (
              <div key={b.title} className={s.benefitCard}>
                <div className={s.benefitNum}>0{i + 1}</div>
                <div className={s.benefitTitle}>{b.title}</div>
                <p className={s.benefitDesc}>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────── */}
      <section className="section" style={{ background: '#0a0a0a' }}>
        <div className="container">
          <div className={mkt.sectionHeaderCenter}>
            <span className="tag">Simple Setup</span>
            <h2 style={{ marginTop: '1rem' }}>Up and Running in 48 Hours</h2>
          </div>
          <div className={mkt.howSteps}>
            {HOW_STEPS.map((step) => (
              <div key={step.num} className={mkt.step}>
                <div className={mkt.stepNum}>{step.num}</div>
                <h3 className={mkt.stepTitle}>{step.title}</h3>
                <p className={mkt.stepDesc}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonial ─────────────────────────────────────── */}
      {niche.testimonial && (
        <section style={{ background: '#000', padding: '4rem 0' }}>
          <div className="container" style={{ maxWidth: '640px' }}>
            <blockquote className={mkt.testimonialCard} style={{ margin: 0 }}>
              <p className={mkt.testimonialQuote}>&ldquo;{niche.testimonial.quote}&rdquo;</p>
              <div className={mkt.testimonialAuthor}>
                <div className={mkt.testimonialAvatar}>{niche.testimonial.name[0]}</div>
                <div>
                  <strong>{niche.testimonial.name}</strong>
                  <span>{niche.testimonial.company}</span>
                </div>
              </div>
            </blockquote>
          </div>
        </section>
      )}

      {/* ── Pricing ─────────────────────────────────────────── */}
      <section id="pricing" className={s.pricingSection}>
        <div className="container">
          <div className={mkt.sectionHeaderCenter}>
            <span className="tag">Pricing</span>
            <h2 style={{ marginTop: '1rem' }}>Simple, Transparent Pricing</h2>
            <p style={{ marginTop: '0.75rem' }}>14-day free trial. No contracts. Cancel anytime.</p>
          </div>

          <div className={s.pricingGrid}>

            {/* Launch Box */}
            <div className={mkt.pricingCard}>
              <p className={mkt.pricingCardTier}>The Launch Box</p>
              <p className={mkt.pricingCardTagline}>Everything you need to stop missing calls and losing jobs</p>
              <div className={mkt.pricingCardPrice}><sup>$</sup>97</div>
              <p className={mkt.pricingCardPeriod}>per month · cancel anytime</p>
              <ul className={mkt.pricingCardFeatures}>
                {niche.launchFeatures.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <button
                className="btn btn-ghost"
                onClick={() => { window.location.href = `/checkout?plan=launch&niche=${encodeURIComponent(niche.slug)}`; }}
                style={{ width: '100%', justifyContent: 'center', marginTop: 'auto' }}
              >
                Start Free Trial
              </button>
              <p className={mkt.pricingCardTrialNote}>14 days free, then $97/mo</p>
            </div>

            {/* Rocket Box */}
            <div className={`${mkt.pricingCard} ${mkt.pricingCardFeatured}`}>
              <div className={mkt.pricingCardBadge}>Most Popular</div>
              <p className={mkt.pricingCardTier}>The Rocket Box</p>
              <p className={mkt.pricingCardTagline}>Full AI automation for contractors who want to grow fast</p>
              <div className={mkt.pricingCardPrice}><sup>$</sup>297</div>
              <p className={mkt.pricingCardPeriod}>per month · cancel anytime</p>
              <ul className={mkt.pricingCardFeatures}>
                {niche.rocketFeatures.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <button
                className="btn btn-primary"
                onClick={() => { window.location.href = `/checkout?plan=rocket&niche=${encodeURIComponent(niche.slug)}`; }}
                style={{ width: '100%', justifyContent: 'center', marginTop: 'auto' }}
              >
                Start Free Trial
              </button>
              <p className={mkt.pricingCardTrialNote}>14 days free, then $297/mo</p>
            </div>

          </div>
        </div>
      </section>

      {/* ── Contact Form ────────────────────────────────────── */}
      <section id="contact" className={s.contactSection}>
        <div className="container">
          <div className={mkt.sectionHeaderCenter}>
            <span className="tag">Get Started</span>
            <h2 style={{ marginTop: '1rem' }}>Questions? Let&apos;s Talk.</h2>
            <p style={{ marginTop: '0.75rem' }}>
              We work with {niche.tradeNameLower} contractors across the country. We respond fast.
            </p>
          </div>

          <div className={s.contactGrid}>

            {/* Contact info */}
            <div>
              <h3 className={s.contactInfoHeading}>Reach Us Directly</h3>
              <div className={s.contactDetailList}>
                <div>
                  <p className={s.contactDetailLabel}>Phone</p>
                  <a href="tel:+18444973663" className={s.contactDetailValue}>(844) 4-HYPE-ME</a>
                </div>
                <div>
                  <p className={s.contactDetailLabel}>Email</p>
                  <a href="mailto:riley@thehypeboxllc.com" className={s.contactDetailValue}>
                    riley@thehypeboxllc.com
                  </a>
                </div>
              </div>
            </div>

            {/* Form */}
            <div>
              {status === 'success' ? (
                <div className={s.successBox}>
                  <span className={s.successCheck}>✓</span>
                  <h3>Got it, {firstName || 'friend'}!</h3>
                  <p style={{ marginTop: '0.5rem' }}>We&apos;ll be in touch within 24 hours.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className={s.formStack}>
                  <div className={s.formRow}>
                    <input
                      type="text"
                      placeholder="Your name"
                      value={form.name}
                      onChange={update('name')}
                      required
                      className={s.formInput}
                    />
                    <input
                      type="email"
                      placeholder="Email address"
                      value={form.email}
                      onChange={update('email')}
                      required
                      className={s.formInput}
                    />
                  </div>
                  <textarea
                    placeholder={`Tell us about your ${niche.tradeNameLower} business…`}
                    value={form.message}
                    onChange={update('message')}
                    rows={4}
                    className={s.formInput}
                    style={{ resize: 'vertical' }}
                  />
                  {status === 'error' && (
                    <p className={s.formError}>⚠ {errorMsg}</p>
                  )}
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className={`btn btn-primary ${s.formSubmitBtn}`}
                    style={{ opacity: status === 'loading' ? 0.6 : 1 }}
                  >
                    {status === 'loading' ? 'Sending…' : 'Send Message'}
                  </button>
                  <p className={s.formNote}>We respond within 24 hours.</p>
                </form>
              )}
            </div>

          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

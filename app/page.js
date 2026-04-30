import Script from 'next/script';
import Image from 'next/image';
import Nav from '@/components/Nav';
import HeroPreview from '@/components/HeroPreview';
import StatsBar from '@/components/StatsBar';
import AgentCard from '@/components/AgentCard';
import PricingSection from '@/components/PricingSection';
import BookingSection from '@/components/BookingSection';
import ContactSection from '@/components/ContactSection';
import Footer from '@/components/Footer';
import styles from '@/styles/marketing.module.css';

export default function Home() {
  const features = [
    {
      icon: (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '12px', background: '#0D1F35', display: 'block' }}>
          <rect x="14" y="16" width="36" height="32" rx="3" stroke="#378ADD" strokeWidth="2" fill="none"/>
          <line x1="14" y1="24" x2="50" y2="24" stroke="#378ADD" strokeWidth="1.5" opacity="0.5"/>
          <circle cx="22" cy="33" r="4" stroke="#378ADD" strokeWidth="1.5" fill="none"/>
          <line x1="28" y1="31" x2="42" y2="31" stroke="#378ADD" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
          <line x1="28" y1="35" x2="38" y2="35" stroke="#378ADD" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
        </svg>
      ),
      title: 'CRM',
      description: 'Manage all your contacts, leads, and clients in one place.',
      features: [
        'Full contact & lead management',
        'Deal pipeline tracking',
        'Notes, tags & history',
        'Activity timeline',
      ],
    },
    {
      icon: (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '12px', background: '#0D2018', display: 'block' }}>
          <path d="M14 20 C14 17.8 15.8 16 18 16 L46 16 C48.2 16 50 17.8 50 20 L50 35 C50 37.2 48.2 39 46 39 L30 39 L22 46 L22 39 C15.8 39 14 37.2 14 35 Z" stroke="#1D9E75" strokeWidth="2" fill="none" strokeLinejoin="round"/>
          <circle cx="26" cy="27.5" r="2" fill="#1D9E75"/>
          <circle cx="32" cy="27.5" r="2" fill="#1D9E75"/>
          <circle cx="38" cy="27.5" r="2" fill="#1D9E75"/>
        </svg>
      ),
      title: 'Communication',
      description: 'Text, email, calls, and social messages—all in one unified inbox.',
      features: [
        'Unified inbox for all channels',
        'Two-way SMS & email',
        'Social DM integration',
        'Call tracking & recording',
      ],
    },
    {
      icon: (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '12px', background: '#1A1500', display: 'block' }}>
          <path d="M36 12 L22 34 L31 34 L28 52 L42 30 L33 30 Z" fill="#F5C400"/>
        </svg>
      ),
      title: 'Automation',
      description: 'Instant responses, follow-ups, and reminders working 24/7.',
      features: [
        'Instant lead response',
        'Follow-up sequences',
        'Appointment reminders',
        'Review request automation',
      ],
    },
    {
      icon: (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '12px', background: '#160D2A', display: 'block' }}>
          <circle cx="32" cy="28" r="10" stroke="#7B2FFF" strokeWidth="2" fill="none"/>
          <path d="M26 28 C26 24.7 28.7 22 32 22 C35.3 22 38 24.7 38 28" stroke="#7B2FFF" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          <circle cx="32" cy="28" r="3" fill="#7B2FFF" opacity="0.6"/>
          <path d="M22 42 C22 38 26.5 36 32 36 C37.5 36 42 38 42 42" stroke="#7B2FFF" strokeWidth="2" fill="none" strokeLinecap="round"/>
        </svg>
      ),
      title: 'AI Integration',
      description: 'Smart replies and lead handling without lifting a finger.',
      features: [
        'AI-powered responses',
        '24/7 lead qualification',
        'Trained on your business',
        'Hands-free follow-up',
      ],
    },
    {
      icon: (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '12px', background: '#0D1A12', display: 'block' }}>
          <rect x="14" y="14" width="36" height="36" rx="3" stroke="#1D9E75" strokeWidth="2" fill="none"/>
          <line x1="14" y1="24" x2="50" y2="24" stroke="#1D9E75" strokeWidth="1.5" opacity="0.5"/>
          <line x1="25" y1="14" x2="25" y2="20" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round"/>
          <line x1="39" y1="14" x2="39" y2="20" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round"/>
          <rect x="20" y="29" width="8" height="7" rx="1" fill="#1D9E75" opacity="0.5"/>
          <rect x="32" y="29" width="8" height="7" rx="1" fill="#1D9E75" opacity="0.8"/>
          <rect x="20" y="39" width="8" height="5" rx="1" fill="#1D9E75" opacity="0.3"/>
        </svg>
      ),
      title: 'Scheduling',
      description: 'Let clients book appointments without the back-and-forth.',
      features: [
        'Self-serve booking page',
        'Calendar sync',
        'Automated confirmations',
        'Rescheduling & reminders',
      ],
    },
  ];

  return (
    <>
      <Script src="https://api.leadconnectorhq.com/js/form_embed.js" strategy="afterInteractive" />
      <Nav />
      <main>
        <HeroPreview />
        <StatsBar />

        {/* PROBLEM → SOLUTION */}
        <section id="problem" className="section" aria-labelledby="solution-heading">
          <div className="container">
            <div className={styles.problemSolution}>
              <div className={styles.problems}>
                <span className="tag">The Problem</span>
                <ul className={styles.problemList}>
                  <li>Missed calls = lost money</li>
                  <li>Messages scattered across platforms</li>
                  <li>Slow follow-ups costing you clients</li>
                  <li>Too many tools, not enough control</li>
                </ul>
              </div>
              <div className={styles.mascotColumn}>
                <Image
                  src="/mascot.png"
                  alt="The Hype Box mascot"
                  width={180}
                  height={220}
                  style={{ width: '180px', height: 'auto', transform: 'scaleX(-1)', display: 'block' }}
                />
              </div>
              <div className={styles.solutionBlock}>
                <span className="tag">The Solution</span>
                <h2 id="solution-heading">Everything.<br />In One Place.</h2>
                <p>The Hype Box brings your entire business into one system—so you never miss a lead, message, or opportunity again. From first contact to final payment, everything runs smoother, faster, and smarter.</p>
                <ul className={styles.solutionList}>
                  <li>One inbox for every message</li>
                  <li>Every lead captured and followed up</li>
                  <li>Instant responses, around the clock</li>
                  <li>Full visibility from one dashboard</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CORE FEATURES */}
        <section id="services" className="section" aria-labelledby="features-heading">
          <div className="container">
            <div className={styles.sectionHeaderCenter}>
              <span className="tag">Tools</span>
              <h2 id="features-heading">Powerful Tools. One System.</h2>
            </div>
            <div className={styles.featuresGrid}>
              {features.map((feature, i) => (
                <AgentCard key={i} {...feature} />
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="section" aria-labelledby="how-heading">
          <div className="container">
            <div className={styles.sectionHeaderCenter}>
              <span className="tag">How It Works</span>
              <h2 id="how-heading">Simple. Fast. Powerful.</h2>
              <p style={{ marginTop: '0.75rem', fontSize: '1rem', color: 'var(--yellow)', fontWeight: 700 }}>Start your free 14-day trial — up and running in under an hour.</p>
            </div>
            <div className={styles.howSteps}>
              <div className={styles.step}>
                <div className={styles.stepNum} aria-hidden="true">01</div>
                <h3 className={styles.stepTitle}>Start Your Free Trial</h3>
                <p className={styles.stepDesc}>No credit card needed. We set up your system and bring everything into one place — same day.</p>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNum} aria-hidden="true">02</div>
                <h3 className={styles.stepTitle}>Automations Go Live</h3>
                <p className={styles.stepDesc}>Your business starts responding, booking, and following up instantly — 24/7, even while you&apos;re on the job.</p>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNum} aria-hidden="true">03</div>
                <h3 className={styles.stepTitle}>Grow Without the Chaos</h3>
                <p className={styles.stepDesc}>Capture more leads, close more deals, and stay in control. Keep it if it works — cancel anytime if it doesn&apos;t.</p>
              </div>
            </div>
          </div>
        </section>

        <PricingSection />

        {/* FINAL CTA */}
        <section className={styles.ctaBand} aria-labelledby="cta-heading">
          <div className="container">
            <h2 id="cta-heading">Stop Missing Opportunities</h2>
            <p style={{ color: 'var(--grey-300)', marginTop: '1rem', maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto', fontSize: '1rem' }}>
              Your next customer is already reaching out. Start your free 14-day trial and make sure you&apos;re ready to respond.
            </p>
            <div className={styles.ctaBandActions}>
              <a href="#contact" className="btn btn-primary">Start Free Trial</a>
              <a href="/demo" className="btn btn-ghost">View Live Demo</a>
            </div>
            <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--grey-500)' }}>No credit card required · Cancel anytime</p>
          </div>
        </section>

        {/* ABOUT / MISSION */}
        <section id="about" className="section" style={{ background: '#0a0a0a' }}>
          <div className="container">
            <div className={styles.sectionHeaderCenter}>
              <span className="tag">Who We Are</span>
              <h2>Real AI. Real People. Real Results.</h2>
            </div>
            <div className={styles.aboutGrid}>
              <div className={styles.aboutBlock}>
                <h3>Our Mission</h3>
                <p>TheHypeBox exists to level the playing field for local businesses. We build and run AI automation systems that give small business owners the same tools used by Fortune 500 companies — at a price that actually makes sense.</p>
              </div>
              <div className={styles.aboutBlock}>
                <h3>Who We Help</h3>
                <p>We work with local service businesses — plumbers, HVAC, electricians, roofers, salons, auto shops, restaurants, and more. If you're running a business and losing leads because you can't answer every call, we fix that.</p>
              </div>
              <div className={styles.aboutBlock}>
                <h3>How We're Different</h3>
                <p>We don't just hand you software and walk away. We build your system, configure your AI, and stay with you. US-based support. No long-term contracts. Cancel anytime.</p>
              </div>
            </div>
          </div>
        </section>

        <ContactSection />
        <BookingSection />
      </main>
      <Footer />
    </>
  );
}

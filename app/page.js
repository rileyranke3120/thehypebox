import Nav from '@/components/Nav';
import HeroPreview from '@/components/HeroPreview';
import StatsBar from '@/components/StatsBar';
import AgentCard from '@/components/AgentCard';
import BookingSection from '@/components/BookingSection';
import Footer from '@/components/Footer';
import styles from '@/styles/marketing.module.css';

export default function Home() {
  const agents = [
    {
      icon: (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '12px', background: '#0D1F35', display: 'block' }}>
          <path d="M32 18 Q32 18 32 18" stroke="none"/>
          <path d="M24 24 Q32 16 40 24" stroke="#378ADD" strokeWidth="2" strokeLinecap="round" fill="none"/>
          <path d="M20 20 Q32 10 44 20" stroke="#378ADD" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.55"/>
          <path d="M22 34 C21 37 22 41 26 43 C26 43 28 44 30 43 L33 40 C33.8 39.2 33.8 38 33 37.2 L31.5 35.7 C31 35.2 31 34.4 31.5 33.9 L34.9 30.5 C35.4 30 36.2 30 36.7 30.5 L38.2 32 C39 32.8 40.2 32.8 41 32 L44 29 C44.8 28.2 44.8 27 44 26.2 C42 24.2 38 23 35 24 C32 25 23 31 22 34 Z" stroke="#378ADD" strokeWidth="1.8" fill="none" strokeLinejoin="round"/>
        </svg>
      ),
      title: 'AI Receptionist',
      description: 'A 24/7 AI that answers every call, handles your FAQs, captures leads, and takes messages — trained on your business.',
      features: [
        'Never miss a call again',
        'Custom scripts for your business',
        'After-hours message capture',
        'Call summaries to your inbox',
      ],
    },
    {
      icon: (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '12px', background: '#0D2018', display: 'block' }}>
          <path d="M14 20 C14 17.8 15.8 16 18 16 L46 16 C48.2 16 50 17.8 50 20 L50 38 C50 40.2 48.2 42 46 42 L26 42 L18 50 L18 42 C15.8 42 14 40.2 14 38 Z" stroke="#1D9E75" strokeWidth="2" fill="none" strokeLinejoin="round"/>
          <circle cx="25" cy="29" r="2.2" fill="#1D9E75"/>
          <circle cx="32" cy="29" r="2.2" fill="#1D9E75"/>
          <circle cx="39" cy="29" r="2.2" fill="#1D9E75"/>
        </svg>
      ),
      title: 'Website Chatbot',
      description: 'An AI chat widget on your website that engages visitors, answers questions, and books appointments while you work.',
      features: [
        'Live on your site in 24 hours',
        'Appointment booking built in',
        'Lead capture & qualification',
        'Trained on your services & prices',
      ],
    },
    {
      icon: (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '12px', background: '#1A1500', display: 'block' }}>
          <path d="M36 12 L22 34 L31 34 L28 52 L42 30 L33 30 Z" fill="#F5C400"/>
        </svg>
      ),
      title: 'Lead Follow-Up',
      description: 'Automated SMS and email sequences that follow up with new leads and bring old customers back — on autopilot.',
      features: [
        'Instant follow-up on new leads',
        'Re-engagement for past customers',
        'Appointment reminders',
        'Review request automation',
      ],
    },
    {
      icon: (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '12px', background: '#160D2A', display: 'block' }}>
          <rect x="12" y="14" width="40" height="36" rx="4" stroke="#7B2FFF" strokeWidth="2"/>
          <rect x="18" y="20" width="28" height="6" rx="2" stroke="#7B2FFF" strokeWidth="1.5"/>
          <circle cx="21" cy="23" r="1.2" fill="#7B2FFF"/>
          <circle cx="25" cy="23" r="1.2" fill="#7B2FFF"/>
          <circle cx="29" cy="23" r="1.2" fill="#7B2FFF"/>
          <line x1="12" y1="30" x2="52" y2="30" stroke="#7B2FFF" strokeWidth="1.5"/>
          <line x1="18" y1="36" x2="36" y2="36" stroke="#7B2FFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
          <line x1="18" y1="41" x2="30" y2="41" stroke="#7B2FFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
          <path d="M40 36 L40 44 L42.5 41.5 L44.5 45 L45.5 44.5 L43.5 41 L47 41 Z" fill="#7B2FFF"/>
        </svg>
      ),
      title: 'Website Build',
      description: 'We build and launch a fast, professional website for your business — ready to convert visitors into paying customers.',
      features: [
        'Mobile-first design',
        'SEO-ready from day one',
        'Chatbot integrated at launch',
        'Included in your setup fee',
      ],
    },
  ];

  return (
    <>
      <Nav />
      <main>
        <HeroPreview />
        <StatsBar />

        {/* SERVICES */}
        <section id="services" className="section" aria-labelledby="services-heading">
          <div className="container">
            <div className={styles.sectionHeader}>
              <span className="tag">What We Build</span>
              <h2 id="services-heading">Four Services.<br />One Flat Price.</h2>
              <p>Everything a local business needs to stop missing leads and start running on autopilot.</p>
            </div>
            <div className={styles.agentsGrid}>
              {agents.map((agent, i) => (
                <AgentCard key={i} {...agent} />
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="section" aria-labelledby="how-heading">
          <div className="container">
            <div className={styles.sectionHeaderCenter}>
              <span className="tag">Setup</span>
              <h2 id="how-heading">Live in 15 Minutes</h2>
              <p>No technical setup. No lengthy onboarding. Just three steps.</p>
            </div>
            <div className={styles.howSteps}>
              <div className={styles.step}>
                <div className={styles.stepNum} aria-hidden="true">01</div>
                <h3 className={styles.stepTitle}>Connect Your Business</h3>
                <p className={styles.stepDesc}>Link your calendar, phone number, and billing tools. We support the most common platforms out of the box.</p>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNum} aria-hidden="true">02</div>
                <h3 className={styles.stepTitle}>Train Your Agents</h3>
                <p className={styles.stepDesc}>Tell the agents about your business — hours, services, pricing, and common questions. Takes under 10 minutes.</p>
              </div>
              <div className={styles.step}>
                <div className={styles.stepNum} aria-hidden="true">03</div>
                <h3 className={styles.stepTitle}>Go Live</h3>
                <p className={styles.stepDesc}>Flip the switch and your agents are on the job. Monitor everything from your dashboard in real time.</p>
              </div>
            </div>
          </div>
        </section>

        <BookingSection />
      </main>
      <Footer />
    </>
  );
}

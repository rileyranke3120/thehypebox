import styles from '@/styles/marketing.module.css';

export default function BookingSection() {
  return (
    <section id="booking" className="section" aria-labelledby="booking-heading">
      <div className="container">
        <div className={styles.sectionHeaderCenter}>
          <span className="tag">Book a Call</span>
          <h2 id="booking-heading">Schedule Your Free Estimate</h2>
          <p>Pick a time that works for you. 30 minutes, no commitment, no pressure.</p>
        </div>

        <div style={{
          background: 'var(--grey-900)',
          border: '1px solid var(--grey-700)',
          borderRadius: 'var(--radius)',
          height: '550px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          maxWidth: '800px',
          margin: '3rem auto 0',
        }}>
          <div style={{
            width: '64px', height: '64px',
            borderRadius: '50%',
            background: 'rgba(245,196,0,.1)',
            border: '2px solid var(--yellow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="18" rx="3" stroke="#F5C400" strokeWidth="2"/>
              <line x1="3" y1="9" x2="21" y2="9" stroke="#F5C400" strokeWidth="2"/>
              <line x1="8" y1="2" x2="8" y2="6" stroke="#F5C400" strokeWidth="2" strokeLinecap="round"/>
              <line x1="16" y1="2" x2="16" y2="6" stroke="#F5C400" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="8" cy="14" r="1.5" fill="#F5C400"/>
              <circle cx="12" cy="14" r="1.5" fill="#F5C400"/>
              <circle cx="16" cy="14" r="1.5" fill="#F5C400"/>
              <circle cx="8" cy="18" r="1.5" fill="#F5C400"/>
              <circle cx="12" cy="18" r="1.5" fill="#F5C400"/>
            </svg>
          </div>
          <p style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.1rem',
            fontWeight: '700',
            color: 'var(--white)',
            letterSpacing: '.06em',
            textTransform: 'uppercase',
          }}>Calendar Coming Soon</p>
          <p style={{
            fontSize: '0.8rem',
            color: 'var(--grey-300)',
            textAlign: 'center',
            maxWidth: '320px',
            lineHeight: '1.7',
          }}>Online booking will be available here shortly. In the meantime click below to reach us directly.</p>
          <a href="mailto:barry@thehypebox.com?subject=Free Estimate Request" className="btn btn-primary">Schedule via Email →</a>
        </div>
      </div>
    </section>
  );
}

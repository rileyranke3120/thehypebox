import styles from '@/styles/marketing.module.css';

const LaunchIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <rect x="1" y="1" width="26" height="26" rx="5" stroke="#FFD000" strokeWidth="2"/>
    <path d="M14 20V8M9 13l5-5 5 5" stroke="#FFD000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const RocketIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path d="M14 3s-7 5-7 11v3l3 3h8l3-3v-3C21 8 14 3 14 3z" stroke="#378ADD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="14" cy="12" r="2" stroke="#378ADD" strokeWidth="1.5"/>
    <path d="M11 20v1.5a3 3 0 006 0V20" stroke="#378ADD" strokeWidth="2"/>
    <path d="M5 16a2.5 2.5 0 00-2 2.5l2 2.5M23 16a2.5 2.5 0 012 2.5l-2 2.5" stroke="#378ADD" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const VelocityIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path d="M17 3L7 16h8l-4 9L25 12h-9l3-9z" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const FoundersIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <path d="M4 20l3.5-10 6.5 5 6.5-5L24 20H4z" stroke="#7B2FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="4" y1="20" x2="24" y2="20" stroke="#7B2FFF" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="4" cy="10" r="1.5" fill="#7B2FFF"/>
    <circle cx="14" cy="6" r="1.5" fill="#7B2FFF"/>
    <circle cx="24" cy="10" r="1.5" fill="#7B2FFF"/>
  </svg>
);

const PLANS = [
  {
    name: 'Launch Box',
    Icon: LaunchIcon,
    iconColor: '#FFD000',
    tagline: 'Start strong with the essentials',
    price: '97',
    period: '/mo',
    features: [
      'CRM + contact management',
      'Website + hosting',
      'Unified inbox (text, email, social)',
      'Basic automation (instant responses)',
      'Appointment scheduling',
    ],
    cta: 'Start Here',
    featured: false,
  },
  {
    name: 'Rocket Box',
    Icon: RocketIcon,
    iconColor: '#378ADD',
    tagline: 'Grow faster with more firepower',
    price: '297',
    period: '/mo',
    features: [
      'Everything in Launch Box',
      'Advanced automation workflows',
      'Lead capture funnels',
      'AI-assisted responses',
      'Review & reputation tools',
    ],
    cta: 'Start Growing',
    featured: false,
  },
  {
    name: 'Velocity Box',
    Icon: VelocityIcon,
    iconColor: '#1D9E75',
    tagline: 'Full automation, full speed ahead',
    price: '497',
    period: '/mo',
    badge: 'Most Popular',
    features: [
      'Everything in Rocket Box',
      'AI phone receptionist',
      'Full pipeline tracking',
      'Team access + workflows',
      'Priority support',
    ],
    cta: 'Go Full Speed',
    featured: true,
  },
  {
    name: 'Founders Box',
    Icon: FoundersIcon,
    iconColor: '#7B2FFF',
    tagline: 'Go all in. Run your business like an empire.',
    callPrice: true,
    features: [
      'Everything in Velocity Box',
      'Custom AI agent build-out',
      'Deep analytics & reporting',
      'Dedicated account manager',
      'White-glove onboarding',
    ],
    cta: 'Go All In',
    featured: false,
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="section" aria-labelledby="pricing-heading">
      <div className="container">
        <div className={styles.sectionHeaderCenter}>
          <span className="tag">Pricing</span>
          <h2 id="pricing-heading">Choose Your Level</h2>
        </div>

        <div className={styles.pricingGrid}>
          {PLANS.map((plan) => {
            const { Icon } = plan;
            return (
              <div
                key={plan.name}
                className={`${styles.pricingCard}${plan.featured ? ' ' + styles.pricingCardFeatured : ''}`}
              >
                {plan.badge && (
                  <div className={styles.pricingCardBadge}>{plan.badge}</div>
                )}
                <div className={styles.pricingCardIcon} style={{ color: plan.iconColor }}>
                  <Icon />
                </div>
                <div className={styles.pricingCardTier}>{plan.name}</div>
                <p className={styles.pricingCardTagline}>{plan.tagline}</p>
                <div className={styles.pricingCardPrice}>
                  {plan.callPrice ? (
                    <span style={{ fontSize: '1.75rem' }}>Reach Out</span>
                  ) : (
                    <><sup>$</sup>{plan.price}</>
                  )}
                </div>
                {!plan.callPrice && (
                  <div className={styles.pricingCardPeriod}>{plan.period}</div>
                )}
                <ul className={styles.pricingCardFeatures} style={{ marginTop: plan.callPrice ? '1.5rem' : undefined }}>
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <a href="#booking" className={`btn ${plan.featured ? 'btn-primary' : 'btn-ghost'}`}>
                  {plan.cta}
                </a>
              </div>
            );
          })}
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--grey-500)', marginTop: '2rem', letterSpacing: '0.05em' }}>
          No contracts · No hidden fees · Cancel anytime
        </p>
      </div>
    </section>
  );
}

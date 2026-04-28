import styles from '@/styles/marketing.module.css';

const PLANS = [
  {
    name: 'Launch Box',
    emoji: '🟢',
    tagline: 'Start strong with the essentials',
    price: '397',
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
    name: 'Velocity Box',
    emoji: '🔵',
    tagline: 'Automate and grow faster',
    price: '697',
    period: '/mo',
    badge: 'Most Popular',
    features: [
      'Everything in Launch Box',
      'Advanced automation workflows',
      'Lead capture funnels',
      'AI-assisted responses',
      'Review & reputation tools',
    ],
    cta: 'Upgrade Your System',
    featured: true,
  },
  {
    name: 'Founders Box',
    emoji: '🟡',
    tagline: 'Run your business like an empire',
    callPrice: true,
    features: [
      'Everything in Velocity Box',
      'Full AI lead handling',
      'Advanced pipeline tracking',
      'Team access + workflows',
      'Deep analytics & reporting',
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
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`${styles.pricingCard}${plan.featured ? ' ' + styles.pricingCardFeatured : ''}`}
            >
              {plan.badge && (
                <div className={styles.pricingCardBadge}>{plan.badge}</div>
              )}
              <div className={styles.pricingCardTier}>
                {plan.name} <span style={{ fontSize: '1rem', letterSpacing: 0 }}>{plan.emoji}</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--grey-300)', margin: '0.5rem 0 0', lineHeight: 1.5 }}>
                {plan.tagline}
              </p>
              <div className={styles.pricingCardPrice}>
                {plan.callPrice ? (
                  <span style={{ fontSize: '2rem' }}>Book a Call</span>
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
          ))}
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--grey-500)', marginTop: '2rem', letterSpacing: '0.05em' }}>
          No contracts · No hidden fees · Cancel anytime
        </p>
      </div>
    </section>
  );
}

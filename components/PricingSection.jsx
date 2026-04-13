import styles from '@/styles/marketing.module.css';

const PLANS = [
  {
    tier: 'Starter',
    price: '297',
    period: 'per month',
    description: 'Everything you need to stop missing leads.',
    features: [
      'AI Phone Receptionist (24/7)',
      'Missed Call Text Back',
      'Review Request Automation',
      'Appointment Scheduling Agent',
      'Client Dashboard',
      'US-Based Support',
    ],
    cta: 'Get Started',
    featured: false,
  },
  {
    tier: 'Growth',
    price: '497',
    period: 'per month',
    badge: 'Most Popular',
    description: 'Automated follow-up that brings customers back.',
    features: [
      'Everything in Starter',
      'Lead Reactivation Campaigns',
      'Lead Generation & Nurturing',
      'Website Chatbot',
      'Priority Support',
    ],
    cta: 'Get Started',
    featured: true,
  },
  {
    tier: 'Pro',
    price: '797',
    period: 'per month',
    description: 'Full-stack automation with a website included.',
    features: [
      'Everything in Growth',
      'CRM & Contact Management',
      'AI Accounting Agent',
      'Custom Website Build',
      'Dedicated Account Manager',
    ],
    cta: 'Get Started',
    featured: false,
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="section" aria-labelledby="pricing-heading">
      <div className="container">
        <div className={styles.sectionHeaderCenter}>
          <span className="tag">Pricing</span>
          <h2 id="pricing-heading">Simple, Flat-Rate Plans</h2>
          <p>No contracts. No hidden fees. Cancel anytime. One-time setup fee applies.</p>
        </div>

        <div className={styles.pricingGrid}>
          {PLANS.map((plan) => (
            <div
              key={plan.tier}
              className={`${styles.pricingCard}${plan.featured ? ' ' + styles.pricingCardFeatured : ''}`}
            >
              {plan.badge && (
                <div className={styles.pricingCardBadge}>{plan.badge}</div>
              )}
              <div className={styles.pricingCardTier}>{plan.tier}</div>
              <div className={styles.pricingCardPrice}>
                <sup>$</sup>{plan.price}
              </div>
              <div className={styles.pricingCardPeriod}>{plan.period}</div>
              <p style={{ fontSize: '0.78rem', color: 'var(--grey-300)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                {plan.description}
              </p>
              <ul className={styles.pricingCardFeatures}>
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
          All plans include a one-time setup fee · Custom enterprise pricing available · Book a call to discuss your needs
        </p>
      </div>
    </section>
  );
}

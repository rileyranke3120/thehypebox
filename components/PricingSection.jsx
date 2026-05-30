'use client';

import Image from 'next/image';
import styles from '@/styles/pricing.module.css';
import TrialButton from './TrialButton';

// ── Custom plan header icons (generated, color-matched per plan) ──

const LaunchIcon = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
    <line x1="3" y1="22" x2="23" y2="22" stroke="#FFD000" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="6" y1="22" x2="6" y2="16" stroke="#FFD000" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="20" y1="22" x2="20" y2="16" stroke="#FFD000" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M13 4L9 14H13.5V16H12.5L13 18L13.5 16H12.5V14H17Z" fill="#FFD000"/>
    <path d="M13 4L9 14L13 12.5L17 14Z" fill="#FFD000" stroke="#FFD000" strokeWidth="0.5" strokeLinejoin="round"/>
    <path d="M11 18L13 21L15 18" fill="#FF8800" stroke="none"/>
  </svg>
);

const BoosterIcon = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
    <path d="M15 2L6 14H12.5L10.5 24L20 12H13.5L15 2Z" fill="#378ADD" strokeLinejoin="round"/>
    <line x1="2" y1="9" x2="6" y2="9" stroke="#378ADD" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
    <line x1="2" y1="13" x2="5" y2="13" stroke="#378ADD" strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
    <line x1="2" y1="17" x2="6" y2="17" stroke="#378ADD" strokeWidth="1" strokeLinecap="round" opacity="0.25"/>
  </svg>
);

const RocketBoxIcon = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
    <path d="M13 2C13 2 8 7 8 14V17L10 19H16L18 17V14C18 7 13 2 13 2Z" fill="#1D9E75" strokeLinejoin="round"/>
    <circle cx="13" cy="12" r="2.5" stroke="#000" strokeWidth="1.2" fill="rgba(0,0,0,0.4)"/>
    <path d="M10 19L9 23L13 21L17 23L16 19" fill="#FF5500"/>
    <path d="M8 14L5 16L8 18" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    <path d="M18 14L21 16L18 18" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
  </svg>
);


// ── Plan data ─────────────────────────────────────────────────
const PLANS = [
  {
    slug: 'launch',
    name: 'The Launch Box',
    monthly: 97,
    annual: 932,
    savings: 232,
    discount: '20% OFF',
    Icon: LaunchIcon,
    features: [
      'CRM + Contact Management',
      'Website + Hosting',
      'Unified Inbox (Text, Email, Social)',
      'Basic Automation (Instant Responses)',
      'Appointment Scheduling',
    ],
  },
  {
    slug: 'rocket',
    name: 'The Rocket Box',
    monthly: 297,
    annual: 2673,
    savings: 891,
    discount: '25% OFF',
    featured: true,
    Icon: BoosterIcon,
    features: [
      'Everything In The Launch Box',
      'Advanced Automation Workflows',
      'Lead Capture Funnels',
      'AI-Assisted Responses',
      'Review & Reputation Tools',
    ],
  },
  {
    slug: 'velocity',
    name: 'The Velocity Box',
    monthly: 497,
    annual: 4175,
    savings: 1790,
    discount: '30% OFF',
    Icon: RocketBoxIcon,
    features: [
      'Everything In The Rocket Box',
      'AI Phone Receptionist',
      'Full Pipeline Tracking',
      'Team Access + Workflows',
      'Priority Support',
    ],
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className={styles.section} aria-labelledby="pricing-heading">

      {/* Logo above pricing cards */}
      <div className={styles.logoRow} aria-hidden="true">
        <Image
          src="/hype-box-logo.png"
          alt="TheHypeBox"
          width={800}
          height={300}
          className={styles.logoImage}
          priority
        />
      </div>

      {/* Mission Control image — fades directly into pricing cards */}
      <div className={styles.imageHero} aria-hidden="true" />

      {/* Pricing cards */}
      <div className={styles.cardsArea}>
        <div className={styles.grid}>
          {PLANS.map(({ Icon, ...plan }) => (
            <div key={plan.slug} className={`${styles.card} ${plan.featured ? styles.cardFeatured : ''}`}>
              {plan.featured && <div className={styles.cardBadge}>Most Popular</div>}

              {/* Plan name with custom icon — no numbers, no labels */}
              <div className={styles.cardHeader}>
                <Icon />
                <span className={styles.cardName}>{plan.name.toUpperCase()}</span>
              </div>

              <div className={styles.priceRow}>
                <div className={styles.priceLeft}>
                  <span className={styles.priceDollar}>$</span>
                  <span className={styles.priceAmount}>{plan.monthly}</span>
                  <span className={styles.pricePer}>/mo</span>
                </div>
                <div className={styles.priceBadge}>
                  <span className={styles.priceBadgeOff}>{plan.discount}</span>
                  <span className={styles.priceBadgeSave}>SAVE ${plan.savings.toLocaleString()}</span>
                </div>
              </div>

              <div className={styles.annual}>${plan.annual.toLocaleString()} / ANNUALLY</div>

              <ul className={styles.features}>
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>

              <TrialButton plan={plan.slug} className={styles.cta}>
                START FREE TRIAL
              </TrialButton>
              <p className={styles.ctaNote}>14-day free trial · Cancel anytime</p>
            </div>
          ))}
        </div>
      </div>

    </section>
  );
}

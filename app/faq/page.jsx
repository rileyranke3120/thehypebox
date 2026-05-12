import Link from 'next/link';
import Image from 'next/image';
import FAQAccordion from '@/components/FAQAccordion';

export const metadata = {
  title: 'FAQ — TheHypeBox',
  description: 'Frequently asked questions about TheHypeBox subscriptions, billing, and features.',
};

const CATEGORIES = [
  {
    label: 'Trial & Billing',
    items: [
      {
        question: 'How does the 14-day free trial work?',
        answer: 'When you sign up, you get full access to your plan for 14 days completely free. No credit card charges during this period. After 14 days, your subscription automatically starts and you\'ll be billed monthly. You can cancel anytime during the trial to avoid any charges.',
      },
      {
        question: 'When will I be charged?',
        answer: 'Your first payment will be charged exactly 14 days after you start your trial. After that, you\'ll be billed monthly on the same date. For example, if you sign up on May 1st, your first charge will be May 15th, then June 15th, July 15th, and so on.',
      },
      {
        question: 'What payment methods do you accept?',
        answer: 'We accept all major credit and debit cards — Visa, Mastercard, American Express, and Discover — through our secure payment processor, Stripe. We never store your card details on our servers.',
      },
      {
        question: 'Do you offer annual billing?',
        answer: 'Not at launch, but we\'re working on it! Annual billing with a discount will be available soon. Stay tuned.',
      },
    ],
  },
  {
    label: 'Managing Your Subscription',
    items: [
      {
        question: 'How do I cancel my subscription?',
        answer: (
          <>
            You can cancel anytime in just a few clicks:
            <ol style={{ marginTop: '0.5rem', paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>Log into your account</li>
              <li>Go to Dashboard → Billing</li>
              <li>Click &ldquo;Manage Subscription&rdquo;</li>
              <li>Click &ldquo;Cancel Subscription&rdquo;</li>
            </ol>
            <p style={{ marginTop: '0.5rem', marginBottom: 0 }}>
              Your cancellation takes effect at the end of your current billing period. You&apos;ll retain full access until then.
            </p>
          </>
        ),
      },
      {
        question: 'Can I change my plan?',
        answer: 'Yes! You can upgrade or downgrade anytime through your billing dashboard. Go to Dashboard → Billing → Manage Subscription. Changes take effect immediately.',
      },
      {
        question: 'How do I update my payment method?',
        answer: (
          <>
            <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>Log into your account</li>
              <li>Go to Dashboard → Billing</li>
              <li>Click &ldquo;Update Payment Method&rdquo;</li>
              <li>Enter your new card details</li>
            </ol>
            <p style={{ marginTop: '0.5rem', marginBottom: 0 }}>Changes are saved instantly and apply to your next billing cycle.</p>
          </>
        ),
      },
      {
        question: 'Can I pause my subscription?',
        answer: 'Currently we don\'t offer subscription pausing. You can cancel and re-subscribe anytime — though you\'d start a new account. Contact us at riley@thehypeboxllc.com if you\'re in a tough spot and we\'ll work something out.',
      },
    ],
  },
  {
    label: 'Payments & Refunds',
    items: [
      {
        question: 'What\'s your refund policy?',
        answer: (
          <>
            During your 14-day trial, you can cancel anytime with no charges. After your trial ends, subscriptions are non-refundable — but you can cancel at any time to avoid future charges.{' '}
            <Link href="/refund-policy" style={{ color: '#F5C400' }}>See our full Refund Policy →</Link>
          </>
        ),
      },
      {
        question: 'What if my payment fails?',
        answer: (
          <>
            If your payment fails, we will:
            <ol style={{ marginTop: '0.5rem', paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>Send you an email notification immediately</li>
              <li>Automatically retry the payment</li>
              <li>Give you 7 days to update your payment method</li>
              <li>Suspend your account if payment isn&apos;t resolved after 7 days</li>
            </ol>
            <p style={{ marginTop: '0.5rem', marginBottom: 0 }}>Update your payment method right away to avoid service interruption.</p>
          </>
        ),
      },
    ],
  },
  {
    label: 'Account & Data',
    items: [
      {
        question: 'What happens to my data if I cancel?',
        answer: 'Your data remains accessible until the end of your current billing period. After that, your account is deactivated but not immediately deleted. Contact us within 30 days at riley@thehypeboxllc.com if you want to reactivate or export your data.',
      },
      {
        question: 'How do I contact support?',
        answer: (
          <>
            Email us at{' '}
            <a href="mailto:riley@thehypeboxllc.com" style={{ color: '#F5C400' }}>riley@thehypeboxllc.com</a>
            {' '}and we&apos;ll respond within 24 hours (usually much faster). You can also use our{' '}
            <Link href="/contact" style={{ color: '#F5C400' }}>contact form</Link>.
          </>
        ),
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff' }}>
      <header style={{ borderBottom: '1px solid #1a1a1a', padding: '1.25rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/">
          <Image src="/logo.png" alt="TheHypeBox" height={40} width={200} style={{ display: 'block', height: '40px', width: 'auto', mixBlendMode: 'screen' }} />
        </Link>
        <Link href="/contact" style={{ fontSize: '0.82rem', color: '#666' }}>Contact Support →</Link>
      </header>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '4rem 1.5rem 6rem' }}>
        <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
          <span style={{ display: 'inline-block', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#F5C400', border: '1px solid #F5C400', borderRadius: '4px', padding: '3px 10px', marginBottom: '1rem' }}>
            Help Center
          </span>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(2rem, 6vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '0.75rem' }}>
            Frequently Asked Questions
          </h1>
          <p style={{ color: '#666', fontSize: '0.95rem', maxWidth: '480px', margin: '0 auto' }}>
            Can&apos;t find your answer?{' '}
            <Link href="/contact" style={{ color: '#F5C400' }}>Contact us →</Link>
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          {CATEGORIES.map((cat) => (
            <div key={cat.label}>
              <h2 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '0.75rem',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: '#F5C400',
                marginBottom: '0.75rem',
              }}>
                {cat.label}
              </h2>
              <FAQAccordion items={cat.items} />
            </div>
          ))}
        </div>

        <div style={{ marginTop: '4rem', padding: '2rem', background: '#111', border: '1px solid #1a1a1a', borderRadius: '4px', textAlign: 'center' }}>
          <p style={{ color: '#fff', fontWeight: 600, marginBottom: '0.5rem' }}>Still have questions?</p>
          <p style={{ color: '#666', fontSize: '0.88rem', marginBottom: '1.25rem' }}>We usually respond within a few hours.</p>
          <Link href="/contact" className="btn btn-primary" style={{ fontSize: '0.9rem' }}>
            Contact Support →
          </Link>
        </div>
      </div>
    </div>
  );
}

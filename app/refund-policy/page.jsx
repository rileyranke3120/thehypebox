import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'Refund Policy — TheHypeBox',
  description: 'TheHypeBox refund and cancellation policy.',
};

export default function RefundPolicyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #1a1a1a', padding: '1.25rem 2rem', display: 'flex', alignItems: 'center' }}>
        <Link href="/">
          <Image src="/logo.png" alt="TheHypeBox" height={40} width={200} style={{ display: 'block', height: '40px', width: 'auto', mixBlendMode: 'screen' }} />
        </Link>
      </header>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 1.5rem 6rem' }}>
        {/* Page title */}
        <div style={{ marginBottom: '2.5rem', paddingBottom: '2.5rem', borderBottom: '1px solid #1a1a1a' }}>
          <span style={{ display: 'inline-block', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#F5C400', border: '1px solid #F5C400', borderRadius: '4px', padding: '3px 10px', marginBottom: '1rem' }}>
            Legal
          </span>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(2rem, 6vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '0.5rem' }}>
            Refund Policy
          </h1>
          <p style={{ color: '#555', fontSize: '0.85rem', margin: 0 }}>Last updated: May 2026</p>
        </div>

        {/* TL;DR summary box */}
        <div style={{ padding: '1.25rem 1.5rem', background: '#111', border: '1px solid #2a2a2a', borderRadius: '4px', marginBottom: '3rem' }}>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#F5C400', margin: '0 0 0.75rem' }}>
            Quick Summary
          </p>
          <ul style={{ paddingLeft: '1.1rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem', color: '#aaa', fontSize: '0.88rem', lineHeight: 1.6 }}>
            <li>All plans include a <strong style={{ color: '#fff' }}>14-day free trial</strong> — no charge if you cancel before it ends</li>
            <li>After the trial, <strong style={{ color: '#fff' }}>no refunds</strong> are issued for the current billing period</li>
            <li>Cancel anytime — your access continues until the billing period ends</li>
            <li>Questions? Email <a href="mailto:riley@thehypeboxllc.com" style={{ color: '#F5C400' }}>riley@thehypeboxllc.com</a></li>
          </ul>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>

          <section id="free-trial">
            <SectionTitle number="1">14-Day Free Trial</SectionTitle>
            <p style={bodyText}>Every TheHypeBox plan — Launch, Rocket, and Velocity — includes a <strong style={strong}>14-day free trial</strong>. Here&apos;s what that means:</p>
            <ul style={list}>
              <li>Your trial starts the moment you complete signup</li>
              <li>No credit card charges occur during the trial period</li>
              <li>You have full access to all features included in your selected plan during the trial</li>
              <li>If you cancel <strong style={strong}>before day 14</strong>, you will not be charged anything</li>
              <li>No refund is needed if you cancel during the trial — because nothing was charged</li>
            </ul>
          </section>

          <section id="after-trial">
            <SectionTitle number="2">After the Trial Period</SectionTitle>
            <p style={bodyText}>On day 15, your first monthly payment is automatically charged to the card on file:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '1rem 0' }}>
              {[
                { plan: 'The Launch Box', price: '$97/mo' },
                { plan: 'The Rocket Box', price: '$297/mo' },
                { plan: 'The Velocity Box', price: '$497/mo' },
              ].map(({ plan, price }) => (
                <div key={plan} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#111', border: '1px solid #1a1a1a', borderRadius: '4px' }}>
                  <span style={{ fontSize: '0.9rem', color: '#ddd' }}>{plan}</span>
                  <span style={{ fontSize: '0.9rem', color: '#F5C400', fontWeight: 600 }}>{price}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '1rem 1.25rem', background: '#0f0f0f', border: '1px solid #2a2a2a', borderLeft: '3px solid #F5C400', borderRadius: '4px', marginTop: '1rem' }}>
              <p style={{ color: '#ddd', fontSize: '0.9rem', margin: 0, lineHeight: 1.6 }}>
                <strong>No refunds after the trial ends.</strong> The 14-day trial is your opportunity to fully evaluate the service before any charge. We do not issue refunds for the current billing period after payment has been made.
              </p>
            </div>
          </section>

          <section id="how-to-cancel">
            <SectionTitle number="3">How to Cancel</SectionTitle>
            <p style={bodyText}>Canceling is straightforward — no phone calls required.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              <div style={{ padding: '1rem 1.25rem', background: '#111', border: '1px solid #1a1a1a', borderRadius: '4px' }}>
                <p style={{ color: '#F5C400', fontFamily: 'var(--font-heading)', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 0.4rem' }}>Option 1 — Account Dashboard</p>
                <p style={{ color: '#aaa', fontSize: '0.88rem', margin: 0 }}>Log in and navigate to Billing → Cancel Subscription.</p>
              </div>
              <div style={{ padding: '1rem 1.25rem', background: '#111', border: '1px solid #1a1a1a', borderRadius: '4px' }}>
                <p style={{ color: '#F5C400', fontFamily: 'var(--font-heading)', fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 0.4rem' }}>Option 2 — Email Us</p>
                <p style={{ color: '#aaa', fontSize: '0.88rem', margin: 0 }}>Email <a href="mailto:riley@thehypeboxllc.com" style={{ color: '#F5C400' }}>riley@thehypeboxllc.com</a> with the subject <em>&ldquo;Cancel Subscription&rdquo;</em> from your account email address.</p>
              </div>
            </div>
            <ul style={{ ...list, marginTop: '1.25rem' }}>
              <li>Cancellation is effective at the end of your <strong style={strong}>current billing period</strong></li>
              <li>You keep full access until the period ends</li>
              <li>No partial refunds are issued for unused days in a billing period</li>
            </ul>
          </section>

          <section id="payment-failures">
            <SectionTitle number="4">Failed Payments</SectionTitle>
            <ul style={list}>
              <li>If a payment fails, Stripe will automatically retry the charge</li>
              <li>You will be notified by email to update your payment method</li>
              <li>You have a <strong style={strong}>7-day grace period</strong> to resolve the issue before your account is suspended</li>
              <li>No refunds are issued for periods in which service was suspended due to non-payment</li>
            </ul>
          </section>

          <section id="exceptions">
            <SectionTitle number="5">Exceptions &amp; Special Circumstances</SectionTitle>
            <ul style={list}>
              <li>Accounts terminated for violating our <Link href="/terms" style={{ color: '#F5C400' }}>Terms of Service</Link> are not eligible for refunds</li>
              <li>Fraudulent chargebacks will result in permanent account termination. If you have a billing concern, please <strong style={strong}>contact us first</strong> — we&apos;re happy to help</li>
              <li>In rare cases of extended service outages caused by our systems, we may issue account credits at our discretion</li>
            </ul>
          </section>

          <section id="contact">
            <SectionTitle number="6">Contact Us</SectionTitle>
            <p style={bodyText}>Have a billing question or want to discuss your situation? We&apos;re real people — reach out and we&apos;ll do our best to help.</p>
            <div style={{ marginTop: '1rem', padding: '1.25rem', background: '#111', border: '1px solid #1a1a1a', borderRadius: '4px' }}>
              <p style={{ color: '#fff', margin: '0 0 0.25rem', fontSize: '0.95rem', fontWeight: 600 }}>TheHypeBox LLC</p>
              <p style={{ color: '#aaa', fontSize: '0.88rem', margin: '0 0 0.2rem' }}>
                Email: <a href="mailto:riley@thehypeboxllc.com" style={{ color: '#F5C400' }}>riley@thehypeboxllc.com</a>
              </p>
              <p style={{ color: '#aaa', fontSize: '0.88rem', margin: 0 }}>Subject: <em>Refund Request — [Your Account Email]</em></p>
            </div>
            <p style={{ ...bodyText, marginTop: '0.75rem' }}>Refund requests (where applicable) are processed within 3–5 business days to the original payment method.</p>
          </section>

        </div>

        {/* Footer links */}
        <div style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.82rem' }}>
            <Link href="/privacy" style={{ color: '#555' }}>Privacy Policy</Link>
            <Link href="/terms" style={{ color: '#555' }}>Terms of Service</Link>
          </div>
          <a href="#top" style={{ fontSize: '0.82rem', color: '#555' }}>↑ Back to top</a>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ number, children }) {
  return (
    <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.1rem, 3vw, 1.4rem)', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#fff', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <span style={{ color: '#F5C400', fontSize: '0.9em' }}>{number}.</span> {children}
    </h2>
  );
}

const bodyText = { color: '#aaa', lineHeight: 1.75, fontSize: '0.92rem', margin: 0 };
const list = { paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.75rem', color: '#aaa', fontSize: '0.92rem', lineHeight: 1.7 };
const strong = { color: '#ddd', fontWeight: 600 };

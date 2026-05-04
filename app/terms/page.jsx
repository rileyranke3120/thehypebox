import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'Terms of Service — TheHypeBox',
  description: 'The terms and conditions governing your use of TheHypeBox.',
};

const SECTIONS = [
  { id: 'agreement', label: 'Agreement to Terms' },
  { id: 'service', label: 'Service Description' },
  { id: 'account', label: 'Account Registration' },
  { id: 'billing', label: 'Subscription & Billing' },
  { id: 'trial', label: 'Free Trial Terms' },
  { id: 'cancellation', label: 'Cancellation & Refunds' },
  { id: 'payment-failures', label: 'Payment Failures' },
  { id: 'prohibited', label: 'Prohibited Uses' },
  { id: 'ip', label: 'Intellectual Property' },
  { id: 'liability', label: 'Limitation of Liability' },
  { id: 'indemnification', label: 'Indemnification' },
  { id: 'disputes', label: 'Dispute Resolution' },
  { id: 'termination', label: 'Termination' },
  { id: 'changes', label: 'Changes to Terms' },
  { id: 'contact', label: 'Contact' },
];

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p style={{ color: '#555', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>Last updated: May 2026</p>
          <div style={{ padding: '0.875rem 1rem', background: '#111', border: '1px solid #2a2a2a', borderRadius: '4px' }}>
            <p style={{ color: '#aaa', fontSize: '0.85rem', margin: 0, lineHeight: 1.6 }}>
              <strong style={{ color: '#F5C400' }}>Please read carefully.</strong> This is a legally binding agreement between you and TheHypeBox LLC. By using our service, you agree to these terms.
            </p>
          </div>
        </div>

        {/* Table of contents */}
        <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: '4px', padding: '1.5rem', marginBottom: '3rem' }}>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#F5C400', margin: '0 0 1rem' }}>
            Contents
          </p>
          <ol style={{ paddingLeft: '1.2rem', margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.4rem' }}>
            {SECTIONS.map((s, i) => (
              <li key={s.id} style={{ fontSize: '0.85rem' }}>
                <a href={`#${s.id}`} style={{ color: '#aaa', textDecoration: 'none' }}>
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>

          <section id="agreement">
            <SectionTitle number="1">Agreement to Terms</SectionTitle>
            <p style={bodyText}>By accessing or using TheHypeBox (&ldquo;the Service&rdquo;), you agree to be bound by these Terms of Service and our <Link href="/privacy" style={{ color: '#F5C400' }}>Privacy Policy</Link>. If you do not agree to these terms, do not use the Service.</p>
            <p style={{ ...bodyText, marginTop: '0.75rem' }}>You must be at least 18 years old to use TheHypeBox. By using the Service, you confirm that you meet this requirement.</p>
          </section>

          <section id="service">
            <SectionTitle number="2">Service Description</SectionTitle>
            <p style={bodyText}>TheHypeBox provides AI-powered business automation tools for local businesses, including but not limited to: CRM and contact management, automated follow-up, appointment scheduling, unified inbox, AI phone receptionist, and website hosting.</p>
            <p style={{ ...bodyText, marginTop: '0.75rem' }}>The Service is provided &ldquo;as is.&rdquo; We continuously improve our platform and features may be added, modified, or removed over time. We will make reasonable efforts to notify users of significant changes.</p>
          </section>

          <section id="account">
            <SectionTitle number="3">Account Registration</SectionTitle>
            <ul style={list}>
              <li>You must provide accurate, current, and complete information when creating your account</li>
              <li>You are responsible for maintaining the security of your login credentials</li>
              <li>One account per person or business — do not share accounts between unrelated parties</li>
              <li>Notify us immediately at <a href="mailto:riley@thehypeboxllc.com" style={{ color: '#F5C400' }}>riley@thehypeboxllc.com</a> if you suspect unauthorized access to your account</li>
              <li>You are responsible for all activity that occurs under your account</li>
            </ul>
          </section>

          <section id="billing">
            <SectionTitle number="4">Subscription &amp; Billing</SectionTitle>
            <p style={bodyText}>TheHypeBox offers three monthly subscription plans:</p>
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
            <ul style={list}>
              <li>All plans include a <strong style={strong}>14-day free trial</strong> — no charge during the trial period</li>
              <li>After the trial, your card is automatically charged the monthly plan rate</li>
              <li>Billing recurs monthly on your subscription date</li>
              <li>Prices may change with at least <strong style={strong}>30 days&apos; advance notice</strong> via email</li>
              <li>You are responsible for keeping your payment method current</li>
              <li>All payments are processed in USD by Stripe</li>
            </ul>
          </section>

          <section id="trial">
            <SectionTitle number="5">Free Trial Terms</SectionTitle>
            <ul style={list}>
              <li>Your 14-day free trial begins on the date you complete signup</li>
              <li>No charges are made during the trial period</li>
              <li>You must cancel <strong style={strong}>before the trial ends</strong> to avoid being charged</li>
              <li>Your first payment occurs on <strong style={strong}>day 15</strong> at the full plan price</li>
              <li>Free trials are limited to <strong style={strong}>one per customer</strong> — abuse of the trial offer may result in account termination</li>
            </ul>
          </section>

          <section id="cancellation">
            <SectionTitle number="6">Cancellation &amp; Refunds</SectionTitle>
            <p style={bodyText}>You may cancel your subscription at any time. Here&apos;s how it works:</p>
            <ul style={list}>
              <li><strong style={strong}>During trial:</strong> Cancel with no charge — simply email us or cancel via your account dashboard before day 14</li>
              <li><strong style={strong}>After trial:</strong> Cancellation takes effect at the end of your current billing period; you retain access until then</li>
              <li><strong style={strong}>Refunds:</strong> We do not offer refunds for partial billing periods after the trial has ended. The 14-day trial is your opportunity to evaluate the service before being charged</li>
              <li>To cancel, email <a href="mailto:riley@thehypeboxllc.com" style={{ color: '#F5C400' }}>riley@thehypeboxllc.com</a> with the subject line &ldquo;Cancel Subscription&rdquo; or use the cancellation option in your account dashboard</li>
            </ul>
            <p style={{ ...bodyText, marginTop: '0.75rem' }}>See our <Link href="/refund-policy" style={{ color: '#F5C400' }}>Refund Policy</Link> for full details.</p>
          </section>

          <section id="payment-failures">
            <SectionTitle number="7">Payment Failures</SectionTitle>
            <ul style={list}>
              <li>If your payment fails, we will notify you by email</li>
              <li>You have a <strong style={strong}>7-day grace period</strong> to update your payment method</li>
              <li>If payment is not resolved within the grace period, your account may be suspended</li>
              <li>To reactivate a suspended account, the outstanding balance must be paid</li>
            </ul>
          </section>

          <section id="prohibited">
            <SectionTitle number="8">Prohibited Uses</SectionTitle>
            <p style={bodyText}>You may not use TheHypeBox to:</p>
            <ul style={list}>
              <li>Engage in any illegal activity or violate any applicable laws</li>
              <li>Send spam, unsolicited messages, or harass other individuals</li>
              <li>Share your account credentials with unrelated third parties</li>
              <li>Attempt to reverse engineer, decompile, or access our source code</li>
              <li>Abuse, overload, or otherwise disrupt our systems</li>
              <li>Impersonate TheHypeBox or any employee or representative</li>
              <li>Use the service for any purpose that violates the rights of others</li>
            </ul>
            <p style={{ ...bodyText, marginTop: '0.75rem' }}>We reserve the right to suspend or terminate any account that violates these terms, without refund.</p>
          </section>

          <section id="ip">
            <SectionTitle number="9">Intellectual Property</SectionTitle>
            <ul style={list}>
              <li>TheHypeBox LLC owns all rights to the platform, software, design, trademarks, and content we create</li>
              <li>You retain full ownership of any content you upload or create within the platform (contacts, notes, messages)</li>
              <li>By using the Service, you grant us a limited license to store and process your content solely to provide the Service to you</li>
              <li>You may not use our name, logo, or trademarks without written permission</li>
            </ul>
          </section>

          <section id="liability">
            <SectionTitle number="10">Limitation of Liability</SectionTitle>
            <p style={bodyText}>The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, express or implied. We do not guarantee that the Service will be uninterrupted, error-free, or meet your specific business requirements.</p>
            <p style={{ ...bodyText, marginTop: '0.75rem' }}>To the maximum extent permitted by law, TheHypeBox LLC shall not be liable for any indirect, incidental, consequential, or punitive damages arising from your use of the Service. Our total liability to you for any claim arising from these terms or your use of the Service shall not exceed the total amount you paid to us in the 12 months preceding the claim.</p>
            <p style={{ ...bodyText, marginTop: '0.75rem' }}>Some jurisdictions do not allow limitations on liability, so the above may not fully apply to you.</p>
          </section>

          <section id="indemnification">
            <SectionTitle number="11">Indemnification</SectionTitle>
            <p style={bodyText}>You agree to indemnify, defend, and hold harmless TheHypeBox LLC, its officers, employees, and agents from any claims, damages, losses, or expenses (including reasonable legal fees) arising from: (a) your use of the Service; (b) your violation of these Terms; or (c) your violation of any rights of a third party.</p>
          </section>

          <section id="disputes">
            <SectionTitle number="12">Dispute Resolution</SectionTitle>
            <p style={bodyText}>These Terms are governed by the laws of the State of Ohio, without regard to conflict of law principles. Any dispute arising from these Terms or your use of the Service shall first be addressed through good-faith negotiation by emailing <a href="mailto:riley@thehypeboxllc.com" style={{ color: '#F5C400' }}>riley@thehypeboxllc.com</a>.</p>
            <p style={{ ...bodyText, marginTop: '0.75rem' }}>If a dispute cannot be resolved informally, both parties agree to binding arbitration in Columbus, Ohio under the rules of the American Arbitration Association. You waive any right to participate in a class action lawsuit or class-wide arbitration against TheHypeBox LLC.</p>
          </section>

          <section id="termination">
            <SectionTitle number="13">Termination</SectionTitle>
            <ul style={list}>
              <li>You may terminate your account at any time by canceling your subscription and contacting us to request data deletion</li>
              <li>We may suspend or terminate your account immediately if you violate these Terms, engage in fraud, or abuse the Service</li>
              <li>Upon termination, your access to the Service will end; we will retain your data for up to 90 days before deletion, after which it cannot be recovered</li>
              <li>Provisions that by nature survive termination (Intellectual Property, Liability, Indemnification, Dispute Resolution) will remain in effect</li>
            </ul>
          </section>

          <section id="changes">
            <SectionTitle number="14">Changes to Terms</SectionTitle>
            <p style={bodyText}>We may update these Terms of Service at any time. When we do, we will update the &ldquo;Last updated&rdquo; date at the top of this page. For material changes, we will notify you by email at least 14 days before the changes take effect. Your continued use of the Service after changes take effect constitutes your acceptance of the new terms.</p>
          </section>

          <section id="contact">
            <SectionTitle number="15">Contact</SectionTitle>
            <p style={bodyText}>Questions about these Terms? Contact us:</p>
            <div style={{ marginTop: '1rem', padding: '1.25rem', background: '#111', border: '1px solid #1a1a1a', borderRadius: '4px' }}>
              <p style={{ color: '#fff', margin: '0 0 0.25rem', fontSize: '0.95rem', fontWeight: 600 }}>TheHypeBox LLC</p>
              <p style={{ color: '#aaa', margin: 0, fontSize: '0.88rem' }}>
                Email: <a href="mailto:riley@thehypeboxllc.com" style={{ color: '#F5C400' }}>riley@thehypeboxllc.com</a>
              </p>
            </div>
          </section>

        </div>

        {/* Footer links */}
        <div style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.82rem' }}>
            <Link href="/privacy" style={{ color: '#555' }}>Privacy Policy</Link>
            <Link href="/refund-policy" style={{ color: '#555' }}>Refund Policy</Link>
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

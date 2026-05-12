import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'Privacy Policy — TheHypeBox',
  description: 'How TheHypeBox collects, uses, and protects your personal information.',
};

const SECTIONS = [
  { id: 'information-we-collect', label: 'Information We Collect' },
  { id: 'how-we-use', label: 'How We Use Your Information' },
  { id: 'data-storage', label: 'Data Storage & Security' },
  { id: 'third-party', label: 'Third-Party Services' },
  { id: 'your-rights', label: 'Your Rights' },
  { id: 'cookies', label: 'Cookies & Tracking' },
  { id: 'childrens-privacy', label: "Children's Privacy" },
  { id: 'contact', label: 'Contact Us' },
  { id: 'changes', label: 'Changes to This Policy' },
];

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <p style={{ color: '#555', fontSize: '0.85rem', margin: 0 }}>Last updated: May 2026</p>
        </div>

        {/* Intro */}
        <p style={{ color: '#aaa', lineHeight: 1.75, marginBottom: '2.5rem' }}>
          TheHypeBox LLC (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) respects your privacy and is committed to protecting the personal information you share with us. This Privacy Policy explains what data we collect, how we use it, and the choices you have.
        </p>

        {/* Table of contents */}
        <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: '4px', padding: '1.5rem', marginBottom: '3rem' }}>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#F5C400', margin: '0 0 1rem' }}>
            Contents
          </p>
          <ol style={{ paddingLeft: '1.2rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {SECTIONS.map((s, i) => (
              <li key={s.id} style={{ fontSize: '0.88rem' }}>
                <a href={`#${s.id}`} style={{ color: '#aaa', textDecoration: 'none' }}>
                  {i + 1}. {s.label}
                </a>
              </li>
            ))}
          </ol>
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>

          <section id="information-we-collect">
            <SectionTitle number="1">Information We Collect</SectionTitle>
            <p style={bodyText}>We collect the following types of information when you use our service:</p>
            <ul style={list}>
              <li><strong style={strong}>Name and email address</strong> — provided when you sign up or contact us</li>
              <li><strong style={strong}>Payment information</strong> — your card details are processed securely by Stripe; we never see or store your full card number</li>
              <li><strong style={strong}>Usage data</strong> — pages visited, features used, time spent in the app</li>
              <li><strong style={strong}>Device and browser information</strong> — browser type, operating system, IP address, referring URL</li>
              <li><strong style={strong}>Business information</strong> — details you enter into the platform (contacts, appointments, notes)</li>
            </ul>
          </section>

          <section id="how-we-use">
            <SectionTitle number="2">How We Use Your Information</SectionTitle>
            <p style={bodyText}>We use the information we collect to:</p>
            <ul style={list}>
              <li>Provide, operate, and improve our service</li>
              <li>Process payments and manage your subscription</li>
              <li>Send service-related emails such as login credentials, billing receipts, and trial reminders</li>
              <li>Respond to support requests and troubleshoot issues</li>
              <li>Monitor for security threats and prevent fraud</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p style={{ ...bodyText, marginTop: '1rem' }}>We do <strong style={strong}>not</strong> sell your personal data to third parties. We do not use your data for advertising or share it with marketing companies.</p>
          </section>

          <section id="data-storage">
            <SectionTitle number="3">Data Storage &amp; Security</SectionTitle>
            <ul style={list}>
              <li>Your account data is stored securely using <strong style={strong}>Supabase</strong>, hosted on US-based servers with encryption at rest</li>
              <li>Payment data is handled entirely by <strong style={strong}>Stripe</strong>, which is PCI-DSS Level 1 compliant — the highest level of payment security</li>
              <li>We <strong style={strong}>never</strong> store your credit card number, CVV, or full card details on our servers</li>
              <li>All data in transit is protected with industry-standard TLS/SSL encryption</li>
              <li>Access to production systems is limited to authorized personnel only</li>
            </ul>
          </section>

          <section id="third-party">
            <SectionTitle number="4">Third-Party Services</SectionTitle>
            <p style={bodyText}>We use the following third-party services to operate TheHypeBox. Each has its own privacy policy governing how they handle data.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              {[
                { name: 'Stripe', purpose: 'Payment processing and subscription management' },
                { name: 'Supabase', purpose: 'Database hosting and user authentication' },
                { name: 'GoDaddy / SMTP', purpose: 'Transactional email delivery (welcome emails, billing notices)' },
                { name: 'Vercel', purpose: 'Website and application hosting' },
                { name: 'Retell AI', purpose: 'AI phone receptionist (Velocity plan)' },
              ].map(({ name, purpose }) => (
                <div key={name} style={{ padding: '0.875rem 1rem', background: '#111', border: '1px solid #1a1a1a', borderRadius: '4px', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.85rem', letterSpacing: '0.06em', color: '#F5C400', minWidth: '120px' }}>{name}</span>
                  <span style={{ fontSize: '0.88rem', color: '#aaa' }}>{purpose}</span>
                </div>
              ))}
            </div>
          </section>

          <section id="your-rights">
            <SectionTitle number="5">Your Rights</SectionTitle>
            <p style={bodyText}>You have the following rights regarding your personal data:</p>
            <ul style={list}>
              <li><strong style={strong}>Access</strong> — request a copy of the personal data we hold about you</li>
              <li><strong style={strong}>Correction</strong> — update or correct inaccurate information through your account settings or by emailing us</li>
              <li><strong style={strong}>Deletion</strong> — request that we delete your account and personal data (we will retain data required by law or for legitimate business purposes for a limited period)</li>
              <li><strong style={strong}>Data export</strong> — request a portable copy of your data</li>
              <li><strong style={strong}>Opt-out of marketing</strong> — unsubscribe from marketing emails at any time using the link in any email we send</li>
            </ul>
            <p style={{ ...bodyText, marginTop: '1rem' }}>To exercise any of these rights, email us at <a href="mailto:riley@thehypeboxllc.com" style={{ color: '#F5C400' }}>riley@thehypeboxllc.com</a>. We will respond within 30 days.</p>
          </section>

          <section id="cookies">
            <SectionTitle number="6">Cookies &amp; Tracking</SectionTitle>
            <p style={bodyText}>We use cookies and similar technologies to keep you logged in and improve your experience.</p>
            <ul style={list}>
              <li><strong style={strong}>Essential cookies</strong> — required for login sessions and basic site functionality; cannot be disabled</li>
              <li><strong style={strong}>Analytics cookies</strong> — help us understand how visitors use our site (aggregated, anonymous data)</li>
            </ul>
            <p style={{ ...bodyText, marginTop: '1rem' }}>You can disable non-essential cookies in your browser settings. Note that disabling cookies may affect your ability to log in and use the service.</p>
          </section>

          <section id="childrens-privacy">
            <SectionTitle number="7">Children&apos;s Privacy</SectionTitle>
            <p style={bodyText}>TheHypeBox is a business tool intended for users 18 years of age and older. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected data from a minor, please contact us immediately at <a href="mailto:riley@thehypeboxllc.com" style={{ color: '#F5C400' }}>riley@thehypeboxllc.com</a> and we will delete it promptly.</p>
          </section>

          <section id="contact">
            <SectionTitle number="8">Contact Us</SectionTitle>
            <p style={bodyText}>If you have questions about this Privacy Policy or want to exercise your rights, contact us at:</p>
            <div style={{ marginTop: '1rem', padding: '1.25rem', background: '#111', border: '1px solid #1a1a1a', borderRadius: '4px' }}>
              <p style={{ color: '#fff', margin: '0 0 0.25rem', fontSize: '0.95rem', fontWeight: 600 }}>TheHypeBox LLC</p>
              <p style={{ color: '#aaa', margin: 0, fontSize: '0.88rem' }}>
                Email: <a href="mailto:riley@thehypeboxllc.com" style={{ color: '#F5C400' }}>riley@thehypeboxllc.com</a>
              </p>
            </div>
          </section>

          <section id="changes">
            <SectionTitle number="9">Changes to This Policy</SectionTitle>
            <p style={bodyText}>We may update this Privacy Policy from time to time. When we do, we will update the &ldquo;Last updated&rdquo; date at the top of this page. For material changes, we will notify you by email. Your continued use of TheHypeBox after any change constitutes your acceptance of the updated policy.</p>
          </section>

        </div>

        {/* Back to top + footer links */}
        <div style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.82rem' }}>
            <Link href="/terms" style={{ color: '#555' }}>Terms of Service</Link>
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

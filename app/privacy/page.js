import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Privacy Policy — TheHypeBox',
  description: 'Privacy Policy for TheHypeBox LLC, a software-as-a-service company based in Westerville, Ohio.',
};

const SECTIONS = [
  {
    h: '1. Who We Are',
    body: 'TheHypeBox LLC ("TheHypeBox," "Company," "we," "us," or "our") is a software-as-a-service company headquartered in Westerville, Ohio. We provide AI-powered business automation tools including CRM, unified messaging, appointment scheduling, marketing automation, and related services ("Services"). This Privacy Policy describes how we collect, use, store, share, and protect information about you when you visit our website or use our platform. Questions about this policy may be directed to riley@thehypebox.com.',
  },
  {
    h: '2. Information We Collect',
    body: 'We collect information in the following ways: (a) Information you provide directly — including your name, email address, phone number, business name, and billing details when you register, complete a contact form, or book a call with us. (b) Business configuration data — including business hours, service descriptions, FAQs, and other content you provide to configure your AI automations and agents. (c) Usage and activity data — including pages visited, features used, login times, and actions taken within your account dashboard. (d) Call and communication records — including call logs, AI-generated call summaries, SMS and email activity, and appointment history processed through your account. (e) Technical data — including IP address, browser type, device type, and cookies.',
  },
  {
    h: '3. How We Use Your Information',
    body: 'We use the information we collect to: provide, operate, maintain, and improve our Services; set up and configure your account and AI automations; communicate with you about your account, billing, and service updates; send operational notifications such as appointment confirmations and automation reports; respond to your support requests and inquiries; monitor and analyze usage patterns to improve platform performance; comply with legal obligations; and enforce our Terms & Conditions. We do not sell, rent, or trade your personal information to any third party for marketing purposes.',
  },
  {
    h: '4. Sharing of Information',
    body: 'We may share your information with: (a) Service providers — third-party companies that assist us in operating the platform, including GoHighLevel (CRM and automation infrastructure), Retell AI (AI phone agent processing), Stripe (payment processing), Supabase (database infrastructure), and Vercel (hosting). These providers are contractually obligated to protect your data and may only use it to perform services on our behalf. (b) Legal requirements — if required by law, regulation, subpoena, court order, or governmental authority. (c) Business transfers — in connection with a merger, acquisition, or sale of all or substantially all of our assets, your information may be transferred as part of that transaction. (d) With your consent — for any other purpose with your explicit prior consent.',
  },
  {
    h: '5. Cookies and Tracking',
    body: 'Our website uses cookies and similar tracking technologies to improve your experience, remember your preferences, and analyze site traffic. Cookies are small data files stored on your device. You can control cookie settings through your browser preferences. Disabling certain cookies may affect the functionality of our website. We do not currently respond to "Do Not Track" browser signals.',
  },
  {
    h: '6. Data Retention',
    body: 'We retain your personal data and account information for as long as your account is active or as necessary to provide the Services. If you cancel your subscription, we will retain your data for 90 days following the end of your final billing period, after which it will be permanently deleted from our active systems. You may request earlier deletion at any time (see Section 8). We may retain certain records longer if required by law or for legitimate business purposes such as fraud prevention.',
  },
  {
    h: '7. Data Security',
    body: 'We implement industry-standard technical and organizational security measures to protect your data from unauthorized access, disclosure, alteration, or destruction. These measures include encrypted data transmission (TLS/HTTPS), encrypted data storage, access controls and authentication requirements, and routine security reviews. While we take data security seriously, no method of transmission or storage is 100% secure. We cannot guarantee absolute security, but we are committed to protecting your information to the best of our ability.',
  },
  {
    h: '8. Your Rights and Choices',
    body: 'Depending on your location, you may have the following rights regarding your personal information: (a) Access — request a copy of the personal data we hold about you. (b) Correction — request that we correct inaccurate or incomplete information. (c) Deletion — request that we delete your personal data, subject to certain legal exceptions. (d) Portability — request that we provide your data in a structured, machine-readable format. (e) Objection — object to certain processing activities such as marketing communications. To exercise any of these rights, please contact us at riley@thehypebox.com. We will respond to your request within 30 days. We may need to verify your identity before processing your request.',
  },
  {
    h: '9. California Privacy Rights (CCPA)',
    body: 'If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information we collect, use, disclose, and sell; the right to delete your personal information; and the right to opt out of the sale of personal information. We do not sell personal information as defined under the CCPA. To submit a California privacy request, email riley@thehypebox.com with the subject line "California Privacy Request." We will not discriminate against you for exercising your CCPA rights.',
  },
  {
    h: '10. Communications and Marketing',
    body: 'By creating an account or submitting a contact form, you consent to receive transactional emails and operational communications related to our Services. We may also send you updates, product announcements, or educational content. You may opt out of non-essential marketing communications at any time by clicking the unsubscribe link in any marketing email or by contacting us at riley@thehypebox.com. Opting out of marketing emails will not affect your receipt of transactional and account-related messages.',
  },
  {
    h: '11. Children\'s Privacy',
    body: 'Our Services are not directed to individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that a child under 18 has provided us with personal information, we will take steps to delete such information promptly. If you believe a child has provided us with personal information, please contact us at riley@thehypebox.com.',
  },
  {
    h: '12. Third-Party Links',
    body: 'Our website and platform may contain links to third-party websites, services, or integrations. This Privacy Policy does not apply to those third-party services. We encourage you to review the privacy policies of any third-party services you access through our platform. TheHypeBox is not responsible for the privacy practices or content of any third-party websites.',
  },
  {
    h: '13. Changes to This Policy',
    body: 'We may update this Privacy Policy from time to time to reflect changes in our practices, Services, or applicable law. We will notify active subscribers of material changes via email at least 14 days before the changes take effect. The "Last updated" date at the top of this policy reflects the most recent revision. Your continued use of the Services after the effective date of a revised policy constitutes your acceptance of the changes.',
  },
  {
    h: '14. Contact Us',
    body: 'If you have any questions, concerns, or requests regarding this Privacy Policy or how we handle your personal information, please contact us at: TheHypeBox LLC · Westerville, Ohio · riley@thehypebox.com',
  },
];

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main style={{ background: 'var(--black, #0A0A0A)', color: '#fff', minHeight: '100vh' }}>

        {/* Header */}
        <div style={{
          borderBottom: '1px solid #1a1a1a',
          padding: '7rem 1.5rem 3rem',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(245,196,0,0.05) 0%, transparent 65%)',
        }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <span style={{
              display: 'inline-block',
              fontSize: '0.7rem',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#F5C400',
              border: '1px solid rgba(245,196,0,0.35)',
              padding: '0.3rem 0.75rem',
              marginBottom: '1.25rem',
            }}>Legal</span>
            <h1 style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 'clamp(2.2rem, 6vw, 3.5rem)',
              fontWeight: 900,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              lineHeight: 1.05,
              marginBottom: '0.75rem',
            }}>Privacy Policy</h1>
            <p style={{ color: '#666', fontSize: '0.82rem', letterSpacing: '0.05em' }}>
              TheHypeBox LLC · Last updated: April 2026 · Westerville, Ohio
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '3.5rem 1.5rem 6rem' }}>

          <p style={{ color: '#aaa', fontSize: '0.88rem', lineHeight: 1.8, marginBottom: '3rem', padding: '1.25rem 1.5rem', border: '1px solid #1e1e1e', borderLeft: '3px solid #F5C400', background: '#111' }}>
            Your privacy matters to us. This policy explains exactly what information we collect, why we collect it, and how you can control it.
          </p>

          {SECTIONS.map(({ h, body }, i) => (
            <section key={h} style={{ marginBottom: '2.5rem', paddingBottom: '2.5rem', borderBottom: i < SECTIONS.length - 1 ? '1px solid #1a1a1a' : 'none' }}>
              <h2 style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '1rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#F5C400',
                marginBottom: '0.75rem',
              }}>{h}</h2>
              <p style={{ color: '#bbb', lineHeight: 1.8, fontSize: '0.88rem' }}>{body}</p>
            </section>
          ))}

          <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '2rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <Link href="/" style={{ color: '#F5C400', fontSize: '0.82rem', textDecoration: 'none', letterSpacing: '0.05em' }}>← Back to Home</Link>
            <Link href="/terms" style={{ color: '#666', fontSize: '0.82rem', textDecoration: 'none', letterSpacing: '0.05em' }}>Terms & Conditions →</Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

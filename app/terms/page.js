import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

export const metadata = { title: 'Terms of Service — TheHypeBox' };

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main style={{ background: '#0A0A0A', color: '#fff', fontFamily: "'DM Sans', system-ui, sans-serif", minHeight: '100vh' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '80px 24px 100px' }}>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '2.8rem', fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>Terms of Service</h1>
          <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: 48 }}>Last updated: April 2026</p>

          {[
            { h: '1. Agreement', body: 'By using TheHypeBox LLC services ("Services"), you agree to these Terms of Service. If you do not agree, do not use our Services. These terms apply to all clients and visitors.' },
            { h: '2. Services', body: 'TheHypeBox provides AI automation services to local businesses, including AI receptionists, website chatbots, lead follow-up automation, and website builds. Service availability and features depend on your selected plan.' },
            { h: '3. Payment', body: 'Services are billed monthly. The setup fee is due at signup and is non-refundable. Monthly subscription fees are charged on a recurring basis. You may cancel at any time; cancellation takes effect at the end of the current billing period. No prorated refunds are issued for partial months.' },
            { h: '4. Client Responsibilities', body: 'You are responsible for providing accurate business information used to configure your AI agents. You agree not to use our Services for any unlawful purpose, to spam contacts, or to misrepresent your business. You are responsible for compliance with applicable telemarketing and messaging laws (TCPA, CAN-SPAM, etc.) in your jurisdiction.' },
            { h: '5. Intellectual Property', body: 'TheHypeBox retains ownership of all platform software, workflows, and automation infrastructure. Custom content provided by you (business info, scripts) remains your property.' },
            { h: '6. Limitation of Liability', body: 'TheHypeBox is not liable for missed calls, lost leads, or revenue losses resulting from service outages, third-party API failures (GoHighLevel, Retell AI, etc.), or misconfigured AI agents. Our total liability for any claim is limited to the amount you paid in the 30 days preceding the claim.' },
            { h: '7. Termination', body: 'Either party may terminate the agreement with 30 days written notice. TheHypeBox may terminate immediately for non-payment or violation of these terms.' },
            { h: '8. Changes', body: 'We may modify these terms at any time. Active clients will be notified via email. Continued use of Services after the effective date constitutes acceptance.' },
            { h: '9. Governing Law', body: 'These terms are governed by the laws of the State of [Your State]. Any disputes will be resolved in the courts of that jurisdiction.' },
            { h: '10. Contact', body: 'TheHypeBox LLC · riley@thehypebox.com' },
          ].map(({ h, body }) => (
            <section key={h} style={{ marginBottom: 36 }}>
              <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#F5C400', marginBottom: 10 }}>{h}</h2>
              <p style={{ color: '#ccc', lineHeight: 1.75, fontSize: '0.92rem' }}>{body}</p>
            </section>
          ))}

          <Link href="/" style={{ color: '#F5C400', fontSize: '0.85rem', textDecoration: 'none' }}>← Back to Home</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}

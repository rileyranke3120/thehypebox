import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Terms & Conditions — TheHypeBox',
  description: 'Terms and Conditions for TheHypeBox LLC, a software-as-a-service company based in Westerville, Ohio.',
};

const SECTIONS = [
  {
    h: '1. Agreement to Terms',
    body: 'By accessing or using any product, service, or platform operated by TheHypeBox LLC ("TheHypeBox," "Company," "we," "us," or "our"), you agree to be bound by these Terms & Conditions ("Terms"). If you are entering into these Terms on behalf of a business or other legal entity, you represent that you have the authority to bind such entity to these Terms. If you do not agree to these Terms, you may not access or use our Services.',
  },
  {
    h: '2. Description of Services',
    body: 'TheHypeBox provides a software-as-a-service (SaaS) platform that includes CRM and contact management, unified messaging inbox (SMS, email, and social), AI-assisted communications, marketing automation, appointment scheduling, lead capture, reputation management, and related tools ("Services"). The specific features available to you depend on the subscription plan you select. We reserve the right to modify, suspend, or discontinue any part of the Services at any time with reasonable notice to active subscribers.',
  },
  {
    h: '3. Account Registration',
    body: 'To access the Services, you must create an account and provide accurate, complete, and current information. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. You agree to notify us immediately at riley@thehypebox.com if you suspect any unauthorized access to your account. TheHypeBox is not liable for any loss resulting from unauthorized use of your account.',
  },
  {
    h: '4. Subscription and Payment',
    body: 'Services are offered on a monthly subscription basis. Your subscription begins on the date you complete setup and is billed on a recurring monthly cycle. All fees are stated in U.S. dollars and are exclusive of applicable taxes. You authorize TheHypeBox to charge your payment method on file at the start of each billing period. If payment fails, we may suspend your account until payment is received. Prices are subject to change with 30 days prior written notice to active subscribers.',
  },
  {
    h: '5. Setup Fee and Refund Policy',
    body: 'A one-time setup fee is due at the time of onboarding and is non-refundable. This fee covers account configuration, platform provisioning, and initial onboarding support. Monthly subscription fees are non-refundable for any partial billing period. If you cancel your subscription, you will retain access to the Services through the end of your current paid billing period. No prorated refunds are issued.',
  },
  {
    h: '6. Cancellation',
    body: 'You may cancel your subscription at any time by contacting us at riley@thehypebox.com or through your account settings. Cancellation takes effect at the end of your current billing period. You remain responsible for all fees accrued up to and including the cancellation effective date. TheHypeBox may cancel your account immediately for non-payment, violation of these Terms, or fraudulent activity.',
  },
  {
    h: '7. Client Responsibilities and Acceptable Use',
    body: 'You agree to use the Services only for lawful business purposes. You are solely responsible for the content, messages, and communications sent through our platform on your behalf. You agree not to: (a) send unsolicited commercial messages or spam; (b) use the Services to harass, threaten, or harm any person; (c) violate any applicable law, including the Telephone Consumer Protection Act (TCPA), CAN-SPAM Act, or state telemarketing laws; (d) misrepresent your identity or your business; (e) attempt to gain unauthorized access to our systems or another user\'s account; or (f) reverse-engineer, decompile, or copy any portion of the platform. You are responsible for obtaining all required consents from your contacts before contacting them through our platform.',
  },
  {
    h: '8. Intellectual Property',
    body: 'TheHypeBox and its licensors retain all right, title, and interest in and to the platform, software, workflows, AI models, templates, and all related intellectual property. These Terms do not grant you any ownership interest in the Services. You retain ownership of the business data, content, and materials you provide to us ("Client Content"). By uploading Client Content, you grant TheHypeBox a limited, non-exclusive license to use such content solely to provide the Services to you.',
  },
  {
    h: '9. Confidentiality',
    body: 'Each party agrees to keep confidential any non-public information of the other party that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and circumstances of disclosure. TheHypeBox will not disclose your business data to third parties except as required to provide the Services, as required by law, or with your explicit consent.',
  },
  {
    h: '10. Third-Party Integrations',
    body: 'The Services integrate with third-party platforms including but not limited to GoHighLevel (CRM), Retell AI (AI phone agent), Stripe (billing), and Supabase (infrastructure). Your use of these integrations is also subject to the respective third-party terms of service and privacy policies. TheHypeBox is not responsible for the actions, availability, or policies of any third-party service.',
  },
  {
    h: '11. Disclaimer of Warranties',
    body: 'THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND. THEHYPEBOX EXPRESSLY DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS. YOUR USE OF THE SERVICES IS AT YOUR SOLE RISK.',
  },
  {
    h: '12. Limitation of Liability',
    body: 'TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THEHYPEBOX SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, LOST REVENUE, LOST LEADS, OR BUSINESS INTERRUPTION, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICES, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL CUMULATIVE LIABILITY TO YOU FOR ANY CLAIMS ARISING UNDER THESE TERMS SHALL NOT EXCEED THE TOTAL FEES PAID BY YOU TO THEHYPEBOX IN THE THREE (3) MONTHS PRECEDING THE CLAIM.',
  },
  {
    h: '13. Indemnification',
    body: 'You agree to indemnify, defend, and hold harmless TheHypeBox LLC and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable attorneys\' fees) arising out of or related to: (a) your use of the Services; (b) your violation of these Terms; (c) your Client Content; or (d) your violation of any third-party rights or applicable law.',
  },
  {
    h: '14. Termination',
    body: 'Either party may terminate these Terms and your subscription at any time with 30 days written notice. TheHypeBox may terminate immediately upon written notice if you materially breach these Terms and fail to cure such breach within 10 days of notice, if you fail to make timely payment, or if required by law. Upon termination, your right to access the Services ceases. We will retain your data for 90 days post-termination, after which it may be deleted.',
  },
  {
    h: '15. Modifications to Terms',
    body: 'TheHypeBox reserves the right to modify these Terms at any time. We will provide at least 14 days\' prior notice of material changes via email to the address on your account. Your continued use of the Services after the effective date of the revised Terms constitutes your acceptance. If you do not agree to the revised Terms, you must cancel your subscription before the effective date.',
  },
  {
    h: '16. Governing Law and Disputes',
    body: 'These Terms are governed by and construed in accordance with the laws of the State of Ohio, without regard to its conflict of law provisions. Any dispute arising from or relating to these Terms or the Services shall be resolved exclusively in the state or federal courts located in Franklin County, Ohio. You consent to personal jurisdiction in such courts. Before initiating legal action, the parties agree to attempt to resolve disputes informally by contacting us at riley@thehypebox.com.',
  },
  {
    h: '17. Miscellaneous',
    body: 'These Terms, together with our Privacy Policy, constitute the entire agreement between you and TheHypeBox regarding the Services and supersede all prior agreements. If any provision of these Terms is found to be unenforceable, the remaining provisions will remain in full force. Our failure to enforce any right or provision shall not be deemed a waiver of such right or provision. You may not assign your rights under these Terms without our prior written consent. TheHypeBox may assign its rights and obligations freely.',
  },
  {
    h: '18. Contact',
    body: 'TheHypeBox LLC · Westerville, Ohio · riley@thehypebox.com',
  },
];

export default function TermsPage() {
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
            }}>Terms &amp; Conditions</h1>
            <p style={{ color: '#666', fontSize: '0.82rem', letterSpacing: '0.05em' }}>
              TheHypeBox LLC · Last updated: April 2026 · Effective immediately for new subscribers
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '3.5rem 1.5rem 6rem' }}>

          <p style={{ color: '#aaa', fontSize: '0.88rem', lineHeight: 1.8, marginBottom: '3rem', padding: '1.25rem 1.5rem', border: '1px solid #1e1e1e', borderLeft: '3px solid #F5C400', background: '#111' }}>
            Please read these Terms &amp; Conditions carefully before using TheHypeBox. By subscribing to or using our platform, you agree to be legally bound by these terms.
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
            <Link href="/privacy" style={{ color: '#666', fontSize: '0.82rem', textDecoration: 'none', letterSpacing: '0.05em' }}>Privacy Policy →</Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

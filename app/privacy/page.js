import Link from 'next/link';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

export const metadata = { title: 'Privacy Policy — TheHypeBox' };

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main style={{ background: '#0A0A0A', color: '#fff', fontFamily: "'DM Sans', system-ui, sans-serif", minHeight: '100vh' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '80px 24px 100px' }}>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '2.8rem', fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>Privacy Policy</h1>
          <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: 48 }}>Last updated: April 2026</p>

          {[
            { h: '1. Who We Are', body: 'TheHypeBox LLC ("TheHypeBox," "we," "us") provides AI automation services — including AI receptionists, website chatbots, and lead follow-up tools — to local businesses. This Privacy Policy explains how we collect, use, and protect your information. Questions? Email us at riley@thehypebox.com.' },
            { h: '2. Information We Collect', body: 'We collect information you provide directly (name, email, phone number, business details) when you fill out our contact or booking forms. We also collect usage data (pages visited, actions taken) automatically through our platform. When you become a client, we store business profile data, call logs, and automation activity in our systems.' },
            { h: '3. How We Use Your Information', body: 'We use your information to provide and improve our services, contact you about your account, send you relevant communications about your automations and call activity, and comply with legal obligations. We do not sell your personal information to third parties.' },
            { h: '4. Third-Party Services', body: 'Our platform integrates with GoHighLevel (CRM and appointment management), Retell AI (AI phone agent), and Supabase (database infrastructure). Each of these providers has their own privacy policy governing how they handle data processed through their systems.' },
            { h: '5. Data Retention', body: 'We retain your account data for as long as you are an active client. If you cancel your subscription, we retain your data for 90 days before deletion, unless you request earlier removal.' },
            { h: '6. Your Rights', body: 'You may request access to, correction of, or deletion of your personal data at any time by emailing riley@thehypebox.com. We will respond within 30 days.' },
            { h: '7. Security', body: 'We implement industry-standard security measures including encrypted data transmission (TLS), secure credential storage, and access controls. No system is 100% secure, but we take your data protection seriously.' },
            { h: '8. Changes to This Policy', body: 'We may update this policy from time to time. We will notify active clients of material changes via email. Continued use of our services after changes constitutes acceptance of the updated policy.' },
            { h: '9. Contact', body: 'TheHypeBox LLC · riley@thehypebox.com' },
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

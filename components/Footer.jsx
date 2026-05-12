import Link from 'next/link';
import Image from 'next/image';
import styles from '@/styles/marketing.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer} role="contentinfo">
      <div className="container">
        <div className={styles.footerTop}>
          <Link href="/" aria-label="TheHypeBox — Home">
            <Image src="/logo.png" alt="The Hype Box" height={48} width={240} style={{ height: '48px', width: 'auto', display: 'block', mixBlendMode: 'screen' }} />
          </Link>

          <nav aria-label="Footer" className={styles.footerLinks}>
            <a href="#services">Services</a>
            <a href="#pricing">Pricing</a>
            <a href="#booking">Book a Call</a>
            <Link href="/faq">FAQ</Link>
            <Link href="/contact">Contact</Link>
          </nav>

          <div className={styles.footerSocial}>
            {/* Instagram */}
            <a href="https://instagram.com/thehypebox" target="_blank" rel="noopener noreferrer" aria-label="TheHypeBox on Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
              </svg>
            </a>
            {/* Facebook */}
            <a href="https://facebook.com/thehypebox" target="_blank" rel="noopener noreferrer" aria-label="TheHypeBox on Facebook">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
              </svg>
            </a>
          </div>
        </div>

        <div className={styles.footerMicro}>
          No contracts. No complicated setup. Just a smarter way to run your business.
        </div>

        <div className={styles.footerBottom}>
          <span className={styles.footerCopy}>&copy; 2026 TheHypeBox LLC. All rights reserved.</span>
          <div className={styles.footerLegal}>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/refund-policy">Refund Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

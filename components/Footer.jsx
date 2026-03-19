import Link from 'next/link';
import Image from 'next/image';
import styles from '@/styles/marketing.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer} role="contentinfo">
      <div className={`container ${styles.footerInner}`}>
        <Link href="/" className={styles.footerLogo} aria-label="TheHypeBox — Home">
          <Image src="/logo.svg" alt="TheHypeBox" height={80} width={80} style={{ display: 'block', height: '80px', width: 'auto' }} />
        </Link>
        <span className={styles.footerCopy}>&copy; 2026 TheHypeBox. All rights reserved.</span>
      </div>
    </footer>
  );
}

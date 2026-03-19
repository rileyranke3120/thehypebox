'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from '@/styles/marketing.module.css';

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`${styles.nav}${scrolled ? ' ' + styles.navScrolled : ''}`} role="banner">
      <div className={`container ${styles.navInner}`}>
        <Link href="/" className={styles.navLogo} aria-label="TheHypeBox — Home">
          The<span>Hype</span>Box
        </Link>
        <nav aria-label="Primary">
          <ul className={styles.navLinks}>
            <li><a href="#services">Services</a></li>
            <li><a href="#how">How It Works</a></li>
            <li><a href="#booking">Book a Call</a></li>
          </ul>
        </nav>
        <div className={styles.navCta}>
          <Link href="/login" className="btn btn-ghost">Log In</Link>
          <a href="#booking" className="btn btn-primary">Schedule a Free Estimate</a>
        </div>
      </div>
    </header>
  );
}

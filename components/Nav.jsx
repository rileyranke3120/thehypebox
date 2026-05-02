'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from '@/styles/marketing.module.css';

const NAV_LINKS = [
  { href: '#services', label: 'Services' },
  { href: '#how', label: 'How It Works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '/demo', label: 'Demo' },
  { href: '#contact', label: 'Contact Us' },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  function close() { setMenuOpen(false); }

  return (
    <>
      <header className={`${styles.nav}${scrolled ? ' ' + styles.navScrolled : ''}`} role="banner">
        <div className={`container ${styles.navInner}`}>
          <Link href="/" aria-label="TheHypeBox — Home">
            <Image src="/logo.png" alt="The Hype Box" height={44} width={220} style={{ height: '44px', width: 'auto', display: 'block', mixBlendMode: 'screen' }} priority />
          </Link>

          <nav aria-label="Primary">
            <ul className={styles.navLinks}>
              {NAV_LINKS.map(({ href, label }) => (
                <li key={href}><a href={href}>{label}</a></li>
              ))}
            </ul>
          </nav>

          <div className={styles.navCta}>
            <Link href="/login" className="btn btn-ghost">Log In</Link>
          </div>

          {/* Hamburger — mobile only */}
          <button
            className={styles.hamburger}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            <span className={`${styles.hamburgerLine} ${menuOpen ? styles.hamburgerLineTop : ''}`} />
            <span className={`${styles.hamburgerLine} ${menuOpen ? styles.hamburgerLineMid : ''}`} />
            <span className={`${styles.hamburgerLine} ${menuOpen ? styles.hamburgerLineBot : ''}`} />
          </button>
        </div>
      </header>

      {/* Mobile drawer overlay */}
      {menuOpen && (
        <div className={styles.mobileOverlay} onClick={close} aria-hidden="true" />
      )}

      <div className={`${styles.mobileDrawer} ${menuOpen ? styles.mobileDrawerOpen : ''}`} aria-hidden={!menuOpen}>
        <nav aria-label="Mobile navigation">
          <ul className={styles.mobileNavLinks}>
            {NAV_LINKS.map(({ href, label }) => (
              <li key={href}>
                <a href={href} onClick={close}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.mobileDrawerCta}>
          <Link href="/login" className="btn btn-ghost" onClick={close} style={{ width: '100%', justifyContent: 'center' }}>
            Log In
          </Link>
        </div>
      </div>
    </>
  );
}

import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid #1a1a1a', padding: '1.25rem 2rem' }}>
        <Link href="/">
          <Image src="/logo.png" alt="TheHypeBox" height={40} width={200} style={{ display: 'block', height: '40px', width: 'auto', mixBlendMode: 'screen' }} />
        </Link>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '480px' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(5rem, 20vw, 10rem)', fontWeight: 900, color: '#F5C400', lineHeight: 1, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
            404
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.5rem, 4vw, 2rem)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
            Page Not Found
          </h1>
          <p style={{ color: '#666', fontSize: '0.95rem', marginBottom: '2.5rem', lineHeight: 1.6 }}>
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/" className="btn btn-primary" style={{ fontSize: '0.9rem' }}>
              Go Home
            </Link>
            <Link href="/#pricing" style={{ display: 'inline-flex', alignItems: 'center', padding: '0.7rem 1.25rem', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#aaa', fontSize: '0.9rem', textDecoration: 'none', fontFamily: 'var(--font-heading)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              View Pricing
            </Link>
            <Link href="/contact" style={{ display: 'inline-flex', alignItems: 'center', padding: '0.7rem 1.25rem', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#aaa', fontSize: '0.9rem', textDecoration: 'none', fontFamily: 'var(--font-heading)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

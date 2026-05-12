'use client';

export default function Error({ error, reset }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem' }}>
      <div style={{ textAlign: 'center', maxWidth: '480px' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(3rem, 12vw, 6rem)', fontWeight: 900, color: '#E24B4A', lineHeight: 1, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
          Oops
        </div>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
          Something went wrong
        </h1>
        <p style={{ color: '#666', fontSize: '0.95rem', marginBottom: '2.5rem', lineHeight: 1.6 }}>
          An unexpected error occurred. Try refreshing the page — if the problem persists, contact support.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={reset}
            className="btn btn-primary"
            style={{ fontSize: '0.9rem' }}
          >
            Try Again
          </button>
          <a
            href="/"
            style={{ display: 'inline-flex', alignItems: 'center', padding: '0.7rem 1.25rem', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#aaa', fontSize: '0.9rem', textDecoration: 'none', fontFamily: 'var(--font-heading)', letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            Go Home
          </a>
          <a
            href="/contact"
            style={{ display: 'inline-flex', alignItems: 'center', padding: '0.7rem 1.25rem', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#aaa', fontSize: '0.9rem', textDecoration: 'none', fontFamily: 'var(--font-heading)', letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            Contact Support
          </a>
        </div>

        {process.env.NODE_ENV === 'development' && error?.message && (
          <details style={{ marginTop: '2rem', textAlign: 'left', background: '#111', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#555', marginBottom: '0.5rem' }}>Error details (dev only)</summary>
            <pre style={{ fontSize: '0.78rem', color: '#E24B4A', overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{error.message}</pre>
          </details>
        )}
      </div>
    </div>
  );
}

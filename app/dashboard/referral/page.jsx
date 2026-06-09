'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { logout } from '@/app/actions/auth';
import styles from '@/styles/dashboard.module.css';

function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function fmt(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ReferralPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/referral')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData({ error: 'Failed to load referral data.' }))
      .finally(() => setLoading(false));
  }, [status]);

  const referralLink = data?.referralCode
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://thehypeboxllc.com'}/checkout?plan=launch&ref=${data.referralCode}`
    : null;

  async function copyLink() {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (status === 'loading' || status === 'unauthenticated') {
    return <div style={{ minHeight: '100vh', background: '#0a0a0a' }} />;
  }

  const user = session?.user;
  const totalCredits = data?.totalCreditsCents ? (data.totalCreditsCents / 100).toFixed(2) : '0.00';
  const referrals = data?.referrals || [];

  return (
    <div className={styles.dashboardLayout}>

      {/* ── Topbar ── */}
      <header className={styles.topbar}>
        <div className={styles.topbarBrand}>
          <Link href="/" className={styles.topbarLogo}>
            The<span>Hype</span>Box
          </Link>
          <span className={styles.topbarCc}>Command Center</span>
        </div>
        <div className={styles.topbarRight}>
          <div className={styles.topbarUser}>
            <div className={styles.topbarAvatar}>{getInitials(user?.name)}</div>
            <span style={{ fontSize: '0.75rem', color: '#777' }}>{user?.email}</span>
          </div>
        </div>
      </header>

      {/* ── Sidebar ── */}
      <nav className={styles.sidebar} aria-label="Dashboard navigation">
        <span className={styles.sidebarSectionLabel}>Account</span>
        <ul className={styles.sidebarNav}>
          <li>
            <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.65rem 1.25rem', fontSize: '0.85rem', color: '#777', textDecoration: 'none', borderLeft: '2px solid transparent' }}>
              <span className={styles.sidebarIcon} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
              </span>
              Overview
            </Link>
          </li>
          <li>
            <Link href="/dashboard/billing" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.65rem 1.25rem', fontSize: '0.85rem', color: '#777', textDecoration: 'none', borderLeft: '2px solid transparent' }}>
              <span className={styles.sidebarIcon} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2"/>
                  <line x1="2" y1="10" x2="22" y2="10"/>
                </svg>
              </span>
              Billing
            </Link>
          </li>
          <li>
            <a href="#" className={styles.sidebarNavActive} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.65rem 1.25rem', fontSize: '0.85rem', textDecoration: 'none' }}>
              <span className={styles.sidebarIcon} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </span>
              Referrals
            </a>
          </li>
        </ul>

        <div className={styles.sidebarFooter}>
          <form action={logout} style={{ marginBottom: 6 }}>
            <button
              type="submit"
              style={{ display: 'block', width: '100%', background: 'none', border: '1px solid #3a3a3a', borderRadius: 4, color: '#ccc', fontSize: 9, fontFamily: 'var(--font-body)', letterSpacing: '0.04em', padding: '0.4rem', cursor: 'pointer', textAlign: 'center' }}
            >
              Sign Out
            </button>
          </form>
          <Link href="/" className={styles.sidebarBack}>← Back to Site</Link>
        </div>
      </nav>

      {/* ── Main ── */}
      <main className={styles.main} id="main-content">
        <div className={styles.pageHeader}>
          <h1>Referrals</h1>
          <p>Earn $50 account credit for every client you refer</p>
        </div>

        {loading ? (
          <LoadingSkeleton />
        ) : data?.error ? (
          <ErrorState message={data.error} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '680px' }}>

            {/* Credit balance card */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>Your Referral Credits</span>
                {referrals.length > 0 && (
                  <span style={{ fontSize: '0.75rem', color: '#FFD000', background: 'rgba(255,208,0,0.1)', border: '1px solid rgba(255,208,0,0.25)', borderRadius: '4px', padding: '2px 8px' }}>
                    {referrals.length} {referrals.length === 1 ? 'referral' : 'referrals'}
                  </span>
                )}
              </div>
              <div className={styles.panelBody}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#FFD000' }}>${totalCredits}</span>
                  <span style={{ color: '#666', fontSize: '0.9rem' }}>in credits earned</span>
                </div>
                <p style={{ color: '#555', fontSize: '0.82rem', margin: 0 }}>
                  Credits are applied as a balance to your Stripe account and automatically deducted from future invoices.
                </p>
              </div>
            </div>

            {/* Referral link card */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>Your Referral Link</span>
              </div>
              <div className={styles.panelBody}>
                <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: 1.6 }}>
                  Share this link with anyone who could benefit from TheHypeBox. When they sign up and start a trial, you get <strong style={{ color: '#FFD000' }}>$50 credit</strong> applied automatically.
                </p>
                {referralLink ? (
                  <>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0, background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: '4px', padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.82rem', color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {referralLink}
                      </div>
                      <button
                        onClick={copyLink}
                        className="btn btn-primary"
                        style={{ fontSize: '0.82rem', padding: '0.6rem 1.25rem', whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        {copied ? '✓ Copied!' : 'Copy Link'}
                      </button>
                    </div>
                    <p style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#555', margin: '0.75rem 0 0' }}>
                      The link defaults to the Launch Box plan. Your referral can switch plans at checkout.
                    </p>
                  </>
                ) : (
                  <p style={{ color: '#555', fontSize: '0.85rem' }}>
                    Your referral code will appear here once your account is fully activated.
                  </p>
                )}
              </div>
            </div>

            {/* How it works */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>How It Works</span>
              </div>
              <div className={styles.panelBody}>
                <ol style={{ padding: '0 0 0 1.25rem', margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[
                    'Share your referral link with a local business owner who could use AI automation.',
                    'They sign up using your link and start their 14-day free trial.',
                    '$50 is automatically credited to your account — applied to your next invoice.',
                    'You get an SMS notification as soon as they sign up. No limit on referrals.',
                  ].map((step, i) => (
                    <li key={i} style={{ fontSize: '0.87rem', color: '#aaa', lineHeight: 1.6 }}>
                      <span style={{ color: '#FFD000', fontWeight: 700 }}>Step {i + 1}: </span>{step}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Referral history */}
            {referrals.length > 0 && (
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <span className={styles.panelTitle}>Referral History</span>
                </div>
                <div className={styles.panelBody} style={{ padding: 0 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                        <th style={{ padding: '0.75rem 1.25rem', textAlign: 'left', color: '#555', fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>Client</th>
                        <th style={{ padding: '0.75rem 1.25rem', textAlign: 'left', color: '#555', fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>Credit</th>
                        <th style={{ padding: '0.75rem 1.25rem', textAlign: 'left', color: '#555', fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>Status</th>
                        <th style={{ padding: '0.75rem 1.25rem', textAlign: 'left', color: '#555', fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referrals.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #111' }}>
                          <td style={{ padding: '0.75rem 1.25rem', color: '#ccc' }}>{r.referred_email}</td>
                          <td style={{ padding: '0.75rem 1.25rem', color: '#FFD000', fontWeight: 600 }}>${(r.credit_cents / 100).toFixed(2)}</td>
                          <td style={{ padding: '0.75rem 1.25rem' }}>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: r.stripe_credit_applied ? '#28C840' : '#F5C400',
                              background: r.stripe_credit_applied ? 'rgba(40,200,64,0.1)' : 'rgba(245,196,0,0.1)',
                              border: `1px solid ${r.stripe_credit_applied ? 'rgba(40,200,64,0.3)' : 'rgba(245,196,0,0.3)'}`,
                              borderRadius: '4px',
                              padding: '2px 8px',
                            }}>
                              {r.stripe_credit_applied ? 'Applied' : 'Pending'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1.25rem', color: '#666' }}>{fmt(r.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {[80, 140, 120].map((h, i) => (
        <div key={i} style={{ height: h, background: '#111', border: '1px solid #1a1a1a', borderRadius: '4px', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ))}
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div style={{ maxWidth: '480px', padding: '2rem', background: '#111', border: '1px solid #2a2a2a', borderRadius: '4px', textAlign: 'center' }}>
      <p style={{ color: '#E24B4A', fontSize: '0.9rem', marginBottom: '1rem' }}>{message}</p>
      <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>Try Again</button>
    </div>
  );
}

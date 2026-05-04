'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { logout } from '@/app/actions/auth';
import styles from '@/styles/dashboard.module.css';

const PLAN_NAMES = {
  launch: 'The Launch Box',
  rocket: 'The Rocket Box',
  velocity: 'The Velocity Box',
};

const PLAN_PRICES = {
  launch: 97,
  rocket: 297,
  velocity: 497,
};

const STATUS_CONFIG = {
  trialing: { label: 'Free Trial', color: '#F5C400', bg: 'rgba(245,196,0,0.1)', dot: '#F5C400' },
  active:   { label: 'Active',     color: '#28C840', bg: 'rgba(40,200,64,0.1)',  dot: '#28C840' },
  canceled: { label: 'Canceled',   color: '#888',    bg: 'rgba(136,136,136,0.1)', dot: '#555' },
  past_due: { label: 'Payment Failed', color: '#E24B4A', bg: 'rgba(226,75,74,0.1)', dot: '#E24B4A' },
};

function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function fmt(ms) {
  return new Date(ms).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function daysUntil(ms) {
  const diff = ms - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function BillingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/billing/subscription')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setSub(data);
      })
      .catch(() => setError('Failed to load subscription data.'))
      .finally(() => setLoading(false));
  }, [status]);

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/create-portal-session', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Could not open billing portal.');
        setPortalLoading(false);
      }
    } catch {
      setError('Could not open billing portal.');
      setPortalLoading(false);
    }
  }

  if (status === 'loading' || (status === 'unauthenticated')) {
    return <div style={{ minHeight: '100vh', background: '#0a0a0a' }} />;
  }

  const user = session?.user;
  const planName = PLAN_NAMES[sub?.plan] || '—';
  const planPrice = PLAN_PRICES[sub?.plan] || null;
  const statusCfg = STATUS_CONFIG[sub?.planStatus] || STATUS_CONFIG.active;
  const trialDays = sub?.trialEnd ? daysUntil(sub.trialEnd) : 0;

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
            <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.65rem 1.25rem', fontSize: '0.85rem', color: '#777', textDecoration: 'none', borderLeft: '2px solid transparent', transition: 'color 150ms ease' }}>
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
            <a href="#" className={styles.sidebarNavActive} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.65rem 1.25rem', fontSize: '0.85rem', textDecoration: 'none' }}>
              <span className={styles.sidebarIcon} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2"/>
                  <line x1="2" y1="10" x2="22" y2="10"/>
                </svg>
              </span>
              Billing
            </a>
          </li>
        </ul>

        <div className={styles.sidebarFooter}>
          <form action={logout} style={{ marginBottom: 6 }}>
            <button
              type="submit"
              style={{ display: 'block', width: '100%', background: 'none', border: '1px solid #3a3a3a', borderRadius: 4, color: '#ccc', fontSize: 9, fontFamily: 'var(--font-body)', letterSpacing: '0.04em', padding: '0.4rem', cursor: 'pointer', textAlign: 'center', transition: 'color 150ms ease, border-color 150ms ease' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#666'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#ccc'; e.currentTarget.style.borderColor = '#3a3a3a'; }}
            >
              Sign Out
            </button>
          </form>
          <Link href="/" className={styles.sidebarBack}>← Back to Site</Link>
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className={styles.main} id="main-content">
        <div className={styles.pageHeader}>
          <h1>Billing</h1>
          <p>Manage your subscription and payment method</p>
        </div>

        {/* Past due alert */}
        {sub?.planStatus === 'past_due' && (
          <div style={{ margin: '0 0 1.5rem', padding: '1rem 1.25rem', background: 'rgba(226,75,74,0.1)', border: '1px solid rgba(226,75,74,0.3)', borderLeft: '3px solid #E24B4A', borderRadius: '4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <p style={{ color: '#E24B4A', fontWeight: 600, fontSize: '0.9rem', margin: '0 0 0.25rem' }}>Payment Failed</p>
              <p style={{ color: '#aaa', fontSize: '0.85rem', margin: 0 }}>Your last payment didn&apos;t go through. Update your payment method to avoid service interruption.</p>
            </div>
            <button onClick={openPortal} disabled={portalLoading} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.5rem 1rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {portalLoading ? 'Opening…' : 'Update Payment'}
            </button>
          </div>
        )}

        {/* Cancellation notice */}
        {sub?.cancelAtPeriodEnd && sub?.planStatus !== 'canceled' && (
          <div style={{ margin: '0 0 1.5rem', padding: '1rem 1.25rem', background: 'rgba(245,196,0,0.08)', border: '1px solid rgba(245,196,0,0.25)', borderLeft: '3px solid #F5C400', borderRadius: '4px' }}>
            <p style={{ color: '#F5C400', fontWeight: 600, fontSize: '0.9rem', margin: '0 0 0.25rem' }}>Cancellation Scheduled</p>
            <p style={{ color: '#aaa', fontSize: '0.85rem', margin: 0 }}>
              Your subscription is set to cancel on {fmt(sub.currentPeriodEnd)}. You&apos;ll keep access until then.{' '}
              <button onClick={openPortal} style={{ background: 'none', border: 'none', color: '#F5C400', cursor: 'pointer', fontSize: '0.85rem', padding: 0, textDecoration: 'underline' }}>Undo cancellation →</button>
            </p>
          </div>
        )}

        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState message={error} />
        ) : sub?.noSubscription ? (
          <NoSubscriptionView />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '680px' }}>

            {/* Current plan card */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>Current Plan</span>
                <StatusBadge cfg={statusCfg} />
              </div>
              <div className={styles.panelBody}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 900, letterSpacing: '0.04em', color: '#fff', textTransform: 'uppercase' }}>{planName}</span>
                </div>
                {planPrice && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span style={{ fontSize: '2rem', fontWeight: 800, color: '#F5C400' }}>${planPrice}</span>
                    <span style={{ color: '#666', fontSize: '0.9rem' }}>/month</span>
                  </div>
                )}
              </div>
            </div>

            {/* Trial info */}
            {sub?.planStatus === 'trialing' && sub?.trialEnd && (
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <span className={styles.panelTitle}>Free Trial</span>
                  <span style={{ fontSize: '0.75rem', color: '#F5C400', background: 'rgba(245,196,0,0.1)', border: '1px solid rgba(245,196,0,0.25)', borderRadius: '4px', padding: '2px 8px' }}>
                    {trialDays} {trialDays === 1 ? 'day' : 'days'} remaining
                  </span>
                </div>
                <div className={styles.panelBody}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <BillingRow label="Trial ends" value={fmt(sub.trialEnd)} />
                    <BillingRow label="First payment" value={planPrice ? `$${planPrice} on ${fmt(sub.trialEnd)}` : '—'} />
                  </div>
                  {trialDays <= 3 && (
                    <p style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: '#F5C400' }}>
                      ⚠ Trial ends soon. Cancel before {fmt(sub.trialEnd)} to avoid being charged.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Billing details */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>Billing Details</span>
              </div>
              <div className={styles.panelBody}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <BillingRow
                    label="Payment method"
                    value={sub?.last4
                      ? `${sub.cardBrand ? sub.cardBrand.charAt(0).toUpperCase() + sub.cardBrand.slice(1) : 'Card'} •••• ${sub.last4}`
                      : 'No card on file'
                    }
                  />
                  {sub?.planStatus !== 'canceled' && sub?.currentPeriodEnd && (
                    <BillingRow
                      label={sub.planStatus === 'trialing' ? 'Trial ends' : sub.cancelAtPeriodEnd ? 'Access until' : 'Next billing date'}
                      value={fmt(sub.currentPeriodEnd)}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>Manage Subscription</span>
              </div>
              <div className={styles.panelBody} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <PortalButton onClick={openPortal} loading={portalLoading} primary>
                  Manage Subscription
                </PortalButton>
                <PortalButton onClick={openPortal} loading={portalLoading}>
                  Update Payment Method
                </PortalButton>
                <PortalButton onClick={openPortal} loading={portalLoading}>
                  View Invoices
                </PortalButton>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#555', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #1a1a1a' }}>
                Subscription management is handled securely by Stripe. You&apos;ll be redirected to their portal and returned here when done.
              </p>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ cfg }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}33`, borderRadius: '4px', padding: '3px 10px' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

function BillingRow({ label, value }) {
  return (
    <div>
      <p style={{ fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#555', margin: '0 0 4px', fontFamily: 'var(--font-heading)' }}>{label}</p>
      <p style={{ fontSize: '0.9rem', color: '#ccc', margin: 0 }}>{value}</p>
    </div>
  );
}

function PortalButton({ onClick, loading, primary, children }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={primary ? 'btn btn-primary' : undefined}
      style={primary ? { fontSize: '0.85rem', padding: '0.6rem 1.25rem', opacity: loading ? 0.7 : 1 } : {
        background: 'none',
        border: '1px solid #2a2a2a',
        borderRadius: '4px',
        color: '#aaa',
        fontSize: '0.85rem',
        padding: '0.6rem 1.25rem',
        cursor: 'pointer',
        transition: 'border-color 150ms ease, color 150ms ease',
        opacity: loading ? 0.7 : 1,
      }}
      onMouseEnter={e => { if (!primary) { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#fff'; } }}
      onMouseLeave={e => { if (!primary) { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#aaa'; } }}
    >
      {loading ? 'Opening…' : children}
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {[120, 80, 100].map((h, i) => (
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

function NoSubscriptionView() {
  return (
    <div style={{ maxWidth: '480px', padding: '3rem 2rem', background: '#111', border: '1px solid #1a1a1a', borderRadius: '4px', textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
        </svg>
      </div>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>No Active Subscription</h2>
      <p style={{ color: '#666', fontSize: '0.88rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>You don&apos;t have an active subscription yet. Get started with a 14-day free trial.</p>
      <Link href="/#pricing" className="btn btn-primary" style={{ fontSize: '0.88rem' }}>See Pricing Plans →</Link>
    </div>
  );
}

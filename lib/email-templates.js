// ============================================================
//  TheHypeBox — Transactional Email Templates
//  All emails use the dark brand style to match the welcome email.
// ============================================================

const YELLOW = '#FFD000';
const APP_URL = 'https://thehypeboxllc.com';

const PLAN_LABELS = {
  launch:   'The Launch Box',
  rocket:   'The Rocket Box',
  velocity: 'The Velocity Box',
};

function wrap(body) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:48px 24px;">

    <div style="margin-bottom:32px;">
      <a href="${APP_URL}" style="font-size:1.4rem;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:${YELLOW};text-decoration:none;">
        THE HYPE BOX
      </a>
    </div>

    ${body}

    <div style="margin-top:48px;padding-top:24px;border-top:1px solid #1a1a1a;">
      <p style="font-size:0.75rem;color:#444;margin:0;line-height:1.6;">
        TheHypeBox LLC &nbsp;·&nbsp;
        <a href="${APP_URL}/dashboard/billing" style="color:#555;">Manage subscription</a> &nbsp;·&nbsp;
        <a href="mailto:riley@thehypeboxllc.com" style="color:#555;">riley@thehypeboxllc.com</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

// ── 1. Welcome ────────────────────────────────────────────────
export function welcomeEmail({ name, email, password, plan, trialEndDate }) {
  const firstName = name ? name.split(' ')[0] : 'friend';
  const planLabel = PLAN_LABELS[plan] || plan;
  const loginUrl  = `${APP_URL}/login`;

  const body = `
    <h1 style="font-size:1.75rem;font-weight:800;color:#fff;margin:0 0 8px;">
      You're in, ${firstName}! 🎉
    </h1>
    <p style="font-size:1rem;color:#999;margin:0 0 32px;">
      Your <strong style="color:${YELLOW};">${planLabel}</strong> 14-day free trial is now active.
    </p>

    <div style="background:#111;border:1px solid #222;border-radius:8px;padding:24px;margin-bottom:32px;">
      <p style="font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#666;margin:0 0 16px;">
        Your Login Credentials
      </p>
      <div style="margin-bottom:12px;">
        <p style="font-size:0.7rem;color:#555;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">Email</p>
        <p style="font-size:1rem;color:#fff;margin:0;font-family:monospace;">${email}</p>
      </div>
      <div>
        <p style="font-size:0.7rem;color:#555;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">Temporary Password</p>
        <p style="font-size:1.2rem;color:${YELLOW};margin:0;font-family:monospace;font-weight:700;letter-spacing:0.1em;">${password}</p>
      </div>
    </div>

    <a href="${loginUrl}" style="display:inline-block;background:${YELLOW};color:#000;font-weight:700;font-size:1rem;padding:14px 32px;border-radius:4px;text-decoration:none;">
      Log In to Your Dashboard →
    </a>

    <p style="font-size:0.82rem;color:#555;margin:32px 0 0;line-height:1.6;">
      Your trial runs until ${trialEndDate} — no charge until then.<br>
      We recommend changing your password after your first login.
    </p>
  `;

  return {
    subject: 'Welcome to TheHypeBox — Your login details inside',
    html: wrap(body),
  };
}

// ── 2. Trial Ending in 3 Days ─────────────────────────────────
export function trialEndingEmail({ name, plan, planPrice, trialEndDate }) {
  const firstName = name ? name.split(' ')[0] : 'there';
  const planLabel = PLAN_LABELS[plan] || plan;
  const portalUrl = `${APP_URL}/dashboard/billing`;

  const body = `
    <h1 style="font-size:1.75rem;font-weight:800;color:#fff;margin:0 0 8px;">
      Your trial ends in 3 days
    </h1>
    <p style="font-size:1rem;color:#999;margin:0 0 32px;">
      Hi ${firstName}, your free trial of <strong style="color:#fff;">${planLabel}</strong> wraps up on ${trialEndDate}.
    </p>

    <div style="background:#111;border:1px solid #222;border-left:3px solid ${YELLOW};border-radius:4px;padding:24px;margin-bottom:32px;">
      <p style="font-size:0.7rem;letter-spacing:0.1em;text-transform:uppercase;color:#666;margin:0 0 12px;">
        What happens next
      </p>
      <p style="font-size:0.95rem;color:#ccc;margin:0 0 8px;">
        ✓ First payment of <strong style="color:#fff;">$${planPrice}/mo</strong> on ${trialEndDate}
      </p>
      <p style="font-size:0.95rem;color:#ccc;margin:0 0 8px;">
        ✓ Billed monthly on the same date
      </p>
      <p style="font-size:0.95rem;color:#ccc;margin:0;">
        ✓ Cancel before then and you won't be charged a thing
      </p>
    </div>

    <p style="font-size:0.95rem;color:#999;margin:0 0 24px;line-height:1.6;">
      <strong style="color:#fff;">Staying?</strong> No action needed — we'll take care of it automatically.<br>
      <strong style="color:#fff;">Canceling?</strong> Click below to manage your subscription.
    </p>

    <a href="${portalUrl}" style="display:inline-block;background:${YELLOW};color:#000;font-weight:700;font-size:1rem;padding:14px 32px;border-radius:4px;text-decoration:none;">
      Manage Subscription →
    </a>
  `;

  return {
    subject: `Your TheHypeBox trial ends in 3 days`,
    html: wrap(body),
  };
}

// ── 3. Payment Successful ─────────────────────────────────────
export function paymentSuccessEmail({ name, plan, amountCents, nextBillingDate, invoiceUrl }) {
  const firstName  = name ? name.split(' ')[0] : 'there';
  const planLabel  = PLAN_LABELS[plan] || plan;
  const amount     = `$${(amountCents / 100).toFixed(2)}`;
  const dashUrl    = `${APP_URL}/dashboard`;

  const body = `
    <h1 style="font-size:1.75rem;font-weight:800;color:#fff;margin:0 0 8px;">
      Payment received — thank you!
    </h1>
    <p style="font-size:1rem;color:#999;margin:0 0 32px;">
      Hi ${firstName}, we've successfully processed your payment for <strong style="color:#fff;">${planLabel}</strong>.
    </p>

    <div style="background:#111;border:1px solid #222;border-radius:8px;padding:24px;margin-bottom:32px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
        <span style="font-size:0.7rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Amount Paid</span>
        <span style="font-size:1rem;color:${YELLOW};font-weight:700;">${amount}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:${invoiceUrl ? '16px' : '0'};">
        <span style="font-size:0.7rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Next Billing Date</span>
        <span style="font-size:0.95rem;color:#ccc;">${nextBillingDate}</span>
      </div>
      ${invoiceUrl ? `
      <div style="display:flex;justify-content:space-between;">
        <span style="font-size:0.7rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Invoice</span>
        <a href="${invoiceUrl}" style="font-size:0.95rem;color:${YELLOW};">View Receipt →</a>
      </div>` : ''}
    </div>

    <a href="${dashUrl}" style="display:inline-block;background:${YELLOW};color:#000;font-weight:700;font-size:1rem;padding:14px 32px;border-radius:4px;text-decoration:none;">
      Go to Dashboard →
    </a>
  `;

  return {
    subject: 'Payment received — TheHypeBox subscription active',
    html: wrap(body),
  };
}

// ── 4. Payment Failed ─────────────────────────────────────────
export function paymentFailedEmail({ name, plan, amountCents, updateUrl }) {
  const firstName = name ? name.split(' ')[0] : 'there';
  const planLabel = PLAN_LABELS[plan] || plan;
  const amount    = `$${(amountCents / 100).toFixed(2)}`;

  const body = `
    <h1 style="font-size:1.75rem;font-weight:800;color:#E24B4A;margin:0 0 8px;">
      Action required: payment failed
    </h1>
    <p style="font-size:1rem;color:#999;margin:0 0 32px;">
      Hi ${firstName}, we weren't able to process your payment of <strong style="color:#fff;">${amount}</strong> for <strong style="color:#fff;">${planLabel}</strong>.
    </p>

    <div style="background:#111;border:1px solid #2a1a1a;border-left:3px solid #E24B4A;border-radius:4px;padding:24px;margin-bottom:32px;">
      <p style="font-size:0.7rem;letter-spacing:0.1em;text-transform:uppercase;color:#666;margin:0 0 12px;">
        What to do
      </p>
      <p style="font-size:0.95rem;color:#ccc;margin:0 0 8px;">
        1. Update your payment method within <strong style="color:#fff;">7 days</strong>
      </p>
      <p style="font-size:0.95rem;color:#ccc;margin:0;">
        2. After 7 days your account will be suspended until payment is resolved
      </p>
    </div>

    <p style="font-size:0.85rem;color:#666;margin:0 0 24px;line-height:1.6;">
      Common causes: expired card, insufficient funds, or billing address mismatch.
    </p>

    <a href="${updateUrl}" style="display:inline-block;background:#E24B4A;color:#fff;font-weight:700;font-size:1rem;padding:14px 32px;border-radius:4px;text-decoration:none;">
      Update Payment Method →
    </a>

    <p style="font-size:0.82rem;color:#555;margin:24px 0 0;line-height:1.6;">
      Questions? <a href="mailto:riley@thehypeboxllc.com" style="color:${YELLOW};">riley@thehypeboxllc.com</a>
    </p>
  `;

  return {
    subject: 'Action required: payment failed for TheHypeBox',
    html: wrap(body),
  };
}

// ── 5. HighLevel Account Access ───────────────────────────────
export function highLevelAccessEmail({ name, plan, locationId, hlEmail, hlPassword, dashboardUrl }) {
  const firstName  = name ? name.split(' ')[0] : 'there';
  const planLabel  = PLAN_LABELS[plan] || plan;
  const supportUrl = `mailto:riley@thehypeboxllc.com`;

  const body = `
    <h1 style="font-size:1.75rem;font-weight:800;color:#fff;margin:0 0 8px;">
      Your AI tools are ready, ${firstName}!
    </h1>
    <p style="font-size:1rem;color:#999;margin:0 0 32px;">
      We've set up your <strong style="color:${YELLOW};">${planLabel}</strong> account in our automation platform.
      Here's everything you need to get started.
    </p>

    <div style="background:#111;border:1px solid #222;border-radius:8px;padding:24px;margin-bottom:24px;">
      <p style="font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#666;margin:0 0 20px;">
        Your Platform Login (GoHighLevel)
      </p>
      <div style="margin-bottom:12px;">
        <p style="font-size:0.7rem;color:#555;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">Email</p>
        <p style="font-size:1rem;color:#fff;margin:0;font-family:monospace;">${hlEmail}</p>
      </div>
      ${hlPassword ? `
      <div style="margin-bottom:20px;">
        <p style="font-size:0.7rem;color:#555;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">Temporary Password</p>
        <p style="font-size:1.2rem;color:${YELLOW};margin:0;font-family:monospace;font-weight:700;letter-spacing:0.1em;">${hlPassword}</p>
      </div>
      <p style="font-size:0.8rem;color:#555;margin:0;line-height:1.5;">
        Change this password after your first login.
      </p>` : `
      <p style="font-size:0.85rem;color:#999;margin:12px 0 0;line-height:1.5;">
        It looks like you already have a GoHighLevel account — use your existing password to log in.
      </p>`}
    </div>

    <a href="${dashboardUrl}" style="display:inline-block;background:${YELLOW};color:#000;font-weight:700;font-size:1rem;padding:14px 32px;border-radius:4px;text-decoration:none;margin-bottom:32px;">
      Open Your Platform →
    </a>

    <div style="background:#111;border:1px solid #222;border-left:3px solid ${YELLOW};border-radius:4px;padding:20px;margin-bottom:24px;">
      <p style="font-size:0.7rem;letter-spacing:0.1em;text-transform:uppercase;color:#666;margin:0 0 12px;">
        What's ready for you
      </p>
      <p style="font-size:0.9rem;color:#ccc;margin:0 0 8px;">✓ AI receptionist (answers calls 24/7)</p>
      <p style="font-size:0.9rem;color:#ccc;margin:0 0 8px;">✓ Automated lead follow-up sequences</p>
      <p style="font-size:0.9rem;color:#ccc;margin:0 0 8px;">✓ Website chat widget pre-installed</p>
      <p style="font-size:0.9rem;color:#ccc;margin:0;">✓ CRM with your contacts pipeline</p>
    </div>

    <p style="font-size:0.85rem;color:#666;margin:0;line-height:1.6;">
      Need help getting set up?
      <a href="${supportUrl}" style="color:${YELLOW};">Reply to this email</a> — we'll walk you through everything.
    </p>
  `;

  return {
    subject: `Your AI platform is live — login details inside`,
    html: wrap(body),
  };
}

// ── 6. Subscription Canceled ──────────────────────────────────
export function subscriptionCanceledEmail({ name, plan, accessEndDate }) {
  const firstName = name ? name.split(' ')[0] : 'there';
  const planLabel = PLAN_LABELS[plan] || plan;
  const restartUrl = `${APP_URL}/#pricing`;

  const body = `
    <h1 style="font-size:1.75rem;font-weight:800;color:#fff;margin:0 0 8px;">
      Subscription canceled
    </h1>
    <p style="font-size:1rem;color:#999;margin:0 0 32px;">
      Hi ${firstName}, your <strong style="color:#fff;">${planLabel}</strong> subscription has been canceled.
    </p>

    <div style="background:#111;border:1px solid #222;border-radius:8px;padding:24px;margin-bottom:32px;">
      <p style="font-size:0.7rem;letter-spacing:0.1em;text-transform:uppercase;color:#666;margin:0 0 12px;">
        Access until
      </p>
      <p style="font-size:1.1rem;color:#fff;font-weight:600;margin:0;">
        ${accessEndDate}
      </p>
      <p style="font-size:0.85rem;color:#666;margin:8px 0 0;line-height:1.5;">
        You'll keep full access until the end of your current billing period.
      </p>
    </div>

    <p style="font-size:0.95rem;color:#999;margin:0 0 24px;line-height:1.6;">
      We're sorry to see you go. If you change your mind, you can restart any time — no setup fee.
    </p>

    <a href="${restartUrl}" style="display:inline-block;background:${YELLOW};color:#000;font-weight:700;font-size:1rem;padding:14px 32px;border-radius:4px;text-decoration:none;">
      Restart Subscription →
    </a>

    <p style="font-size:0.82rem;color:#555;margin:24px 0 0;line-height:1.6;">
      Have feedback? We'd love to hear it —
      <a href="mailto:riley@thehypeboxllc.com" style="color:${YELLOW};">riley@thehypeboxllc.com</a>
    </p>
  `;

  return {
    subject: 'Your TheHypeBox subscription has been canceled',
    html: wrap(body),
  };
}

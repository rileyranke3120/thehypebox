import { NextResponse } from 'next/server';
import stripe from '@/lib/stripe';
import { createClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/send-email';

const PLAN_CONFIG = {
  launch:   { internal: 'launch',   priceEnv: 'STRIPE_PRICE_LAUNCH' },
  rocket:   { internal: 'rocket',   priceEnv: 'STRIPE_PRICE_ROCKET' },
  velocity: { internal: 'velocity', priceEnv: 'STRIPE_PRICE_VELOCITY' },
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// IP-based rate limit: 3 checkout attempts per hour per IP — atomic via stored procedure
async function checkCheckoutRateLimit(ip) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_and_increment_checkout_rate_limit`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_ip: `checkout:${ip}`, p_max: 3, p_window_seconds: 3600 }),
    });
    return res.ok ? await res.json() : false; // fail closed if RPC unavailable
  } catch {
    return false;
  }
}

export async function POST(request) {
  try {
    const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown';
    if (!(await checkCheckoutRateLimit(ip))) {
      return NextResponse.json({ error: 'Too many checkout attempts. Please wait before trying again.' }, { status: 429 });
    }

    const body = await request.json();

    // Honeypot — bots fill in hidden fields that humans leave blank
    if (body.website) {
      return NextResponse.json({ error: 'Invalid submission.' }, { status: 400 });
    }

    const { plan, email, name, phone, niche, ref } = body;
    const nicheSlug = typeof niche === 'string' ? niche.slice(0, 50).replace(/[^a-z0-9_-]/gi, '') : '';

    if (!plan || !PLAN_CONFIG[plan]) {
      return NextResponse.json({ error: 'Invalid plan selected.' }, { status: 400 });
    }
    if (!email || !name) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }
    if (name.length > 200) {
      return NextResponse.json({ error: 'Name must be 200 characters or fewer.' }, { status: 400 });
    }
    if (phone && phone.length > 30) {
      return NextResponse.json({ error: 'Phone must be 30 characters or fewer.' }, { status: 400 });
    }

    const config = PLAN_CONFIG[plan];
    const priceId = process.env[config.priceEnv];
    if (!priceId) {
      return NextResponse.json({ error: 'This plan is not yet available.' }, { status: 503 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const supabase = createClient();
    const { data: existingUser } = await supabase
      .from('users')
      .select('stripe_customer_id, stripe_subscription_id, plan_status')
      .eq('email', normalizedEmail)
      .single();

    // Fast-path guard: DB says this account is already active or mid-checkout.
    // Reject immediately without hitting Stripe — prevents account state corruption.
    if (existingUser && ['active', 'trialing', 'pending'].includes(existingUser.plan_status)) {
      return NextResponse.json(
        { error: 'An active subscription already exists for this email. Please log in or contact support.' },
        { status: 409 }
      );
    }

    // Belt-and-suspenders: also verify Stripe directly if a subscription ID exists in DB
    // (handles edge cases where DB status is stale after a canceled re-subscribe attempt).
    if (existingUser?.stripe_subscription_id) {
      try {
        const sub = await stripe.subscriptions.retrieve(existingUser.stripe_subscription_id);
        if (['active', 'trialing', 'incomplete'].includes(sub.status)) {
          return NextResponse.json(
            { error: 'An active subscription already exists for this email. Please log in or contact support.' },
            { status: 409 }
          );
        }
      } catch {
        // Subscription not found in Stripe — allow checkout to proceed
      }
    }

    // Idempotency key scoped to email + plan so concurrent requests produce one customer/subscription.
    const idempotencyBase = Buffer.from(`${normalizedEmail}:${plan}`).toString('base64url');

    const customer = await stripe.customers.create(
      {
        email: normalizedEmail,
        name: name.trim(),
        metadata: { plan, source: 'thehypeboxllc.com', ...(nicheSlug ? { niche: nicheSlug } : {}) },
      },
      { idempotencyKey: `cus-${idempotencyBase}` }
    );

    const subscription = await stripe.subscriptions.create(
      {
        customer: customer.id,
        items: [{ price: priceId }],
        trial_period_days: 14,
        payment_behavior: 'default_incomplete',
        expand: ['pending_setup_intent'],
      },
      { idempotencyKey: `sub-${idempotencyBase}` }
    );

    const setupIntent = subscription.pending_setup_intent;
    if (!setupIntent?.client_secret) {
      throw new Error('No setup intent returned — check that price is recurring.');
    }

    const upsertData = {
      email: normalizedEmail,
      plan: config.internal,
      plan_status: 'pending',
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id,
    };
    // Only write name for brand-new users — prevents checkout from overwriting an existing
    // user's name if an attacker submits checkout with a known email address.
    if (!existingUser) upsertData.name = name.trim();
    if (phone?.trim()) upsertData.business_phone = phone.trim();
    // Store referral code only for brand-new users (never overwrite an existing one)
    if (!existingUser && ref && /^[A-Z0-9]{8}$/.test(ref.toUpperCase())) {
      upsertData.referred_by_code = ref.toUpperCase();
    }

    const { error: upsertError } = await supabase.from('users').upsert(upsertData, { onConflict: 'email' });
    if (upsertError) {
      console.error('[checkout] CRITICAL — Stripe subscription created but Supabase upsert failed:', upsertError.message, {
        email: upsertData.email,
        stripeCustomerId: customer.id,
        stripeSubscriptionId: subscription.id,
      });
      sendEmail({
        to: 'riley@thehypeboxllc.com',
        subject: '🚨 CRITICAL: Checkout DB write failed — manual fix needed',
        html: `<p>Stripe subscription was created but the Supabase upsert failed. User has been charged but has no account.</p>
<ul>
  <li><strong>Email:</strong> ${upsertData.email}</li>
  <li><strong>Name:</strong> ${upsertData.name}</li>
  <li><strong>Plan:</strong> ${upsertData.plan}</li>
  <li><strong>Stripe Customer:</strong> ${customer.id}</li>
  <li><strong>Stripe Subscription:</strong> ${subscription.id}</li>
  <li><strong>Error:</strong> ${upsertError.message}</li>
</ul>`,
      }).catch((e) => console.error('[checkout] alert email also failed:', e.message));
    }

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      subscriptionId: subscription.id,
    });
  } catch (err) {
    console.error('[checkout]', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

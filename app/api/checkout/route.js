import { NextResponse } from 'next/server';
import stripe from '@/lib/stripe';
import { createClient } from '@/lib/supabase';

const PLAN_CONFIG = {
  launch:   { internal: 'starter', priceEnv: 'STRIPE_PRICE_LAUNCH',   label: 'The Launch Box'   },
  rocket:   { internal: 'growth',  priceEnv: 'STRIPE_PRICE_ROCKET',   label: 'The Rocket Box'   },
  velocity: { internal: 'pro',     priceEnv: 'STRIPE_PRICE_VELOCITY', label: 'The Velocity Box' },
};

export async function POST(request) {
  try {
    const { plan, email, name } = await request.json();

    if (!plan || !PLAN_CONFIG[plan]) {
      return NextResponse.json({ error: 'Invalid plan selected.' }, { status: 400 });
    }
    if (!email || !name) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
    }

    const config = PLAN_CONFIG[plan];
    const priceId = process.env[config.priceEnv];

    if (!priceId) {
      return NextResponse.json({ error: 'This plan is not yet available.' }, { status: 503 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://thehypeboxllc.com';

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email: email.toLowerCase().trim(),
      name: name.trim(),
      metadata: { plan, internal_plan: config.internal, source: 'thehypeboxllc.com' },
    });

    // Save to Supabase immediately
    const supabase = createClient();
    await supabase.from('users').upsert(
      {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        plan: config.internal,
        plan_status: 'pending',
        stripe_customer_id: customer.id,
      },
      { onConflict: 'email' }
    );

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { trial_period_days: 14 },
      success_url: `${appUrl}/trial-confirmed?plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/#pricing`,
      customer_update: { address: 'auto' },
      metadata: { plan, name: name.trim() },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[checkout]', err);
    return NextResponse.json({ error: err.message || 'Something went wrong.' }, { status: 500 });
  }
}

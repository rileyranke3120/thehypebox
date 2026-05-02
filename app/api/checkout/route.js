import { NextResponse } from 'next/server';
import stripe from '@/lib/stripe';
import { createClient } from '@/lib/supabase';

const PLAN_CONFIG = {
  launch:   { internal: 'starter', priceEnv: 'STRIPE_PRICE_LAUNCH' },
  rocket:   { internal: 'growth',  priceEnv: 'STRIPE_PRICE_ROCKET' },
  velocity: { internal: 'pro',     priceEnv: 'STRIPE_PRICE_VELOCITY' },
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

    const customer = await stripe.customers.create({
      email: email.toLowerCase().trim(),
      name: name.trim(),
      metadata: { plan, source: 'thehypeboxllc.com' },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      trial_period_days: 14,
      payment_behavior: 'default_incomplete',
      expand: ['pending_setup_intent'],
    });

    const setupIntent = subscription.pending_setup_intent;
    if (!setupIntent?.client_secret) {
      throw new Error('No setup intent returned — check that price is recurring.');
    }

    const supabase = createClient();
    await supabase.from('users').upsert(
      {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        plan: config.internal,
        plan_status: 'pending',
        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription.id,
      },
      { onConflict: 'email' }
    );

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      subscriptionId: subscription.id,
    });
  } catch (err) {
    console.error('[checkout]', err);
    return NextResponse.json({ error: err.message || 'Something went wrong.' }, { status: 500 });
  }
}

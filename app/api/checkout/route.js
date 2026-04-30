import { NextResponse } from 'next/server';
import stripe from '@/lib/stripe';
import { createClient } from '@/lib/supabase';

// Maps public plan slugs → internal plan name + Stripe price ID env var
const PLAN_CONFIG = {
  launch:   { internal: 'starter', priceEnv: 'STRIPE_PRICE_LAUNCH',   label: 'The Launch Box'   },
  rocket:   { internal: 'growth',  priceEnv: 'STRIPE_PRICE_ROCKET',   label: 'The Rocket Box'   },
  velocity: { internal: 'pro',     priceEnv: 'STRIPE_PRICE_VELOCITY', label: 'The Velocity Box' },
};

export async function POST(request) {
  try {
    const { plan, email, name } = await request.json();

    // Validate inputs
    if (!plan || !PLAN_CONFIG[plan]) {
      return NextResponse.json({ error: 'Invalid plan selected.' }, { status: 400 });
    }
    if (!email || !name) {
      return NextResponse.json({ error: 'Name and email are required.' }, { status: 400 });
    }

    const config = PLAN_CONFIG[plan];
    const priceId = process.env[config.priceEnv];

    if (!priceId) {
      console.error(`[checkout] Missing env var: ${config.priceEnv}`);
      return NextResponse.json({ error: 'This plan is not yet available. Please contact us.' }, { status: 503 });
    }

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email: email.toLowerCase().trim(),
      name: name.trim(),
      metadata: {
        plan,
        internal_plan: config.internal,
        source: 'thehypeboxllc.com',
      },
    });

    // Create subscription with 14-day free trial.
    // payment_behavior: 'default_incomplete' → subscription stays incomplete
    // until payment method is confirmed via the pending_setup_intent.
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      trial_period_days: 14,
      payment_behavior: 'default_incomplete',
      expand: ['pending_setup_intent'],
    });

    const setupIntent = subscription.pending_setup_intent;
    if (!setupIntent || !setupIntent.client_secret) {
      throw new Error('Stripe did not return a setup intent. Check that the price is recurring.');
    }

    // Persist to Supabase so we have the record immediately
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
    return NextResponse.json(
      { error: err.message || 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

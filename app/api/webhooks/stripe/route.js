import { NextResponse } from 'next/server';
import stripe from '@/lib/stripe';
import { createClient } from '@/lib/supabase';

// Next.js must NOT parse the body — Stripe needs the raw bytes to verify signature
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const sig = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[stripe webhook] STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe webhook] Signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createClient();

  try {
    switch (event.type) {

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const customer = await stripe.customers.retrieve(sub.customer);
        if (customer.deleted || !customer.email) break;

        await supabase
          .from('users')
          .update({
            plan_status: sub.status,
            stripe_subscription_id: sub.id,
            stripe_customer_id: sub.customer,
            trial_ends_at: sub.trial_end
              ? new Date(sub.trial_end * 1000).toISOString()
              : null,
          })
          .eq('email', customer.email.toLowerCase());

        console.log(`[stripe webhook] subscription ${sub.status} for ${customer.email}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customer = await stripe.customers.retrieve(sub.customer);
        if (customer.deleted || !customer.email) break;

        await supabase
          .from('users')
          .update({ plan_status: 'canceled' })
          .eq('email', customer.email.toLowerCase());

        console.log(`[stripe webhook] subscription canceled for ${customer.email}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (invoice.amount_paid === 0) break;

        const customer = await stripe.customers.retrieve(invoice.customer);
        if (customer.deleted || !customer.email) break;

        await supabase
          .from('users')
          .update({ plan_status: 'active' })
          .eq('email', customer.email.toLowerCase());

        console.log(`[stripe webhook] payment succeeded for ${customer.email}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customer = await stripe.customers.retrieve(invoice.customer);
        if (customer.deleted || !customer.email) break;

        await supabase
          .from('users')
          .update({ plan_status: 'past_due' })
          .eq('email', customer.email.toLowerCase());

        console.log(`[stripe webhook] payment failed for ${customer.email}`);
        break;
      }

      case 'setup_intent.succeeded': {
        const si = event.data.object;
        if (!si.customer) break;

        const customer = await stripe.customers.retrieve(si.customer);
        if (customer.deleted || !customer.email) break;

        await supabase
          .from('users')
          .update({ plan_status: 'trialing' })
          .eq('email', customer.email.toLowerCase());

        console.log(`[stripe webhook] setup confirmed, trial live for ${customer.email}`);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ ok: true, type: event.type });
  } catch (err) {
    console.error('[stripe webhook] handler error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

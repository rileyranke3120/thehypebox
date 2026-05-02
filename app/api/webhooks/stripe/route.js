import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import stripe from '@/lib/stripe';
import { createClient } from '@/lib/supabase';
import { getMailer } from '@/lib/mailer';

const PLAN_LABELS = {
  launch: 'The Launch Box', rocket: 'The Rocket Box', velocity: 'The Velocity Box',
};

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) result += '-';
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

async function createAccount(email, name, plan) {
  const supabase = createClient();
  const { data: existing } = await supabase.from('users').select('password_hash').eq('email', email.toLowerCase()).single();
  if (existing?.password_hash) return;

  const tempPassword = generatePassword();
  const password_hash = await bcrypt.hash(tempPassword, 12);

  await supabase.from('users').update({
    password_hash,
    name: name || email.split('@')[0],
    plan_status: 'trialing',
  }).eq('email', email.toLowerCase());

  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login`;
  const planLabel = PLAN_LABELS[plan] || plan;

  try {
    await getMailer().sendMail({
      from: '"TheHypeBox" <riley@thehypeboxllc.com>',
      to: email,
      subject: `Welcome to TheHypeBox — Your login details inside`,
      html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
        <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
          <div style="margin-bottom:32px;"><span style="font-size:1.4rem;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#FFD000;">THE HYPE BOX</span></div>
          <h1 style="font-size:1.75rem;font-weight:800;color:#fff;margin:0 0 8px;">You're in, ${name ? name.split(' ')[0] : 'friend'}!</h1>
          <p style="font-size:1rem;color:#999;margin:0 0 32px;">Your <strong style="color:#FFD000;">${planLabel}</strong> 14-day free trial is now active.</p>
          <div style="background:#111;border:1px solid #222;border-radius:8px;padding:24px;margin-bottom:32px;">
            <p style="font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#666;margin:0 0 16px;">Your Login Credentials</p>
            <div style="margin-bottom:12px;"><p style="font-size:0.75rem;color:#555;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">Email</p><p style="font-size:1rem;color:#fff;margin:0;font-family:monospace;">${email}</p></div>
            <div><p style="font-size:0.75rem;color:#555;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">Temporary Password</p><p style="font-size:1.2rem;color:#FFD000;margin:0;font-family:monospace;font-weight:700;letter-spacing:0.1em;">${tempPassword}</p></div>
          </div>
          <a href="${loginUrl}" style="display:inline-block;background:#FFD000;color:#000;font-weight:700;font-size:1rem;padding:14px 32px;border-radius:4px;text-decoration:none;">Log In to Your Dashboard →</a>
          <p style="font-size:0.82rem;color:#555;margin:32px 0 0;line-height:1.6;">Trial runs 14 days — no charge until it ends.<br>Questions? <a href="mailto:riley@thehypeboxllc.com" style="color:#FFD000;">riley@thehypeboxllc.com</a></p>
        </div></body></html>`,
    });
  } catch (emailErr) {
    console.error('[webhook] email failed:', emailErr.message);
  }
}

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

      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode !== 'subscription') break;
        const customer = await stripe.customers.retrieve(session.customer);
        if (customer.deleted || !customer.email) break;
        const plan = session.metadata?.plan || 'velocity';
        const name = session.metadata?.name || customer.name || '';
        await createAccount(customer.email, name, plan);
        console.log(`[stripe webhook] checkout completed for ${customer.email}`);
        break;
      }

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

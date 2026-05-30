import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import stripe from '@/lib/stripe';
import { createClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/send-email';
import { paymentSuccessEmail, paymentFailedEmail, subscriptionCanceledEmail, highLevelAccessEmail } from '@/lib/email-templates';
import { createSubAccount } from '@/lib/highlevel';

const PLAN_LABELS = {
  launch: 'The Launch Box',   rocket: 'The Rocket Box',   velocity: 'The Velocity Box',
  starter: 'The Launch Box',  growth: 'The Rocket Box',   pro: 'The Velocity Box',
};

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(12);
  let result = '';
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) result += '-';
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

async function createAccount(email, name, plan) {
  const supabase = createClient();

  const tempPassword = generatePassword();
  const password_hash = await bcrypt.hash(tempPassword, 12);

  // Atomic: only writes if password_hash is still null — prevents duplicate welcome emails
  const { data: updated } = await supabase.from('users').update({
    password_hash,
    name: name || email.split('@')[0],
    plan_status: 'trialing',
  }).eq('email', email.toLowerCase()).is('password_hash', null).select().single();

  if (!updated) return; // another process already activated this account

  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login`;
  const planLabel = PLAN_LABELS[plan] || plan;

  try {
    await sendEmail({
      to: email,
      subject: `Welcome to TheHypeBox — Your login details inside`,
      html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
        <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
          <div style="margin-bottom:32px;"><span style="font-size:1.4rem;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#FFD000;">THE HYPE BOX</span></div>
          <h1 style="font-size:1.75rem;font-weight:800;color:#fff;margin:0 0 8px;">You're in, ${esc(name ? name.split(' ')[0] : 'friend')}!</h1>
          <p style="font-size:1rem;color:#999;margin:0 0 32px;">Your <strong style="color:#FFD000;">${esc(planLabel)}</strong> 14-day free trial is now active.</p>
          <div style="background:#111;border:1px solid #222;border-radius:8px;padding:24px;margin-bottom:32px;">
            <p style="font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#666;margin:0 0 16px;">Your Login Credentials</p>
            <div style="margin-bottom:12px;"><p style="font-size:0.75rem;color:#555;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">Email</p><p style="font-size:1rem;color:#fff;margin:0;font-family:monospace;">${esc(email)}</p></div>
            <div><p style="font-size:0.75rem;color:#555;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.08em;">Temporary Password</p><p style="font-size:1.2rem;color:#FFD000;margin:0;font-family:monospace;font-weight:700;letter-spacing:0.1em;">${esc(tempPassword)}</p></div>
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
    // Deduplicate: return 200 immediately if this event has already been processed
    const { error: dedupError } = await supabase
      .from('stripe_event_ids')
      .insert({ event_id: event.id, processed_at: new Date().toISOString() });
    if (dedupError?.code === '23505') {
      console.log(`[stripe webhook] duplicate event ${event.id} — skipping`);
      return NextResponse.json({ ok: true, duplicate: true });
    }

    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode !== 'subscription') break;
        const customer = await stripe.customers.retrieve(session.customer);
        if (customer.deleted || !customer.email) break;
        const plan = session.metadata?.plan || 'velocity';
        const name = session.metadata?.name || customer.name || '';
        await createAccount(customer.email, name, plan);

        // Auto-provision GHL sub-account (fire-and-forget — non-blocking)
        let ghlProvisioned = false;
        try {
          const { data: existing } = await supabase
            .from('users')
            .select('id, ghl_location_id')
            .eq('email', customer.email.toLowerCase())
            .single();

          if (existing && !existing.ghl_location_id) {
            const hlAccount = await createSubAccount({ name, email: customer.email, plan });
            await supabase.from('users').update({
              ghl_location_id: hlAccount.locationId,
              ghl_user_id: hlAccount.userId || null,
              retell_agent_id: hlAccount.retellAgentId || null,
            }).eq('id', existing.id);

            if (hlAccount.userId) {
              const tpl = highLevelAccessEmail({
                name: name || customer.email,
                plan,
                locationId: hlAccount.locationId,
                hlEmail: customer.email,
                hlPassword: hlAccount.password,
                dashboardUrl: hlAccount.dashboardUrl,
                hasRetell: !!hlAccount.retellAgentId,
              });
              await sendEmail({ to: customer.email, ...tpl });
            }
            ghlProvisioned = true;
            console.log(`[stripe webhook] auto-provisioned GHL for ${customer.email}: ${hlAccount.locationId}`);
          }
        } catch (ghlErr) {
          console.error(`[stripe webhook] auto-GHL provision failed for ${customer.email}:`, ghlErr.message);
        }

        // Notify Riley of new signup
        try {
          const planLabel = PLAN_LABELS[plan] || plan;
          await sendEmail({
            to: 'riley@thehypeboxllc.com',
            subject: `🎉 New signup: ${name || customer.email} — ${planLabel}`,
            html: `<div style="background:#0a0a0a;padding:32px 24px;font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;">
              <p style="font-size:1.4rem;font-weight:900;color:#FFD000;margin:0 0 16px;letter-spacing:0.08em;text-transform:uppercase;">THE HYPE BOX</p>
              <p style="font-size:1.1rem;font-weight:700;color:#fff;margin:0 0 12px;">New client just signed up!</p>
              <div style="background:#111;border:1px solid #222;border-radius:6px;padding:16px;margin-bottom:20px;">
                <p style="margin:0 0 6px;font-size:0.8rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Name</p>
                <p style="margin:0 0 16px;font-size:0.95rem;color:#fff;">${esc(name || '—')}</p>
                <p style="margin:0 0 6px;font-size:0.8rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Email</p>
                <p style="margin:0 0 16px;font-size:0.95rem;color:#fff;">${esc(customer.email)}</p>
                <p style="margin:0 0 6px;font-size:0.8rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">Plan</p>
                <p style="margin:0 0 16px;font-size:0.95rem;font-weight:700;color:#FFD000;">${esc(planLabel)}</p>
                <p style="margin:0 0 6px;font-size:0.8rem;color:#555;text-transform:uppercase;letter-spacing:0.08em;">GHL Provisioned</p>
                <p style="margin:0;font-size:0.85rem;color:${ghlProvisioned ? '#4CAF50' : '#FF8C00'};">${ghlProvisioned ? 'Yes — auto-provisioned' : 'No — needs manual setup'}</p>
              </div>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/admin/clients" style="display:inline-block;background:#FFD000;color:#000;font-weight:700;font-size:0.85rem;padding:10px 20px;border-radius:4px;text-decoration:none;letter-spacing:0.05em;text-transform:uppercase;">View in Admin →</a>
            </div>`,
          });
        } catch (_) {}

        console.log(`[stripe webhook] checkout completed for ${customer.email}`);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const customer = await stripe.customers.retrieve(sub.customer);
        if (customer.deleted || !customer.email) break;

        const subData = {
          plan_status: sub.status,
          stripe_subscription_id: sub.id,
          stripe_customer_id: sub.customer,
          trial_ends_at: sub.trial_end
            ? new Date(sub.trial_end * 1000).toISOString()
            : null,
        };

        // Retry: the checkout API writes the user row and this webhook may fire before it finishes
        let updated = false;
        for (let attempt = 0; attempt < 3 && !updated; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * attempt));
          const { data } = await supabase
            .from('users')
            .update(subData)
            .eq('email', customer.email.toLowerCase())
            .select('email');
          if (data?.length) updated = true;
        }

        if (!updated) {
          // Row still not there — upsert so plan_status is written whenever checkout finishes
          await supabase
            .from('users')
            .upsert({ email: customer.email.toLowerCase(), ...subData }, { onConflict: 'email' });
        }

        console.log(`[stripe webhook] subscription ${sub.status} for ${customer.email}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customer = await stripe.customers.retrieve(sub.customer);
        if (customer.deleted || !customer.email) break;

        const { data: canceledUser } = await supabase
          .from('users')
          .select('plan, ghl_user_id')
          .eq('email', customer.email.toLowerCase())
          .single();

        await supabase
          .from('users')
          .update({ plan_status: 'canceled', ghl_api_key: null })
          .eq('email', customer.email.toLowerCase());

        // Remove GHL access
        if (canceledUser?.ghl_user_id) {
          const ghlKey = process.env.GHL_AGENCY_KEY || process.env.GHL_AGENCY_API_KEY;
          if (ghlKey) {
            try {
              const ghlRes = await fetch(`https://services.leadconnectorhq.com/users/${canceledUser.ghl_user_id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${ghlKey}`, Version: '2021-07-28' },
              });
              if (!ghlRes.ok) {
                console.error(`[stripe webhook] GHL delete user failed: HTTP ${ghlRes.status}`);
                try {
                  await sendEmail({
                    to: 'riley@thehypeboxllc.com',
                    subject: `ACTION REQUIRED: GHL offboarding failed for ${customer.email}`,
                    html: `<p>GHL user deletion failed for <strong>${customer.email}</strong> (subscription canceled).</p>
                           <p><strong>GHL User ID:</strong> ${canceledUser.ghl_user_id}</p>
                           <p><strong>Error:</strong> HTTP ${ghlRes.status}</p>
                           <p>Delete this user manually in the GHL agency dashboard to revoke their access.</p>`,
                  });
                } catch (_) {}
              } else {
                console.log(`[stripe webhook] GHL user ${canceledUser.ghl_user_id} removed for ${customer.email}`);
              }
            } catch (ghlErr) {
              console.error('[stripe webhook] GHL offboarding error:', ghlErr.message);
              try {
                await sendEmail({
                  to: 'riley@thehypeboxllc.com',
                  subject: `ACTION REQUIRED: GHL offboarding failed for ${customer.email}`,
                  html: `<p>GHL user deletion failed for <strong>${customer.email}</strong> (subscription canceled).</p>
                         <p><strong>GHL User ID:</strong> ${canceledUser.ghl_user_id}</p>
                         <p><strong>Error:</strong> ${ghlErr.message}</p>
                         <p>Delete this user manually in the GHL agency dashboard to revoke their access.</p>`,
                });
              } catch (_) {}
            }
          }
        }

        // Send cancellation email
        try {
          const user = canceledUser;

          const tpl = subscriptionCanceledEmail({
            name: customer.name || customer.email,
            plan: user?.plan,
            accessEndDate: new Date(sub.current_period_end * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          });
          await sendEmail({ to: customer.email, ...tpl });
        } catch (emailErr) {
          console.error('[stripe webhook] cancellation email failed:', emailErr.message);
        }

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

        // Send payment confirmation email
        try {
          const { data: user } = await supabase
            .from('users')
            .select('plan, stripe_subscription_id')
            .eq('email', customer.email.toLowerCase())
            .single();

          const sub = await stripe.subscriptions.retrieve(invoice.subscription);
          const tpl = paymentSuccessEmail({
            name: customer.name || customer.email,
            plan: user?.plan,
            amountCents: invoice.amount_paid,
            nextBillingDate: new Date(sub.current_period_end * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            invoiceUrl: invoice.hosted_invoice_url,
          });
          await sendEmail({ to: customer.email, ...tpl });
        } catch (emailErr) {
          console.error('[stripe webhook] payment success email failed:', emailErr.message);
        }

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

        // Send payment failed email with portal link for updating card
        try {
          const { data: user } = await supabase
            .from('users')
            .select('plan, stripe_customer_id')
            .eq('email', customer.email.toLowerCase())
            .single();

          const portalSession = await stripe.billingPortal.sessions.create({
            customer: invoice.customer,
            return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
          });
          const tpl = paymentFailedEmail({
            name: customer.name || customer.email,
            plan: user?.plan,
            amountCents: invoice.amount_due,
            updateUrl: portalSession.url,
          });
          await sendEmail({ to: customer.email, ...tpl });
        } catch (emailErr) {
          console.error('[stripe webhook] payment failed email failed:', emailErr.message);
        }

        console.log(`[stripe webhook] payment failed for ${customer.email}`);
        break;
      }

      case 'setup_intent.succeeded': {
        const si = event.data.object;
        if (!si.customer) break;

        const customer = await stripe.customers.retrieve(si.customer);
        if (customer.deleted || !customer.email) break;

        const { data: user } = await supabase
          .from('users')
          .select('plan, name, ghl_location_id')
          .eq('email', customer.email.toLowerCase())
          .single();

        // Only update status — don't reset trial_ends_at (set by subscription.created)
        await supabase
          .from('users')
          .update({ plan_status: 'trialing' })
          .eq('email', customer.email.toLowerCase());

        // Create HighLevel sub-account if not already provisioned
        if (!user?.ghl_location_id) {
          try {
            const hlAccount = await createSubAccount({
              name: user?.name || customer.name || '',
              email: customer.email,
              phone: customer.phone || '',
              plan: user?.plan || 'launch',
            });

            const hlUpdates = {
              ghl_location_id: hlAccount.locationId,
              ghl_user_id: hlAccount.userId,
            };
            if (hlAccount.retellAgentId) hlUpdates.retell_agent_id = hlAccount.retellAgentId;

            await supabase
              .from('users')
              .update(hlUpdates)
              .eq('email', customer.email.toLowerCase());

            // Send HL access email to customer
            try {
              const tpl = highLevelAccessEmail({
                name: user?.name || customer.name || customer.email,
                plan: user?.plan,
                locationId: hlAccount.locationId,
                hlEmail: customer.email,
                hlPassword: hlAccount.password,
                dashboardUrl: hlAccount.dashboardUrl,
                hasRetell: !!hlAccount.retellAgentId,
              });
              await sendEmail({ to: customer.email, ...tpl });
            } catch (emailErr) {
              console.error('[stripe webhook] HL access email failed:', emailErr.message);
            }

            console.log(`[stripe webhook] HL account created: ${hlAccount.locationId} for ${customer.email}`);
          } catch (hlErr) {
            console.error(`[stripe webhook] HL provisioning failed for ${customer.email}:`, hlErr.message);

            // Notify admin so they can provision manually
            try {
              await sendEmail({
                to: 'riley@thehypeboxllc.com',
                subject: `ACTION REQUIRED: HL provisioning failed for ${customer.email}`,
                html: `<p>HighLevel sub-account creation failed for <strong>${customer.email}</strong>.</p>
                       <p><strong>Plan:</strong> ${user?.plan}</p>
                       <p><strong>Error:</strong> ${hlErr.message}</p>
                       <p>Use the admin panel to provision manually: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/admin/highlevel</p>`,
              });
            } catch (_) {}
          }
        }

        console.log(`[stripe webhook] setup confirmed, trial live for ${customer.email}`);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ ok: true, type: event.type });
  } catch (err) {
    console.error('[stripe webhook] handler error:', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

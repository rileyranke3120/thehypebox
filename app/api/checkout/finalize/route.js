import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import stripe from '@/lib/stripe';
import { createClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/send-email';
import { sendSMS } from '@/lib/twilio';

const PLAN_LABELS = {
  launch: 'The Launch Box',   rocket: 'The Rocket Box',   velocity: 'The Velocity Box',
  starter: 'The Launch Box',  growth: 'The Rocket Box',   pro: 'The Velocity Box',
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkFinalizeRateLimit(ip) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_and_increment_checkout_rate_limit`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_ip: `finalize:${ip}`, p_max: 3, p_window_seconds: 3600 }),
    });
    return res.ok ? await res.json() : false;
  } catch { return false; }
}

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
  return result; // format: XXXX-XXXX-XXXX
}

export async function POST(request) {
  try {
    const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown';
    if (!(await checkFinalizeRateLimit(ip))) {
      return NextResponse.json({ error: 'Too many requests. Please wait before trying again.' }, { status: 429 });
    }


    const { email, name, plan, subscriptionId } = await request.json();

    if (!email || !plan || !subscriptionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify the subscription exists in Stripe and belongs to this email
    let subscription;
    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['customer'] });
    } catch {
      return NextResponse.json({ error: 'Invalid subscription.' }, { status: 400 });
    }

    const stripeCustomer = subscription.customer;
    if (!stripeCustomer || stripeCustomer.deleted || !stripeCustomer.email) {
      return NextResponse.json({ error: 'Invalid subscription.' }, { status: 400 });
    }
    if (stripeCustomer.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: 'Invalid subscription.' }, { status: 403 });
    }
    if (!['incomplete', 'trialing', 'active'].includes(subscription.status)) {
      return NextResponse.json({ error: 'Subscription is not in an activatable state.' }, { status: 400 });
    }

    const supabase = createClient();

    // Generate temp password and hash it
    const tempPassword = generatePassword();
    const password_hash = await bcrypt.hash(tempPassword, 12);

    // Atomic: only writes if password_hash is still null — prevents duplicate welcome emails
    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update({
        password_hash,
        name: name || email.split('@')[0],
        plan_status: 'trialing',
      })
      .eq('email', email.toLowerCase())
      .is('password_hash', null)
      .select()
      .single();

    if (updateError && updateError.code !== 'PGRST116') throw updateError;

    if (!updated) {
      // Account already activated by another process — don't re-send credentials
      return NextResponse.json({ ok: true, alreadyActivated: true });
    }

    // Send welcome email with credentials
    const planLabel = PLAN_LABELS[plan] || plan;
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login`;

    try { await sendEmail({
      to: email,
      subject: `Welcome to TheHypeBox — Your login details inside`,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
          <div style="max-width:560px;margin:0 auto;padding:48px 24px;">

            <div style="margin-bottom:32px;">
              <span style="font-size:1.4rem;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#FFD000;">
                THE HYPE BOX
              </span>
            </div>

            <h1 style="font-size:1.75rem;font-weight:800;color:#ffffff;margin:0 0 8px 0;">
              You're in, ${esc(name ? name.split(' ')[0] : 'friend')}! 🎉
            </h1>
            <p style="font-size:1rem;color:#999;margin:0 0 32px 0;">
              Your <strong style="color:#FFD000;">${esc(planLabel)}</strong> 14-day free trial is now active.
            </p>

            <div style="background:#111;border:1px solid #222;border-radius:8px;padding:24px;margin-bottom:32px;">
              <p style="font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#666;margin:0 0 16px 0;">
                Your Login Credentials
              </p>
              <div style="margin-bottom:12px;">
                <p style="font-size:0.75rem;color:#555;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.08em;">Email</p>
                <p style="font-size:1rem;color:#fff;margin:0;font-family:monospace;">${esc(email)}</p>
              </div>
              <div>
                <p style="font-size:0.75rem;color:#555;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.08em;">Temporary Password</p>
                <p style="font-size:1.2rem;color:#FFD000;margin:0;font-family:monospace;font-weight:700;letter-spacing:0.1em;">${esc(tempPassword)}</p>
              </div>
            </div>

            <a href="${loginUrl}" style="display:inline-block;background:#FFD000;color:#000;font-weight:700;font-size:1rem;padding:14px 32px;border-radius:4px;text-decoration:none;letter-spacing:0.05em;">
              Log In to Your Dashboard →
            </a>

            <p style="font-size:0.82rem;color:#555;margin:32px 0 0 0;line-height:1.6;">
              We recommend changing your password after your first login.<br>
              Your trial runs for 14 days — no charge until it ends.<br><br>
              Questions? Reply to this email or reach us at
              <a href="mailto:riley@thehypeboxllc.com" style="color:#FFD000;">riley@thehypeboxllc.com</a>
            </p>

          </div>
        </body>
        </html>
      `,
    }); } catch (emailErr) {
      console.error('[checkout/finalize] email failed:', emailErr.message);
    }

    // Send welcome SMS if the user provided a phone number
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('name, business_phone')
        .eq('email', email.toLowerCase())
        .single();

      if (userData?.business_phone) {
        const firstName = (userData.name || name || '').split(' ')[0] || 'there';
        await sendSMS(
          userData.business_phone,
          `Hey ${firstName}! Welcome to TheHypeBox 🎉 Your AI assistant Sarah is being set up now. You'll get a separate email with your login link. Questions? Reply here or call (844) 4-HYPE-ME — Riley`,
          { apiKey: process.env.GHL_SMS_KEY || process.env.GHL_DAVE_API_KEY, locationId: process.env.GHL_DAVE_LOCATION_ID }
        );
        console.log('[checkout/finalize] welcome SMS sent');
      }
    } catch (smsErr) {
      console.error('[checkout/finalize] SMS failed:', smsErr.message);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[checkout/finalize]', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

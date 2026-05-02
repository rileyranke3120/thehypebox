import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createClient } from '@/lib/supabase';
import { getMailer } from '@/lib/mailer';

const PLAN_LABELS = {
  launch:   'The Launch Box',
  rocket:   'The Rocket Box',
  velocity: 'The Velocity Box',
};

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) result += '-';
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result; // format: XXXX-XXXX-XXXX
}

export async function POST(request) {
  try {
    const { email, name, plan } = await request.json();

    if (!email || !plan) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createClient();

    // Check if account already has a password (avoid re-sending on duplicate calls)
    const { data: existing } = await supabase
      .from('users')
      .select('password_hash')
      .eq('email', email.toLowerCase())
      .single();

    if (existing?.password_hash) {
      // Account already activated — don't re-send credentials
      return NextResponse.json({ ok: true, alreadyActivated: true });
    }

    // Generate temp password and hash it
    const tempPassword = generatePassword();
    const password_hash = await bcrypt.hash(tempPassword, 12);

    // Save to Supabase
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash,
        name: name || email.split('@')[0],
        plan_status: 'trialing',
      })
      .eq('email', email.toLowerCase());

    if (updateError) throw updateError;

    // Send welcome email with credentials
    const planLabel = PLAN_LABELS[plan] || plan;
    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login`;

    try { await getMailer().sendMail({
      from: '"TheHypeBox" <riley@thehypeboxllc.com>',
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
              You're in, ${name ? name.split(' ')[0] : 'friend'}! 🎉
            </h1>
            <p style="font-size:1rem;color:#999;margin:0 0 32px 0;">
              Your <strong style="color:#FFD000;">${planLabel}</strong> 14-day free trial is now active.
            </p>

            <div style="background:#111;border:1px solid #222;border-radius:8px;padding:24px;margin-bottom:32px;">
              <p style="font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#666;margin:0 0 16px 0;">
                Your Login Credentials
              </p>
              <div style="margin-bottom:12px;">
                <p style="font-size:0.75rem;color:#555;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.08em;">Email</p>
                <p style="font-size:1rem;color:#fff;margin:0;font-family:monospace;">${email}</p>
              </div>
              <div>
                <p style="font-size:0.75rem;color:#555;margin:0 0 4px 0;text-transform:uppercase;letter-spacing:0.08em;">Temporary Password</p>
                <p style="font-size:1.2rem;color:#FFD000;margin:0;font-family:monospace;font-weight:700;letter-spacing:0.1em;">${tempPassword}</p>
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

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[checkout/finalize]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

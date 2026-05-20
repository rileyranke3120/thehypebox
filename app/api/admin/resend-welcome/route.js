import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/send-email';
import { highLevelAccessEmail } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

const APP_URL = 'https://thehypeboxllc.com';

export async function POST(req) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

  const supabase = createClient();
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, name, plan, ghl_location_id, ghl_user_id')
    .eq('id', userId)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    if (user.ghl_location_id) {
      // Send GHL access email — tell them to use Forgot Password since we don't store it
      const tpl = highLevelAccessEmail({
        name: user.name,
        plan: user.plan,
        locationId: user.ghl_location_id,
        hlEmail: user.email,
        hlPassword: null, // not stored — email template handles null gracefully
        dashboardUrl: `${APP_URL}/dashboard`,
      });
      await sendEmail({ to: user.email, ...tpl });
    } else {
      // No GHL yet — send a simple dashboard access email
      const firstName = user.name ? user.name.split(' ')[0] : 'there';
      await sendEmail({
        to: user.email,
        subject: 'Your TheHypeBox Dashboard Access',
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
    <div style="margin-bottom:32px;">
      <a href="${APP_URL}" style="font-size:1.4rem;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#FFD000;text-decoration:none;">THE HYPE BOX</a>
    </div>
    <h1 style="font-size:1.75rem;font-weight:800;color:#fff;margin:0 0 8px;">Hey ${firstName}, welcome back!</h1>
    <p style="font-size:1rem;color:#999;margin:0 0 32px;">Here's a quick link to get back into your dashboard.</p>
    <a href="${APP_URL}/dashboard" style="display:inline-block;background:#FFD000;color:#000;font-weight:700;font-size:1rem;padding:14px 32px;border-radius:4px;text-decoration:none;">Go to Dashboard →</a>
    <p style="font-size:0.82rem;color:#555;margin:32px 0 0;line-height:1.6;">
      Log in with your email address: <strong style="color:#ccc;">${user.email}</strong><br>
      Forgot your password? Use the "Forgot Password?" link on the login page.
    </p>
    <div style="margin-top:48px;padding-top:24px;border-top:1px solid #1a1a1a;">
      <p style="font-size:0.75rem;color:#444;margin:0;line-height:1.6;">
        TheHypeBox LLC &nbsp;·&nbsp;
        <a href="${APP_URL}/dashboard/billing" style="color:#555;">Manage subscription</a> &nbsp;·&nbsp;
        <a href="mailto:riley@thehypeboxllc.com" style="color:#555;">riley@thehypeboxllc.com</a>
      </p>
    </div>
  </div>
</body>
</html>`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[resend-welcome]', err);
    return NextResponse.json({ error: err.message || 'Failed to send email' }, { status: 500 });
  }
}

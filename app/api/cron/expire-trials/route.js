import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/send-email';

export const dynamic = 'force-dynamic';

// Runs daily — marks trialing users whose trial_ends_at has passed as 'expired'
// and sends a one-time expired notice email.

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    console.error('[cron] CRON_SECRET env var is not set');
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();

  const { data: expired, error } = await supabase
    .from('users')
    .select('email, name, plan')
    .eq('plan_status', 'trialing')
    .lt('trial_ends_at', new Date().toISOString());

  if (error) {
    console.error('[expire-trials] query error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let expiredCount = 0;

  for (const user of expired ?? []) {
    try {
      await supabase
        .from('users')
        .update({ plan_status: 'expired', ghl_api_key: null })
        .eq('email', user.email);

      const firstName = user.name ? user.name.split(' ')[0] : 'there';
      const firstNameEsc = String(firstName).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      await sendEmail({
        to: user.email,
        subject: `Your TheHypeBox trial has ended`,
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
    <div style="margin-bottom:32px;">
      <span style="font-size:1.4rem;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#FFD000;">THE HYPE BOX</span>
    </div>
    <h1 style="font-size:1.75rem;font-weight:800;color:#fff;margin:0 0 8px;">Hey ${firstNameEsc}, your trial has ended.</h1>
    <p style="font-size:1rem;color:#999;margin:0 0 24px;line-height:1.7;">
      Your 14-day free trial is over. To keep your AI receptionist running, automations firing, and leads coming in — subscribe now.
    </p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing" style="display:inline-block;background:#FFD000;color:#000;font-weight:700;font-size:1rem;padding:14px 32px;border-radius:4px;text-decoration:none;">Activate My Account →</a>
    <p style="font-size:0.82rem;color:#555;margin:32px 0 0 0;line-height:1.6;">
      Questions? Reply to this email or call <a href="tel:8444497363" style="color:#FFD000;">(844) 4-HYPE-ME</a>.
    </p>
  </div>
</body>
</html>`,
      });

      expiredCount++;
      console.log(`[expire-trials] expired ${user.email}`);
    } catch (err) {
      console.error(`[expire-trials] failed for ${user.email}:`, err.message);
    }
  }

  return NextResponse.json({ ok: true, checked: expired?.length ?? 0, expiredCount });
}

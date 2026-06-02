import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/send-email';
import { safeCompare } from '@/lib/safe-compare';

export const dynamic = 'force-dynamic';

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    console.error('[cron] CRON_SECRET env var is not set');
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();

  const windowStart = new Date(Date.now() - 4 * 86400000).toISOString();
  const windowEnd   = new Date(Date.now() - 3 * 86400000).toISOString();

  let users;
  try {
    const { data, error } = await supabase
      .from('users')
      .select('email, name, plan, updated_at')
      .eq('plan_status', 'canceled')
      .eq('win_back_sent', false)
      .gte('updated_at', windowStart)
      .lt('updated_at', windowEnd);

    if (error) {
      // Column may not exist yet — non-fatal
      console.error('[win-back] query error:', error.message);
      return NextResponse.json({ ok: true, sent: 0, note: 'win_back_sent column may not exist yet' });
    }
    users = data;
  } catch (err) {
    console.error('[win-back] unexpected error:', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }

  const PLAN_LABELS = {
    launch: 'The Launch Box', rocket: 'The Rocket Box', velocity: 'The Velocity Box',
    starter: 'The Launch Box', growth: 'The Rocket Box', pro: 'The Velocity Box',
  };

  let sent = 0;

  for (const user of users ?? []) {
    const firstName = esc(user.name ? user.name.split(' ')[0] : 'there');
    const planLabel = PLAN_LABELS[user.plan] || user.plan || 'TheHypeBox';
    const restartUrl = `${process.env.NEXT_PUBLIC_APP_URL}/#pricing`;

    try {
      await sendEmail({
        to: user.email,
        subject: `We'd love to have you back`,
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
    <div style="margin-bottom:32px;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="font-size:1.4rem;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#FFD000;text-decoration:none;">THE HYPE BOX</a>
    </div>
    <h1 style="font-size:1.75rem;font-weight:800;color:#fff;margin:0 0 8px;">Hey ${firstName}</h1>
    <p style="font-size:1rem;color:#999;margin:0 0 24px;">You recently canceled your ${planLabel} subscription. That's okay — we just want to make sure it wasn't something we could have fixed.</p>
    <p style="font-size:0.9rem;color:#aaa;margin:0 0 24px;line-height:1.7;">If you ran into a problem, hit a wall during setup, or just had bad timing — reply to this email. I'll personally help you get sorted out, no pressure.</p>
    <p style="font-size:0.9rem;color:#aaa;margin:0 0 32px;line-height:1.7;">If you're ready to come back, your data is still here and you can restart anytime.</p>
    <a href="${restartUrl}" style="display:inline-block;background:#FFD000;color:#000;font-weight:700;font-size:0.9rem;padding:12px 28px;border-radius:4px;text-decoration:none;letter-spacing:0.05em;">View plans →</a>
    <div style="margin-top:48px;padding-top:24px;border-top:1px solid #1a1a1a;">
      <p style="font-size:0.75rem;color:#444;margin:0;">— Riley at TheHypeBox &nbsp;·&nbsp; <a href="mailto:riley@thehypeboxllc.com" style="color:#555;">riley@thehypeboxllc.com</a></p>
    </div>
  </div>
</body>
</html>`,
      });

      await supabase.from('users').update({ win_back_sent: true }).eq('email', user.email);
      sent++;
      console.log(`[win-back] sent to ${user.email}`);
    } catch (err) {
      console.error(`[win-back] failed for ${user.email}:`, err.message);
    }
  }

  return NextResponse.json({ ok: true, checked: users?.length ?? 0, sent });
}

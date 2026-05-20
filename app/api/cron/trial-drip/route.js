import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/send-email';
import { trialDripEmail } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

// Days since trial start that trigger each email
const DRIP_DAYS = [1, 3, 7, 10, 13];

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();

  // Get all trialing users whose trial hasn't ended yet
  const { data: users, error } = await supabase
    .from('users')
    .select('email, name, plan, trial_ends_at, created_at, toggles')
    .eq('plan_status', 'trialing')
    .not('trial_ends_at', 'is', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = Date.now();
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/login`;
  let sent = 0;
  const failures = [];

  for (const user of users ?? []) {
    const trialStart = new Date(user.created_at).getTime();
    const trialEnd = new Date(user.trial_ends_at);
    const daysSinceStart = Math.floor((now - trialStart) / 86400000);

    if (!DRIP_DAYS.includes(daysSinceStart)) continue;

    // Don't send if trial already ended
    if (trialEnd < now) continue;

    // Deduplication: skip if this day's email was already sent (prevents double-send on cron retry)
    const sentDays = user.toggles?.trial_drip_sent ?? [];
    if (sentDays.includes(daysSinceStart)) {
      console.log(`[trial-drip] day ${daysSinceStart} already sent to ${user.email}, skipping`);
      continue;
    }

    const tpl = trialDripEmail({
      name: user.name,
      plan: user.plan,
      day: daysSinceStart,
      loginUrl,
      trialEndDate: trialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    });

    if (!tpl) continue;

    try {
      await sendEmail({ to: user.email, ...tpl });
      // Mark this day as sent so a cron retry won't re-send
      await supabase
        .from('users')
        .update({ toggles: { ...(user.toggles || {}), trial_drip_sent: [...sentDays, daysSinceStart] } })
        .eq('email', user.email);
      sent++;
      console.log(`[trial-drip] day ${daysSinceStart} email sent to ${user.email}`);
    } catch (err) {
      console.error(`[trial-drip] failed for ${user.email}:`, err.message);
      failures.push(user.email);
    }
  }

  return NextResponse.json({
    ok: true,
    checked: users?.length ?? 0,
    sent,
    failures,
  });
}

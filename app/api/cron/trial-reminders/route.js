import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/send-email';
import { trialEndingEmail } from '@/lib/email-templates';
import { safeCompare } from '@/lib/safe-compare';

export const dynamic = 'force-dynamic';

const PLAN_PRICES = { launch: 97, rocket: 297, velocity: 497, starter: 97, growth: 297, pro: 497 };

export async function GET(request) {
  // Verify this request is from Vercel Cron (or your own call with the secret)
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    console.error('[cron] CRON_SECRET env var is not set');
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient();

    // Find all trialing users whose trial ends in the next 3–4 days.
    // Using a 24-hour window around the 3-day mark so the cron doesn't
    // need to run at an exact moment — one email per day is enough.
    const windowStart = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const windowEnd   = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);

    const { data: users, error } = await supabase
      .from('users')
      .select('email, name, plan, trial_ends_at, toggles')
      .eq('plan_status', 'trialing')
      .gte('trial_ends_at', windowStart.toISOString())
      .lt('trial_ends_at', windowEnd.toISOString());

    if (error) throw error;

    let emailsSent = 0;
    const failures = [];

    for (const user of users ?? []) {
      const trialEnd = new Date(user.trial_ends_at);
      const tpl = trialEndingEmail({
        name: user.name || user.email,
        plan: user.plan,
        planPrice: PLAN_PRICES[user.plan] ?? '—',
        trialEndDate: trialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      });

      // Atomic guard: claim the row first; 0 rows updated means another process already sent
      const { data: claimed } = await supabase
        .from('users')
        .update({ toggles: { ...(user.toggles || {}), trial_reminder_sent: true } })
        .eq('email', user.email)
        .or('toggles.is.null,toggles->>trial_reminder_sent.is.null,toggles->>trial_reminder_sent.neq.true')
        .select('email');

      if (!claimed?.length) {
        console.log(`[trial-reminders] already sent to ${user.email}, skipping`);
        continue;
      }

      try {
        await sendEmail({ to: user.email, ...tpl });
        emailsSent++;
        console.log(`[trial-reminders] sent to ${user.email}`);
      } catch (err) {
        console.error(`[trial-reminders] failed for ${user.email}:`, err.message);
        failures.push(user.email);
      }
    }

    return NextResponse.json({
      ok: true,
      checked: users?.length ?? 0,
      emailsSent,
      failures,
    });
  } catch (err) {
    console.error('[trial-reminders] cron error:', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const PLAN_PRICES = { launch: 97, starter: 97, rocket: 297, growth: 297, velocity: 497, pro: 497 };

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
  const supabase = createClient();

  const { data: users } = await supabase
    .from('users')
    .select('plan, plan_status, created_at, trial_ends_at')
    .not('plan_status', 'is', null)
    .order('created_at', { ascending: true });

  if (!users) return NextResponse.json({ error: 'No data' }, { status: 500 });

  // MRR by month for last 6 months
  const mrrByMonth = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    mrrByMonth[key] = 0;
  }

  // Cumulative signups by month
  const signupsByMonth = { ...Object.fromEntries(Object.keys(mrrByMonth).map(k => [k, 0])) };

  users.forEach(u => {
    const created = new Date(u.created_at);
    const key = created.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    if (key in signupsByMonth) signupsByMonth[key]++;
    if ((u.plan_status === 'active' || u.plan_status === 'trialing') && key in mrrByMonth) {
      mrrByMonth[key] += PLAN_PRICES[u.plan] || 0;
    }
  });

  // Current MRR
  const currentMrr = users
    .filter(u => u.plan_status === 'active' || u.plan_status === 'trialing')
    .reduce((sum, u) => sum + (PLAN_PRICES[u.plan] || 0), 0);

  // Trial conversion rate (trialed → active / total trialed)
  const totalTrialed = users.filter(u => u.plan_status !== null).length;
  const converted = users.filter(u => u.plan_status === 'active').length;
  const conversionRate = totalTrialed ? Math.round((converted / totalTrialed) * 100) : 0;

  // Signups last 7 days
  const week = new Date(Date.now() - 7 * 86400000);
  const recentSignups = users.filter(u => new Date(u.created_at) > week).length;

  // Trials ending this week
  const weekEnd = new Date(Date.now() + 7 * 86400000);
  const trialsEndingSoon = users.filter(u =>
    u.plan_status === 'trialing' &&
    u.trial_ends_at &&
    new Date(u.trial_ends_at) < weekEnd &&
    new Date(u.trial_ends_at) > now
  ).length;

  // MRR projection: avg growth over last 3 months, project 3 more months
  const mrrArray = Object.entries(mrrByMonth).map(([month, mrr]) => ({ month, mrr }));
  const last3 = mrrArray.slice(-3);
  let avgGrowth = 0;
  if (last3.length >= 2) {
    const growths = [];
    for (let i = 1; i < last3.length; i++) {
      growths.push(last3[i].mrr - last3[i - 1].mrr);
    }
    avgGrowth = growths.reduce((a, b) => a + b, 0) / growths.length;
  }
  const lastMonthMrr = last3.length ? last3[last3.length - 1].mrr : 0;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const mrrProjection = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + i, 1);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).replace(' ', ' \'');
    const projected = Math.max(0, Math.floor(lastMonthMrr + avgGrowth * i));
    mrrProjection.push({ month: label, mrr: projected, projected: true });
  }

  return NextResponse.json({
    currentMrr,
    conversionRate,
    recentSignups,
    trialsEndingSoon,
    mrrByMonth: mrrArray,
    signupsByMonth: Object.entries(signupsByMonth).map(([month, count]) => ({ month, count })),
    mrrProjection,
  });
  } catch (err) {
    console.error('[admin/stats]', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';
import { safeCompare } from '@/lib/safe-compare';
import { withErrorMonitor } from '@/lib/error-monitor';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function cents(amount) {
  return amount ?? 0;
}

function dollars(cents) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function pct(a, b) {
  if (b === 0) return a > 0 ? '+100%' : '0%';
  const delta = ((a - b) / b) * 100;
  return (delta >= 0 ? '+' : '') + delta.toFixed(1) + '%';
}

// Fetch all pages of a Stripe list resource
async function stripeAutoPaginate(method, params) {
  const items = [];
  for await (const item of method(params)) {
    items.push(item);
  }
  return items;
}

async function getMetrics(stripe, now) {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayStartTs = Math.floor(todayStart.getTime() / 1000);

  // Month boundaries
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartTs = Math.floor(monthStart.getTime() / 1000);

  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStartTs = Math.floor(lastMonthStart.getTime() / 1000);
  const lastMonthEndTs = Math.floor(lastMonthEnd.getTime() / 1000);

  // ── Active subscriptions ──────────────────────────────────────────────────
  const activeSubs = await stripeAutoPaginate(
    stripe.subscriptions.list.bind(stripe.subscriptions),
    { status: 'active', limit: 100 }
  );

  // ── MRR: sum of active subscription amounts normalised to monthly ─────────
  let mrrCents = 0;
  for (const sub of activeSubs) {
    for (const item of sub.items.data) {
      const price = item.price;
      const amount = cents(price.unit_amount) * (item.quantity ?? 1);
      if (price.recurring?.interval === 'year') {
        mrrCents += Math.round(amount / 12);
      } else if (price.recurring?.interval === 'month') {
        mrrCents += amount;
      } else if (price.recurring?.interval === 'week') {
        mrrCents += Math.round(amount * 52 / 12);
      }
    }
  }

  // ── New subscriptions today ───────────────────────────────────────────────
  const newToday = activeSubs.filter((s) => s.start_date >= todayStartTs).length;

  // Also check trialing subs created today
  const trialingSubs = await stripeAutoPaginate(
    stripe.subscriptions.list.bind(stripe.subscriptions),
    { status: 'trialing', limit: 100, created: { gte: todayStartTs } }
  );
  const newSubsToday = newToday + trialingSubs.length;

  // ── Churned today: canceled subscriptions ────────────────────────────────
  // canceled_at is not a filterable list param in Stripe — fetch all canceled and filter client-side
  const allCanceled = await stripeAutoPaginate(
    stripe.subscriptions.list.bind(stripe.subscriptions),
    { status: 'canceled', limit: 100 }
  );
  const churnedToday = allCanceled.filter((s) => s.canceled_at >= todayStartTs).length;

  // ── Revenue MTD (successful charges this month) ──────────────────────────
  const chargesMtd = await stripeAutoPaginate(
    stripe.charges.list.bind(stripe.charges),
    { created: { gte: monthStartTs }, limit: 100 }
  );
  const revenueMtdCents = chargesMtd
    .filter((c) => c.paid && !c.refunded && c.status === 'succeeded')
    .reduce((sum, c) => sum + cents(c.amount), 0);

  // ── Revenue last month ────────────────────────────────────────────────────
  const chargesLastMonth = await stripeAutoPaginate(
    stripe.charges.list.bind(stripe.charges),
    { created: { gte: lastMonthStartTs, lt: lastMonthEndTs }, limit: 100 }
  );
  const revenueLastMonthCents = chargesLastMonth
    .filter((c) => c.paid && !c.refunded && c.status === 'succeeded')
    .reduce((sum, c) => sum + cents(c.amount), 0);

  return {
    mrrCents,
    activeSubsCount: activeSubs.length,
    newSubsToday,
    churnedToday,
    revenueMtdCents,
    revenueLastMonthCents,
  };
}

function buildSmsText(m, date) {
  const monthLabel = new Date().toLocaleString('en-US', { month: 'long' });
  const lastMonthLabel = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
    .toLocaleString('en-US', { month: 'long' });

  const lines = [
    `HypeBox Revenue — ${date}`,
    `MRR: ${dollars(m.mrrCents)}`,
    `Active clients: ${m.activeSubsCount}`,
    `New today: ${m.newSubsToday}`,
    `Churned today: ${m.churnedToday}`,
    `${monthLabel} revenue: ${dollars(m.revenueMtdCents)} (${pct(m.revenueMtdCents, m.revenueLastMonthCents)} vs ${lastMonthLabel})`,
  ];

  return lines.join('\n');
}

async function handler(request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    console.error('[stripe-dashboard] CRON_SECRET not set');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'STRIPE_SECRET_KEY not configured' }, { status: 500 });
  }
  if (!process.env.RILEY_PHONE) {
    return NextResponse.json({ error: 'RILEY_PHONE not configured' }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  const supabase = createClient();
  const now = new Date();
  const runDate = now.toISOString().split('T')[0];

  let metrics;
  try {
    metrics = await getMetrics(stripe, now);
  } catch (err) {
    console.error('[stripe-dashboard] Stripe fetch failed:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const smsText = buildSmsText(metrics, runDate);

  // Send SMS to Riley
  let smsSent = false;
  try {
    await sendSMS(process.env.RILEY_PHONE, smsText, {
      apiKey: process.env.GHL_API_KEY,
      locationId: process.env.GHL_LOCATION_ID,
    });
    smsSent = true;
    console.log('[stripe-dashboard] SMS sent to Riley');
  } catch (err) {
    console.error('[stripe-dashboard] SMS failed:', err.message);
  }

  // Upsert into stripe_metrics (idempotent on run_date)
  const { error: dbErr } = await supabase
    .from('stripe_metrics')
    .upsert(
      {
        run_date:                  runDate,
        mrr_cents:                 metrics.mrrCents,
        active_subs:               metrics.activeSubsCount,
        new_subs:                  metrics.newSubsToday,
        churned_subs:              metrics.churnedToday,
        revenue_mtd_cents:         metrics.revenueMtdCents,
        revenue_last_month_cents:  metrics.revenueLastMonthCents,
        raw_snapshot:              metrics,
        sms_sent:                  smsSent,
        created_at:                now.toISOString(),
      },
      { onConflict: 'run_date' }
    );

  if (dbErr) {
    console.warn('[stripe-dashboard] DB upsert failed:', dbErr.message);
  }

  console.log(
    `[stripe-dashboard] complete — MRR=${dollars(metrics.mrrCents)} ` +
    `active=${metrics.activeSubsCount} new=${metrics.newSubsToday} ` +
    `churned=${metrics.churnedToday} mtd=${dollars(metrics.revenueMtdCents)}`
  );

  return NextResponse.json({
    ok: true,
    runDate,
    mrr: dollars(metrics.mrrCents),
    activeClients: metrics.activeSubsCount,
    newToday: metrics.newSubsToday,
    churnedToday: metrics.churnedToday,
    revenueMtd: dollars(metrics.revenueMtdCents),
    revenueLastMonth: dollars(metrics.revenueLastMonthCents),
    smsSent,
  });
}

export const GET = withErrorMonitor('stripe-dashboard', handler);

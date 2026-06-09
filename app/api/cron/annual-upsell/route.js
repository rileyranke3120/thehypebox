import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase';
import { ghlFetch, addContactNote } from '@/lib/ghl';
import { sendAlertSMS } from '@/lib/inbound-alert';
import { safeCompare } from '@/lib/safe-compare';
import { withErrorMonitor } from '@/lib/error-monitor';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const PLAN_LABELS = {
  launch: 'Launch Box', starter: 'Launch Box',
  rocket: 'Rocket Box', growth: 'Rocket Box',
  velocity: 'Velocity Box', pro: 'Velocity Box',
};

// Annual = 10 months price (2 months free)
const MONTHLY_PRICE_CENTS = {
  launch: 9700, starter: 9700,
  rocket: 29700, growth: 29700,
  velocity: 49700, pro: 49700,
};

async function findContactByEmail(locationId, email, apiKey) {
  try {
    const data = await ghlFetch(
      `/contacts/?locationId=${locationId}&query=${encodeURIComponent(email)}&limit=1`,
      apiKey
    );
    return data?.contacts?.[0] ?? null;
  } catch {
    return null;
  }
}

async function generateAnnualUpsellSMS(client, { monthsOnPlan, planLabel, annualPrice, savings }) {
  const firstName = (client.name || '').split(' ')[0] || null;

  const prompt = `You're writing a personalized SMS on behalf of TheHypeBox — an AI automation SaaS for local home service businesses. The message is from Riley at TheHypeBox to a client who has been paying monthly.

Client name: ${client.name || client.email}
Current plan: ${planLabel} (monthly billing)
Months as a client: ${monthsOnPlan}
Annual plan price: $${(annualPrice / 100).toFixed(0)}/year (saves $${(savings / 100).toFixed(0)} — 2 months free)

Write a short, conversational SMS (under 160 characters) pitching the annual plan. Mention the specific dollar savings to make it concrete. Sound like a real person texting — not a bot or template. No emojis. ${firstName ? `Start with "${firstName},"` : ''} End with a soft call to action like "Want me to lock it in?" or "Worth a quick call?".`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${text}`);
  }

  const result = await res.json();
  return result.content?.[0]?.text?.trim() ?? '';
}

async function handler(request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    console.error('[annual-upsell] CRON_SECRET not set');
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[annual-upsell] STRIPE_SECRET_KEY not set');
    return NextResponse.json({ error: 'STRIPE_SECRET_KEY is not configured' }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
  const supabase = createClient();
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const ago90d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Load active clients who joined 3+ months ago
  const { data: rawUsers, error: usersErr } = await supabase
    .from('users')
    .select('id, name, email, plan, plan_status, role, ghl_location_id, ghl_api_key, stripe_subscription_id, created_at')
    .eq('plan_status', 'active')
    .lte('created_at', threeMonthsAgo.toISOString());

  if (usersErr) {
    console.error('[annual-upsell] users fetch failed:', usersErr.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  const clients = (rawUsers ?? []).filter((u) => u.role !== 'super_admin' && u.stripe_subscription_id);

  if (clients.length === 0) {
    console.log('[annual-upsell] no eligible clients found');
    return NextResponse.json({ ok: true, targeted: 0 });
  }

  // Dedup: skip clients pitched in the last 90 days
  const clientEmails = clients.map((c) => c.email).filter(Boolean);
  const { data: recentLogs } = await supabase
    .from('annual_upsell_log')
    .select('client_email')
    .in('client_email', clientEmails)
    .gte('created_at', ago90d);

  const recentlyPitched = new Set((recentLogs ?? []).map((r) => r.client_email));

  const mainApiKey = process.env.GHL_API_KEY;
  const mainLocationId = process.env.GHL_LOCATION_ID;
  const results = [];

  for (const client of clients) {
    if (recentlyPitched.has(client.email)) {
      console.log(`[annual-upsell] skip ${client.email} — pitched within 90 days`);
      continue;
    }

    // Verify subscription is monthly via Stripe
    let subInterval = null;
    let monthlyAmountCents = MONTHLY_PRICE_CENTS[client.plan] ?? 0;
    try {
      const sub = await stripe.subscriptions.retrieve(client.stripe_subscription_id, {
        expand: ['items.data.price'],
      });
      const price = sub.items?.data?.[0]?.price;
      subInterval = price?.recurring?.interval ?? null;
      if (price?.unit_amount) monthlyAmountCents = price.unit_amount;
    } catch (err) {
      console.error(`[annual-upsell] Stripe lookup failed for ${client.email}:`, err.message);
      continue;
    }

    if (subInterval !== 'month') {
      console.log(`[annual-upsell] skip ${client.email} — already on ${subInterval} billing`);
      continue;
    }

    const createdAt = new Date(client.created_at);
    const monthsOnPlan = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24 * 30.44));
    const annualPrice = monthlyAmountCents * 10;
    const savings = monthlyAmountCents * 2;
    const planLabel = PLAN_LABELS[client.plan] || client.plan;

    let smsDraft = '';
    let ghlContactId = null;
    let ghlNoteId = null;

    // Generate personalized pitch via Claude
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        smsDraft = await generateAnnualUpsellSMS(client, { monthsOnPlan, planLabel, annualPrice, savings });
      } catch (err) {
        console.error(`[annual-upsell] AI draft failed for ${client.email}:`, err.message);
      }
    }

    // Save draft as GHL contact note in main location
    if (mainApiKey && mainLocationId && client.email) {
      const contact = await findContactByEmail(mainLocationId, client.email, mainApiKey);
      if (contact?.id) {
        ghlContactId = contact.id;
        if (smsDraft) {
          try {
            const noteBody =
              `[ANNUAL UPSELL DRAFT — Awaiting Riley Approval]\n\n` +
              `Months on plan: ${monthsOnPlan} | Plan: ${planLabel}\n` +
              `Annual price: $${(annualPrice / 100).toFixed(0)}/yr | Saves: $${(savings / 100).toFixed(0)}\n\n` +
              `--- SMS DRAFT ---\n${smsDraft}`;
            const noteRes = await addContactNote(ghlContactId, noteBody, mainApiKey);
            ghlNoteId = noteRes?.id ?? null;
          } catch (err) {
            console.error(`[annual-upsell] GHL note failed for ${client.email}:`, err.message);
          }
        }
      }
    }

    // Log to Supabase
    const { error: logErr } = await supabase.from('annual_upsell_log').insert({
      user_id:                client.id,
      client_email:           client.email,
      client_name:            client.name,
      plan:                   client.plan,
      months_on_plan:         monthsOnPlan,
      annual_price_cents:     annualPrice,
      monthly_price_cents:    monthlyAmountCents,
      savings_cents:          savings,
      sms_draft:              smsDraft,
      ghl_contact_id:         ghlContactId,
      ghl_note_id:            ghlNoteId,
      stripe_subscription_id: client.stripe_subscription_id,
    });

    if (logErr) {
      console.error(`[annual-upsell] log insert failed for ${client.email}:`, logErr.message);
    }

    results.push({
      email:        client.email,
      name:         client.name,
      plan:         planLabel,
      monthsOnPlan,
      savingsDollars: (savings / 100).toFixed(0),
    });

    console.log(`[annual-upsell] targeted ${client.email} — ${planLabel}, ${monthsOnPlan}mo, saves $${(savings / 100).toFixed(0)}`);
  }

  // Send SMS digest to Riley
  if (results.length > 0) {
    const lines = results.map(
      (r) => `• ${r.name || r.email} (${r.plan}, ${r.monthsOnPlan}mo) — saves $${r.savingsDollars}/yr`
    );
    const smsBody =
      `[HypeBox] Annual upsell targets this month (${results.length}):\n` +
      lines.join('\n') +
      `\nDrafts saved in GHL notes.`;
    try {
      await sendAlertSMS(smsBody);
    } catch (err) {
      console.error('[annual-upsell] Riley alert SMS failed:', err.message);
    }
  } else {
    console.log('[annual-upsell] no new targets this month');
  }

  return NextResponse.json({ ok: true, targeted: results.length, results });
}

export const GET = withErrorMonitor('annual-upsell', handler);

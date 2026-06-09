import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { ghlFetch, getContactsByTag, getAppointments } from '@/lib/ghl';
import { sendSMS } from '@/lib/twilio';
import { safeCompare } from '@/lib/safe-compare';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const LOC = process.env.GHL_LOCATION_ID || 'Ra79aZSYkl96uPQajjkJ';

const PLAN_PRICES = {
  launch: 97, starter: 97,
  rocket: 297, growth: 297,
  velocity: 497, pro: 497,
};

// ── GHL helpers ────────────────────────────────────────────────────────────

async function getContactsByTagSince(tag, sinceMs, apiKey) {
  try {
    const contacts = await getContactsByTag(LOC, tag, apiKey);
    return contacts.filter((c) => {
      const added = c.dateAdded ? new Date(c.dateAdded).getTime() : 0;
      return added >= sinceMs;
    });
  } catch (err) {
    console.warn(`[weekly-report] tag "${tag}" fetch error:`, err.message);
    return [];
  }
}

async function getInboundReplies(sinceMs, apiKey) {
  try {
    const data = await ghlFetch(
      `/conversations/search?locationId=${LOC}&sort=last_message_date&sortBy=desc&limit=100`,
      apiKey
    );
    const convs = data?.conversations ?? [];
    return convs.filter((c) => {
      const lastDate = c.lastMessageDate ? new Date(c.lastMessageDate).getTime() : 0;
      return lastDate >= sinceMs && c.lastMessageDirection === 'inbound';
    }).length;
  } catch (err) {
    console.warn('[weekly-report] conversations fetch error:', err.message);
    return 0;
  }
}

async function getDemosBooked(sinceMs, apiKey) {
  try {
    const weekAgo = new Date(sinceMs);
    const now = new Date();
    const events = await getAppointments(LOC, weekAgo.toISOString(), now.toISOString(), apiKey);
    return events.filter(
      (e) => e.appointmentStatus !== 'cancelled' && e.appointmentStatus !== 'invalid'
    ).length;
  } catch (err) {
    console.warn('[weekly-report] appointments fetch error:', err.message);
    return 0;
  }
}

function getTopNiche(contacts) {
  const NICHES = ['plumber', 'hvac', 'electrician', 'concrete', 'roofer', 'landscaper'];
  const counts = {};
  for (const c of contacts) {
    for (const tag of c.tags || []) {
      const niche = NICHES.find((n) => tag.toLowerCase().includes(n));
      if (niche) counts[niche] = (counts[niche] || 0) + 1;
    }
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

function getBestCity(contacts) {
  const counts = {};
  for (const c of contacts) {
    const city = (c.city || '').trim();
    if (city) counts[city] = (counts[city] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

// ── Supabase helpers ───────────────────────────────────────────────────────

async function getClientMetrics(supabase, sinceIso) {
  const { data: allUsers } = await supabase
    .from('users')
    .select('plan, plan_status, created_at')
    .not('plan_status', 'is', null)
    .neq('role', 'super_admin');

  const users = allUsers ?? [];

  const totalMrr = users
    .filter((u) => u.plan_status === 'active' || u.plan_status === 'trialing')
    .reduce((sum, u) => sum + (PLAN_PRICES[u.plan] || 0), 0);

  const newClients = users.filter(
    (u) => u.plan_status === 'active' && u.created_at >= sinceIso
  );

  const mrrAdded = newClients.reduce((sum, u) => sum + (PLAN_PRICES[u.plan] || 0), 0);

  return { totalMrr, newClientsSigned: newClients.length, mrrAdded };
}

async function getHealthScores(supabase) {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const { data } = await supabase
    .from('client_health_log')
    .select('user_id, health_score, date')
    .gte('date', weekAgo)
    .order('date', { ascending: false });

  const seen = new Set();
  const scores = { green: 0, yellow: 0, red: 0 };
  for (const row of data ?? []) {
    if (!seen.has(row.user_id)) {
      seen.add(row.user_id);
      if (row.health_score in scores) scores[row.health_score]++;
    }
  }
  return scores;
}

// ── AI summary ─────────────────────────────────────────────────────────────

async function buildAiSummary(metrics) {
  const {
    leadsScraped, barryOutreachSent, repliesReceived, hotLeadsGenerated,
    demosBooked, newClientsSigned, mrrAdded, totalMrr,
    healthGreen, healthYellow, healthRed,
    topNiche, bestCity, weekLabel,
  } = metrics;

  const replyRate = barryOutreachSent > 0
    ? Math.round((repliesReceived / barryOutreachSent) * 100)
    : 0;

  const prompt = `You're writing a weekly business summary text for Riley and his dad. They run TheHypeBox — a SaaS selling AI voice agents to local trade businesses (plumbers, HVAC, electricians, etc). Barry is their AI outreach agent that texts scraped leads.

Week of ${weekLabel}:
- Leads scraped from Google Maps: ${leadsScraped}
- Barry outreach texts sent: ${barryOutreachSent}
- Replies received: ${repliesReceived} (${replyRate}% reply rate)
- Hot leads generated: ${hotLeadsGenerated}
- Demo calls booked: ${demosBooked}
- New clients signed: ${newClientsSigned}
- MRR added this week: $${mrrAdded}
- Total MRR: $${totalMrr}
- Client health — Green: ${healthGreen}, Yellow: ${healthYellow}, Red: ${healthRed}
- Top performing niche: ${topNiche || 'unclear'}
- Best performing city: ${bestCity || 'unclear'}

Write a weekly business summary. Be direct and honest — what worked, what didn't, what Riley should focus on next week. Lead with the biggest win or the biggest problem, whichever matters more. Keep it to 5–6 sentences. No bullet points, no headers, no emojis. Plain text only.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${err}`);
  }

  const result = await res.json();
  return result.content?.[0]?.text ?? 'Weekly metrics collected but AI summary generation failed.';
}

// ── Main handler ───────────────────────────────────────────────────────────

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    console.error('[weekly-report] CRON_SECRET not set');
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GHL_LOCATION_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GHL_LOCATION_KEY not configured' }, { status: 500 });
  }

  const supabase = createClient();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sinceMs = weekAgo.getTime();
  const sinceIso = weekAgo.toISOString();
  const weekLabel = `${weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  try {
    const [
      scrapedContacts,
      smsContacts,
      hotLeadContacts,
      repliesReceived,
      demosBooked,
      clientMetrics,
      healthScores,
    ] = await Promise.all([
      getContactsByTagSince('google-maps-scraped', sinceMs, apiKey),
      getContactsByTagSince('sms-sent', sinceMs, apiKey),
      getContactsByTagSince('hot-lead', sinceMs, apiKey),
      getInboundReplies(sinceMs, apiKey),
      getDemosBooked(sinceMs, apiKey),
      getClientMetrics(supabase, sinceIso),
      getHealthScores(supabase),
    ]);

    const metrics = {
      leadsScraped: scrapedContacts.length,
      barryOutreachSent: smsContacts.length,
      repliesReceived,
      hotLeadsGenerated: hotLeadContacts.length,
      demosBooked,
      newClientsSigned: clientMetrics.newClientsSigned,
      mrrAdded: clientMetrics.mrrAdded,
      totalMrr: clientMetrics.totalMrr,
      healthGreen: healthScores.green,
      healthYellow: healthScores.yellow,
      healthRed: healthScores.red,
      topNiche: getTopNiche(smsContacts),
      bestCity: getBestCity(hotLeadContacts),
      weekLabel,
    };

    console.log('[weekly-report] metrics:', JSON.stringify(metrics));

    const aiSummary = await buildAiSummary(metrics);

    const phones = [process.env.RILEY_PHONE, process.env.DAD_PHONE].filter(Boolean);
    const smsResults = [];
    const smsText = `TheHypeBox Weekly (${weekLabel}):\n\n${aiSummary}`;

    for (const phone of phones) {
      try {
        await sendSMS(phone, smsText, { apiKey, locationId: LOC });
        smsResults.push({ phone, ok: true });
        console.log(`[weekly-report] SMS sent to ${phone}`);
      } catch (err) {
        smsResults.push({ phone, ok: false, error: err.message });
        console.error(`[weekly-report] SMS failed to ${phone}:`, err.message);
      }
    }

    const { error: insertErr } = await supabase.from('weekly_reports').upsert({
      week_start: weekAgo.toISOString().split('T')[0],
      week_end: now.toISOString().split('T')[0],
      leads_scraped: metrics.leadsScraped,
      barry_outreach_sent: metrics.barryOutreachSent,
      replies_received: metrics.repliesReceived,
      hot_leads_generated: metrics.hotLeadsGenerated,
      demos_booked: metrics.demosBooked,
      new_clients_signed: metrics.newClientsSigned,
      mrr_added: metrics.mrrAdded,
      total_mrr: metrics.totalMrr,
      health_green: metrics.healthGreen,
      health_yellow: metrics.healthYellow,
      health_red: metrics.healthRed,
      top_niche: metrics.topNiche,
      best_city: metrics.bestCity,
      ai_summary: aiSummary,
      raw_metrics: metrics,
      sms_sent_to: smsResults,
      created_at: now.toISOString(),
    }, { onConflict: 'week_start' });

    if (insertErr) {
      console.warn('[weekly-report] Supabase upsert failed (run migration 033_weekly_reports.sql):', insertErr.message);
    }

    console.log(
      `[weekly-report] done — scraped=${metrics.leadsScraped} barry=${metrics.barryOutreachSent} ` +
      `replies=${metrics.repliesReceived} hot=${metrics.hotLeadsGenerated} demos=${metrics.demosBooked} ` +
      `clients=${metrics.newClientsSigned} mrr_added=$${metrics.mrrAdded} total_mrr=$${metrics.totalMrr} ` +
      `sms=${smsResults.filter((r) => r.ok).length}/${phones.length}`
    );

    return NextResponse.json({
      ok: true,
      week: weekLabel,
      metrics,
      aiSummary,
      smsResults,
    });
  } catch (err) {
    console.error('[weekly-report] fatal error:', err);
    return NextResponse.json({ error: err.message || 'Something went wrong.' }, { status: 500 });
  }
}

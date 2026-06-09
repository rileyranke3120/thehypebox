import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';
import { safeCompare } from '@/lib/safe-compare';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ── TheHypeBox baseline for comparison ───────────────────────

const THEHYPEBOX = {
  plans: [
    { name: 'Launch Box',   monthly: 97,  features: ['AI phone receptionist (Sarah)', 'GHL CRM & pipeline', 'Missed call text-back', 'Basic automation workflows', 'Lead capture & follow-up'] },
    { name: 'Rocket Box',   monthly: 297, features: ['Everything in Launch', 'Advanced pipeline automation', 'Multi-step drip sequences', 'Appointment reminders', 'Post-service review requests'] },
    { name: 'Velocity Box', monthly: 497, features: ['Everything in Rocket', 'Full AI automation suite', 'Cold outreach system', 'Custom reporting & analytics', 'Priority support'] },
  ],
  differentiators: [
    '14-day free trial, no credit card required',
    'Done-for-you setup — client never touches the tech',
    'AI phone agent answers calls 24/7 (Sarah on Retell AI)',
    'GoHighLevel CRM white-labeled and included',
    'All-in-one — replaces phone answering service + CRM + automations',
    'Built specifically for home service trades (HVAC, plumbing, electrical, concrete)',
  ],
  target: 'Home service businesses in Columbus and surrounding Ohio metro areas',
};

// ── Search queries ────────────────────────────────────────────

const SEARCH_QUERIES = [
  'AI phone answering service home services Columbus Ohio',
  'marketing automation agency contractors Columbus Ohio',
  'GoHighLevel agency Columbus Ohio',
  'AI receptionist HVAC plumbing Columbus Ohio',
  'CRM automation agency home service Ohio',
  'virtual receptionist service small business Columbus Ohio',
  'missed call text back service Columbus Ohio',
];

// Domains that are platforms/tools, not direct competitors
const EXCLUDE_DOMAINS = new Set([
  'gohighlevel.com', 'leadconnectorhq.com', 'thehypeboxllc.com',
  'google.com', 'yelp.com', 'facebook.com', 'linkedin.com',
  'youtube.com', 'instagram.com', 'twitter.com', 'x.com',
  'zapier.com', 'hubspot.com', 'salesforce.com',
]);

// ── Google Places API (New) ───────────────────────────────────

async function searchPlaces(query, apiKey) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': [
        'places.displayName',
        'places.formattedAddress',
        'places.nationalPhoneNumber',
        'places.websiteUri',
        'places.rating',
        'places.userRatingCount',
      ].join(','),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ textQuery: query, pageSize: 10 }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.places ?? [];
}

// ── Website content fetcher ───────────────────────────────────

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{3,}/g, '  ')
    .trim();
}

async function fetchSiteContent(rawUrl) {
  let origin;
  try {
    origin = new URL(rawUrl).origin;
  } catch {
    return null;
  }

  // Try /pricing first, then homepage — pricing page is the money shot
  for (const target of [`${origin}/pricing`, rawUrl]) {
    try {
      const res = await fetch(target, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; research-bot/1.0)' },
      });
      if (!res.ok) continue;
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html')) continue;
      const html = await res.text();
      const text = stripHtml(html);
      if (text.length > 300) return text.slice(0, 4000);
    } catch {
      // try next
    }
  }
  return null;
}

// ── Claude competitive analysis ───────────────────────────────

async function analyzeCompetitors(competitors) {
  const hypeboxBlock = `
OUR PRODUCT — TheHypeBox:
Target: ${THEHYPEBOX.target}
Key differentiators: ${THEHYPEBOX.differentiators.join(' | ')}
Pricing:
${THEHYPEBOX.plans.map((p) => `  • ${p.name}: $${p.monthly}/mo — ${p.features.join(', ')}`).join('\n')}
`.trim();

  const competitorBlocks = competitors
    .map((c, i) => {
      const lines = [
        `COMPETITOR ${i + 1}: ${c.name}`,
        c.website && `Website: ${c.website}`,
        c.address  && `Location: ${c.address}`,
        c.rating   && `Rating: ${c.rating}/5 (${c.ratingCount ?? '?'} reviews)`,
        c.content  && `\nWebsite excerpt:\n${c.content}`,
      ].filter(Boolean);
      return lines.join('\n');
    })
    .join('\n\n---\n\n');

  const prompt = `You are a competitive intelligence analyst. Analyze these competitors for TheHypeBox and produce a concise intelligence report.

${hypeboxBlock}

COMPETITORS FOUND (${competitors.length} total):

${competitorBlocks}

Write a structured report with exactly these sections. Be specific, skip fluff.

## 1. REAL THREATS
Which of these are actual direct competitors (selling AI phone/CRM/automation to home service businesses)? List name, what they offer, and pricing if found. Ignore irrelevant results.

## 2. PRICING LANDSCAPE
What are real competitors charging? How does our $97/$297/$497 stack compare? Are we underpriced, overpriced, or right?

## 3. WHERE WE'RE WINNING
Our specific advantages over these competitors based on the data.

## 4. GAPS & RISKS
What features or positioning angles are competitors using that we lack? Any threats to watch?

## 5. RECOMMENDED ACTIONS
3 specific, actionable moves Riley should consider this week.

## SMS_SUMMARY
(One line, under 155 chars, plain text — for a text message to Riley)`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);

  const result = await res.json();
  return result.content?.[0]?.text ?? '';
}

// ── Route ────────────────────────────────────────────────────

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const placesKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!placesKey) {
    return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY not configured' }, { status: 500 });
  }

  const today = new Date().toISOString().split('T')[0];
  console.log('[competitor-monitor] Starting — ', today);

  // ── Phase 1: Discover competitors via Places ──────────────

  const seen = new Map(); // hostname → competitor object

  for (const query of SEARCH_QUERIES) {
    try {
      console.log(`[competitor-monitor] Searching: ${query}`);
      const places = await searchPlaces(query, placesKey);

      for (const place of places) {
        const website = place.websiteUri;
        if (!website) continue;

        let hostname;
        try {
          hostname = new URL(website).hostname.replace(/^www\./, '');
        } catch {
          continue;
        }

        if (EXCLUDE_DOMAINS.has(hostname)) continue;
        if ([...EXCLUDE_DOMAINS].some((d) => hostname.endsWith(`.${d}`))) continue;

        if (!seen.has(hostname)) {
          seen.set(hostname, {
            name:        place.displayName?.text ?? hostname,
            website,
            address:     place.formattedAddress ?? null,
            phone:       place.nationalPhoneNumber ?? null,
            rating:      place.rating ?? null,
            ratingCount: place.userRatingCount ?? null,
            content:     null,
          });
        }
      }
    } catch (err) {
      console.warn(`[competitor-monitor] Search failed — "${query}":`, err.message);
    }
  }

  const competitors = [...seen.values()].slice(0, 15);
  console.log(`[competitor-monitor] ${competitors.length} unique competitors found`);

  // ── Phase 2: Fetch website content in parallel ────────────
  // Cap at 8 fetches to stay well within the 5-min timeout
  await Promise.all(
    competitors.slice(0, 8).map(async (c) => {
      c.content = await fetchSiteContent(c.website);
      console.log(
        `[competitor-monitor] ${c.website} — ${c.content ? `${c.content.length} chars` : 'no content'}`
      );
    })
  );

  // ── Phase 3: Claude analysis ──────────────────────────────
  let report = '';
  let smsSummary = `Competitor scan: ${competitors.length} found in Columbus area. Check admin for full report.`;

  if (competitors.length > 0) {
    try {
      report = await analyzeCompetitors(competitors);
      const match = report.match(/##\s*SMS_SUMMARY\s*\n+([\s\S]+?)(\n##|$)/i);
      const extracted = match?.[1]?.trim().replace(/^[*_`]+|[*_`]+$/g, '');
      if (extracted && extracted.length < 160) smsSummary = extracted;
      console.log('[competitor-monitor] Analysis complete');
    } catch (err) {
      console.error('[competitor-monitor] Claude failed:', err.message);
      report = `Claude analysis failed: ${err.message}`;
    }
  } else {
    report = 'No competitors found via Places API for the given queries.';
  }

  // ── Phase 4: Save to Supabase ─────────────────────────────
  const supabase = createClient();

  const { error: dbErr } = await supabase.from('competitor_reports').insert({
    date:              today,
    competitors_found: competitors.length,
    report_text:       report,
    // Store metadata only — skip full page content dumps
    raw_data: competitors.map(({ content: _c, ...rest }) => rest),
    created_at:        new Date().toISOString(),
  });

  if (dbErr) {
    console.error('[competitor-monitor] DB insert failed:', dbErr.message);
  } else {
    console.log('[competitor-monitor] Report saved');
  }

  // ── Phase 5: SMS Riley ────────────────────────────────────
  const rileyPhone  = process.env.RILEY_PHONE;
  const smsApiKey   = process.env.GHL_SMS_KEY;
  const smsLocation = process.env.GHL_LOCATION_ID;

  let smsSent = false;
  if (rileyPhone && smsApiKey && smsLocation) {
    try {
      await sendSMS(rileyPhone, `[HypeBox Intel] ${smsSummary}`, {
        apiKey:     smsApiKey,
        locationId: smsLocation,
      });
      smsSent = true;
      console.log('[competitor-monitor] SMS sent to Riley');
    } catch (err) {
      console.warn('[competitor-monitor] SMS failed:', err.message);
    }
  } else {
    console.warn('[competitor-monitor] Missing SMS env vars — skipping');
  }

  return NextResponse.json({
    ok:               true,
    date:             today,
    competitorsFound: competitors.length,
    reportSaved:      !dbErr,
    smsSent,
  });
}

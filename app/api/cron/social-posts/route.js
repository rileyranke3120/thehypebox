import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';
import { safeCompare } from '@/lib/safe-compare';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ANTHROPIC_BASE = 'https://api.anthropic.com';
const MODEL = 'claude-sonnet-4-6';
const LOC_ID = 'Ra79aZSYkl96uPQajjkJ';

const NICHES = ['plumber', 'HVAC', 'electrician', 'concrete contractor'];

const PLATFORM_RULES = {
  facebook: {
    label: 'Facebook',
    tone: 'conversational and story-driven',
    length: '150–200 words',
    hashtags: '3–5 hashtags',
  },
  instagram: {
    label: 'Instagram',
    tone: 'punchy, energetic, visual language, uses 1–2 emojis naturally',
    length: '80–120 words',
    hashtags: '8–10 hashtags',
  },
  linkedin: {
    label: 'LinkedIn',
    tone: 'professional, insight-driven, ROI-focused',
    length: '180–240 words',
    hashtags: '4–6 hashtags',
  },
};

// Pick niche by rotating through the 4 options based on the week number.
// Mon/Wed/Fri runs give 3 runs/week → cycles all 4 niches over ~1.3 weeks.
function pickNiche(date) {
  const start = new Date('2026-01-05'); // first Monday of 2026
  const msPerRun = (7 / 3) * 24 * 60 * 60 * 1000; // approx ms between runs
  const runIndex = Math.floor((date - start) / msPerRun);
  return NICHES[((runIndex % NICHES.length) + NICHES.length) % NICHES.length];
}

function buildPrompt(niche, dateStr) {
  return `Generate 3 social media posts for TheHypeBox — an AI automation platform for local home service businesses.

Today's focus niche: ${niche}
Date: ${dateStr}

TheHypeBox core value props:
- AI answers every missed call 24/7, even when the owner is on the job
- Automatic text-back the second a call is missed so the lead doesn't go to a competitor
- Follows up on leads automatically, books appointments to the calendar
- Owners stop losing $3,000–$5,000/month in jobs they never knew they missed
- 14-day free trial at thehypeboxllc.com

Post requirements by platform:

Facebook — ${PLATFORM_RULES.facebook.tone}. ${PLATFORM_RULES.facebook.length}. ${PLATFORM_RULES.facebook.hashtags}. Tell a quick story or scenario a ${niche} would recognize. Soft CTA.

Instagram — ${PLATFORM_RULES.instagram.tone}. ${PLATFORM_RULES.instagram.length}. ${PLATFORM_RULES.instagram.hashtags}. Hook in the first line. Feel scroll-stopping.

LinkedIn — ${PLATFORM_RULES.linkedin.tone}. ${PLATFORM_RULES.linkedin.length}. ${PLATFORM_RULES.linkedin.hashtags}. Lead with a stat or insight. Frame it for business owners and entrepreneurs.

Rules for all posts:
- Speak directly to ${niche}s and their specific missed-call pain
- Never sound like an ad — sound like someone who gets their world
- CTA must be soft: mention thehypeboxllc.com or "14-day free trial" once, naturally
- Hashtags must be realistic for each platform's niche audience

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "facebook":  { "content": "...", "hashtags": ["..."] },
  "instagram": { "content": "...", "hashtags": ["..."] },
  "linkedin":  { "content": "...", "hashtags": ["..."] }
}`;
}

async function generatePosts(niche, dateStr) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const res = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: 'user', content: buildPrompt(niche, dateStr) }],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic ${res.status}: ${text}`);
  }

  const data = await res.json();
  const raw = data.content?.[0]?.text ?? '';

  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`Claude JSON parse failed. Raw: ${raw.slice(0, 200)}`);
  }
}

function buildSMSPreview(posts, niche, dateStr) {
  const day = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const lines = [
    `📱 3 Social Posts Ready — ${day}`,
    `Niche: ${niche}`,
    '',
  ];

  for (const [platform, { label }] of Object.entries(PLATFORM_RULES)) {
    const post = posts[platform];
    if (!post) continue;
    const preview = (post.content || '').slice(0, 90).replace(/\n/g, ' ');
    const ellipsis = post.content?.length > 90 ? '…' : '';
    lines.push(`${label}: "${preview}${ellipsis}"`);
    lines.push('');
  }

  lines.push('Review + approve at thehypeboxllc.com/dashboard/admin/social');
  return lines.join('\n');
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');

  if (!process.env.CRON_SECRET) {
    console.error('[social-posts] CRON_SECRET not set');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ghlApiKey = process.env.GHL_LOCATION_KEY;
  if (!ghlApiKey) {
    console.error('[social-posts] GHL_LOCATION_KEY not set');
    return NextResponse.json({ error: 'GHL_LOCATION_KEY not configured' }, { status: 500 });
  }

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const niche = pickNiche(now);
  const runId = `${dateStr}-${niche.replace(/\s+/g, '-')}`;

  console.log(`[social-posts] run_id=${runId} niche=${niche}`);

  // Generate posts via Claude
  let posts;
  try {
    posts = await generatePosts(niche, dateStr);
  } catch (err) {
    console.error('[social-posts] generation error:', err.message);
    return NextResponse.json({ error: 'Post generation failed', detail: err.message }, { status: 500 });
  }

  // Save all 3 posts to Supabase
  const supabase = createClient();
  const rows = Object.entries(PLATFORM_RULES).map(([platform]) => ({
    run_id: runId,
    platform,
    niche,
    content: posts[platform]?.content ?? '',
    hashtags: posts[platform]?.hashtags ?? [],
    scheduled_date: dateStr,
    status: 'pending',
  }));

  const { error: insertError } = await supabase.from('social_posts').insert(rows);
  if (insertError) {
    console.error('[social-posts] Supabase insert error:', insertError.message);
    return NextResponse.json({ error: 'DB insert failed', detail: insertError.message }, { status: 500 });
  }

  console.log(`[social-posts] saved 3 posts for run_id=${runId}`);

  // SMS preview to Riley
  const rileyPhone = process.env.RILEY_PHONE;
  if (rileyPhone) {
    try {
      const preview = buildSMSPreview(posts, niche, dateStr);
      await sendSMS(rileyPhone, preview, { apiKey: ghlApiKey, locationId: LOC_ID });
      console.log('[social-posts] SMS preview sent to Riley');
    } catch (err) {
      console.error('[social-posts] SMS error:', err.message);
    }
  } else {
    console.warn('[social-posts] RILEY_PHONE not set — skipping SMS');
  }

  return NextResponse.json({ ok: true, run_id: runId, niche, posts_saved: rows.length });
}

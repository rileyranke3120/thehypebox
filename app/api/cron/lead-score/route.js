import { NextResponse } from 'next/server';
import { getContactsByTag, addContactNote, addContactTags } from '@/lib/ghl';
import { safeCompare } from '@/lib/safe-compare';
import { withErrorMonitor } from '@/lib/error-monitor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GHL_BASE = 'https://services.leadconnectorhq.com';
const LOCATION_ID = process.env.GHL_LOCATION_ID;
const TARGET_TAGS = ['plumber', 'hvac', 'electrician', 'concrete'];
const SCORED_TAGS = new Set(['hot-lead', 'warm-lead', 'cold-lead']);
const SKIP_TAGS = new Set(['opted-out']);
const BATCH_LIMIT = 15;

const CORPORATE_SUFFIX = /\b(inc\.?|llc\.?|corp\.?|ltd\.?|group|systems|solutions|enterprises|associates|industries|national|regional|professional)\b/i;
const SOLO_POSSESSIVE  = /\w+'s\s/i;
const SOLO_FIRST_NAMES = /^(mike|michael|john|dave|david|bob|robert|jim|james|tom|thomas|joe|joseph|chris|christopher|brian|kevin|mark|paul|steve|steven|jeff|jeffrey|bill|william|rick|richard|dan|daniel|frank|scott|gary|larry|kenny|kenneth|eric|sam|samuel|ray|raymond|ron|ronald|tim|timothy|greg|gregory|tony|anthony|matt|matthew|jason|ryan|justin|brad|charlie|chuck|carl|carlos|al|albert|fred|doug|douglas|dennis|roger|wayne|jack|henry|harry|pete|peter|joey|corey|travis|chad|cody|brett|derek|adam|aaron|alex|kyle|jake|drew|zach|zachary|nathan|nate|ethan|caleb|tyler|trevor|blake|hunter|austin)\b/i;

function isSolo(name) {
  if (!name) return false;
  if (CORPORATE_SUFFIX.test(name)) return false;
  return SOLO_POSSESSIVE.test(name) || SOLO_FIRST_NAMES.test(name);
}

function baseScore(contact) {
  let score = 0;
  const pts = [];
  if (contact.phone)   { score += 20; pts.push('phone +20'); }
  if (contact.website) { score += 15; pts.push('website +15'); }
  else                 { score += 10; pts.push('no-website +10'); }
  const name = contact.name || contact.companyName || '';
  if (isSolo(name))    { score += 10; pts.push('solo +10'); }
  return { score: Math.min(100, Math.max(1, score)), pts };
}

async function scoreWithClaude(contact, base, pts) {
  const name  = contact.name || contact.companyName || 'Unknown';
  const trade = (contact.tags || []).find(t => TARGET_TAGS.includes(t)) || 'contractor';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 120,
      messages: [{
        role: 'user',
        content: `Score this home service business as a sales lead for an AI automation platform (AI receptionist, review management, missed-call text back). Rate 1–100.

Business: ${name}
Trade: ${trade}
Phone: ${contact.phone ? 'yes' : 'no'}
Website: ${contact.website ? 'yes' : 'no'}
Rule score: ${base}/100
Factors: ${pts.join(', ')}

HVAC/plumbers = highest value (busy, hate missed calls). Solo operators = best target. Corporate = less receptive. Concrete = project-based, lower urgency.

Return ONLY valid JSON: {"score":<1-100>,"reason":"<120 chars max>"}`,
      }],
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data  = await res.json();
  const text  = (data.content?.[0]?.text || '').trim();
  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) throw new Error('No JSON in Claude response');
  const parsed = JSON.parse(match[0]);
  return {
    score:  Math.min(100, Math.max(1, Math.round(Number(parsed.score)))),
    reason: String(parsed.reason || '').slice(0, 200),
  };
}

async function ensureLeadScoreField(apiKey) {
  const res  = await fetch(`${GHL_BASE}/locations/${LOCATION_ID}/customFields`, {
    headers: { Authorization: `Bearer ${apiKey}`, Version: '2021-07-28' },
    signal: AbortSignal.timeout(8000),
  });
  const data   = await res.json().catch(() => ({}));
  const fields = data.customFields || [];
  const found  = fields.find(f =>
    f.name?.toLowerCase().replace(/\s+/g, '_') === 'lead_score' ||
    f.fieldKey?.includes('lead_score')
  );
  if (found) return found.fieldKey;

  const cr  = await fetch(`${GHL_BASE}/locations/${LOCATION_ID}/customFields`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Lead Score', dataType: 'NUMERICAL' }),
    signal: AbortSignal.timeout(8000),
  });
  const cd = await cr.json().catch(() => ({}));
  return cd.customField?.fieldKey || cd.fieldKey || 'lead_score';
}

async function updateGHL(contactId, fieldKey, score, tier, apiKey) {
  await fetch(`${GHL_BASE}/contacts/${contactId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${apiKey}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ customFields: [{ key: fieldKey, field_value: String(score) }] }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => {});

  await fetch(`${GHL_BASE}/contacts/${contactId}/tags`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiKey}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags: ['hot-lead', 'warm-lead', 'cold-lead'] }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => {});

  await new Promise(r => setTimeout(r, 250));
  await addContactTags(contactId, [tier], apiKey);
}

async function handler(request) {
  const authHeader = request.headers.get('authorization');
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GHL_LOCATION_KEY;
  if (!apiKey)     return NextResponse.json({ error: 'GHL_LOCATION_KEY not configured' }, { status: 500 });
  if (!LOCATION_ID) return NextResponse.json({ error: 'GHL_LOCATION_ID not configured' }, { status: 500 });

  // Collect contacts across all target trades, deduped
  const seen = new Set();
  const all  = [];
  for (const tag of TARGET_TAGS) {
    try {
      const batch = await getContactsByTag(LOCATION_ID, tag, apiKey);
      for (const c of batch) {
        if (!seen.has(c.id)) { seen.add(c.id); all.push(c); }
      }
    } catch (err) {
      console.warn(`[lead-score] tag=${tag} fetch failed:`, err.message);
    }
  }

  const unscored = all
    .filter(c => {
      const tags = c.tags || [];
      return !tags.some(t => SCORED_TAGS.has(t)) && !tags.some(t => SKIP_TAGS.has(t));
    })
    .slice(0, BATCH_LIMIT);

  console.log(`[lead-score] ${all.length} total, ${unscored.length} unscored to process`);

  if (unscored.length === 0) {
    return NextResponse.json({ ok: true, total: all.length, unscored: 0, scored: 0 });
  }

  let fieldKey = 'lead_score';
  try { fieldKey = await ensureLeadScoreField(apiKey); } catch (err) {
    console.warn('[lead-score] field setup failed (using default key):', err.message);
  }

  const results = { scored: 0, hot: 0, warm: 0, cold: 0, errors: [] };

  for (const contact of unscored) {
    const name = contact.name || contact.companyName || contact.id;
    try {
      const { score: base, pts } = baseScore(contact);
      let finalScore = base;
      let reason = `Rule-based: ${pts.join(', ')}`;

      if (process.env.ANTHROPIC_API_KEY) {
        try {
          const ai = await scoreWithClaude(contact, base, pts);
          finalScore = ai.score;
          reason     = ai.reason;
        } catch (err) {
          console.warn(`[lead-score] Claude failed for ${name}:`, err.message);
        }
      }

      const tier = finalScore >= 80 ? 'hot-lead' : finalScore >= 50 ? 'warm-lead' : 'cold-lead';
      await updateGHL(contact.id, fieldKey, finalScore, tier, apiKey);
      await addContactNote(contact.id, `[Lead Score ${finalScore}] ${reason}`, apiKey);

      results.scored++;
      if (tier === 'hot-lead') results.hot++;
      else if (tier === 'warm-lead') results.warm++;
      else results.cold++;

      console.log(`[lead-score] ${name} → ${finalScore} (${tier})`);
      await new Promise(r => setTimeout(r, 400));
    } catch (err) {
      console.error(`[lead-score] error on ${name}:`, err.message);
      results.errors.push({ id: contact.id, name, error: err.message });
    }
  }

  console.log(`[lead-score] done — ${results.scored} scored: ${results.hot} hot, ${results.warm} warm, ${results.cold} cold`);
  return NextResponse.json({ ok: true, total: all.length, unscored: unscored.length, ...results });
}

export const GET = withErrorMonitor('lead-score', handler);

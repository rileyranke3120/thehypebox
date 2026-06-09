import { NextResponse } from 'next/server';
import { getContact, getContactConversation, getConversationMessages, addContactTags, addContactNote } from '@/lib/ghl';
import { sendSMS } from '@/lib/twilio';
import { createClient } from '@/lib/supabase';
import { safeCompare } from '@/lib/safe-compare';

const LOC_ID = 'Ra79aZSYkl96uPQajjkJ';
const ANTHROPIC_BASE = 'https://api.anthropic.com';
const MODEL = 'claude-sonnet-4-6';

const BARRY_SYSTEM = `You are Barry, co-founder of TheHypeBox — an AI automation platform built specifically for home service businesses (roofers, painters, plumbers, HVAC techs, concrete contractors, landscapers, and similar trades).

Your job: have a real, helpful SMS conversation to understand this business owner's situation and naturally show how TheHypeBox solves their biggest problem — missed calls costing them jobs.

WHAT THEHYPEBOX DOES:
- AI answers every missed call 24/7, even when the owner is on the job
- Sends an automatic text-back the moment a call is missed so the lead doesn't go to a competitor
- Follows up on leads automatically — no more sticky notes or forgotten callbacks
- Books appointments directly to the owner's calendar
- Home service owners using it stop losing $3,000–$5,000+ per month in missed jobs

PRICING (share only if they ask):
- Launch Box: $97/month — AI phone agent + missed call text-back
- Rocket Box: $297/month — Launch + full automation + pipeline tracking
- Velocity Box: $497/month — Complete AI suite, everything included
- All plans: 14-day free trial, no card required to start
- Book a demo: thehypeboxllc.com

CONVERSATION RULES:
1. Every reply MUST be under 160 characters — this is SMS
2. Be warm, real, and direct — like a person, not a marketer
3. Ask ONE question max per message to keep it moving
4. Never be pushy — let their curiosity drive it
5. If they want a demo or to get started, point them to thehypeboxllc.com or say you'll have Riley (your tech guy) set them up
6. Sign every reply "— Barry"

SCORING:
- cold = vague, not interested, short replies with no real engagement
- warm = curious, asking questions, open to hearing more, shows the problem resonates
- hot = asking about pricing, wants a demo, ready to try, says yes to something, asks to be called
- opt-out = says stop, remove me, not interested, wrong number, leave me alone, or any clear rejection

RESPOND ONLY with this exact JSON (no markdown, no extra text):
{"reply":"your SMS reply here","score":"cold|warm|hot|opt-out","alert":null}

For hot leads, set alert to a 2-sentence plain-text summary of who they are and why they're hot. Otherwise alert must be null.`;

const BARRY_ONBOARDING_SYSTEM = `You are Barry, co-founder of TheHypeBox — texting with one of our paying clients to help them get set up and succeed.

Be warm, personal, and helpful. Under 160 characters per reply. Real human tone, not a bot. Sign every reply "— Barry".

WHAT THEHYPEBOX DOES:
- Sarah AI answers every call 24/7 and books appointments automatically
- Missed call text-back fires in under 60 seconds
- Review requests go out automatically after every job
- Everything lives in one dashboard at thehypeboxllc.com/dashboard

If they have setup questions: give a quick helpful answer and offer to have Riley jump on a quick call.
If they say stop/unsubscribe/remove me: set opt_out to true.
Otherwise: set opt_out to false.

RESPOND ONLY with this exact JSON (no markdown, no extra text):
{"reply":"your SMS reply here","opt_out":false}`;

async function callAnthropic(messages, system = BARRY_SYSTEM) {
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
      max_tokens: 300,
      system,
      messages,
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

// Build a valid alternating messages array for Claude.
// GHL history may start with an outbound (assistant) message — strip leading assistant turns.
// Merge consecutive same-role turns to satisfy Claude's alternating requirement.
function buildClaudeMessages(rawHistory, currentInbound) {
  // Map GHL direction → Claude role
  const mapped = rawHistory.map((m) => ({
    role: m.direction === 'inbound' ? 'user' : 'assistant',
    content: (m.body || m.text || '').trim(),
  })).filter((m) => m.content);

  // Drop leading assistant turns
  const firstUserIdx = mapped.findIndex((m) => m.role === 'user');
  const trimmed = firstUserIdx === -1 ? [] : mapped.slice(firstUserIdx);

  // Merge consecutive same-role turns
  const merged = [];
  for (const msg of trimmed) {
    const last = merged[merged.length - 1];
    if (last && last.role === msg.role) {
      last.content += '\n' + msg.content;
    } else {
      merged.push({ ...msg });
    }
  }

  // Ensure the current inbound is the final user message.
  // If GHL already included it as the last history entry, skip. Otherwise append.
  if (currentInbound) {
    const last = merged[merged.length - 1];
    if (!last || last.role !== 'user') {
      merged.push({ role: 'user', content: currentInbound });
    } else if (!last.content.includes(currentInbound)) {
      last.content += '\n' + currentInbound;
    }
  }

  return merged.length ? merged : [{ role: 'user', content: currentInbound || '' }];
}

async function sendAlerts(name, phone, summary, apiKey) {
  const msg = `🔥 HOT LEAD — BARRY\n${name} | ${phone}\n\n${summary}`;
  for (const toPhone of [process.env.RILEY_PHONE, process.env.DAD_PHONE].filter(Boolean)) {
    try {
      await sendSMS(toPhone, msg, { apiKey, locationId: LOC_ID });
    } catch (err) {
      console.error('[ghl-inbound-sms] alert error to', toPhone, err.message);
    }
  }
}

function normalizePhone(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

function currentSurveyMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Returns true and handles the response if this inbound message is an NPS reply.
async function handleNpsReply(phone, rawMessage, apiKey) {
  const score = parseInt(rawMessage.trim(), 10);
  if (isNaN(score) || score < 1 || score > 10) return false;

  const supabase = createClient();
  const month = currentSurveyMonth();
  const normalizedPhone = normalizePhone(phone);

  const { data: pending } = await supabase
    .from('nps_scores')
    .select('id, client_name, riley_alerted, review_requested')
    .eq('client_phone', normalizedPhone)
    .eq('survey_month', month)
    .is('replied_at', null)
    .maybeSingle();

  if (!pending) return false;

  const category = score <= 6 ? 'detractor' : score <= 8 ? 'passive' : 'promoter';
  const firstName = (pending.client_name || 'there').split(' ')[0];

  await supabase.from('nps_scores').update({
    score,
    category,
    replied_at: new Date().toISOString(),
  }).eq('id', pending.id);

  if (category === 'detractor') {
    const replyMsg = `Thanks for the honest feedback, ${firstName}. That's on us and I want to make it right. Riley will reach out to you personally soon. — TheHypeBox`;
    await sendSMS(phone, replyMsg, { apiKey, locationId: LOC_ID }).catch((err) =>
      console.error('[nps-reply] detractor SMS error:', err.message)
    );

    if (!pending.riley_alerted && process.env.RILEY_PHONE) {
      const alertMsg = `⚠️ NPS DETRACTOR\n${pending.client_name || 'Unknown'} | ${phone}\nScore: ${score}/10\nNeeds personal outreach NOW.`;
      await sendSMS(process.env.RILEY_PHONE, alertMsg, { apiKey, locationId: LOC_ID }).catch((err) =>
        console.error('[nps-reply] riley alert error:', err.message)
      );
      await supabase.from('nps_scores').update({ riley_alerted: true }).eq('id', pending.id);
    }
  } else if (category === 'passive') {
    const replyMsg = `Thanks ${firstName}, we appreciate the feedback! We're always working to improve — don't hesitate to reach out if there's anything we can do better. — Riley @ TheHypeBox`;
    await sendSMS(phone, replyMsg, { apiKey, locationId: LOC_ID }).catch((err) =>
      console.error('[nps-reply] passive SMS error:', err.message)
    );
  } else {
    // promoter
    const reviewUrl = process.env.THEHYPEBOX_REVIEW_URL || 'https://g.page/r/thehypebox/review';
    const replyMsg = `That means everything, ${firstName} — thank you! Would you mind leaving us a quick Google review? It helps other contractors find us: ${reviewUrl} — Riley`;
    await sendSMS(phone, replyMsg, { apiKey, locationId: LOC_ID }).catch((err) =>
      console.error('[nps-reply] promoter SMS error:', err.message)
    );
    await supabase.from('nps_scores').update({ review_requested: true }).eq('id', pending.id);
  }

  console.log(`[nps-reply] processed — phone=${normalizedPhone} score=${score} category=${category}`);
  return true;
}

export async function POST(request) {
  const secret = new URL(request.url).searchParams.get('secret');
  if (!safeCompare(secret ?? '', process.env.AUTOMATION_WEBHOOK_SECRET ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  console.log('[ghl-inbound-sms] payload keys:', Object.keys(payload));

  const locationId = payload.locationId || LOC_ID;
  if (locationId !== LOC_ID) {
    console.log('[ghl-inbound-sms] wrong location, skipping:', locationId);
    return NextResponse.json({ ok: true, skipped: 'wrong-location' });
  }

  const contactId = payload.contactId || payload.contact?.id;
  const inboundMessage = (payload.messageBody || payload.message?.body || payload.body || '').trim();
  const conversationId = payload.conversationId || payload.conversation?.id;

  if (!inboundMessage) {
    console.log('[ghl-inbound-sms] empty message body, skipping');
    return NextResponse.json({ ok: true, skipped: 'empty-message' });
  }

  if (!contactId) {
    console.error('[ghl-inbound-sms] no contactId');
    return NextResponse.json({ error: 'missing contactId' }, { status: 400 });
  }

  const apiKey = process.env.GHL_LOCATION_KEY;
  if (!apiKey) {
    console.error('[ghl-inbound-sms] GHL_LOCATION_KEY not set');
    return NextResponse.json({ error: 'server misconfigured' }, { status: 500 });
  }

  // Fetch contact to get current tags and phone
  let contact;
  try {
    contact = await getContact(contactId, apiKey);
  } catch (err) {
    console.error('[ghl-inbound-sms] getContact error:', err.message);
    return NextResponse.json({ error: 'contact fetch failed' }, { status: 500 });
  }

  const tags = contact?.tags ?? [];
  const name = [contact?.firstName, contact?.lastName].filter(Boolean).join(' ') || 'Unknown';
  const phone = contact?.phone || payload.phone || '';

  if (tags.includes('opted-out')) {
    console.log('[ghl-inbound-sms] opted-out, skipping:', contactId);
    return NextResponse.json({ ok: true, skipped: 'opted-out' });
  }

  // Check for NPS survey reply before Barry filter — clients won't have Barry tags
  if (phone) {
    try {
      const handledAsNps = await handleNpsReply(phone, inboundMessage, apiKey);
      if (handledAsNps) {
        return NextResponse.json({ ok: true, handled: 'nps-reply' });
      }
    } catch (err) {
      console.error('[ghl-inbound-sms] NPS check error:', err.message);
    }
  }

  // Check for cancellation deflection response — cancelled TheHypeBox clients replying to retention SMS
  if (phone) {
    try {
      const supabaseClient = createClient();
      const normalizedPhone = normalizePhone(phone);
      const { data: deflectionRow } = await supabaseClient
        .from('cancellation_deflection')
        .select('id, name, email, plan')
        .eq('phone', normalizedPhone)
        .eq('outcome', 'pending')
        .eq('client_responded', false)
        .maybeSingle();

      if (deflectionRow) {
        await supabaseClient
          .from('cancellation_deflection')
          .update({ client_responded: true, responded_at: new Date().toISOString() })
          .eq('id', deflectionRow.id);

        const firstName = (deflectionRow.name || 'there').split(' ')[0];
        await sendSMS(
          phone,
          `Hey ${firstName}! So glad you reached out — I'll get your account back up with a free month right now. Give me a few minutes. — Riley`,
          { apiKey, locationId: LOC_ID }
        ).catch((e) => console.error('[cancellation-deflection] reply SMS error:', e.message));

        for (const toPhone of [process.env.RILEY_PHONE, process.env.DAD_PHONE].filter(Boolean)) {
          await sendSMS(
            toPhone,
            `RETAINED? ${deflectionRow.name || deflectionRow.email} (${deflectionRow.plan}) replied to cancellation SMS: "${inboundMessage.slice(0, 100)}" — go extend their Stripe sub now.`,
            { apiKey, locationId: LOC_ID }
          ).catch(() => {});
        }

        console.log(`[cancellation-deflection] response detected from ${deflectionRow.email}`);
        return NextResponse.json({ ok: true, handled: 'cancellation-deflection' });
      }
    } catch (err) {
      console.error('[ghl-inbound-sms] deflection check error:', err.message);
    }
  }

  // Handle onboarding client replies — Barry takes over, cancel remaining sequence steps
  if (tags.includes('onboarding-client')) {
    let onboardingRaw = '';
    try {
      onboardingRaw = await callAnthropic(
        [{ role: 'user', content: inboundMessage }],
        BARRY_ONBOARDING_SYSTEM
      );
    } catch (err) {
      console.error('[ghl-inbound-sms] onboarding Anthropic error:', err.message);
      return NextResponse.json({ ok: false, error: 'AI unavailable' }, { status: 500 });
    }

    let onboardingParsed = { reply: '', opt_out: false };
    try {
      const cleaned = onboardingRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      onboardingParsed = JSON.parse(cleaned);
    } catch {
      onboardingParsed = { reply: onboardingRaw.slice(0, 160), opt_out: false };
    }

    const { reply: onboardingReply, opt_out } = onboardingParsed;

    if (opt_out) {
      if (phone) {
        await sendSMS(phone, "Got it — removed from our list. Reach us anytime at thehypeboxllc.com. — Barry", { apiKey, locationId: LOC_ID }).catch(() => {});
      }
      await addContactTags(contactId, ['opted-out'], apiKey).catch(() => {});
    } else if (onboardingReply && phone) {
      await sendSMS(phone, onboardingReply, { apiKey, locationId: LOC_ID }).catch((err) =>
        console.error('[ghl-inbound-sms] onboarding reply SMS error:', err.message)
      );
    }

    // Skip all pending onboarding steps — Barry is handling the relationship now
    if (phone) {
      const supabase = createClient();
      await supabase
        .from('onboarding_sequences')
        .update({ status: 'skipped', error_msg: 'client replied — Barry took over' })
        .eq('phone', phone)
        .eq('status', 'pending')
        .catch((err) => console.warn('[ghl-inbound-sms] onboarding DB skip error:', err.message));
    }

    await addContactNote(
      contactId,
      `💬 Barry Onboarding${opt_out ? ' — OPT OUT' : ''}\n\nClient: "${inboundMessage}"\nBarry: "${onboardingReply}"`,
      apiKey
    ).catch(() => {});

    console.log(`[ghl-inbound-sms] onboarding reply handled for ${contactId} opt_out=${opt_out}`);
    return NextResponse.json({ ok: true, handled: 'onboarding' });
  }

  // Only handle Barry outbound leads
  if (!tags.includes('sms-sent') && !tags.includes('google-maps-scraped')) {
    console.log('[ghl-inbound-sms] not a Barry lead, skipping:', contactId);
    return NextResponse.json({ ok: true, skipped: 'not-barry-lead' });
  }

  // Fetch conversation history
  let convId = conversationId;
  if (!convId) {
    try {
      const conv = await getContactConversation(LOC_ID, contactId, apiKey);
      convId = conv?.id ?? null;
    } catch (err) {
      console.warn('[ghl-inbound-sms] conversation lookup error:', err.message);
    }
  }

  let rawHistory = [];
  if (convId) {
    try {
      rawHistory = await getConversationMessages(convId, apiKey);
    } catch (err) {
      console.warn('[ghl-inbound-sms] messages fetch error:', err.message);
    }
  }

  const messages = buildClaudeMessages(rawHistory, inboundMessage);

  if (!messages.length || !messages[0].content) {
    console.error('[ghl-inbound-sms] no message content to send');
    return NextResponse.json({ ok: false, error: 'no message content' });
  }

  // Call Claude
  let raw = '';
  try {
    raw = await callAnthropic(messages);
  } catch (err) {
    console.error('[ghl-inbound-sms] Anthropic error:', err.message);
    return NextResponse.json({ ok: false, error: 'AI unavailable' }, { status: 500 });
  }

  // Parse Claude JSON response
  let parsed;
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.error('[ghl-inbound-sms] JSON parse failed, raw:', raw.slice(0, 200));
    parsed = { reply: raw.slice(0, 160), score: 'cold', alert: null };
  }

  const { reply = '', score = 'cold', alert = null } = parsed;
  console.log(`[ghl-inbound-sms] contact=${contactId} score=${score}`);

  // Handle opt-out — confirm, tag, and stop
  if (score === 'opt-out') {
    if (phone) {
      try {
        await sendSMS(phone, "Got it — you've been removed from our list. Sorry to bother! — Barry", { apiKey, locationId: LOC_ID });
      } catch (err) {
        console.error('[ghl-inbound-sms] opt-out confirmation SMS error:', err.message);
      }
    }
    await addContactTags(contactId, ['opted-out'], apiKey).catch(() => {});
    await addContactNote(contactId, `🛑 Opted out\nMessage: "${inboundMessage}"`, apiKey).catch(() => {});
    return NextResponse.json({ ok: true, score: 'opt-out' });
  }

  // Send AI reply
  if (reply && phone) {
    try {
      await sendSMS(phone, reply, { apiKey, locationId: LOC_ID });
    } catch (err) {
      console.error('[ghl-inbound-sms] reply SMS error:', err.message);
    }
  }

  // Mark contact as having responded so follow-up cron skips them
  await addContactTags(contactId, ['responded'], apiKey).catch(() => {});

  // Tag hot leads and fire alert — only alert once (first time hot-lead tag is applied)
  if (score === 'hot') {
    const alreadyHot = tags.includes('hot-lead');
    await addContactTags(contactId, ['hot-lead'], apiKey).catch(() => {});
    if (alert && !alreadyHot) {
      await sendAlerts(name, phone, alert, apiKey);
    }
  }

  // Add note with conversation snapshot
  await addContactNote(
    contactId,
    `💬 Barry AI — ${score.toUpperCase()}\n\nLead: "${inboundMessage}"\nBarry: "${reply}"`,
    apiKey
  ).catch(() => {});

  return NextResponse.json({ ok: true, score });
}

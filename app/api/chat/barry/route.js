const GHL_BASE = 'https://services.leadconnectorhq.com';

function ghlHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Version: '2021-07-28',
  };
}

function normalizePhone(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

function sanitize(str, max) {
  return String(str || '').replace(/[\n\r]/g, ' ').trim().slice(0, max);
}

async function createGHLContact({ name, phone, trade, missedCalls }) {
  const apiKey = process.env.GHL_LOCATION_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) throw new Error('GHL credentials not configured');

  const parts = sanitize(name, 100).split(' ');
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ') || undefined;

  const body = {
    locationId,
    firstName,
    lastName,
    phone: normalizePhone(phone),
    tags: ['website-chat-lead'],
    source: 'Website Chat',
  };

  const res = await fetch(`${GHL_BASE}/contacts/`, {
    method: 'POST',
    headers: ghlHeaders(apiKey),
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`GHL create contact: ${data?.message || res.status}`);
  return data?.contact?.id ?? data?.meta?.contactId;
}

async function sendSMSViaGHL(to, message) {
  const apiKey = process.env.GHL_LOCATION_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) return;

  const phone = normalizePhone(to);

  const searchRes = await fetch(`${GHL_BASE}/contacts/search`, {
    method: 'POST',
    headers: ghlHeaders(apiKey),
    body: JSON.stringify({
      locationId,
      pageLimit: 1,
      filters: [{ field: 'phone', operator: 'eq', value: phone }],
    }),
  });
  const searchData = await searchRes.json();
  let contactId = searchData?.contacts?.[0]?.id;

  if (!contactId) {
    const createRes = await fetch(`${GHL_BASE}/contacts/`, {
      method: 'POST',
      headers: ghlHeaders(apiKey),
      body: JSON.stringify({ locationId, phone }),
    });
    const createData = await createRes.json();
    contactId = createData?.contact?.id ?? createData?.meta?.contactId;
  }

  if (!contactId) return;

  await fetch(`${GHL_BASE}/conversations/messages`, {
    method: 'POST',
    headers: ghlHeaders(apiKey),
    body: JSON.stringify({ type: 'SMS', contactId, locationId, message }),
  });
}

const BARRY_SYSTEM = `You are Barry — the AI sales rep for TheHypeBox, texting with visitors from the website. You sound like a real human texting, confident and casual, NOT a formal bot.

YOUR MISSION: Qualify the visitor → find out if they're a fit → get their name and cell number.

CONVERSATION FLOW (natural, not a script):
1. Find out what trade/industry they're in (HVAC, plumbing, electrical, roofing, concrete, landscaping, etc.)
2. Ask how many calls they miss per week — this is the core pain point
3. If they run a home service business and miss calls → they're qualified
4. Once they're interested and engaged, ask for their name and cell number
5. The MOMENT you have both name AND phone number → call capture_lead immediately

TEXT STYLE — always:
- Max 2 sentences per message. Short. Punchy.
- Sound like a real person texting a prospect. Casual confidence.
- Use: "Hey", "real quick", "not gonna lie", "ngl", "yeah", "honestly"
- Never use bullet points, lists, or headers
- If hesitant → acknowledge it and flip to value

THEHYPEBOX PLANS:
- Launch Box: $97/mo — Sarah AI answers calls 24/7, missed call text-back, review requests, scheduling, CRM. 14-day free trial.
- Rocket Box: $297/mo — Everything in Launch + reactivation campaigns, advanced lead gen
- Velocity Box: $497/mo — Everything in Rocket + full CRM, accounting integration
- All plans: 14-day free trial, cancel anytime, Riley personally handles onboarding in one day
- Founders Box: custom premium setup — book a call with Riley

WHAT THEHYPEBOX ACTUALLY DOES:
- Sarah AI answers every inbound call 24/7 and books appointments — even at 2am
- Missed call? System auto-texts them back in under 60 seconds
- After jobs close, automatically texts happy customers asking for a Google review
- Unified inbox: SMS, email, Facebook DMs all in one place
- AI-powered follow-up that runs itself — zero work from the owner

WHEN THEY'RE READY: Tell them to start free at thehypeboxllc.com or book a call with Riley there.

WHEN YOU HAVE NAME AND PHONE: Call capture_lead IMMEDIATELY. Do not wait.`;

const CAPTURE_LEAD_TOOL = {
  name: 'capture_lead',
  description: "Save the lead in the CRM and alert the sales team. Only call this when you have BOTH the visitor's name AND phone number AND they've shown genuine interest.",
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Full name of the lead' },
      phone: { type: 'string', description: 'Phone number of the lead' },
      trade: { type: 'string', description: 'Their trade or industry' },
      missed_calls: { type: 'string', description: 'How many calls they miss per week' },
    },
    required: ['name', 'phone'],
  },
};

export async function POST(request) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return Response.json({ error: 'Chat not configured' }, { status: 503 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { message, history = [] } = body;
  if (!message?.trim()) return Response.json({ error: 'message required' }, { status: 400 });
  if (message.length > 1000) return Response.json({ error: 'Message too long' }, { status: 400 });

  const sanitizedHistory = history
    .filter(({ role }) => role === 'user' || role === 'assistant')
    .slice(-12)
    .map(({ role, content }) => ({
      role,
      content: typeof content === 'string' ? content.slice(0, 400) : JSON.stringify(content).slice(0, 400),
    }));

  let messages = [...sanitizedHistory, { role: 'user', content: message.trim() }];
  let leadCaptured = false;

  for (let i = 0; i < 2; i++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        system: BARRY_SYSTEM,
        tools: [CAPTURE_LEAD_TOOL],
        messages,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[barry] Anthropic error:', data?.error?.type);
      return Response.json({ error: 'AI unavailable' }, { status: 502 });
    }

    if (data.stop_reason === 'end_turn') {
      const reply = data.content?.find((b) => b.type === 'text')?.text
        ?? "Hey something glitched on my end — try sending that again!";
      return Response.json({ reply, ...(leadCaptured ? { leadCaptured: true } : {}) });
    }

    if (data.stop_reason === 'tool_use') {
      const toolBlock = data.content.find((b) => b.type === 'tool_use' && b.name === 'capture_lead');
      if (toolBlock) {
        const { name, phone, trade, missed_calls: missedCalls } = toolBlock.input;

        try {
          await createGHLContact({
            name: sanitize(name, 100),
            phone,
            trade: sanitize(trade, 100),
            missedCalls: sanitize(missedCalls, 50),
          });
          leadCaptured = true;
        } catch (err) {
          console.error('[barry] GHL contact failed:', err.message);
          leadCaptured = true; // still mark captured — alerts still fire
        }

        // Alert Riley + Dad (fire and forget)
        const alertMsg = `🔥 NEW WEBSITE CHAT LEAD\nName: ${sanitize(name, 80)}\nPhone: ${sanitize(phone, 20)}${trade ? `\nTrade: ${sanitize(trade, 60)}` : ''}${missedCalls ? `\nMisses: ${sanitize(missedCalls, 40)} calls/wk` : ''}\nSource: TheHypeBox website chat`;
        const rileyPhone = process.env.RILEY_PHONE;
        const dadPhone = process.env.DAD_PHONE;

        const alertTargets = [rileyPhone, dadPhone].filter(Boolean);
        const alertPromises = alertTargets.map((p) =>
          sendSMSViaGHL(p, alertMsg).catch((e) => console.error('[barry] alert SMS failed:', e.message))
        );

        // Barry follow-up SMS to the lead
        const firstName = sanitize(name, 50).split(' ')[0];
        const followUpMsg = `Hey ${firstName}! It's Barry from TheHypeBox — just saw you were checking us out. I'd love to show you how we're helping ${trade || 'home service businesses'} stop losing jobs to missed calls. Got 10 minutes this week?`;
        const followUpPromise = sendSMSViaGHL(phone, followUpMsg)
          .catch((e) => console.error('[barry] follow-up SMS failed:', e.message));

        await Promise.allSettled([...alertPromises, followUpPromise]);

        messages = [...messages, { role: 'assistant', content: data.content }];
        messages = [
          ...messages,
          {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: toolBlock.id, content: 'Lead saved. Team alerted. SMS sent.' }],
          },
        ];
        continue;
      }
    }

    break;
  }

  return Response.json({ reply: "Yeah I'm here! Something glitched — try that again.", ...(leadCaptured ? { leadCaptured: true } : {}) });
}

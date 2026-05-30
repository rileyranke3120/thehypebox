import { auth } from '@/auth';

// Runs in Node.js runtime — auth() requires it (edge runtime can't load bcryptjs)
const GHL_BASE = 'https://services.leadconnectorhq.com';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const RPC_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

// ── Per-minute rate limit (20 req/min per IP) — atomic via stored procedure ──
async function checkChatRateLimit(ip) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false; // fail closed if not configured
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_and_increment_chat_rate_limit`, {
      method: 'POST',
      headers: RPC_HEADERS,
      body: JSON.stringify({ p_ip: ip, p_max: 20, p_window_seconds: 60 }),
    });
    return res.ok ? await res.json() : false; // fail closed if RPC unavailable
  } catch {
    return false;
  }
}

// ── Per-day rate limit (200 req/day per IP) — atomic via stored procedure ────
async function checkDailyLimit(ip) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false; // fail closed if not configured
  try {
    const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_and_increment_chat_daily_limit`, {
      method: 'POST',
      headers: RPC_HEADERS,
      body: JSON.stringify({ p_ip: ip, p_day: day, p_max: 200 }),
    });
    return res.ok ? await res.json() : false; // fail closed if RPC unavailable
  } catch {
    return false;
  }
}

function ghlHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    Version: '2021-07-28',
    'Content-Type': 'application/json',
  };
}

async function ghlFetch(path, apiKey, options = {}) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    ...options,
    headers: { ...ghlHeaders(apiKey), ...(options.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`GHL ${res.status}: ${data?.message || path}`);
  return data;
}

// Look up client by session email and verify the requested locationId matches their account.
// Returns the client record on success, null on mismatch or error.
async function lookupClientForSession(email, requestedLocationId) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=name,business_name,ghl_api_key,ghl_location_id,google_review_url&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (!res.ok) return null;
    const [user] = await res.json();
    if (!user?.ghl_location_id) return null;
    if (user.ghl_location_id !== requestedLocationId) return null;
    return user;
  } catch {
    return null;
  }
}

const MARKETING_SYSTEM = `You are TheHypeBot, a confident sales assistant for TheHypeBox — AI automation built for local home service businesses (HVAC, plumbing, roofing, electrical, landscaping, etc.).

HARD RULES — never break these:
1. Max 2 sentences per response. Never more.
2. No bullet points, no lists, no headers, ever.
3. Every response ends by pushing toward the free trial or booking a call.

WHAT THEHYPEBOX DOES:
- AI receptionist that answers every call 24/7, qualifies leads, and books appointments automatically
- Instant lead follow-up via SMS and email (responds in under 60 seconds)
- Automated appointment reminders sent to customers before their scheduled time
- Review request automation — texts happy customers asking for a Google review after the job
- Unified inbox for SMS, email, and social DMs in one place
- CRM with full contact management, deal pipeline tracking, notes, tags, and activity history
- Self-serve booking page so customers can schedule without calling
- Missed call text-back — if you miss a call, the system texts them immediately
- AI-powered responses trained on your business for hands-free lead handling

PLANS & PRICING:
- Launch Box: $97/mo — AI receptionist, missed call text-back, review requests, scheduling, contacts, pipeline, call log, billing
- Rocket Box: $297/mo — Everything in Launch + reactivation campaigns, lead gen tools
- Velocity Box: $497/mo — Everything in Rocket + full CRM, accounting integration
- All plans: 14-day free trial, cancel anytime
- Setup takes one day, Riley handles onboarding personally

TRIAL & SIGNUP:
- Start at thehypeboxllc.com — click any "Start Free Trial" button
- 14 days free, then monthly billing starts, cancel anytime
- Book a call with Riley at thehypeboxllc.com if they want a walkthrough first`;


function sanitize(str, maxLen) {
  return String(str || '').replace(/[\n\r]/g, ' ').replace(/\{\{|\}\}|\[|\]/g, '').trim().slice(0, maxLen);
}

function buildSystemPrompt(client) {
  if (!client) return MARKETING_SYSTEM;

  const hasGHL = !!(client.ghl_api_key && client.ghl_location_id);
  const biz = sanitize(client.business_name || 'your business', 100);
  const owner = sanitize(client.name ? client.name.split(' ')[0] : 'there', 50);

  return `You are TheHypeBox Assistant — a sharp AI helper built into the ${biz} dashboard.

Every response must be 3 sentences or fewer. Be direct and conversational, no bullet points or lists, lead with the most useful thing first.

${hasGHL ? 'You have live tools — use them. When asked for data or to take action, do it, don\'t just describe it.\n' : ''}You can pull contacts, open leads, and upcoming appointments${hasGHL ? '' : ' (connect your CRM to enable this)'}. For anything outside those tools, point ${owner} to the relevant dashboard section.`;
}

function buildTools(client) {
  if (!client?.ghl_api_key) return [];
  const biz = sanitize(client.business_name || 'your business', 100);

  return [
    {
      name: 'search_contacts',
      description: `Search CRM contacts for ${biz} by name or phone number`,
      input_schema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Name or phone number to search' } },
        required: ['query'],
      },
    },
    {
      name: 'get_open_leads',
      description: `Get all open leads in the pipeline for ${biz} with names, values, and stages`,
      input_schema: { type: 'object', properties: {} },
    },
    {
      name: 'get_upcoming_appointments',
      description: `Get upcoming appointments for ${biz} in the next 7 days`,
      input_schema: { type: 'object', properties: {} },
    },
  ];
}

async function executeTool(name, input, client) {
  const { ghl_api_key: apiKey, ghl_location_id: locationId } = client;

  if (name === 'search_contacts') {
    const data = await ghlFetch(
      `/contacts/?locationId=${locationId}&query=${encodeURIComponent(input.query)}&limit=10`,
      apiKey
    );
    const contacts = data?.contacts ?? [];
    if (!contacts.length) return 'No contacts found matching that search.';
    return contacts
      .map((c) => `${c.firstName || ''} ${c.lastName || ''} | ${c.phone || 'no phone'} | ${c.email || 'no email'}`.trim())
      .join('\n');
  }

  if (name === 'get_open_leads') {
    const data = await ghlFetch(
      `/opportunities/search?location_id=${locationId}&status=open&limit=20`,
      apiKey
    );
    const opps = data?.opportunities ?? [];
    if (!opps.length) return 'No open leads in the pipeline right now.';
    const total = opps.reduce((sum, o) => sum + (o.monetaryValue || 0), 0);
    const lines = opps.map(
      (o) => `- ${o.name || o.contact?.name || 'Unknown'}: $${(o.monetaryValue || 0).toLocaleString()} (${o.stage?.name || 'no stage'})`
    );
    return `${opps.length} open leads, $${total.toLocaleString()} total pipeline:\n${lines.join('\n')}`;
  }

  if (name === 'get_upcoming_appointments') {
    const now = Date.now();
    const weekOut = now + 7 * 24 * 60 * 60 * 1000;
    const data = await ghlFetch(
      `/calendars/events?locationId=${locationId}&startTime=${now}&endTime=${weekOut}`,
      apiKey
    );
    const events = data?.events ?? [];
    if (!events.length) return 'No appointments in the next 7 days.';
    return events
      .map((e) => {
        const d = new Date(e.startTime || e.start);
        const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        return `- ${e.title || 'Appointment'} — ${dateStr} at ${timeStr}`;
      })
      .join('\n');
  }

  return 'Unknown tool.';
}

export async function POST(request) {
  const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown';
  if (!(await checkChatRateLimit(ip))) {
    return Response.json({ error: 'Too many requests — slow down.' }, { status: 429 });
  }
  if (!(await checkDailyLimit(ip))) {
    return Response.json({ error: 'Daily message limit reached. Try again tomorrow.' }, { status: 429 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return Response.json({ error: 'Chat not configured' }, { status: 503 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { message, history = [], clientId = 'default' } = body;
  if (!message?.trim()) return Response.json({ error: 'message is required' }, { status: 400 });
  if (message.length > 2000) return Response.json({ error: 'Message too long.' }, { status: 400 });

  // Sanitize history: reject invalid roles, always convert content to a capped string.
  // Non-string content (e.g. tool_use arrays) is serialised to prevent prompt injection
  // via injected tool_use/tool_result blocks in client-supplied history.
  const sanitizedHistory = history
    .filter(({ role }) => role === 'user' || role === 'assistant')
    .slice(-10)
    .map(({ role, content }) => ({
      role,
      content: typeof content === 'string'
        ? content.slice(0, 500)
        : JSON.stringify(content).slice(0, 500),
    }));

  // Non-public clientIds require an authenticated session scoped to that location.
  // Public (marketing/default) mode: no auth needed, no GHL tools available.
  const isPublicClient = !clientId || clientId === 'default' || clientId === 'marketing';
  let client = null;

  if (!isPublicClient) {
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    client = await lookupClientForSession(session.user.email, clientId);
    if (!client) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const systemPrompt = buildSystemPrompt(client);
  const tools = buildTools(client);

  let messages = [
    ...sanitizedHistory,
    { role: 'user', content: message.trim() },
  ];

  for (let i = 0; i < 2; i++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        system: systemPrompt,
        tools: tools.length ? tools : undefined,
        messages,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[chat] Anthropic error:', data?.error?.type);
      return Response.json({ error: 'AI unavailable' }, { status: 502 });
    }

    if (data.stop_reason === 'end_turn') {
      const reply = data.content?.find((b) => b.type === 'text')?.text ?? "Sorry, I couldn't process that. Try again?";
      return Response.json({ reply });
    }

    if (data.stop_reason === 'tool_use' && client?.ghl_api_key) {
      messages = [...messages, { role: 'assistant', content: data.content }];

      const toolResults = await Promise.all(
        data.content
          .filter((b) => b.type === 'tool_use')
          .map(async (block) => {
            let content;
            try {
              content = await executeTool(block.name, block.input, client);
            } catch (err) {
              console.error(`[chat] tool error [${block.name}]:`, err.message);
              content = 'Tool call failed. Please try again.';
            }
            return { type: 'tool_result', tool_use_id: block.id, content };
          })
      );

      messages = [...messages, { role: 'user', content: toolResults }];
      continue;
    }

    break;
  }

  return Response.json({ reply: "Sorry, I had trouble with that. Try again?" });
}

export const runtime = 'edge';

// IP-based rate limit: 20 requests per minute per IP (per edge worker instance)
const ipHits = new Map();
function checkChatRateLimit(ip) {
  const now = Date.now();
  const window = 60_000;
  const max = 20;
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < window);
  if (hits.length >= max) return false;
  hits.push(now);
  ipHits.set(ip, hits);
  return true;
}

const GHL_BASE = 'https://services.leadconnectorhq.com';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

// Look up client from Supabase by ghl_location_id
async function lookupClient(clientId) {
  if (!clientId || clientId === 'marketing' || clientId === 'default') return null;
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/users?ghl_location_id=eq.${encodeURIComponent(clientId)}&select=name,business_name,ghl_api_key,ghl_location_id,google_review_url&limit=1`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  if (!res.ok) return null;
  const [user] = await res.json();
  return user || null;
}

const MARKETING_SYSTEM = `You are TheHypeBot, a sales assistant for TheHypeBox — AI automation for home service businesses.

HARD RULES — never break these:
1. Max 2 sentences per response. Never more.
2. No bullet points, no lists, no headers, ever.
3. Every response ends by pushing toward the free trial or booking a call.

TheHypeBox answers every call 24/7, auto-follows up with leads, books appointments, and requests reviews. Plans from $97/mo, 14-day free trial, no credit card. Trial at thehypeboxllc.com.`;

function buildSystemPrompt(client) {
  if (!client) return MARKETING_SYSTEM;

  const hasGHL = !!(client.ghl_api_key && client.ghl_location_id);
  const biz = client.business_name || 'your business';
  const owner = client.name ? client.name.split(' ')[0] : 'there';

  return `You are TheHypeBox Assistant — a sharp AI helper built into the ${biz} dashboard.

Every response must be 3 sentences or fewer. Be direct and conversational, no bullet points or lists, lead with the most useful thing first.

${hasGHL ? 'You have live tools — use them. When asked for data or to take action, do it, don\'t just describe it.\n' : ''}You can pull contacts, open leads, and upcoming appointments${hasGHL ? '' : ' (connect your CRM to enable this)'}. You can also send review request texts to customers. For anything outside those tools, point ${owner} to the relevant dashboard section.`;
}

function buildTools(client) {
  if (!client?.ghl_api_key) return [];
  const biz = client.business_name || 'your business';

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
    {
      name: 'send_review_request',
      description: 'Send a review request SMS to a customer. Use search_contacts first to confirm the phone number.',
      input_schema: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: "Customer's phone number" },
          name: { type: 'string', description: "Customer's first name" },
        },
        required: ['phone', 'name'],
      },
    },
  ];
}

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

async function executeTool(name, input, client) {
  const { ghl_api_key: apiKey, ghl_location_id: locationId, business_name, google_review_url } = client;

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

  if (name === 'send_review_request') {
    const phone = normalizePhone(input.phone);

    const searchRes = await fetch(`${GHL_BASE}/contacts/search`, {
      method: 'POST',
      headers: ghlHeaders(apiKey),
      body: JSON.stringify({
        locationId,
        pageLimit: 1,
        filters: [{ field: 'phone', operator: 'eq', value: phone }],
      }),
    });
    let contactId;
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      contactId = searchData?.contacts?.[0]?.id;
    }
    if (!contactId) {
      const createData = await ghlFetch('/contacts/', apiKey, {
        method: 'POST',
        body: JSON.stringify({ locationId, phone, firstName: input.name }),
      });
      contactId = createData?.contact?.id ?? createData?.meta?.contactId;
    }
    if (!contactId) throw new Error('Could not find or create contact');

    const reviewLink = google_review_url ? ` Leave us a review here: ${google_review_url}` : '';
    const message = `Hi ${input.name}! Thanks for choosing ${business_name || 'us'} — we really appreciate your business! Could you take a minute to leave us a Google review? It means the world to us! ⭐${reviewLink}`;

    await fetch(`${GHL_BASE}/conversations/messages`, {
      method: 'POST',
      headers: ghlHeaders(apiKey),
      body: JSON.stringify({ type: 'SMS', contactId, locationId, message }),
    });

    return `Review request sent to ${input.name} at ${phone}.`;
  }

  return 'Unknown tool.';
}

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkChatRateLimit(ip)) {
    return Response.json({ error: 'Too many requests — slow down.' }, { status: 429 });
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

  const client = await lookupClient(clientId);
  const systemPrompt = buildSystemPrompt(client);
  const tools = buildTools(client);

  let messages = [
    ...history.slice(-10).map(({ role, content }) => ({ role, content })),
    { role: 'user', content: message.trim() },
  ];

  for (let i = 0; i < 5; i++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: systemPrompt,
        tools: tools.length ? tools : undefined,
        messages,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[chat] Anthropic error:', JSON.stringify(data));
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
              content = `Error: ${err.message}`;
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

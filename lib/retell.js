// Retell AI provisioning — creates a new agent + LLM for a client.
// Only call for Rocket/Velocity Box plans (includes AI Phone Receptionist).
// Requires RETELL_API_KEY in env vars.

const RETELL_BASE = 'https://api.retellai.com';

function retellHeaders() {
  return {
    Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function retellFetch(path, method = 'GET', body = null) {
  const options = { method, headers: retellHeaders() };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${RETELL_BASE}${path}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(`Retell ${res.status} on ${path}: ${JSON.stringify(data)}`);
  return data;
}

function sanitizePromptField(str, maxLen) {
  return String(str || '').replace(/[\n\r]/g, ' ').replace(/\{\{|\}\}|\[|\]/g, '').trim().slice(0, maxLen);
}

function buildPrompt({ businessName, ownerName, services, location, calendarOwner, calendarId }) {
  const safeName = sanitizePromptField(businessName, 100);
  const safeOwnerRaw = ownerName ? sanitizePromptField(ownerName, 100) : null;
  const owner = safeOwnerRaw ? safeOwnerRaw.split(' ')[0] : 'our team';
  const serviceList = sanitizePromptField(services || 'home services', 200);
  const area = sanitizePromptField(location || 'the local area', 100);
  const calName = calendarOwner ? sanitizePromptField(calendarOwner, 100) : owner;

  // calendarId baked into the prompt so Retell can verify it matches the injected dynamic variable at call-start.
  const calendarNote = calendarId ? `\n[SYSTEM: This agent is configured for calendar ${calendarId}. At call start, {{ghl_calendar_id}} will be injected to confirm the active calendar.]` : '';

  return `You are a friendly AI receptionist for ${safeName}, a ${serviceList} company serving ${area}. Speak with natural warmth and excitement. Vary your tone and pace. Sound like a real, enthusiastic person — never flat or monotone. Always speak in a consistent American Midwest accent.${calendarNote}

Today's date is {{today_date}}. Use this to resolve any relative date the caller gives you — "this Thursday", "tomorrow", "next week".

{{#if is_after_hours}}
You are answering after business hours. Let the caller know you can still get them booked in — say something like "We're closed right now, but I can still get you on the calendar for when we're back. Want me to grab you a spot?" and proceed to book them.
{{/if}}

CRITICAL RULE: Never confirm or repeat back information more than once. When you have a date and time, call book_appointment immediately without asking for confirmation first.

CRITICAL: Once book_appointment returns a successful result, the call is complete. Say a warm one-sentence confirmation and end the call naturally.

Your job is to:
1. Answer incoming calls professionally
2. Understand what the caller needs
3. Schedule a free estimate or consultation directly on the calendar
4. Capture their name, phone number, address, and best time

Key info about ${safeName}:
- Service area: ${area}
- Services: ${serviceList}
- They offer FREE estimates — no obligation

Tone: Warm, helpful, and confident. Never pushy. Sound like a real person, not a robot.

When someone calls:
- Greet them: "Thanks for calling ${safeName}, this is Sarah, how can I help you today?"
- Find out what they need
- Let them know estimates are completely free
- Offer to book them directly: "Our schedule is pretty busy right now — want me to grab you a spot for a free estimate?"
- Collect: full name, address, phone, preferred date/time
- Once you have their info, book immediately — do not ask for confirmation first
- After the appointment is successfully created, give one clean confirmation and move on

When asking for a date or time:
- Accept whatever format the caller gives you naturally
- Never ask them to use a specific format
- Resolve the date yourself using today's date before calling any tool
- If they give a vague time like "morning" or "afternoon", call check_availability for that date and offer the first 2–3 available slots

If they ask about pricing:
- "Pricing depends on the scope of the job — that's exactly why the estimate is free, so we can give you an accurate number in person."

If they want to speak to someone directly:
- "Our team is usually out on jobs during the day — I can have someone reach out to you, or I can get you on the estimate calendar right now. Which works better for you?"

Important behavioral rules:
- Always sound warm, empathetic, and patient
- Never interrupt the caller
- Use filler words occasionally like "absolutely", "of course", "great question"
- If the caller pauses, wait for them — never rush them

For anything requiring a detailed answer — warranty details, specific pricing, company history:
- "That's a great question for ${owner} when they come out — they can walk you through all of that in person."

Never say you don't know. Always redirect to the in-person estimate.

Once book_appointment returns a success, immediately confirm the appointment and end the call naturally. Do not apologize or retry.`;
}

function buildTools(apiKey) {
  const toolSecret = process.env.RETELL_TOOL_SECRET;
  if (!toolSecret) throw new Error('RETELL_TOOL_SECRET must be set before creating Retell agents');
  const sharedHeaders = { 'x-api-key': toolSecret };

  return [
    {
      name: 'end_call',
      description: 'End the call when user has to leave (like says bye) or you are instructed to do so.',
      type: 'end_call',
      speak_after_execution: true,
    },
    {
      name: 'check_availability',
      description: 'Checks available appointment slots on the calendar for a given date',
      type: 'custom',
      method: 'POST',
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/retell/check-availability`,
      headers: sharedHeaders,
      parameter_type: 'json',
      args_at_root: false,
      timeout_ms: 120000,
      speak_during_execution: true,
      speak_after_execution: true,
      execution_message_type: 'prompt',
      enable_typing_sound: false,
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: "The date the caller requested, exactly as they said it — e.g. 'this Thursday', 'April 24th'. Never convert or reformat; pass the raw string.",
          },
        },
        required: ['date'],
      },
    },
    {
      name: 'book_appointment',
      description: 'Books a free estimate appointment with the caller information',
      type: 'custom',
      method: 'POST',
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/retell/book-appointment`,
      headers: sharedHeaders,
      parameter_type: 'json',
      args_at_root: false,
      timeout_ms: 120000,
      speak_during_execution: true,
      speak_after_execution: true,
      execution_message_type: 'prompt',
      enable_typing_sound: false,
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Full name of the caller' },
          date: { type: 'string', description: "Appointment date exactly as the caller said it. Never convert or reformat." },
          address: { type: 'string', description: 'Property address where the estimate will take place' },
          time: { type: 'string', description: "Appointment time exactly as the caller said it. Never convert or reformat." },
          phone: { type: 'string', description: "Caller's phone number" },
          email: { type: 'string', description: "Caller's email address if provided" },
        },
        required: ['name', 'phone', 'address', 'date', 'time'],
      },
    },
  ];
}

/**
 * Create a Retell agent for a new client.
 * Returns { agentId, llmId }.
 *
 * @param {object} opts
 * @param {string} opts.businessName
 * @param {string} [opts.ownerName]
 * @param {string} [opts.services]   - e.g. "concrete floor coatings"
 * @param {string} [opts.location]   - e.g. "Columbus, Ohio"
 * @param {string} [opts.ghlApiKey]  - client's GHL PIT key (for tool auth header)
 */
export async function createRetellAgent({ businessName, ownerName, services, location, ghlApiKey, calendarId }) {
  if (!process.env.RETELL_API_KEY) {
    throw new Error('Missing RETELL_API_KEY');
  }

  const prompt = buildPrompt({ businessName, ownerName, services, location, calendarId });
  const tools = buildTools(ghlApiKey);

  // Step 1: Create the LLM
  const llm = await retellFetch('/create-retell-llm', 'POST', {
    model: 'claude-haiku-4-5',
    general_prompt: prompt,
    general_tools: tools,
    begin_message: `Hello, thanks for calling ${businessName}! This is Sarah, how can I help you today?`,
  });

  const llmId = llm.llm_id;
  if (!llmId) throw new Error(`Retell LLM creation returned no ID: ${JSON.stringify(llm)}`);

  // Step 2: Create the agent
  const agent = await retellFetch('/create-agent', 'POST', {
    agent_name: `${businessName} - Inbound`,
    response_engine: { type: 'retell-llm', llm_id: llmId },
    voice_id: '11labs-Anna',
    voice_temperature: 1.2,
    voice_speed: 0.9,
    language: 'en-US',
    webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/retell/call-start`,
    end_call_after_silence_ms: 20000,
    interruption_sensitivity: 0.82,
    responsiveness: 0.93,
    data_storage_setting: 'everything',
    post_call_analysis_data: [
      { type: 'system-presets', name: 'call_summary', description: 'Write a 1-3 sentence summary of the call.' },
      { type: 'system-presets', name: 'call_successful', description: 'Evaluate whether the agent had a successful call.' },
      { type: 'system-presets', name: 'user_sentiment', description: "Evaluate user's sentiment and satisfaction." },
    ],
  });

  const agentId = agent.agent_id;
  if (!agentId) throw new Error(`Retell agent creation returned no ID: ${JSON.stringify(agent)}`);

  return { agentId, llmId };
}

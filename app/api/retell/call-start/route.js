/**
 * POST /api/retell/call-start
 *
 * Retell calls this at the start of every call (dynamic variables webhook).
 * Looks up the client by agent_id and injects per-client + time-based variables
 * into the agent's prompt via Retell's dynamic variable injection.
 *
 * Configure in Retell: Agent → Dynamic Variables → Webhook URL →
 *   https://thehypeboxllc.com/api/retell/call-start
 */
import { createClient } from '@/lib/supabase';
import { safeCompare } from '@/lib/safe-compare';

async function lookupClientByAgentId(agentId) {
  if (!agentId) return null;
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('users')
      .select('business_name, ghl_calendar_id, ghl_location_id')
      .eq('retell_agent_id', agentId)
      .single();
    return data || null;
  } catch {
    return null;
  }
}

export async function POST(request) {
  const secret = process.env.RETELL_TOOL_SECRET;
  const provided = request.headers.get('x-api-key');
  if (!secret || !safeCompare(provided ?? '', secret)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    // Body may be empty — still return variables
  }

  // ── Per-client lookup ───────────────────────────────────────────────────────
  const agentId = body.agent_id ?? null;
  const THEHYPEBOX_AGENT_ID = process.env.THEHYPEBOX_RETELL_AGENT_ID;

  let client;
  if (THEHYPEBOX_AGENT_ID && agentId === THEHYPEBOX_AGENT_ID) {
    // TheHypeBox's own Sarah — inject platform-level calendar vars
    client = { business_name: 'The HypeBox', ghl_calendar_id: 'Ws5pQCTkYNNeqtSwGII4' };
  } else {
    client = await lookupClientByAgentId(agentId);
    if (!client) {
      console.warn(`[call-start] no client found for agent_id=${agentId} — per-client vars will be empty`);
    }
  }

  // ── Time variables (Eastern) ────────────────────────────────────────────────
  const now = new Date();
  const etOptions = { timeZone: 'America/New_York' };

  const today = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    ...etOptions,
  });

  const todayIso = now.toLocaleDateString('en-CA', etOptions); // YYYY-MM-DD

  const currentTimeEt = now.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    ...etOptions,
  });

  // Business hours: Mon–Fri 8am–5pm ET
  const hourEt = parseInt(now.toLocaleString('en-US', { hour: 'numeric', hour12: false, ...etOptions }));
  const dayName = now.toLocaleDateString('en-US', { weekday: 'short', ...etOptions });
  const isWeekday = !['Sat', 'Sun'].includes(dayName);
  const isBusinessHours = isWeekday && hourEt >= 8 && hourEt < 17;
  const isAfterHours = !isBusinessHours;

  // ── Build dynamic variables ─────────────────────────────────────────────────
  const dynamicVariables = {
    today_date:     today,
    today_date_iso: todayIso,
    current_time:   currentTimeEt,
    is_after_hours: isAfterHours ? 'true' : 'false',
    business_hours: 'Monday through Friday, 8 AM to 5 PM Eastern',
    // Per-client — injected only when client record found
    ghl_calendar_id: client?.ghl_calendar_id ?? '',
    business_name:   client?.business_name   ?? '',
  };

  return Response.json({ dynamic_variables: dynamicVariables });
}

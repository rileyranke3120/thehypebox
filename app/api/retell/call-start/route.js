/**
 * POST /api/retell/call-start
 *
 * Retell calls this webhook at the start of every call.
 * We return dynamic variables so the agent (Sarah) knows the current date
 * without having to ask the caller.
 *
 * Configure in Retell: Agent → Dynamic Variables → Webhook URL →
 *   https://<your-domain>/api/retell/call-start
 *
 * Retell response format: { dynamic_variables: { key: value, ... } }
 */
export async function POST(request) {
  // Log the incoming payload for debugging
  let body = {};
  try {
    body = await request.json();
  } catch {
    // Body may be empty or non-JSON — that's fine, we still return variables
  }

  console.log('[call-start] incoming payload:', JSON.stringify(body));

  // Format today's date in Eastern time as a human-readable string
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  });

  // Also provide ISO format for tool calls (check_availability expects YYYY-MM-DD)
  const todayIso = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/New_York',
  }); // en-CA locale produces YYYY-MM-DD

  const dynamicVariables = {
    today_date: today,       // e.g. "Thursday, April 24, 2026" — for natural speech
    today_date_iso: todayIso, // e.g. "2026-04-24" — for tool calls
  };

  console.log('[call-start] injecting dynamic variables:', JSON.stringify(dynamicVariables));

  return Response.json({ dynamic_variables: dynamicVariables });
}

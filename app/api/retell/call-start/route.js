/**
 * POST /api/retell/call-start
 *
 * Retell calls this at the start of every call.
 * Injects dynamic variables: today's date, current time, and after-hours flag.
 *
 * Configure in Retell: Agent → Dynamic Variables → Webhook URL →
 *   https://thehypeboxllc.com/api/retell/call-start
 */
export async function POST(request) {
  const secret = process.env.RETELL_TOOL_SECRET;
  if (secret) {
    const { searchParams } = new URL(request.url);
    const provided = searchParams.get('secret') || request.headers.get('x-api-key');
    if (provided !== secret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    // Body may be empty — still return variables
  }

  console.log('[call-start] incoming payload:', JSON.stringify(body));

  const now = new Date();

  // All times in Eastern
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
  const dayEt = parseInt(now.toLocaleString('en-US', { weekday: 'narrow', ...etOptions }) === 'S'
    ? now.toLocaleDateString('en-US', { weekday: 'short', ...etOptions }) === 'Sat' ? '6' : '0'
    : (['Mon','Tue','Wed','Thu','Fri'].indexOf(now.toLocaleDateString('en-US', { weekday: 'short', ...etOptions })) + 1).toString()
  );

  // Simpler: get day of week in ET
  const dayName = now.toLocaleDateString('en-US', { weekday: 'short', ...etOptions });
  const isWeekday = !['Sat', 'Sun'].includes(dayName);
  const isBusinessHours = isWeekday && hourEt >= 8 && hourEt < 17;
  const isAfterHours = !isBusinessHours;

  const dynamicVariables = {
    today_date: today,
    today_date_iso: todayIso,
    current_time: currentTimeEt,
    is_after_hours: isAfterHours ? 'true' : 'false',
    business_hours: 'Monday through Friday, 8 AM to 5 PM Eastern',
  };

  console.log('[call-start] injecting dynamic variables:', JSON.stringify(dynamicVariables));

  return Response.json({ dynamic_variables: dynamicVariables });
}

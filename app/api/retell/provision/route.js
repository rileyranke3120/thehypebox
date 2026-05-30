import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { createRetellAgent } from '@/lib/retell';
import { fetchLocationCalendarId } from '@/lib/highlevel';

export async function POST(request) {
  const session = await auth();
  if (!session || session.user?.role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { client_id, business_name, owner_name, services, location, ghl_api_key } =
      await request.json();

    if (!client_id || !business_name) {
      return NextResponse.json(
        { success: false, error: 'client_id and business_name are required' },
        { status: 400 }
      );
    }

    // Fetch the client's existing GHL location so we can get its calendar ID
    const supabase = createClient();
    const { data: user } = await supabase
      .from('users')
      .select('ghl_location_id, ghl_calendar_id')
      .eq('id', client_id)
      .single();

    // Fetch calendar ID from GHL if not already saved
    let calendarId = user?.ghl_calendar_id ?? null;
    if (!calendarId && user?.ghl_location_id) {
      calendarId = await fetchLocationCalendarId(user.ghl_location_id);
      console.log(`[retell/provision] fetched calendar ${calendarId} for location ${user.ghl_location_id}`);
    }

    const { agentId, llmId } = await createRetellAgent({
      businessName: business_name,
      ownerName: owner_name,
      services,
      location,
      ghlApiKey: ghl_api_key,
      calendarId,
    });

    const dbUpdate = { retell_agent_id: agentId };
    if (calendarId) dbUpdate.ghl_calendar_id = calendarId;

    const { error: dbError } = await supabase
      .from('users')
      .update(dbUpdate)
      .eq('id', client_id);

    if (dbError) throw new Error(dbError.message);

    return NextResponse.json({ success: true, agent_id: agentId, llm_id: llmId, calendar_id: calendarId });
  } catch (error) {
    console.error('[retell/provision]', error);
    return NextResponse.json({ success: false, error: 'Something went wrong.' }, { status: 500 });
  }
}

import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { createRetellAgent } from '@/lib/retell';

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

    const { agentId, llmId } = await createRetellAgent({
      businessName: business_name,
      ownerName: owner_name,
      services,
      location,
      ghlApiKey: ghl_api_key,
    });

    const supabase = createClient();
    const { error: dbError } = await supabase
      .from('users')
      .update({ retell_agent_id: agentId })
      .eq('id', client_id);

    if (dbError) throw new Error(dbError.message);

    return NextResponse.json({ success: true, agent_id: agentId, llm_id: llmId });
  } catch (error) {
    console.error('[retell/provision]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

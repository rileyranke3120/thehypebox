import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

const RETELL_BASE = 'https://api.retellai.com/v2';

function retellHeaders() {
  return {
    Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

export async function POST(request) {
  try {
    const { client_id, business_name, business_phone, business_hours, industry, goal } =
      await request.json();

    if (!client_id || !business_name) {
      return NextResponse.json(
        { success: false, error: 'client_id and business_name are required' },
        { status: 400 }
      );
    }

    // Create Retell agent
    const retellRes = await fetch(`${RETELL_BASE}/create-agent`, {
      method: 'POST',
      headers: retellHeaders(),
      body: JSON.stringify({
        agent_name: `${business_name} AI Agent`,
        voice_id: '11labs-Adrian',
        language: 'en-US',
        response_engine: {
          type: 'retell-llm',
          llm_id: '', // TODO: set when client agent provisioning is configured
        },
        begin_message: `Hi! Thanks for calling ${business_name}. How can I help you today?`,
      }),
    });

    const agent = await retellRes.json();

    if (!retellRes.ok) {
      throw new Error(agent.message || `Retell error: ${retellRes.status}`);
    }

    const agent_id = agent.agent_id;
    const phone_number = agent.phone_number || null;

    // Save agent_id and phone_number to users table
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from('users')
      .update({ retell_agent_id: agent_id, retell_phone_number: phone_number })
      .eq('id', client_id);

    if (dbError) throw new Error(dbError.message);

    return NextResponse.json({ success: true, agent_id, phone_number });
  } catch (error) {
    console.error('[retell/provision]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

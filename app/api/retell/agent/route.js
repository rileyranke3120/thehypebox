import { NextResponse } from 'next/server';

const AGENT_ID = 'agent_132e809e21c0ff5eb0f006d59e';
const RETELL_BASE = 'https://api.retellai.com/v2';

function retellHeaders() {
  return {
    Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

export async function GET() {
  try {
    const res = await fetch(`${RETELL_BASE}/get-agent/${AGENT_ID}`, {
      headers: retellHeaders(),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Retell error: ${res.status}`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[retell agent GET]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const updates = await request.json();

    const res = await fetch(`${RETELL_BASE}/update-agent/${AGENT_ID}`, {
      method: 'PATCH',
      headers: retellHeaders(),
      body: JSON.stringify(updates),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Retell error: ${res.status}`);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[retell agent PATCH]', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

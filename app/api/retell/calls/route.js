import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://api.retellai.com/v2/list-calls', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RETELL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ limit: 20 }),
    });

    if (!response.ok) throw new Error(`Retell API error: ${response.status}`);
    const data = await response.json();
    return NextResponse.json({ calls: data });
  } catch (error) {
    return NextResponse.json({ calls: [], error: error.message }, { status: 500 });
  }
}

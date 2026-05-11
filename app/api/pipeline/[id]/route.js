import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { updateOpportunity, getPipelineStages } from '@/lib/ghl';

function getApiKey(session) {
  return session.user?.ghl_api_key || (session.user?.role === 'super_admin' ? process.env.GHL_API_KEY : null);
}

export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const apiKey = getApiKey(session);
  if (!apiKey) return NextResponse.json({ error: 'No GHL API key configured.' }, { status: 400 });

  try {
    const updates = await request.json();
    const result = await updateOpportunity(params.id, updates, apiKey);
    return NextResponse.json({ ok: true, opportunity: result });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request, { params: _ }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const apiKey = getApiKey(session);
  const locationId = session.user?.ghl_location_id;
  if (!apiKey || !locationId) return NextResponse.json({ error: 'No GHL config.' }, { status: 400 });

  try {
    const pipelines = await getPipelineStages(locationId, apiKey);
    return NextResponse.json({ pipelines });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

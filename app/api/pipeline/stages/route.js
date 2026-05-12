import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getPipelineStages } from '@/lib/ghl';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = session.user?.ghl_api_key || (session.user?.role === 'super_admin' ? process.env.GHL_API_KEY : null);
  const locationId = session.user?.ghl_location_id;
  if (!apiKey || !locationId) return NextResponse.json({ error: 'No GHL config.' }, { status: 400 });

  try {
    const pipelines = await getPipelineStages(locationId, apiKey);
    return NextResponse.json({ pipelines });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

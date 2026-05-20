import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getPipelineStages } from '@/lib/ghl';
import { getGHLCredentials } from '@/lib/ghl-session';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { locationId, apiKey } = await getGHLCredentials(session);
  if (!apiKey || !locationId) return NextResponse.json({ error: 'No GHL config.' }, { status: 400 });

  try {
    const pipelines = await getPipelineStages(locationId, apiKey);
    return NextResponse.json({ pipelines });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

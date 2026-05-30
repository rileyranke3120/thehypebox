import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { getPipelineStages } from '@/lib/ghl';
import { getGHLCredentials } from '@/lib/ghl-session';

const VALID_STATUSES = ['active', 'trialing'];

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'super_admin' && !VALID_STATUSES.includes(session.user.plan_status)) {
    return NextResponse.json({ error: 'Subscription required.' }, { status: 402 });
  }

  const { locationId, apiKey } = await getGHLCredentials(session);
  if (!apiKey || !locationId) return NextResponse.json({ error: 'No GHL config.' }, { status: 400 });

  try {
    const pipelines = await getPipelineStages(locationId, apiKey);
    return NextResponse.json({ pipelines });
  } catch (err) {
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

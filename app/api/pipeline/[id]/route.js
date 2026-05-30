import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { updateOpportunity, getPipelineStages } from '@/lib/ghl';
import { getGHLCredentials } from '@/lib/ghl-session';

const VALID_STATUSES = ['active', 'trialing'];

export async function PATCH(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'super_admin' && !VALID_STATUSES.includes(session.user.plan_status)) {
    return NextResponse.json({ error: 'Subscription required.' }, { status: 402 });
  }
  const { apiKey } = await getGHLCredentials(session);
  if (!apiKey) return NextResponse.json({ error: 'No GHL API key configured.' }, { status: 400 });

  try {
    const ALLOWED_OPP_FIELDS = ['stageId', 'status', 'monetaryValue', 'assignedTo', 'name'];
    const raw = await request.json();
    const updates = Object.fromEntries(Object.entries(raw).filter(([k]) => ALLOWED_OPP_FIELDS.includes(k)));
    if (!Object.keys(updates).length) return NextResponse.json({ error: 'No valid fields.' }, { status: 400 });

    const VALID_OPP_STATUSES = ['open', 'won', 'lost', 'abandoned'];
    if (updates.status !== undefined && !VALID_OPP_STATUSES.includes(updates.status)) {
      return NextResponse.json({ error: 'status must be one of: open, won, lost, abandoned.' }, { status: 400 });
    }
    if (updates.monetaryValue !== undefined && typeof updates.monetaryValue !== 'number') {
      return NextResponse.json({ error: 'monetaryValue must be a number.' }, { status: 400 });
    }
    if (updates.name !== undefined && updates.name.length > 200) {
      return NextResponse.json({ error: 'name must be 200 characters or fewer.' }, { status: 400 });
    }
    if (updates.assignedTo !== undefined && (typeof updates.assignedTo !== 'string' || updates.assignedTo.length > 50)) {
      return NextResponse.json({ error: 'assignedTo must be a string of 50 characters or fewer.' }, { status: 400 });
    }

    const result = await updateOpportunity(params.id, updates, apiKey);
    return NextResponse.json({ ok: true, opportunity: result });
  } catch (err) {
    console.error('[pipeline PATCH]', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

export async function GET(request, { params: _ }) {
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
    console.error('[pipeline/[id] GET]', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { createSubAccount } from '@/lib/highlevel';
import { sendEmail } from '@/lib/send-email';
import { highLevelAccessEmail } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const session = await auth();
  const authHeader = request.headers.get('authorization');
  const isAdmin = session?.user?.role === 'super_admin';
  // ADMIN_SECRET bypass — for CLI/automated provisioning only. Rotate this key periodically.
  const hasSecret = process.env.ADMIN_SECRET && authHeader === `Bearer ${process.env.ADMIN_SECRET}`;
  if (hasSecret) {
    console.warn('[admin/create-highlevel] ADMIN_SECRET bypass used', {
      ip: request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown',
      time: new Date().toISOString(),
    });
  }
  if (!isAdmin && !hasSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email, sendAccessEmail = true } = await request.json();
  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const supabase = createClient();

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, name, business_name, plan, ghl_location_id')
    .eq('email', email.toLowerCase())
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (user.ghl_location_id) {
    return NextResponse.json({
      ok: false,
      message: 'User already has a HighLevel account',
      locationId: user.ghl_location_id,
    });
  }

  let hlAccount;
  try {
    hlAccount = await createSubAccount({
      name: user.name || '',
      email: user.email,
      phone: '',
      plan: user.plan || 'launch',
      businessName: user.business_name || user.name || user.email,
    });
  } catch (err) {
    console.error('[admin/create-highlevel] HighLevel error:', err);
    return NextResponse.json({ error: 'HighLevel provisioning failed.' }, { status: 502 });
  }

  const dbUpdate = {
    ghl_location_id: hlAccount.locationId,
    ghl_user_id: hlAccount.userId,
  };
  if (hlAccount.calendarId)    dbUpdate.ghl_calendar_id  = hlAccount.calendarId;
  if (hlAccount.retellAgentId) dbUpdate.retell_agent_id  = hlAccount.retellAgentId;

  await supabase
    .from('users')
    .update(dbUpdate)
    .eq('id', user.id);

  if (sendAccessEmail) {
    try {
      const tpl = highLevelAccessEmail({
        name: user.name || user.email,
        plan: user.plan,
        locationId: hlAccount.locationId,
        hlEmail: user.email,
        hlPassword: hlAccount.password,
        dashboardUrl: hlAccount.dashboardUrl,
        hasRetell: !!hlAccount.retellAgentId,
      });
      await sendEmail({ to: user.email, ...tpl });
    } catch (emailErr) {
      console.error('[admin/create-highlevel] access email failed:', emailErr.message);
    }
  }

  return NextResponse.json({
    ok: true,
    locationId: hlAccount.locationId,
    userId: hlAccount.userId,
    dashboardUrl: hlAccount.dashboardUrl,
  });
}

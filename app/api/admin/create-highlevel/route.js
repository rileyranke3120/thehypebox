import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { createSubAccount } from '@/lib/highlevel';
import { sendEmail } from '@/lib/send-email';
import { highLevelAccessEmail } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  // Verify admin secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email, sendAccessEmail = true } = await request.json();
  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const supabase = createClient();

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, name, plan, ghl_location_id')
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
    });
  } catch (err) {
    return NextResponse.json({ error: `HighLevel error: ${err.message}` }, { status: 502 });
  }

  await supabase
    .from('users')
    .update({
      ghl_location_id: hlAccount.locationId,
      ghl_user_id: hlAccount.userId,
    })
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

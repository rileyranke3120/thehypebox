import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from('users')
    .select('id, email, name, business_name, plan, plan_status, ghl_location_id, stripe_customer_id, trial_ends_at, created_at')
    .not('plan_status', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ clients: data || [] });
}

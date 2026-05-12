import { auth } from '@/auth';
import { createClient } from '@/lib/supabase';
import { getStripe } from '@/lib/stripe';
import { NextResponse } from 'next/server';

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('email', session.user.email)
      .single();

    if (error || !user?.stripe_customer_id) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    const stripe = getStripe();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    console.error('[create-portal-session]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

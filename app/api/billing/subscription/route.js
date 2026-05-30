import { auth } from '@/auth';
import { createClient } from '@/lib/supabase';
import { getStripe } from '@/lib/stripe';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('stripe_customer_id, stripe_subscription_id, plan, plan_status, trial_ends_at, created_at')
      .eq('email', session.user.email)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Expired trials aren't reflected in Stripe — return DB status directly
    if (user.plan_status === 'expired') {
      return NextResponse.json({
        plan: user.plan,
        planStatus: 'expired',
        noSubscription: !user.stripe_subscription_id,
        trialEnd: user.trial_ends_at ? new Date(user.trial_ends_at).getTime() : null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        last4: null,
        cardBrand: null,
      });
    }

    if (!user.stripe_subscription_id) {
      return NextResponse.json({ noSubscription: true });
    }

    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(
      user.stripe_subscription_id,
      { expand: ['default_payment_method'] }
    );

    const pm = subscription.default_payment_method;
    const last4 = pm?.card?.last4 || null;
    const cardBrand = pm?.card?.brand || null;

    // Prefer our DB status for 'expired' — Stripe doesn't have this concept
    const planStatus = user.plan_status === 'expired' ? 'expired' : subscription.status;

    return NextResponse.json({
      plan: user.plan,
      planStatus,
      trialEnd: subscription.trial_end ? subscription.trial_end * 1000 : null,
      currentPeriodEnd: subscription.current_period_end * 1000,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      last4,
      cardBrand,
    });
  } catch (err) {
    console.error('[billing/subscription GET]', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

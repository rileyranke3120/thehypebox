/**
 * setup-stripe.mjs
 * Run once to create products + prices in Stripe.
 * Copy the price IDs into your .env.local and Vercel env vars.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/setup-stripe.mjs
 */

import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('ERROR: Set STRIPE_SECRET_KEY before running this script.');
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: '2024-06-20' });

const PLANS = [
  { slug: 'launch',   name: 'The Launch Box',   amount: 9700  },  // $97/mo
  { slug: 'rocket',   name: 'The Rocket Box',   amount: 29700 },  // $297/mo
  { slug: 'velocity', name: 'The Velocity Box', amount: 49700 },  // $497/mo
];

console.log('\nCreating Stripe products + prices...\n');

const results = {};

for (const plan of PLANS) {
  // Create product
  const product = await stripe.products.create({
    name: plan.name,
    metadata: { slug: plan.slug },
  });

  // Create recurring monthly price
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: plan.amount,
    currency: 'usd',
    recurring: { interval: 'month' },
    nickname: plan.name,
  });

  results[plan.slug] = { productId: product.id, priceId: price.id, amount: plan.amount };
  console.log(`✅ ${plan.name}`);
  console.log(`   Product ID : ${product.id}`);
  console.log(`   Price ID   : ${price.id}`);
  console.log();
}

console.log('─────────────────────────────────────────');
console.log('Add these to .env.local and Vercel env vars:\n');
console.log(`STRIPE_PRICE_LAUNCH=${results.launch.priceId}`);
console.log(`STRIPE_PRICE_ROCKET=${results.rocket.priceId}`);
console.log(`STRIPE_PRICE_VELOCITY=${results.velocity.priceId}`);
console.log('─────────────────────────────────────────\n');

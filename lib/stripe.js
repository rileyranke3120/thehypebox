import Stripe from 'stripe';

let _stripe = null;

export function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Missing STRIPE_SECRET_KEY environment variable');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });
  }
  return _stripe;
}

// Default export for convenience — same lazy instance
export default new Proxy(
  {},
  {
    get(_, prop) {
      return getStripe()[prop];
    },
  }
);

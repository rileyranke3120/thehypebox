'use client';

export function trackEvent(eventName, params = {}) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
}

export function trackSignup(plan) {
  const values = { launch: 97, rocket: 297, velocity: 497 };
  trackEvent('sign_up', { plan, value: values[plan] ?? 0 });
}

export function trackConversion(plan, amountDollars) {
  trackEvent('purchase', {
    transaction_id: `${plan}_${Date.now()}`,
    value: amountDollars,
    currency: 'USD',
    items: [{ item_name: plan, price: amountDollars }],
  });
}

export const PLAN_FEATURES = {
  starter: [
    'overview',
    'phone',
    'missed-call',
    'review-request',
    'scheduling',
    'billing',
    'settings',
    'contacts',
    'pipeline',
    'appointments-ghl',
    'calls-log',
  ],
  growth: [
    'overview',
    'phone',
    'missed-call',
    'review-request',
    'reactivation',
    'lead-gen',
    'scheduling',
    'billing',
    'settings',
    'contacts',
    'pipeline',
    'appointments-ghl',
    'calls-log',
  ],
  pro: [
    'overview',
    'phone',
    'missed-call',
    'review-request',
    'reactivation',
    'lead-gen',
    'scheduling',
    'billing',
    'settings',
    'accounting',
    'crm',
    'contacts',
    'pipeline',
    'appointments-ghl',
    'calls-log',
  ],
  super_admin: [
    'overview',
    'phone',
    'missed-call',
    'review-request',
    'reactivation',
    'lead-gen',
    'scheduling',
    'billing',
    'settings',
    'accounting',
    'crm',
    'clients',
    'add-client',
    'automation-logs',
    'contacts',
    'pipeline',
    'appointments-ghl',
    'calls-log',
  ],
};

export function hasFeature(plan, page) {
  const role = plan === 'super_admin' ? 'super_admin' : plan;
  return (PLAN_FEATURES[role] || PLAN_FEATURES.starter).includes(page);
}

export function getPlanPrice(plan) {
  const prices = { starter: 297, growth: 497, pro: 797 };
  return prices[plan] || 297;
}

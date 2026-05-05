const LAUNCH_FEATURES = [
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
];

const ROCKET_FEATURES = [
  ...LAUNCH_FEATURES,
  'reactivation',
  'lead-gen',
];

const VELOCITY_FEATURES = [
  ...ROCKET_FEATURES,
  'accounting',
  'crm',
];

const SUPER_ADMIN_FEATURES = [
  ...VELOCITY_FEATURES,
  'clients',
  'add-client',
  'automation-logs',
];

export const PLAN_FEATURES = {
  // Current plan names
  launch:   LAUNCH_FEATURES,
  rocket:   ROCKET_FEATURES,
  velocity: VELOCITY_FEATURES,
  // Legacy plan names (backwards compat)
  starter:  LAUNCH_FEATURES,
  growth:   ROCKET_FEATURES,
  pro:      VELOCITY_FEATURES,
  super_admin: SUPER_ADMIN_FEATURES,
};

export function hasFeature(plan, page) {
  const key = plan === 'super_admin' ? 'super_admin' : plan;
  return (PLAN_FEATURES[key] || PLAN_FEATURES.launch).includes(page);
}

export function getPlanPrice(plan) {
  const prices = { launch: 97, rocket: 297, velocity: 497, starter: 97, growth: 297, pro: 497 };
  return prices[plan] || 97;
}

import NicheLandingPage from '@/components/NicheLandingPage';

export const metadata = {
  title: 'AI Receptionist for Plumbers | TheHypeBox',
  description:
    "Stop losing plumbing jobs to voicemail. Sarah, your 24/7 AI receptionist, answers every call — even when you're running pipe, snaking drains, or in the crawl space.",
};

const NICHE = {
  slug: 'plumbers',
  tradeName: 'Plumbers',
  tradeNameLower: 'plumbing',
  eyebrow: 'For Plumbing Contractors',
  headline: "Stop Losing Jobs While You're",
  headlineAccent: 'Under The Sink',
  sub: "Sarah, your AI receptionist, handles every call while you're running pipe, snaking drains, or fixing a slab leak. Not one lead slips through the cracks.",
  callDemo: [
    { type: 'ring',   text: '📞 Incoming: (555) 849-2201 — Unknown Caller' },
    { type: 'dim',    text: '──────────────────────────────────────────' },
    { type: 'sarah',  text: "Thanks for calling Metro Plumbing, this is Sarah. How can I help?" },
    { type: 'caller', text: "Hi — my kitchen sink is completely backed up, water's everywhere." },
    { type: 'sarah',  text: "I can get a plumber out to you today. What's your address?" },
    { type: 'caller', text: "142 Oak Street. Anytime after 2pm works great." },
    { type: 'sarah',  text: "Perfect. I've got you booked for 3pm today — text confirmation coming your way." },
    { type: 'success', text: '✓ Appointment booked · Calendar updated · Lead captured' },
  ],
  stats: [
    { value: '87%', label: 'Of calls go unanswered while on a job' },
    { value: '$1,200', label: 'Average new service call value' },
    { value: '24/7', label: "Sarah never takes a day off" },
  ],
  benefits: [
    {
      title: 'Hands-Free Call Coverage',
      desc: "Sarah answers every call whether you're running pipe under a sink, snaking a main line, or elbow-deep in a drain. Your phone works even when you can't.",
    },
    {
      title: 'Instant Missed-Call Text-Back',
      desc: "Any call that slips through gets an automatic text reply within seconds. Leads don't go cold — Sarah keeps them warm until the job is booked.",
    },
    {
      title: 'Emergency & Same-Day Booking',
      desc: "Pipe burst at 11pm? Sarah handles the emergency, qualifies the situation, and gets the job on your calendar before morning.",
    },
    {
      title: 'After-Hours Revenue',
      desc: "Most plumbers miss calls after 5pm. Sarah works nights and weekends, turning after-hours calls into booked morning appointments.",
    },
  ],
  testimonial: {
    quote:
      "Before HypeBox, I was losing $3–4k in jobs every month just from missed calls. Now Sarah handles everything while I'm on site. Paid for itself in the first week.",
    name: 'Dave H.',
    company: 'DH Plumbing & Drain',
  },
  launchFeatures: [
    'Sarah AI receptionist — 24/7',
    'Missed call text-back (instant)',
    'Appointment booking + calendar sync',
    'CRM with lead tracking',
    'Monthly performance report',
    'Up to 200 calls/month',
  ],
  rocketFeatures: [
    'Everything in Launch Box',
    'Unlimited call volume',
    'Emergency call priority routing',
    'Automated review requests after service',
    '7-day lead follow-up sequences',
    'Pipeline value tracking',
    'Estimate follow-up automation',
    'Priority setup & support',
  ],
};

export default function PlumbersPage() {
  return <NicheLandingPage niche={NICHE} />;
}

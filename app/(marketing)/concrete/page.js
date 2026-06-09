import NicheLandingPage from '@/components/NicheLandingPage';

export const metadata = {
  title: 'AI Receptionist for Concrete & Coating Contractors | TheHypeBox',
  description:
    "Concrete doesn't wait and neither do customers. Sarah books every estimate and job inquiry while you're finishing a floor, laying forms, or spraying coatings.",
};

const NICHE = {
  slug: 'concrete',
  tradeName: 'Concrete Contractors',
  tradeNameLower: 'concrete and coating',
  eyebrow: 'For Concrete & Coating Contractors',
  headline: "Book More Jobs While You're",
  headlineAccent: 'On The Pour',
  sub: "Concrete doesn't wait and neither do customers. Sarah fields every call while you're finishing a floor, laying forms, or spraying epoxy — and books the job before they call someone else.",
  callDemo: [
    { type: 'ring',   text: '📞 Incoming: (555) 623-8844 — Unknown Caller' },
    { type: 'dim',    text: '──────────────────────────────────────────' },
    { type: 'sarah',  text: "Thanks for calling Elite Concrete, this is Sarah. How can I help you today?" },
    { type: 'caller', text: "Yeah, I need a quote on epoxy coating for my garage — about a 3-car." },
    { type: 'sarah',  text: "Great! We'd love to help. I can schedule a free on-site estimate. What's your address?" },
    { type: 'caller', text: "467 Clover Lane." },
    { type: 'sarah',  text: "Perfect — we have availability Saturday at 9am. Does that work for the estimate?" },
    { type: 'success', text: '✓ Estimate booked · Lead captured · Customer texted confirmation' },
  ],
  stats: [
    { value: '70%', label: 'Of coating jobs are decided same day' },
    { value: '$4,200', label: 'Average concrete job size' },
    { value: '60%', label: "Of missed callers don't leave a voicemail" },
  ],
  benefits: [
    {
      title: 'Estimate Capture on Autopilot',
      desc: "Sarah books every quote request — garage floors, driveways, commercial slabs — even during active pours and finishing work. No job slips through.",
    },
    {
      title: 'Seasonal Rush Coverage',
      desc: "Spring and fall are prime concrete season. Sarah handles the call spike without you needing to hire office staff or juggle your phone between coats.",
    },
    {
      title: 'First-Response Advantage',
      desc: "Sarah responds in seconds. By the time your competitor checks their voicemail, your estimate is already on the calendar and the customer has a confirmation text.",
    },
    {
      title: 'Project Update Automation',
      desc: "Automated texts keep clients updated on pour schedules and cure timelines so you're not interrupted mid-job with status-check calls.",
    },
  ],
  testimonial: {
    quote:
      "Concrete season is chaos. Last spring Sarah booked 14 garage floor estimates in one week while we were flat-out on a commercial pour. Every single one converted.",
    name: 'Chris M.',
    company: 'Midwest Concrete & Coatings',
  },
  launchFeatures: [
    'Sarah AI receptionist — 24/7',
    'Missed call text-back (instant)',
    'Estimate & appointment booking',
    'CRM with lead tracking',
    'Monthly performance report',
    'Up to 200 calls/month',
  ],
  rocketFeatures: [
    'Everything in Launch Box',
    'Unlimited call volume',
    'Automated review requests after project',
    'Project update text automation',
    '7-day lead follow-up sequences',
    'Seasonal outreach campaigns',
    'Pipeline value tracking',
    'Priority setup & support',
  ],
};

export default function ConcretePage() {
  return <NicheLandingPage niche={NICHE} />;
}

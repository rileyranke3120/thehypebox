import NicheLandingPage from '@/components/NicheLandingPage';

export const metadata = {
  title: 'AI Receptionist for Electricians | TheHypeBox',
  description:
    "You can't answer the phone mid-install. Sarah handles every call, books the job, and keeps you safe — no interruptions, no missed revenue.",
};

const NICHE = {
  slug: 'electricians',
  tradeName: 'Electricians',
  tradeNameLower: 'electrical',
  eyebrow: 'For Electrical Contractors',
  headline: "Your Phone Rings While You're",
  headlineAccent: 'In The Panel',
  sub: "Safety comes first — you can't take a call mid-install. Sarah handles every inquiry, qualifies the job, and books it on your calendar. No interruptions. No missed revenue.",
  callDemo: [
    { type: 'ring',   text: '📞 Incoming: (555) 934-1178 — Unknown Caller' },
    { type: 'dim',    text: '──────────────────────────────────────────' },
    { type: 'sarah',  text: "Thanks for calling Pro Electric, this is Sarah. What can I help you with today?" },
    { type: 'caller', text: "I need a panel upgrade quote — we're adding a hot tub and EV charger." },
    { type: 'sarah',  text: "Absolutely. I can schedule a site visit for a quote. What's your address?" },
    { type: 'caller', text: "229 Birchwood Ave." },
    { type: 'sarah',  text: "Got it. I have availability Thursday at 10am for the site visit — does that work?" },
    { type: 'success', text: '✓ Quote visit booked · Customer notified · Lead captured' },
  ],
  stats: [
    { value: '1 in 4', label: 'Calls are panel or EV upgrade jobs' },
    { value: '$2,800', label: 'Average electrical job value' },
    { value: '68%', label: "Callers who don't call back after voicemail" },
  ],
  benefits: [
    {
      title: 'Zero Interruptions',
      desc: "You stay focused on live circuits. Sarah handles the phone so you never have to choose between safety and a potential customer.",
    },
    {
      title: 'Quote Request Capture',
      desc: "Every panel upgrade, EV charger, and rewire inquiry is captured and a site visit is scheduled before the caller even thinks about trying a competitor.",
    },
    {
      title: 'Commercial Job Pipeline',
      desc: "Sarah pre-qualifies commercial inquiries — scope, timeline, budget — so you spend your time on the jobs that are worth your truck roll.",
    },
    {
      title: 'Permit & Inspection Follow-Up',
      desc: "Automated reminders keep jobs moving through inspections and final sign-offs without the back-and-forth phone tag with homeowners.",
    },
  ],
  testimonial: {
    quote:
      "I used to miss 4–5 calls a day doing panel work. One of those calls could be a $5,000 job. Sarah paid for a full year in the first month just from one commercial quote she booked.",
    name: 'Jason R.',
    company: 'Ridgeline Electric',
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
    'Commercial inquiry pre-qualification',
    'Automated review requests',
    '7-day lead follow-up sequences',
    'Permit & inspection reminder automation',
    'Pipeline value tracking',
    'Priority setup & support',
  ],
};

export default function ElectriciansPage() {
  return <NicheLandingPage niche={NICHE} />;
}

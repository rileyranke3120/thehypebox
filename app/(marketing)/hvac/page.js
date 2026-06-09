import NicheLandingPage from '@/components/NicheLandingPage';

export const metadata = {
  title: 'AI Receptionist for HVAC Companies | TheHypeBox',
  description:
    "Summer rush, winter rush — Sarah handles your call volume 24/7 so you never miss a hot lead while you're on the roof or in the attic.",
};

const NICHE = {
  slug: 'hvac',
  tradeName: 'HVAC Companies',
  tradeNameLower: 'HVAC',
  eyebrow: 'For HVAC Contractors',
  headline: "Never Miss A Hot Lead While You're",
  headlineAccent: 'On The Roof',
  sub: "Summer and winter rush don't wait. Sarah answers 24/7, books emergency repairs and tune-ups, and keeps your pipeline full when you're in an attic or on a rooftop.",
  callDemo: [
    { type: 'ring',   text: '📞 Incoming: (555) 712-4489 — Unknown Caller' },
    { type: 'dim',    text: '──────────────────────────────────────────' },
    { type: 'sarah',  text: "Thanks for calling Premier HVAC, this is Sarah. How can I help?" },
    { type: 'caller', text: "My AC stopped working last night — it's 94 degrees in here with two kids." },
    { type: 'sarah',  text: "We can get a tech out today. What's your address?" },
    { type: 'caller', text: "3847 Maple Drive." },
    { type: 'sarah',  text: "Perfect — I have a tech available at 1pm. Does that work for you?" },
    { type: 'success', text: '✓ Emergency appointment booked · Tech dispatched · Lead captured' },
  ],
  stats: [
    { value: '3×', label: 'Call volume during peak season' },
    { value: '$850', label: 'Average HVAC service ticket' },
    { value: '40%', label: 'Of calls sent to voicemail' },
  ],
  benefits: [
    {
      title: 'Peak Season Overflow',
      desc: "When your phones explode in July and January, Sarah handles the surge without skipping a beat — no hold music, no voicemail, no lost jobs.",
    },
    {
      title: 'Emergency Dispatch',
      desc: "AC out in a heat wave? Furnace dead at midnight? Sarah identifies urgent situations, qualifies them, and books same-day or first-thing-morning slots automatically.",
    },
    {
      title: 'Maintenance Reminders',
      desc: "Automated follow-ups remind existing customers to book their annual tune-up. Service contract renewals happen without you lifting a finger.",
    },
    {
      title: 'After-Hours Coverage',
      desc: "Late-night HVAC failures become first-thing-morning revenue. Sarah is on the phone when your competitors are letting calls go to voicemail.",
    },
  ],
  testimonial: {
    quote:
      "Last summer we had a 10-day stretch where every tech was booked solid. Sarah handled every new call, booked the overflow weeks out, and we didn't miss a single lead.",
    name: 'Mike T.',
    company: 'Tri-State HVAC Solutions',
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
    'Emergency job priority routing',
    'Seasonal maintenance reminders',
    'Service contract renewal automation',
    'Multi-tech scheduling support',
    '7-day lead follow-up sequences',
    'Priority setup & support',
  ],
};

export default function HvacPage() {
  return <NicheLandingPage niche={NICHE} />;
}

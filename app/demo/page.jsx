'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from '@/styles/dashboard.module.css';
import { hasFeature } from '@/lib/planFeatures';

function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

// ─── FAKE DATA — ProCoat Columbus, Columbus OH ───────────────────────────────

const DEMO_USER = {
  name: 'Jason Reed',
  email: 'jason@procoatcolumbus.com',
  role: 'client',
  plan: 'growth',
  business_name: 'ProCoat Columbus',
  business_phone: '(614) 555-0312',
  business_hours: 'Mon–Fri 8am–5pm',
};

const DEMO_OVERVIEW = {
  isSuperAdmin: false,
  stats: {
    totalContacts: 183,
    leadsActive: 14,
    pipelineValue: 36800,
    completedJobs: 67,
    callsThisMonth: 24,
    apptThisMonth: 11,
    reviewsThisMonth: 7,
  },
  recentActivity: [
    { automation_type: 'review-request', status: 'success', created_at: new Date(Date.now() - 3 * 3600000).toISOString() },
    { automation_type: 'missed-call-followup', status: 'success', created_at: new Date(Date.now() - 6 * 3600000).toISOString() },
    { automation_type: 'appointment-reminder', status: 'success', created_at: new Date(Date.now() - 24 * 3600000).toISOString() },
    { automation_type: 'reactivation', status: 'success', created_at: new Date(Date.now() - 2 * 24 * 3600000).toISOString() },
    { automation_type: 'post-service-followup', status: 'success', created_at: new Date(Date.now() - 3 * 24 * 3600000).toISOString() },
  ],
};

const DEMO_CALLS = [
  { call_id: 'r1', from_number: '(614) 555-0291', start_timestamp: Date.now() - 2 * 3600000, duration_ms: 138000, scrubbed_call_analysis: { call_summary: 'Caller requested a garage floor epoxy quote. Booked an estimate for April 14th at 10am.', call_successful: true, user_sentiment: 'Positive' } },
  { call_id: 'r2', from_number: '(614) 555-0174', start_timestamp: Date.now() - 5 * 3600000, duration_ms: 204000, scrubbed_call_analysis: { call_summary: 'Customer asked about polyaspartic driveway coating. Scheduled estimate for April 15 at 2pm.', call_successful: true, user_sentiment: 'Positive' } },
  { call_id: 'r3', from_number: '(614) 555-0347', start_timestamp: Date.now() - 24 * 3600000, duration_ms: 81000, scrubbed_call_analysis: { call_summary: 'Caller asked about patio concrete coating options and pricing. Provided info, offered to schedule.', call_successful: true, user_sentiment: 'Neutral' } },
  { call_id: 'r4', from_number: '(614) 555-0428', start_timestamp: Date.now() - 26 * 3600000, duration_ms: 175000, scrubbed_call_analysis: { call_summary: 'Inquiry about commercial warehouse floor coating. Discussed metallic epoxy options. Booked site visit.', call_successful: true, user_sentiment: 'Positive' } },
  { call_id: 'r5', from_number: '(614) 555-0519', start_timestamp: Date.now() - 48 * 3600000, duration_ms: 97000, scrubbed_call_analysis: { call_summary: 'Asked about basement floor coating for new build. Booked estimate for April 18th at 10:30am.', call_successful: true, user_sentiment: 'Positive' } },
  { call_id: 'r6', from_number: '(614) 555-0663', start_timestamp: Date.now() - 50 * 3600000, duration_ms: 126000, scrubbed_call_analysis: { call_summary: 'Caller wanted info on pool deck resurfacing. Interested in non-slip coating. Sending quote.', call_successful: true, user_sentiment: 'Positive' } },
  { call_id: 'r7', from_number: '(614) 555-0781', start_timestamp: Date.now() - 72 * 3600000, duration_ms: 61000, scrubbed_call_analysis: { call_summary: 'Quick inquiry about turnaround time for a 2-car garage. Provided timeline info.', call_successful: true, user_sentiment: 'Neutral' } },
];

const DEMO_AGENT = {
  agent_name: 'ProCoat Columbus AI Agent',
  voice_id: 'eleven_labs_rachel',
  language: 'en-US',
  is_published: true,
  last_modification_timestamp: Date.now() - 7 * 24 * 3600000,
};

const DEMO_MISSED_CALLS = [
  { id: 'm1', from_number: '(614) 555-0291', timestamp: new Date(Date.now() - 2 * 3600000).toISOString(), text_sent: true },
  { id: 'm2', from_number: '(614) 555-0618', timestamp: new Date(Date.now() - 6 * 3600000).toISOString(), text_sent: true },
  { id: 'm3', from_number: '(614) 555-0744', timestamp: new Date(Date.now() - 25 * 3600000).toISOString(), text_sent: true },
  { id: 'm4', from_number: '(614) 555-0882', timestamp: new Date(Date.now() - 48 * 3600000).toISOString(), text_sent: false },
];

const DEMO_REVIEW_REQUESTS = [
  { id: 'rr1', customer_name: 'Marcus W.', phone_number: '(614) 555-0183', sent_at: new Date(Date.now() - 3 * 3600000).toISOString() },
  { id: 'rr2', customer_name: 'Dawn P.', phone_number: '(614) 555-0255', sent_at: new Date(Date.now() - 28 * 3600000).toISOString() },
  { id: 'rr3', customer_name: 'Sandra H.', phone_number: '(614) 555-0369', sent_at: new Date(Date.now() - 72 * 3600000).toISOString() },
];

const DEMO_REACTIVATIONS = [
  { id: 'rc1', customer_name: 'Janet S.', phone_number: '(614) 555-0471', sent_at: new Date(Date.now() - 26 * 3600000).toISOString() },
  { id: 'rc2', customer_name: 'Bret S.', phone_number: '(614) 555-0537', sent_at: new Date(Date.now() - 3 * 24 * 3600000).toISOString() },
  { id: 'rc3', customer_name: 'Larry B.', phone_number: '(614) 555-0693', sent_at: new Date(Date.now() - 7 * 24 * 3600000).toISOString() },
];

const DEMO_LEAD_NURTURES = [
  { id: 'ln1', customer_name: 'Tyler H.', phone_number: '(614) 555-0742', step: 1, sent_at: new Date(Date.now() - 2 * 24 * 3600000).toISOString() },
  { id: 'ln2', customer_name: 'Amanda K.', phone_number: '(614) 555-0831', step: 2, sent_at: new Date(Date.now() - 4 * 24 * 3600000).toISOString() },
  { id: 'ln3', customer_name: 'Greg N.', phone_number: '(614) 555-0917', step: 1, sent_at: new Date(Date.now() - 6 * 24 * 3600000).toISOString() },
];

const DEMO_APPOINTMENTS = [
  { id: 'a1', date: '2026-04-14', time: '10:00', title: 'Garage Floor Epoxy Estimate — James P.', notes: '2-car garage, customer wants full flake system' },
  { id: 'a2', date: '2026-04-14', time: '14:00', title: 'Driveway Coating Estimate — Sandra H.', notes: 'Polyaspartic, approx 600 sq ft' },
  { id: 'a3', date: '2026-04-15', time: '09:00', title: 'Garage Floor Install — Tom L.', notes: '3-car garage, metallic epoxy — deposit paid' },
  { id: 'a4', date: '2026-04-15', time: '14:00', title: 'Patio Coating Estimate — Diane F.', notes: 'Stamped overlay, ~400 sq ft' },
  { id: 'a5', date: '2026-04-16', time: '11:00', title: 'Basement Floor Coating — Rob K.', notes: 'Single coat polyaspartic, 800 sq ft' },
  { id: 'a6', date: '2026-04-18', time: '10:30', title: 'Pool Deck Resurface — Chris V.', notes: 'Non-slip texture, coping repair needed' },
  { id: 'a7', date: '2026-04-18', time: '15:00', title: 'Commercial Floor Estimate — Mary W.', notes: 'Auto shop, ~2,000 sq ft, needs chemical-resistant coating' },
  { id: 'a8', date: '2026-04-22', time: '09:00', title: 'Garage Floor Install — Greg S.', notes: 'Full flake epoxy, 3-car — deposit paid' },
  { id: 'a9', date: '2026-04-08', time: '10:00', title: 'Driveway Sealing — Paula B.', notes: 'Completed' },
  { id: 'a10', date: '2026-04-10', time: '14:00', title: 'Garage Epoxy Install — Dave R.', notes: 'Completed, 2-car metallic finish' },
];

const DEMO_AUTOMATION_LOGS = [
  { id: 'al1', automation: 'review-request', status: 'sent', triggered_at: new Date(Date.now() - 3 * 3600000).toISOString() },
  { id: 'al2', automation: 'missed-call-followup', status: 'sent', triggered_at: new Date(Date.now() - 6 * 3600000).toISOString() },
  { id: 'al3', automation: 'appointment-reminder', status: 'sent', triggered_at: new Date(Date.now() - 24 * 3600000).toISOString() },
  { id: 'al4', automation: 'reactivation', status: 'sent', triggered_at: new Date(Date.now() - 2 * 24 * 3600000).toISOString() },
  { id: 'al5', automation: 'lead-nurture', status: 'sent', triggered_at: new Date(Date.now() - 3 * 24 * 3600000).toISOString() },
  { id: 'al6', automation: 'post-service-followup', status: 'sent', triggered_at: new Date(Date.now() - 4 * 24 * 3600000).toISOString() },
  { id: 'al7', automation: 'review-request', status: 'sent', triggered_at: new Date(Date.now() - 5 * 24 * 3600000).toISOString() },
  { id: 'al8', automation: 'reactivation', status: 'failed', triggered_at: new Date(Date.now() - 6 * 24 * 3600000).toISOString() },
];

// ────────────────────────────────────────────────────────────────────────────

const DEMO_MSG = '✅ Demo mode — no real actions fired.';

export default function DemoPage() {
  const [activePage, setActivePage] = useState('overview');

  const [calls] = useState(DEMO_CALLS);
  const [overviewData] = useState(DEMO_OVERVIEW);

  const [agentToggles, setAgentToggles] = useState({
    phone: true, scheduling: true, accounting: true, crm: true,
  });

  const userRole = DEMO_USER.role;
  const userPlan = DEMO_USER.plan;

  const [triggerForm, setTriggerForm] = useState({ automation: 'review-request', phone_number: '', customer_name: '' });
  const [triggerMsg, setTriggerMsg] = useState('');
  const [settingsForm, setSettingsForm] = useState({
    business_name: DEMO_USER.business_name,
    phone: DEMO_USER.business_phone,
    hours: DEMO_USER.business_hours,
  });
  const [settingsMsg, setSettingsMsg] = useState('');

  const [toggleStates, setToggleStates] = useState({
    'phone-active': true,
    'after-hours': true,
    'call-summaries': true,
    'transfer-escalations': false,
    'auto-book': true,
    'reminder-sms': true,
    'waitlist-autofill': true,
    'auto-invoice': true,
    'overdue-reminders': true,
    'monthly-pl': true,
    'auto-followup': true,
    're-engagement': true,
    'birthday-messages': false,
    'auto-text-back': true,
    'after-hours-only': false,
    'include-booking-link': true,
    'auto-send-review': true,
    'followup-reminder': true,
    'filter-by-rating': true,
    'auto-reactivation': true,
    'offer-discount': true,
    'multi-touch': false,
    'website-chatbot': true,
    'contact-form': true,
    'google-ads': false,
    'facebook-ads': false,
    'daily-summary': true,
    'urgent-calls': true,
    'new-customer-alert': false,
  });

  const [missedCalls, setMissedCalls] = useState(DEMO_MISSED_CALLS);
  const [reviewRequests, setReviewRequests] = useState(DEMO_REVIEW_REQUESTS);
  const [reactivations, setReactivations] = useState(DEMO_REACTIVATIONS);
  const [leadNurtures, setLeadNurtures] = useState(DEMO_LEAD_NURTURES);
  const [reviewForm, setReviewForm] = useState({ phone_number: '', customer_name: '', business_name: '' });
  const [reactivationForm, setReactivationForm] = useState({ phone_number: '', customer_name: '', business_name: '', offer: '10% off your next visit' });
  const [leadForm, setLeadForm] = useState({ phone_number: '', customer_name: '', business_name: '', step: 1 });
  const [automationMsg, setAutomationMsg] = useState('');

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [appointments, setAppointments] = useState(DEMO_APPOINTMENTS);
  const [apptForm, setApptForm] = useState({ title: '', time: '09:00', notes: '' });
  const [apptMsg, setApptMsg] = useState('');

  const [billingPlan, setBillingPlan] = useState(DEMO_USER.plan);
  const [billingMsg, setBillingMsg] = useState('');

  const [agentDetails] = useState(DEMO_AGENT);
  const [agentUpdateMsg, setAgentUpdateMsg] = useState('');

  const [automationLogs] = useState(DEMO_AUTOMATION_LOGS);

  const [activityItems] = useState(
    DEMO_OVERVIEW.recentActivity.slice(0, 5).map((log) => ({
      text: [log.automation_type || 'Automation', log.status ? `— ${log.status}` : null].filter(Boolean).join(' '),
      time: new Date(log.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      type: log.status === 'success' ? 'green' : log.status === 'failed' ? 'yellow' : 'blue',
    }))
  );

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const CAL_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const displayName = DEMO_USER.name;
  const displayInitials = getInitials(DEMO_USER.name);
  const displayEmail = DEMO_USER.email;

  const getDotClass = (type) => {
    if (type === 'blue') return styles.activityItemDotBlue;
    if (type === 'green') return styles.activityItemDotGreen;
    if (type === 'yellow') return styles.activityItemDotYellow;
    if (type === 'purple') return styles.activityItemDotPurple;
    if (type === 'lime') return styles.activityItemDotLime;
    return '';
  };

  const handleAgentToggle = (agentKey, agentName) => {
    setAgentToggles(prev => ({ ...prev, [agentKey]: !prev[agentKey] }));
  };

  function handleToggle(key) {
    setToggleStates(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function saveSettings() {
    setSettingsMsg(DEMO_MSG);
  }

  function triggerAutomation() {
    setTriggerMsg(DEMO_MSG);
  }

  function triggerReviewRequest() {
    if (!reviewForm.customer_name || !reviewForm.phone_number) return;
    setReviewRequests(prev => [
      { id: 'rr-new-' + Date.now(), customer_name: reviewForm.customer_name, phone_number: reviewForm.phone_number, sent_at: new Date().toISOString() },
      ...prev,
    ]);
    setAutomationMsg(DEMO_MSG);
    setReviewForm({ phone_number: '', customer_name: '', business_name: '' });
  }

  function triggerReactivation() {
    if (!reactivationForm.customer_name || !reactivationForm.phone_number) return;
    setReactivations(prev => [
      { id: 'rc-new-' + Date.now(), customer_name: reactivationForm.customer_name, phone_number: reactivationForm.phone_number, sent_at: new Date().toISOString() },
      ...prev,
    ]);
    setAutomationMsg(DEMO_MSG);
    setReactivationForm({ phone_number: '', customer_name: '', business_name: '', offer: '10% off your next visit' });
  }

  function triggerLeadNurture() {
    if (!leadForm.customer_name || !leadForm.phone_number) return;
    setLeadNurtures(prev => [
      { id: 'ln-new-' + Date.now(), customer_name: leadForm.customer_name, phone_number: leadForm.phone_number, step: parseInt(leadForm.step), sent_at: new Date().toISOString() },
      ...prev,
    ]);
    setAutomationMsg(DEMO_MSG);
    setLeadForm({ phone_number: '', customer_name: '', business_name: '', step: 1 });
  }

  function upgradePlan(newPlan) {
    setBillingPlan(newPlan);
    setBillingMsg(DEMO_MSG);
  }

  function updateAgentSetting() {
    setAgentUpdateMsg(DEMO_MSG);
  }

  function getCalCells() {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }

  function apptCountForDay(day) {
    const d = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return appointments.filter(a => a.date === d).length;
  }

  function getSelectedDateAppts() {
    if (!selectedDay) return [];
    const d = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    return appointments.filter(a => a.date === d);
  }

  function saveAppointment() {
    if (!selectedDay || !apptForm.title) return;
    const date = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    setAppointments(prev => [...prev, { id: 'a-new-' + Date.now(), date, time: apptForm.time, title: apptForm.title, notes: apptForm.notes }]);
    setApptForm({ title: '', time: '09:00', notes: '' });
    setApptMsg(DEMO_MSG);
  }

  const allNavItems = [
    {
      section: 'Overview',
      items: [
        {
          page: 'overview', label: 'Dashboard', requiredFeature: 'overview', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#1A1500', display: 'block' }}>
              <rect x="6" y="6" width="7" height="7" rx="1" stroke="#F5C400" strokeWidth="1.5"/>
              <rect x="19" y="6" width="7" height="7" rx="1" stroke="#F5C400" strokeWidth="1.5"/>
              <rect x="6" y="19" width="7" height="7" rx="1" stroke="#F5C400" strokeWidth="1.5"/>
              <rect x="19" y="19" width="7" height="7" rx="1" stroke="#F5C400" strokeWidth="1.5"/>
            </svg>
          )
        },
      ]
    },
    {
      section: 'Agents',
      items: [
        {
          page: 'phone', label: 'Phone Agent', requiredFeature: 'phone', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#0D1F35', display: 'block' }}>
              <path d="M11 17 C10.5 18.5 11 20.5 13 21.5 C14 22 15 21.5 16.5 20 C17.3 19.2 17.3 18 16.5 17.2 L15.75 16.45 C15.5 16.2 15.5 15.8 15.75 15.55 L17.45 13.85 C17.7 13.6 18.1 13.6 18.35 13.85 L19.1 14.6 C19.9 15.4 21.1 15.4 21.9 14.6 L23 13.5 C23.8 12.7 23.8 11.5 23 10.7 C21.5 9.2 19 8.5 17 9 C15 9.5 11.5 14.5 11 17 Z" stroke="#378ADD" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
            </svg>
          )
        },
        {
          page: 'scheduling', label: 'Scheduling', requiredFeature: 'scheduling', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#0D2018', display: 'block' }}>
              <rect x="6" y="9" width="20" height="16" rx="2" stroke="#1D9E75" strokeWidth="1.5"/>
              <line x1="6" y1="14" x2="26" y2="14" stroke="#1D9E75" strokeWidth="1.5"/>
              <line x1="11" y1="9" x2="11" y2="7" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="21" y1="9" x2="21" y2="7" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="11" cy="18.5" r="1.3" fill="#1D9E75"/>
              <circle cx="16" cy="18.5" r="1.3" fill="#1D9E75"/>
              <circle cx="21" cy="18.5" r="1.3" fill="#1D9E75"/>
              <circle cx="11" cy="22.5" r="1.3" fill="#1D9E75"/>
              <circle cx="16" cy="22.5" r="1.3" fill="#1D9E75"/>
            </svg>
          )
        },
      ]
    },
    {
      section: 'Automations',
      items: [
        {
          page: 'missed-call', label: 'Missed Call Text Back', requiredFeature: 'missed-call', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#1A0D0D', display: 'block' }}>
              <path d="M11 17 C10.5 18.5 11 20.5 13 21.5 C14 22 15 21.5 16.5 20 C17.3 19.2 17.3 18 16.5 17.2 L15.75 16.45 C15.5 16.2 15.5 15.8 15.75 15.55 L17.45 13.85 C17.7 13.6 18.1 13.6 18.35 13.85 L19.1 14.6 C19.9 15.4 21.1 15.4 21.9 14.6 L23 13.5 C23.8 12.7 23.8 11.5 23 10.7 C21.5 9.2 19 8.5 17 9 C15 9.5 11.5 14.5 11 17 Z" stroke="#ff6b6b" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
              <line x1="20" y1="7" x2="26" y2="13" stroke="#ff6b6b" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="26" y1="7" x2="20" y2="13" stroke="#ff6b6b" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )
        },
        {
          page: 'review-request', label: 'Review Request Agent', requiredFeature: 'review-request', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#1A1500', display: 'block' }}>
              <path d="M16 7 L17.8 12.5 H23.5 L18.9 15.8 L20.7 21.3 L16 18 L11.3 21.3 L13.1 15.8 L8.5 12.5 H14.2 Z" stroke="#F5C400" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
            </svg>
          )
        },
        {
          page: 'reactivation', label: 'Reactivation Agent', requiredFeature: 'reactivation', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#0D2018', display: 'block' }}>
              <path d="M22 10 C20.3 8 17.8 7 15 7.5 C10.9 8.3 8 12 8 16" stroke="#1D9E75" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <path d="M10 25 C11.7 27 14.2 28 17 27.5 C21.1 26.7 24 23 24 19" stroke="#1D9E75" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <path d="M19 7 L22 10 L19 13" stroke="#1D9E75" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13 22 L10 25 L13 28" stroke="#1D9E75" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )
        },
        {
          page: 'lead-gen', label: 'Lead Generation', requiredFeature: 'lead-gen', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#160D2A', display: 'block' }}>
              <circle cx="16" cy="16" r="3" stroke="#7B2FFF" strokeWidth="1.5" fill="none"/>
              <circle cx="16" cy="16" r="7" stroke="#7B2FFF" strokeWidth="1.5" fill="none" opacity="0.5"/>
              <circle cx="16" cy="16" r="11" stroke="#7B2FFF" strokeWidth="1.5" fill="none" opacity="0.25"/>
              <line x1="16" y1="5" x2="16" y2="8" stroke="#7B2FFF" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )
        },
      ]
    },
    {
      section: 'CRM Data',
      items: [
        {
          page: 'contacts', href: '/demo/contacts', label: 'Contacts', requiredFeature: 'contacts', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#0D1F35', display: 'block' }}>
              <circle cx="16" cy="12" r="4" stroke="#378ADD" strokeWidth="1.5" fill="none"/>
              <path d="M8 26 C8 21.6 11.6 18 16 18 C20.4 18 24 21.6 24 26" stroke="#378ADD" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            </svg>
          )
        },
        {
          page: 'pipeline', href: '/demo/pipeline', label: 'Pipeline', requiredFeature: 'pipeline', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#0D2018', display: 'block' }}>
              <rect x="6" y="18" width="5" height="8" rx="1" fill="#1D9E75"/>
              <rect x="13.5" y="12" width="5" height="14" rx="1" fill="#1D9E75"/>
              <rect x="21" y="7" width="5" height="19" rx="1" fill="#1D9E75"/>
            </svg>
          )
        },
      ]
    },
    {
      section: 'Account',
      items: [
        {
          page: 'settings', label: 'Settings', requiredFeature: 'settings', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#1A1A1A', display: 'block' }}>
              <circle cx="16" cy="16" r="6" fill="#888780"/>
              <rect x="14.5" y="6" width="3" height="5" rx="0.5" fill="#888780"/>
              <rect x="14.5" y="21" width="3" height="5" rx="0.5" fill="#888780"/>
              <rect x="6" y="14.5" width="5" height="3" rx="0.5" fill="#888780"/>
              <rect x="21" y="14.5" width="5" height="3" rx="0.5" fill="#888780"/>
              <g transform="rotate(45, 16, 16)">
                <rect x="14.5" y="6" width="3" height="5" rx="0.5" fill="#888780"/>
                <rect x="14.5" y="21" width="3" height="5" rx="0.5" fill="#888780"/>
                <rect x="6" y="14.5" width="5" height="3" rx="0.5" fill="#888780"/>
                <rect x="21" y="14.5" width="5" height="3" rx="0.5" fill="#888780"/>
              </g>
              <circle cx="16" cy="16" r="2.5" fill="#1A1A1A"/>
            </svg>
          )
        },
        {
          page: 'billing', label: 'Billing', requiredFeature: 'billing', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#1A1A1A', display: 'block' }}>
              <rect x="8" y="5" width="16" height="22" rx="2" stroke="#888780" strokeWidth="1.5"/>
              <line x1="12" y1="12" x2="20" y2="12" stroke="#888780" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="12" y1="16" x2="20" y2="16" stroke="#888780" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="12" y1="20" x2="17" y2="20" stroke="#888780" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )
        },
      ]
    },
  ];

  const navItems = allNavItems.map(section => ({
    ...section,
    items: section.items.filter(item =>
      hasFeature(userRole === 'super_admin' ? 'super_admin' : userPlan, item.requiredFeature)
    ),
  })).filter(section => section.items.length > 0);

  const Toggle = ({ checked, onChange, label }) => (
    <label className={styles.toggle} aria-label={label}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className={styles.toggleTrack}></span>
    </label>
  );

  const phoneIcon12 = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 12.5 C7.5 13.8 8 15.5 9.7 16.3 C10.5 16.8 11.2 16.3 12.4 15.1 C13 14.5 13 13.7 12.4 13.1 L11.8 12.5 C11.6 12.3 11.6 11.9 11.8 11.7 L13.1 10.4 C13.3 10.2 13.7 10.2 13.9 10.4 L14.5 11 C15.1 11.6 15.9 11.6 16.5 11 L17.5 10 C18.1 9.4 18.1 8.6 17.5 8 C16.3 6.8 14.2 6.4 12.8 7 C11.4 7.6 8.5 11.2 8 12.5 Z" stroke="#378ADD" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
    </svg>
  );

  return (
    <div className={styles.dashboardLayout}>
      {/* DEMO BANNER */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: '#F5C400', color: '#000', textAlign: 'center', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', padding: '5px 0', pointerEvents: 'none' }}>
        DEMO MODE — ProCoat Columbus, Columbus OH — No real data or actions
      </div>

      {/* TOP BAR */}
      <header className={styles.topbar} role="banner" style={{ marginTop: 28 }}>
        <div className={styles.topbarBrand}>
          <Link href="/" className={styles.topbarLogo} aria-label="TheHypeBox — Back to site">THE<span>HYPE</span>BOX</Link>
          <span className={styles.topbarCc}>Command Center</span>
        </div>
        <div className={styles.topbarRight}>
          <div className={styles.topbarStatus}>
            <span className={`${styles.statusDot} ${styles.statusDotGreen}`}></span>
            All systems operational
          </div>
          <div className={styles.topbarUser}>
            <div className={styles.topbarAvatar} aria-hidden="true">{displayInitials}</div>
            <span>{displayName}</span>
            <span style={{ fontSize: 10, background: '#1D9E75', color: '#fff', borderRadius: 4, padding: '2px 6px', marginLeft: 8, fontWeight: 700, textTransform: 'uppercase' }}>
              {userPlan}
            </span>
          </div>
        </div>
      </header>

      {/* SIDEBAR */}
      <nav className={styles.sidebar} aria-label="Dashboard navigation" style={{ marginTop: 28 }}>
        {navItems.map(({ section, items }) => (
          <div key={section}>
            <span className={styles.sidebarSectionLabel}>{section}</span>
            <ul className={styles.sidebarNav}>
              {items.map(({ page, href, label, icon }) => (
                <li key={page}>
                  {href ? (
                    <Link href={href}>
                      <span className={styles.sidebarIcon} aria-hidden="true">{icon}</span>
                      {label}
                    </Link>
                  ) : (
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); setActivePage(page); }}
                      className={activePage === page ? styles.sidebarNavActive : ''}
                    >
                      <span className={styles.sidebarIcon} aria-hidden="true">{icon}</span>
                      {label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className={styles.sidebarFooter}>
          <Link href="/" className={styles.sidebarBack}>← Back to Site</Link>
        </div>
      </nav>

      {/* MAIN */}
      <main className={styles.main} id="main-content" style={{ marginTop: 28 }}>

        {/* === OVERVIEW === */}
        {activePage === 'overview' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Command Center</h1>
              <p>ProCoat Columbus — Columbus, OH</p>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Total Contacts</div><div className={styles.metricCardValue} style={{ color: '#378ADD' }}>{overviewData.stats.totalContacts}</div><div className={styles.metricCardDelta}>In your CRM</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Open Opportunities</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>{overviewData.stats.leadsActive}</div><div className={styles.metricCardDelta}>Active pipeline</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Pipeline Value</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>{'$' + overviewData.stats.pipelineValue.toLocaleString()}</div><div className={styles.metricCardDelta}>Open deals</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Completed Jobs</div><div className={styles.metricCardValue} style={{ color: '#EF9F27' }}>{overviewData.stats.completedJobs}</div><div className={styles.metricCardDelta}>Won / closed</div></div>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Agent Status</span><span className={styles.tag}>4 Active</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    <li className={styles.agentItem}>
                      <span className={styles.agentItemIcon} style={{ background: '#0D1F35' }} aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M8 12.5 C7.5 13.8 8 15.5 9.7 16.3 C10.5 16.8 11.2 16.3 12.4 15.1 C13 14.5 13 13.7 12.4 13.1 L11.8 12.5 C11.6 12.3 11.6 11.9 11.8 11.7 L13.1 10.4 C13.3 10.2 13.7 10.2 13.9 10.4 L14.5 11 C15.1 11.6 15.9 11.6 16.5 11 L17.5 10 C18.1 9.4 18.1 8.6 17.5 8 C16.3 6.8 14.2 6.4 12.8 7 C11.4 7.6 8.5 11.2 8 12.5 Z" stroke="#378ADD" strokeWidth="1.5" fill="none" strokeLinejoin="round"/></svg></span>
                      <div className={styles.agentItemInfo}><div className={styles.agentItemName}>Phone Agent</div><div className={styles.agentItemSub}>{overviewData.stats.callsThisMonth} calls this month</div></div>
                      <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${agentToggles.phone ? styles.statusDotGreen : ''}`}></span><span>{agentToggles.phone ? 'Active' : 'Paused'}</span></div>
                      <Toggle checked={agentToggles.phone} onChange={() => handleAgentToggle('phone', 'Phone Agent')} label="Toggle Phone Agent" />
                    </li>
                    <li className={styles.agentItem}>
                      <span className={styles.agentItemIcon} style={{ background: '#0D2018' }} aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="15" rx="2" stroke="#1D9E75" strokeWidth="1.5" fill="none"/><line x1="3" y1="10" x2="21" y2="10" stroke="#1D9E75" strokeWidth="1.5"/><line x1="8" y1="5" x2="8" y2="3" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="5" x2="16" y2="3" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="14" r="1.1" fill="#1D9E75"/><circle cx="12" cy="14" r="1.1" fill="#1D9E75"/><circle cx="16" cy="14" r="1.1" fill="#1D9E75"/></svg></span>
                      <div className={styles.agentItemInfo}><div className={styles.agentItemName}>Scheduling Agent</div><div className={styles.agentItemSub}>{overviewData.stats.apptThisMonth} appointments this month</div></div>
                      <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${agentToggles.scheduling ? styles.statusDotGreen : ''}`}></span><span>{agentToggles.scheduling ? 'Active' : 'Paused'}</span></div>
                      <Toggle checked={agentToggles.scheduling} onChange={() => handleAgentToggle('scheduling', 'Scheduling Agent')} label="Toggle Scheduling Agent" />
                    </li>
                    <li className={styles.agentItem}>
                      <span className={styles.agentItemIcon} style={{ background: '#1A0D00' }} aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><line x1="4" y1="3.5" x2="4" y2="19.5" stroke="#EF9F27" strokeWidth="1.5" strokeLinecap="round"/><line x1="4" y1="19.5" x2="20" y2="19.5" stroke="#EF9F27" strokeWidth="1.5" strokeLinecap="round"/><rect x="5.5" y="15" width="3.5" height="4.5" fill="#EF9F27"/><rect x="10.5" y="9" width="3.5" height="10.5" fill="#EF9F27"/><rect x="15.5" y="12" width="3.5" height="7.5" fill="#EF9F27"/></svg></span>
                      <div className={styles.agentItemInfo}><div className={styles.agentItemName}>Accounting Agent</div><div className={styles.agentItemSub}>Tracking invoices & payments</div></div>
                      <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${agentToggles.accounting ? styles.statusDotYellow : ''}`}></span><span>{agentToggles.accounting ? 'Attention' : 'Paused'}</span></div>
                      <Toggle checked={agentToggles.accounting} onChange={() => handleAgentToggle('accounting', 'Accounting Agent')} label="Toggle Accounting Agent" />
                    </li>
                    <li className={styles.agentItem}>
                      <span className={styles.agentItemIcon} style={{ background: '#160D2A' }} aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="2.8" stroke="#7B2FFF" strokeWidth="1.5" fill="none"/><path d="M3.5 19.5 C3.5 15.9 6 13 9 13 C12 13 14.5 15.9 14.5 19.5" stroke="#7B2FFF" strokeWidth="1.5" fill="none" strokeLinecap="round"/><circle cx="17.5" cy="7.5" r="2.2" stroke="#7B2FFF" strokeWidth="1.5" fill="none" opacity="0.65"/><path d="M14 19 C14 16 15.5 13.5 17.5 13.5 C19.5 13.5 21 16 21 19" stroke="#7B2FFF" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.65"/></svg></span>
                      <div className={styles.agentItemInfo}><div className={styles.agentItemName}>CRM Agent</div><div className={styles.agentItemSub}>{overviewData.stats.leadsActive} active leads</div></div>
                      <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${agentToggles.crm ? styles.statusDotGreen : ''}`}></span><span>{agentToggles.crm ? 'Active' : 'Paused'}</span></div>
                      <Toggle checked={agentToggles.crm} onChange={() => handleAgentToggle('crm', 'CRM Agent')} label="Toggle CRM Agent" />
                    </li>
                  </ul>
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Live Activity</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.activityFeed}>
                    {activityItems.map((item, i) => (
                      <li key={i} className={styles.activityItem}>
                        <span className={`${styles.activityItemDot} ${getDotClass(item.type)}`}></span>
                        <div><div className={styles.activityItemText}>{item.text}</div><div className={styles.activityItemTime}>{item.time}</div></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <div className={`${styles.panel} ${styles.panelFull}`}>
              <div className={styles.panelHeader}><span className={styles.panelTitle}>Recent Calls</span></div>
              <div className={styles.panelBody}>
                <table className={styles.callsTable}>
                  <thead><tr><th>Caller</th><th>Time</th><th>Duration</th><th>Outcome</th><th>Agent</th></tr></thead>
                  <tbody>
                    {DEMO_CALLS.slice(0, 5).map((call) => (
                      <tr key={call.call_id}>
                        <td>{call.from_number}</td>
                        <td>{new Date(call.start_timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</td>
                        <td>{Math.round(call.duration_ms / 1000)}s</td>
                        <td><span style={{ color: '#1D9E75', fontSize: 12 }}>● Answered</span></td>
                        <td style={{ color: '#888', fontSize: 12 }}>ProCoat AI Agent</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* === PHONE AGENT === */}
        {activePage === 'phone' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Phone Agent — ProCoat AI</h1>
              <p>Handles every inbound call — 24/7</p>
            </div>

            <div className={styles.panel} style={{ marginBottom: 24 }}>
              <div className={styles.panelBody}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#0D1F35', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🤖</div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>ProCoat Columbus AI Agent</div>
                    <div style={{ color: '#aaa', fontSize: 13 }}>agent_procoat_columbus_demo</div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 16 }}>
                      <span style={{ color: '#378ADD', fontSize: 13 }}>📞 (614) 555-0199</span>
                      <span style={{ color: '#1D9E75', fontSize: 13 }}>● Live & Answering</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Total Calls</div><div className={styles.metricCardValue} style={{ color: '#378ADD' }}>{calls.length}</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>This period</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Avg Duration</div><div className={styles.metricCardValue}>{Math.round(calls.reduce((a, c) => a + c.duration_ms, 0) / calls.length / 1000)}s</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>per call</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Successful</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>{calls.filter(c => c.scrubbed_call_analysis?.call_successful).length}</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ completed</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Positive Sentiment</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>{calls.filter(c => c.scrubbed_call_analysis?.user_sentiment === 'Positive').length}</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>happy callers</div></div>
            </div>

            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Recent Calls</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {calls.slice(0, 7).map((call) => (
                      <li key={call.call_id} className={styles.agentItem}>
                        <span className={styles.agentItemIcon} style={{ background: '#0D1F35' }} aria-hidden="true">{phoneIcon12}</span>
                        <div className={styles.agentItemInfo}>
                          <div className={styles.agentItemName}>{call.from_number}</div>
                          <div className={styles.agentItemSub}>{call.scrubbed_call_analysis?.call_summary?.slice(0, 80)}...</div>
                          <div className={styles.agentItemSub}>{new Date(call.start_timestamp).toLocaleString()}</div>
                        </div>
                        <div className={styles.agentItemStatus}>
                          <span className={`${styles.statusDot} ${call.scrubbed_call_analysis?.user_sentiment === 'Positive' ? styles.statusDotGreen : styles.statusDotYellow}`}></span>
                          <span>{Math.round(call.duration_ms / 1000)}s</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <span className={styles.panelTitle}>Agent — Live Controls</span>
                  {agentUpdateMsg && <span style={{ fontSize: 12, color: '#1D9E75' }}>{agentUpdateMsg}</span>}
                </div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    <li className={styles.agentItem}>
                      <div className={styles.agentItemInfo}>
                        <div className={styles.agentItemName}>Agent Active</div>
                        <div className={styles.agentItemSub}>Toggle ProCoat AI on or off</div>
                      </div>
                      <Toggle checked={agentDetails?.is_published ?? true} onChange={updateAgentSetting} label="Toggle Agent Active" />
                    </li>
                    <li className={styles.agentItem}>
                      <div className={styles.agentItemInfo}>
                        <div className={styles.agentItemName}>After-Hours Mode</div>
                        <div className={styles.agentItemSub}>Take messages when business is closed</div>
                      </div>
                      <Toggle checked={toggleStates['after-hours']} onChange={() => handleToggle('after-hours')} label="Toggle After Hours" />
                    </li>
                    <li className={styles.agentItem}>
                      <div className={styles.agentItemInfo}>
                        <div className={styles.agentItemName}>Call Summaries</div>
                        <div className={styles.agentItemSub}>Email recap after each call</div>
                      </div>
                      <Toggle checked={toggleStates['call-summaries']} onChange={() => handleToggle('call-summaries')} label="Toggle Call Summaries" />
                    </li>
                    <li className={styles.agentItem}>
                      <div className={styles.agentItemInfo}>
                        <div className={styles.agentItemName}>Transfer Escalations</div>
                        <div className={styles.agentItemSub}>Forward urgent calls to owner</div>
                      </div>
                      <Toggle checked={toggleStates['transfer-escalations']} onChange={() => handleToggle('transfer-escalations')} label="Toggle Transfer Escalations" />
                    </li>
                  </ul>
                  <div style={{ marginTop: 16, padding: 12, background: '#1a1a1a', borderRadius: 8, border: '1px solid #333' }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>AGENT DATA</div>
                    {[
                      ['Agent Name', agentDetails.agent_name],
                      ['Voice', 'Rachel (ElevenLabs)'],
                      ['Language', 'en-US'],
                      ['Last Updated', new Date(agentDetails.last_modification_timestamp).toLocaleDateString()],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #222' }}>
                        <span style={{ fontSize: 12, color: '#888' }}>{label}</span>
                        <span style={{ fontSize: 12, color: '#ccc' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* === SCHEDULING === */}
        {activePage === 'scheduling' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Scheduling</h1>
              <p>Book and manage appointments</p>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Total Appointments</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>{appointments.length}</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ all time</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>This Month</div><div className={styles.metricCardValue} style={{ color: '#378ADD' }}>{appointments.filter(a => new Date(a.date).getMonth() === today.getMonth()).length}</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— this month</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Today</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>{appointments.filter(a => a.date === `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`).length}</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— today</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Selected Day</div><div className={styles.metricCardValue}>{selectedDay ? apptCountForDay(selectedDay) : '—'}</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— appointments</div></div>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <span className={styles.panelTitle}>{MONTHS[calMonth]} {calYear}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); } else setCalMonth(m => m-1); }} style={{ background: '#222', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontSize: 16 }}>‹</button>
                    <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); } else setCalMonth(m => m+1); }} style={{ background: '#222', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontSize: 16 }}>›</button>
                  </div>
                </div>
                <div className={styles.panelBody}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
                    {CAL_DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, color: '#666', padding: '4px 0', fontWeight: 600 }}>{d}</div>)}
                    {getCalCells().map((day, i) => (
                      <div key={i} onClick={() => day && setSelectedDay(day)} style={{ textAlign: 'center', padding: '8px 2px', borderRadius: 6, fontSize: 13, cursor: day ? 'pointer' : 'default', background: day === selectedDay ? '#F5C400' : 'transparent', color: day === selectedDay ? '#000' : day ? '#fff' : 'transparent', border: day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear() && day !== selectedDay ? '1px solid #F5C400' : '1px solid transparent', position: 'relative', fontWeight: day === selectedDay ? 700 : 400 }}>
                        {day || ''}
                        {day && apptCountForDay(day) > 0 && (
                          <div style={{ width: 5, height: 5, background: day === selectedDay ? '#000' : '#F5C400', borderRadius: '50%', margin: '2px auto 0' }} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <span className={styles.panelTitle}>{selectedDay ? `${MONTHS[calMonth]} ${selectedDay} — Appointments` : 'Select a Day'}</span>
                </div>
                <div className={styles.panelBody}>
                  {!selectedDay && <p style={{ color: '#aaa', padding: '12px 0' }}>Click a day on the calendar to view or add appointments.</p>}
                  {selectedDay && (
                    <>
                      {getSelectedDateAppts().length === 0 && <p style={{ color: '#aaa', marginBottom: 16, fontSize: 13 }}>No appointments this day yet.</p>}
                      <ul className={styles.agentList} style={{ marginBottom: 16 }}>
                        {getSelectedDateAppts().map((a, i) => (
                          <li key={i} className={styles.agentItem}>
                            <div className={styles.agentItemInfo}>
                              <div className={styles.agentItemName}>{a.title}</div>
                              <div className={styles.agentItemSub}>{a.time}{a.notes ? ' · ' + a.notes : ''}</div>
                            </div>
                            <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${styles.statusDotGreen}`}></span><span>Booked</span></div>
                          </li>
                        ))}
                      </ul>
                      <div style={{ borderTop: '1px solid #222', paddingTop: 16 }}>
                        <div style={{ fontSize: 12, color: '#888', marginBottom: 12, fontWeight: 600 }}>ADD APPOINTMENT</div>
                        {[['Title', 'title', 'text', 'e.g. Garage floor estimate'], ['Notes', 'notes', 'text', 'Optional notes']].map(([label, field, type, placeholder]) => (
                          <div key={field} style={{ marginBottom: 10 }}>
                            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>{label}</label>
                            <input type={type} placeholder={placeholder} value={apptForm[field]} onChange={e => setApptForm(f => ({ ...f, [field]: e.target.value }))} style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box' }} />
                          </div>
                        ))}
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>Time</label>
                          <input type="time" value={apptForm.time} onChange={e => setApptForm(f => ({ ...f, time: e.target.value }))} style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box' }} />
                        </div>
                        <button onClick={saveAppointment} style={{ background: '#1D9E75', border: 'none', color: '#fff', borderRadius: 6, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                          Save Appointment
                        </button>
                        {apptMsg && <div style={{ marginTop: 10, color: '#1D9E75', fontSize: 13 }}>{apptMsg}</div>}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* === MISSED CALL TEXT BACK === */}
        {activePage === 'missed-call' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Missed Call Text Back</h1>
              <p>Every missed call gets an automatic text within 60 seconds</p>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Texts Sent Today</div><div className={styles.metricCardValue} style={{ color: '#ff6b6b' }}>{missedCalls.filter(c => new Date(c.timestamp).toDateString() === new Date().toDateString()).length}</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ live</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Total Sent</div><div className={styles.metricCardValue} style={{ color: '#378ADD' }}>{missedCalls.length}</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— all time</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Text Sent</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>{missedCalls.filter(c => c.text_sent).length}</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ delivered</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Avg Response</div><div className={styles.metricCardValue}>60s</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— instant</div></div>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Recent Missed Calls</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {missedCalls.map((call) => (
                      <li key={call.id} className={styles.agentItem}>
                        <div className={styles.agentItemInfo}>
                          <div className={styles.agentItemName}>{call.from_number || 'Unknown'}</div>
                          <div className={styles.agentItemSub}>{new Date(call.timestamp).toLocaleString()}</div>
                        </div>
                        <div className={styles.agentItemStatus}>
                          <span className={`${styles.statusDot} ${call.text_sent ? styles.statusDotGreen : styles.statusDotRed}`}></span>
                          <span>{call.text_sent ? 'Text sent' : 'Pending'}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Settings</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['Auto Text Back', 'Send text within 60s of missed call', 'auto-text-back'], ['After-Hours Only', 'Only text outside business hours', 'after-hours-only'], ['Include Booking Link', 'Add scheduling link to text', 'include-booking-link']].map(([name, sub, key]) => (
                      <li key={key} className={styles.agentItem}>
                        <div className={styles.agentItemInfo}><div className={styles.agentItemName}>{name}</div><div className={styles.agentItemSub}>{sub}</div></div>
                        <Toggle checked={toggleStates[key]} onChange={() => handleToggle(key)} label={`Toggle ${name}`} />
                      </li>
                    ))}
                  </ul>
                  <div style={{ marginTop: 16, padding: 12, background: '#1a1a1a', borderRadius: 8, border: '1px solid #333' }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>DEFAULT MESSAGE</div>
                    <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.5 }}>"Hey! Sorry we missed your call at ProCoat Columbus. We&apos;d love to help — reply here or book online at procoatcolumbus.com!"</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* === REVIEW REQUEST AGENT === */}
        {activePage === 'review-request' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Review Request Agent</h1>
              <p>Automatically request Google reviews after every service</p>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Requests Sent</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>{reviewRequests.length}</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ all time</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Sent Today</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>{reviewRequests.filter(r => new Date(r.sent_at).toDateString() === new Date().toDateString()).length}</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ today</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Avg Rating</div><div className={styles.metricCardValue} style={{ color: '#F5C400', display: 'flex', alignItems: 'center', gap: 6 }}>4.8 <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 7 L17.8 12.5 H23.5 L18.9 15.8 L20.7 21.3 L16 18 L11.3 21.3 L13.1 15.8 L8.5 12.5 H14.2 Z" stroke="#F5C400" strokeWidth="1.5" fill="#F5C400" strokeLinejoin="round"/></svg></div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ rising</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Conversion</div><div className={styles.metricCardValue}>38%</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— industry avg</div></div>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Send Review Request</span></div>
                <div className={styles.panelBody}>
                  {[['Customer Name', 'customer_name', 'text', 'Marcus W.'], ['Phone Number', 'phone_number', 'tel', '(614) 555-0183'], ['Business Name', 'business_name', 'text', 'ProCoat Columbus']].map(([label, field, type, placeholder]) => (
                    <div key={field} style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>{label}</label>
                      <input type={type} placeholder={placeholder} value={reviewForm[field]} onChange={e => setReviewForm(f => ({ ...f, [field]: e.target.value }))} style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box' }} />
                    </div>
                  ))}
                  <button onClick={triggerReviewRequest} style={{ background: '#F5C400', border: 'none', color: '#000', borderRadius: 6, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}>Send Review Request</button>
                  {automationMsg && activePage === 'review-request' && <div style={{ marginTop: 12, color: '#1D9E75' }}>{automationMsg}</div>}
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Recent Requests</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {reviewRequests.map((r) => (
                      <li key={r.id} className={styles.agentItem}>
                        <div className={styles.agentItemInfo}>
                          <div className={styles.agentItemName}>{r.customer_name}</div>
                          <div className={styles.agentItemSub}>{r.phone_number} · {new Date(r.sent_at).toLocaleString()}</div>
                        </div>
                        <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${styles.statusDotGreen}`}></span><span>Sent</span></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* === REACTIVATION AGENT === */}
        {activePage === 'reactivation' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Reactivation Agent</h1>
              <p>Win back customers who haven&apos;t visited in 90+ days</p>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Campaigns Sent</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>{reactivations.length}</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ all time</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Sent Today</div><div className={styles.metricCardValue} style={{ color: '#378ADD' }}>{reactivations.filter(r => new Date(r.sent_at).toDateString() === new Date().toDateString()).length}</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— today</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Win-Back Rate</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>28%</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ above avg</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Revenue Recovered</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>$3,240</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ this month</div></div>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Send Reactivation</span></div>
                <div className={styles.panelBody}>
                  {[['Customer Name', 'customer_name', 'text', 'Janet S.'], ['Phone Number', 'phone_number', 'tel', '(614) 555-0471'], ['Business Name', 'business_name', 'text', 'ProCoat Columbus'], ['Offer', 'offer', 'text', '$150 off your next coating project']].map(([label, field, type, placeholder]) => (
                    <div key={field} style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>{label}</label>
                      <input type={type} placeholder={placeholder} value={reactivationForm[field]} onChange={e => setReactivationForm(f => ({ ...f, [field]: e.target.value }))} style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box' }} />
                    </div>
                  ))}
                  <button onClick={triggerReactivation} style={{ background: '#1D9E75', border: 'none', color: '#fff', borderRadius: 6, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}>Send Reactivation</button>
                  {automationMsg && activePage === 'reactivation' && <div style={{ marginTop: 12, color: '#1D9E75' }}>{automationMsg}</div>}
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Recent Campaigns</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {reactivations.map((r) => (
                      <li key={r.id} className={styles.agentItem}>
                        <div className={styles.agentItemInfo}>
                          <div className={styles.agentItemName}>{r.customer_name}</div>
                          <div className={styles.agentItemSub}>{r.phone_number} · {new Date(r.sent_at).toLocaleString()}</div>
                        </div>
                        <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${styles.statusDotGreen}`}></span><span>Sent</span></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* === LEAD GENERATION === */}
        {activePage === 'lead-gen' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Lead Generation</h1>
              <p>Capture and qualify new leads automatically 24/7</p>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Leads Nurtured</div><div className={styles.metricCardValue} style={{ color: '#7B2FFF' }}>{leadNurtures.length}</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ all time</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Sent Today</div><div className={styles.metricCardValue} style={{ color: '#378ADD' }}>{leadNurtures.filter(l => new Date(l.sent_at).toDateString() === new Date().toDateString()).length}</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— today</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Step 1 Sent</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>{leadNurtures.filter(l => l.step === 1).length}</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— initial</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Step 3 Sent</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>{leadNurtures.filter(l => l.step === 3).length}</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— final</div></div>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Send Lead Nurture</span></div>
                <div className={styles.panelBody}>
                  {[['Customer Name', 'customer_name', 'text', 'Tyler H.'], ['Phone Number', 'phone_number', 'tel', '(614) 555-0742'], ['Business Name', 'business_name', 'text', 'ProCoat Columbus']].map(([label, field, type, placeholder]) => (
                    <div key={field} style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>{label}</label>
                      <input type={type} placeholder={placeholder} value={leadForm[field]} onChange={e => setLeadForm(f => ({ ...f, [field]: e.target.value }))} style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box' }} />
                    </div>
                  ))}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>Nurture Step</label>
                    <select value={leadForm.step} onChange={e => setLeadForm(f => ({ ...f, step: e.target.value }))} style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '8px 12px', fontSize: 14 }}>
                      <option value={1}>Step 1 — Initial outreach</option>
                      <option value={2}>Step 2 — Follow up with offer</option>
                      <option value={3}>Step 3 — Final follow up</option>
                    </select>
                  </div>
                  <button onClick={triggerLeadNurture} style={{ background: '#7B2FFF', border: 'none', color: '#fff', borderRadius: 6, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}>Send Lead Nurture</button>
                  {automationMsg && activePage === 'lead-gen' && <div style={{ marginTop: 12, color: '#1D9E75' }}>{automationMsg}</div>}
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Recent Leads</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {leadNurtures.map((l) => (
                      <li key={l.id} className={styles.agentItem}>
                        <div className={styles.agentItemInfo}>
                          <div className={styles.agentItemName}>{l.customer_name}</div>
                          <div className={styles.agentItemSub}>Step {l.step} · {new Date(l.sent_at).toLocaleString()}</div>
                        </div>
                        <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${styles.statusDotGreen}`}></span><span>Sent</span></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* === SETTINGS === */}
        {activePage === 'settings' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Settings</h1>
              <p>Manage your account — {displayEmail}</p>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Business Profile</span></div>
                <div className={styles.panelBody}>
                  {[
                    ['Business Name', 'business_name', 'text', 'ProCoat Columbus'],
                    ['Phone Number', 'phone', 'tel', '(614) 555-0182'],
                    ['Business Hours', 'hours', 'text', 'Mon–Sat 7am–7pm'],
                  ].map(([label, field, type, placeholder]) => (
                    <div key={field} style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>{label}</label>
                      <input type={type} placeholder={placeholder} value={settingsForm[field] || ''} onChange={e => setSettingsForm(f => ({ ...f, [field]: e.target.value }))} style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box' }} />
                    </div>
                  ))}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>Email</label>
                    <input type="email" value={displayEmail} disabled style={{ width: '100%', background: '#111', border: '1px solid #222', borderRadius: 6, color: '#666', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                  <button onClick={saveSettings} style={{ background: '#F5C400', border: 'none', color: '#000', borderRadius: 6, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}>Save Settings</button>
                  {settingsMsg && <div style={{ marginTop: 12, color: '#1D9E75', fontSize: 13 }}>{settingsMsg}</div>}
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Notifications</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[
                      ['Daily Summary Email', 'Recap sent each morning', 'daily-summary'],
                      ['Alert on Urgent Calls', 'Text you for escalations', 'urgent-calls'],
                      ['New Customer Alert', 'Notify when first-time customer calls', 'new-customer-alert']
                    ].map(([name, sub, key]) => (
                      <li key={name} className={styles.agentItem}>
                        <div className={styles.agentItemInfo}><div className={styles.agentItemName}>{name}</div><div className={styles.agentItemSub}>{sub}</div></div>
                        <Toggle checked={toggleStates[key]} onChange={() => handleToggle(key)} label={`Toggle ${name}`} />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* === BILLING === */}
        {activePage === 'billing' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Billing</h1>
              <p>Your plan and payment details</p>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Current Plan</div><div className={styles.metricCardValue} style={{ color: '#F5C400', textTransform: 'capitalize' }}>{billingPlan}</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ active</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Monthly Cost</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>${billingPlan === 'pro' ? '797' : billingPlan === 'growth' ? '497' : '297'}</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— per month</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Setup Fee</div><div className={styles.metricCardValue}>$495</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— one time</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Status</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>Active</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ all systems go</div></div>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Plan Comparison</span></div>
                <div className={styles.panelBody}>
                  {[
                    { name: 'Starter', key: 'starter', price: '$297/mo', color: '#378ADD', features: ['Phone Agent (Alex)', 'Missed Call Text Back', 'Appointment Reminders', 'Review Requests', 'Dashboard Access'] },
                    { name: 'Growth', key: 'growth', price: '$497/mo', color: '#1D9E75', features: ['Everything in Starter', 'Reactivation Agent', 'Post-Service Follow-Up', 'Lead Nurture (3-step)', 'Birthday Agent', 'Live Chat Agent'] },
                    { name: 'Pro', key: 'pro', price: '$797/mo', color: '#F5C400', features: ['Everything in Growth', 'Outbound Sales Agent', 'Social Media Agent', 'Review Monitor', 'Invoice Follow-Up', 'Monthly Strategy Call'] },
                  ].map((plan) => (
                    <div key={plan.key} style={{ marginBottom: 20, padding: 16, background: billingPlan === plan.key ? '#1a1a1a' : '#111', borderRadius: 8, border: `1px solid ${billingPlan === plan.key ? plan.color : '#222'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 16, color: plan.color }}>{plan.name}</div>
                          <div style={{ color: '#aaa', fontSize: 13 }}>{plan.price}</div>
                        </div>
                        {billingPlan === plan.key ? (
                          <span style={{ background: plan.color, color: '#000', borderRadius: 4, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>Current Plan</span>
                        ) : (
                          <button onClick={() => upgradePlan(plan.key)} style={{ background: plan.color, border: 'none', color: '#000', borderRadius: 4, padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            {plan.key === 'starter' ? 'Downgrade' : 'Upgrade'}
                          </button>
                        )}
                      </div>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {plan.features.map(f => <li key={f} style={{ fontSize: 13, color: '#ccc', padding: '3px 0' }}>✓ {f}</li>)}
                      </ul>
                    </div>
                  ))}
                  {billingMsg && <div style={{ marginTop: 12, color: '#1D9E75' }}>{billingMsg}</div>}
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Invoice History</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['April 2026', '$497', 'growth'], ['March 2026', '$497', 'growth'], ['February 2026', '$297', 'starter'], ['January 2026', '$297', 'starter']].map(([month, amount, plan]) => (
                      <li key={month} className={styles.agentItem}>
                        <span className={styles.agentItemIcon} style={{ background: '#1A1A1A' }} aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="18" rx="2" stroke="#888780" strokeWidth="1.5"/><line x1="8" y1="8" x2="16" y2="8" stroke="#888780" strokeWidth="1.4" strokeLinecap="round"/><line x1="8" y1="12" x2="16" y2="12" stroke="#888780" strokeWidth="1.4" strokeLinecap="round"/><line x1="8" y1="16" x2="12" y2="16" stroke="#888780" strokeWidth="1.4" strokeLinecap="round"/></svg>
                        </span>
                        <div className={styles.agentItemInfo}>
                          <div className={styles.agentItemName}>{month}</div>
                          <div className={styles.agentItemSub}>{amount} — {plan}</div>
                        </div>
                        <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${styles.statusDotGreen}`}></span><span>Paid</span></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}

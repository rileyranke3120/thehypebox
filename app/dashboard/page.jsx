'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import styles from '@/styles/dashboard.module.css';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { hasFeature, getPlanPrice } from '@/lib/planFeatures';
import { logout } from '@/app/actions/auth';

// Read-only anon client — used only for reads (profile, automation logs, missed calls)
// All writes go through authenticated API routes
let _supabase = null;
function getSupabase() {
  if (!_supabase) _supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  return _supabase;
}
const supabase = { from: (...a) => getSupabase().from(...a) };


function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function Msg({ text }) {
  if (!text) return null;
  const ok = !text.startsWith('❌');
  const clean = text.replace(/^[\u2705\u274C]\s*/, '');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 13, color: ok ? '#1D9E75' : '#ff6b6b' }}>
      {ok ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M5 8.5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )}
      {clean}
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [activePage, setActivePage] = useState('overview');

  const [calls, setCalls] = useState([]);
  const [callsLoading, setCallsLoading] = useState(false);

  // Automation toggle states
  const [automationToggles, setAutomationToggles] = useState({
    missedCallAutoText: true,
    missedCallCustomMsg: false,
    missedCallWindow: true,
    reviewAutoRequest: true,
    reviewTiming: true,
    reviewPlatformGoogle: true,
    reactivationAuto: true,
    reactivationThreshold: true,
    reactivationSMS: true,
    leadAutoScrape: false,
    leadTargetCity: true,
    leadBusinessType: true,
  });

  // ── Retell / Phone tab ──────────────────────────────────────
  const [retellCalls, setRetellCalls] = useState([]);
  const [retellLoading, setRetellLoading] = useState(false);

  useEffect(() => {
    if (activePage !== 'phone') return;
    setRetellLoading(true);
    fetch('/api/retell/calls')
      .then((r) => r.json())
      .then((d) => setRetellCalls(d.calls || []))
      .catch(() => {})
      .finally(() => setRetellLoading(false));
  }, [activePage]);

  const formatRetellDuration = (ms) => {
    if (!ms || ms <= 0) return '—';
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  };

  const retellOutcomeClass = (outcome) => {
    if (outcome === 'Resolved') return styles.outcomeResolved;
    if (outcome === 'Escalated') return styles.outcomeEscalated;
    if (outcome === 'Missed' || outcome === 'Voicemail') return styles.outcomeMissed;
    return styles.outcomeBooked;
  };

  const retellMetrics = (() => {
    const total = retellCalls.length;
    if (total === 0) return { today: 0, avgDur: '—', resolvedPct: '—', missed: 0 };
    const todayStr = new Date().toDateString();
    const todayCalls = retellCalls.filter(
      (c) => c.time !== '—' && new Date().toDateString() === todayStr
    );
    const missed = retellCalls.filter((c) => c.outcome === 'Missed' || c.outcome === 'Voicemail').length;
    const resolved = retellCalls.filter((c) => c.outcome === 'Resolved').length;
    return {
      today: total,
      avgDur: '—',
      resolvedPct: `${Math.round((resolved / total) * 100)}%`,
      missed,
    };
  })();

  // ── Scheduling / Calendar tab ────────────────────────────────
  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const [calWeekStart, setCalWeekStart] = useState(() => getWeekStart(new Date()));
  const [appointments, setAppointments] = useState([]);
  const [showApptModal, setShowApptModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [apptForm, setApptForm] = useState({ customer_name: '', service: '', time: '', phone: '' });
  const [apptSaving, setApptSaving] = useState(false);

  const fetchAppointments = async (weekStart) => {
    if (!session?.user?.email) return;
    try {
      const { supabase } = await import('@/lib/supabase');
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const { data } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_email', session.user.email)
        .gte('appointment_date', weekStart.toISOString().split('T')[0])
        .lte('appointment_date', weekEnd.toISOString().split('T')[0])
        .order('appointment_time', { ascending: true });
      if (data) setAppointments(data);
    } catch {
      // Supabase not yet configured
    }
  };

  useEffect(() => {
    if (activePage !== 'scheduling') return;
    fetchAppointments(calWeekStart);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage, calWeekStart, session]);

  const handleSaveAppt = async () => {
    if (!apptForm.customer_name || !apptForm.service || !apptForm.time) return;
    setApptSaving(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase.from('appointments').insert({
        user_email: session?.user?.email,
        customer_name: apptForm.customer_name,
        service: apptForm.service,
        appointment_date: selectedDate.toISOString().split('T')[0],
        appointment_time: apptForm.time,
        phone: apptForm.phone,
      });
      setShowApptModal(false);
      setApptForm({ customer_name: '', service: '', time: '', phone: '' });
      fetchAppointments(calWeekStart);
    } catch {
      // handle silently
    } finally {
      setApptSaving(false);
    }
  };

  const calWeekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(calWeekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const apptsByDate = (date) => {
    const key = date.toISOString().split('T')[0];
    return appointments.filter((a) => a.appointment_date === key);
  };

  const calWeekLabel = (() => {
    const s = calWeekStart;
    const e = new Date(s); e.setDate(e.getDate() + 6);
    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(s)} — ${fmt(e)}, ${e.getFullYear()}`;
  })();

  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const todayStr = new Date().toISOString().split('T')[0];

  // ── Billing tab ───────────────────────────────────────────────
  const [billingData, setBillingData] = useState({ plan: null, createdAt: null });

  useEffect(() => {
    if (activePage !== 'billing' || !session?.user?.email) return;
    (async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data } = await supabase
          .from('users')
          .select('plan, created_at')
          .eq('email', session.user.email)
          .single();
        if (data) setBillingData({ plan: data.plan, createdAt: data.created_at });
      } catch {
        // Supabase not yet configured
      }
    })();
  }, [activePage, session]);

  const nextBillingDate = (() => {
    if (!billingData.createdAt) return 'April 1, 2026';
    const d = new Date(billingData.createdAt);
    const now = new Date();
    while (d <= now) d.setDate(d.getDate() + 30);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  })();

  const planName = billingData.plan || 'Growth';
  const planPrice = planName === 'Starter' ? '$97' : planName === 'Pro' ? '$497' : '$297';

  // ── Settings state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    businessHours: '',
    website: '',
  });

  // Sync session data into profile form
  useEffect(() => {
    if (session?.user) {
      setProfileData((prev) => ({
        ...prev,
        name: prev.name || session.user.name || '',
        email: session.user.email || '',
      }));
    }
  }, [session]);

  // Fetch full profile from Supabase when settings tab opens
  useEffect(() => {
    if (activePage !== 'settings' || !session?.user?.email) return;
    (async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data } = await supabase
          .from('users')
          .select('name, phone, address, business_hours, website')
          .eq('email', session.user.email)
          .single();
        if (data) {
          setProfileData({
            name: data.name || session.user.name || '',
            email: session.user.email || '',
            phone: data.phone || '',
            address: data.address || '',
            businessHours: data.business_hours || '',
            website: data.website || '',
          });
        }
      } catch {
        // Supabase not yet configured — proceed with session data only
      }
    })();
  }, [activePage, session]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      await supabase
        .from('users')
        .update({
          name: profileData.name,
          phone: profileData.phone,
          address: profileData.address,
          business_hours: profileData.businessHours,
          website: profileData.website,
        })
        .eq('email', session?.user?.email);
      setIsEditing(false);
    } catch {
      // Handle silently — user can retry
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (activePage !== 'phone') return;
    setCallsLoading(true);
    fetch('/api/retell/calls')
      .then((r) => r.json())
      .then((data) => setCalls(data.calls || []))
      .catch(() => setCalls([]))
      .finally(() => setCallsLoading(false));
  }, [activePage]);
  const [activityItems, setActivityItems] = useState([]);
  const [overviewData, setOverviewData] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const [agentToggles, setAgentToggles] = useState({
    phone: true, scheduling: true, accounting: true, crm: true,
  });

  const [userRole, setUserRole] = useState('client');
  const [userPlan, setUserPlan] = useState('starter');
  const [clientProfile, setClientProfile] = useState(null);
  const [onboardingComplete, setOnboardingComplete] = useState(true);

  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [addClientForm, setAddClientForm] = useState({ name: '', email: '', business_name: '', phone: '', plan: 'starter' });
  const [addClientMsg, setAddClientMsg] = useState('');
  const [addClientSaving, setAddClientSaving] = useState(false);
  const [automationLogs, setAutomationLogs] = useState([]);
  const [triggerForm, setTriggerForm] = useState({ automation: 'review-request', phone_number: '', customer_name: '' });
  const [triggerMsg, setTriggerMsg] = useState('');
  const [settingsForm, setSettingsForm] = useState({ business_name: '', phone: '', hours: '', avatar_url: '', google_review_url: '' });
  const [settingsSaving, setSettingsSaving] = useState(false);
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

  const [missedCalls, setMissedCalls] = useState([]);
  const [reviewRequests, setReviewRequests] = useState([]);
  const [reactivations, setReactivations] = useState([]);
  const [leadNurtures, setLeadNurtures] = useState([]);
  const [reviewForm, setReviewForm] = useState({ phone_number: '', customer_name: '', business_name: '' });
  const [reactivationForm, setReactivationForm] = useState({ phone_number: '', customer_name: '', business_name: '', offer: '10% off your next visit' });
  const [leadForm, setLeadForm] = useState({ phone_number: '', customer_name: '', business_name: '', step: 1 });
  const [automationMsg, setAutomationMsg] = useState('');

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [apptMsg, setApptMsg] = useState('');

  const [billingPlan, setBillingPlan] = useState('starter');
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingMsg, setBillingMsg] = useState('');

  const [agentDetails, setAgentDetails] = useState(null);
  const [agentUpdating, setAgentUpdating] = useState('');
  const [agentUpdateMsg, setAgentUpdateMsg] = useState('');

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const CAL_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const displayName = session?.user?.name || session?.user?.email || 'Your Business';
  const displayInitials = getInitials(session?.user?.name || session?.user?.email || '??');
  const displayEmail = session?.user?.email || '';

  useEffect(() => {
    if (session && onboardingComplete === false) {
      window.location.href = '/onboarding';
    }
  }, [session, onboardingComplete]);

  useEffect(() => {
    setOverviewLoading(true);
    fetch('/api/overview')
      .then((r) => r.json())
      .then((data) => {
        setOverviewData(data);
        if (data.recentActivity?.length) {
          setActivityItems(
            data.recentActivity.slice(0, 5).map((log) => ({
              text: [
                log.business_name ? `[${log.business_name}]` : null,
                log.automation_type || 'Automation',
                log.status ? `— ${log.status}` : null,
              ].filter(Boolean).join(' '),
              time: log.created_at
                ? new Date(log.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                : '',
              type: log.status === 'success' ? 'green' : log.status === 'failed' ? 'yellow' : 'blue',
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setOverviewLoading(false));
  }, []);

  useEffect(() => {
    if (activePage !== 'clients') return;
    setClientsLoading(true);
    fetch('/api/clients')
      .then(r => r.json())
      .then(data => setClients(data.clients || []))
      .catch(() => setClients([]))
      .finally(() => setClientsLoading(false));
  }, [activePage]);

  useEffect(() => {
    if (activePage !== 'automation-logs') return;
    supabase.from('automation_logs').select('*').order('triggered_at', { ascending: false }).limit(50)
      .then(({ data }) => setAutomationLogs(data || []));
  }, [activePage]);

  useEffect(() => {
    if (activePage !== 'missed-call' || !clientProfile?.id) return;
    supabase.from('missed_calls').select('*')
      .eq('client_id', clientProfile.id)
      .order('timestamp', { ascending: false }).limit(5)
      .then(({ data }) => setMissedCalls(data || []));
  }, [activePage, clientProfile]);

  useEffect(() => {
    if (activePage !== 'review-request' || !clientProfile?.id) return;
    supabase.from('review_requests').select('*')
      .eq('client_id', clientProfile.id)
      .order('sent_at', { ascending: false }).limit(5)
      .then(({ data }) => setReviewRequests(data || []));
  }, [activePage, clientProfile]);

  useEffect(() => {
    if (activePage !== 'reactivation' || !clientProfile?.id) return;
    supabase.from('reactivation_campaigns').select('*')
      .eq('client_id', clientProfile.id)
      .order('sent_at', { ascending: false }).limit(5)
      .then(({ data }) => setReactivations(data || []));
  }, [activePage, clientProfile]);

  useEffect(() => {
    if (activePage !== 'lead-gen' || !clientProfile?.id) return;
    supabase.from('lead_nurture').select('*')
      .eq('client_id', clientProfile.id)
      .order('sent_at', { ascending: false }).limit(5)
      .then(({ data }) => setLeadNurtures(data || []));
  }, [activePage, clientProfile]);

  useEffect(() => {
    if (!session?.user?.email) return;
    supabase.from('users').select('*')
      .eq('email', session.user.email)
      .single()
      .then(({ data }) => {
        if (data) {
          setUserRole(data.role || 'client');
          setUserPlan(data.plan || 'starter');
          setClientProfile(data);
          setOnboardingComplete(data.onboarding_complete ?? false);
          setSettingsForm({
            business_name: data.business_name || '',
            phone: data.business_phone || '',
            hours: data.business_hours || '',
            avatar_url: data.avatar_url || '',
            google_review_url: data.google_review_url || '',
          });
          // Pre-populate review/reactivation forms with business name
          if (data.business_name) {
            setReviewForm(f => ({ ...f, business_name: data.business_name }));
            setReactivationForm(f => ({ ...f, business_name: data.business_name }));
            setLeadForm(f => ({ ...f, business_name: data.business_name }));
          }
        }
      });
  }, [session]);

  useEffect(() => {
    if (!session?.user?.email) return;
    fetch('/api/appointments')
      .then(r => r.json())
      .then(d => setAppointments(d.appointments || []))
      .catch(() => setAppointments([]));
  }, [session]);

  useEffect(() => {
    if (activePage !== 'billing') return;
    setBillingLoading(true);
    fetch('/api/billing')
      .then(r => r.json())
      .then(d => { if (d.plan) setBillingPlan(d.plan); })
      .catch(() => {})
      .finally(() => setBillingLoading(false));
  }, [activePage]);

  useEffect(() => {
    if (activePage !== 'phone') return;
    fetch('/api/retell/agent')
      .then(r => r.json())
      .then(data => setAgentDetails(data))
      .catch(() => setAgentDetails(null));
  }, [activePage]);

  const getDotClass = (type) => {
    if (type === 'blue') return styles.activityItemDotBlue;
    if (type === 'green') return styles.activityItemDotGreen;
    if (type === 'yellow') return styles.activityItemDotYellow;
    if (type === 'purple') return styles.activityItemDotPurple;
    if (type === 'lime') return styles.activityItemDotLime;
    return '';
  };

  const handleAgentToggle = (agentKey, agentName) => {
    const newVal = !agentToggles[agentKey];
    setAgentToggles((prev) => ({ ...prev, [agentKey]: newVal }));
    setActivityItems((prev) => {
      const newItem = { text: `${agentName} ${newVal ? 'activated' : 'paused'}.`, time: 'Just now', type: 'yellow' };
      return [newItem, ...prev].slice(0, 5);
    });
  };

  async function addClient() {
    if (!addClientForm.email || !addClientForm.name) return;
    setAddClientSaving(true);
    setAddClientMsg('');
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addClientForm),
    });
    const data = await res.json();
    setAddClientSaving(false);
    setAddClientMsg(data.error ? '❌ ' + data.error : '✅ Client added successfully!');
    if (!data.error) setAddClientForm({ name: '', email: '', business_name: '', phone: '', plan: 'starter' });
  }

  async function saveSettings() {
    setSettingsSaving(true);
    setSettingsMsg('');
    try {
      const res = await fetch('/api/clients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: displayEmail, ...settingsForm }),
      });
      const data = await res.json();
      setSettingsMsg(data.error ? '❌ ' + data.error : '✅ Settings saved!');
    } catch {
      setSettingsMsg('❌ Failed to save settings.');
    } finally {
      setSettingsSaving(false);
    }
  }

  function handleToggle(key) {
    const newVal = !toggleStates[key];
    setToggleStates(prev => ({ ...prev, [key]: newVal }));
    // Persist via API (fire-and-forget; users table needs a toggles jsonb column)
    fetch('/api/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toggles: { ...toggleStates, [key]: newVal } }),
    }).catch(() => {});
  }

  async function triggerAutomation(clientId, businessName) {
    setTriggerMsg('');
    const res = await fetch('/api/automations/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        automation: triggerForm.automation,
        client_id: clientId,
        payload: {
          phone_number: triggerForm.phone_number,
          customer_name: triggerForm.customer_name,
          business_name: businessName,
        }
      }),
    });
    const data = await res.json();
    setTriggerMsg(data.error ? '❌ ' + data.error : '✅ Automation triggered!');
  }

  async function triggerReviewRequest() {
    setAutomationMsg('');
    const res = await fetch('/api/automations/review-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reviewForm),
    });
    const data = await res.json();
    setAutomationMsg(data.error ? '❌ ' + data.error : '✅ Review request sent!');
    if (!data.error) setReviewForm({ phone_number: '', customer_name: '', business_name: '' });
  }

  async function triggerReactivation() {
    setAutomationMsg('');
    const res = await fetch('/api/automations/reactivation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reactivationForm),
    });
    const data = await res.json();
    setAutomationMsg(data.error ? '❌ ' + data.error : '✅ Reactivation sent!');
    if (!data.error) setReactivationForm({ phone_number: '', customer_name: '', business_name: '', offer: '10% off your next visit' });
  }

  async function triggerLeadNurture() {
    setAutomationMsg('');
    const res = await fetch('/api/automations/lead-nurture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...leadForm, step: parseInt(leadForm.step) }),
    });
    const data = await res.json();
    setAutomationMsg(data.error ? '❌ ' + data.error : '✅ Lead nurture sent!');
    if (!data.error) setLeadForm({ phone_number: '', customer_name: '', business_name: '', step: 1 });
  }

  async function upgradePlan(newPlan) {
    setBillingMsg('');
    try {
      const res = await fetch('/api/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: newPlan }),
      });
      const data = await res.json();
      if (data.ok) {
        setBillingPlan(newPlan);
        setBillingMsg('✅ Plan updated to ' + newPlan + '!');
      } else {
        setBillingMsg('❌ ' + (data.error || 'Failed to update plan'));
      }
    } catch {
      setBillingMsg('❌ Failed to update plan.');
    }
  }

  async function updateAgentSetting(setting, value) {
    setAgentUpdating(setting);
    setAgentUpdateMsg('');
    const res = await fetch('/api/retell/agent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [setting]: value }),
    });
    const data = await res.json();
    setAgentUpdating('');
    setAgentUpdateMsg(data.error ? '❌ ' + data.error : '✅ Alex updated!');
    if (!data.error) setAgentDetails(prev => ({ ...prev, [setting]: value }));
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

  async function saveAppointment() {
    if (!selectedDay || !apptForm.title) return;
    setApptSaving(true);
    setApptMsg('');
    const date = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, time: apptForm.time, title: apptForm.title, notes: apptForm.notes }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setApptMsg('✅ Appointment saved!');
      setApptForm({ title: '', time: '09:00', notes: '' });
      // Refresh appointments list
      fetch('/api/appointments')
        .then(r => r.json())
        .then(d => setAppointments(d.appointments || []));
    } catch (err) {
      setApptMsg('❌ ' + err.message);
    } finally {
      setApptSaving(false);
    }
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
        {
          page: 'accounting', label: 'Accounting', requiredFeature: 'accounting', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#1A0D00', display: 'block' }}>
              <line x1="6" y1="6" x2="6" y2="25" stroke="#EF9F27" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="6" y1="25" x2="26" y2="25" stroke="#EF9F27" strokeWidth="1.5" strokeLinecap="round"/>
              <rect x="8" y="19" width="4" height="6" fill="#EF9F27"/>
              <rect x="14" y="12" width="4" height="13" fill="#EF9F27"/>
              <rect x="20" y="15" width="4" height="10" fill="#EF9F27"/>
            </svg>
          )
        },
        {
          page: 'crm', label: 'CRM', requiredFeature: 'crm', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#160D2A', display: 'block' }}>
              <circle cx="12" cy="11" r="3.5" stroke="#7B2FFF" strokeWidth="1.5" fill="none"/>
              <path d="M5 26 C5 21.6 8.1 18 12 18 C15.9 18 19 21.6 19 26" stroke="#7B2FFF" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <circle cx="22" cy="10" r="2.8" stroke="#7B2FFF" strokeWidth="1.5" fill="none" opacity="0.65"/>
              <path d="M18 25 C18 21.4 19.7 18.5 22 18.5 C24.3 18.5 26 21.4 26 25" stroke="#7B2FFF" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.65"/>
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
      section: 'Clients',
      items: [
        {
          page: 'clients', label: 'All Clients', requiredFeature: 'clients', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#160D2A', display: 'block' }}>
              <circle cx="12" cy="11" r="3.5" stroke="#7B2FFF" strokeWidth="1.5" fill="none"/>
              <path d="M5 26 C5 21.6 8.1 18 12 18 C15.9 18 19 21.6 19 26" stroke="#7B2FFF" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <circle cx="22" cy="10" r="2.8" stroke="#7B2FFF" strokeWidth="1.5" fill="none" opacity="0.65"/>
              <path d="M18 25 C18 21.4 19.7 18.5 22 18.5 C24.3 18.5 26 21.4 26 25" stroke="#7B2FFF" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.65"/>
            </svg>
          )
        },
        {
          page: 'add-client', label: 'Add Client', requiredFeature: 'add-client', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#0D2018', display: 'block' }}>
              <line x1="16" y1="8" x2="16" y2="24" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="8" y1="16" x2="24" y2="16" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )
        },
        {
          page: 'automation-logs', label: 'Automation Logs', requiredFeature: 'automation-logs', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#1A1500', display: 'block' }}>
              <line x1="8" y1="11" x2="24" y2="11" stroke="#F5C400" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="8" y1="16" x2="24" y2="16" stroke="#F5C400" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="8" y1="21" x2="18" y2="21" stroke="#F5C400" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )
        },
      ]
    },
    {
      section: 'CRM Data',
      items: [
        {
          page: 'contacts', href: '/dashboard/contacts', label: 'Contacts', requiredFeature: 'contacts', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#0D1F35', display: 'block' }}>
              <circle cx="16" cy="12" r="4" stroke="#378ADD" strokeWidth="1.5" fill="none"/>
              <path d="M8 26 C8 21.6 11.6 18 16 18 C20.4 18 24 21.6 24 26" stroke="#378ADD" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            </svg>
          )
        },
        {
          page: 'pipeline', href: '/dashboard/pipeline', label: 'Pipeline', requiredFeature: 'pipeline', icon: (
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
          page: 'billing', href: '/dashboard/billing', label: 'Billing', requiredFeature: 'billing', icon: (
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

  const inputStyle = {
    background: '#1a1a1a',
    border: '1px solid #3a3a3a',
    borderRadius: '6px',
    color: '#e8e8e8',
    padding: '5px 10px',
    fontSize: '0.85rem',
    width: '100%',
    outline: 'none',
    fontFamily: 'inherit',
  };

  const btnEditStyle = {
    background: 'transparent',
    border: '1px solid #3a3a3a',
    borderRadius: '6px',
    color: '#888780',
    padding: '4px 14px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontFamily: 'inherit',
  };

  const btnSaveStyle = {
    background: '#F5C400',
    border: 'none',
    borderRadius: '6px',
    color: '#000',
    padding: '4px 14px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: '600',
    fontFamily: 'inherit',
    marginRight: '8px',
  };

  const btnCancelStyle = {
    ...btnEditStyle,
    marginLeft: '4px',
  };

  return (
    <div className={styles.dashboardLayout}>
      {/* TOP BAR */}
      <header className={styles.topbar} role="banner">
        <div className={styles.topbarBrand}>
          <Link href="/" aria-label="TheHypeBox — Back to site">
            <img src="/logo.png" alt="TheHypeBox" style={{ height: '36px', width: 'auto', display: 'block', mixBlendMode: 'screen' }} />
          </Link>
          <span className={styles.topbarCc}>Command Center</span>
        </div>
        <div className={styles.topbarRight}>
          <div className={styles.topbarStatus}>
            <span className={`${styles.statusDot} ${styles.statusDotGreen}`}></span>
            All systems operational
          </div>
          <div className={styles.topbarUser}>
            <div className={styles.topbarAvatar} aria-hidden="true">
              {settingsForm.avatar_url ? (
                <img src={settingsForm.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
              ) : displayInitials}
            </div>
            <span>{displayName}</span>
            <span style={{
              fontSize: 10,
              background: userRole === 'super_admin' ? '#F5C400' : userPlan === 'pro' ? '#7B2FFF' : userPlan === 'growth' ? '#1D9E75' : '#378ADD',
              color: userRole === 'super_admin' ? '#000' : '#fff',
              borderRadius: 4,
              padding: '2px 6px',
              marginLeft: 8,
              fontWeight: 700,
              textTransform: 'uppercase',
            }}>
              {userRole === 'super_admin' ? 'Admin' : userPlan}
            </span>
          </div>
        </div>
      </header>

      {/* SIDEBAR */}
      <nav className={styles.sidebar} aria-label="Dashboard navigation">
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
          <form action={logout} style={{ marginBottom: 6 }}>
            <button type="submit" style={{ display: 'block', width: '100%', background: 'none', border: '1px solid #3a3a3a', borderRadius: 4, color: '#ccc', fontSize: 9, fontFamily: 'var(--font-body)', letterSpacing: '0.04em', padding: '0.4rem', cursor: 'pointer', textAlign: 'center', transition: 'color 150ms ease, border-color 150ms ease' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#666'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#ccc'; e.currentTarget.style.borderColor = '#3a3a3a'; }}
            >
              Sign Out
            </button>
          </form>
          <Link href="/" className={styles.sidebarBack}>← Back to Site</Link>
        </div>
      </nav>

      {/* MAIN */}
      <main className={styles.main} id="main-content">

        {/* === OVERVIEW === */}
        {activePage === 'overview' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Command Center</h1>
              <p>Today&apos;s snapshot — updated live</p>
            </div>
            <div className={styles.metricsGrid}>
              {overviewData?.isSuperAdmin ? (
                <>
                  <div className={styles.metricCard}><div className={styles.metricCardLabel}>Total Clients</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>{overviewLoading ? '…' : (overviewData.stats.totalClients ?? '—')}</div><div className={styles.metricCardDelta}>All time</div></div>
                  <div className={styles.metricCard}><div className={styles.metricCardLabel}>Active Clients</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>{overviewLoading ? '…' : (overviewData.stats.activeClients ?? '—')}</div><div className={styles.metricCardDelta}>Subscribed</div></div>
                  <div className={styles.metricCard}><div className={styles.metricCardLabel}>Monthly Revenue</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>{overviewLoading ? '…' : overviewData.stats.monthlyRevenue != null ? '$' + overviewData.stats.monthlyRevenue.toLocaleString() : '—'}</div><div className={styles.metricCardDelta}>MRR</div></div>
                  <div className={styles.metricCard}><div className={styles.metricCardLabel}>New This Month</div><div className={styles.metricCardValue} style={{ color: '#378ADD' }}>{overviewLoading ? '…' : (overviewData.stats.newClientsThisMonth ?? '—')}</div><div className={styles.metricCardDelta}>Last 30 days</div></div>
                </>
              ) : (
                <>
                  <div className={styles.metricCard}><div className={styles.metricCardLabel}>Total Contacts</div><div className={styles.metricCardValue} style={{ color: '#378ADD' }}>{overviewLoading ? '…' : (overviewData?.stats?.totalContacts ?? '—')}</div><div className={styles.metricCardDelta}>In your CRM</div></div>
                  <div className={styles.metricCard}><div className={styles.metricCardLabel}>Open Opportunities</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>{overviewLoading ? '…' : (overviewData?.stats?.leadsActive ?? '—')}</div><div className={styles.metricCardDelta}>Active pipeline</div></div>
                  <div className={styles.metricCard}><div className={styles.metricCardLabel}>Pipeline Value</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>{overviewLoading ? '…' : overviewData?.stats?.pipelineValue != null ? '$' + overviewData.stats.pipelineValue.toLocaleString() : '—'}</div><div className={styles.metricCardDelta}>Open deals</div></div>
                  <div className={styles.metricCard}><div className={styles.metricCardLabel}>Completed Jobs</div><div className={styles.metricCardValue} style={{ color: '#EF9F27' }}>{overviewLoading ? '…' : (overviewData?.stats?.completedJobs ?? '—')}</div><div className={styles.metricCardDelta}>Won / closed</div></div>
                </>
              )}
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Agent Status</span><span className={styles.tag}>4 Active</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    <li className={styles.agentItem}>
                      <span className={styles.agentItemIcon} style={{ background: '#0D1F35' }} aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M8 12.5 C7.5 13.8 8 15.5 9.7 16.3 C10.5 16.8 11.2 16.3 12.4 15.1 C13 14.5 13 13.7 12.4 13.1 L11.8 12.5 C11.6 12.3 11.6 11.9 11.8 11.7 L13.1 10.4 C13.3 10.2 13.7 10.2 13.9 10.4 L14.5 11 C15.1 11.6 15.9 11.6 16.5 11 L17.5 10 C18.1 9.4 18.1 8.6 17.5 8 C16.3 6.8 14.2 6.4 12.8 7 C11.4 7.6 8.5 11.2 8 12.5 Z" stroke="#378ADD" strokeWidth="1.5" fill="none" strokeLinejoin="round"/></svg></span>
                      <div className={styles.agentItemInfo}><div className={styles.agentItemName}>Phone Agent</div><div className={styles.agentItemSub}>{overviewData?.stats?.callsThisMonth != null ? `${overviewData.stats.callsThisMonth} calls this month` : 'Live & answering'}</div></div>
                      <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${agentToggles.phone ? styles.statusDotGreen : ''}`}></span><span>{agentToggles.phone ? 'Active' : 'Paused'}</span></div>
                      <Toggle checked={agentToggles.phone} onChange={() => handleAgentToggle('phone', 'Phone Agent')} label="Toggle Phone Agent" />
                    </li>
                    <li className={styles.agentItem}>
                      <span className={styles.agentItemIcon} style={{ background: '#0D2018' }} aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="15" rx="2" stroke="#1D9E75" strokeWidth="1.5" fill="none"/><line x1="3" y1="10" x2="21" y2="10" stroke="#1D9E75" strokeWidth="1.5"/><line x1="8" y1="5" x2="8" y2="3" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="5" x2="16" y2="3" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="14" r="1.1" fill="#1D9E75"/><circle cx="12" cy="14" r="1.1" fill="#1D9E75"/><circle cx="16" cy="14" r="1.1" fill="#1D9E75"/></svg></span>
                      <div className={styles.agentItemInfo}><div className={styles.agentItemName}>Scheduling Agent</div><div className={styles.agentItemSub}>{overviewData?.stats?.apptThisMonth != null ? `${overviewData.stats.apptThisMonth} appointments this month` : 'Booking & scheduling'}</div></div>
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
                      <div className={styles.agentItemInfo}><div className={styles.agentItemName}>CRM Agent</div><div className={styles.agentItemSub}>{overviewData?.stats?.leadsActive != null ? `${overviewData.stats.leadsActive} active leads` : 'Managing follow-ups'}</div></div>
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
                    <tr>
                      <td colSpan={5} style={{ padding: '24px 16px', textAlign: 'center', color: '#666', fontSize: 13 }}>
                        {overviewLoading
                          ? 'Loading…'
                          : overviewData?.stats?.callsThisMonth != null
                            ? <>{overviewData.stats.callsThisMonth} calls this month. <Link href="/dashboard/calls" style={{ color: '#378ADD', textDecoration: 'none' }}>View full call log →</Link></>
                            : <Link href="/dashboard/calls" style={{ color: '#378ADD', textDecoration: 'none' }}>View call log →</Link>
                        }
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* === PHONE AGENT — ALEX (Retell AI) === */}
        {activePage === 'phone' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Phone Agent — Alex</h1>
              <p>Handles every inbound call — 24/7</p>
            </div>

            <div className={styles.panel} style={{ marginBottom: 24 }}>
              <div className={styles.panelBody}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#0D1F35', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🤖</div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>
                      {userRole === 'super_admin'
                        ? 'Alex'
                        : clientProfile?.business_name
                          ? `${clientProfile.business_name} AI Agent`
                          : 'AI Agent'}
                    </div>
                    <div style={{ color: '#aaa', fontSize: 13 }}>
                      {userRole === 'super_admin'
                        ? 'agent_132e809e21c0ff5eb0f006d59e'
                        : clientProfile?.retell_agent_id || 'No agent provisioned yet'}
                    </div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 16 }}>
                      <span style={{ color: '#378ADD', fontSize: 13 }}>
                        📞 {userRole === 'super_admin'
                          ? '(856) 363-0633'
                          : clientProfile?.retell_phone_number || 'No number assigned'}
                      </span>
                      <span style={{ color: '#1D9E75', fontSize: 13 }}>● Live & Answering</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Total Calls</div><div className={styles.metricCardValue} style={{ color: '#378ADD' }}>{calls.length || '—'}</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>From Retell</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Avg Duration</div><div className={styles.metricCardValue}>{calls.length > 0 ? Math.round(calls.filter(c => c.duration_ms).reduce((a, c) => a + c.duration_ms, 0) / calls.filter(c => c.duration_ms).length / 1000) + 's' : '—'}</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>per call</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Successful</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>{calls.filter(c => c.scrubbed_call_analysis?.call_successful).length || '—'}</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ completed</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Positive Sentiment</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>{calls.filter(c => c.scrubbed_call_analysis?.user_sentiment === 'Positive').length || '—'}</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>happy callers</div></div>
            </div>

            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <span className={styles.panelTitle}>Recent Calls</span>
                  {retellLoading && <span className={styles.tag}>Loading…</span>}
                </div>
                <div className={styles.panelBody}>
                  {callsLoading && <p style={{ color: '#aaa', padding: '12px 0' }}>Loading calls from Retell...</p>}
                  {!callsLoading && calls.length === 0 && <p style={{ color: '#aaa', padding: '12px 0' }}>No calls yet — Alex is standing by.</p>}
                  <ul className={styles.agentList}>
                    {calls.slice(0, 10).map((call) => (
                      <li key={call.call_id} className={styles.agentItem}>
                        <span className={styles.agentItemIcon} style={{ background: '#0D1F35' }} aria-hidden="true">{phoneIcon12}</span>
                        <div className={styles.agentItemInfo}>
                          <div className={styles.agentItemName}>
                            {call.scrubbed_call_analysis?.custom_analysis_data?.['custom data']?.match(new RegExp('Caller Name: ([^\\n]+)'))?.[1]?.trim() || call.from_number || 'Web Call'}
                          </div>
                          <div className={styles.agentItemSub}>
                            {call.scrubbed_call_analysis?.call_summary?.slice(0, 80) || 'No summary'}...
                          </div>
                          <div className={styles.agentItemSub}>{call.start_timestamp ? new Date(call.start_timestamp).toLocaleString() : ''}</div>
                        </div>
                        <div className={styles.agentItemStatus}>
                          <span className={`${styles.statusDot} ${call.scrubbed_call_analysis?.user_sentiment === 'Positive' ? styles.statusDotGreen : call.scrubbed_call_analysis?.user_sentiment === 'Negative' ? styles.statusDotRed : styles.statusDotYellow}`}></span>
                          <span>{call.duration_ms ? Math.round(call.duration_ms / 1000) + 's' : 'ongoing'}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <span className={styles.panelTitle}>Alex — Live Controls</span>
                  <Msg text={agentUpdateMsg} />
                </div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    <li className={styles.agentItem}>
                      <div className={styles.agentItemInfo}>
                        <div className={styles.agentItemName}>Agent Active</div>
                        <div className={styles.agentItemSub}>
                          {agentUpdating === 'is_published' ? 'Updating...' : 'Toggle Alex on or off via Retell'}
                        </div>
                      </div>
                      <Toggle
                        checked={agentDetails?.is_published ?? true}
                        onChange={() => updateAgentSetting('is_published', !(agentDetails?.is_published ?? true))}
                        label="Toggle Agent Active"
                      />
                    </li>
                    <li className={styles.agentItem}>
                      <div className={styles.agentItemInfo}>
                        <div className={styles.agentItemName}>After-Hours Mode</div>
                        <div className={styles.agentItemSub}>Take messages when business is closed</div>
                      </div>
                      <Toggle
                        checked={toggleStates['after-hours']}
                        onChange={() => handleToggle('after-hours')}
                        label="Toggle After Hours"
                      />
                    </li>
                    <li className={styles.agentItem}>
                      <div className={styles.agentItemInfo}>
                        <div className={styles.agentItemName}>Call Summaries</div>
                        <div className={styles.agentItemSub}>Email recap after each call</div>
                      </div>
                      <Toggle
                        checked={toggleStates['call-summaries']}
                        onChange={() => handleToggle('call-summaries')}
                        label="Toggle Call Summaries"
                      />
                    </li>
                    <li className={styles.agentItem}>
                      <div className={styles.agentItemInfo}>
                        <div className={styles.agentItemName}>Transfer Escalations</div>
                        <div className={styles.agentItemSub}>Forward urgent calls to owner</div>
                      </div>
                      <Toggle
                        checked={toggleStates['transfer-escalations']}
                        onChange={() => handleToggle('transfer-escalations')}
                        label="Toggle Transfer Escalations"
                      />
                    </li>
                  </ul>
                  {agentDetails && (
                    <div style={{ marginTop: 16, padding: 12, background: '#1a1a1a', borderRadius: 8, border: '1px solid #333' }}>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>LIVE AGENT DATA FROM RETELL</div>
                      {[
                        ['Agent Name', agentDetails.agent_name || 'Alex'],
                        ['Voice', agentDetails.voice_id || '—'],
                        ['Language', agentDetails.language || 'en-US'],
                        ['Last Updated', agentDetails.last_modification_timestamp ? new Date(agentDetails.last_modification_timestamp).toLocaleString() : '—'],
                      ].map(([label, value]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #222' }}>
                          <span style={{ fontSize: 12, color: '#888' }}>{label}</span>
                          <span style={{ fontSize: 12, color: '#ccc' }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* === SCHEDULING — Interactive Calendar === */}
        {activePage === 'scheduling' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Scheduling</h1>
              <p>Book and manage appointments — saved to your account</p>
            </div>

            {/* Metrics from appointments data */}
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Total Appointments</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>{appointments.length}</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ all time</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>This Month</div><div className={styles.metricCardValue} style={{ color: '#378ADD' }}>{appointments.filter(a => new Date(a.date).getMonth() === today.getMonth()).length}</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— this month</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Today</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>{appointments.filter(a => a.date === `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`).length}</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— today</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Selected Day</div><div className={styles.metricCardValue}>{selectedDay ? apptCountForDay(selectedDay) : '—'}</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— appointments</div></div>
            </div>

            {/* Calendar panel */}
            <div className={styles.panel} style={{ marginBottom: '1.5rem' }}>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>Weekly Calendar</span>
                <div className={styles.calNav}>
                  <button
                    className={styles.calNavBtn}
                    onClick={() => {
                      const d = new Date(calWeekStart);
                      d.setDate(d.getDate() - 7);
                      setCalWeekStart(d);
                    }}
                  >← Prev</button>
                  <span className={styles.calWeekLabel}>{calWeekLabel}</span>
                  <button
                    className={styles.calNavBtn}
                    onClick={() => {
                      const d = new Date(calWeekStart);
                      d.setDate(d.getDate() + 7);
                      setCalWeekStart(d);
                    }}
                  >Next →</button>
                </div>
              </div>
              <div className={styles.panelBody}>
                <div className={styles.calGrid}>
                  {calWeekDays.map((day, i) => {
                    const dateKey = day.toISOString().split('T')[0];
                    const isToday = dateKey === todayStr;
                    const dayAppts = apptsByDate(day);
                    return (
                      <div
                        key={dateKey}
                        className={`${styles.calDayCol} ${isToday ? styles.calDayColToday : ''}`}
                        onClick={() => {
                          setSelectedDate(day);
                          setApptForm({ customer_name: '', service: '', time: '', phone: '' });
                          setShowApptModal(true);
                        }}
                      >
                        <div className={styles.calDayHeader}>
                          <div className={styles.calDayName}>{DAY_NAMES[i]}</div>
                          <div className={`${styles.calDayNum} ${isToday ? styles.calDayNumToday : ''}`}>
                            {day.getDate()}
                          </div>
                        </div>
                        <div className={styles.calDayBody}>
                          {dayAppts.map((appt) => (
                            <div key={appt.id} className={styles.calApptChip} onClick={(e) => e.stopPropagation()}>
                              <div className={styles.calApptChipTime}>{appt.appointment_time?.slice(0, 5)}</div>
                              <div className={styles.calApptChipName}>{appt.customer_name}</div>
                            </div>
                          ))}
                          {dayAppts.length === 0 && (
                            <div className={styles.calAddHint}>+ add</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Agent settings panel */}
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
                      <div
                        key={i}
                        onClick={() => day && setSelectedDay(day)}
                        style={{
                          textAlign: 'center',
                          padding: '8px 2px',
                          borderRadius: 6,
                          fontSize: 13,
                          cursor: day ? 'pointer' : 'default',
                          background: day === selectedDay ? '#F5C400' : 'transparent',
                          color: day === selectedDay ? '#000' : day ? '#fff' : 'transparent',
                          border: day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear() && day !== selectedDay ? '1px solid #F5C400' : '1px solid transparent',
                          position: 'relative',
                          fontWeight: day === selectedDay ? 700 : 400,
                        }}
                      >
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
                  <span className={styles.panelTitle}>
                    {selectedDay ? `${MONTHS[calMonth]} ${selectedDay} — Appointments` : 'Select a Day'}
                  </span>
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
                        {[['Title', 'title', 'text', 'e.g. Client consultation'], ['Notes', 'notes', 'text', 'Optional notes']].map(([label, field, type, placeholder]) => (
                          <div key={field} style={{ marginBottom: 10 }}>
                            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>{label}</label>
                            <input type={type} placeholder={placeholder} value={apptForm[field]} onChange={e => setApptForm(f => ({ ...f, [field]: e.target.value }))} style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box' }} />
                          </div>
                        ))}
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>Time</label>
                          <input type="time" value={apptForm.time} onChange={e => setApptForm(f => ({ ...f, time: e.target.value }))} style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box' }} />
                        </div>
                        <button onClick={saveAppointment} disabled={apptSaving} style={{ background: '#1D9E75', border: 'none', color: '#fff', borderRadius: 6, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                          {apptSaving ? 'Saving...' : 'Save Appointment'}
                        </button>
                        <Msg text={apptMsg} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Add-appointment modal */}
        {showApptModal && (
          <div className={styles.modalOverlay} onClick={() => setShowApptModal(false)}>
            <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalTitle}>New Appointment</div>
              <div className={styles.modalSubtitle}>
                {selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Customer Name *</label>
                <input
                  className={styles.modalInput}
                  placeholder="e.g. Sarah M."
                  value={apptForm.customer_name}
                  onChange={(e) => setApptForm((p) => ({ ...p, customer_name: e.target.value }))}
                />
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Service *</label>
                <input
                  className={styles.modalInput}
                  placeholder="e.g. Oil change + tire rotation"
                  value={apptForm.service}
                  onChange={(e) => setApptForm((p) => ({ ...p, service: e.target.value }))}
                />
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Time *</label>
                <input
                  className={styles.modalInput}
                  type="time"
                  value={apptForm.time}
                  onChange={(e) => setApptForm((p) => ({ ...p, time: e.target.value }))}
                />
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Phone Number</label>
                <input
                  className={styles.modalInput}
                  placeholder="(555) 000-0000"
                  value={apptForm.phone}
                  onChange={(e) => setApptForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className={styles.modalActions}>
                <button className={styles.modalCancelBtn} onClick={() => setShowApptModal(false)}>Cancel</button>
                <button
                  className={styles.modalSaveBtn}
                  onClick={handleSaveAppt}
                  disabled={apptSaving || !apptForm.customer_name || !apptForm.service || !apptForm.time}
                >
                  {apptSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === ACCOUNTING === */}
        {activePage === 'accounting' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Accounting Agent</h1>
              <p>Invoices, payments, and financial tracking</p>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Revenue Today</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>$4,820</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 8% vs avg</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Outstanding</div><div className={styles.metricCardValue} style={{ color: '#EF9F27' }}>$1,240</div><div className={`${styles.metricCardDelta} ${styles.deltaDown}`}>3 invoices</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Paid This Month</div><div className={styles.metricCardValue}>$31,400</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 14%</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Invoices Sent</div><div className={styles.metricCardValue}>12</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— today</div></div>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Recent Invoices</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[["Invoice #1042 — Dave's Plumbing", '$340 — sent 22 min ago', 'yellow', 'Pending'], ['Invoice #1041 — Sarah M.', '$95 — sent yesterday', 'green', 'Paid'], ['Invoice #1040 — Garcia Auto', '$780 — 3 days overdue', 'red', 'Overdue']].map(([name, sub, dot, status]) => (
                      <li key={name} className={styles.agentItem}>
                        <span className={styles.agentItemIcon} style={{ background: '#1A0D00' }} aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="18" rx="2" stroke="#EF9F27" strokeWidth="1.5"/><line x1="8" y1="8" x2="16" y2="8" stroke="#EF9F27" strokeWidth="1.4" strokeLinecap="round"/><line x1="8" y1="12" x2="16" y2="12" stroke="#EF9F27" strokeWidth="1.4" strokeLinecap="round"/><line x1="8" y1="16" x2="12" y2="16" stroke="#EF9F27" strokeWidth="1.4" strokeLinecap="round"/></svg>
                        </span>
                        <div className={styles.agentItemInfo}><div className={styles.agentItemName}>{name}</div><div className={styles.agentItemSub}>{sub}</div></div>
                        <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${dot === 'green' ? styles.statusDotGreen : dot === 'yellow' ? styles.statusDotYellow : styles.statusDotRed}`}></span><span>{status}</span></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Agent Settings</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['Auto-Invoice', 'Send invoice after job completion', 'auto-invoice'], ['Overdue Reminders', 'Nudge after 3 days unpaid', 'overdue-reminders'], ['Monthly P&L Report', 'Email summary on 1st of month', 'monthly-pl']].map(([name, sub, key]) => (
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

        {/* === CRM === */}
        {activePage === 'crm' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>CRM Agent</h1>
              <p>Customer relationships on autopilot</p>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Total Customers</div><div className={styles.metricCardValue} style={{ color: '#7B2FFF' }}>284</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 6 new this week</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Follow-Ups Queued</div><div className={styles.metricCardValue}>2</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— today</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Re-Engagements Sent</div><div className={styles.metricCardValue}>18</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ this month</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Response Rate</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>34%</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ above avg</div></div>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Recent Contacts</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['Sarah M.', 'Last visit: today — oil change', 'green', 'Active'], ['Mike T.', 'Last visit: 6 months ago — follow-up sent', 'yellow', 'Nudged'], ['Garcia Auto', 'Last visit: 2 weeks ago — invoice overdue', 'red', 'Attention']].map(([name, sub, dot, status]) => (
                      <li key={name} className={styles.agentItem}>
                        <span className={styles.agentItemIcon} style={{ background: '#160D2A' }} aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" stroke="#7B2FFF" strokeWidth="1.5" fill="none"/><path d="M5 20 C5 15.6 8.1 12 12 12 C15.9 12 19 15.6 19 20" stroke="#7B2FFF" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
                        </span>
                        <div className={styles.agentItemInfo}><div className={styles.agentItemName}>{name}</div><div className={styles.agentItemSub}>{sub}</div></div>
                        <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${dot === 'green' ? styles.statusDotGreen : dot === 'yellow' ? styles.statusDotYellow : styles.statusDotRed}`}></span><span>{status}</span></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Agent Settings</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['Auto Follow-Up', 'Message customers after service', 'auto-followup'], ['Re-Engagement', 'Reach out after 90 days inactive', 're-engagement'], ['Birthday Messages', 'Auto-send birthday offers', 'birthday-messages']].map(([name, sub, key]) => (
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
                  {missedCalls.length === 0 && <p style={{ color: '#aaa', padding: '12px 0' }}>No missed calls yet — Alex is answering everything!</p>}
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
                    <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.5 }}>"Hey! Sorry we missed your call. We'd love to help — reply here or visit thehypeboxllc.com to chat with Alex!"</div>
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
                  {[['Customer Name', 'customer_name', 'text', 'Sarah M.'], ['Phone Number', 'phone_number', 'tel', '(555) 800-1234'], ['Business Name', 'business_name', 'text', "Dave's Plumbing"]].map(([label, field, type, placeholder]) => (
                    <div key={field} style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>{label}</label>
                      <input type={type} placeholder={placeholder} value={reviewForm[field]} onChange={e => setReviewForm(f => ({ ...f, [field]: e.target.value }))} style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box' }} />
                    </div>
                  ))}
                  <button onClick={triggerReviewRequest} style={{ background: '#F5C400', border: 'none', color: '#000', borderRadius: 6, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}>Send Review Request</button>
                  {activePage === 'review-request' && <Msg text={automationMsg} />}
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Recent Requests</span></div>
                <div className={styles.panelBody}>
                  {reviewRequests.length === 0 && <p style={{ color: '#aaa', padding: '12px 0' }}>No review requests sent yet.</p>}
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
              <p>Win back customers who haven't visited in 90+ days</p>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Campaigns Sent</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>{reactivations.length}</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ all time</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Sent Today</div><div className={styles.metricCardValue} style={{ color: '#378ADD' }}>{reactivations.filter(r => new Date(r.sent_at).toDateString() === new Date().toDateString()).length}</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— today</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Win-Back Rate</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>28%</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ above avg</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Revenue Recovered</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>$0</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— tracking</div></div>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Send Reactivation</span></div>
                <div className={styles.panelBody}>
                  {[['Customer Name', 'customer_name', 'text', 'Mike T.'], ['Phone Number', 'phone_number', 'tel', '(555) 800-1234'], ['Business Name', 'business_name', 'text', "Dave's Plumbing"], ['Offer', 'offer', 'text', '10% off your next visit']].map(([label, field, type, placeholder]) => (
                    <div key={field} style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 4 }}>{label}</label>
                      <input type={type} placeholder={placeholder} value={reactivationForm[field]} onChange={e => setReactivationForm(f => ({ ...f, [field]: e.target.value }))} style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box' }} />
                    </div>
                  ))}
                  <button onClick={triggerReactivation} style={{ background: '#1D9E75', border: 'none', color: '#fff', borderRadius: 6, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}>Send Reactivation</button>
                  {activePage === 'reactivation' && <Msg text={automationMsg} />}
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Recent Campaigns</span></div>
                <div className={styles.panelBody}>
                  {reactivations.length === 0 && <p style={{ color: '#aaa', padding: '12px 0' }}>No reactivation campaigns sent yet.</p>}
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
                  {[['Customer Name', 'customer_name', 'text', 'John D.'], ['Phone Number', 'phone_number', 'tel', '(555) 800-1234'], ['Business Name', 'business_name', 'text', "Dave's Plumbing"]].map(([label, field, type, placeholder]) => (
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
                  {activePage === 'lead-gen' && <Msg text={automationMsg} />}
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Recent Leads</span></div>
                <div className={styles.panelBody}>
                  {leadNurtures.length === 0 && <p style={{ color: '#aaa', padding: '12px 0' }}>No leads nurtured yet.</p>}
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

        {/* === MISSED CALL TEXT BACK === */}
        {activePage === 'missedCall' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Missed Call Text Back</h1>
              <p>Automatically texts every missed call within seconds</p>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Missed Calls Today</div><div className={styles.metricCardValue} style={{ color: '#FF4444' }}>3</div><div className={`${styles.metricCardDelta} ${styles.deltaDown}`}>↓ 2 vs yesterday</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Auto-Texts Sent</div><div className={styles.metricCardValue} style={{ color: '#378ADD' }}>3</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 100% coverage</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Response Rate</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>67%</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 2 replied</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Bookings Recovered</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>1</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ from text reply</div></div>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Missed Calls Log</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['(555) 312-9087', 'Text sent — replied, appointment booked', 'green', 'Recovered'], ['(555) 490-2211', 'Text sent — no reply yet', 'yellow', 'Awaiting'], ['(555) 611-0034', 'Text sent — replied, will call back', 'green', 'Replied']].map(([num, sub, dot, status]) => (
                      <li key={num} className={styles.agentItem}>
                        <span className={styles.agentItemIcon} style={{ background: '#1F0D0D' }} aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M8 12.5 C7.5 13.8 8 15.5 9.7 16.3 C10.5 16.8 11.2 16.3 12.4 15.1 C13 14.5 13 13.7 12.4 13.1 L11.8 12.5 C11.6 12.3 11.6 11.9 11.8 11.7 L13.1 10.4 C13.3 10.2 13.7 10.2 13.9 10.4 L14.5 11 C15.1 11.6 15.9 11.6 16.5 11 L17.5 10 C18.1 9.4 18.1 8.6 17.5 8 C16.3 6.8 14.2 6.4 12.8 7 C11.4 7.6 8.5 11.2 8 12.5 Z" stroke="#FF4444" strokeWidth="1.5" fill="none" strokeLinejoin="round"/></svg>
                        </span>
                        <div className={styles.agentItemInfo}><div className={styles.agentItemName}>{num}</div><div className={styles.agentItemSub}>{sub}</div></div>
                        <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${dot === 'green' ? styles.statusDotGreen : styles.statusDotYellow}`}></span><span>{status}</span></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Agent Settings</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[
                      ['Auto-Text On/Off', 'Text every missed call automatically', 'missedCallAutoText'],
                      ['Custom Message', 'Use personalized text template', 'missedCallCustomMsg'],
                      ['Response Window', 'Only text within business hours', 'missedCallWindow'],
                    ].map(([name, sub, key]) => (
                      <li key={key} className={styles.agentItem}>
                        <div className={styles.agentItemInfo}><div className={styles.agentItemName}>{name}</div><div className={styles.agentItemSub}>{sub}</div></div>
                        <Toggle checked={automationToggles[key]} onChange={() => handleAutomationToggle(key, name)} label={`Toggle ${name}`} />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* === REVIEW REQUEST AGENT === */}
        {activePage === 'reviewRequest' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Review Request Agent</h1>
              <p>Automatically requests reviews after every completed job</p>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Requests Today</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>8</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 3 vs yesterday</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>5-Star Rate</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>91%</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 4% this month</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Google Rating</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>4.8</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 142 reviews</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Response Rate</div><div className={styles.metricCardValue}>38%</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— industry avg</div></div>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Recent Requests</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['Sarah M.', 'Oil change — request sent 10 min ago', 'green', 'Sent'], ['Dave K.', 'Brake job — left 5-star review', 'green', 'Reviewed'], ['Lisa R.', 'Full detail — request sent 2 hr ago', 'yellow', 'Awaiting']].map(([name, sub, dot, status]) => (
                      <li key={name} className={styles.agentItem}>
                        <span className={styles.agentItemIcon} style={{ background: '#1A1500' }} aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 4 L13.8 9 L19 9.4 L15 13 L16.4 18.2 L12 15.5 L7.6 18.2 L9 13 L5 9.4 L10.2 9 Z" stroke="#F5C400" strokeWidth="1.2" fill="none" strokeLinejoin="round"/></svg>
                        </span>
                        <div className={styles.agentItemInfo}><div className={styles.agentItemName}>{name}</div><div className={styles.agentItemSub}>{sub}</div></div>
                        <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${dot === 'green' ? styles.statusDotGreen : styles.statusDotYellow}`}></span><span>{status}</span></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Agent Settings</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[
                      ['Auto-Request After Job', 'Send review request on job close', 'reviewAutoRequest'],
                      ['Request Timing', 'Wait 1 hour after job completion', 'reviewTiming'],
                      ['Platform — Google', 'Send to Google Reviews (vs Yelp)', 'reviewPlatformGoogle'],
                    ].map(([name, sub, key]) => (
                      <li key={key} className={styles.agentItem}>
                        <div className={styles.agentItemInfo}><div className={styles.agentItemName}>{name}</div><div className={styles.agentItemSub}>{sub}</div></div>
                        <Toggle checked={automationToggles[key]} onChange={() => handleAutomationToggle(key, name)} label={`Toggle ${name}`} />
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
              <p>Wins back customers who haven&apos;t visited in 90+ days</p>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Customers Contacted</div><div className={styles.metricCardValue} style={{ color: '#00B4D8' }}>24</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ this month</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Response Rate</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>29%</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 7 replied</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Revenue Recovered</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>$1,840</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 4 bookings</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Inactive Customers</div><div className={styles.metricCardValue} style={{ color: '#EF9F27' }}>61</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— in queue</div></div>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Recent Reactivations</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['Mike T.', 'Inactive 6 months — replied, booked oil change', 'green', 'Booked'], ['Thompson HVAC', 'Inactive 4 months — message sent', 'yellow', 'Sent'], ['Chris P.', 'Inactive 3 months — no reply yet', 'yellow', 'Awaiting']].map(([name, sub, dot, status]) => (
                      <li key={name} className={styles.agentItem}>
                        <span className={styles.agentItemIcon} style={{ background: '#0D0D1F' }} aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M17 8 C15.8 6.3 13.9 5 11.7 5 C8 5 5 8 5 11.7 C5 15.4 8 18.4 11.7 18.4 C14.7 18.4 17.2 16.4 18.1 13.6" stroke="#00B4D8" strokeWidth="1.5" fill="none" strokeLinecap="round"/><polyline points="17,4.5 17,8.5 13,8.5" stroke="#00B4D8" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                        <div className={styles.agentItemInfo}><div className={styles.agentItemName}>{name}</div><div className={styles.agentItemSub}>{sub}</div></div>
                        <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${dot === 'green' ? styles.statusDotGreen : styles.statusDotYellow}`}></span><span>{status}</span></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Agent Settings</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[
                      ['Auto-Reactivation', 'Send outreach automatically', 'reactivationAuto'],
                      ['Inactive Threshold — 90 days', 'Contact after 90 days of no visit', 'reactivationThreshold'],
                      ['Channel — SMS', 'Send via SMS (vs Email)', 'reactivationSMS'],
                    ].map(([name, sub, key]) => (
                      <li key={key} className={styles.agentItem}>
                        <div className={styles.agentItemInfo}><div className={styles.agentItemName}>{name}</div><div className={styles.agentItemSub}>{sub}</div></div>
                        <Toggle checked={automationToggles[key]} onChange={() => handleAutomationToggle(key, name)} label={`Toggle ${name}`} />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* === LEAD GENERATION === */}
        {activePage === 'leadGen' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Lead Generation</h1>
              <p>Finds and contacts new local business prospects automatically</p>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Leads Found Today</div><div className={styles.metricCardValue} style={{ color: '#28C840' }}>14</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 6 vs yesterday</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Leads Contacted</div><div className={styles.metricCardValue} style={{ color: '#378ADD' }}>9</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ auto-outreach sent</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Conversion Rate</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>11%</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 1 booked</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Pipeline Value</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>$2,100</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— est. this week</div></div>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Recent Leads</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[["Martinez Tire & Auto", 'Columbus, OH — outreach sent', 'green', 'Contacted'], ['Sunrise Auto Care', 'Columbus, OH — in pipeline', 'yellow', 'Queued'], ['FastLane Repairs', 'Westerville, OH — new lead', 'lime', 'Found']].map(([name, sub, dot, status]) => (
                      <li key={name} className={styles.agentItem}>
                        <span className={styles.agentItemIcon} style={{ background: '#0D1F0D' }} aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="7" stroke="#28C840" strokeWidth="1.5"/><circle cx="12" cy="12" r="3.5" stroke="#28C840" strokeWidth="1.5"/><circle cx="12" cy="12" r="1" fill="#28C840"/></svg>
                        </span>
                        <div className={styles.agentItemInfo}><div className={styles.agentItemName}>{name}</div><div className={styles.agentItemSub}>{sub}</div></div>
                        <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${dot === 'green' ? styles.statusDotGreen : dot === 'yellow' ? styles.statusDotYellow : styles.activityItemDotLime}`}></span><span>{status}</span></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Agent Settings</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[
                      ['Auto-Scrape', 'Automatically find new leads daily', 'leadAutoScrape'],
                      ['Target City', 'Focus on Columbus, OH area', 'leadTargetCity'],
                      ['Business Type Filter', 'Auto shops + service businesses', 'leadBusinessType'],
                    ].map(([name, sub, key]) => (
                      <li key={key} className={styles.agentItem}>
                        <div className={styles.agentItemInfo}><div className={styles.agentItemName}>{name}</div><div className={styles.agentItemSub}>{sub}</div></div>
                        <Toggle checked={automationToggles[key]} onChange={() => handleAutomationToggle(key, name)} label={`Toggle ${name}`} />
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
                <div className={styles.panelHeader}>
                  <span className={styles.panelTitle}>Business Profile</span>
                  {!isEditing ? (
                    <button style={btnEditStyle} onClick={() => setIsEditing(true)}>Edit</button>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button style={btnSaveStyle} onClick={handleSaveProfile} disabled={isSaving}>
                        {isSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button style={btnCancelStyle} onClick={() => setIsEditing(false)}>Cancel</button>
                    </div>
                  )}
                </div>
                <div className={styles.panelBody}>
                  {[
                    ['Business Name', 'business_name', 'text', 'Your business name'],
                    ['Phone Number', 'phone', 'tel', '(555) 800-1234'],
                    ['Business Hours', 'hours', 'text', 'Mon–Fri 8am–6pm'],
                  ].map(([label, field, type, placeholder]) => (
                    <div key={field} style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>{label}</label>
                      <input
                        type={type}
                        placeholder={placeholder}
                        value={settingsForm[field] || ''}
                        onChange={e => setSettingsForm(f => ({ ...f, [field]: e.target.value }))}
                        style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box' }}
                      />
                    </div>
                  ))}

                  {/* Company Logo */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>Company Logo URL</label>
                    <input
                      type="url"
                      placeholder="https://example.com/logo.png"
                      value={settingsForm.avatar_url || ''}
                      onChange={e => setSettingsForm(f => ({ ...f, avatar_url: e.target.value }))}
                      style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box' }}
                    />
                    {settingsForm.avatar_url && (
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img
                          src={settingsForm.avatar_url}
                          alt="Logo preview"
                          style={{ height: 48, maxWidth: 120, objectFit: 'contain', borderRadius: 6, border: '1px solid #333', background: '#111', padding: 4 }}
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                        <span style={{ fontSize: 11, color: '#666' }}>Preview — shows in topbar</span>
                      </div>
                    )}
                  </div>

                  {/* Google Review URL */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>Google Review URL</label>
                    <input
                      type="url"
                      placeholder="https://g.page/r/your-business/review"
                      value={settingsForm.google_review_url || ''}
                      onChange={e => setSettingsForm(f => ({ ...f, google_review_url: e.target.value }))}
                      style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box' }}
                    />
                    <div style={{ fontSize: 11, color: '#555', marginTop: 5 }}>Used in automated review request messages sent to customers.</div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>Email</label>
                    <input
                      type="email"
                      value={displayEmail}
                      disabled
                      style={{ width: '100%', background: '#111', border: '1px solid #222', borderRadius: 6, color: '#666', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box' }}
                    />
                  </div>
                  <button
                    onClick={saveSettings}
                    disabled={settingsSaving}
                    style={{ background: '#F5C400', border: 'none', color: '#000', borderRadius: 6, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}
                  >
                    {settingsSaving ? 'Saving...' : 'Save Settings'}
                  </button>
                  <Msg text={settingsMsg} />
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
                        <div className={styles.agentItemInfo}>
                          <div className={styles.agentItemName}>{name}</div>
                          <div className={styles.agentItemSub}>{sub}</div>
                        </div>
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
              <p>Your plan and payment details — pulled from Supabase</p>
            </div>
            {billingLoading && <p style={{ color: '#aaa' }}>Loading plan...</p>}
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
                    {
                      name: 'Starter',
                      key: 'starter',
                      price: '$297/mo',
                      color: '#378ADD',
                      features: ['Phone Agent (Alex)', 'Missed Call Text Back', 'Appointment Reminders', 'Review Requests', 'Dashboard Access']
                    },
                    {
                      name: 'Growth',
                      key: 'growth',
                      price: '$497/mo',
                      color: '#1D9E75',
                      features: ['Everything in Starter', 'Reactivation Agent', 'Post-Service Follow-Up', 'Lead Nurture (3-step)', 'Birthday Agent', 'Live Chat Agent']
                    },
                    {
                      name: 'Pro',
                      key: 'pro',
                      price: '$797/mo',
                      color: '#F5C400',
                      features: ['Everything in Growth', 'Outbound Sales Agent', 'Social Media Agent', 'Review Monitor', 'Invoice Follow-Up', 'Monthly Strategy Call']
                    },
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
                        {plan.features.map(f => (
                          <li key={f} style={{ fontSize: 13, color: '#ccc', padding: '3px 0' }}>✓ {f}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <Msg text={billingMsg} />
                </div>
              </div>

              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Invoice History</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['March 2026', '$297', 'starter'], ['February 2026', '$297', 'starter'], ['January 2026', '$297', 'starter']].map(([month, amount, plan]) => (
                      <li key={month} className={styles.agentItem}>
                        <span className={styles.agentItemIcon} style={{ background: '#1A1A1A' }} aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="18" rx="2" stroke="#888780" strokeWidth="1.5"/><line x1="8" y1="8" x2="16" y2="8" stroke="#888780" strokeWidth="1.4" strokeLinecap="round"/><line x1="8" y1="12" x2="16" y2="12" stroke="#888780" strokeWidth="1.4" strokeLinecap="round"/><line x1="8" y1="16" x2="12" y2="16" stroke="#888780" strokeWidth="1.4" strokeLinecap="round"/></svg>
                        </span>
                        <div className={styles.agentItemInfo}>
                          <div className={styles.agentItemName}>{month}</div>
                          <div className={styles.agentItemSub}>{amount} — {plan}</div>
                        </div>
                        <div className={styles.agentItemStatus}>
                          <span className={`${styles.statusDot} ${styles.statusDotGreen}`}></span>
                          <span>Paid</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div style={{ marginTop: 16, padding: 12, background: '#1a1a1a', borderRadius: 8, border: '1px solid #333' }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>PAYMENT METHOD</div>
                    <div style={{ fontSize: 13, color: '#ccc' }}>💳 Add payment method to enable auto-billing</div>
                    <button onClick={() => alert('Stripe billing coming soon!')} style={{ marginTop: 10, background: '#333', border: 'none', color: '#fff', borderRadius: 4, padding: '6px 16px', fontSize: 12, cursor: 'pointer' }}>Add Card via Stripe</button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* === ALL CLIENTS === */}
        {activePage === 'clients' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>All Clients</h1>
              <p>Manage your client accounts and trigger automations</p>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Total Clients</div><div className={styles.metricCardValue} style={{ color: '#7B2FFF' }}>{clients.length}</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ all time</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Active</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>{clients.filter(c => c.active).length}</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ paying</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>MRR</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>${clients.filter(c => c.active).reduce((a, c) => a + (c.plan === 'pro' ? 797 : c.plan === 'growth' ? 497 : 297), 0).toLocaleString()}</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ monthly</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>ARR</div><div className={styles.metricCardValue}>${(clients.filter(c => c.active).reduce((a, c) => a + (c.plan === 'pro' ? 797 : c.plan === 'growth' ? 497 : 297), 0) * 12).toLocaleString()}</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— projected</div></div>
            </div>
            <div className={styles.panel}>
              <div className={styles.panelHeader}><span className={styles.panelTitle}>Client List</span></div>
              <div className={styles.panelBody}>
                {clientsLoading && <p style={{ color: '#aaa', padding: '12px 0' }}>Loading clients...</p>}
                {!clientsLoading && clients.length === 0 && <p style={{ color: '#aaa', padding: '12px 0' }}>No clients yet — add your first one!</p>}
                <ul className={styles.agentList}>
                  {clients.map((client) => (
                    <li key={client.id} className={styles.agentItem}>
                      <div className={styles.agentItemInfo}>
                        <div className={styles.agentItemName}>{client.business_name || client.name}</div>
                        <div className={styles.agentItemSub}>{client.email} · {client.phone || 'No phone'}</div>
                      </div>
                      <div className={styles.agentItemStatus}>
                        <span className={`${styles.statusDot} ${client.active ? styles.statusDotGreen : styles.statusDotRed}`}></span>
                        <span style={{ textTransform: 'capitalize' }}>{client.plan || 'starter'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select
                          value={triggerForm.automation}
                          onChange={e => setTriggerForm(f => ({ ...f, automation: e.target.value }))}
                          style={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: 4, padding: '4px 8px', fontSize: 12 }}
                        >
                          <option value="review-request">Review Request</option>
                          <option value="reactivation">Reactivation</option>
                          <option value="appointment-reminder">Appt Reminder</option>
                          <option value="post-service-followup">Post Service</option>
                          <option value="lead-nurture">Lead Nurture</option>
                          <option value="missed-call-followup">Missed Call</option>
                        </select>
                        <input
                          placeholder="Customer phone"
                          value={triggerForm.phone_number}
                          onChange={e => setTriggerForm(f => ({ ...f, phone_number: e.target.value }))}
                          style={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: 4, padding: '4px 8px', fontSize: 12, width: 120 }}
                        />
                        <input
                          placeholder="Customer name"
                          value={triggerForm.customer_name}
                          onChange={e => setTriggerForm(f => ({ ...f, customer_name: e.target.value }))}
                          style={{ background: '#1a1a1a', border: '1px solid #333', color: '#fff', borderRadius: 4, padding: '4px 8px', fontSize: 12, width: 120 }}
                        />
                        <button
                          onClick={() => triggerAutomation(client.id, client.business_name)}
                          style={{ background: '#7B2FFF', border: 'none', color: '#fff', borderRadius: 4, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}
                        >
                          Fire
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <Msg text={triggerMsg} />
              </div>
            </div>
          </section>
        )}

        {/* === ADD CLIENT === */}
        {activePage === 'add-client' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Add Client</h1>
              <p>Onboard a new client to TheHypeBox</p>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Client Details</span></div>
                <div className={styles.panelBody}>
                  {[
                    ['Business Name', 'business_name', 'text', "Dave's Plumbing"],
                    ['Owner Name', 'name', 'text', 'Dave Smith'],
                    ['Email', 'email', 'email', 'dave@davesplumbing.com'],
                    ['Phone', 'phone', 'tel', '(555) 800-1234'],
                  ].map(([label, field, type, placeholder]) => (
                    <div key={field} style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>{label}</label>
                      <input
                        type={type}
                        placeholder={placeholder}
                        value={addClientForm[field]}
                        onChange={e => setAddClientForm(f => ({ ...f, [field]: e.target.value }))}
                        style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '8px 12px', fontSize: 14, boxSizing: 'border-box' }}
                      />
                    </div>
                  ))}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>Plan</label>
                    <select
                      value={addClientForm.plan}
                      onChange={e => setAddClientForm(f => ({ ...f, plan: e.target.value }))}
                      style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, color: '#fff', padding: '8px 12px', fontSize: 14 }}
                    >
                      <option value="starter">Starter — $297/mo</option>
                      <option value="growth">Growth — $497/mo</option>
                      <option value="pro">Pro — $797/mo</option>
                    </select>
                  </div>
                  <button
                    onClick={addClient}
                    disabled={addClientSaving}
                    style={{ background: '#1D9E75', border: 'none', color: '#fff', borderRadius: 6, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}
                  >
                    {addClientSaving ? 'Adding...' : 'Add Client'}
                  </button>
                  <Msg text={addClientMsg} />
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>What Happens Next</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[
                      ['1. Account Created', 'Client added to Supabase with login access'],
                      ['2. Welcome SMS Sent', 'Client gets a text with their login link'],
                      ['3. Alex Goes Live', 'Phone agent starts answering their calls'],
                      ['4. Automations Active', 'All plan automations activate immediately'],
                      ['5. Dashboard Access', 'Client can log in and see their stats'],
                    ].map(([name, sub]) => (
                      <li key={name} className={styles.agentItem}>
                        <div className={styles.agentItemInfo}>
                          <div className={styles.agentItemName}>{name}</div>
                          <div className={styles.agentItemSub}>{sub}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* === AUTOMATION LOGS === */}
        {activePage === 'automation-logs' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Automation Logs</h1>
              <p>Every automation fired across all clients</p>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Sent Today</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>{automationLogs.filter(l => new Date(l.triggered_at).toDateString() === new Date().toDateString()).length}</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ today</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Sent This Week</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>{automationLogs.filter(l => new Date(l.triggered_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 7 days</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Total Sent</div><div className={styles.metricCardValue}>{automationLogs.length}</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— all time</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Success Rate</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>{automationLogs.length > 0 ? Math.round(automationLogs.filter(l => l.status === 'sent').length / automationLogs.length * 100) : 0}%</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ delivered</div></div>
            </div>
            <div className={styles.panel}>
              <div className={styles.panelHeader}><span className={styles.panelTitle}>Recent Automations</span></div>
              <div className={styles.panelBody}>
                {automationLogs.length === 0 && <p style={{ color: '#aaa', padding: '12px 0' }}>No automations fired yet.</p>}
                <ul className={styles.agentList}>
                  {automationLogs.map((log) => (
                    <li key={log.id} className={styles.agentItem}>
                      <div className={styles.agentItemInfo}>
                        <div className={styles.agentItemName} style={{ textTransform: 'capitalize' }}>{log.automation?.replace(/-/g, ' ')}</div>
                        <div className={styles.agentItemSub}>{new Date(log.triggered_at).toLocaleString()}</div>
                      </div>
                      <div className={styles.agentItemStatus}>
                        <span className={`${styles.statusDot} ${log.status === 'sent' ? styles.statusDotGreen : styles.statusDotRed}`}></span>
                        <span>{log.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

      </main>
    </div>
  );
}

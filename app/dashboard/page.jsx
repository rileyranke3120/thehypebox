'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import styles from '@/styles/dashboard.module.css';

const autoEvents = [
  ['Phone answered — oil change inquiry resolved.', 'blue'],
  ['Appointment booked — Dave K. for Friday 2pm.', 'green'],
  ['Invoice #1043 flagged — Garcia Auto 4 days overdue.', 'yellow'],
  ['CRM follow-up sent to Lisa R. — 90 day re-engagement.', 'purple'],
  ['New lead captured — brake inspection via chatbot.', 'lime'],
  ['Phone answered — hours inquiry resolved.', 'blue'],
  ['Appointment booked — Sarah M. rescheduled to Mon.', 'green'],
  ['Invoice #1044 sent — $180 to Thompson HVAC.', 'yellow'],
  ['CRM follow-up sent to Mike T. — review request.', 'purple'],
  ['New lead captured — website chatbot, tire rotation.', 'lime'],
];

export default function DashboardPage() {
  const { data: session } = useSession();

  const userName = session?.user?.name || 'Your Business';
  const userEmail = session?.user?.email || '';
  const userInitials = userName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  const [activePage, setActivePage] = useState('overview');
  const [activityItems, setActivityItems] = useState([
    { text: 'Call answered — customer asked about oil change pricing.', time: '2 min ago', type: 'blue' },
    { text: 'Appointment booked — Sarah M. for Thursday 10am.', time: '8 min ago', type: 'green' },
    { text: "Invoice #1042 flagged — Dave's Plumbing $340 overdue.", time: '22 min ago', type: 'yellow' },
    { text: 'CRM follow-up sent to Mike T. — last visit was 6 months ago.', time: '1 hr ago', type: 'purple' },
    { text: 'New lead captured — tire rotation inquiry via chatbot.', time: '1 hr ago', type: 'lime' },
  ]);
  const [metrics, setMetrics] = useState({ calls: 47, appointments: 12, revenue: '$4,820' });
  const autoIndexRef = useRef(0);

  // Agent toggle states
  const [agentToggles, setAgentToggles] = useState({
    phone: true,
    scheduling: true,
    accounting: true,
    crm: true,
  });

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
    const addActivity = (text, type) => {
      setActivityItems((prev) => {
        const newItem = { text, time: 'Just now', type };
        return [newItem, ...prev].slice(0, 5);
      });
    };

    const activityInterval = setInterval(() => {
      const ev = autoEvents[autoIndexRef.current % autoEvents.length];
      autoIndexRef.current++;
      addActivity(ev[0], ev[1]);
    }, 3000);

    const metricsInterval = setInterval(() => {
      setMetrics({
        calls: 47 + Math.floor((Math.random() - 0.5) * 6),
        appointments: 12 + Math.floor((Math.random() - 0.5) * 4),
        revenue: '$' + (4820 + Math.floor((Math.random() - 0.5) * 200)).toLocaleString(),
      });
    }, 8000);

    return () => {
      clearInterval(activityInterval);
      clearInterval(metricsInterval);
    };
  }, []);

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

  const handleAutomationToggle = (key, label) => {
    const newVal = !automationToggles[key];
    setAutomationToggles((prev) => ({ ...prev, [key]: newVal }));
    setActivityItems((prev) => {
      const newItem = { text: `${label} ${newVal ? 'enabled' : 'disabled'}.`, time: 'Just now', type: 'yellow' };
      return [newItem, ...prev].slice(0, 5);
    });
  };

  const navItems = [
    {
      section: 'Overview',
      items: [
        {
          page: 'overview', label: 'Dashboard', icon: (
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
          page: 'phone', label: 'Phone Agent', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#0D1F35', display: 'block' }}>
              <path d="M11 17 C10.5 18.5 11 20.5 13 21.5 C14 22 15 21.5 16.5 20 C17.3 19.2 17.3 18 16.5 17.2 L15.75 16.45 C15.5 16.2 15.5 15.8 15.75 15.55 L17.45 13.85 C17.7 13.6 18.1 13.6 18.35 13.85 L19.1 14.6 C19.9 15.4 21.1 15.4 21.9 14.6 L23 13.5 C23.8 12.7 23.8 11.5 23 10.7 C21.5 9.2 19 8.5 17 9 C15 9.5 11.5 14.5 11 17 Z" stroke="#378ADD" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
            </svg>
          )
        },
        {
          page: 'scheduling', label: 'Scheduling', icon: (
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
          page: 'accounting', label: 'Accounting', icon: (
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
          page: 'crm', label: 'CRM', icon: (
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
          page: 'missedCall', label: 'Missed Call Text Back', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#1F0D0D', display: 'block' }}>
              <path d="M11 17 C10.5 18.5 11 20.5 13 21.5 C14 22 15 21.5 16.5 20 C17.3 19.2 17.3 18 16.5 17.2 L15.75 16.45 C15.5 16.2 15.5 15.8 15.75 15.55 L17.45 13.85 C17.7 13.6 18.1 13.6 18.35 13.85 L19.1 14.6 C19.9 15.4 21.1 15.4 21.9 14.6 L23 13.5 C23.8 12.7 23.8 11.5 23 10.7 C21.5 9.2 19 8.5 17 9 C15 9.5 11.5 14.5 11 17 Z" stroke="#FF4444" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
              <line x1="22" y1="6" x2="26" y2="10" stroke="#FF4444" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="26" y1="6" x2="22" y2="10" stroke="#FF4444" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )
        },
        {
          page: 'reviewRequest', label: 'Review Request Agent', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#1A1500', display: 'block' }}>
              <path d="M16 7 L18.2 12.4 L24 13 L19.8 17 L21.2 23 L16 20 L10.8 23 L12.2 17 L8 13 L13.8 12.4 Z" stroke="#F5C400" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
            </svg>
          )
        },
        {
          page: 'reactivation', label: 'Reactivation Agent', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#0D0D1F', display: 'block' }}>
              <path d="M22 10 C20.3 8 17.8 7 15 7 C10.6 7 7 10.6 7 15 C7 19.4 10.6 23 15 23 C18.8 23 22 20.4 22.8 16.8" stroke="#00B4D8" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <polyline points="22,6 22,11 17,11" stroke="#00B4D8" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )
        },
        {
          page: 'leadGen', label: 'Lead Generation', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#0D1F0D', display: 'block' }}>
              <circle cx="16" cy="16" r="9" stroke="#28C840" strokeWidth="1.5"/>
              <circle cx="16" cy="16" r="5" stroke="#28C840" strokeWidth="1.5"/>
              <circle cx="16" cy="16" r="1.5" fill="#28C840"/>
              <line x1="16" y1="7" x2="16" y2="5" stroke="#28C840" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="16" y1="27" x2="16" y2="25" stroke="#28C840" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="7" y1="16" x2="5" y2="16" stroke="#28C840" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="27" y1="16" x2="25" y2="16" stroke="#28C840" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )
        },
      ]
    },
    {
      section: 'Account',
      items: [
        {
          page: 'settings', label: 'Settings', icon: (
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
          page: 'billing', label: 'Billing', icon: (
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
          <Link href="/" className={styles.topbarLogo} aria-label="TheHypeBox — Back to site">THE<span>HYPE</span>BOX</Link>
          <span className={styles.topbarCc}>Command Center</span>
        </div>
        <div className={styles.topbarRight}>
          <div className={styles.topbarStatus}>
            <span className={`${styles.statusDot} ${styles.statusDotGreen}`}></span>
            All systems operational
          </div>
          <div className={styles.topbarUser}>
            <div className={styles.topbarAvatar} aria-hidden="true">{userInitials}</div>
            <span>{userName}</span>
          </div>
        </div>
      </header>

      {/* SIDEBAR */}
      <nav className={styles.sidebar} aria-label="Dashboard navigation">
        {navItems.map(({ section, items }) => (
          <div key={section}>
            <span className={styles.sidebarSectionLabel}>{section}</span>
            <ul className={styles.sidebarNav}>
              {items.map(({ page, label, icon }) => (
                <li key={page}>
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); setActivePage(page); }}
                    className={activePage === page ? styles.sidebarNavActive : ''}
                  >
                    <span className={styles.sidebarIcon} aria-hidden="true">{icon}</span>
                    {label}
                  </a>
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
      <main className={styles.main} id="main-content">

        {/* === OVERVIEW === */}
        {activePage === 'overview' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Command Center</h1>
              <p>Today&apos;s snapshot — updated live</p>
            </div>

            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}>
                <div className={styles.metricCardLabel}>Calls Today</div>
                <div className={styles.metricCardValue} style={{ color: '#378ADD' }}>{metrics.calls}</div>
                <div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 12% vs yesterday</div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricCardLabel}>Appointments</div>
                <div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>{metrics.appointments}</div>
                <div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 3 new today</div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricCardLabel}>Revenue Today</div>
                <div className={styles.metricCardValue} style={{ color: '#F5C400' }}>{metrics.revenue}</div>
                <div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 8% vs avg</div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricCardLabel}>Open Invoices</div>
                <div className={styles.metricCardValue} style={{ color: '#EF9F27' }}>3</div>
                <div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— no change</div>
              </div>
            </div>

            <div className={styles.contentGrid}>
              {/* Agent Status */}
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <span className={styles.panelTitle}>Agent Status</span>
                  <span className={styles.tag}>4 Active</span>
                </div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    <li className={styles.agentItem}>
                      <span className={styles.agentItemIcon} style={{ background: '#0D1F35' }} aria-hidden="true">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M8 12.5 C7.5 13.8 8 15.5 9.7 16.3 C10.5 16.8 11.2 16.3 12.4 15.1 C13 14.5 13 13.7 12.4 13.1 L11.8 12.5 C11.6 12.3 11.6 11.9 11.8 11.7 L13.1 10.4 C13.3 10.2 13.7 10.2 13.9 10.4 L14.5 11 C15.1 11.6 15.9 11.6 16.5 11 L17.5 10 C18.1 9.4 18.1 8.6 17.5 8 C16.3 6.8 14.2 6.4 12.8 7 C11.4 7.6 8.5 11.2 8 12.5 Z" stroke="#378ADD" strokeWidth="1.5" fill="none" strokeLinejoin="round"/></svg>
                      </span>
                      <div className={styles.agentItemInfo}>
                        <div className={styles.agentItemName}>Phone Agent</div>
                        <div className={styles.agentItemSub}>47 calls handled today</div>
                      </div>
                      <div className={styles.agentItemStatus}>
                        <span className={`${styles.statusDot} ${agentToggles.phone ? styles.statusDotGreen : ''}`}></span>
                        <span>{agentToggles.phone ? 'Active' : 'Paused'}</span>
                      </div>
                      <Toggle checked={agentToggles.phone} onChange={() => handleAgentToggle('phone', 'Phone Agent')} label="Toggle Phone Agent" />
                    </li>
                    <li className={styles.agentItem}>
                      <span className={styles.agentItemIcon} style={{ background: '#0D2018' }} aria-hidden="true">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="15" rx="2" stroke="#1D9E75" strokeWidth="1.5" fill="none"/><line x1="3" y1="10" x2="21" y2="10" stroke="#1D9E75" strokeWidth="1.5"/><line x1="8" y1="5" x2="8" y2="3" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="5" x2="16" y2="3" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="14" r="1.1" fill="#1D9E75"/><circle cx="12" cy="14" r="1.1" fill="#1D9E75"/><circle cx="16" cy="14" r="1.1" fill="#1D9E75"/></svg>
                      </span>
                      <div className={styles.agentItemInfo}>
                        <div className={styles.agentItemName}>Scheduling Agent</div>
                        <div className={styles.agentItemSub}>12 appointments today</div>
                      </div>
                      <div className={styles.agentItemStatus}>
                        <span className={`${styles.statusDot} ${agentToggles.scheduling ? styles.statusDotGreen : ''}`}></span>
                        <span>{agentToggles.scheduling ? 'Active' : 'Paused'}</span>
                      </div>
                      <Toggle checked={agentToggles.scheduling} onChange={() => handleAgentToggle('scheduling', 'Scheduling Agent')} label="Toggle Scheduling Agent" />
                    </li>
                    <li className={styles.agentItem}>
                      <span className={styles.agentItemIcon} style={{ background: '#1A0D00' }} aria-hidden="true">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><line x1="4" y1="3.5" x2="4" y2="19.5" stroke="#EF9F27" strokeWidth="1.5" strokeLinecap="round"/><line x1="4" y1="19.5" x2="20" y2="19.5" stroke="#EF9F27" strokeWidth="1.5" strokeLinecap="round"/><rect x="5.5" y="15" width="3.5" height="4.5" fill="#EF9F27"/><rect x="10.5" y="9" width="3.5" height="10.5" fill="#EF9F27"/><rect x="15.5" y="12" width="3.5" height="7.5" fill="#EF9F27"/></svg>
                      </span>
                      <div className={styles.agentItemInfo}>
                        <div className={styles.agentItemName}>Accounting Agent</div>
                        <div className={styles.agentItemSub}>3 invoices pending</div>
                      </div>
                      <div className={styles.agentItemStatus}>
                        <span className={`${styles.statusDot} ${agentToggles.accounting ? styles.statusDotYellow : ''}`}></span>
                        <span>{agentToggles.accounting ? 'Attention' : 'Paused'}</span>
                      </div>
                      <Toggle checked={agentToggles.accounting} onChange={() => handleAgentToggle('accounting', 'Accounting Agent')} label="Toggle Accounting Agent" />
                    </li>
                    <li className={styles.agentItem}>
                      <span className={styles.agentItemIcon} style={{ background: '#160D2A' }} aria-hidden="true">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="2.8" stroke="#7B2FFF" strokeWidth="1.5" fill="none"/><path d="M3.5 19.5 C3.5 15.9 6 13 9 13 C12 13 14.5 15.9 14.5 19.5" stroke="#7B2FFF" strokeWidth="1.5" fill="none" strokeLinecap="round"/><circle cx="17.5" cy="7.5" r="2.2" stroke="#7B2FFF" strokeWidth="1.5" fill="none" opacity="0.65"/><path d="M14 19 C14 16 15.5 13.5 17.5 13.5 C19.5 13.5 21 16 21 19" stroke="#7B2FFF" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.65"/></svg>
                      </span>
                      <div className={styles.agentItemInfo}>
                        <div className={styles.agentItemName}>CRM Agent</div>
                        <div className={styles.agentItemSub}>2 follow-ups queued</div>
                      </div>
                      <div className={styles.agentItemStatus}>
                        <span className={`${styles.statusDot} ${agentToggles.crm ? styles.statusDotGreen : ''}`}></span>
                        <span>{agentToggles.crm ? 'Active' : 'Paused'}</span>
                      </div>
                      <Toggle checked={agentToggles.crm} onChange={() => handleAgentToggle('crm', 'CRM Agent')} label="Toggle CRM Agent" />
                    </li>
                  </ul>
                </div>
              </div>

              {/* Live Activity */}
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <span className={styles.panelTitle}>Live Activity</span>
                </div>
                <div className={styles.panelBody}>
                  <ul className={styles.activityFeed}>
                    {activityItems.map((item, i) => (
                      <li key={i} className={styles.activityItem}>
                        <span className={`${styles.activityItemDot} ${getDotClass(item.type)}`}></span>
                        <div>
                          <div className={styles.activityItemText}>{item.text}</div>
                          <div className={styles.activityItemTime}>{item.time}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Recent Calls Table */}
            <div className={`${styles.panel} ${styles.panelFull}`}>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>Recent Calls</span>
              </div>
              <div className={styles.panelBody}>
                <table className={styles.callsTable}>
                  <thead>
                    <tr>
                      <th>Caller</th>
                      <th>Time</th>
                      <th>Duration</th>
                      <th>Outcome</th>
                      <th>Agent</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>(555) 204-1187</td><td>2 min ago</td><td>1m 22s</td><td><span className={`${styles.outcomeTag} ${styles.outcomeResolved}`}>Resolved</span></td><td>Phone Agent</td></tr>
                    <tr><td>(555) 391-0042</td><td>1 hr ago</td><td>2m 08s</td><td><span className={`${styles.outcomeTag} ${styles.outcomeBooked}`}>Booked</span></td><td>Phone Agent</td></tr>
                    <tr><td>(555) 877-3300</td><td>2 hr ago</td><td>0m 54s</td><td><span className={`${styles.outcomeTag} ${styles.outcomeResolved}`}>Resolved</span></td><td>Phone Agent</td></tr>
                    <tr><td>(555) 103-9921</td><td>3 hr ago</td><td>3m 17s</td><td><span className={`${styles.outcomeTag} ${styles.outcomeEscalated}`}>Escalated</span></td><td>Phone Agent</td></tr>
                    <tr><td>(555) 648-2204</td><td>4 hr ago</td><td>—</td><td><span className={`${styles.outcomeTag} ${styles.outcomeMissed}`}>Missed</span></td><td>Phone Agent</td></tr>
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
              <h1>Alex — Phone Agent</h1>
              <p>Retell AI · Agent ID: agent_6ebde3bccbc96f8fca6da9b42c · (856) 363-0633</p>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}>
                <div className={styles.metricCardLabel}>Calls (recent)</div>
                <div className={styles.metricCardValue} style={{ color: '#378ADD' }}>
                  {retellLoading ? '…' : retellCalls.length || '—'}
                </div>
                <div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>live from Retell</div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricCardLabel}>Avg Call Duration</div>
                <div className={styles.metricCardValue}>{retellLoading ? '…' : retellMetrics.avgDur}</div>
                <div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— last 5 calls</div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricCardLabel}>Resolved</div>
                <div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>
                  {retellLoading ? '…' : retellMetrics.resolvedPct}
                </div>
                <div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>without transfer</div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricCardLabel}>Missed / VM</div>
                <div className={styles.metricCardValue} style={{ color: retellMetrics.missed > 0 ? '#E24B4A' : '#28C840' }}>
                  {retellLoading ? '…' : retellMetrics.missed}
                </div>
                <div className={`${styles.metricCardDelta} ${retellMetrics.missed === 0 ? styles.deltaUp : styles.deltaDown}`}>
                  {retellMetrics.missed === 0 ? '↑ Perfect' : '↓ review needed'}
                </div>
              </div>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <span className={styles.panelTitle}>Recent Calls</span>
                  {retellLoading && <span className={styles.tag}>Loading…</span>}
                </div>
                <div className={styles.panelBody}>
                  {retellCalls.length === 0 && !retellLoading ? (
                    <ul className={styles.agentList}>
                      <li className={styles.agentItem}>
                        <div className={styles.agentItemInfo}>
                          <div className={styles.agentItemName}>No calls found</div>
                          <div className={styles.agentItemSub}>Add RETELL_API_KEY to .env.local to load live data</div>
                        </div>
                      </li>
                    </ul>
                  ) : (
                    <table className={styles.callsTable}>
                      <thead>
                        <tr>
                          <th>From</th>
                          <th>Time</th>
                          <th>Duration</th>
                          <th>Outcome</th>
                        </tr>
                      </thead>
                      <tbody>
                        {retellCalls.map((call) => (
                          <tr key={call.id}>
                            <td>{call.from}</td>
                            <td>{call.time}</td>
                            <td>{call.duration}</td>
                            <td>
                              <span className={`${styles.outcomeTag} ${retellOutcomeClass(call.outcome)}`}>
                                {call.outcome}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Alex — Configuration</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[
                      ['After-Hours Mode', 'Takes messages when business is closed', true],
                      ['Voicemail Detection', 'Skip VM, leave no message', true],
                      ['Call Summaries', 'Email recap after each call', true],
                      ['Transfer Escalations', 'Forward urgent calls to owner', false],
                    ].map(([name, sub, def]) => (
                      <li key={name} className={styles.agentItem}>
                        <div className={styles.agentItemInfo}>
                          <div className={styles.agentItemName}>{name}</div>
                          <div className={styles.agentItemSub}>{sub}</div>
                        </div>
                        <Toggle checked={def} onChange={() => {}} label={`Toggle ${name}`} />
                      </li>
                    ))}
                  </ul>
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
              <p>Click any day to add an appointment — stored in Supabase in real time</p>
            </div>

            {/* Metrics from appointments data */}
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}>
                <div className={styles.metricCardLabel}>This Week</div>
                <div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>{appointments.length}</div>
                <div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— appointments</div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricCardLabel}>Today</div>
                <div className={styles.metricCardValue}>{appointments.filter((a) => a.appointment_date === todayStr).length}</div>
                <div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— scheduled</div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricCardLabel}>Week Of</div>
                <div className={styles.metricCardValue} style={{ fontSize: '1.1rem', paddingTop: '4px' }}>
                  {calWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— {calWeekStart.getFullYear()}</div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricCardLabel}>Click to Add</div>
                <div className={styles.metricCardValue} style={{ color: '#F5C400', fontSize: '1.6rem' }}>+</div>
                <div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— tap any day</div>
              </div>
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
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Upcoming Appointments</span></div>
                <div className={styles.panelBody}>
                  {appointments.length === 0 ? (
                    <ul className={styles.agentList}>
                      <li className={styles.agentItem}>
                        <div className={styles.agentItemInfo}>
                          <div className={styles.agentItemName}>No appointments this week</div>
                          <div className={styles.agentItemSub}>Click any day on the calendar to add one</div>
                        </div>
                      </li>
                    </ul>
                  ) : (
                    <ul className={styles.agentList}>
                      {appointments.slice(0, 5).map((appt) => (
                        <li key={appt.id} className={styles.agentItem}>
                          <span className={styles.agentItemIcon} style={{ background: '#0D2018' }} aria-hidden="true">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="#1D9E75" strokeWidth="1.5" fill="none"/><line x1="12" y1="7" x2="12" y2="12" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/><line x1="12" y1="12" x2="15.5" y2="14.5" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          </span>
                          <div className={styles.agentItemInfo}>
                            <div className={styles.agentItemName}>{appt.customer_name} — {appt.appointment_time?.slice(0, 5)}</div>
                            <div className={styles.agentItemSub}>{appt.service}{appt.phone ? ` · ${appt.phone}` : ''}</div>
                          </div>
                          <div className={styles.agentItemStatus}>
                            <span className={`${styles.statusDot} ${appt.appointment_date === todayStr ? styles.statusDotGreen : styles.statusDotYellow}`}></span>
                            <span>{appt.appointment_date === todayStr ? 'Today' : appt.appointment_date}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Agent Settings</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['Auto-Book', 'Book without your approval', true], ['Reminder SMS', 'Send 24hr reminder to customers', true], ['Waitlist Auto-Fill', 'Fill cancellations from waitlist', true]].map(([name, sub, def]) => (
                      <li key={name} className={styles.agentItem}>
                        <div className={styles.agentItemInfo}><div className={styles.agentItemName}>{name}</div><div className={styles.agentItemSub}>{sub}</div></div>
                        <Toggle checked={def} onChange={() => {}} label={`Toggle ${name}`} />
                      </li>
                    ))}
                  </ul>
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
                    {[['Auto-Invoice', 'Send invoice after job completion', true], ['Overdue Reminders', 'Nudge after 3 days unpaid', true], ['Monthly P&L Report', 'Email summary on 1st of month', true]].map(([name, sub, def]) => (
                      <li key={name} className={styles.agentItem}>
                        <div className={styles.agentItemInfo}><div className={styles.agentItemName}>{name}</div><div className={styles.agentItemSub}>{sub}</div></div>
                        <Toggle checked={def} onChange={() => {}} label={`Toggle ${name}`} />
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
                    {[['Auto Follow-Up', 'Message customers after service', true], ['Re-Engagement', 'Reach out after 90 days inactive', true], ['Birthday Messages', 'Auto-send birthday offers', false]].map(([name, sub, def]) => (
                      <li key={name} className={styles.agentItem}>
                        <div className={styles.agentItemInfo}><div className={styles.agentItemName}>{name}</div><div className={styles.agentItemSub}>{sub}</div></div>
                        <Toggle checked={def} onChange={() => {}} label={`Toggle ${name}`} />
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
              <p>Manage your account and preferences</p>
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
                  <ul className={styles.agentList}>
                    {[
                      ['Business Name', 'name', profileData.name],
                      ['Email', 'email', profileData.email],
                      ['Phone', 'phone', profileData.phone],
                      ['Address', 'address', profileData.address],
                      ['Business Hours', 'businessHours', profileData.businessHours],
                      ['Website', 'website', profileData.website],
                    ].map(([label, field, value]) => (
                      <li key={field} className={styles.agentItem}>
                        <div className={styles.agentItemInfo} style={{ flex: 1 }}>
                          <div className={styles.agentItemName}>{label}</div>
                          {isEditing ? (
                            <input
                              style={inputStyle}
                              value={value}
                              disabled={field === 'email'}
                              placeholder={field === 'email' ? 'From your account' : `Enter ${label.toLowerCase()}`}
                              onChange={(e) => setProfileData((prev) => ({ ...prev, [field]: e.target.value }))}
                            />
                          ) : (
                            <div className={styles.agentItemSub}>{value || <span style={{ color: '#555' }}>Not set</span>}</div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Notifications</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['Daily Summary Email', 'Recap sent each morning', true], ['Alert on Urgent Calls', 'Text you for escalations', true], ['New Customer Alert', 'Notify when first-time customer calls', false]].map(([name, sub, def]) => (
                      <li key={name} className={styles.agentItem}>
                        <div className={styles.agentItemInfo}><div className={styles.agentItemName}>{name}</div><div className={styles.agentItemSub}>{sub}</div></div>
                        <Toggle checked={def} onChange={() => {}} label={`Toggle ${name}`} />
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
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}>
                  <span className={styles.panelTitle}>Current Plan</span>
                  <span className={styles.tag}>{planName}</span>
                </div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[
                      ['Plan', `${planName} — ${planPrice}/mo`],
                      ['Next Billing Date', nextBillingDate],
                      ['Payment Method', 'Visa ending in 4242'],
                    ].map(([name, sub]) => (
                      <li key={name} className={styles.agentItem}>
                        <div className={styles.agentItemInfo}>
                          <div className={styles.agentItemName}>{name}</div>
                          <div className={styles.agentItemSub}>{sub}</div>
                        </div>
                      </li>
                    ))}
                    <li className={styles.agentItem}>
                      <div className={styles.agentItemInfo}>
                        <div className={styles.agentItemName}>Status</div>
                        <div className={styles.agentItemSub}>Active — all agents included</div>
                      </div>
                      <div className={styles.agentItemStatus}>
                        <span className={`${styles.statusDot} ${styles.statusDotGreen}`}></span>
                        <span>Paid</span>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Invoice History</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {(() => {
                      if (!billingData.createdAt) return [['March 2026', planPrice], ['February 2026', planPrice], ['January 2026', planPrice]];
                      const base = new Date(billingData.createdAt);
                      return [0, 1, 2].map((i) => {
                        const d = new Date(base);
                        d.setDate(d.getDate() + 30 * (Math.floor((new Date() - base) / (30 * 86400000)) - i));
                        return [
                          d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                          planPrice,
                        ];
                      });
                    })().map(([month, amount]) => (
                      <li key={month} className={styles.agentItem}>
                        <span className={styles.agentItemIcon} style={{ background: '#1A1A1A' }} aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="18" rx="2" stroke="#888780" strokeWidth="1.5"/><line x1="8" y1="8" x2="16" y2="8" stroke="#888780" strokeWidth="1.4" strokeLinecap="round"/><line x1="8" y1="12" x2="16" y2="12" stroke="#888780" strokeWidth="1.4" strokeLinecap="round"/><line x1="8" y1="16" x2="12" y2="16" stroke="#888780" strokeWidth="1.4" strokeLinecap="round"/></svg>
                        </span>
                        <div className={styles.agentItemInfo}>
                          <div className={styles.agentItemName}>{month}</div>
                          <div className={styles.agentItemSub}>{amount}</div>
                        </div>
                        <div className={styles.agentItemStatus}>
                          <span className={`${styles.statusDot} ${styles.statusDotGreen}`}></span>
                          <span>Paid</span>
                        </div>
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

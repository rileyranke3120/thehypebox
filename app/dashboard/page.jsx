'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import styles from '@/styles/dashboard.module.css';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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

function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [activePage, setActivePage] = useState('overview');

  const [calls, setCalls] = useState([]);
  const [callsLoading, setCallsLoading] = useState(false);

  useEffect(() => {
    if (activePage !== 'phone') return;
    setCallsLoading(true);
    fetch('/api/retell/calls')
      .then((r) => r.json())
      .then((data) => setCalls(data.calls || []))
      .catch(() => setCalls([]))
      .finally(() => setCallsLoading(false));
  }, [activePage]);
  const [activityItems, setActivityItems] = useState([
    { text: 'Call answered — customer asked about oil change pricing.', time: '2 min ago', type: 'blue' },
    { text: 'Appointment booked — Sarah M. for Thursday 10am.', time: '8 min ago', type: 'green' },
    { text: "Invoice #1042 flagged — Dave's Plumbing $340 overdue.", time: '22 min ago', type: 'yellow' },
    { text: 'CRM follow-up sent to Mike T. — last visit was 6 months ago.', time: '1 hr ago', type: 'purple' },
    { text: 'New lead captured — tire rotation inquiry via chatbot.', time: '1 hr ago', type: 'lime' },
  ]);
  const [metrics, setMetrics] = useState({ calls: 47, appointments: 12, revenue: '$4,820' });
  const autoIndexRef = useRef(0);

  const [agentToggles, setAgentToggles] = useState({
    phone: true, scheduling: true, accounting: true, crm: true,
  });

  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [addClientForm, setAddClientForm] = useState({ name: '', email: '', business_name: '', phone: '', plan: 'starter' });
  const [addClientMsg, setAddClientMsg] = useState('');
  const [addClientSaving, setAddClientSaving] = useState(false);
  const [automationLogs, setAutomationLogs] = useState([]);
  const [triggerForm, setTriggerForm] = useState({ automation: 'review-request', phone_number: '', customer_name: '' });
  const [triggerMsg, setTriggerMsg] = useState('');
  const [settingsForm, setSettingsForm] = useState({ business_name: '', phone: '', hours: '' });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  const displayName = session?.user?.name || session?.user?.email || 'Your Business';
  const displayInitials = getInitials(session?.user?.name || session?.user?.email || '??');
  const displayEmail = session?.user?.email || '';

  useEffect(() => {
    const addActivity = (text, type) => {
      setActivityItems(prev => {
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
    return () => { clearInterval(activityInterval); clearInterval(metricsInterval); };
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
    setAgentToggles(prev => ({ ...prev, [agentKey]: newVal }));
    setActivityItems(prev => {
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
        body: JSON.stringify(settingsForm),
      });
      const data = await res.json();
      setSettingsMsg(data.error ? '❌ ' + data.error : '✅ Settings saved!');
    } catch {
      setSettingsMsg('❌ Failed to save settings.');
    } finally {
      setSettingsSaving(false);
    }
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
          page: 'missed-call', label: 'Missed Call Text Back', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#1A0D0D', display: 'block' }}>
              <path d="M11 17 C10.5 18.5 11 20.5 13 21.5 C14 22 15 21.5 16.5 20 C17.3 19.2 17.3 18 16.5 17.2 L15.75 16.45 C15.5 16.2 15.5 15.8 15.75 15.55 L17.45 13.85 C17.7 13.6 18.1 13.6 18.35 13.85 L19.1 14.6 C19.9 15.4 21.1 15.4 21.9 14.6 L23 13.5 C23.8 12.7 23.8 11.5 23 10.7 C21.5 9.2 19 8.5 17 9 C15 9.5 11.5 14.5 11 17 Z" stroke="#ff6b6b" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
              <line x1="20" y1="7" x2="26" y2="13" stroke="#ff6b6b" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="26" y1="7" x2="20" y2="13" stroke="#ff6b6b" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )
        },
        {
          page: 'review-request', label: 'Review Request Agent', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#1A1500', display: 'block' }}>
              <path d="M16 7 L17.8 12.5 H23.5 L18.9 15.8 L20.7 21.3 L16 18 L11.3 21.3 L13.1 15.8 L8.5 12.5 H14.2 Z" stroke="#F5C400" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
            </svg>
          )
        },
        {
          page: 'reactivation', label: 'Reactivation Agent', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#0D2018', display: 'block' }}>
              <path d="M22 10 C20.3 8 17.8 7 15 7.5 C10.9 8.3 8 12 8 16" stroke="#1D9E75" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <path d="M10 25 C11.7 27 14.2 28 17 27.5 C21.1 26.7 24 23 24 19" stroke="#1D9E75" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <path d="M19 7 L22 10 L19 13" stroke="#1D9E75" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13 22 L10 25 L13 28" stroke="#1D9E75" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )
        },
        {
          page: 'lead-gen', label: 'Lead Generation', icon: (
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
          page: 'clients', label: 'All Clients', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#160D2A', display: 'block' }}>
              <circle cx="12" cy="11" r="3.5" stroke="#7B2FFF" strokeWidth="1.5" fill="none"/>
              <path d="M5 26 C5 21.6 8.1 18 12 18 C15.9 18 19 21.6 19 26" stroke="#7B2FFF" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <circle cx="22" cy="10" r="2.8" stroke="#7B2FFF" strokeWidth="1.5" fill="none" opacity="0.65"/>
              <path d="M18 25 C18 21.4 19.7 18.5 22 18.5 C24.3 18.5 26 21.4 26 25" stroke="#7B2FFF" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.65"/>
            </svg>
          )
        },
        {
          page: 'add-client', label: 'Add Client', icon: (
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ borderRadius: '5px', background: '#0D2018', display: 'block' }}>
              <line x1="16" y1="8" x2="16" y2="24" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="8" y1="16" x2="24" y2="16" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )
        },
        {
          page: 'automation-logs', label: 'Automation Logs', icon: (
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
            <div className={styles.topbarAvatar} aria-hidden="true">{displayInitials}</div>
            <span>{displayName}</span>
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
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Calls Today</div><div className={styles.metricCardValue} style={{ color: '#378ADD' }}>{metrics.calls}</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 12% vs yesterday</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Appointments</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>{metrics.appointments}</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 3 new today</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Revenue Today</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>{metrics.revenue}</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 8% vs avg</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Open Invoices</div><div className={styles.metricCardValue} style={{ color: '#EF9F27' }}>3</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— no change</div></div>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Agent Status</span><span className={styles.tag}>4 Active</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    <li className={styles.agentItem}>
                      <span className={styles.agentItemIcon} style={{ background: '#0D1F35' }} aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M8 12.5 C7.5 13.8 8 15.5 9.7 16.3 C10.5 16.8 11.2 16.3 12.4 15.1 C13 14.5 13 13.7 12.4 13.1 L11.8 12.5 C11.6 12.3 11.6 11.9 11.8 11.7 L13.1 10.4 C13.3 10.2 13.7 10.2 13.9 10.4 L14.5 11 C15.1 11.6 15.9 11.6 16.5 11 L17.5 10 C18.1 9.4 18.1 8.6 17.5 8 C16.3 6.8 14.2 6.4 12.8 7 C11.4 7.6 8.5 11.2 8 12.5 Z" stroke="#378ADD" strokeWidth="1.5" fill="none" strokeLinejoin="round"/></svg></span>
                      <div className={styles.agentItemInfo}><div className={styles.agentItemName}>Phone Agent</div><div className={styles.agentItemSub}>47 calls handled today</div></div>
                      <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${agentToggles.phone ? styles.statusDotGreen : ''}`}></span><span>{agentToggles.phone ? 'Active' : 'Paused'}</span></div>
                      <Toggle checked={agentToggles.phone} onChange={() => handleAgentToggle('phone', 'Phone Agent')} label="Toggle Phone Agent" />
                    </li>
                    <li className={styles.agentItem}>
                      <span className={styles.agentItemIcon} style={{ background: '#0D2018' }} aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="15" rx="2" stroke="#1D9E75" strokeWidth="1.5" fill="none"/><line x1="3" y1="10" x2="21" y2="10" stroke="#1D9E75" strokeWidth="1.5"/><line x1="8" y1="5" x2="8" y2="3" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="5" x2="16" y2="3" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8" cy="14" r="1.1" fill="#1D9E75"/><circle cx="12" cy="14" r="1.1" fill="#1D9E75"/><circle cx="16" cy="14" r="1.1" fill="#1D9E75"/></svg></span>
                      <div className={styles.agentItemInfo}><div className={styles.agentItemName}>Scheduling Agent</div><div className={styles.agentItemSub}>12 appointments today</div></div>
                      <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${agentToggles.scheduling ? styles.statusDotGreen : ''}`}></span><span>{agentToggles.scheduling ? 'Active' : 'Paused'}</span></div>
                      <Toggle checked={agentToggles.scheduling} onChange={() => handleAgentToggle('scheduling', 'Scheduling Agent')} label="Toggle Scheduling Agent" />
                    </li>
                    <li className={styles.agentItem}>
                      <span className={styles.agentItemIcon} style={{ background: '#1A0D00' }} aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><line x1="4" y1="3.5" x2="4" y2="19.5" stroke="#EF9F27" strokeWidth="1.5" strokeLinecap="round"/><line x1="4" y1="19.5" x2="20" y2="19.5" stroke="#EF9F27" strokeWidth="1.5" strokeLinecap="round"/><rect x="5.5" y="15" width="3.5" height="4.5" fill="#EF9F27"/><rect x="10.5" y="9" width="3.5" height="10.5" fill="#EF9F27"/><rect x="15.5" y="12" width="3.5" height="7.5" fill="#EF9F27"/></svg></span>
                      <div className={styles.agentItemInfo}><div className={styles.agentItemName}>Accounting Agent</div><div className={styles.agentItemSub}>3 invoices pending</div></div>
                      <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${agentToggles.accounting ? styles.statusDotYellow : ''}`}></span><span>{agentToggles.accounting ? 'Attention' : 'Paused'}</span></div>
                      <Toggle checked={agentToggles.accounting} onChange={() => handleAgentToggle('accounting', 'Accounting Agent')} label="Toggle Accounting Agent" />
                    </li>
                    <li className={styles.agentItem}>
                      <span className={styles.agentItemIcon} style={{ background: '#160D2A' }} aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="2.8" stroke="#7B2FFF" strokeWidth="1.5" fill="none"/><path d="M3.5 19.5 C3.5 15.9 6 13 9 13 C12 13 14.5 15.9 14.5 19.5" stroke="#7B2FFF" strokeWidth="1.5" fill="none" strokeLinecap="round"/><circle cx="17.5" cy="7.5" r="2.2" stroke="#7B2FFF" strokeWidth="1.5" fill="none" opacity="0.65"/><path d="M14 19 C14 16 15.5 13.5 17.5 13.5 C19.5 13.5 21 16 21 19" stroke="#7B2FFF" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.65"/></svg></span>
                      <div className={styles.agentItemInfo}><div className={styles.agentItemName}>CRM Agent</div><div className={styles.agentItemSub}>2 follow-ups queued</div></div>
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

        {/* === PHONE AGENT === */}
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
                    <div style={{ fontSize: 20, fontWeight: 700 }}>Alex</div>
                    <div style={{ color: '#aaa', fontSize: 13 }}>Retell AI Voice Agent</div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 16 }}>
                      <span style={{ color: '#378ADD', fontSize: 13 }}>📞 (856) 363-0633</span>
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
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Recent Calls</span></div>
                <div className={styles.panelBody}>
                  {callsLoading && <p style={{ color: '#aaa', padding: '12px 0' }}>Loading calls from Retell...</p>}
                  {!callsLoading && calls.length === 0 && <p style={{ color: '#aaa', padding: '12px 0' }}>No calls yet — Alex is standing by.</p>}
                  <ul className={styles.agentList}>
                    {calls.slice(0, 10).map((call) => (
                      <li key={call.call_id} className={styles.agentItem}>
                        <span className={styles.agentItemIcon} style={{ background: '#0D1F35' }} aria-hidden="true">{phoneIcon12}</span>
                        <div className={styles.agentItemInfo}>
                          <div className={styles.agentItemName}>
                            {call.scrubbed_call_analysis?.custom_analysis_data?.['custom data']?.match(/Caller Name: ([^\n]+)/)?.[1]?.trim() || call.from_number || 'Web Call'}
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
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Agent Info</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[
                      ['Agent Name', 'Alex'],
                      ['Phone Number', '(856) 363-0633'],
                      ['Agent ID', 'agent_132e809e21c0ff5eb0f006d59e'],
                      ['Provider', 'Retell AI'],
                      ['Status', 'Live & Answering'],
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

        {/* === SCHEDULING === */}
        {activePage === 'scheduling' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Scheduling Agent</h1>
              <p>Books and manages all appointments automatically</p>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Booked Today</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>12</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 3 new</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Upcoming This Week</div><div className={styles.metricCardValue}>38</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— on track</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>No-Show Rate</div><div className={styles.metricCardValue}>4%</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↓ down 2%</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Waitlist</div><div className={styles.metricCardValue}>5</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— 5 queued</div></div>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Today&apos;s Appointments</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['Sarah M. — 10:00am', 'Oil change + tire rotation', 'green', 'Confirmed'], ['Dave K. — 1:00pm', 'Brake inspection', 'green', 'Confirmed'], ['Lisa R. — 3:00pm', 'Full detail', 'yellow', 'Reminder sent']].map(([name, sub, dot, status]) => (
                      <li key={name} className={styles.agentItem}>
                        <span className={styles.agentItemIcon} style={{ background: '#0D2018' }} aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="#1D9E75" strokeWidth="1.5" fill="none"/><line x1="12" y1="7" x2="12" y2="12" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/><line x1="12" y1="12" x2="15.5" y2="14.5" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/></svg>
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
        {activePage === 'missed-call' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Missed Call Text Back</h1>
              <p>Automatically texts anyone who calls and doesn&apos;t get an answer</p>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Texts Sent Today</div><div className={styles.metricCardValue} style={{ color: '#ff6b6b' }}>3</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ all missed calls covered</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Response Rate</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>67%</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ above avg</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Leads Recovered</div><div className={styles.metricCardValue}>2</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ this week</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Avg Response Time</div><div className={styles.metricCardValue}>28s</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— instant</div></div>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Recent Texts Sent</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['(555) 648-2204', 'Missed call — text sent 28s later', 'yellow', 'Awaiting reply'], ['(555) 901-3344', 'Missed call — replied, booked appt', 'green', 'Converted'], ['(555) 772-0091', 'Missed call — no reply after 24hr', 'red', 'No response']].map(([num, sub, dot, status]) => (
                      <li key={num} className={styles.agentItem}>
                        <span className={styles.agentItemIcon} style={{ background: '#1A0D0D' }} aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="13" rx="2" stroke="#ff6b6b" strokeWidth="1.5" fill="none"/><path d="M3 18 L7 14" stroke="#ff6b6b" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </span>
                        <div className={styles.agentItemInfo}><div className={styles.agentItemName}>{num}</div><div className={styles.agentItemSub}>{sub}</div></div>
                        <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${dot === 'green' ? styles.statusDotGreen : dot === 'yellow' ? styles.statusDotYellow : styles.statusDotRed}`}></span><span>{status}</span></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Settings</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['Auto Text Back', 'Send text within 60s of missed call', true], ['After-Hours Only', 'Only text outside business hours', false], ['Include Booking Link', 'Add scheduling link to text', true]].map(([name, sub, def]) => (
                      <li key={name} className={styles.agentItem}>
                        <div className={styles.agentItemInfo}><div className={styles.agentItemName}>{name}</div><div className={styles.agentItemSub}>{sub}</div></div>
                        <Toggle checked={def} onChange={() => {}} label={`Toggle ${name}`} />
                      </li>
                    ))}
                  </ul>
                  <div style={{ marginTop: 16, padding: '12px', background: '#1a1a1a', borderRadius: 8, border: '1px solid #333' }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>DEFAULT MESSAGE TEMPLATE</div>
                    <div style={{ fontSize: 13, color: '#ccc', lineHeight: 1.5 }}>
                      &quot;Hey! Sorry we missed your call. We&apos;d love to help — reply here or book a time: [link]&quot;
                    </div>
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
              <p>Automatically asks happy customers for Google reviews after service</p>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Requests Sent</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>24</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ this month</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Reviews Received</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>9</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 38% conversion</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Avg Rating</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>4.8 ⭐</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ up from 4.5</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Send Delay</div><div className={styles.metricCardValue}>2hr</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— after service</div></div>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Recent Requests</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['Sarah M.', 'Sent 2hr after oil change — left 5★', 'green', 'Reviewed'], ['Dave K.', 'Sent 2hr after brake job — opened, no review', 'yellow', 'Pending'], ['Mike T.', 'Sent — no open after 48hr', 'red', 'No response']].map(([name, sub, dot, status]) => (
                      <li key={name} className={styles.agentItem}>
                        <span className={styles.agentItemIcon} style={{ background: '#1A1500' }} aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2 L14.4 9.2 H22 L15.8 13.6 L18.2 20.8 L12 16.4 L5.8 20.8 L8.2 13.6 L2 9.2 H9.6 Z" stroke="#F5C400" strokeWidth="1.5" fill="none" strokeLinejoin="round"/></svg>
                        </span>
                        <div className={styles.agentItemInfo}><div className={styles.agentItemName}>{name}</div><div className={styles.agentItemSub}>{sub}</div></div>
                        <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${dot === 'green' ? styles.statusDotGreen : dot === 'yellow' ? styles.statusDotYellow : styles.statusDotRed}`}></span><span>{status}</span></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Settings</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['Auto Send', 'Send review request after job close', true], ['Follow-Up Reminder', 'Send 1 reminder if no action in 48hr', true], ['Filter by Rating', 'Only send to satisfied customers', true]].map(([name, sub, def]) => (
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

        {/* === REACTIVATION AGENT === */}
        {activePage === 'reactivation' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Reactivation Agent</h1>
              <p>Win back customers who haven&apos;t visited in 90+ days</p>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Customers Targeted</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>42</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— 90+ days inactive</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Messages Sent</div><div className={styles.metricCardValue}>18</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ this month</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Reactivated</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>5</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 28% win-back rate</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Revenue Recovered</div><div className={styles.metricCardValue} style={{ color: '#F5C400' }}>$840</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ this month</div></div>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Recent Campaigns</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['Mike T.', '6 months inactive — replied, booked', 'green', 'Reactivated'], ['Lisa R.', '90 days inactive — message sent', 'yellow', 'Awaiting'], ['Tom B.', '4 months inactive — no response', 'red', 'No response']].map(([name, sub, dot, status]) => (
                      <li key={name} className={styles.agentItem}>
                        <span className={styles.agentItemIcon} style={{ background: '#0D2018' }} aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M17 8 C15.8 6.5 13.8 5.5 11.5 6 C8.3 6.6 6 9.5 6 12" stroke="#1D9E75" strokeWidth="1.5" fill="none" strokeLinecap="round"/><path d="M7 17 C8.2 18.5 10.2 19.5 12.5 19 C15.7 18.4 18 15.5 18 13" stroke="#1D9E75" strokeWidth="1.5" fill="none" strokeLinecap="round"/><path d="M14.5 5.5 L17 8 L14.5 10.5" stroke="#1D9E75" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                        <div className={styles.agentItemInfo}><div className={styles.agentItemName}>{name}</div><div className={styles.agentItemSub}>{sub}</div></div>
                        <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${dot === 'green' ? styles.statusDotGreen : dot === 'yellow' ? styles.statusDotYellow : styles.statusDotRed}`}></span><span>{status}</span></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Settings</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['Auto Reactivation', 'Message customers after 90 days', true], ['Offer Discount', 'Include 10% off to win them back', true], ['Multi-Touch', 'Send up to 3 follow-ups', false]].map(([name, sub, def]) => (
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

        {/* === LEAD GENERATION === */}
        {activePage === 'lead-gen' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Lead Generation</h1>
              <p>Capture and qualify new leads automatically</p>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Leads This Month</div><div className={styles.metricCardValue} style={{ color: '#7B2FFF' }}>31</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 18% vs last month</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Qualified Leads</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>14</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 45% qualify rate</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Booked from Leads</div><div className={styles.metricCardValue}>8</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 57% close rate</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Avg Response Time</div><div className={styles.metricCardValue}>45s</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— instant follow-up</div></div>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Recent Leads</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['Website Chatbot', 'Tire rotation inquiry — qualified, booked', 'green', 'Booked'], ['Google Ad Form', 'Oil change inquiry — follow-up sent', 'yellow', 'In progress'], ['Facebook Lead', 'Brake inspection — no response', 'red', 'Cold']].map(([source, sub, dot, status]) => (
                      <li key={source} className={styles.agentItem}>
                        <span className={styles.agentItemIcon} style={{ background: '#160D2A' }} aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="2.5" stroke="#7B2FFF" strokeWidth="1.5" fill="none"/><circle cx="12" cy="12" r="5.5" stroke="#7B2FFF" strokeWidth="1.5" fill="none" opacity="0.5"/><circle cx="12" cy="12" r="8.5" stroke="#7B2FFF" strokeWidth="1.5" fill="none" opacity="0.25"/></svg>
                        </span>
                        <div className={styles.agentItemInfo}><div className={styles.agentItemName}>{source}</div><div className={styles.agentItemSub}>{sub}</div></div>
                        <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${dot === 'green' ? styles.statusDotGreen : dot === 'yellow' ? styles.statusDotYellow : styles.statusDotRed}`}></span><span>{status}</span></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Lead Sources</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['Website Chatbot', 'Alex captures leads 24/7', true], ['Contact Form', 'Auto follow-up on form submissions', true], ['Google Ads', 'Lead form integration', false], ['Facebook Ads', 'Lead form integration', false]].map(([name, sub, def]) => (
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
                  {settingsMsg && <div style={{ marginTop: 12, color: settingsMsg.startsWith('✅') ? '#1D9E75' : '#ff6b6b' }}>{settingsMsg}</div>}
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Notifications</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[
                      ['Daily Summary Email', 'Recap sent each morning', true],
                      ['Alert on Urgent Calls', 'Text you for escalations', true],
                      ['New Customer Alert', 'Notify when first-time customer calls', false]
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

        {/* === BILLING === */}
        {activePage === 'billing' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Billing</h1>
              <p>Your plan and payment details</p>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Current Plan</span><span className={styles.tag}>Growth</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['Plan', 'Growth — $297/mo'], ['Next Billing Date', 'April 1, 2026'], ['Payment Method', 'Visa ending in 4242']].map(([name, sub]) => (
                      <li key={name} className={styles.agentItem}><div className={styles.agentItemInfo}><div className={styles.agentItemName}>{name}</div><div className={styles.agentItemSub}>{sub}</div></div></li>
                    ))}
                    <li className={styles.agentItem}>
                      <div className={styles.agentItemInfo}><div className={styles.agentItemName}>Status</div><div className={styles.agentItemSub}>Active — all agents included</div></div>
                      <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${styles.statusDotGreen}`}></span><span>Paid</span></div>
                    </li>
                  </ul>
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Invoice History</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['March 2026', '$297'], ['February 2026', '$297'], ['January 2026', '$297']].map(([month, amount]) => (
                      <li key={month} className={styles.agentItem}>
                        <span className={styles.agentItemIcon} style={{ background: '#1A1A1A' }} aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="5" y="3" width="14" height="18" rx="2" stroke="#888780" strokeWidth="1.5"/><line x1="8" y1="8" x2="16" y2="8" stroke="#888780" strokeWidth="1.4" strokeLinecap="round"/><line x1="8" y1="12" x2="16" y2="12" stroke="#888780" strokeWidth="1.4" strokeLinecap="round"/><line x1="8" y1="16" x2="12" y2="16" stroke="#888780" strokeWidth="1.4" strokeLinecap="round"/></svg>
                        </span>
                        <div className={styles.agentItemInfo}><div className={styles.agentItemName}>{month}</div><div className={styles.agentItemSub}>{amount}</div></div>
                        <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${styles.statusDotGreen}`}></span><span>Paid</span></div>
                      </li>
                    ))}
                  </ul>
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
                {triggerMsg && <div style={{ marginTop: 12, color: triggerMsg.startsWith('✅') ? '#1D9E75' : '#ff6b6b' }}>{triggerMsg}</div>}
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
                  {addClientMsg && <div style={{ marginTop: 12, color: addClientMsg.startsWith('✅') ? '#1D9E75' : '#ff6b6b' }}>{addClientMsg}</div>}
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

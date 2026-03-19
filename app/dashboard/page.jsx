'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
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
  const [activePage, setActivePage] = useState('overview');
  const [activityItems, setActivityItems] = useState([
    { text: 'Call answered — customer asked about oil change pricing.', time: '2 min ago', type: 'blue' },
    { text: 'Appointment booked — Sarah M. for Thursday 10am.', time: '8 min ago', type: 'green' },
    { text: 'Invoice #1042 flagged — Dave\'s Plumbing $340 overdue.', time: '22 min ago', type: 'yellow' },
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

  useEffect(() => {
    const addActivity = (text, type) => {
      setActivityItems(prev => {
        const newItem = { text, time: 'Just now', type };
        const updated = [newItem, ...prev];
        return updated.slice(0, 5);
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
    setAgentToggles(prev => ({ ...prev, [agentKey]: newVal }));
    setActivityItems(prev => {
      const newItem = { text: `${agentName} ${newVal ? 'activated' : 'paused'}.`, time: 'Just now', type: 'yellow' };
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
            <div className={styles.topbarAvatar} aria-hidden="true">JD</div>
            <span>John&apos;s Auto Shop</span>
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

        {/* === PHONE AGENT === */}
        {activePage === 'phone' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Phone Agent</h1>
              <p>Handles every inbound call — 24/7</p>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Calls Today</div><div className={styles.metricCardValue} style={{ color: '#378ADD' }}>47</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 12% vs yesterday</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Avg Call Duration</div><div className={styles.metricCardValue}>1m 42s</div><div className={`${styles.metricCardDelta} ${styles.deltaFlat}`}>— steady</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Resolved Without Transfer</div><div className={styles.metricCardValue} style={{ color: '#1D9E75' }}>89%</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ 4%</div></div>
              <div className={styles.metricCard}><div className={styles.metricCardLabel}>Missed Calls</div><div className={styles.metricCardValue} style={{ color: '#28C840' }}>0</div><div className={`${styles.metricCardDelta} ${styles.deltaUp}`}>↑ Perfect</div></div>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Recent Calls</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['(555) 204-1187', 'Oil change pricing — resolved', '2 min ago'], ['(555) 391-0042', 'Tire rotation — appointment booked', '1 hr ago'], ['(555) 877-3300', 'Hours inquiry — resolved', '2 hr ago']].map(([num, sub, time]) => (
                      <li key={num} className={styles.agentItem}>
                        <span className={styles.agentItemIcon} style={{ background: '#0D1F35' }} aria-hidden="true">{phoneIcon12}</span>
                        <div className={styles.agentItemInfo}><div className={styles.agentItemName}>{num}</div><div className={styles.agentItemSub}>{sub}</div></div>
                        <div className={styles.agentItemStatus}><span className={`${styles.statusDot} ${styles.statusDotGreen}`}></span><span>{time}</span></div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Agent Settings</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['Agent Active', 'Answering all inbound calls', true], ['After-Hours Mode', 'Take messages when closed', true], ['Call Summaries', 'Email recap after each call', true], ['Transfer Escalations', 'Forward urgent calls to you', false]].map(([name, sub, def]) => (
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

        {/* === SETTINGS === */}
        {activePage === 'settings' && (
          <section>
            <div className={styles.pageHeader}>
              <h1>Settings</h1>
              <p>Manage your account and preferences</p>
            </div>
            <div className={styles.contentGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeader}><span className={styles.panelTitle}>Business Profile</span></div>
                <div className={styles.panelBody}>
                  <ul className={styles.agentList}>
                    {[['Business Name', "John's Auto Shop"], ['Phone Number', '(555) 800-1234'], ['Email', 'john@johnsautoshop.com'], ['Business Hours', 'Mon–Fri 8am–6pm, Sat 9am–3pm']].map(([name, sub]) => (
                      <li key={name} className={styles.agentItem}><div className={styles.agentItemInfo}><div className={styles.agentItemName}>{name}</div><div className={styles.agentItemSub}>{sub}</div></div></li>
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

      </main>
    </div>
  );
}

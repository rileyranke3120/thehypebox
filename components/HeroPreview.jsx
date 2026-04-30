'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from '@/styles/marketing.module.css';

export default function HeroPreview() {
  const callsRef = useRef(null);
  const feedRef = useRef(null);

  useEffect(() => {
    const events = [
      ['Call answered — lead captured', 'blue'],
      ['Chat visitor qualified', 'green'],
      ['Follow-up SMS sent', 'yellow'],
      ['Appointment booked — Wed 10am', 'blue'],
      ['Review request sent', 'green'],
      ['Missed call — message taken', 'blue'],
      ['New lead from chatbot', 'green'],
      ['Re-engagement email sent', 'yellow'],
      ['Call answered — FAQ resolved', 'blue'],
      ['Appointment reminder sent', 'yellow'],
    ];
    let ei = 0;
    let calls = 47;

    const interval = setInterval(function () {
      const feed = feedRef.current;
      if (!feed) return;
      const ev = events[ei % events.length]; ei++;
      const color = ev[1] === 'green' ? '#1D9E75' : ev[1] === 'yellow' ? '#F5C400' : '#378ADD';
      const item = document.createElement('div');
      item.className = 'hbp-feed-item';
      item.innerHTML = '<div class="hbp-feed-dot" style="background:' + color + ';width:5px;height:5px;border-radius:50%;flex-shrink:0;"></div><div class="hbp-feed-text" style="font-size:0.6rem;color:#888;line-height:1.4;">' + ev[0] + '</div>';
      feed.insertBefore(item, feed.firstChild);
      while (feed.children.length > 4) feed.removeChild(feed.lastChild);
      if (ev[1] === 'blue' && callsRef.current) {
        calls++;
        callsRef.current.textContent = calls;
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className={`${styles.hero} section`} aria-labelledby="hero-headline">
      <div className={`container ${styles.heroInner}`}>
        <div className={styles.heroCopy}>
          <h1 id="hero-headline" className={styles.heroHeadline}>
            Run Your Entire Business<br />
            From <em>One System</em>
          </h1>
          <p className={styles.heroSub}>
            CRM, communication, automation, and AI — all in one place.
            No more missed calls. No more lost leads. Just a smarter
            way to operate.
          </p>
          <div className={styles.heroActions}>
            <a href="#booking" className="btn btn-primary">Get Early Access</a>
            <a href="#booking" className="btn btn-ghost">Book a Demo</a>
          </div>
          <div className={styles.heroDemo}>
            <p className={styles.heroDemoBanner}>Try It Free for 14 Days — No Credit Card Required</p>
            <Link href="/demo" className="btn btn-primary" style={{ fontSize: '1.1rem', padding: '1rem 2rem', fontWeight: 900 }}>
              View Live Demo →
            </Link>
            <p className={styles.heroDemoNote}>Free trial available on all plans · Cancel anytime</p>
          </div>
        </div>

        <div
          className={styles.heroVisual}
          role="presentation"
          aria-hidden="true"
          style={{ background: 'transparent', border: 'none', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <Image src="/logo.png" alt="TheHypeBox Logo" height={180} width={720} style={{ height: '180px', marginBottom: '1.5rem', display: 'block', width: 'auto', maxWidth: '100%', mixBlendMode: 'screen' }} priority />

          <style>{`
            .hbp-preview{font-family:'DM Sans',sans-serif;background:#111;border:1px solid #2a2a2a;border-radius:10px;overflow:hidden;width:100%;max-width:520px;box-shadow:0 24px 64px rgba(0,0,0,0.6);user-select:none;}
            .hbp-topbar{display:flex;align-items:center;gap:10px;background:#0a0a0a;padding:10px 14px;border-bottom:1px solid #2a2a2a;}
            .hbp-topbar-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;color:#fff;flex:1;}
            .hbp-status-dot{width:7px;height:7px;border-radius:50%;background:#1D9E75;box-shadow:0 0 6px #1D9E75;flex-shrink:0;}
            .hbp-status-label{font-size:0.65rem;color:#1D9E75;letter-spacing:0.08em;text-transform:uppercase;}
            .hbp-body{display:flex;height:260px;}
            .hbp-sidebar{width:46px;background:#0d0d0d;border-right:1px solid #1e1e1e;display:flex;flex-direction:column;align-items:center;padding:10px 0;gap:8px;}
            .hbp-sidebar-icon{width:30px;height:30px;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0.55;transition:opacity 0.15s;}
            .hbp-sidebar-icon.active{opacity:1;}
            .hbp-main{flex:1;padding:12px;overflow:hidden;display:flex;flex-direction:column;gap:10px;}
            .hbp-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
            .hbp-metric{background:#161616;border:1px solid #222;border-radius:6px;padding:8px 10px;}
            .hbp-metric-label{font-size:0.6rem;color:#666;text-transform:uppercase;letter-spacing:0.1em;}
            .hbp-metric-value{font-family:'Barlow Condensed',sans-serif;font-size:1.5rem;font-weight:700;line-height:1.1;margin-top:2px;}
            .hbp-panels{display:grid;grid-template-columns:1fr 1fr;gap:8px;flex:1;min-height:0;}
            .hbp-panel{background:#161616;border:1px solid #222;border-radius:6px;padding:8px 10px;overflow:hidden;display:flex;flex-direction:column;}
            .hbp-panel-title{font-size:0.58rem;color:#555;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;flex-shrink:0;}
            .hbp-agent-list{display:flex;flex-direction:column;gap:5px;}
            .hbp-agent-row{display:flex;align-items:center;gap:6px;}
            .hbp-agent-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0;}
            .hbp-agent-name{font-size:0.62rem;color:#aaa;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
            .hbp-agent-badge{font-size:0.55rem;color:#1D9E75;background:rgba(29,158,117,0.12);padding:1px 5px;border-radius:2px;white-space:nowrap;}
            .hbp-feed{display:flex;flex-direction:column;gap:4px;overflow:hidden;flex:1;}
            .hbp-feed-item{display:flex;align-items:flex-start;gap:5px;}
            .hbp-feed-dot{width:5px;height:5px;border-radius:50%;background:#378ADD;flex-shrink:0;margin-top:3px;}
            .hbp-feed-text{font-size:0.6rem;color:#888;line-height:1.4;}
          `}</style>

          <div className="hbp-preview">
            <div className="hbp-topbar">
              <div className="hbp-status-dot"></div>
              <div className="hbp-topbar-title">TheHypeBox Command Center</div>
              <span className="hbp-status-label">Live</span>
            </div>
            <div className="hbp-body">
              <div className="hbp-sidebar">
                <div className="hbp-sidebar-icon active" style={{ background: '#1A1500' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" fill="#F5C400"/><rect x="14" y="3" width="7" height="7" rx="1" fill="#F5C400" opacity="0.5"/><rect x="3" y="14" width="7" height="7" rx="1" fill="#F5C400" opacity="0.5"/><rect x="14" y="14" width="7" height="7" rx="1" fill="#F5C400" opacity="0.5"/></svg>
                </div>
                <div className="hbp-sidebar-icon" style={{ background: '#0D1F35' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6.5 3C6.5 3 5 5 5 8.5C5 13.5 10.5 19 15.5 19C19 19 21 17.5 21 17.5L18.5 14.5C18.5 14.5 17 15.5 15.5 15C14 14.5 10 10.5 9.5 9C9 7.5 10 6 10 6L6.5 3Z" stroke="#378ADD" strokeWidth="1.5" fill="none"/></svg>
                </div>
                <div className="hbp-sidebar-icon" style={{ background: '#0D2018' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 5C4 4 5 3 6 3H18C19 3 20 4 20 5V14C20 15 19 16 18 16H9L5 20V16C4.4 16 4 15.6 4 15V5Z" stroke="#1D9E75" strokeWidth="1.5" fill="none"/><circle cx="9" cy="9.5" r="1" fill="#1D9E75"/><circle cx="12" cy="9.5" r="1" fill="#1D9E75"/><circle cx="15" cy="9.5" r="1" fill="#1D9E75"/></svg>
                </div>
                <div className="hbp-sidebar-icon" style={{ background: '#1A1500' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M13 3L5 14H12L11 21L19 10H12L13 3Z" fill="#F5C400"/></svg>
                </div>
                <div className="hbp-sidebar-icon" style={{ background: '#1A1A1A' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="#888780" strokeWidth="1.5"/><path d="M12 2V4M12 20V22M2 12H4M20 12H22M4.9 4.9L6.3 6.3M17.7 17.7L19.1 19.1M19.1 4.9L17.7 6.3M6.3 17.7L4.9 19.1" stroke="#888780" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
              </div>
              <div className="hbp-main">
                <div className="hbp-metrics">
                  <div className="hbp-metric">
                    <div className="hbp-metric-label">Calls Today</div>
                    <div className="hbp-metric-value" ref={callsRef} style={{ color: '#378ADD' }}>47</div>
                  </div>
                  <div className="hbp-metric">
                    <div className="hbp-metric-label">Booked</div>
                    <div className="hbp-metric-value" style={{ color: '#1D9E75' }}>12</div>
                  </div>
                  <div className="hbp-metric">
                    <div className="hbp-metric-label">Revenue</div>
                    <div className="hbp-metric-value" style={{ color: '#F5C400' }}>$4,820</div>
                  </div>
                  <div className="hbp-metric">
                    <div className="hbp-metric-label">Invoices</div>
                    <div className="hbp-metric-value" style={{ color: '#EF9F27' }}>8</div>
                  </div>
                </div>
                <div className="hbp-panels">
                  <div className="hbp-panel">
                    <div className="hbp-panel-title">Agent Status</div>
                    <div className="hbp-agent-list">
                      <div className="hbp-agent-row">
                        <div className="hbp-agent-dot" style={{ background: '#378ADD' }}></div>
                        <div className="hbp-agent-name">Receptionist</div>
                        <div className="hbp-agent-badge">Active</div>
                      </div>
                      <div className="hbp-agent-row">
                        <div className="hbp-agent-dot" style={{ background: '#1D9E75' }}></div>
                        <div className="hbp-agent-name">Chatbot</div>
                        <div className="hbp-agent-badge">Active</div>
                      </div>
                      <div className="hbp-agent-row">
                        <div className="hbp-agent-dot" style={{ background: '#F5C400' }}></div>
                        <div className="hbp-agent-name">Follow-Up</div>
                        <div className="hbp-agent-badge">Active</div>
                      </div>
                    </div>
                  </div>
                  <div className="hbp-panel">
                    <div className="hbp-panel-title">Live Activity</div>
                    <div className="hbp-feed" ref={feedRef}>
                      <div className="hbp-feed-item"><div className="hbp-feed-dot"></div><div className="hbp-feed-text">Call answered — routed to voicemail</div></div>
                      <div className="hbp-feed-item"><div className="hbp-feed-dot" style={{ background: '#1D9E75' }}></div><div className="hbp-feed-text">New lead captured via chat</div></div>
                      <div className="hbp-feed-item"><div className="hbp-feed-dot" style={{ background: '#F5C400' }}></div><div className="hbp-feed-text">Follow-up SMS sent</div></div>
                      <div className="hbp-feed-item"><div className="hbp-feed-dot"></div><div className="hbp-feed-text">Appointment booked — Tue 2pm</div></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

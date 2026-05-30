'use client';

import { useState } from 'react';
import styles from '@/styles/onboarding-checklist.module.css';

const STEPS = [
  {
    key: 'phone_confirmed',
    label: 'Confirm your business phone number',
    action: 'Go to Settings →',
    actionPage: 'settings',
  },
  {
    key: 'sarah_tested',
    label: 'Test Sarah by calling your number',
    action: 'Call now',
    actionPage: null,
  },
  {
    key: 'pipeline_checked',
    label: 'Check your GHL pipeline has stages set up',
    action: 'Open GHL →',
    actionHref: 'https://app.gohighlevel.com',
  },
  {
    key: 'google_review_added',
    label: 'Add your Google review link in Settings',
    action: 'Go to Settings →',
    actionPage: 'settings',
  },
  {
    key: 'onboarding_call_booked',
    label: 'Book your onboarding call',
    action: 'Book now →',
    actionHref: 'https://calendly.com/thehypebox/onboarding',
  },
];

export default function OnboardingChecklist({ initialChecklist, onNavigate }) {
  const [checklist, setChecklist] = useState(() => initialChecklist ?? {});
  const [saving, setSaving] = useState(null);

  const completed = STEPS.filter((s) => checklist[s.key]).length;
  const total = STEPS.length;

  if (completed === total) return null;

  async function markDone(key) {
    if (checklist[key] || saving) return;
    setSaving(key);
    const next = { ...checklist, [key]: true };
    setChecklist(next);
    try {
      await fetch('/api/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: key }),
      });
    } catch {
      // revert on failure
      setChecklist(checklist);
    } finally {
      setSaving(null);
    }
  }

  function handleClick(step) {
    if (step.actionPage && onNavigate) {
      onNavigate(step.actionPage);
    } else if (step.actionHref) {
      window.open(step.actionHref, '_blank', 'noopener');
    }
    markDone(step.key);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <p className={styles.title}>Getting Started</p>
        <span className={styles.count}>{completed} / {total} complete</span>
      </div>
      <div className={styles.barTrack}>
        <div
          className={styles.barFill}
          style={{ width: `${(completed / total) * 100}%` }}
          role="progressbar"
          aria-valuenow={completed}
          aria-valuemin={0}
          aria-valuemax={total}
        />
      </div>
      <ul className={styles.steps}>
        {STEPS.map((step) => {
          const done = !!checklist[step.key];
          return (
            <li key={step.key}>
              <button
                className={`${styles.step}${done ? ` ${styles.stepDone}` : ''}`}
                onClick={() => handleClick(step)}
                disabled={done}
                aria-label={done ? `${step.label} — complete` : step.label}
              >
                <span className={`${styles.checkbox}${done ? ` ${styles.checkboxChecked}` : ''}`} aria-hidden="true">
                  {done && (
                    <svg className={styles.checkmark} viewBox="0 0 10 10">
                      <polyline points="1.5,5 4,7.5 8.5,2.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className={`${styles.stepText}${done ? ` ${styles.stepTextDone}` : ''}`}>
                  {step.label}
                </span>
                {!done && (step.actionPage || step.actionHref) && (
                  <span className={styles.stepAction}>{step.action}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

'use client';

import { useState } from 'react';

export default function FAQAccordion({ items }) {
  const [openIndex, setOpenIndex] = useState(null);

  function toggle(i) {
    setOpenIndex(openIndex === i ? null : i);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={i}
            style={{
              background: isOpen ? '#111' : '#0d0d0d',
              border: '1px solid',
              borderColor: isOpen ? '#2a2a2a' : '#1a1a1a',
              borderRadius: '4px',
              overflow: 'hidden',
              transition: 'border-color 150ms ease',
            }}
          >
            <button
              onClick={() => toggle(i)}
              aria-expanded={isOpen}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                padding: '1.1rem 1.25rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.95rem',
                fontWeight: isOpen ? 600 : 400,
                color: isOpen ? '#fff' : '#ccc',
                lineHeight: 1.4,
                transition: 'color 150ms ease',
              }}>
                {item.question}
              </span>
              <span style={{
                flexShrink: 0,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: isOpen ? '#F5C400' : '#1a1a1a',
                border: isOpen ? 'none' : '1px solid #2a2a2a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                lineHeight: 1,
                color: isOpen ? '#000' : '#555',
                transition: 'background 150ms ease, color 150ms ease',
                fontWeight: 700,
              }}>
                {isOpen ? '−' : '+'}
              </span>
            </button>

            {isOpen && (
              <div style={{
                padding: '0 1.25rem 1.25rem',
                borderTop: '1px solid #1a1a1a',
              }}>
                <div style={{
                  paddingTop: '1rem',
                  fontSize: '0.9rem',
                  color: '#aaa',
                  lineHeight: 1.75,
                }}>
                  {item.answer}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

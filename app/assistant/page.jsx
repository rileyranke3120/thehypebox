'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function AssistantInner() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get('c') || 'dave';

  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: "Hey! I'm your TheHypeBox Assistant. I'm connected to your account — ask me anything. I can pull up your leads, check your appointments, send a review request, or just explain how something works.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: history.slice(-10), clientId }),
      });
      const data = await res.json();
      const reply = data.reply || "Sorry, I couldn't process that. Try again.";
      setMessages((prev) => [...prev, { role: 'bot', text: reply }]);
      setHistory((prev) => [
        ...prev,
        { role: 'user', content: text },
        { role: 'assistant', content: reply },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: 'bot', text: "Connection error. Try again." }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      background: '#0a0a0a',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '16px 24px',
        borderBottom: '1px solid #1a1a1a',
        background: '#000',
        flexShrink: 0,
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: '#FFD000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="#000"/>
          </svg>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', letterSpacing: '0.02em' }}>
            TheHypeBox Assistant
          </div>
          <div style={{ fontSize: '0.75rem', color: '#555' }}>Connected to your account</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        maxWidth: 760,
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '75%',
              padding: '10px 14px',
              borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: m.role === 'user' ? '#FFD000' : '#141414',
              color: m.role === 'user' ? '#000' : '#e8e8e8',
              fontSize: '0.9rem',
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              border: m.role === 'bot' ? '1px solid #1e1e1e' : 'none',
            }}>
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '10px 16px',
              borderRadius: '16px 16px 16px 4px',
              background: '#141414',
              border: '1px solid #1e1e1e',
              display: 'flex',
              gap: 5,
              alignItems: 'center',
            }}>
              {[0, 0.2, 0.4].map((delay, i) => (
                <div key={i} style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#555',
                  animation: 'bounce 1.2s infinite',
                  animationDelay: `${delay}s`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        borderTop: '1px solid #1a1a1a',
        padding: '12px 16px',
        background: '#000',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          gap: 10,
          maxWidth: 760,
          margin: '0 auto',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={onKey}
            placeholder="Ask me anything…"
            rows={1}
            style={{
              flex: 1,
              background: '#111',
              border: '1px solid #2a2a2a',
              borderRadius: 10,
              padding: '10px 14px',
              color: '#fff',
              fontSize: '0.9rem',
              fontFamily: 'inherit',
              resize: 'none',
              outline: 'none',
              lineHeight: 1.5,
              minHeight: 42,
              maxHeight: 120,
            }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            style={{
              background: loading || !input.trim() ? '#1a1a1a' : '#FFD000',
              color: loading || !input.trim() ? '#333' : '#000',
              border: 'none',
              borderRadius: 10,
              width: 42,
              height: 42,
              cursor: loading || !input.trim() ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              alignSelf: 'flex-end',
              transition: 'background 0.15s',
            }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
              <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#333', marginTop: 8 }}>
          Powered by TheHypeBox
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
        textarea:focus { border-color: #333 !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 4px; }
      `}</style>
    </div>
  );
}

export default function AssistantPage() {
  return (
    <Suspense>
      <AssistantInner />
    </Suspense>
  );
}

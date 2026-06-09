'use client';

import { useState, useRef, useEffect } from 'react';
import styles from '@/styles/barryChat.module.css';

export default function BarryChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const historyRef = useRef([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function addBotMessage(text) {
    setMessages((prev) => [...prev, { role: 'bot', text }]);
    historyRef.current = [...historyRef.current, { role: 'assistant', content: text }];
  }

  function handleOpen() {
    setIsOpen(true);
    if (messages.length === 0) {
      setTimeout(() => {
        addBotMessage("Hey! I'm Barry 👋 Real quick — what trade are you in?");
      }, 250);
    }
    setTimeout(() => inputRef.current?.focus(), 320);
  }

  function handleClose() {
    setIsOpen(false);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    historyRef.current = [...historyRef.current, { role: 'user', content: text }];
    setLoading(true);

    try {
      const res = await fetch('/api/chat/barry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: historyRef.current.slice(-12) }),
      });
      const data = await res.json();
      const reply = data.reply || "I'm here — something glitched. Try that again?";
      addBotMessage(reply);
      if (data.leadCaptured) setLeadCaptured(true);
    } catch {
      addBotMessage("My connection dropped — send that again and I got you.");
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleInputChange(e) {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
  }

  return (
    <>
      {isOpen && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <img src="/mascot-phone.png" alt="Barry" className={styles.headerAvatar} />
            <div>
              <div className={styles.headerName}>Barry</div>
              <div className={styles.headerSub}>TheHypeBox · Usually replies instantly</div>
            </div>
            <button className={styles.closeBtn} onClick={handleClose} aria-label="Close chat">
              ✕
            </button>
          </div>

          <div className={styles.messages}>
            {messages.map((msg, i) => (
              <div key={i} className={msg.role === 'bot' ? styles.botMsg : styles.userMsg}>
                {msg.text}
              </div>
            ))}
            {loading && (
              <div className={styles.typing}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {leadCaptured ? (
            <div className={styles.captured}>
              🔥 You're locked in! Barry will text you in the next few minutes.
              <div className={styles.capturedSub}>Keep an eye on your phone.</div>
            </div>
          ) : (
            <div className={styles.inputRow}>
              <textarea
                ref={inputRef}
                className={styles.input}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message…"
                rows={1}
              />
              <button
                className={styles.sendBtn}
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                aria-label="Send"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                  <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      <button
        className={styles.bubble}
        onClick={isOpen ? handleClose : handleOpen}
        aria-label={isOpen ? 'Close chat' : 'Chat with Barry'}
      >
        {isOpen ? (
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        ) : (
          <img src="/mascot-phone.png" alt="Chat with Barry" className={styles.bubbleImg} />
        )}
      </button>
    </>
  );
}

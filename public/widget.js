(function () {
  'use strict';

  var API_URL = 'https://thehypeboxllc.com/api/chat';
  var script = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();
  var clientId = (script && script.getAttribute('data-client')) || 'default';
  var rawColor = (script && script.getAttribute('data-color')) || '';
  var accentColor = /^#[0-9a-f]{3,6}$/i.test(rawColor) ? rawColor : '#2563eb';

  // Prevent double-init
  if (window.__hypebox_widget_loaded) return;
  window.__hypebox_widget_loaded = true;

  var history = [];

  var styles = `
    #hb-widget-btn img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
    #hb-widget-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: #FFD000;
      overflow: hidden;
      border: 3px solid #FFD000;
      box-shadow: 0 4px 16px rgba(0,0,0,0.35);
      color: #fff;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #hb-widget-btn:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(0,0,0,0.28); }
    #hb-widget-panel {
      position: fixed;
      bottom: 92px;
      right: 24px;
      width: 340px;
      max-width: calc(100vw - 48px);
      height: 480px;
      max-height: calc(100vh - 120px);
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      z-index: 99998;
      display: none;
      flex-direction: column;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #hb-widget-panel.hb-open { display: flex; }
    #hb-widget-header {
      background: ${accentColor};
      color: #fff;
      padding: 14px 16px;
      font-weight: 600;
      font-size: 15px;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    #hb-widget-header span { opacity: 0.85; font-size: 12px; font-weight: 400; margin-left: auto; }
    #hb-widget-messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .hb-msg {
      max-width: 80%;
      padding: 8px 12px;
      border-radius: 12px;
      font-size: 13.5px;
      line-height: 1.45;
      word-break: break-word;
    }
    .hb-msg.hb-bot {
      background: #f1f5f9;
      color: #1e293b;
      align-self: flex-start;
      border-bottom-left-radius: 3px;
    }
    .hb-msg.hb-user {
      background: ${accentColor};
      color: #fff;
      align-self: flex-end;
      border-bottom-right-radius: 3px;
    }
    .hb-typing {
      display: flex;
      gap: 4px;
      align-items: center;
      padding: 8px 12px;
      align-self: flex-start;
    }
    .hb-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #94a3b8;
      animation: hb-bounce 1.2s infinite;
    }
    .hb-dot:nth-child(2) { animation-delay: 0.2s; }
    .hb-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes hb-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-5px); }
    }
    #hb-widget-input-row {
      display: flex;
      gap: 8px;
      padding: 10px 12px;
      border-top: 1px solid #e2e8f0;
      flex-shrink: 0;
    }
    #hb-widget-input {
      flex: 1;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 13.5px;
      outline: none;
      font-family: inherit;
      resize: none;
      line-height: 1.4;
      min-height: 36px;
      max-height: 80px;
    }
    #hb-widget-input:focus { border-color: ${accentColor}; }
    #hb-widget-send {
      background: ${accentColor};
      color: #fff;
      border: none;
      border-radius: 8px;
      width: 36px;
      height: 36px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
      align-self: flex-end;
      transition: opacity 0.15s;
    }
    #hb-widget-send:disabled { opacity: 0.5; cursor: default; }
    #hb-widget-footer {
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
      padding: 4px 0 8px;
      flex-shrink: 0;
    }
    #hb-widget-footer a { color: ${accentColor}; text-decoration: none; }
  `;

  function injectStyles() {
    var el = document.createElement('style');
    el.textContent = styles;
    document.head.appendChild(el);
  }

  function buildPanel() {
    var panel = document.createElement('div');
    panel.id = 'hb-widget-panel';
    panel.innerHTML = `
      <div id="hb-widget-header">
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.25)"/><path d="M8 9h8M8 13h5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>
        TheHypeBot
        <span>AI Assistant</span>
      </div>
      <div id="hb-widget-messages"></div>
      <div id="hb-widget-input-row">
        <textarea id="hb-widget-input" placeholder="Ask me anything…" rows="1"></textarea>
        <button id="hb-widget-send" title="Send">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M22 2L11 13" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M22 2L15 22l-4-9-9-4 20-7z" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div id="hb-widget-footer">Powered by <a href="https://thehypeboxllc.com" target="_blank">TheHypeBox</a></div>
    `;
    document.body.appendChild(panel);
    return panel;
  }

  function buildButton() {
    var btn = document.createElement('button');
    btn.id = 'hb-widget-btn';
    btn.title = 'Chat with TheHypeBot';
    btn.innerHTML = `<img src="https://thehypeboxllc.com/mascot-phone.png" alt="Chat with TheHypeBot" />`;
    document.body.appendChild(btn);
    return btn;
  }

  function addMessage(text, role) {
    var msgs = document.getElementById('hb-widget-messages');
    var el = document.createElement('div');
    el.className = 'hb-msg hb-' + role;
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  function showTyping() {
    var msgs = document.getElementById('hb-widget-messages');
    var el = document.createElement('div');
    el.className = 'hb-typing';
    el.innerHTML = '<div class="hb-dot"></div><div class="hb-dot"></div><div class="hb-dot"></div>';
    el.id = 'hb-typing-indicator';
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function hideTyping() {
    var el = document.getElementById('hb-typing-indicator');
    if (el) el.remove();
  }

  function sendMessage() {
    var input = document.getElementById('hb-widget-input');
    var sendBtn = document.getElementById('hb-widget-send');
    var text = (input.value || '').trim();
    if (!text) return;

    input.value = '';
    input.style.height = 'auto';
    addMessage(text, 'user');
    history.push({ role: 'user', content: text });

    sendBtn.disabled = true;
    showTyping();

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: history.slice(-10), clientId: clientId }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        hideTyping();
        var reply = data.reply || 'Sorry, something went wrong. Try again!';
        addMessage(reply, 'bot');
        history.push({ role: 'assistant', content: reply });
      })
      .catch(function () {
        hideTyping();
        addMessage("Hmm, I couldn't connect. Check your internet and try again.", 'bot');
      })
      .finally(function () {
        sendBtn.disabled = false;
        document.getElementById('hb-widget-input').focus();
      });
  }

  function init() {
    injectStyles();
    var panel = buildPanel();
    var btn = buildButton();
    var isOpen = false;

    // Toggle panel
    btn.addEventListener('click', function () {
      isOpen = !isOpen;
      if (isOpen) {
        panel.classList.add('hb-open');
        btn.innerHTML = `<svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>`;
        // Greeting on first open
        if (history.length === 0) {
          setTimeout(function () {
            addMessage("Hey! I'm TheHypeBot. Ask me anything about our plans, how the AI works, or how to get started.", 'bot');
          }, 200);
        }
        setTimeout(function () { document.getElementById('hb-widget-input').focus(); }, 300);
      } else {
        panel.classList.remove('hb-open');
        btn.innerHTML = `<img src="https://thehypeboxllc.com/mascot-phone.png" alt="Chat with TheHypeBot" />`;
      }
    });

    // Send on button click
    document.getElementById('hb-widget-send').addEventListener('click', sendMessage);

    // Send on Enter (Shift+Enter = newline)
    document.getElementById('hb-widget-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-resize textarea
    document.getElementById('hb-widget-input').addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 80) + 'px';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

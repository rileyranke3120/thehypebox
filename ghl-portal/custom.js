// THE HYPE BOX — GHL Client Portal Custom JS

(function () {
  // Load fonts
  if (!document.querySelector('#thehypebox-fonts')) {
    var link = document.createElement('link');
    link.id = 'thehypebox-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=DM+Sans:wght@400;500;600&display=swap';
    document.head.appendChild(link);
  }

  // Lock page title
  document.title = 'The Hype Box | Client Portal';
  new MutationObserver(function () {
    if (document.title !== 'The Hype Box | Client Portal') {
      document.title = 'The Hype Box | Client Portal';
    }
  }).observe(document.querySelector('title') || document.head, {
    subtree: true, characterData: true, childList: true,
  });

  // Inject a persistent override style tag — appended LAST so it wins cascade order
  function injectDarkStyles() {
    var existing = document.getElementById('thehypebox-dark');
    if (existing) existing.remove();
    var s = document.createElement('style');
    s.id = 'thehypebox-dark';
    s.innerHTML = [
      'html, body { background-color: #000000 !important; color: #ffffff !important; }',
      '#app, [id="app"], [class*="app-"], [class*="-app"] { background-color: #000000 !important; }',
      'div, section, article, aside, nav, header, main, footer, ul, li { background-color: transparent !important; }',
      'body > div, body > div > div { background-color: #000000 !important; }',
      // Sidebar
      '[class*="sidebar"], [class*="left-"], [class*="nav-wrapper"], [class*="side-nav"] { background-color: #0d0d0d !important; border-right: 1px solid #1f1f1f !important; }',
      // Header
      '[class*="header"], [class*="top-bar"], [class*="navbar"], [class*="topbar"] { background-color: #0d0d0d !important; border-bottom: 1px solid #1f1f1f !important; }',
      // Text
      'h1, h2, h3, h4, h5, h6 { color: #ffffff !important; }',
      'p, span, li, td, th, label { color: #cccccc !important; }',
      'a { color: #FFD000 !important; text-decoration: none !important; }',
      'a:hover { color: #ffffff !important; }',
      // Cards
      '[class*="card"], [class*="panel"], [class*="widget"], [class*="section-"] { background-color: #111111 !important; border: 1px solid #1f1f1f !important; border-radius: 8px !important; }',
      // Tailwind overrides
      '.bg-white, .bg-gray-50, .bg-gray-100 { background-color: #000000 !important; }',
      '.text-gray-900, .text-gray-800, .text-gray-700 { color: #ffffff !important; }',
      '.text-gray-600, .text-gray-500, .text-gray-400 { color: #888888 !important; }',
      '.border, .border-gray-200, .border-gray-100 { border-color: #1f1f1f !important; }',
      // Avatar
      '[class*="avatar"] { background-color: #FFD000 !important; color: #000000 !important; }',
      // Inputs
      'input, textarea, select { background-color: #111111 !important; color: #ffffff !important; border-color: #2a2a2a !important; }',
      'input::placeholder, textarea::placeholder { color: #555555 !important; }',
    ].join('\n');
    document.head.appendChild(s);
  }

  // Re-inject if GHL removes it
  function watchAndKeepStyles() {
    injectDarkStyles();
    new MutationObserver(function () {
      if (!document.getElementById('thehypebox-dark')) {
        injectDarkStyles();
      }
    }).observe(document.head, { childList: true });
  }

  // Hide portal name text overlay
  function hideOverlays() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    var node;
    while ((node = walker.nextNode())) {
      var text = node.nodeValue.trim().toLowerCase();
      if (text === 'thehypebox' || text === 'the hype box' || text.includes('everything you need')) {
        var parent = node.parentElement;
        if (parent && parent.querySelectorAll('img').length === 0) {
          parent.style.setProperty('display', 'none', 'important');
        }
      }
    }
  }

  new MutationObserver(hideOverlays).observe(document.body, { childList: true, subtree: true });
  hideOverlays();
  setTimeout(hideOverlays, 300);
  setTimeout(hideOverlays, 1000);
  setTimeout(hideOverlays, 3000);

  // Inject immediately and after Vue mounts
  watchAndKeepStyles();
  setTimeout(injectDarkStyles, 500);
  setTimeout(injectDarkStyles, 1500);
  setTimeout(injectDarkStyles, 3000);

})();

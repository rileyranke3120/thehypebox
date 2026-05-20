// THE HYPE BOX — GHL Client Portal Custom JS
// Loads Barlow Condensed + DM Sans fonts and applies brand polish

(function () {
  // Load Google Fonts
  if (!document.querySelector('#thehypebox-fonts')) {
    const link = document.createElement('link');
    link.id = 'thehypebox-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=DM+Sans:wght@400;500;600&display=swap';
    document.head.appendChild(link);
  }

  // Update page/tab title
  document.title = 'The Hype Box | Client Portal';

  // Watch for dynamic content and re-apply brand title
  const observer = new MutationObserver(function () {
    if (document.title !== 'The Hype Box | Client Portal') {
      document.title = 'The Hype Box | Client Portal';
    }
  });
  observer.observe(document.querySelector('title') || document.head, {
    subtree: true,
    characterData: true,
    childList: true,
  });
})();

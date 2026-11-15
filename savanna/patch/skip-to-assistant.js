/**
 * SYLY Assistant - Skip to Assistant Accessibility Patch
 * File: savanna/patch/skip-to-assistant.js
 *
 * Implements WCAG 2.2 AA bypass block (2.4.1) for host pages (Savanna starters).
 * Prepends a visually-hidden skip link as the very first interactive child of <body>.
 * When tabbed into via keyboard, it becomes immediately visible with high-contrast styling.
 * Activating it locates <db-assistant> (where mode != 'inline') and invokes .open().
 */
(function initSkipToAssistant() {
  function injectSkipLink() {
    if (!document.body || document.getElementById('db-skip-to-assistant')) {
      return;
    }

    // Inject accessible skip link styles if not already present
    const styleId = 'db-skip-to-assistant-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .db-skip-link {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
          z-index: 100000;
        }
        .db-skip-link:focus,
        .db-skip-link:focus-visible {
          position: fixed;
          top: 0.5rem;
          inset-inline-start: 0.5rem;
          width: auto;
          height: auto;
          padding: 0.75rem 1.25rem;
          margin: 0;
          overflow: visible;
          clip: auto;
          white-space: normal;
          background-color: #002B56;
          color: #FFFFFF;
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Ethiopic", sans-serif;
          font-size: 1rem;
          font-weight: 700;
          line-height: 1.5;
          text-decoration: underline;
          border: 3px solid #F5A300;
          border-radius: 4px;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
          outline: 2px solid #FFFFFF;
          outline-offset: 2px;
          cursor: pointer;
        }
      `;
      (document.head || document.body).appendChild(style);
    }

    // Create the skip link anchor
    const skipLink = document.createElement('a');
    skipLink.id = 'db-skip-to-assistant';
    skipLink.href = '#db-assistant-panel';
    skipLink.className = 'db-skip-link';
    skipLink.textContent = 'Skip to assistant / ወደ ረዳቱ ይዝለሉ';

    // Activation handler: calls .open() on non-inline db-assistant
    skipLink.addEventListener('click', (event) => {
      event.preventDefault();
      const assistant = document.querySelector('db-assistant:not([mode="inline"])') ||
                        document.querySelector('db-assistant');

      if (assistant && typeof assistant.open === 'function') {
        assistant.open();
      } else if (assistant) {
        customElements.whenDefined('db-assistant').then(() => {
          if (typeof assistant.open === 'function') {
            assistant.open();
          }
        });
      }
    });

    if (document.body.firstChild) {
      document.body.insertBefore(skipLink, document.body.firstChild);
    } else {
      document.body.appendChild(skipLink);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectSkipLink);
  } else {
    injectSkipLink();
  }
})();

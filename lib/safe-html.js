// innerHTML sanitization wrapper for Phase 5.1.
// Wraps DOMPurify with a default-deny policy targeting attribute-injection vectors.
// Fail mode: if DOMPurify is not loaded (e.g., file:// protocol or vendor missing),
// FAILS CLOSED - returns an empty string so unsanitized markup never reaches the
// DOM, and logs a warning. A sanitizer that fails open silently disables the
// app's primary XSS control on any deploy where the vendored DOMPurify asset is
// missing. Production builds load DOMPurify from dist/vendor/purify.min.js,
// copied by vite-plugin-static-copy.

(function () {
  var SAFE_CONFIG = {
    ALLOWED_TAGS: [
      'a', 'b', 'br', 'button', 'code', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'hr', 'i', 'kbd', 'li', 'ol', 'p', 'pre', 'small', 'span', 'strong', 'sub', 'sup',
      'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul'
    ],
    ALLOWED_ATTR: [
      'class', 'id', 'href', 'target', 'rel', 'title', 'aria-label', 'aria-hidden',
      'aria-describedby', 'aria-controls', 'aria-selected', 'aria-disabled',
      'aria-live', 'aria-pressed', 'aria-modal', 'aria-labelledby', 'aria-invalid',
      'data-index', 'data-type', 'data-icon', 'data-icon-spin', 'data-icon-hydrated',
      'data-days', 'data-message-key', 'role', 'tabindex',
      'onclick'
    ],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'form', 'input', 'textarea', 'select'],
    FORBID_ATTR: ['onerror', 'onload', 'onmouseover', 'onfocus', 'onblur', 'srcdoc', 'formaction'],
    KEEP_CONTENT: true,
    RETURN_TRUSTED_TYPE: false
  };

  var warned = false;
  function warnOnce() {
    if (!warned) {
      console.warn('[SafeHTML] DOMPurify not loaded. Failing closed: content wiped to empty string. Production must load DOMPurify from /vendor/purify.min.js (served by Vite build).');
      warned = true;
    }
  }

  function sanitize(html) {
    if (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
      return window.DOMPurify.sanitize(html, SAFE_CONFIG);
    }
    warnOnce();
    return ''; // fail closed: never emit unsanitized HTML
  }

  function setHTML(element, html) {
    if (!element) return;
    element.innerHTML = sanitize(html);
  }

  window.SafeHTML = { setHTML: setHTML, sanitize: sanitize, CONFIG: SAFE_CONFIG };
})();

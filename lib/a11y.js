// Phase 6 accessibility enhancements (WCAG 2.1 AA per 36 CFR Part 1194).
// Implements:
//   6.3 Tablist roving tabindex + arrow key navigation
//   6.4 Feedback modal focus trap and focus restore on close
//   6.8 Skip-link focus management (programmatic focus on target)
//   6.10 Feedback form aria-invalid wiring

(function () {
  'use strict';

  // ----------------------------------------------------------------
  // 6.3 Tablist keyboard navigation (WAI-ARIA Authoring Practices 1.2)
  // ----------------------------------------------------------------
  function initTablistNav() {
    var tablist = document.querySelector('[role="tablist"]');
    if (!tablist) return;

    var tabs = Array.prototype.slice.call(
      tablist.querySelectorAll('[role="tab"]:not([aria-disabled="true"])')
    );
    if (tabs.length === 0) return;

    // Set initial roving tabindex: only the active (or first) tab is tabbable
    var activeIdx = tabs.findIndex(function (t) { return t.getAttribute('aria-selected') === 'true'; });
    if (activeIdx < 0) activeIdx = 0;
    tabs.forEach(function (t, i) {
      t.setAttribute('tabindex', i === activeIdx ? '0' : '-1');
    });

    function focusTab(idx) {
      var n = tabs.length;
      var target = (idx + n) % n;
      tabs.forEach(function (t, i) {
        t.setAttribute('tabindex', i === target ? '0' : '-1');
      });
      tabs[target].focus();
    }

    tablist.addEventListener('keydown', function (e) {
      var current = tabs.indexOf(document.activeElement);
      if (current < 0) return;
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          focusTab(current + 1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          focusTab(current - 1);
          break;
        case 'Home':
          e.preventDefault();
          focusTab(0);
          break;
        case 'End':
          e.preventDefault();
          focusTab(tabs.length - 1);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          tabs[current].click();
          break;
      }
    });

    // Keep tabindex in sync when active tab changes via click
    tablist.addEventListener('click', function (e) {
      var clicked = e.target.closest('[role="tab"]:not([aria-disabled="true"])');
      if (!clicked) return;
      tabs.forEach(function (t) { t.setAttribute('tabindex', t === clicked ? '0' : '-1'); });
    });
  }

  // ----------------------------------------------------------------
  // 6.4 Modal focus trap with focus restore
  // ----------------------------------------------------------------
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function trapModal(modal, openerBtn) {
    if (!modal) return null;
    var lastFocusedBeforeOpen = openerBtn || document.activeElement;

    function getFocusable() {
      return Array.prototype.slice.call(modal.querySelectorAll(FOCUSABLE))
        .filter(function (el) { return el.offsetParent !== null; });
    }

    function handleKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      var focusable = getFocusable();
      if (focusable.length === 0) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    function close() {
      modal.classList.add('hidden');
      modal.removeEventListener('keydown', handleKey);
      if (lastFocusedBeforeOpen && typeof lastFocusedBeforeOpen.focus === 'function') {
        lastFocusedBeforeOpen.focus();
      }
    }

    modal.addEventListener('keydown', handleKey);
    // Focus first focusable element when opened
    var focusable = getFocusable();
    if (focusable.length > 0) {
      setTimeout(function () { focusable[0].focus(); }, 0);
    }
    return { close: close };
  }

  function initFeedbackModalTrap() {
    var openBtn = document.getElementById('feedbackBtn');
    var modal = document.getElementById('feedbackModal');
    if (!openBtn || !modal) return;
    var trap = null;

    openBtn.addEventListener('click', function () {
      // Wait one tick for the existing app.js handler to set classes
      setTimeout(function () {
        if (!modal.classList.contains('hidden')) {
          trap = trapModal(modal, openBtn);
        }
      }, 0);
    });

    var closeBtns = modal.querySelectorAll('#closeFeedbackModal, #cancelFeedback');
    closeBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (trap) { trap.close(); trap = null; }
      });
    });
  }

  // ----------------------------------------------------------------
  // 6.8 Skip-link focus management
  // ----------------------------------------------------------------
  function initSkipLink() {
    var skip = document.querySelector('.skip-link[href="#main-content"]');
    var main = document.getElementById('main-content');
    if (!skip || !main) return;
    if (!main.hasAttribute('tabindex')) {
      main.setAttribute('tabindex', '-1');
    }
    skip.addEventListener('click', function (e) {
      e.preventDefault();
      main.focus();
      history.replaceState(null, '', '#main-content');
    });
  }

  // ----------------------------------------------------------------
  // 6.10 Feedback form aria-invalid wiring
  // ----------------------------------------------------------------
  function initFeedbackFormA11y() {
    var form = document.getElementById('feedbackForm');
    if (!form) return;
    var fields = [
      { input: 'feedbackType', errorId: 'feedbackTypeError' },
      { input: 'feedbackTitle', errorId: 'feedbackTitleError' },
      { input: 'feedbackDescription', errorId: 'feedbackDescriptionError' }
    ];

    fields.forEach(function (f) {
      var input = document.getElementById(f.input);
      if (!input) return;
      // Insert error container after each required input
      if (!document.getElementById(f.errorId)) {
        var err = document.createElement('span');
        err.id = f.errorId;
        err.className = 'feedback-error-message';
        err.setAttribute('role', 'alert');
        err.setAttribute('aria-live', 'polite');
        input.insertAdjacentElement('afterend', err);
        // Add aria-describedby pointing to error container
        var existing = input.getAttribute('aria-describedby') || '';
        input.setAttribute('aria-describedby', (existing + ' ' + f.errorId).trim());
      }
      // Clear invalid state on user input
      input.addEventListener('input', function () {
        if (input.getAttribute('aria-invalid') === 'true') {
          input.setAttribute('aria-invalid', 'false');
          var err = document.getElementById(f.errorId);
          if (err) err.textContent = '';
        }
      });
    });

    form.addEventListener('submit', function () {
      // Validate on submit, set aria-invalid + error text for empty required fields
      fields.forEach(function (f) {
        var input = document.getElementById(f.input);
        if (!input) return;
        var val = (input.value || '').trim();
        var err = document.getElementById(f.errorId);
        if (!val) {
          input.setAttribute('aria-invalid', 'true');
          if (err) err.textContent = 'This field is required.';
        } else {
          input.setAttribute('aria-invalid', 'false');
          if (err) err.textContent = '';
        }
      });
    });
  }

  // ----------------------------------------------------------------
  // Init on DOMContentLoaded
  // ----------------------------------------------------------------
  function init() {
    initTablistNav();
    initFeedbackModalTrap();
    initSkipLink();
    initFeedbackFormA11y();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.NexusA11y = { initTablistNav: initTablistNav, trapModal: trapModal };
})();

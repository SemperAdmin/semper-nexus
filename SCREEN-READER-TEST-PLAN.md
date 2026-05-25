# Screen Reader Test Plan

Phase 6.7 deliverable. Manual execution required against JAWS 2024 and NVDA per the Marine Corps Section 508 Test Process.

## Setup

- Latest production build (`npm run build && npm run preview`)
- Windows 11 host
- Chrome 121 or later, Edge 121 or later, Firefox 122 or later
- JAWS 2024 Standalone (Freedom Scientific)
- NVDA 2024.2 (NV Access)
- Reset Nexus by clearing localStorage in browser DevTools before each pass

## Pass criteria

A finding is filed for any deviation from the expected announcement. Findings get logged in the GitHub Issues queue with the `accessibility` label.

## Test cases

### TC-01 Page load announcement

1. Open the app at root.
2. Expected screen reader sequence:
   - Page title: "Nexus by Semper Admin"
   - Heading level 1: "Nexus"
   - Region: "main"
   - Live region (polite): "Loading cached data..."
3. Fail conditions: missing h1 announcement, no live region update, region role missing.

### TC-02 Skip-navigation link

1. Tab once from initial focus.
2. Expected: "Skip to main content, link"
3. Press Enter.
4. Expected: focus moves to the `<main>` element, screen reader announces "main, region".
5. Fail: focus stays on the body, or skip link is not the first tab stop.

### TC-03 Header controls keyboard reachability

1. Tab through the header.
2. Expected order: Refresh button, Dark Mode (or Light Mode) toggle.
3. Each control announces its accessible name and current state.
4. Fail: any control unreachable by Tab, or button without accessible name.

### TC-04 Tablist arrow navigation (6.3)

1. Tab to the first message-type tab. Expected: "MARADMIN tab, selected, 1 of 11" (or similar).
2. Press Right arrow. Expected: focus moves to "ALMAR" tab without activating.
3. Press Enter. Expected: ALMAR tab becomes selected, results panel updates.
4. Press Home. Expected: focus jumps to first tab.
5. Press End. Expected: focus jumps to last enabled tab (All Messages, not the dimmed placeholders).
6. Fail: arrow keys do not move focus, Home/End ignored, or focus enters a disabled placeholder tab.

### TC-05 Disabled placeholder tabs

1. With focus on the last enabled tab before placeholders, Tab forward.
2. Expected: placeholders (PAA, PAAN, TAN, FAN, ICAN) are skipped because they have `tabindex="-1"` and `aria-disabled="true"`.
3. Confirm screen reader either skips them entirely or announces them as "disabled" and does not activate on Enter.

### TC-06 Search input

1. Tab to the search box.
2. Expected: "Search messages, edit text, has popup" or similar. Accessible name from the visually hidden `<label>`.
3. Type "promotion". Expected: results filter, the polite live region announces the new count.
4. Fail: input lacks accessible name, or no live update on filter change.

### TC-07 Quick filter buttons

1. Tab into the quick filter group.
2. Expected: "Date range filters, group" announced when entering the group.
3. Each button announces its label and pressed state (`aria-pressed`).
4. Fail: group has no accessible name, or pressed state not communicated.

### TC-08 Message card details

1. Tab into the results region.
2. Expected: each card link or detail button is reachable.
3. Activate a details button. Expected: details row expands, content is announced or focusable.
4. Fail: expansion not announced, focus lost, or content inaccessible.

### TC-09 Feedback modal focus trap (6.4)

1. Activate the "Feedback" floating button.
2. Expected: modal opens, focus moves into the modal, screen reader announces "Share Your Feedback, dialog".
3. Tab through the form. Expected: focus stays within the modal, wrapping from last to first and first to last.
4. Press Escape. Expected: modal closes, focus returns to the Feedback button.
5. Fail: focus escapes the modal, Escape does not close, or focus is lost on close.

### TC-10 Feedback form validation (6.10)

1. Open the feedback modal.
2. Submit with all fields empty.
3. Expected: each empty required field gets `aria-invalid="true"`, error message announced via `role="alert"` live region.
4. Fill the title field. Expected: invalid state clears on input.
5. Submit again with type still empty. Expected: only the type field announces invalid.
6. Fail: errors not announced, invalid state persists after correction, or no association between field and error.

### TC-11 Theme toggle

1. Activate the Dark Mode toggle.
2. Expected: button label updates to "Light Mode", screen reader announces the new label.
3. Fail: button label does not change, or change is silent.

### TC-12 Color contrast verification (6.1)

This case verifies the contrast overrides applied in Phase 6.1.

1. Use the WebAIM Contrast Checker browser extension or DevTools Accessibility pane.
2. Check the following on the dark theme:
   - Active tab text: brass-300 `#D4AF67` on background `#0A1424`. Expected ratio 8.9:1.
   - Primary button text: white `#FFFFFF` on scarlet-300 `#D14150`. Expected 4.58:1.
3. Check the following on the light theme:
   - Subtle foreground: `#6F634A` on parchment `#F8F4E8`. Expected 5.36:1.
   - Accent (brass-700): `#8E6E2E` on parchment. Expected 4.32:1.
4. Fail: any pair drops below the WCAG AA threshold.

### TC-13 Reflow at 320 CSS pixels (6.5)

1. Open Chrome DevTools, Device Toolbar, custom width 320 CSS px.
2. Expected: tab row scrolls horizontally with snap, no horizontal page scroll, all content reachable.
3. Confirm the 5 placeholder tabs (PAA, PAAN, TAN, FAN, ICAN) are hidden below 720px breakpoint.
4. Fail: page-level horizontal scroll appears, tab row breaks layout, or content is clipped.

### TC-14 Text resize to 200 percent (6.6)

1. Browser zoom to 200 percent.
2. Expected: all content reflows, no clipping, no horizontal page scroll on a 1280px viewport.
3. Confirm h1, byline, tab labels, card subjects remain readable.
4. Fail: clipping, overlapping text, or required content lost.

### TC-15 Reduced motion preference

1. Set OS `prefers-reduced-motion` to "reduce".
2. Reload the app.
3. Expected: tab transitions, icon spin animations, modal open animations all reduce to near-instant.
4. Fail: any animation persists at full duration.

## Reporting template

```
Test case: TC-XX
Screen reader: JAWS 2024 build X.X.X / NVDA 2024.2
Browser: Chrome 121
Severity: critical | major | minor | cosmetic
Expected: <quote from test case>
Actual: <what happened>
Reproducibility: always | intermittent
Suggested fix: <if known>
```

## Out-of-scope for this PoC pass

- iOS VoiceOver and Android TalkBack testing (.mil migration scope)
- Dragon NaturallySpeaking voice control (DoD STIG compliance pass)
- High contrast mode in Windows (Phase 7 visual QA pass)
- Right-to-left language support (not in PoC scope)

---

Last updated: 2026-05-24
Owner: PoC accessibility lead (to be assigned)

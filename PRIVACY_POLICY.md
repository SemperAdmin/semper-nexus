# Privacy Policy for Semper Nexus

**Effective Date:** June 2, 2026  
**Last Updated:** November 27, 2026  
**Operator:** Semper Admin

## 1. Overview

Semper Nexus ("App") is a web-based application for monitoring publicly available military directives, messages, and publications from United States Department of Defense and military branch official sources. This Privacy Policy explains how we handle your data when you use the App.

**Key principle: We do not collect, store, or transmit personally identifiable information (PII) about you.**

---

## 2. What Data We Collect

### 2.1 Local Storage (Browser Cache)
The App stores the following data on **your device only** using browser LocalStorage:

- Message feed cache (MARADMINs, ALMARs, MCPUBs, ALNAV, SECNAV, JTR, DoD Forms, DoD FMR, IGMC)
- User preferences (selected message type, date filter range, theme preference)
- Summary cache timestamps
- Error analytics (JavaScript errors encountered during your session)

**This data never leaves your device.** It is used solely to provide offline access and restore your preferences on subsequent visits.

### 2.2 Web Performance Metrics (Web Vitals)
The App includes a copy of the open-source Web Vitals library, served from the App's own site. It measures page performance (such as load time and layout stability) in your browser and writes the results to the browser's developer console only. **These measurements are not sent anywhere.**

### 2.3 Error Logging (Client-Side)
The App maintains an error analytics system that logs JavaScript errors and runtime issues:

- Error message and stack trace
- Browser user agent
- Current page URL
- Timestamp of error

**This data is stored in your browser's memory only and is not transmitted externally.** It is cleared when you close or refresh the page.

### 2.4 Hosting
The hosting platforms (cloud.gov and GitHub Pages) keep standard web
server access logs, such as IP address, time, requested page and browser
type, for operations and security. Semper Admin does not add tracking of
its own.

---

## 3. What Data We Do NOT Collect

The App **does not**:
- Collect your name, email address, phone number, or other personal identifiers
- Create user accounts or require authentication
- Use cookies (only LocalStorage for caching)
- Track your location
- Access your device camera, microphone, or contacts
- Record or log your interactions with the App (the App itself does not; see Hosting below for platform logs)
- Transmit any user data to external servers or third parties
- Monetize or sell user data

---

## 4. Data From Public Sources

The App fetches publicly available military directives and messages from official government sources:

| Source | URL | Data Type |
|--------|-----|-----------|
| Marines.mil RSS | marines.mil | MARADMINs, ALMARs, MCPUBs |
| MyNavyHR RSS | mynavyhr.navy.mil | ALNAVs |
| SECNAV Directives | secnav.navy.mil | Secretary of Navy Instructions |
| Travel.dod.mil RSS | travel.dod.mil | Joint Travel Regulations (JTR) |
| DoD FMR | comptroller.defense.gov | Financial Management Regulations |
| DoD Forms | esd.whs.mil | Department of Defense Forms |
| IGMC | igmc.marines.mil | Inspector General Marine Corps |

**This data is publicly available and not subject to this privacy policy.** The App acts as a news aggregator and is not affiliated with these government agencies.

---

## 5. Feed Proxy

Browsers cannot read most government feeds directly from another site, so the App fetches them through a small proxy service operated by Semper Admin and hosted on Render (render.com). For each request the proxy receives **only the address of the public page or feed** being fetched, plus the standard connection information any web server sees (such as your IP address), which the hosting provider may log. Your searches, filters and preferences are not sent. Some sources (for example DoD FMR and ALNAV) are requested directly from the official site first.

The public third-party CORS relays the App used in the past are no longer used.

---

## 6. Service Worker & Offline Caching

The App registers a service worker to enable offline functionality and progressive web app (PWA) capabilities. The service worker:

- Caches feed data and static assets on your device
- Allows the App to function offline
- Does not transmit any data externally

---

## 7. Legal Basis for Processing (GDPR)

For users in the European Union, processing is based on **legitimate interest** (Article 6(1)(f) GDPR):

- **Interest pursued:** Provide a functional news aggregator for military information
- **Necessity:** LocalStorage is necessary for performance and functionality
- **Balancing test:** No interference with privacy rights; all data is either local-only or anonymized

**No sensitive personal data is processed.** GDPR consent (Article 7) is not required for this App.

---

## 8. Data Retention

- **LocalStorage cache:** Retained until user manually clears browser cache or selects "Clear All Data" (if implemented)
- **Error logs:** Retained in memory only; cleared on page close

---

## 9. Your Rights

You have the following rights under GDPR, CCPA, and similar privacy laws:

**Right to Access:** Request a copy of data we hold about you (minimal; only local data on your device)

**Right to Deletion:** Clear your LocalStorage data by using your browser's "Clear Browsing Data" > "Cookies and Cached Content"

**Right to Opt-Out:** Not applicable; the App does not track you

**Right to Withdraw Consent:** Not applicable; no consent required for this App

---

## 10. Data Security

- All data is stored locally on your device using browser APIs
- Data is not encrypted (browser-level security applies)
- Apart from fetching public feeds through the proxy described in section 5 (over HTTPS), the App transmits no data
- The App does not use authentication; no login credentials are required

---

## 11. Third-Party Services Summary

| Service | Purpose | Data Shared |
|---------|---------|-------------|
| Semper Admin feed proxy (hosted on Render) | Fetch public feeds and pages | Address of the public page or feed; standard connection data |
| Hosting platforms (cloud.gov, GitHub Pages) | Serve the App | Standard access logs (see 2.4) |
| Government sources | Message content | None (read-only) |

---

## 12. Children's Privacy

The App is not intended for children under 13. We do not knowingly collect data from children. If you believe we have inadvertently collected data from a child, contact us immediately.

---

## 13. International Users

**EU/EEA Users:** This App complies with GDPR. Data processing is minimal (LocalStorage only). No consent is required.

**California Users:** This App complies with CCPA/CPRA. No "personal information" is sold or shared. Your rights to know, delete, and opt-out are honored via browser controls.

**Other Jurisdictions:** Local privacy laws may apply. Contact us if you have questions.

---

## 14. Changes to This Policy

We may update this Privacy Policy periodically. Changes will be reflected on this page with an updated "Last Updated" date. Continued use of the App implies acceptance of the updated policy.

---

## 15. GDPR & Privacy Complaints

You have the right to lodge a complaint with your local data protection authority regarding data privacy concerns.

## 16. Disclaimer

Semper Nexus is an **unofficial tool** not affiliated with the United States Marine Corps, United States Navy, Department of Defense, or any government agency. The App provides informational purposes only. Data accuracy and freshness are not guaranteed. Refer to official government sources for authoritative information.

---

**End of Privacy Policy**

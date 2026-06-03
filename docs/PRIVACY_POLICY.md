# Privacy Policy for Message Watch

**Effective Date:** June 2, 2026  
**Last Updated:** June 2, 2026  
**Operator:** Semper Admin

## 1. Overview

Message Watch ("App") is a web-based application for monitoring publicly available military directives, messages, and publications from United States Department of Defense and military branch official sources. This Privacy Policy explains how we handle your data when you use the App.

**Key principle: We do not collect, store, or transmit personally identifiable information (PII) about you.**

---

## 2. What Data We Collect

### 2.1 Local Storage (Browser Cache)
The App stores the following data on **your device only** using browser LocalStorage:

- Message feed cache (MARADMINs, ALMARs, MCPUBs, ALNAV, SECNAV, JTR, DoD Forms, DoD FMR, IGMC)
- User preferences (selected message type, date filter range, theme preference)
- Summary cache timestamps
- Proxy cache preference (for CORS bypass optimization)
- Error analytics (JavaScript errors encountered during your session)

**This data never leaves your device.** It is used solely to provide offline access and restore your preferences on subsequent visits.

### 2.2 Web Performance Metrics (Web Vitals)
The App loads Google's Web Vitals library (`web-vitals@3.5.0`) from unpkg.com CDN. This library collects anonymous performance metrics:

- Core Web Vitals (Largest Contentful Paint, Cumulative Layout Shift, First Input Delay)
- Page load time
- User interaction metrics

**These metrics are collected by Google** and used for performance analysis. Google's data practices are governed by [Google's Privacy Policy](https://policies.google.com/privacy).

### 2.3 Error Logging (Client-Side)
The App maintains an error analytics system that logs JavaScript errors and runtime issues:

- Error message and stack trace
- Browser user agent
- Current page URL
- Timestamp of error

**This data is stored in your browser's memory only and is not transmitted externally.** It is cleared when you close or refresh the page.

---

## 3. What Data We Do NOT Collect

The App **does not**:
- Collect your name, email address, phone number, or other personal identifiers
- Create user accounts or require authentication
- Use cookies (only LocalStorage for caching)
- Track your location
- Access your device camera, microphone, or contacts
- Record or log your interactions with the App
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

## 5. CORS Proxy Services

The App uses CORS proxy services to bypass cross-origin restrictions when fetching feeds. The proxy services used may include:

- corsproxy.io
- allorigins.win
- cors-anywhere.herokuapp.com
- api.codetabs.com

These proxies receive the URL of the public government feeds you request **only**. No personal data is transmitted through these proxies. These third-party services have their own privacy policies that you should review.

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
- **Necessity:** LocalStorage and Web Vitals are necessary for performance and functionality
- **Balancing test:** No interference with privacy rights; all data is either local-only or anonymized

**No sensitive personal data is processed.** GDPR consent (Article 7) is not required for this App.

---

## 8. Data Retention

- **LocalStorage cache:** Retained until user manually clears browser cache or selects "Clear All Data" (if implemented)
- **Error logs:** Retained in memory only; cleared on page close
- **Web Vitals data:** Retained by Google per their [retention policy](https://policies.google.com/privacy)

---

## 9. Your Rights

You have the following rights under GDPR, CCPA, and similar privacy laws:

**Right to Access:** Request a copy of data we hold about you (minimal; only local data on your device)

**Right to Deletion:** Clear your LocalStorage data by using your browser's "Clear Browsing Data" > "Cookies and Cached Content"

**Right to Opt-Out:** Disable Web Vitals by blocking unpkg.com in your browser or ad blocker

**Right to Withdraw Consent:** Not applicable; no consent required for this App

---

## 10. Data Security

- All data is stored locally on your device using browser APIs
- Data is not encrypted (browser-level security applies)
- No data is transmitted externally except Web Vitals metrics (HTTPS)
- The App does not use authentication; no login credentials are required

---

## 11. Third-Party Services Summary

| Service | Purpose | Data Shared |
|---------|---------|-------------|
| unpkg.com (Web Vitals) | Performance metrics | Anonymous usage stats |
| Google (Web Vitals analysis) | Performance analysis | Page load time, user agent |
| CORS proxies | Bypass CORS restrictions | Public feed URLs only |
| Government sources | Message content | None (read-only) |

---

## 12. Children's Privacy

The App is not intended for children under 13. We do not knowingly collect data from children. If you believe we have inadvertently collected data from a child, contact us immediately.

---

## 13. International Users

**EU/EEA Users:** This App complies with GDPR. Data processing is minimal (LocalStorage + Web Vitals). No consent is required.

**California Users:** This App complies with CCPA/CPRA. No "personal information" is sold or shared. Your rights to know, delete, and opt-out are honored via browser controls.

**Other Jurisdictions:** Local privacy laws may apply. Contact us if you have questions.

---

## 14. Changes to This Policy

We may update this Privacy Policy periodically. Changes will be reflected on this page with an updated "Last Updated" date. Continued use of the App implies acceptance of the updated policy.

---

## 15. GDPR & Privacy Complaints

You have the right to lodge a complaint with your local data protection authority regarding data privacy concerns.

## 16. Disclaimer

Message Watch is an **unofficial tool** not affiliated with the United States Marine Corps, United States Navy, Department of Defense, or any government agency. The App provides informational purposes only. Data accuracy and freshness are not guaranteed. Refer to official government sources for authoritative information.

---

**End of Privacy Policy**

# Anveshak Enterprise CRM - Technical Blueprint

This document details the complete technology stack, active integrations, architectural flow, and remaining production items to make the system fully ready for scale.

---

## 1. Core Technology Stack

| Technology Layer | Stack Selection | Purpose & Implementation |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 15+ (App Router)** | Powers routing, server components, client interactivity, and static generation. |
| **Styling Engine** | **Vanilla CSS & CSS Variables** | Bespoke design system utilizing modern gradients, glassmorphism, responsive flex layouts, and custom theme variables. |
| **Database** | **Supabase (PostgreSQL)** | Relational cloud database hosting tables for leads, deals, companies, tasks, quotes, and audit logs. |
| **Auth System** | **Simulated Multi-Role Guard** | Authenticates roles (Admin, Manager, Sales Rep) with production credentials check (e.g. KP Sumanth). |
| **Audio Feedback** | **HTML5 Web Audio API** | Real-time audio synthesis to generate electronic tone feedback for alert notifications without loading external assets. |

---

## 2. Active Technical Implementations

```mermaid
graph TD
    UI[Next.js React UI] <--> State[React State Memory]
    State <--> Cache[Local Storage Backup]
    State -- Push updates --Sync[Sync Engine]
    Sync -- Map camelCase to snake_case -- DB[Supabase Postgres]
    Scanner[AI Card Scanner] -- Extract metadata -- State
    VoIP[VoIP Call HUD] -- Log Notes -- State
    Email[Email Composer] -- Trigger mailto: -- NativeClient[Native Mail App]
    WA[WhatsApp Composer] -- Redirect api.whatsapp.com -- WATab[WhatsApp Web]
```

### Key Modules:
1. **Dynamic Background Sync Hook**:
   * Bridges React's `camelCase` states and PostgreSQL's `snake_case` database schema.
   * Runs isolated table-by-table updates so an error in one module does not disrupt the rest of the database.
   * Safely loads initial data on startup, preventing blank slates from overwriting local caches.
2. **AI-Enhanced Visiting Card Scanner (OCR Simulator)**:
   * Fuzzy matches scanned image text against regex patterns to automatically parse details like name, company, email, and phone numbers.
3. **VoIP Calling Simulator**:
   * Simulates WebRTC connection states (Dialing -> Connected -> Ended).
   * Incorporates active timer tracking and a notes input panel to automatically save logs into the lead's history.
4. **WhatsApp & Email Dispatchers**:
   * Pre-loads templates (e.g., introductions, meeting follow-ups, and proposals).
   * Generates sanitized redirects to WhatsApp API and native OS `mailto:` clients.
5. **Centralized Contact Management ("One Person = One Record")**:
   * Multi-signal scored deduplication engine (Phone 100, Email 90, Name+Company 40, Name 20).
   * Strict E.164 phone normalization (`lib/phone.ts`) with default India (`+91`) resolution.
   * Interactive Contact Merge Conflict Diff modal (`ContactMergeModal.tsx`) with snapshot preservation (`ContactMergeLog`).
   * Contact 360 Drawer (`Contact360Modal.tsx`) tracking complete communications timeline, provenance history, and linked pipeline deals.
   * Excel & CSV Batch Importer (`ExcelImportModal.tsx`) with column mapper, preview validator, and 1-click batch rollbacks.

---

## 3. Remaining Tasks for Production Scale

### Phase 1: Real-World Communication Gateways (API Integrations)
- [ ] **Real VoIP Dialing**:
  * Integrate Twilio Voice SDK or Exotel WebRTC to make live telephone calls directly from the browser call button.
- [ ] **Automated Emails**:
  * Implement a backend API endpoint using Nodemailer or Resend to send emails directly from the CRM without relying on native mail client redirects.
- [ ] **Official WhatsApp API**:
  * Hook up the Meta WhatsApp Business Cloud API to send automated templates and notifications straight to customer numbers.

### Phase 2: Live AI Document Parser
- [ ] **Cloud Vision API**:
  * Replace the front-end client-side fuzzy scanner with a backend API endpoint using Google Cloud Vision or OpenAI GPT-4o Vision to parse actual visiting card images into structured JSON with 100% accuracy.

### Phase 3: Live Database Listeners
- [ ] **Supabase Realtime Channel**:
  * Turn on Supabase Realtime listeners (`supabase.channel().on(...)`) so changes made by a Manager are instantly pushed to Sales Rep dashboards in real time without refreshing the page.

### Phase 4: Production Authentication & Middleware
- [ ] **Supabase Auth Integration**:
  * Replace custom role guards with standard JWT token verification, password hashing, and OAuth flow (Google, Microsoft) to secure CRM routes.

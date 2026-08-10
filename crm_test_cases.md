# Anveshak Enterprise CRM - Development Test Cases Audit

This document outlines the test cases and validation scenarios verified during the development and refactoring of the Anveshak CRM project.

---

## 1. Authentication & Multi-Role Authorization

### Test Case 1: Default Administrator Authentication
*   **Objective**: Verify the system authenticates the default administrator account.
*   **Test Input**: Email `sumanth@anveshakhub.com`, Password `12345678`.
*   **Expected Result**: Successful sign-in, session state unlocks, and user is redirected to the CRM home dashboard with Admin role variables initialized.

### Test Case 2: Team Invite & Session Authentication
*   **Objective**: Validate team invitations and credential matching.
*   **Test Input**: Provision a new user profile via settings (e.g. Sales Rep role), logout, and authenticate using matching invited email with default password checks (`anveshak123`).
*   **Expected Result**: User session successfully authenticates and redirects user with matched role settings.

### Test Case 3: Role Security Access Guards
*   **Objective**: Enforce view restriction protocols on lower roles.
*   **Test Input**: Access the CRM with role set to `Sales Rep` or `Manager` and attempt to open restricted views (e.g. *User Provisioning*, *Lead Scoring Rules*, *Database Backups*).
*   **Expected Result**: View is blocked and access-denied warnings or mock screen alerts are shown.

---

## 2. Supabase Cloud Sync & Mapping

### Test Case 4: Database-to-Frontend Property Mapping
*   **Objective**: Ensure data fetched from Supabase maps correctly to state objects.
*   **Test Input**: Trigger on-boot remote table scan against a connected Supabase database containing seeded data.
*   **Expected Result**: Database column keys in `snake_case` (e.g., `due_date`, `custom_values`) translate into matching React state `camelCase` keys (`dueDate`, `customValues`) without crashing.

### Test Case 5: Race Condition Prevention on Boot
*   **Objective**: Prevent initial state initialization from overwriting active cloud data.
*   **Test Input**: Load page with empty React state lists (`[]`) while connected to Supabase containing active data.
*   **Expected Result**: Persistence `useEffect` checks for `isInitialLoadDone = true` flag before writing, preserving remote tables.

### Test Case 6: Transaction Isolation in Sync Hook
*   **Objective**: Prevent single table constraint violations from blocking the rest of the database.
*   **Test Input**: Trigger sync with a foreign key constraint violation on `leads`.
*   **Expected Result**: Error is handled and isolated in the `leads` try-catch block; companies, deals, tasks, and audit logs continue to sync successfully.

---

## 3. Core CRM Data Operations

### Test Case 7: Wipe Database Reset
*   **Objective**: Test database purging.
*   **Test Input**: Click **Wipe Database (Clean Production State)** inside settings.
*   **Expected Result**: All local memory state lists are cleared, and Supabase tables are purged of matching entries.

### Test Case 8: Demo Data Seeding
*   **Objective**: Test bulk demo record seeding.
*   **Test Input**: Click **Load Sample Demo Data** inside settings.
*   **Expected Result**: All CRM state arrays are populated with mock records and automatically upserted to Supabase.

### Test Case 9: Real CSV Exporter
*   **Objective**: Validate spreadsheet compilation and file generation.
*   **Test Input**: Click **Export CSV** in Contacts, Deals, or Tasks tabs.
*   **Expected Result**: Browser compiles a UTF-8 text Blob and triggers a local file download containing correct headers and values.

---

## 4. OCR Card Scanner & Communication Modules

### Test Case 10: Fuzzy AI Card Scanner (OCR)
*   **Objective**: Verify scanned card parsing and metadata extraction.
*   **Test Input**: Upload card image containing substring matches for `derbi` or `sathya`.
*   **Expected Result**: System auto-fills scanned fields with *Sathyanarayana B V*, *DERBI Foundation*, *+91 99800 03627*, and *ceo@derbifoundation.com*.

### Test Case 11: Email Composer Template Redirection
*   **Objective**: Check mail template compilation.
*   **Test Input**: Open email modal, choose *Quote Proposal* template, click send.
*   **Expected Result**: Formulates mailto string and opens OS default mail application with pre-populated fields.

### Test Case 12: WhatsApp URL Sanitization
*   **Objective**: Verify phone number formatting for WhatsApp.
*   **Test Input**: Open WhatsApp modal for a contact with phone number `+91 99800 03627` and click send.
*   **Expected Result**: Sanitizes phone symbols and opens browser redirect tab to `api.whatsapp.com/send?phone=919980003627&text=...`.

### Test Case 13: VoIP call Dialer & Notes Tracker
*   **Objective**: Verify VoIP calling simulation.
*   **Test Input**: Click **Call** on a contact card.
*   **Expected Result**: Caller panel pops up, counts active call duration, lets user input notes, and appends a call entry to the contact's timeline upon hang-up.

### Test Case 14: Dynamic Web Audio Tone Synthesis
*   **Objective**: Validate real-time system event audio chimes.
*   **Test Input**: Trigger a success toast (e.g. saving an email) or warning.
*   **Expected Result**: HTML5 Web Audio API synthesizes respective frequencies (e.g. Success high-pitch double tone vs warning minor-third tone) directly on the client.

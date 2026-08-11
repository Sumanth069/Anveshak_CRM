# Implementation Plan: Floating Owner Feedback & Requirements Widget

This document outlines the proposed design and architecture for a temporary, floating feedback widget embedded in the Anveshak CRM. It allows the CRM owner to submit real-time suggestions, bug reports, and page requirements directly while reviewing the live app hosted on Vercel.

---

## 💡 Overview & Purpose

* **Goal**: Provide a lightweight, floating chat-like bubble in the CRM so your owner can give real-time feedback, note missing page requirements, and report tweaks while using the app.
* **Scope**: Temporary, non-intrusive UI widget that persists feedback notes into the Supabase database for developer review and resolution.

---

## 🎨 User Experience & UI Design

### 1. Floating Trigger Button (Bottom-Right FAB)
* **Position**: Fixed at `bottom: 24px; right: 24px; z-index: 1000;`.
* **Appearance**: Sleek dark navy/gold floating bubble with a chat vector icon (`💬`) and badge label (`Owner Feedback`).
* **Interaction**: Tap/Click to expand the chat panel; smooth collapse animation.

### 2. Floating Feedback & Requirement Panel (Chat Pop-up)
* **Context Auto-Detection**: Automatically records which CRM tab the owner is currently viewing (`Daily Contacts`, `Kanban Deals`, `GST Quotes`, `Dashboard`, etc.).
* **Category Selector**:
  * 💡 `Feature Suggestion`
  * 📝 `Page Requirement`
  * 🐛 `Bug / Glitch Report`
  * 🎨 `Design / Layout Tweak`
* **Input Area**: Textarea for detailed suggestions/requirements.
* **Submit Action**: Single-click `Send Suggestion →` with immediate toast confirmation.

### 3. Developer Review Drawer (Feedback Inbox)
* A collapsible list inside the widget (or under Admin Settings) allowing you to:
  * View all submitted notes grouped by page tab and timestamp.
  * Mark suggestions as **`In Progress`** or **`Resolved`**.
  * Filter notes by category.

---

## 🗄️ Database & Backend Architecture

### Supabase Table Schema (`owner_feedback`)

We will create a lightweight table in Supabase via Prisma migration or SQL script:

```sql
CREATE TABLE owner_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_tab VARCHAR(50) NOT NULL,
  category VARCHAR(50) DEFAULT 'Requirement',
  note_text TEXT NOT NULL,
  author_name VARCHAR(100) DEFAULT 'CRM Owner',
  status VARCHAR(20) DEFAULT 'New', -- 'New' | 'In Progress' | 'Resolved'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Server Action (`saveOwnerFeedbackAction`)
* Located in [`app/actions/crm.ts`](file:///c:/Users/kpsum/Anveshak_CRM/app/actions/crm.ts).
* Writes new feedback entries directly into Supabase.
* Automatically fallback gracefully if offline/unconfigured.

---

## 🛠️ Proposed File Changes

### [NEW] [`components/crm/OwnerFeedbackWidget.tsx`](file:///c:/Users/kpsum/Anveshak_CRM/components/crm/OwnerFeedbackWidget.tsx)
* Floating action button & popup glassmorphism chat panel component.
* Includes feedback list view for developer resolution tracking.

### [MODIFY] [`app/actions/crm.ts`](file:///c:/Users/kpsum/Anveshak_CRM/app/actions/crm.ts)
* Add `saveOwnerFeedbackAction` and `fetchOwnerFeedbackAction` server actions for Supabase interaction.

### [MODIFY] [`app/crm/page.tsx`](file:///c:/Users/kpsum/Anveshak_CRM/app/crm/page.tsx)
* Embed `<OwnerFeedbackWidget activeTab={activeTab} currentUser={currentUser} />` at the root layout level.

### [MODIFY] [`prisma/schema.prisma`](file:///c:/Users/kpsum/Anveshak_CRM/prisma/schema.prisma)
* Add `OwnerFeedback` model mapping to `owner_feedback` table.

---

## ⚡ User Review Required

> [!IMPORTANT]
> **Temporary vs Permanent**: Since this is intended as a temporary tool for developer-owner collaboration, we will design it so it can be enabled/disabled cleanly with a single boolean flag (`ENABLE_OWNER_FEEDBACK = true/false`).

---

## 🧪 Verification Plan

### Automated Checks
* Run `npx tsc --noEmit` to verify type safety.
* Run `npm run build` to ensure Vercel production build readiness.

### Manual Verification
* Test sending feedback notes on mobile screen widths (`< 768px`) and desktop viewports.
* Verify entries persist into Supabase and can be checked off by developer.

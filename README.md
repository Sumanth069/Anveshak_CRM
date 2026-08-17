# 🏢 Anveshak Enterprise CRM

An enterprise-grade, high-velocity CRM built for modern B2B sales teams, featuring **Centralized Contact Management ("ONE PERSON = ONE CONTACT RECORD")**, AI-powered Visiting Card OCR, Deal Kanban Pipeline with Stage Aging, GST Quotation Engine, and Supabase PostgreSQL persistence.

---

## 🚀 Key Features

### 1. 📇 Centralized Contact Directory ("ONE PERSON = ONE RECORD")
- **Canonical E.164 Phone Normalization**: Automatically normalizes and validates phone numbers (default `+91` India support).
- **Multi-Signal Scored Deduplication**: Computes match scores across Phone (`100`), Email (`90`), Name + Company (`40`), and Name Similarity (`20`) to eliminate duplicate entities across the system.
- **Interactive Contact Merge Diff**: Side-by-side field resolution with "Newest non-empty wins" smart merge algorithm and snapshot preservation.
- **Contact 360° Profile Drawer**: Unified view of contact metadata, cross-channel communication timeline, linked pipeline deals, and merge provenance.
- **Spreadsheet Batch Importer**: Import Excel (`.xlsx`, `.xls`) and CSV files with smart column header auto-mapping, localStorage preset recall, and pre-import status preview.
- **1-Click Batch Rollbacks**: Undo spreadsheet imports safely from the Audit Registry.
- **1-Click Multi-Channel Outreach**: Instant WhatsApp Web, Phone Dialer (`tel:`), and Email (`mailto:`) launchers with template tags (`[Name]`, `[Company]`, `[Your Name]`) and automatic interaction logging.

### 2. 💼 Deals & Pipeline Velocity
- Visual Kanban board with drag-and-drop stage progression (`Discovered`, `Engaged`, `Proposal`, `Negotiation`, `Won`, `Lost`).
- Dynamic deal probability, expected value calculations, and stage aging indicators.

### 3. 🎯 Leads Queue & Scoring Matrix
- Automated lead scoring matrix with weighted criteria.
- 1-Click lead qualification and deal conversion.

### 4. 🧾 GST Quotation Builder
- Intra-state (CGST + SGST 9% + 9%) and Inter-state (IGST 18%) automatic tax computations.
- Real-time client proposal preview with payment terms and export options.

### 5. 🔍 Global Index Autocomplete Search (SHR-01)
- Unified search across Contacts, Leads, Deals, Tasks, and Quotes with keyboard navigation.

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 15+ (App Router)](https://nextjs.org/)
- **Database & ORM**: [Supabase (PostgreSQL)](https://supabase.com/) & [Prisma ORM 5.22](https://www.prisma.io/)
- **Styling**: Vanilla CSS with custom design tokens and glassmorphism styling
- **Utilities**: `libphonenumber-js`, `xlsx`
- **Language**: TypeScript

---

## 📦 Getting Started

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Sumanth069/Anveshak_CRM.git
cd Anveshak_CRM
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local` and add your database credentials:
```bash
cp .env.example .env.local
```

### 3. Generate Prisma Client & Push Database Schema
```bash
npx prisma generate
npx prisma db push
```

### 4. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (redirects to `/crm`).

---

## 📄 License
Internal proprietary software for Anveshak Hub. All rights reserved.

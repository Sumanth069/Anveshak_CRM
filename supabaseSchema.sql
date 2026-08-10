-- SQL Script to set up Anveshak CRM database tables in Supabase SQL Editor

-- 1. COMPANIES TABLE
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    industry TEXT,
    website TEXT,
    city TEXT,
    state TEXT,
    address TEXT,
    contacts_count INTEGER DEFAULT 0,
    total_deal_value NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. LEADS TABLE
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    company TEXT,
    email TEXT,
    phone TEXT,
    status TEXT CHECK (status IN ('New', 'Contacted', 'Qualified', 'Disqualified')) DEFAULT 'New',
    score INTEGER DEFAULT 0,
    owner TEXT,
    custom_values JSONB DEFAULT '{}'::jsonb,
    activities JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. DEALS TABLE
CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    company TEXT,
    value NUMERIC DEFAULT 0,
    probability INTEGER DEFAULT 0,
    stage TEXT DEFAULT 'New',
    owner TEXT,
    expected_close DATE,
    lost_reason TEXT,
    days_in_stage INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. TASKS TABLE
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    assignee TEXT,
    due_date DATE,
    priority TEXT CHECK (priority IN ('Low', 'Medium', 'High')) DEFAULT 'Medium',
    status TEXT CHECK (status IN ('Open', 'Completed')) DEFAULT 'Open',
    linked_to TEXT,
    is_team BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. USERS_LIST TABLE
CREATE TABLE IF NOT EXISTS users_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    role TEXT CHECK (role IN ('ADMIN', 'MANAGER', 'SALES_REP')) DEFAULT 'SALES_REP',
    is_active BOOLEAN DEFAULT true,
    assigned_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. QUOTES TABLE
CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY,
    deal_id UUID,
    company TEXT NOT NULL,
    contact TEXT,
    gst_type TEXT CHECK (gst_type IN ('intra', 'inter')) DEFAULT 'intra',
    items JSONB DEFAULT '[]'::jsonb,
    status TEXT CHECK (status IN ('Draft', 'Pending Approval', 'Accepted', 'Rejected')) DEFAULT 'Draft',
    total_amount NUMERIC DEFAULT 0,
    terms_and_conditions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 7. AUDIT_LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user" TEXT NOT NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    before_state TEXT,
    after_state TEXT
);

-- 8. CUSTOM_FIELDS TABLE
CREATE TABLE IF NOT EXISTS custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    entity TEXT CHECK (entity IN ('Lead', 'Contact', 'Deal')) DEFAULT 'Lead',
    type TEXT CHECK (type IN ('text', 'number', 'date', 'select')) DEFAULT 'text',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 9. TERMS_TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS terms_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Turn off Row Level Security (or customize it) to allow plug-and-play local tests
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE deals DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE users_list DISABLE ROW LEVEL SECURITY;
ALTER TABLE quotes DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE custom_fields DISABLE ROW LEVEL SECURITY;
ALTER TABLE terms_templates DISABLE ROW LEVEL SECURITY;

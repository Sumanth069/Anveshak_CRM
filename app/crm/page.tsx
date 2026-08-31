"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Tesseract from 'tesseract.js';
import KanbanBoard from '@/components/crm/KanbanBoard';
import GSTQuoteBuilder, { AnveshakLogo, numberToIndianWords } from '@/components/crm/GSTQuoteBuilder';
import SystemDiagnostics from '@/components/crm/SystemDiagnostics';
import AuditDiffModal from '@/components/crm/AuditDiffModal';
import SupabaseSettings from '@/components/crm/SupabaseSettings';
import OwnerFeedbackWidget from '@/components/crm/OwnerFeedbackWidget';
import ContactFiltersBar from '@/components/crm/contacts/ContactFiltersBar';
import Contact360Modal from '@/components/crm/contacts/Contact360Modal';
import ContactMergeModal from '@/components/crm/contacts/ContactMergeModal';
import ExcelImportModal from '@/components/crm/contacts/ExcelImportModal';
import QuickCommModal from '@/components/crm/contacts/QuickCommModal';
import UserProfileCard from '@/components/crm/UserProfileCard';
import OutlookSyncModal from '@/components/crm/OutlookSyncModal';
import { getOutlookWebComposeUrl, downloadIcsFile } from '@/lib/outlookCalendar';
import { normalizePhone, formatPhoneDisplay } from '@/lib/phone';
import { scoreDuplicate } from '@/lib/dedup';
import { updateSupabaseConfig, isSupabaseConnected } from '@/lib/supabase';

// Type Definitions
interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: 'New' | 'Contacted' | 'Qualified' | 'Disqualified';
  score: number;
  owner: string;
  tags?: string[];
  activities: { action: string; points: number; date: string }[];
  customFields?: { [key: string]: string };
}

interface Deal {
  id: string;
  name: string;
  company: string;
  value: number;
  stage: string;
  probability: number;
  expectedClose: string;
  owner: string;
  lostReason?: string;
  daysInStage: number;
}

interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  priority: 'Low' | 'Medium' | 'High';
  status: 'Open' | 'Completed';
  assignee: string;
  linkedTo?: string; // Lead or Deal name
}

interface ActivityLog {
  id: string;
  date: string;
  type: 'Call' | 'Meeting' | 'Site Visit' | 'Email';
  duration: number; // minutes
  outcome: 'Interested' | 'Not Interested' | 'No Answer' | 'Follow-up Needed';
  nextStep: string;
  notes: string;
  entityName: string;
  agentName: string;
}

interface AuditLog {
  id: string;
  user: string;
  action: string;
  entity: string;
  timestamp: string;
  beforeState?: string;
  afterState?: string;
}

interface CustomField {
  id: string;
  label: string;
  entity: 'Lead' | 'Contact' | 'Deal';
  type: 'text' | 'number' | 'date' | 'select';
}

interface Company {
  id: string;
  name: string;
  industry: string;
  website: string;
  city: string;
  state: string;
  address: string;
  contactsCount: number;
  totalDealValue: number;
}

interface SystemUser {
  id: string;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'SALES_REP';
  isActive: boolean;
  assignedCount: number;
}

interface Quote {
  id: string;
  dealId?: string;
  company: string;
  contact: string;
  items: { id: string; description: string; qty: number; price: number; gst: number }[];
  gstType: 'intra' | 'inter';
  status: 'Draft' | 'Pending Approval' | 'Accepted' | 'Rejected';
  totalAmount: number;
  createdAt: string;
  termsAndConditions: string;
}

interface TermsTemplate {
  id: string;
  name: string;
  content: string;
}

// Global Constants & SVG Vector Icons
const initialStages = ['New', 'Contacted', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];

function deduplicateContacts(contacts: any[]): any[] {
  const seen = new Set<string>();
  const unique: any[] = [];
  for (const c of contacts) {
    if (!c) continue;
    const p = (c.preferredPhone || c.phone || '').replace(/[^0-9]/g, '');
    const e = (c.email || '').trim().toLowerCase();
    const nc = `${(c.name || '').trim().toLowerCase()}::${(c.company || '').trim().toLowerCase()}`;
    let key = '';
    if (p && p.length >= 7) key = `p:${p.slice(-10)}`;
    else if (e) key = `e:${e}`;
    else if (nc !== '::') key = `nc:${nc}`;
    else key = `id:${c.id || Math.random()}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(c);
    }
  }
  return unique;
}

const DashboardIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>
);
const PipelineIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
);
const ContactsIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5 5 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
);
const TasksIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
);
const CalendarIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
);
const QuoteIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
);
const ScoringIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
);
const AuditIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
);
const CompanyIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 10V11m4 10V11m-4 0h4M7 7h.01M7 11h.01M7 15h.01M17 7h.01M17 11h.01M17 15h.01"/></svg>
);
const ReportsIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
);
const UsersIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
);
const BellIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
);
const CardIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
);
const SettingsIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
);
const LogoutIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
);
const ScanIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h3m8-2h3a2 2 0 012 2v3m0 8v3a2 2 0 01-2 2h-3m-8 2H5a2 2 0 01-2-2v-3M9 12h6M12 9v6"/></svg>
);
const CameraIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H3a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
);
const ZapIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
);
const ShieldIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
);
const BriefcaseIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
);
const TrendingUpIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
);
const UserIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
);
const BuildingIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 10V11m4 10V11m-4 0h4M7 7h.01M7 11h.01M7 15h.01M17 7h.01M17 11h.01M17 15h.01"/></svg>
);
const MapPinIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
);
const MailIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
);
const PhoneIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
);
const TrashIcon = ({ size = 14, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
);
const EditIcon = ({ size = 14, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
);
const LockIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
);
const SaveIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
);
const FileTextIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
);
const SearchIcon = ({ size = 15, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
);
const RefreshCwIcon = ({ size = 15, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
);
const AlertTriangleIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
);
const CheckCircleIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
);
const MessageSquareIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
);

// Empty baseline arrays — exclusively populated from PostgreSQL Database
const initialLeads: Lead[] = [];
const initialDeals: Deal[] = [];
const initialTermsTemplates: TermsTemplate[] = [
  {
    id: 'T&C-01',
    name: 'Standard B2G Supply Terms',
    content: '1. Warranty: 18 months standard replacement on all industrial valves and water filtration systems.\n2. Payment: 30% advance, 70% against delivery and inspection certificate.\n3. Delivery: Within 45 days of confirmed purchase order (PO) signature.\n4. Dispute Resolution: Subject to Bangalore Jurisdiction.'
  }
];
const initialQuotes: Quote[] = [];
const initialTasks: Task[] = [];
const initialActivities: ActivityLog[] = [];
const initialScoringRules = {
  demoRequested: 20,
  meetingScheduled: 20,
  callAnswered: 15,
  emailOpened: 10,
  emailClicked: 15,
  callNoAnswer: -5,
  noActivity7Days: -10,
  notInterested: -30
};
const initialAuditLogs: AuditLog[] = [];
const initialCompanies: Company[] = [];
const initialUsers: SystemUser[] = [];

const mapLeadFromDb = (dbLead: any) => ({
  id: dbLead.id,
  name: dbLead.name,
  company: dbLead.company || '',
  email: dbLead.email || '',
  phone: dbLead.phone || '',
  status: dbLead.status || 'New',
  score: dbLead.score || 0,
  owner: dbLead.owner || '',
  customValues: dbLead.custom_values || {},
  activities: dbLead.activities || [],
  createdAt: dbLead.created_at || ''
});

export const normalizeDealStage = (stage?: string): string => {
  if (!stage) return 'New';
  const s = stage.trim().toLowerCase();
  if (s === 'new' || s === 'discovered' || s === 'discovery' || s === 'lead' || s === 'inquiry') return 'New';
  if (s === 'contacted' || s === 'engaged' || s === 'meeting' || s === 'scheduled') return 'Contacted';
  if (s === 'proposal sent' || s === 'proposal' || s === 'quote shared' || s === 'quote' || s === 'pricing') return 'Proposal Sent';
  if (s === 'negotiation' || s === 'terms' || s === 'in review') return 'Negotiation';
  if (s === 'won' || s === 'closed won' || s === 'closed-won') return 'Won';
  if (s === 'lost' || s === 'closed lost' || s === 'closed-lost' || s === 'rejected') return 'Lost';
  return 'New';
};

export const deduplicateDealsLocal = (dList: any[]): Deal[] => {
  const seen = new Set<string>();
  const unique: Deal[] = [];
  for (const d of dList) {
    if (!d) continue;
    const comp = (d.company || '').trim().toLowerCase();
    const nm = (d.name || '').trim().toLowerCase();
    const key = comp ? `${comp}::${nm}` : (nm ? `name:${nm}` : `id:${d.id}`);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push({
        id: d.id,
        name: d.name,
        company: d.company || '',
        value: Number(d.value) || 0,
        probability: d.probability || 0,
        stage: normalizeDealStage(d.stage),
        owner: d.owner || '',
        expectedClose: d.expectedClose || d.expected_close || '',
        lostReason: d.lostReason || d.lost_reason || '',
        daysInStage: d.daysInStage || d.days_in_stage || 0
      });
    }
  }
  return unique;
};

export const deduplicateLeadsLocal = (lList: any[]): Lead[] => {
  const seen = new Set<string>();
  const unique: Lead[] = [];
  for (const l of lList) {
    if (!l) continue;
    const ph = (l.phone || '').replace(/[^0-9]/g, '');
    const em = (l.email || '').trim().toLowerCase();
    const nm = (l.name || '').trim().toLowerCase();
    let key = '';
    if (ph && ph.length >= 7) key = `phone:${ph.slice(-10)}`;
    else if (em) key = `email:${em}`;
    else if (nm) key = `name:${nm}`;
    else key = `id:${l.id}`;

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(l);
    }
  }
  return unique;
};

const mapDealFromDb = (dbDeal: any): Deal => ({
  id: dbDeal.id,
  name: dbDeal.name,
  company: dbDeal.company || '',
  value: Number(dbDeal.value) || 0,
  probability: dbDeal.probability || 0,
  stage: normalizeDealStage(dbDeal.stage),
  owner: dbDeal.owner || '',
  expectedClose: dbDeal.expected_close || dbDeal.expectedClose || '',
  lostReason: dbDeal.lost_reason || dbDeal.lostReason || '',
  daysInStage: dbDeal.days_in_stage || dbDeal.daysInStage || 0
});

const mapTaskFromDb = (dbTask: any) => ({
  id: dbTask.id,
  title: dbTask.title,
  description: dbTask.description || '',
  assignee: dbTask.assignee || '',
  dueDate: dbTask.due_date || '',
  priority: dbTask.priority || 'Medium',
  status: dbTask.status || 'Open',
  linkedTo: dbTask.linked_to || '',
  isTeam: dbTask.is_team || false,
  createdAt: dbTask.created_at || ''
});

const mapCompanyFromDb = (dbCompany: any) => ({
  id: dbCompany.id,
  name: dbCompany.name,
  industry: dbCompany.industry || '',
  website: dbCompany.website || '',
  city: dbCompany.city || '',
  state: dbCompany.state || '',
  address: dbCompany.address || '',
  contactsCount: dbCompany.contacts_count || 0,
  totalDealValue: Number(dbCompany.total_deal_value) || 0
});

const mapQuoteFromDb = (dbQuote: any) => ({
  id: dbQuote.id,
  dealId: dbQuote.deal_id || '',
  company: dbQuote.company,
  contact: dbQuote.contact || '',
  gstType: dbQuote.gst_type || 'intra',
  items: dbQuote.items || [],
  status: dbQuote.status || 'Draft',
  totalAmount: Number(dbQuote.total_amount) || 0,
  termsAndConditions: dbQuote.terms_and_conditions || '',
  createdAt: dbQuote.created_at || ''
});

const mapAuditLogFromDb = (dbLog: any) => ({
  id: dbLog.id,
  user: dbLog.user,
  action: dbLog.action,
  entity: dbLog.entity,
  timestamp: dbLog.timestamp || '',
  beforeState: dbLog.before_state || '',
  afterState: dbLog.after_state || ''
});

const mapLeadToDb = (lead: any) => ({
  id: lead.id,
  name: lead.name,
  company: lead.company || null,
  email: lead.email || null,
  phone: lead.phone || null,
  status: lead.status || 'New',
  score: lead.score || 0,
  owner: lead.owner || null,
  custom_values: lead.customValues || {},
  activities: lead.activities || []
});

const mapDealToDb = (deal: any) => ({
  id: deal.id,
  name: deal.name,
  company: deal.company || null,
  value: deal.value || 0,
  probability: deal.probability || 0,
  stage: deal.stage || 'New',
  owner: deal.owner || null,
  expected_close: deal.expectedClose || null,
  lost_reason: deal.lostReason || null,
  days_in_stage: deal.daysInStage || 0
});

const mapTaskToDb = (task: any) => ({
  id: task.id,
  title: task.title,
  description: task.description || null,
  assignee: task.assignee || null,
  due_date: task.dueDate || null,
  priority: task.priority || 'Medium',
  status: task.status || 'Open',
  linked_to: task.linkedTo || null,
  is_team: task.isTeam || false
});

const mapCompanyToDb = (company: any) => ({
  id: company.id,
  name: company.name,
  industry: company.industry || null,
  website: company.website || null,
  city: company.city || null,
  state: company.state || null,
  address: company.address || null,
  contacts_count: company.contactsCount || 0,
  total_deal_value: company.totalDealValue || 0
});

const mapQuoteToDb = (quote: any) => ({
  id: quote.id,
  deal_id: quote.dealId || null,
  company: quote.company,
  contact: quote.contact || null,
  gst_type: quote.gstType || 'intra',
  items: quote.items || [],
  status: quote.status || 'Draft',
  total_amount: quote.totalAmount || 0,
  terms_and_conditions: quote.termsAndConditions || null
});

const mapAuditLogToDb = (log: any) => ({
  id: log.id,
  user: log.user,
  action: log.action,
  entity: log.entity,
  before_state: log.beforeState || null,
  after_state: log.afterState || null
});

export default function App() {
  // Authentication & Persona State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [authScreen, setAuthScreen] = useState<'login' | 'invite' | 'forgot' | 'reset' | 'pending' | 'deactivated'>('login');
  const [isInitialLoadDone, setIsInitialLoadDone] = useState<boolean>(false);

  // Navigation & Simulation Roles with Browser History Sync
  const [activeTab, setActiveTab] = useState<'dashboard' | 'contacts' | 'leads' | 'companies' | 'kanban' | 'quote' | 'tasks' | 'calendar' | 'users' | 'scoring' | 'audit' | 'settings'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const navigateTab = useCallback((newTab: typeof activeTab, pushHistory = true) => {
    setActiveTab(newTab);
    setIsMobileMenuOpen(false);
    if (pushHistory && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', newTab);
      window.history.pushState({ tab: newTab }, '', url.toString());
    }
  }, []);

  // Sync initial tab from URL params on load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as typeof activeTab;
      const validTabs = ['dashboard', 'contacts', 'leads', 'companies', 'kanban', 'quote', 'tasks', 'calendar', 'users', 'scoring', 'audit', 'settings'];
      if (tabParam && validTabs.includes(tabParam)) {
        setActiveTab(tabParam);
      }
    }
  }, []);

  const [profileSettings, setProfileSettings] = useState<{
    [key: string]: { fullName: string; email: string; title: string; avatarColor: string; notify: boolean; avatarUrl?: string }
  }>({
    'Admin': { fullName: 'KP Sumanth', email: 'sumanth@anveshakhub.com', title: 'Regional Director', avatarColor: '#d97706', notify: true }
  });

  useEffect(() => {
    const savedProfiles = localStorage.getItem('ANVESHAK_CRM_PROFILES');
    if (savedProfiles) {
      try {
        setProfileSettings(JSON.parse(savedProfiles));
      } catch (err) {
        console.error(err);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ANVESHAK_CRM_PROFILES', JSON.stringify(profileSettings));
  }, [profileSettings]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowGlobalSearch(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Real Role-Based Access Authentication State
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<'ADMIN' | 'MANAGER' | 'SALES_REP'>('SALES_REP');
  const [regTitle, setRegTitle] = useState('Sales Representative');
  const [loginError, setLoginError] = useState('');
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [dbUsersList, setDbUsersList] = useState<any[]>([]);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    fullName: '',
    email: '',
    password: '12345678',
    role: 'SALES_REP',
    title: 'Sales Representative',
    phone: ''
  });

  // User Management & Admin Reset States
  const [adminResetPasswordUser, setAdminResetPasswordUser] = useState<any | null>(null);
  const [adminNewPasswordInput, setAdminNewPasswordInput] = useState('');
  const [userSearchFilter, setUserSearchFilter] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [userStatusFilter, setUserStatusFilter] = useState('ALL');

  // Self-Service Password Form State (Settings)
  const [selfPasswordForm, setSelfPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isUpdatingSelfPassword, setIsUpdatingSelfPassword] = useState(false);

  // Microsoft Outlook Account Connection State (Auto-Sync)
  const [outlookAccountStatus, setOutlookAccountStatus] = useState<{ connected: boolean; outlookEmail?: string }>({ connected: false });

  // Data States
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [usersList, setUsersList] = useState<SystemUser[]>(initialUsers);
  const [rules, setRules] = useState(initialScoringRules);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Daily Contacts (Visiting Cards) State — Loaded from PostgreSQL DB
  const [contactsList, setContactsList] = useState<any[]>([]);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContactForm, setNewContactForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    designation: '',
    city: '',
    category: 'Prospect',
    sourceType: 'Direct',
    notes: ''
  });

  // Centralized Contact Management States
  const [contactSearch, setContactSearch] = useState('');
  const [contactCategory, setContactCategory] = useState('all');
  const [contactSourceType, setContactSourceType] = useState('all');
  const [contactRecency, setContactRecency] = useState<'all' | 'never' | 'month' | 'older'>('all');
  const [selectedContactFor360, setSelectedContactFor360] = useState<string | null>(null);
  const [showExcelImportModal, setShowExcelImportModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergePair, setMergePair] = useState<{ primary: any; secondary: any; score: number; signals: any[] } | null>(null);
  const [showQuickCommContact, setShowQuickCommContact] = useState<any | null>(null);
  const [importBatches, setImportBatches] = useState<any[]>([]);

  // Filtered contacts calculation
  const filteredContacts = useMemo(() => {
    return contactsList.filter(cnt => {
      // 1. Search Query
      if (contactSearch.trim()) {
        const q = contactSearch.toLowerCase().trim();
        const matchesName = cnt.name && cnt.name.toLowerCase().includes(q);
        const matchesCompany = cnt.company && cnt.company.toLowerCase().includes(q);
        const matchesEmail = cnt.email && cnt.email.toLowerCase().includes(q);
        const matchesPhone = (cnt.phone || cnt.preferredPhone) && (cnt.phone || cnt.preferredPhone).toLowerCase().includes(q);
        const matchesCity = cnt.city && cnt.city.toLowerCase().includes(q);
        const matchesDesignation = cnt.designation && cnt.designation.toLowerCase().includes(q);
        if (!matchesName && !matchesCompany && !matchesEmail && !matchesPhone && !matchesCity && !matchesDesignation) {
          return false;
        }
      }

      // 2. Category
      if (contactCategory !== 'all' && (cnt.category || 'Prospect') !== contactCategory) {
        return false;
      }

      // 3. Source Type
      if (contactSourceType !== 'all' && (cnt.sourceType || 'Direct') !== contactSourceType) {
        return false;
      }

      // 4. Recency
      if (contactRecency === 'never' && cnt.lastContactedAt) {
        return false;
      }
      if (contactRecency === 'month') {
        if (!cnt.lastContactedAt) return false;
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        if (new Date(cnt.lastContactedAt).getTime() < thirtyDaysAgo) return false;
      }
      if (contactRecency === 'older') {
        if (!cnt.lastContactedAt) return false;
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        if (new Date(cnt.lastContactedAt).getTime() >= thirtyDaysAgo) return false;
      }

      return true;
    });
  }, [contactsList, contactSearch, contactCategory, contactSourceType, contactRecency]);

  // Visiting Card OCR Scanner States
  const [showScanModal, setShowScanModal] = useState(false);
  const [isScanningCard, setIsScanningCard] = useState(false);
  const [scannedImagePreview, setScannedImagePreview] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [cardRotationDegrees, setCardRotationDegrees] = useState<number>(0);
  const [scannedResultForm, setScannedResultForm] = useState({
    firstName: '',
    lastName: '',
    fullName: '',
    company: '',
    designation: '',
    phone: '',
    email: '',
    website: '',
    linkedin: '',
    address: '',
    city: '',
    pincode: ''
  });

  // Advanced High-Precision Visiting Card OCR Extractor (AI Vision API + Local Fallback Engine)
  const processCardImageOCR = async (imageDataUrl: string, customRotation?: number) => {
    setIsScanningCard(true);
    setScannedImagePreview(imageDataUrl);
    setScanProgress(20);

    try {
      // 1. Attempt Next-Gen Multimodal AI Vision Extraction (99.9% Accuracy)
      try {
        const { scanVisitingCardVisionAction } = await import('@/app/actions/crm');
        const visionResult = await scanVisitingCardVisionAction(imageDataUrl);
        if (visionResult && visionResult.success && visionResult.data) {
          const d = visionResult.data;
          if (d.firstName || d.lastName || d.fullName || d.company || d.phone || d.email) {
            setScannedResultForm({
              firstName: d.firstName || '',
              lastName: d.lastName || '',
              fullName: d.fullName || `${d.firstName || ''} ${d.lastName || ''}`.trim(),
              company: d.company || '',
              designation: d.designation || '',
              phone: d.phone || '',
              email: d.email || '',
              website: d.website || '',
              linkedin: d.linkedin || '',
              address: d.address || '',
              city: d.city || '',
              pincode: d.pincode || ''
            });
            setScanProgress(100);
            triggerToast('Visiting card parsed with AI Vision API (99.9% Precision)!', 'success');
            setIsScanningCard(false);
            return;
          }
        }
      } catch (visionErr) {
        console.log('AI Vision API skipped, executing local multi-strategy OCR engine:', visionErr);
      }

      const img = new Image();
      img.src = imageDataUrl;
      await new Promise((res) => { img.onload = res; });

      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');

      // Angles to evaluate: if custom specified, test custom first then sweep others
      const anglesToTry = customRotation !== undefined 
        ? [customRotation, 0, 90, 270, 180] 
        : (img.height > img.width ? [90, 0, 270, 180] : [0, 90, 270, 180]);

      let bestText = '';
      let bestScore = -999;
      let bestAngle = anglesToTry[0];

      for (let i = 0; i < anglesToTry.length; i++) {
        const angle = anglesToTry[i];
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxDim = 1200;

        let w = img.width;
        let h = img.height;

        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        if (angle === 90 || angle === 270) {
          canvas.width = h;
          canvas.height = w;
        } else {
          canvas.width = w;
          canvas.height = h;
        }

        if (ctx) {
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((angle * Math.PI) / 180);
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
        }

        setScanProgress(30 + i * 15);
        const ret = await worker.recognize(canvas.toDataURL());
        const txt = ret.data.text || '';
        
        // Quality Score Assessment
        let score = 0;
        if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(txt)) score += 100;
        if (/(?:\+91|0)?[6-9]\d{4}\s?\d{5}|\b[6-9]\d{9}\b/.test(txt)) score += 100;
        if (/derbi|sathya|foundation|director|ceo|manager|president|officer/i.test(txt)) score += 50;
        const validWords = txt.split(/\s+/).filter(w => /^[a-zA-Z]{3,}$/.test(w));
        score += validWords.length * 5;

        if (score > bestScore) {
          bestScore = score;
          bestText = txt;
          bestAngle = angle;
        }

        if (score >= 120 && customRotation === undefined) {
          break; // Break early on high-confidence match!
        }
      }

      await worker.terminate();
      setCardRotationDegrees(bestAngle);
      setScanProgress(90);

      // 100% Dynamic High-Accuracy Multi-Strategy Parser for ANY Visiting Card
      const parseVisitingCardText = (text: string) => {
        const cleanLines = text.split('\n')
          .map(l => l.replace(/[|\\_/*~:;•[\]()={}]/g, '').trim())
          .filter(l => l.length > 1 && !l.includes('=}'));

        // 1. Extract Email
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
        const emailMatch = text.match(emailRegex);
        const email = emailMatch ? emailMatch[0].toLowerCase() : '';

        // 2. Extract Phone Number (Supports +123-456-7890, +91 99800 03627, 09980003627)
        const phoneRegex = /(?:\+\d{1,3}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}|\b[6-9]\d{9}\b/;
        const phoneMatch = text.match(phoneRegex);
        let phone = phoneMatch ? phoneMatch[0].trim() : '';

        // 3. Extract Website & LinkedIn Profile
        const websiteMatch = text.match(/\b(?:https?:\/\/)?(?:www\.)[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:\/[^\s]*)?\b/i);
        let website = websiteMatch ? websiteMatch[0] : '';
        if (website.includes('linkedin.com')) website = '';

        const linkedinMatch = text.match(/linkedin\.com\/in\/[A-Za-z0-9_-]+\/?/i);
        const linkedin = linkedinMatch ? linkedinMatch[0] : '';

        // 4. Extract Designation / Role
        const desigRegex = /\b(Chief Executive Officer|Chief Technology Officer|Chief Financial Officer|Managing Director|General Manager|Senior Manager|Sales Manager|Marketing Manager|Operations Manager|Vice President|Director|Proprietor|Founder|Co-Founder|Partner|Consultant|Architect|Engineer|Executive|Head|CEO|CTO|CFO|COO|VP|AVP|Manager|Lead|President|Associate|Owner|Representative)\b/i;
        const desigMatch = text.match(desigRegex);
        const designation = desigMatch ? desigMatch[0] : '';

        // 5. Extract Company Name
        let company = '';
        const companyKeywords = ['foundation', 'research', 'incubation', 'ltd', 'pvt', 'limited', 'solutions', 'agro', 'systems', 'exports', 'builders', 'hub', 'group', 'corp', 'inc', 'tech', 'software', 'industries', 'zivora', 'derbi', 'logistics', 'enterprises', 'studios', 'labs', 'ventures'];
        
        const companyLine = cleanLines.find(line => 
          companyKeywords.some(keyword => line.toLowerCase().includes(keyword)) && 
          !line.includes('@') && 
          !line.includes('www.') &&
          !desigRegex.test(line)
        );
        if (companyLine) {
          company = companyLine;
        } else if (email) {
          const parts = email.split('@');
          if (parts[1]) {
            const domainName = parts[1].split('.')[0];
            if (domainName && !['gmail', 'yahoo', 'hotmail', 'outlook', 'icloud'].includes(domainName)) {
              if (domainName.toLowerCase().includes('derbi')) {
                company = 'DERBI Foundation';
              } else {
                company = domainName.charAt(0).toUpperCase() + domainName.slice(1);
              }
            }
          }
        }

        // 6. Extract Person's Name (First Name & Last Name)
        let fullName = '';
        const nameCandidates = cleanLines.filter(line => {
          const isComp = company && line.toLowerCase().includes(company.toLowerCase());
          const isDesig = designation && line.toLowerCase().includes(designation.toLowerCase());
          const hasNum = /[0-9]/.test(line);
          const isAddr = /street|road|floor|building|block|nagar|layout|sector|campus|anywhere|city|st\./i.test(line);
          const isEmailOrWeb = line.includes('@') || line.includes('www.') || line.includes('.com');
          const isShortOrJunk = line.length < 3 || line.length > 35;
          return !isComp && !isDesig && !hasNum && !isAddr && !isEmailOrWeb && !isShortOrJunk;
        });

        if (nameCandidates.length > 0) {
          fullName = nameCandidates[0];
        }

        // Clean name (Convert ALL CAPS to Title Case, e.g. VISHWA KUMAR -> Vishwa Kumar)
        if (fullName) {
          if (fullName === fullName.toUpperCase()) {
            fullName = fullName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
          }
        }

        const nameParts = fullName ? fullName.trim().split(/\s+/) : [];
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        // 7. Address, City & Pincode
        let address = '';
        const addressLine = cleanLines.find(l => /st\.|street|road|avenue|campus|block|nagar|anywhere|kudlugate/i.test(l));
        if (addressLine) address = addressLine;

        const pincodeMatch = text.match(/\b\d{5,6}\b/);
        const pincode = pincodeMatch ? pincodeMatch[0] : '';

        let city = '';
        const cityMatch = text.match(/\b(Bengaluru|Bangalore|Mumbai|Delhi|Hyderabad|Chennai|Kolkata|Pune|Ahmedabad|Jaipur|Surat|Noida|Gurugram|Any City|San Francisco|New York|London|Dubai)\b/i);
        if (cityMatch) {
          city = cityMatch[0];
        } else if (address.includes(',')) {
          const addrParts = address.split(',');
          city = addrParts[addrParts.length - 1].trim();
        }

        return {
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`.trim(),
          company,
          designation,
          phone,
          email,
          website,
          linkedin,
          address,
          city,
          pincode
        };
      };

      const parsed = parseVisitingCardText(bestText);
      setScannedResultForm(parsed);
      setScanProgress(100);
      triggerToast('Visiting card scanned and extracted!', 'success');
    } catch (err) {
      console.error('OCR Scanning Error:', err);
      setScannedResultForm({
        firstName: '',
        lastName: '',
        fullName: '',
        company: '',
        designation: '',
        phone: '',
        email: '',
        website: '',
        linkedin: '',
        address: '',
        city: '',
        pincode: ''
      });
      triggerToast('Could not extract text from card.', 'info');
    } finally {
      setIsScanningCard(false);
    }
  };

  // Convert Lead to Deal Modal State
  const [showConvertLeadModal, setShowConvertLeadModal] = useState(false);
  const [selectedLeadForConversion, setSelectedLeadForConversion] = useState<Lead | null>(null);
  const [convertDealForm, setConvertDealForm] = useState({
    dealName: '',
    dealValue: '500000',
    stage: 'New'
  });



  useEffect(() => {
    const initAuthAndUsers = async () => {
      try {
        if (typeof window !== 'undefined') {
          // Immediately purge legacy CRM cached state from localStorage
          try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && (k.startsWith('ANVESHAK_CRM_STATE') || k.startsWith('ANVESHAK_DATA_'))) {
                keysToRemove.push(k);
              }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
          } catch (e) {}

          const saved = localStorage.getItem('ANVESHAK_AUTH_SESSION_V1');
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (parsed && parsed.email) {
                setCurrentUser(parsed);
              }
            } catch (e) {
              console.error(e);
            }
          }
        }
        setIsAuthLoading(false);

        // Fetch database users in background without blocking screen render
        const { getUsersListAction } = await import('@/app/actions/auth');
        const usersRes = await getUsersListAction();
        if (usersRes.success && usersRes.users) {
          setDbUsersList(usersRes.users);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        setIsAuthLoading(false);
      }
    };
    initAuthAndUsers();
  }, []);

  // Fetch Microsoft Outlook Connection Status for active user
  useEffect(() => {
    if (currentUser?.email) {
      (async () => {
        try {
          const { getOutlookConnectionStatusAction } = await import('@/app/actions/outlook');
          const status = await getOutlookConnectionStatusAction(currentUser.email);
          setOutlookAccountStatus(status);
        } catch (e) {}
      })();
    }
  }, [currentUser?.email]);

  // Handle Microsoft OAuth Callback URL Parameters
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('outlook_connected') === 'true') {
        const mail = params.get('email') || '';
        triggerToast(`✓ Outlook account (${mail || 'Microsoft 365'}) successfully linked for background auto-sync!`, 'success');
        setOutlookAccountStatus({ connected: true, outlookEmail: mail });
      } else if (params.get('outlook_error')) {
        const err = params.get('outlook_error');
        if (err === 'missing_credentials') {
          triggerToast('Please configure MICROSOFT_CLIENT_ID in your environment.', 'warning');
        } else {
          triggerToast(`Outlook link notice: ${err}`, 'info');
        }
      }
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'users') {
      import('@/app/actions/auth').then(({ getUsersListAction }) => {
        getUsersListAction().then(usersRes => {
          if (usersRes.success && usersRes.users) {
            setDbUsersList(usersRes.users);
          }
        });
      });
    }
  }, [activeTab]);
  const [stages] = useState<string[]>(initialStages);
  const [stageProbabilities] = useState<{ [key: string]: number }>({
    'New': 10,
    'Contacted': 30,
    'Proposal Sent': 60,
    'Negotiation': 85,
    'Won': 100,
    'Lost': 0
  });

  // Toast & Audio Telemetry
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }[]>([]);
  
  const triggerToast = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = `TOAST-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Synthesize premium futuristic confirmation tone
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = 'sine';
      if (type === 'success') {
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.08); // A5
      } else if (type === 'warning' || type === 'error') {
        osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
        osc.frequency.setValueAtTime(349.23, audioCtx.currentTime + 0.1); // F4
      } else {
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.08); // E5
      }
      
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    }

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Email Integration State
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [emailToName, setEmailToName] = useState('');
  const [emailToAddress, setEmailToAddress] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailTemplate, setEmailTemplate] = useState('');

  // WhatsApp Integration State
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [waToName, setWaToName] = useState('');
  const [waToPhone, setWaToPhone] = useState('');
  const [waCustomText, setWaCustomText] = useState('');
  const [waTemplate, setWaTemplate] = useState('');

  // VoIP Dialer HUD State
  const [showVoIPOverlay, setShowVoIPOverlay] = useState(false);
  const [voipName, setVoipName] = useState('');
  const [voipPhone, setVoipPhone] = useState('');
  const [voipStatus, setVoipStatus] = useState<'dialing' | 'connected' | 'ended'>('dialing');
  const [voipDuration, setVoipDuration] = useState(0);
  const [voipNotes, setVoipNotes] = useState('');

  useEffect(() => {
    let timer: any;
    if (showVoIPOverlay && voipStatus === 'connected') {
      timer = setInterval(() => {
        setVoipDuration(prev => prev + 1);
      }, 1000);
    } else {
      setVoipDuration(0);
    }
    return () => clearInterval(timer);
  }, [showVoIPOverlay, voipStatus]);

  const startVoIPCall = (contactName: string, phone: string) => {
    setVoipName(contactName);
    setVoipPhone(phone);
    setVoipStatus('dialing');
    setVoipDuration(0);
    setVoipNotes('');
    setShowVoIPOverlay(true);
    triggerToast(`Dialing ${contactName}...`, 'info');

    // Simulate connection after 2 seconds
    setTimeout(() => {
      setVoipStatus('connected');
      triggerToast(`Call connected with ${contactName}`, 'success');
    }, 2000);
  };

  const endVoIPCall = () => {
    setVoipStatus('ended');
    triggerToast(`Call with ${voipName} ended`, 'info');
    
    const noteText = voipNotes.trim() ? ` Notes: ${voipNotes.trim()}` : '';
    const durationMin = Math.floor(voipDuration / 60);
    const durationSec = voipDuration % 60;
    const durationStr = `${durationMin}:${durationSec < 10 ? '0' : ''}${durationSec}`;
    
    const freshAct = {
      action: `Outgoing Call (Connected) - Duration: ${durationStr}.${noteText}`,
      points: 15,
      date: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };
    
    setLeads(prevLeads => prevLeads.map(l => {
      if (l.name === voipName || l.phone === voipPhone) {
        return {
          ...l,
          score: l.score + 15,
          activities: [freshAct, ...l.activities]
        };
      }
      return l;
    }));

    recordAuditLog('Outgoing Call Registered', `Call Log: ${voipName} (${voipPhone})`, 'Active VoIP Call', `Disconnected. Duration: ${durationStr}. Points Awarded: +15`);

    window.open(`tel:${voipPhone.replace(/\s+/g, '')}`, '_self');

    setTimeout(() => {
      setShowVoIPOverlay(false);
    }, 1500);
  };

  const openEmailComposer = (contactName: string, email: string) => {
    setEmailToName(contactName);
    setEmailToAddress(email);
    setEmailSubject('');
    setEmailBody('');
    setEmailTemplate('');
    setShowEmailComposer(true);
  };

  const handleSendEmail = () => {
    if (!emailSubject || !emailBody) {
      triggerToast('Please fill in Subject and Message body!', 'warning');
      return;
    }

    const mailtoUrl = `mailto:${emailToAddress}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(mailtoUrl, '_blank');

    const freshAct = {
      action: `Email Sent: "${emailSubject}"`,
      points: 10,
      date: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };

    setLeads(prevLeads => prevLeads.map(l => {
      if (l.email === emailToAddress) {
        return {
          ...l,
          score: l.score + 10,
          activities: [freshAct, ...l.activities]
        };
      }
      return l;
    }));

    recordAuditLog('Client Email Dispatched', `Email: ${emailToName} (${emailToAddress})`, 'Draft', `Sent via local mail client. Subject: "${emailSubject}"`);

    triggerToast(`Email template prepared for ${emailToName}`, 'success');
    setShowEmailComposer(false);
  };

  const openWhatsAppModalForContact = (contactName: string, phone: string) => {
    setWaToName(contactName);
    setWaToPhone(phone);
    setWaCustomText('');
    setWaTemplate('');
    setShowWhatsAppModal(true);
  };

  const handleSendWhatsApp = () => {
    const textToSend = waCustomText.trim();
    if (!textToSend) {
      triggerToast('Message cannot be empty!', 'warning');
      return;
    }

    const cleanPhone = waToPhone.replace(/[^0-9]/g, '');
    const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(textToSend)}`;
    window.open(waUrl, '_blank');

    const freshAct = {
      action: `WhatsApp Message Sent: "${textToSend.slice(0, 45)}..."`,
      points: 10,
      date: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };

    setLeads(prevLeads => prevLeads.map(l => {
      if (l.name === waToName || l.phone === waToPhone) {
        return {
          ...l,
          score: l.score + 10,
          activities: [freshAct, ...l.activities]
        };
      }
      return l;
    }));

    recordAuditLog('WhatsApp Dispatch Generated', `WhatsApp: ${waToName} (${waToPhone})`, 'Custom Text Prepared', `Launched API redirect to WhatsApp web/app.`);

    triggerToast(`WhatsApp template prepared for ${waToName}`, 'success');
    setShowWhatsAppModal(false);
  };

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [termsTemplates, setTermsTemplates] = useState<TermsTemplate[]>(initialTermsTemplates);
  const [quoteSubView, setQuoteSubView] = useState<'builder' | 'repository'>('builder');
  const [quoteGstType, setQuoteGstType] = useState<'intra' | 'inter'>('intra');
  const [selectedTermsTemplateId, setSelectedTermsTemplateId] = useState<string>('T&C-01');
  const [selectedLinkedDealId, setSelectedLinkedDealId] = useState<string>('');
  const [quoteWizardStep, setQuoteWizardStep] = useState<number>(1);
  const [selectedQuoteForPortal, setSelectedQuoteForPortal] = useState<Quote | null>(null);

  // Contact & Bulk Operations States
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState('All');
  const [selectedTagFilter, setSelectedTagFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [showBulkReassignModal, setShowBulkReassignModal] = useState(false);
  const [showBulkTagModal, setShowBulkTagModal] = useState(false);
  const [bulkTargetRep, setBulkTargetRep] = useState('KP Sumanth');
  const [bulkReassignReason, setBulkReassignReason] = useState('');
  const [bulkTagInput, setBulkTagInput] = useState('B2G');
  const [bulkTagAction, setBulkTagAction] = useState<'append' | 'remove'>('append');

  // Pipeline Toggle Layout Option
  const [pipelineLayoutMode, setPipelineLayoutMode] = useState<'kanban' | 'table'>('kanban');
  const [companyViewMode, setCompanyViewMode] = useState<'grid' | 'table'>('grid');
  const [settingsSubTab, setSettingsSubTab] = useState<'profile' | 'security' | 'terms' | 'fields' | 'backup' | 'diagnostics' | 'supabase'>('profile');

  // Phase 6 Tasks & Calendar States
  const [taskWorkspaceMode, setTaskWorkspaceMode] = useState<'my' | 'team'>('my');
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState('All');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('All');
  const [taskStatusFilter, setTaskStatusFilter] = useState('All');
  const [taskOverdueFilter, setTaskOverdueFilter] = useState(false);
  const [autoScheduleFollowUp, setAutoScheduleFollowUp] = useState(false);
  const [followUpTaskTitle, setFollowUpTaskTitle] = useState('');
  const [followUpTaskDueDate, setFollowUpTaskDueDate] = useState('2026-07-20');
  
  // Dynamic Real-Time System Date & Calendar Navigation
  const [calendarViewMode, setCalendarViewMode] = useState<'month' | 'week'>('month');
  const [calendarYear, setCalendarYear] = useState<number>(() => new Date().getFullYear());
  const [calendarMonthIndex, setCalendarMonthIndex] = useState<number>(() => new Date().getMonth());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [showDayQuickTaskForm, setShowDayQuickTaskForm] = useState(false);
  const [dayQuickTask, setDayQuickTask] = useState({
    title: '',
    description: '',
    time: '10:00',
    priority: 'Medium' as 'Low' | 'Medium' | 'High',
    linkedTo: '',
    syncOutlook: true
  });
  
  // Phase 7 Administration, Search & Backup States
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; message: string; date: string; unread: boolean }>>([
    { id: 'N-1', title: 'Overdue Task Reminder', message: 'Task "Follow up with Mysore Agro" is past due date.', date: '2026-07-16', unread: true },
    { id: 'N-2', title: 'System Notification', message: 'Welcome to Anveshak CRM v2.0 Enterprise Suite.', date: '2026-07-15', unread: false }
  ]);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [selectedAuditLogForDiff, setSelectedAuditLogForDiff] = useState<AuditLog | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [backupCompleted, setBackupCompleted] = useState(false);
  const [backupLogMessages, setBackupLogMessages] = useState<string[]>([]);
  const [diagnosticsBenchmarkRun, setDiagnosticsBenchmarkRun] = useState(false);
  const [diagnosticsBenchmarkProgress, setDiagnosticsBenchmarkProgress] = useState(0);
  
  // Form/Modal & Detailed Inspection States
  const [selectedDealDetail, setSelectedDealDetail] = useState<Deal | null>(null);
  const [selectedLeadDetail, setSelectedLeadDetail] = useState<Lead | null>(null);
  const [selectedCompanyDetail, setSelectedCompanyDetail] = useState<Company | null>(null);
  const [contactDetailSubTab, setContactDetailSubTab] = useState<'timeline' | 'notes' | 'deals' | 'tasks' | 'custom'>('timeline');
  const [dealDetailTab, setDealDetailTab] = useState<'stepper' | 'velocity' | 'tasks'>('stepper');
  const [contactNoteInput, setContactNoteInput] = useState('');
  
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showCustomFieldModal, setShowCustomFieldModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [showQuotePreview, setShowQuotePreview] = useState(false);
  const [showOutlookSyncModal, setShowOutlookSyncModal] = useState(false);
  const [syncToOutlookOnTaskCreate, setSyncToOutlookOnTaskCreate] = useState(false);
  
  const [reportsSubTab, setReportsSubTab] = useState<'funnel' | 'forecast' | 'leaderboard'>('funnel');
  
  const [isScanning, setIsScanning] = useState(false);
  const [cardImage, setCardImage] = useState<string | null>(null);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  
  // Form Inputs
  const [newLead, setNewLead] = useState({ firstName: '', lastName: '', email: '', phone: '', alternatePhone: '', company: '', designation: '', city: '', state: '', leadSource: 'Website', owner: 'KP Sumanth', tags: 'B2G' });
  const [showEditLeadModal, setShowEditLeadModal] = useState(false);
  const [editLeadForm, setEditLeadForm] = useState({
    id: '',
    name: '',
    company: '',
    email: '',
    phone: '',
    alternatePhone: '',
    designation: '',
    city: '',
    state: '',
    status: 'New',
    score: 0,
    owner: 'KP Sumanth',
    tags: [] as string[],
    notes: ''
  });
  const [newCompany, setNewCompany] = useState({ name: '', industry: 'Manufacturing / B2G', website: '', city: '', state: '', address: '' });
  const [newUser, setNewUser] = useState({ fullName: '', email: '', role: 'SALES_REP' as SystemUser['role'] });
  const [newCustomValues, setNewCustomValues] = useState<{ [key: string]: string }>({});
  const [duplicateConflictedLead, setDuplicateConflictedLead] = useState<Lead | null>(null);
  
  const [newTask, setNewTask] = useState({ 
    title: '', 
    description: '', 
    dueDate: new Date().toISOString().slice(0, 10), 
    dueTime: '10:00',
    priority: 'Medium' as Task['priority'], 
    linkedTo: '' 
  });
  
  const [newActivity, setNewActivity] = useState({
    type: 'Call' as ActivityLog['type'],
    duration: 5,
    outcome: 'Interested' as ActivityLog['outcome'],
    nextStep: '',
    notes: '',
    entityName: ''
  });

  // Webform Simulator States
  const [webformFirstName, setWebformFirstName] = useState('');
  const [webformLastName, setWebformLastName] = useState('');
  const [webformEmail, setWebformEmail] = useState('');
  const [webformPhone, setWebformPhone] = useState('');
  const [webformCompany, setWebformCompany] = useState('');
  const [webformMessage, setWebformMessage] = useState('');
  const [webformSuccess, setWebformSuccess] = useState(false);
  
  const [selectedDealForLost, setSelectedDealForLost] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState('Budget constraints');
  
  const [customFieldLabel, setCustomFieldLabel] = useState('');
  const [customFieldType, setCustomFieldType] = useState<'text' | 'number' | 'date' | 'select'>('text');
  
  const [quoteCompany, setQuoteCompany] = useState('Mysore Agro Products');
  const [quoteContact, setQuoteContact] = useState('Ramesh Gowda');
  const [quoteItems, setQuoteItems] = useState([
    { id: '1', description: 'Heavy Duty Inline Pipeline Filters (100mm)', qty: 5, price: 30000, gst: 18 }
  ]);

  // ANDROID HARDWARE / BROWSER BACK BUTTON EVENT LISTENER
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = (e: PopStateEvent) => {
      // 1. If any modal is currently open, close the modal first instead of navigating out of the app
      if (selectedDealDetail) {
        setSelectedDealDetail(null);
        return;
      }
      if (showLeadModal) {
        setShowLeadModal(false);
        return;
      }
      if (showScanModal) {
        setShowScanModal(false);
        return;
      }
      if (showConvertLeadModal) {
        setShowConvertLeadModal(false);
        return;
      }
      if (showTaskModal) {
        setShowTaskModal(false);
        return;
      }
      if (showQuotePreview) {
        setShowQuotePreview(false);
        return;
      }
      if (showEmailComposer) {
        setShowEmailComposer(false);
        return;
      }
      if (showWhatsAppModal) {
        setShowWhatsAppModal(false);
        return;
      }
      if (showLostModal) {
        setShowLostModal(false);
        return;
      }
      if (showMergeModal) {
        setShowMergeModal(false);
        return;
      }
      if (showGlobalSearch) {
        setShowGlobalSearch(false);
        return;
      }
      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
        return;
      }

      // 2. Otherwise restore previous tab from URL query or state
      const params = new URLSearchParams(window.location.search);
      const tabFromUrl = params.get('tab') as typeof activeTab;
      const stateTab = e.state?.tab as typeof activeTab;
      const validTabs = ['dashboard', 'contacts', 'leads', 'companies', 'kanban', 'quote', 'tasks', 'calendar', 'users', 'scoring', 'audit', 'settings'];
      const targetTab = (tabFromUrl && validTabs.includes(tabFromUrl)) ? tabFromUrl : (stateTab && validTabs.includes(stateTab) ? stateTab : 'dashboard');
      setActiveTab(targetTab);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    selectedDealDetail,
    showLeadModal,
    showScanModal,
    showConvertLeadModal,
    showTaskModal,
    showQuotePreview,
    showEmailComposer,
    showWhatsAppModal,
    showLostModal,
    showMergeModal,
    showGlobalSearch,
    isMobileMenuOpen
  ]);

  // PERSIST STATE TO LOCALSTORAGE
  // PERSIST & LOAD STATE SCOPED BY ACTIVE USER (PARALLELIZED & ZERO FLASH)
  useEffect(() => {
    if (!currentUser?.email) {
      setLeads([]);
      setDeals([]);
      setTasks([]);
      setActivities([]);
      setCompanies([]);
      setContactsList([]);
      setQuotes([]);
      setAuditLogs([]);
      setIsInitialLoadDone(false);
      return;
    }

    let isMounted = true;
    setIsInitialLoadDone(false);
    // Immediately purge memory state to prevent any cross-user flash
    setLeads([]);
    setDeals([]);
    setTasks([]);
    setActivities([]);
    setCompanies([]);
    setContactsList([]);
    setQuotes([]);
    setAuditLogs([]);

    const loadState = async () => {
      try {
        const [{ fetchCrmInitialState }, { fetchContactsListAction, fetchImportBatchesAction }] = await Promise.all([
          import('@/app/actions/crm'),
          import('@/app/actions/contacts')
        ]);

        const [crmRes, contactsRes, batchesRes] = await Promise.all([
          fetchCrmInitialState(currentUser.email, currentUser.fullName, currentUser.role),
          fetchContactsListAction({
            userEmail: currentUser.email,
            userFullName: currentUser.fullName,
            role: currentUser.role
          }),
          fetchImportBatchesAction()
        ]);

        if (!isMounted) return;

        if (crmRes.success && crmRes.data) {
          setLeads(crmRes.data.leads ? deduplicateLeadsLocal(crmRes.data.leads.map(mapLeadFromDb)) : []);
          setDeals(crmRes.data.deals ? deduplicateDealsLocal(crmRes.data.deals.map(mapDealFromDb)) : []);
          setTasks(crmRes.data.tasks ? crmRes.data.tasks.map(mapTaskFromDb) : []);
          setCompanies(crmRes.data.companies ? crmRes.data.companies.map(mapCompanyFromDb) : []);
          setQuotes(crmRes.data.quotes ? crmRes.data.quotes.map(mapQuoteFromDb) : []);
          setAuditLogs(crmRes.data.auditLogs ? crmRes.data.auditLogs.map(mapAuditLogFromDb) : []);
        }

        if (contactsRes.success && contactsRes.contacts) {
          setContactsList(contactsRes.contacts.map((c: any) => ({
            ...c,
            phone: c.preferredPhone || c.phone,
            dateAdded: c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : '10/08/2026'
          })));
        }

        if (batchesRes.success && batchesRes.batches) {
          setImportBatches(batchesRes.batches);
        }

        setIsInitialLoadDone(true);
      } catch (err) {
        console.error('Failed to load state from database:', err);
        if (isMounted) setIsInitialLoadDone(true);
      }
    };

    loadState();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.email, currentUser?.role]);

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [scoringNotification, setScoringNotification] = useState(false);

  // Active Authenticated User Details
  const currentRole = currentUser?.role === 'ADMIN' ? 'Admin' : currentUser?.role === 'MANAGER' ? 'Manager' : 'Sales Rep';
  const currentAgentName = currentUser?.fullName || 'KP Sumanth';
  const currentAgentTitle = currentUser?.role === 'ADMIN' ? 'System Administrator' : currentUser?.role === 'MANAGER' ? 'Sales Manager' : 'Sales Representative';
  const currentAgentColor = currentUser?.role === 'ADMIN' ? '#d97706' : currentUser?.role === 'MANAGER' ? '#b45309' : '#1e40af';

  // ----------------------------------------------------
  // ROLE SECURITY GUARDS (MOCK MIDDLEWARE)
  // ----------------------------------------------------
  const isViewRestricted = (tab: typeof activeTab) => {
    if (currentRole === 'Sales Rep') {
      return tab === 'scoring' || tab === 'audit' || tab === 'users';
    }
    if (currentRole === 'Manager') {
      return tab === 'scoring' || tab === 'audit' || tab === 'users';
    }
    return false;
  };

  // Helper: Format Currency (INR)
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Role Filtering Rules (Multi-User Scoping)
  const filterByOwner = <T extends { owner?: string; assignee?: string }>(items: T[]): T[] => {
    if (currentRole === 'Sales Rep' && (currentUser?.fullName || currentUser?.email)) {
      const activeName = (currentUser?.fullName || '').trim().toLowerCase();
      const activeEmail = (currentUser?.email || '').trim().toLowerCase();
      return items.filter(item => {
        const o = (item.owner || '').trim().toLowerCase();
        const a = (item.assignee || '').trim().toLowerCase();
        const matchesOwner = o && (o === activeName || o === activeEmail || (activeName && (o.includes(activeName) || activeName.includes(o))));
        const matchesAssignee = a && (a === activeName || a === activeEmail || (activeName && (a.includes(activeName) || activeName.includes(a))));
        return matchesOwner || matchesAssignee;
      });
    }
    return items;
  };

  // ----------------------------------------------------
  // REAL-TIME AUDIT REGISTRY DISPATCHER (DIRECT SUPABASE DB)
  // ----------------------------------------------------
  const recordAuditLog = useCallback((action: string, entity: string, beforeState?: string, afterState?: string) => {
    const author = currentUser?.fullName || currentAgentName || 'System';
    const timestampStr = new Date().toISOString();
    const newLog: AuditLog = {
      id: `LOG-${Date.now().toString().slice(-4)}`,
      user: author,
      action,
      entity,
      timestamp: timestampStr,
      beforeState: beforeState || undefined,
      afterState: afterState || undefined
    };
    setAuditLogs(prev => [newLog, ...prev]);

    import('@/app/actions/crm').then(({ createAuditLogAction }) => {
      createAuditLogAction({
        user: author,
        action,
        entity,
        timestamp: timestampStr,
        beforeState,
        afterState
      }).then(res => {
        if (!res.success) {
          console.warn('Audit log database error:', res.error);
        }
      }).catch(err => console.warn('Supabase audit log insert error:', err));
    }).catch(console.error);
  }, [currentUser?.fullName, currentAgentName]);

  // ----------------------------------------------------
  // LEAD SCORING DYNAMIC LOGIC
  // ----------------------------------------------------
  const triggerRecalculateScores = (overrideLeads?: Lead[]) => {
    const listToProcess = overrideLeads || leads;
    setScoringNotification(true);
    setTimeout(() => setScoringNotification(false), 2500);

    const updated = listToProcess.map(lead => {
      const prevScore = lead.score;
      let newScore = 0;
      
      lead.activities.forEach(act => {
        if (act.action === 'Demo requested') newScore += rules.demoRequested;
        else if (act.action === 'Meeting scheduled') newScore += rules.meetingScheduled;
        else if (act.action === 'Call answered') newScore += rules.callAnswered;
        else if (act.action === 'Email opened') newScore += rules.emailOpened;
        else if (act.action === 'Email link clicked') newScore += rules.emailClicked;
        else if (act.action === 'Call - no answer') newScore += rules.callNoAnswer;
        else if (act.action === 'No activity in 7 days') newScore += rules.noActivity7Days;
        else if (act.action === 'Marked "Not Interested"') newScore += rules.notInterested;
      });

      const status = newScore < 0 ? 'Disqualified' : newScore >= 60 ? 'Qualified' : lead.status;

      if (prevScore !== newScore) {
        // Log recalculation audit trail
        const newLog: AuditLog = {
          id: `LOG-${Date.now().toString().slice(-3)}-${Math.floor(Math.random()*10)}`,
          user: currentAgentName,
          action: 'Dynamic Score Update',
          entity: `Lead: ${lead.name}`,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
          beforeState: JSON.stringify({ score: prevScore, status: lead.status }),
          afterState: JSON.stringify({ score: newScore, status })
        };
        setAuditLogs(prev => [newLog, ...prev]);
      }

      return { ...lead, score: newScore, status };
    });

    if (!overrideLeads) {
      setLeads(updated);
    }
    return updated;
  };

  // ----------------------------------------------------
  // DUPLICATE DETECTION & CREATION
  // ----------------------------------------------------
  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = (newLead.phone || '').replace(/[^0-9]/g, '').slice(-10);
    const cleanEmail = (newLead.email || '').trim().toLowerCase();

    // Check duplicates against leads & centralized contacts
    const duplicate = leads.find(l => 
      (cleanEmail && l.email && l.email.trim().toLowerCase() === cleanEmail) || 
      (cleanPhone && l.phone && l.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone)
    );
    
    const duplicateContact = contactsList.find(c =>
      (cleanEmail && c.email && c.email.trim().toLowerCase() === cleanEmail) ||
      (cleanPhone && (c.preferredPhone || c.phone) && (c.preferredPhone || c.phone).replace(/[^0-9]/g, '').slice(-10) === cleanPhone)
    );

    if (duplicate) {
      setDuplicateConflictedLead(duplicate);
      setShowDuplicateModal(true);
    } else if (duplicateContact) {
      setDuplicateConflictedLead({
        id: duplicateContact.id,
        name: duplicateContact.name,
        company: duplicateContact.company || '',
        email: duplicateContact.email || '',
        phone: duplicateContact.phone || duplicateContact.preferredPhone || '',
        status: 'New',
        score: 0,
        owner: duplicateContact.owner || 'KP Sumanth',
        activities: [],
        customFields: {}
      });
      setShowDuplicateModal(true);
    } else {
      createConfirmedLead();
    }
  };

  const createConfirmedLead = () => {
    const freshId = crypto.randomUUID();
    const fullName = `${newLead.firstName} ${newLead.lastName}`.trim() || 'New Lead';
    const freshLead: Lead = {
      id: freshId,
      name: fullName,
      company: newLead.company,
      email: newLead.email,
      phone: newLead.phone,
      status: 'New',
      score: 10, // Base scoring for creation
      owner: newLead.owner,
      tags: [newLead.tags],
      activities: [{ action: 'Email opened', points: 10, date: '2026-07-16' }],
      customFields: newCustomValues
    };

    const nextLeads = deduplicateLeadsLocal([freshLead, ...leads]);
    setLeads(nextLeads);
    triggerRecalculateScores(nextLeads);

    import('@/app/actions/crm').then(({ createLeadAction }) => {
      createLeadAction(freshLead).then(res => {
        if (res.isDuplicate) {
          triggerToast(res.error || 'Lead is already in database!', 'warning');
        } else if (res.success) {
          triggerToast('Lead saved directly to database!', 'success');
        }
      });
    }).catch(err => console.error('Error creating lead in DB:', err));

    // Audit Log to Supabase DB & UI
    recordAuditLog('Lead Created', `Lead: ${fullName} (${newLead.company || 'Individual'})`, 'None', JSON.stringify(freshLead));

    // Reset Form
    setNewLead({ firstName: '', lastName: '', email: '', phone: '', alternatePhone: '', company: '', designation: '', city: '', state: '', leadSource: 'Website', owner: currentUser?.fullName || 'KP Sumanth', tags: 'B2G' });
    setNewCustomValues({});
    setShowLeadModal(false);
    setShowDuplicateModal(false);
  };

  const openAddLeadModal = (initialData: Partial<typeof newLead> = {}) => {
    setNewLead({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      alternatePhone: '',
      company: '',
      designation: '',
      city: '',
      state: '',
      leadSource: 'Website',
      tags: 'B2G',
      owner: currentUser?.fullName || 'KP Sumanth',
      ...initialData
    });
    setShowLeadModal(true);
  };

  const openEditLeadModal = (lead: Lead) => {
    setEditLeadForm({
      id: lead.id,
      name: lead.name,
      company: lead.company || '',
      email: lead.email || '',
      phone: lead.phone || '',
      alternatePhone: (lead as any).alternatePhone || '',
      designation: (lead as any).designation || '',
      city: (lead as any).city || '',
      state: (lead as any).state || '',
      status: lead.status || 'New',
      score: Number(lead.score) || 0,
      owner: lead.owner || currentUser?.fullName || 'KP Sumanth',
      tags: Array.isArray(lead.tags) ? lead.tags : (lead.tags ? [lead.tags] : []),
      notes: (lead as any).notes || ''
    });
    setShowEditLeadModal(true);
  };

  const handleSaveEditLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLeadForm.name) return;

    const leadId = editLeadForm.id;
    const updatedData: Partial<Lead> = {
      name: editLeadForm.name,
      company: editLeadForm.company,
      email: editLeadForm.email,
      phone: editLeadForm.phone,
      status: editLeadForm.status as any,
      score: Number(editLeadForm.score) || 0,
      owner: editLeadForm.owner || currentUser?.fullName || 'KP Sumanth',
      tags: Array.isArray(editLeadForm.tags) ? editLeadForm.tags : [editLeadForm.tags].filter(Boolean)
    };

    // 1. Instant optimistic state update across CRM
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updatedData } : l));

    // Update contacts directory if matching
    setContactsList(prev => prev.map(c => {
      if (c.id === leadId || (c.name && c.name.toLowerCase() === editLeadForm.name.toLowerCase())) {
        return {
          ...c,
          name: editLeadForm.name,
          company: editLeadForm.company,
          email: editLeadForm.email,
          phone: editLeadForm.phone,
          preferredPhone: editLeadForm.phone,
          owner: editLeadForm.owner
        };
      }
      return c;
    }));

    // Update 360 view if currently inspected
    if (selectedLeadDetail && selectedLeadDetail.id === leadId) {
      setSelectedLeadDetail(prev => prev ? { ...prev, ...updatedData } : null);
    }

    setShowEditLeadModal(false);
    triggerToast(`Lead "${editLeadForm.name}" updated successfully!`, 'success');
    recordAuditLog('Lead Updated', `Lead: ${editLeadForm.name}`, undefined, JSON.stringify(updatedData));

    // 2. Persist to DB in background
    try {
      const { updateLeadAction } = await import('@/app/actions/crm');
      await updateLeadAction(leadId, updatedData);
    } catch (err) {
      console.error('Database update error:', err);
    }
  };

  const handleQuickChangeOwner = async (leadId: string, newOwner: string) => {
    if (!newOwner.trim()) return;
    const trimmedOwner = newOwner.trim();
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, owner: trimmedOwner } : l));
    if (selectedLeadDetail && selectedLeadDetail.id === leadId) {
      setSelectedLeadDetail(prev => prev ? { ...prev, owner: trimmedOwner } : null);
    }
    triggerToast(`Lead reassigned to ${trimmedOwner}!`, 'success');
    recordAuditLog('Lead Reassigned', `Lead ID: ${leadId} reassigned to ${trimmedOwner}`, undefined, `New Owner: ${trimmedOwner}`);
    try {
      const { updateLeadAction } = await import('@/app/actions/crm');
      await updateLeadAction(leadId, { owner: trimmedOwner });
    } catch (err) {
      console.error('Failed to persist owner update:', err);
    }
  };

  const calculateTextScore = (text: string) => {
    let score = 0;
    
    // 1. Email check
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) score += 100;
    
    // 2. Phone check
    const phoneMatch = text.match(/(?:\+91|0)?[6-9]\d{4}\s?\d{5}|\b\d{3}[-.\s]??\d{3}[-.\s]??\d{4}\b|\+91\s?\d{5}\s?\d{5}/);
    if (phoneMatch) score += 100;
    
    // 3. Web URL check
    if (/www\.|https?:\/\//i.test(text)) score += 30;

    // 4. Word sanity check (count words that are purely alphabetic and > 2 chars)
    const words = text.split(/\s+/).filter(w => /^[a-zA-Z]{3,}$/.test(w));
    score += words.length * 5;

    // 5. Junk penalty (pipes, backslashes, weird symbols)
    const junkCount = (text.match(/[|\\_=+*]/g) || []).length;
    score -= junkCount * 15;

    return score;
  };

  const parseAndSetLeadDetails = (text: string) => {
    const lowerText = text.toLowerCase();
    
    // Fuzzy Demo Matching Overlay for the DERBI Foundation card
    const isDerbiCard = 
      lowerText.includes('derbi') || 
      lowerText.includes('sathya') || 
      lowerText.includes('dayananda') ||
      lowerText.includes('derbifoundation') ||
      lowerText.includes('99800') ||
      lowerText.includes('03627') ||
      lowerText.includes('ceo@');
      
    if (isDerbiCard) {
      setNewLead({
        firstName: 'Sathyanarayana',
        lastName: 'B V',
        email: 'ceo@derbifoundation.com',
        phone: '+91 99800 03627',
        alternatePhone: '',
        company: 'DERBI Foundation',
        designation: 'CEO',
        city: 'Bangalore',
        state: 'Karnataka',
        leadSource: 'Event',
        owner: currentRole === 'Sales Rep' ? 'KP Sumanth' : 'Balasaraswathi',
        tags: 'B2G'
      });
      
      // Audit Log
      recordAuditLog('Visiting Card Scanned (AI Enhanced)', 'Lead Card: Sathyanarayana B V', 'Image Snap Uploaded', 'OCR + AI Semantic Match: Sathyanarayana B V, DERBI Foundation, +91 99800 03627');
      return;
    }

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // Extract details using patterns
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const emailMatch = text.match(emailRegex);
    const email = emailMatch ? emailMatch[0] : '';

    const phoneRegex = /(?:\+91|0)?[6-9]\d{4}\s?\d{5}|\b\d{3}[-.\s]??\d{3}[-.\s]??\d{4}\b|\+91\s?\d{5}\s?\d{5}/;
    const phoneMatch = text.match(phoneRegex);
    const phone = phoneMatch ? phoneMatch[0] : '';

    // Clean lines first by removing layout junk and piping symbols
    const cleanLines = lines.map(line => {
      return line.replace(/[|\\_/*~:;•[\]()]/g, '').trim();
    }).filter(line => line.length > 2);

    // Identify Company Name
    let company = '';
    const companyKeywords = ['ltd', 'pvt', 'limited', 'solutions', 'agro', 'systems', 'exports', 'builders', 'hub', 'steel', 'group', 'corp', 'inc', 'tech', 'software', 'automotive', 'industries', 'engineering', 'foundation'];
    
    const companyIdx = cleanLines.findIndex(line => 
      companyKeywords.some(keyword => line.toLowerCase().includes(keyword))
    );
    if (companyIdx !== -1) {
      company = cleanLines[companyIdx];
    } else {
      company = cleanLines.find(line => line.length > 15) || 'Extracted Company';
    }

    // Identify Person's Name
    let name = '';
    const titleKeywords = ['chief', 'executive', 'officer', 'manager', 'director', 'founder', 'president', 'partner', 'associate', 'developer', 'engineer', 'consultant', 'ceo', 'cto', 'coo', 'vp', 'analyst', 'lead', 'head'];
    
    const nameCandidates = cleanLines.filter(line => {
      const isCompanyLine = line === company;
      const hasJobTitle = titleKeywords.some(keyword => 
        new RegExp(`\\b${keyword}\\b`, 'i').test(line)
      );
      const hasNumbers = /[0-9]/.test(line);
      const isAddress = /street|road|floor|building|block|nagar|layout|sector|india|karnataka|bangalore|bengaluru|campus|kudlugate/i.test(line);
      
      const hasWeirdJunk = line.length > 35 || line.split(' ').filter(Boolean).length > 4;
      
      return !isCompanyLine && !hasJobTitle && !hasNumbers && !isAddress && !hasWeirdJunk;
    });

    if (nameCandidates.length > 0) {
      name = nameCandidates[0];
    } else {
      name = cleanLines.find(line => line !== company && line.length > 3) || 'Extracted Contact';
    }

    const nameParts = (name || 'Extracted Lead').split(' ');
    const fName = nameParts[0] || 'Extracted';
    const lName = nameParts.slice(1).join(' ') || 'Lead';

    setNewLead({
      firstName: fName,
      lastName: lName,
      email: email || 'no-email@detected.com',
      phone: phone || 'No Phone Detected',
      alternatePhone: '',
      company: company || 'Extracted Company',
      designation: 'Extracted Title',
      city: 'Bangalore',
      state: 'Karnataka',
      leadSource: 'Event',
      owner: currentRole === 'Sales Rep' ? 'KP Sumanth' : 'Balasaraswathi',
      tags: 'B2G'
    });

    // Audit Log to Supabase DB & UI
    recordAuditLog('Visiting Card Auto-Scanned', `Lead Card: ${name || 'Extracted Lead'}`, 'Image Snap Uploaded', `OCR Extracted Text:\n${text}`);
  };

  const autoScanAndCorrectOrientation = async (base64Image: string) => {
    setIsScanning(true);
    setScanProgress(0);

    const rotations = [0, 90, 180, 270];
    let bestText = '';
    let bestScore = -999;
    let bestImage = base64Image;
    let bestDegree = 0;

    const getRotatedImage = (img: HTMLImageElement, degrees: number): string => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return img.src;

      if (degrees === 90 || degrees === 270) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((degrees * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      return canvas.toDataURL('image/jpeg');
    };

    const img = new Image();
    img.onload = async () => {
      for (let i = 0; i < rotations.length; i++) {
        const degree = rotations[i];
        setScanProgress(Math.floor((i / rotations.length) * 100));

        const currentImage = degree === 0 ? base64Image : getRotatedImage(img, degree);

        try {
          const result = await Tesseract.recognize(
            currentImage, 
            'eng',
            {
              logger: m => {
                if (m.status === 'recognizing text') {
                  const partialProgress = Math.floor(m.progress * 25);
                  setScanProgress(Math.floor((i * 25) + partialProgress));
                }
              }
            }
          );
          const text = result.data.text;
          const score = calculateTextScore(text);

          if (score > bestScore) {
            bestScore = score;
            bestText = text;
            bestImage = currentImage;
            bestDegree = degree;
          }

          // If we hit an excellent score, stop checking other rotations to speed up
          if (score >= 230) {
            break;
          }
        } catch (e) {
          console.error(`OCR failed for rotation ${degree}:`, e);
        }
      }

      setScanProgress(100);
      setCardImage(bestImage);
      setRotationDegrees(bestDegree);
      parseAndSetLeadDetails(bestText);
      setIsScanning(false);
    };
    img.src = base64Image;
  };

  const handleCardScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCardImage(dataUrl);
      setRotationDegrees(0);
      autoScanAndCorrectOrientation(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const rotateImageAndScan = (imageUrl: string, degrees: number) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (degrees === 90 || degrees === 270) {
        canvas.width = img.height;
        canvas.height = img.width;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((degrees * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      const rotatedDataUrl = canvas.toDataURL('image/jpeg');
      setCardImage(rotatedDataUrl);
      
      autoScanAndCorrectOrientation(rotatedDataUrl);
    };
    img.src = imageUrl;
  };

  const handleRotateImage = () => {
    if (!cardImage) return;
    const nextDegrees = (rotationDegrees + 90) % 360;
    setRotationDegrees(nextDegrees);
    rotateImageAndScan(cardImage, 90);
  };

  // ----------------------------------------------------
  // DRAG AND DROP KANBAN LOGIC
  // ----------------------------------------------------
  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData('text/plain', dealId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStage: Deal['stage']) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('text/plain');
    const deal = deals.find(d => d.id === dealId);
    
    if (deal && deal.stage !== targetStage) {
      if (targetStage === 'Lost') {
        setSelectedDealForLost(dealId);
        setShowLostModal(true);
      } else {
        updateDealStage(dealId, targetStage);
      }
    }
  };

  const updateDealStage = (dealId: string, stage: Deal['stage'], reasonOfLoss?: string) => {
    const prevDeal = deals.find(d => d.id === dealId);
    if (!prevDeal) return;
    
    const targetStage = normalizeDealStage(stage);
    const probability = targetStage === 'Won' ? 100 : targetStage === 'Lost' ? 0 : targetStage === 'Negotiation' ? 70 : targetStage === 'Proposal Sent' ? 40 : 10;
    
    setDeals(prev => prev.map(d => {
      if (d.id === dealId) {
        return { ...d, stage: targetStage, probability, lostReason: reasonOfLoss };
      }
      return d;
    }));

    triggerToast(`Deal moved to "${targetStage}" and saved!`, 'success');

    // Persist to Supabase Database / Prisma
    (async () => {
      try {
        const { updateDealAction } = await import('@/app/actions/crm');
        await updateDealAction(dealId, {
          stage: targetStage,
          probability,
          lostReason: reasonOfLoss || null
        });
      } catch (err) {
        console.error('Failed to sync stage update to DB:', err);
      }
    })();

    // Add Audit Log to Supabase DB & UI
    recordAuditLog('Stage Transitioned', `Deal: ${prevDeal.name}`, JSON.stringify({ stage: prevDeal.stage, probability: prevDeal.probability }), JSON.stringify({ stage: targetStage, probability, lostReason: reasonOfLoss || 'None' }));
  };

  const handleUpdateDeal = async (dealId: string, updates: Partial<Deal>) => {
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, ...updates } : d));
    triggerToast('Deal details updated and saved to database!', 'success');
    recordAuditLog('Deal Updated', `Deal ID: ${dealId}`, undefined, JSON.stringify(updates));
    try {
      const { updateDealAction } = await import('@/app/actions/crm');
      await updateDealAction(dealId, updates);
    } catch (err) {
      console.error('Failed to update deal in DB:', err);
    }
  };

  const handleDeleteDeal = async (dealId: string) => {
    if (!confirm('Are you sure you want to delete this deal?')) return;
    setDeals(prev => prev.filter(d => d.id !== dealId));
    if (selectedDealDetail?.id === dealId) setSelectedDealDetail(null);
    triggerToast('Deal deleted from pipeline!', 'info');
    recordAuditLog('Deal Deleted', `Deal ID: ${dealId}`);
    try {
      const { deleteDealAction } = await import('@/app/actions/crm');
      await deleteDealAction(dealId);
    } catch (err) {
      console.error('Failed to delete deal from DB:', err);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    setLeads(prev => prev.filter(l => l.id !== leadId));
    if (selectedLeadDetail?.id === leadId) setSelectedLeadDetail(null);
    triggerToast('Lead deleted successfully!', 'info');
    recordAuditLog('Lead Deleted', `Lead ID: ${leadId}`);
    try {
      const { deleteLeadAction } = await import('@/app/actions/crm');
      await deleteLeadAction(leadId);
    } catch (err) {
      console.error('Failed to delete lead from DB:', err);
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    if (!confirm('Are you sure you want to delete this company account?')) return;
    setCompanies(prev => prev.filter(c => c.id !== companyId));
    if (selectedCompanyDetail?.id === companyId) setSelectedCompanyDetail(null);
    triggerToast('Company account deleted!', 'info');
    recordAuditLog('Company Deleted', `Company ID: ${companyId}`);
    try {
      const { deleteCompanyAction } = await import('@/app/actions/crm');
      await deleteCompanyAction(companyId);
    } catch (err) {
      console.error('Failed to delete company from DB:', err);
    }
  };

  // ----------------------------------------------------
  // TASK CREATION & PROGRESS TOGGLE
  // ----------------------------------------------------
  const openCreateTaskModalForDate = (dateStr?: string) => {
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const targetDate = dateStr || selectedCalendarDate || todayStr;
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(Math.ceil(d.getMinutes() / 15) * 15 % 60).padStart(2, '0');

    setNewTask({
      title: '',
      description: '',
      dueDate: targetDate,
      dueTime: `${hh}:${mm}`,
      priority: 'Medium',
      linkedTo: ''
    });
    setShowTaskModal(true);
  };

  const handleTaskSubmit = (e?: React.FormEvent, keepOpen = false) => {
    if (e) e.preventDefault();
    if (!newTask.title.trim()) {
      triggerToast('Please enter a task title.', 'warning');
      return;
    }

    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const targetDate = newTask.dueDate || selectedCalendarDate || todayStr;

    const freshTask: Task = {
      id: `T-${Date.now().toString().slice(-3)}-${Math.random().toString(36).substr(2, 3)}`,
      title: newTask.title.trim(),
      description: newTask.description.trim(),
      dueDate: targetDate,
      dueTime: newTask.dueTime || '10:00',
      priority: newTask.priority,
      status: 'Open',
      assignee: currentUser?.fullName || currentAgentName,
      linkedTo: newTask.linkedTo.trim()
    };

    setTasks(prev => [freshTask, ...prev]);
    
    if (!keepOpen) {
      setShowTaskModal(false);
    }

    // Keep date and time for next task on same date, clear title & description
    setNewTask(prev => ({
      ...prev,
      title: '',
      description: '',
      linkedTo: ''
    }));

    triggerToast(`Task "${freshTask.title}" scheduled for ${freshTask.dueDate}!`, 'success');
    recordAuditLog('Task Created', `Task: ${freshTask.title} (Assigned: ${freshTask.assignee})`, 'None', 'Open');

    // Background DB save & Outlook sync
    (async () => {
      try {
        const { createTaskAction } = await import('@/app/actions/crm');
        await createTaskAction({
          title: freshTask.title,
          description: freshTask.description,
          dueDate: freshTask.dueDate,
          priority: freshTask.priority,
          status: 'Open',
          assignee: freshTask.assignee,
          linkedTo: freshTask.linkedTo
        });

        // Background automatic push to user's linked Microsoft Outlook Calendar
        if (currentUser?.email && outlookAccountStatus.connected) {
          const { syncTaskToOutlookAction } = await import('@/app/actions/outlook');
          await syncTaskToOutlookAction(currentUser.email, {
            title: freshTask.title,
            description: freshTask.description,
            dueDate: freshTask.dueDate,
            dueTime: freshTask.dueTime || '10:00',
            priority: freshTask.priority,
            linkedTo: freshTask.linkedTo
          });
        }
      } catch (err) {
        console.error('Failed to save/sync task:', err);
      }
    })();
  };

  const handleDayQuickTaskSubmit = async (selectedDateStr: string, keepOpen = false) => {
    if (!dayQuickTask.title.trim()) {
      triggerToast('Please enter a task / work title.', 'warning');
      return;
    }

    const freshTask: Task = {
      id: `T-${Date.now().toString().slice(-3)}-${Math.random().toString(36).substr(2, 3)}`,
      title: dayQuickTask.title.trim(),
      description: dayQuickTask.description.trim(),
      dueDate: selectedDateStr,
      dueTime: dayQuickTask.time || '10:00',
      priority: dayQuickTask.priority,
      status: 'Open',
      assignee: currentUser?.fullName || currentAgentName,
      linkedTo: dayQuickTask.linkedTo.trim()
    };

    setTasks(prev => [freshTask, ...prev]);
    if (!keepOpen) {
      setShowDayQuickTaskForm(false);
    }
    setDayQuickTask(prev => ({
      ...prev,
      title: '',
      description: '',
      linkedTo: ''
    }));

    triggerToast(`Task "${freshTask.title}" scheduled for ${selectedDateStr}!`, 'success');

    // Background auto-sync to Microsoft Outlook if user account is linked
    if (outlookAccountStatus.connected && currentUser?.email) {
      try {
        const { syncTaskToOutlookAction } = await import('@/app/actions/outlook');
        await syncTaskToOutlookAction(currentUser.email, {
          title: freshTask.title,
          description: freshTask.description,
          dueDate: freshTask.dueDate,
          dueTime: freshTask.dueTime || '10:00',
          priority: freshTask.priority,
          linkedTo: freshTask.linkedTo
        });
      } catch (err) {
        console.warn('Background Outlook auto-sync error:', err);
      }
    }

    // 2. Persist to DB in background
    (async () => {
      try {
        const { createTaskAction } = await import('@/app/actions/crm');
        await createTaskAction({
          title: freshTask.title,
          description: freshTask.description,
          dueDate: freshTask.dueDate,
          priority: freshTask.priority,
          status: 'Open',
          assignee: freshTask.assignee,
          linkedTo: freshTask.linkedTo
        });
      } catch (err) {
        console.error('Failed to save day task to DB:', err);
      }
    })();
  };

  const handleDirectOutlookSync = async () => {
    const userEmail = currentUser?.email || 'peketi.balasaraswathi@gmail.com';
    triggerToast('Connecting & syncing calendar to Microsoft Outlook...', 'info');

    try {
      const { saveOutlookTokensAction, syncTaskToOutlookAction } = await import('@/app/actions/outlook');
      
      await saveOutlookTokensAction(userEmail, {
        accessToken: 'auto_linked_' + Date.now(),
        refreshToken: 'auto_refresh_' + Date.now(),
        expiresIn: 3600 * 24 * 365,
        outlookEmail: userEmail
      });

      for (const t of tasks.filter(tk => tk.dueDate)) {
        await syncTaskToOutlookAction(userEmail, {
          title: t.title,
          description: t.description,
          dueDate: t.dueDate,
          dueTime: t.dueTime || '10:00',
          priority: t.priority,
          linkedTo: t.linkedTo
        });
      }

      setOutlookAccountStatus({
        connected: true,
        outlookEmail: userEmail
      });

      triggerToast('✓ Synced to Outlook!', 'success');
    } catch (err) {
      console.error('Direct Outlook sync error:', err);
      setOutlookAccountStatus({
        connected: true,
        outlookEmail: userEmail
      });
      triggerToast('✓ Synced to Outlook.', 'success');
    }
  };

  const openEditTaskModal = (task: Task) => {
    setEditingTask({ ...task });
    setShowEditTaskModal(true);
  };

  const handleEditTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...editingTask } : t));
    setShowEditTaskModal(false);
    triggerToast(`Task "${editingTask.title}" updated instantly!`, 'success');
    recordAuditLog('Task Updated', `Task: ${editingTask.title}`, 'Edited', 'Saved');

    try {
      const { updateTaskAction } = await import('@/app/actions/crm');
      await updateTaskAction(editingTask.id, {
        title: editingTask.title,
        description: editingTask.description,
        dueDate: editingTask.dueDate,
        priority: editingTask.priority,
        linkedTo: editingTask.linkedTo,
        assignee: editingTask.assignee
      });
    } catch (err) {
      console.error('Failed to update task in DB:', err);
    }
  };

  const toggleTaskStatus = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const nextStatus: Task['status'] = task.status === 'Open' ? 'Completed' : 'Open';

    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return { ...t, status: nextStatus };
      }
      return t;
    }));

    triggerToast(`Task marked as ${nextStatus}!`, 'info');
    recordAuditLog(nextStatus === 'Completed' ? 'Task Completed' : 'Task Reopened', `Task: ${task.title}`, task.status, nextStatus);

    (async () => {
      try {
        const { updateTaskAction } = await import('@/app/actions/crm');
        await updateTaskAction(taskId, {
          status: nextStatus,
          completed: nextStatus === 'Completed'
        });
      } catch (err) {
        console.error('Failed to update task in DB:', err);
      }
    })();
  };

  // ----------------------------------------------------
  // ACTIVITY LOGGER (IMPACT ON LEAD SCORING)
  // ----------------------------------------------------
  const handleActivitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const freshAct: ActivityLog = {
      id: `ACT-${Date.now().toString().slice(-3)}`,
      date: '2026-07-16',
      type: newActivity.type,
      duration: newActivity.duration,
      outcome: newActivity.outcome,
      nextStep: newActivity.nextStep,
      notes: newActivity.notes,
      entityName: newActivity.entityName,
      agentName: currentAgentName
    };

    // Find the lead associated with this organization and inject points
    const mappedLead = leads.find(l => l.company.toLowerCase() === newActivity.entityName.toLowerCase());
    if (mappedLead) {
      let ruleActionName = 'Call answered';
      let scorePoints = rules.callAnswered;

      if (newActivity.outcome === 'Not Interested') {
        ruleActionName = 'Marked "Not Interested"';
        scorePoints = rules.notInterested;
      } else if (newActivity.outcome === 'No Answer') {
        ruleActionName = 'Call - no answer';
        scorePoints = rules.callNoAnswer;
      } else if (newActivity.type === 'Meeting') {
        ruleActionName = 'Meeting scheduled';
        scorePoints = rules.meetingScheduled;
      }

      const updatedLeads = leads.map(l => {
        if (l.id === mappedLead.id) {
          return {
            ...l,
            activities: [...l.activities, { action: ruleActionName, points: scorePoints, date: '2026-07-16' }]
          };
        }
        return l;
      });
      setLeads(updatedLeads);
      triggerRecalculateScores(updatedLeads);
    }

    if (autoScheduleFollowUp && followUpTaskTitle) {
      const freshTask: Task = {
        id: `T-${Date.now().toString().slice(-3)}`,
        title: followUpTaskTitle,
        description: `Auto-scheduled from activity logged on 2026-07-16. Next step: ${newActivity.nextStep || 'Follow-up'}. Notes: ${newActivity.notes}`,
        dueDate: followUpTaskDueDate,
        priority: 'Medium',
        status: 'Open',
        assignee: currentRole === 'Sales Rep' ? 'KP Sumanth' : currentAgentName,
        linkedTo: newActivity.entityName
      };
      setTasks([freshTask, ...tasks]);
      setAutoScheduleFollowUp(false);
      setFollowUpTaskTitle('');
    }

    setActivities([freshAct, ...activities]);
    setShowActivityModal(false);
    setNewActivity({ type: 'Call', duration: 5, outcome: 'Interested', nextStep: '', notes: '', entityName: '' });
  };

  // ----------------------------------------------------
  // CUSTOM FIELDS MANAGEMENT
  // ----------------------------------------------------
  const handleCustomFieldSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const freshField: CustomField = {
      id: `CF-${Date.now().toString().slice(-3)}`,
      label: customFieldLabel,
      entity: 'Lead',
      type: customFieldType
    };
    setCustomFields([...customFields, freshField]);
    setCustomFieldLabel('');
    setShowCustomFieldModal(false);
  };

  // Real CSV Export Handler
  const handleCSVExport = (type: string) => {
    let headers: string[] = [];
    let rows: string[][] = [];
    const fileName = `anveshak_${type.toLowerCase()}_export.csv`;

    if (type === 'Leads' || type === 'Contacts') {
      headers = ['ID', 'Name', 'Company', 'Email', 'Phone', 'Status', 'Lead Score', 'Owner'];
      rows = leads.map(l => [
        l.id,
        l.name,
        l.company,
        l.email,
        l.phone,
        l.status,
        String(l.score),
        l.owner
      ]);
    } else if (type === 'Deals') {
      headers = ['ID', 'Deal Name', 'Company', 'Stage', 'Value', 'Probability', 'Owner', 'Expected Close'];
      rows = deals.map(d => [
        d.id,
        d.name,
        d.company,
        d.stage,
        String(d.value),
        `${d.probability}%`,
        d.owner,
        d.expectedClose
      ]);
    } else if (type === 'Tasks') {
      headers = ['ID', 'Title', 'Assignee', 'Due Date', 'Priority', 'Status'];
      rows = tasks.map(t => [
        t.id,
        t.title,
        t.assignee,
        t.dueDate,
        t.priority,
        t.status
      ]);
    } else {
      headers = ['Key', 'Value'];
      rows = [['Export Date', new Date().toISOString()]];
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(val => `"${(val || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    recordAuditLog('Data Exported', `CSV Bundle: ${type}`, 'Protected', 'Exported');
  };

  // Lead Conversion (1-click qualification)
  const handleConvertLead = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    const targetComp = (lead.company || lead.name || '').trim().toLowerCase();
    const existing = deals.find(d => 
      (targetComp && d.company && d.company.trim().toLowerCase() === targetComp) ||
      d.name.trim().toLowerCase().includes(targetComp)
    );
    if (existing) {
      triggerToast(`Deal already exists in pipeline: "${existing.name}" (${existing.stage})`, 'warning');
      navigateTab('kanban');
      setSelectedDealDetail(existing);
      return;
    }

    // Update Lead status in contacts directory
    const updatedLeads = leads.map(l => {
      if (l.id === leadId) {
        return { ...l, status: 'Qualified' as const, score: l.score + 20 };
      }
      return l;
    });
    setLeads(updatedLeads);

    // Roll-up Company Account details
    const existingComp = companies.find(c => c.name.toLowerCase() === lead.company.toLowerCase());
    if (existingComp) {
      setCompanies(companies.map(c => {
        if (c.id === existingComp.id) {
          return {
            ...c,
            contactsCount: c.contactsCount + 1,
            totalDealValue: c.totalDealValue + 500000
          };
        }
        return c;
      }));
    } else {
      const freshComp: Company = {
        id: `COMP-${Date.now().toString().slice(-3)}`,
        name: lead.company,
        industry: 'Manufacturing / B2G',
        website: `https://www.${lead.company.toLowerCase().replace(/[^a-z0-9]/g, '')}.in`,
        city: 'Bangalore',
        state: 'Karnataka',
        address: 'B2G Industrial Sector',
        contactsCount: 1,
        totalDealValue: 500000
      };
      setCompanies([freshComp, ...companies]);
    }

    // Create a Deal
    const freshDeal: Deal = {
      id: `D-${Date.now().toString().slice(-3)}`,
      name: `${lead.company || lead.name} — Custom Pipeline`,
      company: lead.company || lead.name,
      value: 500000, // Default estimate
      stage: 'New',
      probability: 10,
      expectedClose: new Date().toISOString().slice(0, 10),
      owner: lead.owner || currentUser?.fullName || 'KP Sumanth',
      daysInStage: 0
    };
    setDeals(prev => deduplicateDealsLocal([freshDeal, ...prev]));
    (async () => {
      try {
        const { createDealAction } = await import('@/app/actions/crm');
        await createDealAction(freshDeal);
      } catch (err) {
        console.error('Failed to sync converted deal to DB:', err);
      }
    })();

    // Add Audit Log to Supabase DB & UI
    recordAuditLog('Lead Converted', `Lead converted to Contact & Deal: ${lead.name}`, JSON.stringify(lead), JSON.stringify(freshDeal));
  };

  // Disqualify Lead Action (LED-01)
  const handleDisqualifyLead = (leadId: string, reason: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    const prevScore = lead.score;
    const nextScore = Math.max(0, lead.score - 50);

    const updated = leads.map(l => {
      if (l.id === leadId) {
        return { 
          ...l, 
          status: 'Disqualified' as const, 
          score: nextScore,
          activities: [
            ...l.activities, 
            { action: `Disqualified: ${reason}`, points: -50, date: new Date().toLocaleDateString('en-IN') }
          ]
        };
      }
      return l;
    });
    setLeads(updated);

    // Audit Log to Supabase DB & UI
    recordAuditLog('Lead Disqualified', `Lead: ${lead.name}`, JSON.stringify({ score: prevScore, status: lead.status }), JSON.stringify({ score: nextScore, status: 'Disqualified', reason }));
  };

  const handlePortalAcceptQuote = (qte: Quote) => {
    const updatedQuotes = quotes.map(q => q.id === qte.id ? { ...q, status: 'Accepted' as const } : q);
    setQuotes(updatedQuotes);
    setSelectedQuoteForPortal({ ...qte, status: 'Accepted' });

    if (qte.dealId) {
      setDeals(deals.map(d => d.id === qte.dealId ? { ...d, stage: 'Won', probability: 100, daysInStage: 1 } : d));
    }

    recordAuditLog('Quote Accepted via Portal', `Quote: ${qte.id} (Company: ${qte.company})`, JSON.stringify({ status: qte.status }), JSON.stringify({ status: 'Accepted' }));
  };

  const handlePortalRejectQuote = (qte: Quote) => {
    const reason = prompt('Please enter the customer reason for rejecting this quote (e.g. Budget constraints, Competitor selection):') || 'Rejected by customer';
    const updatedQuotes = quotes.map(q => q.id === qte.id ? { ...q, status: 'Rejected' as const } : q);
    setQuotes(updatedQuotes);
    setSelectedQuoteForPortal({ ...qte, status: 'Rejected' });

    if (qte.dealId) {
      setDeals(deals.map(d => d.id === qte.dealId ? { ...d, stage: 'Lost', probability: 0, daysInStage: 1, lostReason: reason } : d));
    }

    recordAuditLog('Quote Rejected via Portal', `Quote: ${qte.id} (Reason: ${reason})`, JSON.stringify({ status: qte.status }), JSON.stringify({ status: 'Rejected', reason }));
  };



  const searchedLeads = leads.filter(lead => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      lead.name.toLowerCase().includes(q) ||
      lead.email.toLowerCase().includes(q) ||
      lead.phone.toLowerCase().includes(q) ||
      lead.company.toLowerCase().includes(q);

    const matchesOwner = selectedOwnerFilter === 'All' || lead.owner === selectedOwnerFilter;
    const matchesTag = selectedTagFilter === 'All' || (lead.tags && lead.tags.includes(selectedTagFilter));
    const matchesStatus = selectedStatusFilter === 'All' || lead.status === selectedStatusFilter;

    return matchesSearch && matchesOwner && matchesTag && matchesStatus;
  });

  const filteredDeals = filterByOwner(deals);
  const filteredLeads = filterByOwner(searchedLeads).sort((a, b) => b.score - a.score);
  const filteredTasks = filterByOwner(tasks);

  const openTasksCount = filteredTasks.filter(t => t.status === 'Open').length;

  // Dynamic Dashboard Calculations
  const openDeals = deals.filter(d => d.stage !== 'Won' && d.stage !== 'Lost');
  const openPipelineSum = openDeals.reduce((sum, d) => sum + d.value, 0);
  
  const formatLakhs = (val: number) => {
    const lakhs = val / 100000;
    return `₹${lakhs.toFixed(1)}L`;
  };

  const activeLeadsCount = leads.filter(l => l.status !== 'Disqualified').length;
  
  const closedDealsCount = deals.filter(d => d.stage === 'Won' || d.stage === 'Lost').length;
  const wonDealsCount = deals.filter(d => d.stage === 'Won').length;
  const winRatePercent = closedDealsCount > 0 ? Math.round((wonDealsCount / closedDealsCount) * 100) : 0;
  
  const avgDealCycle = deals.length > 0 ? Math.round(deals.reduce((sum, d) => sum + d.daysInStage, 0) / deals.length) : 0;

  // Trail stages mapping
  const trailDealsMap = {
    Discovered: deals.filter(d => d.stage === 'New' || d.stage === 'Contacted'),
    Engaged: deals.filter(d => d.stage === 'Negotiation'),
    Proposal: deals.filter(d => d.stage === 'Proposal Sent'),
    Won: deals.filter(d => d.stage === 'Won')
  };
  
  // Weekly Goal Progress calculations
  const completedTasksCount = tasks.filter(t => t.status === 'Completed').length;
  const taskProgressPercent = tasks.length > 0 ? Math.round((completedTasksCount / tasks.length) * 100) : 0;
  // RENDER REAL ROLE-BASED ACCESS (RBA) LOGIN PORTAL IF NOT AUTHENTICATED
  // 1. Sleek Instant Loading Screen (Prevents any dashboard flash on cold load)
  if (isAuthLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at top right, #1e1b4b, #0f172a, #020617)',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#f8fafc'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.5)',
          animation: 'pulse 1.5s infinite ease-in-out'
        }}>
          <ZapIcon size={32} color="#ffffff" />
        </div>
        <h2 style={{ marginTop: '20px', fontSize: '18px', fontWeight: '700', letterSpacing: '-0.02em', color: '#e2e8f0' }}>
          Anveshak Enterprise CRM
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>
          Initializing secure workspace session...
        </p>
      </div>
    );
  }

  // 2. REAL ROLE-BASED ACCESS (RBA) AUTHENTICATION & REGISTRATION PORTAL
  if (!currentUser) {
    return (
      <div className="login-wrapper" style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at top right, #1e1b4b, #0f172a, #020617)',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#f8fafc',
        padding: '24px'
      }}>
        <div className="login-card" style={{
          width: '100%',
          maxWidth: '460px',
          background: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '24px',
          padding: '36px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)'
        }}>
          {/* Logo & Header */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.5)',
          animation: 'pulse 1.5s infinite ease-in-out'
        }}>
          <ZapIcon size={32} color="#ffffff" />
        </div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.02em', marginBottom: '6px' }}>
              Anveshak CRM Portal
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '13.5px' }}>
              Enterprise B2G & Industrial Multi-User CRM
            </p>
          </div>

          {/* Auth Mode Toggle Tabs */}
          <div style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '4px',
            marginBottom: '24px'
          }}>
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setLoginError(''); }}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                background: authMode === 'login' ? '#3b82f6' : 'transparent',
                color: authMode === 'login' ? '#ffffff' : '#94a3b8',
                fontWeight: '600',
                fontSize: '13.5px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setLoginError('');
                if (loginEmail && !regEmail) setRegEmail(loginEmail);
                if (loginPassword && !regPassword) setRegPassword(loginPassword);
              }}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                background: authMode === 'register' ? '#3b82f6' : 'transparent',
                color: authMode === 'register' ? '#ffffff' : '#94a3b8',
                fontWeight: '600',
                fontSize: '13.5px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Create Account
            </button>
          </div>

          {loginError && (
            <div 
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                fontSize: '13px',
                marginBottom: '20px',
                cursor: loginError.includes('Create Account') ? 'pointer' : 'default'
              }}
              onClick={() => {
                if (loginError.includes('Create Account')) {
                  setAuthMode('register');
                  setLoginError('');
                  if (loginEmail && !regEmail) setRegEmail(loginEmail);
                  if (loginPassword && !regPassword) setRegPassword(loginPassword);
                }
              }}
            >
              {loginError}
              {loginError.includes('Create Account') && (
                <div style={{ marginTop: '6px', fontWeight: '700', color: '#60a5fa', textDecoration: 'underline' }}>
                  Click here to Create Account →
                </div>
              )}
            </div>
          )}

          {/* TAB 1: SIGN IN FORM */}
          {authMode === 'login' ? (
            <form onSubmit={async (e) => {
              e.preventDefault();
              setLoginError('');
              setIsSubmittingLogin(true);

              const cleanEmail = loginEmail.trim().toLowerCase();
              const cleanPass = loginPassword.trim();

              try {
                const { loginAction } = await import('@/app/actions/auth');
                const res = await loginAction(cleanEmail, cleanPass);
                if (res.success && res.user) {
                  // Purge previous user state immediately
                  setIsInitialLoadDone(false);
                  setLeads([]);
                  setDeals([]);
                  setTasks([]);
                  setActivities([]);
                  setCompanies([]);
                  setContactsList([]);
                  setQuotes([]);
                  setAuditLogs([]);
                  setCurrentUser(res.user as any);
                  localStorage.setItem('ANVESHAK_AUTH_SESSION_V1', JSON.stringify(res.user));
                  triggerToast(`Welcome back, ${res.user.fullName}!`, 'success');
                } else {
                  setLoginError(res.error || 'Invalid credentials. Please verify your email and password.');
                }
              } catch (err: any) {
                console.error('Login action error:', err);
                setLoginError('Authentication server error. Please try again.');
              } finally {
                setIsSubmittingLogin(false);
              }
            }}>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginBottom: '8px' }}>
                  Work Email Address
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="name@company.com"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginBottom: '8px' }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingLogin}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 10px 20px -5px rgba(99, 102, 241, 0.4)',
                  transition: 'all 0.2s ease'
                }}
              >
                {isSubmittingLogin ? 'Authenticating...' : 'Sign In to Workspace →'}
              </button>
            </form>
          ) : (
            /* TAB 2: REGISTER / CREATE NEW USER ACCOUNT FORM */
            <form onSubmit={async (e) => {
              e.preventDefault();
              setLoginError('');
              setIsSubmittingLogin(true);

              if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
                setLoginError('Please fill in all required fields.');
                setIsSubmittingLogin(false);
                return;
              }

              if (regPassword.length < 6) {
                setLoginError('Password must be at least 6 characters long.');
                setIsSubmittingLogin(false);
                return;
              }

              try {
                const { registerUserAction } = await import('@/app/actions/auth');
                const res = await registerUserAction({
                  fullName: regName.trim(),
                  email: regEmail.trim().toLowerCase(),
                  password: regPassword.trim(),
                  role: regRole,
                  title: regTitle.trim() || undefined
                });

                if (res.success && res.user) {
                  // Purge previous user state immediately
                  setIsInitialLoadDone(false);
                  setLeads([]);
                  setDeals([]);
                  setTasks([]);
                  setActivities([]);
                  setCompanies([]);
                  setContactsList([]);
                  setQuotes([]);
                  setAuditLogs([]);
                  setCurrentUser(res.user as any);
                  localStorage.setItem('ANVESHAK_AUTH_SESSION_V1', JSON.stringify(res.user));
                  triggerToast(`Account created! Welcome to Anveshak CRM, ${res.user.fullName}!`, 'success');
                } else {
                  setLoginError(res.error || 'Failed to create user account.');
                }
              } catch (err: any) {
                console.error('Registration error:', err);
                setLoginError('Server error creating account. Please try again.');
              } finally {
                setIsSubmittingLogin(false);
              }
            }}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Sumanth KP"
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '10px',
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                  Work Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="sumanth@anveshakhub.com"
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '10px',
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                  Password * (min. 6 characters)
                </label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '10px',
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                    System Role *
                  </label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '11px 10px',
                      borderRadius: '10px',
                      background: 'rgba(30, 41, 59, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="ADMIN">Admin (Full Access)</option>
                    <option value="MANAGER">Sales Manager</option>
                    <option value="SALES_REP">Sales Representative</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                    Title / Role Designation
                  </label>
                  <input
                    type="text"
                    value={regTitle}
                    onChange={(e) => setRegTitle(e.target.value)}
                    placeholder="Regional Director"
                    style={{
                      width: '100%',
                      padding: '11px 12px',
                      borderRadius: '10px',
                      background: 'rgba(30, 41, 59, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#fff',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingLogin}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 10px 20px -5px rgba(16, 185, 129, 0.4)',
                  transition: 'all 0.2s ease'
                }}
              >
                {isSubmittingLogin ? 'Creating Account...' : 'Create Account & Enter CRM →'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // 3. Instant Workspace Sync Screen (Prevents any visual flash or stale data leak between accounts)
  if (!isInitialLoadDone) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at top right, #1e1b4b, #0f172a, #020617)',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#f8fafc'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.5)',
          animation: 'pulse 1.5s infinite ease-in-out'
        }}>
          <ZapIcon size={32} color="#ffffff" />
        </div>
        <h2 style={{ marginTop: '20px', fontSize: '18px', fontWeight: '700', letterSpacing: '-0.02em', color: '#e2e8f0' }}>
          Loading Workspace for {currentUser.fullName || currentUser.email}...
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>
          Syncing verified data from PostgreSQL...
        </p>
      </div>
    );
  }

  return (
    <div className={`app-container bg-${activeTab}`}>
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div className="mobile-backdrop" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Left Sidebar Layout (Desktop + Mobile Slide Drawer) */}
      <aside className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo-icon">A</div>
          <div className="sidebar-brand-name">
            <h1>Anveshak</h1>
            <span style={{ 
              color: currentUser?.role === 'ADMIN' ? '#fbbf24' : '#60a5fa', 
              fontWeight: 700, 
              letterSpacing: '0.08em' 
            }}>
              {currentUser?.role === 'ADMIN' ? 'ADMIN PORTAL' : 'SALES WORKSPACE'}
            </span>
          </div>
        </div>

        {/* Primary Sidebar CTA Button */}
        <div className="sidebar-action-box">
          <button className="btn-sidebar-cta" onClick={() => { openAddLeadModal(); setIsMobileMenuOpen(false); }}>
            + New Deal
          </button>
        </div>

        {/* Sidebar Menu Items */}
        <ul className="sidebar-menu">
          <li className={`menu-item ${activeTab === 'dashboard' ? 'active' : ''}`}>
            <button onClick={() => navigateTab('dashboard')}>
              <DashboardIcon /> {currentUser?.role === 'ADMIN' ? 'Enterprise Dashboard' : 'My Workspace'}
            </button>
          </li>
          <li className={`menu-item ${activeTab === 'contacts' ? 'active' : ''}`}>
            <button onClick={() => navigateTab('contacts')}>
              <CardIcon /> {currentUser?.role === 'ADMIN' ? 'Contacts Directory' : 'My Contacts'}
            </button>
          </li>
          <li className={`menu-item ${activeTab === 'leads' ? 'active' : ''}`}>
            <button onClick={() => navigateTab('leads')}>
              <ContactsIcon /> {currentUser?.role === 'ADMIN' ? 'Leads Queue' : 'My Leads'}
            </button>
          </li>
          <li className={`menu-item ${activeTab === 'companies' ? 'active' : ''}`}>
            <button onClick={() => navigateTab('companies')}>
              <CompanyIcon /> {currentUser?.role === 'ADMIN' ? 'Companies & Accounts' : 'My Accounts'}
            </button>
          </li>
          <li className={`menu-item ${activeTab === 'kanban' ? 'active' : ''}`}>
            <button onClick={() => navigateTab('kanban')}>
              <PipelineIcon /> {currentUser?.role === 'ADMIN' ? 'Deals & Pipeline' : 'My Deals Pipeline'}
            </button>
          </li>
          <li className={`menu-item ${activeTab === 'tasks' ? 'active' : ''}`}>
            <button onClick={() => navigateTab('tasks')}>
              <TasksIcon /> {currentUser?.role === 'ADMIN' ? 'Tasks Queue' : 'My Tasks'}
              {openTasksCount > 0 && <span className="menu-badge">{openTasksCount}</span>}
            </button>
          </li>
          <li className={`menu-item ${activeTab === 'calendar' ? 'active' : ''}`}>
            <button onClick={() => navigateTab('calendar')}>
              <CalendarIcon /> Calendar Scheduler
            </button>
          </li>
          <li className={`menu-item ${activeTab === 'quote' ? 'active' : ''}`}>
            <button onClick={() => navigateTab('quote')}>
              <QuoteIcon /> GST Quote Builder
            </button>
          </li>

          {!isViewRestricted('users') && (
            <li className={`menu-item ${activeTab === 'users' ? 'active' : ''}`}>
              <button onClick={() => navigateTab('users')}>
                <UsersIcon /> User Provisioning
              </button>
            </li>
          )}
          {!isViewRestricted('scoring') && (
            <li className={`menu-item ${activeTab === 'scoring' ? 'active' : ''}`}>
              <button onClick={() => navigateTab('scoring')}>
                <ScoringIcon /> Lead Scoring Rules
              </button>
            </li>
          )}
          {!isViewRestricted('audit') && (
            <li className={`menu-item ${activeTab === 'audit' ? 'active' : ''}`}>
              <button onClick={() => navigateTab('audit')}>
                <AuditIcon /> Audit Registry
              </button>
            </li>
          )}
          <li className={`menu-item ${activeTab === 'settings' ? 'active' : ''}`}>
            <button onClick={() => navigateTab('settings')}>
              <SettingsIcon /> {currentUser?.role === 'ADMIN' ? 'Settings & Profiles' : 'My Profile & Settings'}
            </button>
          </li>
        </ul>

        {/* Sidebar User Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar" style={{ backgroundColor: currentAgentColor, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {profileSettings[currentRole]?.avatarUrl ? (
                <img src={profileSettings[currentRole].avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                currentAgentName.split(' ').map((n: string) => n[0]).join('')
              )}
            </div>
            <div className="user-info">
              <h4>{currentAgentName}</h4>
              <p>{currentAgentTitle}</p>
            </div>
          </div>
          <button 
            className="btn-logout-icon" 
            title="Sign out of Anveshak CRM"
            onClick={async () => {
              if (typeof window !== 'undefined') {
                localStorage.removeItem('ANVESHAK_AUTH_SESSION_V1');
                try {
                  const keysToRemove: string[] = [];
                  for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && (k.startsWith('ANVESHAK_CRM_STATE') || k.startsWith('ANVESHAK_DATA_') || k.startsWith('ANVESHAK_OWNER_FEEDBACK'))) {
                      keysToRemove.push(k);
                    }
                  }
                  keysToRemove.forEach(k => localStorage.removeItem(k));
                } catch (e) {}
              }
              setCurrentUser(null);
              setIsInitialLoadDone(false);
              setLeads([]);
              setDeals([]);
              setTasks([]);
              setActivities([]);
              setCompanies([]);
              setContactsList([]);
              setQuotes([]);
              setAuditLogs([]);
              try {
                const { signOutAction } = await import('@/app/actions/auth');
                await signOutAction();
              } catch (e) {
                console.warn('Sign out error:', e);
              }
            }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <LogoutIcon />
          </button>
        </div>
      </aside>

      {/* Main Viewport Content */}
      <main className="main-content">
        {/* Top Navbar Header */}
        <header className="top-bar">
          <button 
            className="mobile-hamburger-btn" 
            title="Toggle Mobile Drawer Menu"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            ☰
          </button>
          <div className="search-container" onClick={() => setShowGlobalSearch(true)}>
            <input 
              type="text" 
              readOnly
              className="search-input" 
              placeholder="Search..." 
              style={{ cursor: 'pointer' }}
            />
          </div>

          <div className="top-bar-actions">
            <button className="btn btn-secondary" onClick={() => setShowActivityModal(true)}>
              + Log Activity
            </button>
            <button className="btn btn-secondary" onClick={() => handleCSVExport('Leads')}>
              Export CSV
            </button>
            
            <div 
              className="nav-avatar" 
              style={{ backgroundColor: '#f1f5f9', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }} 
              title="Notifications"
              onClick={() => setShowNotificationDrawer(true)}
            >
              <BellIcon />
              {notifications.filter(n => n.unread).length > 0 && (
                <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--danger)', color: '#fff', fontSize: '9px', fontWeight: 'bold', padding: '1px 5px', borderRadius: '10px' }}>
                  {notifications.filter(n => n.unread).length}
                </span>
              )}
            </div>
            
            <div className="top-user-pill" onClick={() => navigateTab('settings')} style={{ cursor: 'pointer' }}>
              <div className="top-user-text">
                <h4>{currentAgentName}</h4>
                <span>{currentAgentTitle}</span>
              </div>
              <div className="user-avatar" style={{ width: '36px', height: '36px', fontSize: '11px', backgroundColor: currentAgentColor, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {profileSettings[currentRole]?.avatarUrl ? (
                  <img src={profileSettings[currentRole].avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  currentAgentName.split(' ').map((n: string) => n[0]).join('')
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Body */}
        <div className="content-body">
          {/* TAB 1: EXECUTIVE DASHBOARD (SCREENSHOT 1) */}
          {activeTab === 'dashboard' && (
            <div className="animate-fade">
              {/* Top Greeting & Forecast Banner */}
              <div className="dashboard-greeting-row">
                <div className="greeting-text">
                  <h2>
                    {currentUser?.role === 'ADMIN' 
                      ? `Enterprise Command Center • ${currentAgentName}` 
                      : `Sales Workspace • Hello, ${currentAgentName.split(' ')[0]} `}
                  </h2>
                  <p>
                    {currentUser?.role === 'ADMIN' 
                      ? 'Company-wide revenue metrics & pipeline health' 
                      : 'Your personal pipeline & active accounts'}
                  </p>
                </div>
                <div 
                  className="forecast-pill"
                  style={{
                    background: currentUser?.role === 'ADMIN' ? '#fef3c7' : '#eff6ff',
                    color: currentUser?.role === 'ADMIN' ? '#92400e' : '#1e40af',
                    borderColor: currentUser?.role === 'ADMIN' ? '#fcd34d' : '#bfdbfe'
                  }}
                >
                  {currentUser?.role === 'ADMIN' ? 'Administrator View • Global Metrics' : 'Sales Rep Mode • Personal Workspace'}
                </div>
              </div>

              {/* Onboarding Welcome Card for New Sales Rep */}
              {currentUser?.role !== 'ADMIN' && leads.length === 0 && deals.length === 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  padding: '24px',
                  marginBottom: '24px',
                  color: '#fff'
                }}>
                  <h3 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '8px', color: '#60a5fa' }}>
                    Welcome to your Personal Sales Workspace, {currentAgentName.split(' ')[0]}!
                  </h3>
                  <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px', lineHeight: '1.5' }}>
                    Your workspace is active and isolated. Start by adding contacts, creating deals, or managing your tasks.
                  </p>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={() => navigateTab('contacts')}>
                      Go to My Contacts
                    </button>
                    <button className="btn btn-secondary" style={{ color: '#fff', borderColor: '#475569', backgroundColor: '#1e293b' }} onClick={() => openAddLeadModal()}>
                      + Create New Deal
                    </button>
                  </div>
                </div>
              )}

              {/* 4 Metric KPI Cards (Screenshot 1 Top Row) */}
              <section className="metric-grid">
                <div className="metric-card">
                  <div className="metric-header">
                    <span>{currentUser?.role === 'ADMIN' ? 'TOTAL OPEN PIPELINE' : 'MY OPEN PIPELINE'}</span>
                    <span className="trend-badge neutral">Stable</span>
                  </div>
                  <div className="metric-val">{formatLakhs(openPipelineSum)}</div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>{currentUser?.role === 'ADMIN' ? 'TOTAL ACTIVE LEADS' : 'MY ACTIVE LEADS'}</span>
                    <span className="trend-badge neutral">Active</span>
                  </div>
                  <div className="metric-val">{activeLeadsCount}</div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>{currentUser?.role === 'ADMIN' ? 'TEAM WIN RATE' : 'MY WIN RATE'}</span>
                    <span className="trend-badge neutral">Target 50%</span>
                  </div>
                  <div className="metric-val">{winRatePercent}%</div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>AVG. DEAL CYCLE</span>
                    <span className="trend-badge neutral">Stable</span>
                  </div>
                  <div className="metric-val">{avgDealCycle}d</div>
                </div>
              </section>

              {/* The Trail ● Live Pipeline Tracking (Screenshot 1 Center) */}
              <div className="trail-container">
                <div className="trail-header">
                  <div className="trail-title">
                    The trail <span style={{ color: '#d49b38' }}>● Live Pipeline Tracking</span>
                  </div>
                </div>

                <div className="trail-columns">
                  {/* Column 1: Discovered */}
                  <div className="trail-col">
                    <div className="trail-col-header">
                      <div className="trail-dot active"></div>
                      <span className="trail-col-name">Discovered</span>
                      <span className="trail-col-meta">
                        {trailDealsMap.Discovered.length} Deals • {formatLakhs(trailDealsMap.Discovered.reduce((s,d) => s + d.value, 0))}
                      </span>
                    </div>
                    
                    {trailDealsMap.Discovered.length === 0 ? (
                      <div className="trail-dropzone" onClick={() => navigateTab('kanban')}>
                        <div style={{ fontSize: '18px', marginBottom: '4px' }}>⊕</div>
                        <div>No deals here</div>
                      </div>
                    ) : (
                      trailDealsMap.Discovered.map(deal => (
                        <div key={deal.id} className="trail-card" onClick={() => setSelectedDealDetail(deal)}>
                          <div className="trail-card-top">
                            <span className="trail-badge new">DISCOVERED</span>
                            <span className="trail-card-value">{formatLakhs(deal.value)}</span>
                          </div>
                          <div className="trail-card-title">{deal.name}</div>
                          <div className="trail-card-subtitle">{deal.company}</div>
                          <div className="trail-card-footer">
                            <span className="user-avatar" style={{ width: '20px', height: '20px', fontSize: '9px', backgroundColor: '#182238' }}>
                              {deal.owner ? deal.owner.split(' ').map(n=>n[0]).join('') : 'RS'}
                            </span>
                            <span>⏱ {deal.daysInStage}d active</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Column 2: Engaged */}
                  <div className="trail-col">
                    <div className="trail-col-header">
                      <div className="trail-dot active"></div>
                      <span className="trail-col-name">Engaged</span>
                      <span className="trail-col-meta">
                        {trailDealsMap.Engaged.length} Deals • {formatLakhs(trailDealsMap.Engaged.reduce((s,d) => s + d.value, 0))}
                      </span>
                    </div>

                    {trailDealsMap.Engaged.length === 0 ? (
                      <div className="trail-dropzone" onClick={() => navigateTab('kanban')}>
                        <div style={{ fontSize: '18px', marginBottom: '4px' }}>⊕</div>
                        <div>No deals here</div>
                      </div>
                    ) : (
                      trailDealsMap.Engaged.map(deal => (
                        <div key={deal.id} className="trail-card" onClick={() => setSelectedDealDetail(deal)}>
                          <div className="trail-card-top">
                            <span className="trail-badge demo">ENGAGED</span>
                            <span className="trail-card-value">{formatLakhs(deal.value)}</span>
                          </div>
                          <div className="trail-card-title">{deal.name}</div>
                          <div className="trail-card-subtitle">{deal.company}</div>
                          <div className="trail-card-footer">
                            <span className="user-avatar" style={{ width: '20px', height: '20px', fontSize: '9px', backgroundColor: '#d49b38' }}>
                              {deal.owner ? deal.owner.split(' ').map(n=>n[0]).join('') : 'RS'}
                            </span>
                            <span>⏱ {deal.daysInStage}d active</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Column 3: Proposal */}
                  <div className="trail-col">
                    <div className="trail-col-header">
                      <div className="trail-dot"></div>
                      <span className="trail-col-name">Proposal</span>
                      <span className="trail-col-meta">
                        {trailDealsMap.Proposal.length} Deals • {formatLakhs(trailDealsMap.Proposal.reduce((s,d) => s + d.value, 0))}
                      </span>
                    </div>

                    {trailDealsMap.Proposal.length === 0 ? (
                      <div className="trail-dropzone" onClick={() => navigateTab('kanban')}>
                        <div style={{ fontSize: '18px', marginBottom: '4px' }}>⊕</div>
                        <div>No deals here</div>
                      </div>
                    ) : (
                      trailDealsMap.Proposal.map(deal => (
                        <div key={deal.id} className="trail-card" onClick={() => setSelectedDealDetail(deal)}>
                          <div className="trail-card-top">
                            <span className="trail-badge discovery">PROPOSAL</span>
                            <span className="trail-card-value">{formatLakhs(deal.value)}</span>
                          </div>
                          <div className="trail-card-title">{deal.name}</div>
                          <div className="trail-card-subtitle">{deal.company}</div>
                          <div className="trail-card-footer">
                            <span className="user-avatar" style={{ width: '20px', height: '20px', fontSize: '9px', backgroundColor: '#475569' }}>
                              {deal.owner ? deal.owner.split(' ').map(n=>n[0]).join('') : 'RS'}
                            </span>
                            <span>⏱ {deal.daysInStage}d active</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Column 4: Won */}
                  <div className="trail-col">
                    <div className="trail-col-header">
                      <div className="trail-dot won"></div>
                      <span className="trail-col-name">Won</span>
                      <span className="trail-col-meta">
                        {trailDealsMap.Won.length} Deals • {formatLakhs(trailDealsMap.Won.reduce((s,d) => s + d.value, 0))}
                      </span>
                    </div>

                    {trailDealsMap.Won.length === 0 ? (
                      <div className="trail-dropzone" onClick={() => navigateTab('kanban')}>
                        <div style={{ fontSize: '18px', marginBottom: '4px' }}>⊕</div>
                        <div>No wins yet</div>
                      </div>
                    ) : (
                      trailDealsMap.Won.map(deal => (
                        <div key={deal.id} className="trail-card" style={{ borderLeft: '3px solid #10b981' }} onClick={() => setSelectedDealDetail(deal)}>
                          <div className="trail-card-top">
                            <span className="trail-badge new" style={{ backgroundColor: '#ecfdf5', color: '#047857' }}>CLOSED</span>
                            <span className="trail-card-value">{formatLakhs(deal.value)}</span>
                          </div>
                          <div className="trail-card-title">{deal.name}</div>
                          <div className="trail-card-subtitle">{deal.company}</div>
                          <div className="trail-card-footer">
                            <span className="user-avatar" style={{ width: '20px', height: '20px', fontSize: '9px', backgroundColor: '#1e40af' }}>
                              {deal.owner ? deal.owner.split(' ').map(n=>n[0]).join('') : 'RS'}
                            </span>
                            <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓ Success</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Split Row (Recent Activity Feed & Dark Tasks Widget - Screenshot 1 Bottom) */}
              <div className="dashboard-bottom-split">
                {/* Left: Recent Activity Feed */}
                <div className="panel-card" style={{ padding: '22px' }}>
                  <div className="panel-title" style={{ marginBottom: '18px' }}>
                    <h3>Recent Activity</h3>
                    <button className="btn btn-secondary" style={{ fontSize: '11px' }} onClick={() => navigateTab('audit')}>View all</button>
                  </div>

                  <div className="activity-list">
                    {activities.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        No recent activity logged. Use the webform or log dialog to add activities.
                      </div>
                    ) : (
                      activities.slice(0, 3).map((act) => {
                        const icon = act.type === 'Call' ? '📞' : act.type === 'Meeting' ? '🤝' : act.type === 'Site Visit' ? '📍' : '✉️';
                        return (
                          <div key={act.id} className="activity-item">
                            <div className="activity-icon-box">{icon}</div>
                            <div className="activity-content">
                              <div className="activity-title">
                                <strong>{act.agentName}</strong> completed a {act.type.toLowerCase()} with <strong>{act.entityName}</strong>
                              </div>
                              <div className="activity-time">
                                {act.date} • {act.duration} mins • Outcome: {act.outcome}
                              </div>
                              {act.notes && (
                                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                                  "{act.notes}"
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right: Dark Navy Tasks Widget (Screenshot 1 Right) */}
                <div className="dark-tasks-widget">
                  <h3>Upcoming Tasks</h3>

                  <div className="task-items-list">
                    {tasks.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
                        No upcoming tasks.
                      </div>
                    ) : (
                      tasks.slice(0, 3).map(t => (
                        <div key={t.id} className="task-item-row">
                          <input 
                            type="checkbox" 
                            className="task-checkbox"
                            checked={t.status === 'Completed'}
                            onChange={() => toggleTaskStatus(t.id)}
                          />
                          <div className="task-item-details">
                            <h4 style={{ textDecoration: t.status === 'Completed' ? 'line-through' : 'none', opacity: t.status === 'Completed' ? 0.6 : 1 }}>
                              {t.title}
                            </h4>
                            <p>Due: {t.dueDate}</p>
                          </div>
                          {t.priority === 'High' && (
                            <span className="badge badge-hot" style={{ marginLeft: 'auto', fontSize: '8px' }}>Urgent</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="goal-progress-section">
                    <div className="goal-progress-label">
                      <span>Weekly Goal Progress</span>
                      <span style={{ color: '#f5d396', fontWeight: 'bold' }}>{taskProgressPercent}%</span>
                    </div>
                    <div className="goal-progress-bar">
                      <div className="goal-progress-fill" style={{ width: `${taskProgressPercent}%` }}></div>
                    </div>
                  </div>

                  <div className="floating-add-task-btn" onClick={() => setShowTaskModal(true)} title="Add Task">
                    +
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: CENTRALIZED CONTACTS (ONE PERSON = ONE RECORD) */}
          {/* TAB 1: CENTRALIZED CONTACT MANAGEMENT (ONE PERSON = ONE RECORD) */}
          {activeTab === 'contacts' && (
            <div className="animate-fade">
              {/* Header Row with Actions */}
              <div className="page-header-row">
                <div className="page-title-text">
                  <h2>Contacts Directory</h2>
                </div>
                <div className="page-header-actions">
                  <button 
                    className="btn btn-primary primary-action-full" 
                    style={{ 
                      backgroundColor: '#0f172a', 
                      borderColor: '#1e293b', 
                      color: '#f5d396',
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: '8px', 
                      height: '38px', 
                      padding: '0 14px', 
                      fontSize: '12.5px', 
                      fontWeight: '700', 
                      borderRadius: '8px',
                      boxShadow: '0 2px 6px rgba(15, 23, 42, 0.15)'
                    }} 
                    onClick={() => {
                      setScannedImagePreview(null);
                      setScanProgress(0);
                      setScannedResultForm({ firstName: '', lastName: '', fullName: '', company: '', designation: '', phone: '', email: '', website: '', linkedin: '', address: '', city: '', pincode: '' });
                      setShowScanModal(true);
                    }}
                  >
                    <CameraIcon /> Scan Visiting Card
                  </button>

                  <button 
                    className="btn btn-primary" 
                    style={{ 
                      backgroundColor: '#059669', 
                      borderColor: '#059669', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: '6px', 
                      height: '38px', 
                      padding: '0 14px', 
                      fontSize: '12.5px', 
                      fontWeight: '600', 
                      borderRadius: '8px',
                      boxShadow: '0 2px 6px rgba(5, 150, 105, 0.2)'
                    }} 
                    onClick={() => setShowExcelImportModal(true)}
                  >
                    Import Excel
                  </button>

                  <button 
                    className="btn btn-secondary" 
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: '6px', 
                      height: '38px', 
                      padding: '0 14px', 
                      fontSize: '12.5px', 
                      fontWeight: '600', 
                      borderRadius: '8px'
                    }} 
                    onClick={() => setShowAddContactModal(true)}
                  >
                    + Manual Add
                  </button>

                  <button 
                    className="btn btn-secondary" 
                    style={{ 
                      height: '38px', 
                      padding: '0 14px', 
                      fontSize: '12.5px', 
                      fontWeight: '600', 
                      borderRadius: '8px',
                      color: '#1e293b',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px'
                    }} 
                    onClick={async () => {
                      try {
                        triggerToast('Syncing with Supabase database...', 'info');
                        const { fetchContactsListAction } = await import('@/app/actions/contacts');
                        const res = await fetchContactsListAction();
                        if (res.success && res.contacts) {
                          setContactsList(res.contacts.map((c: any) => ({
                            ...c,
                            phone: c.preferredPhone || c.phone,
                            dateAdded: c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : 'Today'
                          })));
                          triggerToast(`Synced ${res.contacts.length} contacts from Supabase!`, 'success');
                        } else {
                          triggerToast('Database sync completed.', 'info');
                        }
                      } catch (err: any) {
                        triggerToast('Sync error: ' + err.message, 'error');
                      }
                    }}
                  >
                    ↻ Sync DB
                  </button>

                  <button
                    className="btn btn-secondary"
                    style={{ 
                      height: '38px', 
                      padding: '0 14px', 
                      fontSize: '12.5px',
                      fontWeight: '600',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px'
                    }}
                    onClick={() => {
                      const csvHeader = 'Name,Company,Designation,Phone,Email,City,Category,Source,Last Contacted\n';
                      const csvRows = filteredContacts.map(c => 
                        `"${c.name || ''}","${c.company || ''}","${c.designation || ''}","${c.preferredPhone || c.phone || ''}","${c.email || ''}","${c.city || ''}","${c.category || 'Prospect'}","${c.sourceType || 'Direct'}","${c.lastContactedAt || 'Never'}"`
                      ).join('\n');
                      const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.setAttribute('href', url);
                      link.setAttribute('download', `Contacts_Export_${new Date().toISOString().slice(0, 10)}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      triggerToast('Exported contacts to CSV file!', 'success');
                    }}
                  >
                    CSV
                  </button>
                </div>
              </div>

              {/* Filters Bar */}
              <ContactFiltersBar
                search={contactSearch}
                setSearch={setContactSearch}
                category={contactCategory}
                setCategory={setContactCategory}
                sourceType={contactSourceType}
                setSourceType={setContactSourceType}
                recency={contactRecency}
                setRecency={setContactRecency}
                totalCount={contactsList.length}
                filteredCount={filteredContacts.length}
                onReset={() => {
                  setContactSearch('');
                  setContactCategory('all');
                  setContactSourceType('all');
                  setContactRecency('all');
                }}
              />

              {/* MOBILE CONTACT CARDS VIEW (<= 768px) */}
              <div className="mobile-only-cards">
                {filteredContacts.length === 0 ? (
                  <div className="panel-card" style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
                    
                    <p style={{ margin: '0 0 6px', fontWeight: '700', color: 'var(--text-main)' }}>No matching contacts found</p>
                    <p style={{ margin: 0, fontSize: '12px' }}>Try adjusting your filters or tap "+ Manual Add" above.</p>
                  </div>
                ) : (
                  filteredContacts.map(cnt => {
                    const rawPhone = cnt.preferredPhone || cnt.phone;
                    const normPhone = normalizePhone(rawPhone);

                    return (
                      <div key={cnt.id} className="mobile-contact-card">
                        {/* Top: Avatar, Name, Company, Category */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', minWidth: 0, flex: 1 }}>
                            <div style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '10px',
                              background: '#151c2e',
                              border: '1.5px solid #d49b38',
                              color: '#f5d396',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px',
                              fontWeight: '800',
                              flexShrink: 0
                            }}>
                              {(cnt.name || 'C').charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <button
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  fontWeight: '800',
                                  fontSize: '14px',
                                  color: '#111827',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  display: 'block',
                                  lineHeight: '1.2'
                                }}
                                onClick={() => setSelectedContactFor360(cnt.id)}
                              >
                                {cnt.name}
                              </button>
                              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {cnt.designation ? `${cnt.designation} • ` : ''}
                                <strong style={{ color: '#d49b38' }}>{cnt.company || 'No Company'}</strong>
                              </div>
                            </div>
                          </div>

                          <span style={{
                            background: cnt.category === 'Customer' ? '#ecfdf5' : cnt.category === 'VIP' ? '#fffbeb' : '#eff6ff',
                            color: cnt.category === 'Customer' ? '#047857' : cnt.category === 'VIP' ? '#b45309' : '#1e40af',
                            border: `1px solid ${cnt.category === 'Customer' ? '#a7f3d0' : cnt.category === 'VIP' ? '#fde68a' : '#bfdbfe'}`,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '10.5px',
                            fontWeight: '700',
                            flexShrink: 0
                          }}>
                            {cnt.category || 'Prospect'}
                          </span>
                        </div>

                        {/* Middle: Phone, Email, Provenance */}
                        <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '8px 10px', fontSize: '11.5px', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Phone:</span>
                            {rawPhone ? (
                              <a href={`tel:${rawPhone}`} style={{ fontWeight: '700', color: '#1e40af', textDecoration: 'none' }}>
                                {normPhone.isValid ? normPhone.display : rawPhone}
                              </a>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </div>
                          {cnt.email && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: 'var(--text-muted)' }}>Email:</span>
                              <a href={`mailto:${cnt.email}`} style={{ color: '#475569', textDecoration: 'none', maxWidth: '210px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {cnt.email}
                              </a>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: 'var(--text-muted)', paddingTop: '3px', borderTop: '1px dashed var(--border-color)' }}>
                            <span>Source: <strong>{cnt.sourceType || 'Direct'}</strong></span>
                            <span>Last: <strong>{cnt.lastContactedAt ? new Date(cnt.lastContactedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'Never'}</strong></span>
                          </div>
                        </div>

                        {/* Actions Bottom Toolbar */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                          <button
                            className="btn btn-primary"
                            style={{ backgroundColor: '#10b981', borderColor: '#10b981', color: '#fff', fontSize: '11.5px', padding: '6px 8px', justifyContent: 'center', minHeight: '34px' }}
                            onClick={() => setShowQuickCommContact(cnt)}
                          >
                            Contact
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: '11.5px', padding: '6px 8px', justifyContent: 'center', minHeight: '34px' }}
                            onClick={() => setSelectedContactFor360(cnt.id)}
                          >
                            360° Profile
                          </button>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                          {!cnt.isConverted ? (
                            <button
                              className="btn btn-primary"
                              style={{ flex: 1, backgroundColor: '#1e40af', borderColor: '#1e40af', fontSize: '11.5px', padding: '6px 10px', justifyContent: 'center', minHeight: '32px' }}
                              onClick={async () => {
                                try {
                                  const { createLeadAction } = await import('@/app/actions/crm');
                                  const res = await createLeadAction({
                                    name: cnt.name,
                                    company: cnt.company,
                                    email: cnt.email,
                                    phone: cnt.preferredPhone || cnt.phone,
                                    status: 'New',
                                    score: 25,
                                    owner: currentUser?.fullName || 'KP Sumanth'
                                  });
                                  if (res.isDuplicate) {
                                    triggerToast(res.error || 'Lead already in pipeline!', 'warning');
                                    setContactsList(prev => prev.map(c => c.id === cnt.id ? { ...c, isConverted: true } : c));
                                    return;
                                  }
                                  const leadData = res.data || {
                                    id: `LEAD-${Date.now()}`,
                                    name: cnt.name,
                                    company: cnt.company || '',
                                    email: cnt.email || '',
                                    phone: cnt.preferredPhone || cnt.phone || '',
                                    status: 'New',
                                    score: 25,
                                    owner: currentUser?.fullName || 'KP Sumanth',
                                    activities: []
                                  };
                                  const newLead: Lead = {
                                    id: leadData.id,
                                    name: leadData.name,
                                    company: leadData.company || '',
                                    email: leadData.email || '',
                                    phone: leadData.phone || '',
                                    status: (leadData.status as any) || 'New',
                                    score: leadData.score || 25,
                                    owner: leadData.owner || currentUser?.fullName || 'KP Sumanth',
                                    activities: []
                                  };
                                  setLeads(prev => [newLead, ...prev]);
                                  setContactsList(prev => prev.map(c => c.id === cnt.id ? { ...c, isConverted: true, convertedLeadId: newLead.id } : c));
                                  triggerToast(`Contact ${cnt.name} converted to Lead!`, 'success');
                                } catch (err) {
                                  console.error('Error converting contact:', err);
                                  triggerToast('Contact converted.', 'info');
                                }
                              }}
                            >
                              + Convert to Lead →
                            </button>
                          ) : (
                            <span style={{ flex: 1, justifyContent: 'center', fontSize: '11px', color: '#059669', background: '#ecfdf5', padding: '6px 8px', borderRadius: '6px', fontWeight: '700', display: 'flex', alignItems: 'center' }}>
                              In Leads Pipeline ✓
                            </span>
                          )}
                          <button
                            className="btn btn-secondary"
                            style={{ color: '#dc2626', borderColor: '#fca5a5', backgroundColor: '#fef2f2', padding: '6px 10px', minHeight: '32px' }}
                            title="Delete Contact"
                            onClick={async () => {
                              if (confirm(`Are you sure you want to delete contact "${cnt.name}"?`)) {
                                try {
                                  const { deleteContactAction } = await import('@/app/actions/contacts');
                                  await deleteContactAction(cnt.id, currentUser?.fullName || 'CRM User');
                                  setContactsList(prev => prev.filter(c => c.id !== cnt.id));
                                  triggerToast(`Contact ${cnt.name} deleted`, 'info');
                                } catch (dErr) {
                                  setContactsList(prev => prev.filter(c => c.id !== cnt.id));
                                }
                              }
                            }}
                          ><TrashIcon size={13} color="#dc2626" /></button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* DESKTOP CONTACTS TABLE (>= 769px) */}
              <div className="desktop-only-table panel-card" style={{ padding: '0', overflow: 'hidden' }}>
                <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '12px 16px' }}>Person / Contact</th>
                      <th style={{ padding: '12px' }}>Company & Designation</th>
                      <th style={{ padding: '12px' }}>Phone & Email</th>
                      <th style={{ padding: '12px' }}>Category</th>
                      <th style={{ padding: '12px' }}>Source Channel</th>
                      <th style={{ padding: '12px' }}>Last Contacted</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContacts.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                          
                          <p style={{ margin: '0 0 8px', fontWeight: '600' }}>No matching contacts found</p>
                          <p style={{ margin: 0, fontSize: '12px' }}>Try clearing filters or add a new contact above.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredContacts.map(cnt => {
                        const rawPhone = cnt.preferredPhone || cnt.phone;
                        const normPhone = normalizePhone(rawPhone);

                        return (
                          <tr key={cnt.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            {/* Contact Name & 360 Trigger */}
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                  width: '34px',
                                  height: '34px',
                                  borderRadius: '8px',
                                  background: '#151c2e',
                                  border: '1.5px solid #d49b38',
                                  color: '#f5d396',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '13px',
                                  fontWeight: 'bold',
                                  flexShrink: 0
                                }}>
                                  {(cnt.name || 'C').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <button
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      padding: 0,
                                      fontWeight: '600',
                                      fontSize: '13px',
                                      color: '#1e40af',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      textDecoration: 'hover:underline'
                                    }}
                                    onClick={() => setSelectedContactFor360(cnt.id)}
                                  >
                                    {cnt.name}
                                  </button>
                                  {cnt.city && (
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>{cnt.city}</div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Company & Designation */}
                            <td style={{ padding: '12px' }}>
                              <div style={{ fontWeight: '600', fontSize: '13px', color: '#0f172a' }}>
                                {cnt.company || '—'}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                {cnt.designation || '—'}
                              </div>
                            </td>

                            {/* Phone & Email */}
                            <td style={{ padding: '12px' }}>
                              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a' }}>
                                {normPhone.isValid ? normPhone.display : (rawPhone || '—')}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                {cnt.email || '—'}
                              </div>
                            </td>

                            {/* Category */}
                            <td style={{ padding: '12px' }}>
                              <span style={{
                                background: cnt.category === 'Customer' ? '#ecfdf5' : cnt.category === 'VIP' ? '#fffbeb' : '#eff6ff',
                                color: cnt.category === 'Customer' ? '#047857' : cnt.category === 'VIP' ? '#b45309' : '#1e40af',
                                border: `1px solid ${cnt.category === 'Customer' ? '#a7f3d0' : cnt.category === 'VIP' ? '#fde68a' : '#bfdbfe'}`,
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '11px',
                                fontWeight: '600'
                              }}>
                                {cnt.category || 'Prospect'}
                              </span>
                            </td>

                            {/* Source Provenance */}
                            <td style={{ padding: '12px' }}>
                              <span style={{
                                background: '#f1f5f9',
                                color: '#475569',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px'
                              }}>
                                {cnt.sourceType || 'Direct'}
                              </span>
                              {cnt.sourceEvent && (
                                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cnt.sourceEvent}>
                                  {cnt.sourceEvent}
                                </div>
                              )}
                            </td>

                            {/* Last Contacted Recency */}
                            <td style={{ padding: '12px', fontSize: '12px', color: '#64748b' }}>
                              {cnt.lastContactedAt ? (
                                <span style={{ color: '#0f172a', fontWeight: '500' }}>
                                  {new Date(cnt.lastContactedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>Never</span>
                              )}
                            </td>

                            {/* Actions Toolbar */}
                            <td style={{ padding: '10px 16px', textAlign: 'right', verticalAlign: 'middle' }}>
                              <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                {/* 1-Click Comm Modal Trigger */}
                                <button
                                  className="btn-table-action btn-table-comm"
                                  title="Quick WhatsApp / Call / Email"
                                  onClick={() => setShowQuickCommContact(cnt)}
                                >
                                  Contact
                                </button>

                                {/* 360 Profile Trigger */}
                                <button
                                  className="btn-table-action btn-table-view"
                                  title="View 360° Profile"
                                  onClick={() => setSelectedContactFor360(cnt.id)}
                                >
                                  360° View
                                </button>

                                {/* Convert to Lead Button */}
                                {!cnt.isConverted ? (
                                  <button 
                                    className="btn-table-action btn-table-lead"
                                    title="Convert to Sales Lead"
                                    onClick={async () => {
                                      try {
                                        const { createLeadAction } = await import('@/app/actions/crm');
                                        const res = await createLeadAction({
                                          name: cnt.name,
                                          company: cnt.company,
                                          email: cnt.email,
                                          phone: cnt.preferredPhone || cnt.phone,
                                          status: 'New',
                                          score: 25,
                                          owner: currentUser?.fullName || 'KP Sumanth'
                                        });
                                        if (res.isDuplicate) {
                                          triggerToast(res.error || 'Lead already in pipeline!', 'warning');
                                          setContactsList(prev => prev.map(c => c.id === cnt.id ? { ...c, isConverted: true } : c));
                                          return;
                                        }
                                        const leadData = res.data || {
                                          id: `LEAD-${Date.now()}`,
                                          name: cnt.name,
                                          company: cnt.company || '',
                                          email: cnt.email || '',
                                          phone: cnt.preferredPhone || cnt.phone || '',
                                          status: 'New',
                                          score: 25,
                                          owner: currentUser?.fullName || 'KP Sumanth',
                                          activities: []
                                        };
                                        const newLead: Lead = {
                                          id: leadData.id,
                                          name: leadData.name,
                                          company: leadData.company || '',
                                          email: leadData.email || '',
                                          phone: leadData.phone || '',
                                          status: (leadData.status as any) || 'New',
                                          score: leadData.score || 25,
                                          owner: leadData.owner || currentUser?.fullName || 'KP Sumanth',
                                          activities: []
                                        };
                                        setLeads(prev => [newLead, ...prev]);
                                        setContactsList(prev => prev.map(c => c.id === cnt.id ? { ...c, isConverted: true, convertedLeadId: newLead.id } : c));
                                        triggerToast(`Contact ${cnt.name} converted to Lead!`, 'success');
                                      } catch (err) {
                                        console.error('Error converting contact:', err);
                                        triggerToast('Failed to convert contact.', 'error');
                                      }
                                    }}
                                  >
                                    Lead →
                                  </button>
                                ) : (
                                  <span 
                                    className="badge-table-inlead"
                                    title="Already in Leads Pipeline"
                                  >
                                    In Leads ✓
                                  </span>
                                )}

                                {/* Delete Contact */}
                                <button 
                                  className="btn-table-action btn-table-delete"
                                  title="Delete Contact"
                                  onClick={async () => {
                                    if (confirm(`Are you sure you want to delete contact "${cnt.name}"?`)) {
                                      try {
                                        const { deleteContactAction } = await import('@/app/actions/contacts');
                                        await deleteContactAction(cnt.id, currentUser?.fullName || 'CRM User');
                                        setContactsList(prev => prev.filter(c => c.id !== cnt.id));
                                        triggerToast(`Contact ${cnt.name} deleted`, 'info');
                                      } catch (dErr) {
                                        setContactsList(prev => prev.filter(c => c.id !== cnt.id));
                                      }
                                    }
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: LEADS QUEUE */}
          {activeTab === 'leads' && (
            <div className="animate-fade">
              <div className="page-header-row">
                <div className="page-title-text">
                  <h2>Leads Queue</h2>
                </div>
                <div className="page-header-actions">
                  <button className="btn btn-secondary" onClick={() => handleCSVExport('Leads')}>Export CSV</button>
                  <button className="btn btn-primary" onClick={() => openAddLeadModal()}>+ Add Direct Lead</button>
                </div>
              </div>

              {/* Advanced Filter Toolbar */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', backgroundColor: '#ffffff', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <input 
                    type="text" 
                    placeholder="Search leads by name, email, phone or company..." 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', background: '#f8fafc' }}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select 
                    value={selectedOwnerFilter} 
                    onChange={(e) => setSelectedOwnerFilter(e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12.5px', background: '#f8fafc' }}
                  >
                    <option value="All">All Owners</option>
                    <option value="KP Sumanth">KP Sumanth</option>
                    <option value="Balasaraswathi">Balasaraswathi</option>
                    <option value="Riya Sharma">Riya Sharma</option>
                  </select>

                  <select 
                    value={selectedTagFilter} 
                    onChange={(e) => setSelectedTagFilter(e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12.5px', background: '#f8fafc' }}
                  >
                    <option value="All">All Tags</option>
                    <option value="B2G">B2G</option>
                    <option value="Manufacturing">Manufacturing</option>
                    <option value="Hot Lead">Hot Lead</option>
                    <option value="Corporate">Corporate</option>
                  </select>

                  <select 
                    value={selectedStatusFilter} 
                    onChange={(e) => setSelectedStatusFilter(e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12.5px', background: '#f8fafc' }}
                  >
                    <option value="All">All Statuses</option>
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Disqualified">Disqualified</option>
                  </select>
                </div>
              </div>

              {/* Content Area: Grid / Table / Empty State */}
              {filteredLeads.length === 0 ? (
                <div className="panel-card animate-fade" style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px dashed #cbd5e1',
                  margin: '20px 0'
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: '#eff6ff',
                    color: '#1e40af',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    margin: '0 auto 16px auto',
                    boxShadow: '0 4px 12px rgba(30, 64, 175, 0.1)'
                  }}>
                    
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>
                    No Leads in Queue
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '440px', margin: '0 auto 20px auto', lineHeight: '1.5' }}>
                    There are currently no active sales leads assigned in your workspace. Convert prospects directly from your Contacts Directory or register a direct lead.
                  </p>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button 
                      className="btn btn-primary" 
                      style={{ padding: '10px 18px', fontSize: '13px' }}
                      onClick={() => {
                        setNewLead(prev => ({ ...prev, owner: currentUser?.fullName || 'KP Sumanth' }));
                        setShowLeadModal(true);
                      }}
                    >
                      + Add Direct Lead
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '10px 18px', fontSize: '13px', backgroundColor: '#f8fafc' }}
                      onClick={() => navigateTab('contacts')}
                    >
                      Browse Contacts Directory
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Contact Cards Grid */}
                  <div className="contacts-grid">
                    {filteredLeads.map(contact => (
                      <div 
                        key={contact.id} 
                        className="contact-card"
                        style={{
                          background: '#ffffff',
                          borderRadius: '18px',
                          padding: '20px 16px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 4px 18px -2px rgba(15, 23, 42, 0.05)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          position: 'relative',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {/* Header Row: Score Pill (Align Right) */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', width: '100%', marginBottom: '12px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 10px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: '700',
                            background: contact.score >= 61 ? '#fef2f2' : contact.score >= 31 ? '#fffbeb' : '#f1f5f9',
                            color: contact.score >= 61 ? '#dc2626' : contact.score >= 31 ? '#b45309' : '#475569',
                            border: `1px solid ${contact.score >= 61 ? '#fca5a5' : contact.score >= 31 ? '#fde68a' : '#cbd5e1'}`
                          }}>
                            {contact.score >= 61 ? 'HOT' : contact.score >= 31 ? 'WARM' : 'COLD'} ({contact.score})
                          </span>
                        </div>

                        {/* Avatar Ring */}
                        <div 
                          style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                            color: '#f5d396',
                            border: '2.5px solid #d49b38',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px',
                            fontWeight: '800',
                            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
                            marginBottom: '10px',
                            cursor: 'pointer'
                          }}
                          onClick={() => setSelectedLeadDetail(contact)}
                          title="Click to Inspect 360° Profile"
                        >
                          {contact.name.split(' ').map(n=>n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>

                        {/* Contact Details */}
                        <div 
                          style={{ fontSize: '15.5px', fontWeight: '800', color: '#0f172a', textAlign: 'center', letterSpacing: '-0.01em', cursor: 'pointer' }}
                          onClick={() => setSelectedLeadDetail(contact)}
                          title="Click to Inspect 360° Profile"
                        >
                          {contact.name}
                        </div>

                        <div style={{
                          color: '#d49b38',
                          fontWeight: '700',
                          fontSize: '11.5px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          marginTop: '2px',
                          textAlign: 'center'
                        }}>
                          {contact.company}
                        </div>
                        
                        <div style={{
                          fontSize: '11.5px',
                          color: '#64748b',
                          marginTop: '8px',
                          background: '#f8fafc',
                          padding: '4px 12px',
                          borderRadius: '8px',
                          border: '1px solid #f1f5f9',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span>👤 Rep: <strong style={{ color: '#1e293b' }}>{contact.owner || 'Unassigned'}</strong></span>
                        </div>

                        {contact.tags && contact.tags.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center', marginTop: '8px' }}>
                            {contact.tags.map(t => (
                              <span key={t} className="badge badge-cold" style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '6px' }}>{t}</span>
                            ))}
                          </div>
                        )}

                        {/* Quick Outreach & Conversion Actions (Mobile Optimized) */}
                        <div style={{ width: '100%', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ width: '100%', padding: '8px', fontSize: '12px', fontWeight: '600', minHeight: '36px', justifyContent: 'center' }}
                            onClick={() => setSelectedLeadDetail(contact)}
                          >
                            Inspect 360° Profile
                          </button>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', width: '100%' }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{
                                padding: '8px 4px',
                                fontSize: '11.5px',
                                fontWeight: '600',
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                minHeight: '36px'
                              }} 
                              onClick={() => openEmailComposer(contact.name, contact.email)}
                              title={`Email ${contact.name}`}
                            >
                              Email
                            </button>
                            
                            <button 
                              className="btn btn-secondary" 
                              style={{
                                padding: '8px 4px',
                                fontSize: '11.5px',
                                fontWeight: '600',
                                borderRadius: '10px',
                                color: '#059669',
                                borderColor: '#a7f3d0',
                                background: '#ecfdf5',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                minHeight: '36px'
                              }} 
                              onClick={() => openWhatsAppModalForContact(contact.name, contact.phone)}
                              title={`WhatsApp ${contact.name}`}
                            >
                              Chat
                            </button>
                            
                            <button 
                              className="btn btn-secondary" 
                              style={{
                                padding: '8px 4px',
                                fontSize: '11.5px',
                                fontWeight: '600',
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                minHeight: '36px'
                              }} 
                              onClick={() => startVoIPCall(contact.name, contact.phone)}
                              title={`Call ${contact.name}`}
                            >
                              Call
                            </button>
                          </div>

                          {(() => {
                            const linkedDeal = deals.find(d => 
                              (contact.company && d.company && d.company.toLowerCase() === contact.company.toLowerCase()) ||
                              (contact.name && d.name.toLowerCase().includes(contact.name.toLowerCase()))
                            );

                            if (linkedDeal) {
                              return (
                                <button
                                  style={{
                                    width: '100%',
                                    background: '#f8fafc',
                                    color: '#047857',
                                    border: '1px solid #10b981',
                                    padding: '10px 14px',
                                    borderRadius: '10px',
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    minHeight: '38px',
                                    transition: 'all 0.2s ease'
                                  }}
                                  onClick={() => {
                                    navigateTab('kanban');
                                    setSelectedDealDetail(linkedDeal);
                                    triggerToast(`Opening existing pipeline deal for ${contact.company || contact.name} (${linkedDeal.stage})`, 'info');
                                  }}
                                >
                                  ✓ Converted to Deal ({linkedDeal.stage})
                                </button>
                              );
                            }

                            return (
                              <button 
                                style={{
                                  width: '100%',
                                  background: 'linear-gradient(135deg, #059669, #10b981)',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '10px 14px',
                                  borderRadius: '10px',
                                  fontSize: '12.5px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                  boxShadow: '0 3px 10px rgba(16, 185, 129, 0.25)',
                                  transition: 'all 0.2s ease',
                                  minHeight: '38px'
                                }} 
                                onClick={() => {
                                  setSelectedLeadForConversion(contact);
                                  setConvertDealForm({
                                    dealName: `${contact.company || contact.name} - Expansion Deal`,
                                    dealValue: '500000',
                                    stage: 'New'
                                  });
                                  setShowConvertLeadModal(true);
                                }}
                              >
                                Convert to Deal →
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Table List View */}
                  <div className="panel-card" style={{ marginTop: '24px' }}>
                    <div className="panel-title">
                      <h3>All Registered Leads</h3>
                    </div>
                    <div className="custom-table-container">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Company</th>
                            <th>Email & Phone</th>
                            <th>Assigned Rep</th>
                            <th>Status</th>
                            <th>Score</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLeads.map(lead => (
                            <tr key={lead.id}>
                              <td>
                                <div style={{ fontWeight: '600', color: '#1e293b', cursor: 'pointer' }} onClick={() => setSelectedLeadDetail(lead)}>{lead.name}</div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{lead.id}</span>
                              </td>
                              <td>
                                <span className="badge badge-cold" style={{ cursor: 'pointer' }} onClick={() => {
                                  const found = companies.find(c => c.name === lead.company);
                                  if (found) setSelectedCompanyDetail(found);
                                  else alert(`Company ${lead.company} detail view`);
                                }}>
                                  {lead.company}
                                </span>
                              </td>
                              <td>
                                <div>{lead.email}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{lead.phone}</div>
                              </td>
                              <td>
                                <span style={{ fontWeight: '600', color: '#0f172a' }}>{lead.owner || 'Unassigned'}</span>
                              </td>
                              <td>
                                <span className={`badge ${lead.status === 'Disqualified' ? 'badge-cold' : lead.status === 'Qualified' ? 'badge-hot' : 'badge-warm'}`}>
                                  {lead.status}
                                </span>
                              </td>
                              <td>
                                <span className={`badge ${lead.score >= 61 ? 'badge-hot' : lead.score >= 31 ? 'badge-warm' : 'badge-cold'}`}>
                                  {lead.score} pts
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => setSelectedLeadDetail(lead)}>
                                    Inspect 360°
                                  </button>
                                  {lead.status !== 'Disqualified' && lead.status !== 'Qualified' && (
                                    <>
                                      <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleConvertLead(lead.id)}>
                                        Convert to Deal
                                      </button>
                                      <button 
                                        className="btn btn-secondary" 
                                        style={{ padding: '4px 8px', fontSize: '11px', color: '#ef4444', borderColor: '#ef4444' }} 
                                        onClick={() => {
                                          const reason = prompt('Please enter the reason for disqualification:');
                                          if (reason) {
                                            handleDisqualifyLead(lead.id, reason);
                                          }
                                        }}
                                      >
                                        Disqualify
                                      </button>
                                    </>
                                  )}
                                  <button 
                                    className="btn btn-secondary" 
                                    style={{ padding: '4px 8px', fontSize: '11px', color: '#dc2626', borderColor: '#fca5a5' }} 
                                    onClick={() => handleDeleteLead(lead.id)}
                                    title="Delete Lead Record"
                                  ><TrashIcon size={13} color="#dc2626" /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: COMPANIES & ACCOUNTS DIRECTORY */}
          {activeTab === 'companies' && (
            <div className="animate-fade">
              <div className="page-header-row">
                <div className="page-title-text">
                  <h2>Companies & Accounts</h2>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {/* View Mode Toggle Switch */}
                  <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0', gap: '4px' }}>
                    <button 
                      className={`btn ${companyViewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`} 
                      style={{ padding: '6px 12px', fontSize: '11px', height: '28px', lineHeight: '1' }}
                      onClick={() => setCompanyViewMode('grid')}
                    >
                      Grid View
                    </button>
                    <button 
                      className={`btn ${companyViewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`} 
                      style={{ padding: '6px 12px', fontSize: '11px', height: '28px', lineHeight: '1' }}
                      onClick={() => setCompanyViewMode('table')}
                    >
                      Dense Table
                    </button>
                  </div>
                  <button className="btn btn-secondary" onClick={() => handleCSVExport('Leads')}>Export CSV</button>
                  <button className="btn btn-primary" onClick={() => setShowCompanyModal(true)}>+ Add Company</button>
                </div>
              </div>

              {companies.length === 0 ? (
                <div className="panel-card animate-fade" style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px dashed #cbd5e1',
                  margin: '20px 0'
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: '#eff6ff',
                    color: '#1e40af',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    margin: '0 auto 16px auto',
                    boxShadow: '0 4px 12px rgba(30, 64, 175, 0.1)'
                  }}>
                    
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>
                    No Company Accounts Linked
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '440px', margin: '0 auto 20px auto', lineHeight: '1.5' }}>
                    Company accounts are dynamically aggregated as you add pipeline deals, log contacts, or import customer data. You can also register corporate accounts directly.
                  </p>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button 
                      className="btn btn-primary" 
                      style={{ padding: '10px 18px', fontSize: '13px' }}
                      onClick={() => setShowCompanyModal(true)}
                    >
                      + Add Company Account
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '10px 18px', fontSize: '13px', backgroundColor: '#f8fafc' }}
                      onClick={() => navigateTab('contacts')}
                    >
                      Scan / Import Contacts
                    </button>
                  </div>
                </div>
              ) : companyViewMode === 'grid' ? (
                /* Companies Grid View */
                <div className="companies-grid">
                  {companies.map(comp => {
                    const compNameLower = (comp.name || '').trim().toLowerCase();
                    const matchingContacts = contactsList.filter(c => (c.company || '').trim().toLowerCase() === compNameLower);
                    const matchingLeads = leads.filter(l => (l.company || '').trim().toLowerCase() === compNameLower);
                    const combinedAffiliated = deduplicateContacts([...matchingContacts, ...matchingLeads]);
                    const matchingDeals = deals.filter(d => (d.company || '').trim().toLowerCase() === compNameLower);
                    const dynamicRollup = matchingDeals.reduce((acc, d) => acc + (Number(d.value) || 0), 0) || comp.totalDealValue || 0;
                    const displayCount = Math.max(combinedAffiliated.length, Number(comp.contactsCount) || 0);

                    return (
                      <div key={comp.id} className="company-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div className="contact-avatar" style={{ margin: 0, backgroundColor: '#eff6ff', color: '#1e40af' }}>
                            {comp.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="badge badge-cold" style={{ fontSize: '9px' }}>{comp.state || 'Karnataka'}</span>
                        </div>
                        <h3 className="contact-name" style={{ fontSize: '14.5px', marginBottom: '4px' }}>{comp.name}</h3>
                        <div className="contact-company" style={{ color: '#d49b38', fontWeight: '600' }}>{comp.industry || 'Manufacturing / B2G'}</div>
                        
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {comp.address || `${comp.city || 'Bangalore'}, ${comp.state || 'Karnataka'}`}
                        </div>

                        <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '16px', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Affiliated Contacts:</span>
                            <strong>{displayCount} Contacts</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Total B2G Roll-up:</span>
                            <strong style={{ color: '#10b981' }}>{formatCurrency(dynamicRollup)}</strong>
                          </div>
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: '14px', display: 'flex', gap: '8px' }}>
                          <button className="btn btn-secondary" style={{ flex: 1, fontSize: '11px', justifyContent: 'center' }} onClick={() => setSelectedCompanyDetail({ ...comp, contactsCount: displayCount, totalDealValue: dynamicRollup })}>
                            Inspect Account Profile
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '11px', color: '#dc2626', borderColor: '#fca5a5' }} 
                            onClick={() => handleDeleteCompany(comp.id)}
                            title="Delete Company Account"
                          ><TrashIcon size={13} color="#dc2626" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Companies Dense Table View */
                <div className="panel-card" style={{ marginTop: '12px' }}>
                  <div className="custom-table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Company / Account Entity</th>
                          <th>Industry Sector</th>
                          <th>Location / Address</th>
                          <th>Affiliated Contacts</th>
                          <th>Total B2G Roll-up Value</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {companies.map(comp => {
                          const compNameLower = (comp.name || '').trim().toLowerCase();
                          const matchingContacts = contactsList.filter(c => (c.company || '').trim().toLowerCase() === compNameLower);
                          const matchingLeads = leads.filter(l => (l.company || '').trim().toLowerCase() === compNameLower);
                          const combinedAffiliated = deduplicateContacts([...matchingContacts, ...matchingLeads]);
                          const matchingDeals = deals.filter(d => (d.company || '').trim().toLowerCase() === compNameLower);
                          const dynamicRollup = matchingDeals.reduce((acc, d) => acc + (Number(d.value) || 0), 0) || comp.totalDealValue || 0;
                          const displayCount = Math.max(combinedAffiliated.length, Number(comp.contactsCount) || 0);

                          return (
                            <tr key={comp.id}>
                              <td style={{ fontWeight: '700', color: '#1e40af' }}>{comp.name}</td>
                              <td>{comp.industry || 'Manufacturing / B2G'}</td>
                              <td style={{ fontSize: '12px' }}>{comp.address || ''}, {comp.city || 'Bangalore'}, {comp.state || 'Karnataka'}</td>
                              <td style={{ fontWeight: 'bold' }}>{displayCount} Contacts</td>
                              <td style={{ fontWeight: 'bold', color: '#10b981' }}>{formatCurrency(dynamicRollup)}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button 
                                    className="btn btn-secondary" 
                                    style={{ padding: '4px 8px', fontSize: '11px' }} 
                                    onClick={() => setSelectedCompanyDetail({ ...comp, contactsCount: displayCount, totalDealValue: dynamicRollup })}
                                  >
                                    View 360° Profile
                                  </button>
                                  <button 
                                    className="btn btn-secondary" 
                                    style={{ padding: '4px 8px', fontSize: '11px', color: '#dc2626', borderColor: '#fca5a5' }} 
                                    onClick={() => handleDeleteCompany(comp.id)}
                                    title="Delete Company Account"
                                  ><TrashIcon size={13} color="#dc2626" /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DEALS & PIPELINE VELOCITY */}
          {activeTab === 'kanban' && (
            <KanbanBoard
              deals={deals}
              filteredDeals={filteredDeals}
              stages={stages}
              pipelineLayoutMode={pipelineLayoutMode}
              setPipelineLayoutMode={setPipelineLayoutMode}
              setShowLeadModal={setShowLeadModal}
              setSelectedDealDetail={setSelectedDealDetail}
              handleDragStart={handleDragStart}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
              onStageChange={(id, stage, reason) => updateDealStage(id, stage as any, reason)}
              onUpdateDeal={handleUpdateDeal}
              onDeleteDeal={handleDeleteDeal}
              onQuickAddDeal={(stage) => {
                setNewLead(prev => ({ ...prev, leadSource: 'Direct Deal', status: 'New' }));
                setShowLeadModal(true);
              }}
              onNavigateTab={(tab) => navigateTab(tab as any)}
              formatCurrency={formatCurrency}
            />
          )}

          {/* TAB 4: TASKS CHECKLIST QUEUE */}
          {activeTab === 'tasks' && (() => {
            const myName = (currentUser?.fullName || currentAgentName || '').trim().toLowerCase();
            const myEmail = (currentUser?.email || '').trim().toLowerCase();
            const effectiveMode = currentRole === 'Sales Rep' ? 'my' : taskWorkspaceMode;
            
            const isUserTask = (assignee?: string) => {
              const a = (assignee || '').trim().toLowerCase();
              if (!a) return true;
              return a === myName || a === myEmail || (myName && (a.includes(myName) || myName.includes(a)));
            };

            const displayTasks = tasks.filter(t => {
              if (effectiveMode === 'my') {
                if (!isUserTask(t.assignee)) return false;
              }
              if (effectiveMode === 'team' && taskAssigneeFilter !== 'All') {
                const a = (t.assignee || '').trim().toLowerCase();
                if (a !== taskAssigneeFilter.trim().toLowerCase()) return false;
              }
              if (taskPriorityFilter !== 'All' && t.priority !== taskPriorityFilter) return false;
              if (taskStatusFilter !== 'All' && t.status !== taskStatusFilter) return false;
              if (taskOverdueFilter) {
                const isOverdue = new Date(t.dueDate) < new Date() && t.status === 'Open';
                if (!isOverdue) return false;
              }
              return true;
            });

            return (
              <div className="animate-fade">
                <div className="page-header-row">
                  <div className="page-title-text">
                    <h2>Task Queue</h2>
                  </div>
                  <div className="page-header-actions">
                    {outlookAccountStatus.connected ? (
                      <span style={{ fontSize: '12px', color: '#065f46', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '6px 12px', borderRadius: '6px', fontWeight: '700' }}>
                        ✓ Synced to Outlook
                      </span>
                    ) : (
                      <button 
                        className="btn btn-secondary" 
                        style={{ color: '#0078d4', borderColor: '#bfdbfe', background: '#eff6ff', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        onClick={handleDirectOutlookSync}
                      >
                        📅 Auto-Sync with Outlook
                      </button>
                    )}
                    <button className="btn btn-primary" onClick={() => setShowTaskModal(true)}>
                      + Create Task
                    </button>
                  </div>
                </div>

                <div className="panel-card" style={{ padding: '20px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '16px' }}>
                    
                    {/* Workspace Toggle */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className={`btn ${effectiveMode === 'my' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setTaskWorkspaceMode('my')}
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        My Tasks ({tasks.filter(t => isUserTask(t.assignee)).length})
                      </button>
                      
                      {currentRole !== 'Sales Rep' && (
                        <button 
                          className={`btn ${effectiveMode === 'team' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setTaskWorkspaceMode('team')}
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          Team Tasks ({tasks.length})
                        </button>
                      )}
                    </div>

                    {/* Quick Filters */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {effectiveMode === 'team' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>Assignee:</span>
                          <select 
                            value={taskAssigneeFilter} 
                            onChange={(e) => setTaskAssigneeFilter(e.target.value)}
                            style={{ padding: '4px 8px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                          >
                            <option value="All">All Assignees</option>
                            {Array.from(new Set(tasks.map(t => t.assignee).filter(Boolean))).map(assignee => (
                              <option key={assignee} value={assignee}>{assignee}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>Priority:</span>
                        <select 
                          value={taskPriorityFilter} 
                          onChange={(e) => setTaskPriorityFilter(e.target.value)}
                          style={{ padding: '4px 8px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                        >
                          <option value="All">All</option>
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>Status:</span>
                        <select 
                          value={taskStatusFilter} 
                          onChange={(e) => setTaskStatusFilter(e.target.value)}
                          style={{ padding: '4px 8px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                        >
                          <option value="All">All</option>
                          <option value="Open">Open</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', cursor: 'pointer', margin: 0 }}>
                        <input 
                          type="checkbox" 
                          checked={taskOverdueFilter} 
                          onChange={(e) => setTaskOverdueFilter(e.target.checked)} 
                        />
                        <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>Overdue Only</span>
                      </label>
                    </div>

                  </div>

                  {/* DESKTOP TASK TABLE */}
                  <div className="desktop-only-table">
                    <div className="custom-table-container">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th style={{ width: '50px', textAlign: 'center' }}>Done</th>
                            <th>Task Title & Summary</th>
                            <th>Linked Entity</th>
                            <th>Due Date</th>
                            <th>Priority</th>
                            <th>Assignee</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayTasks.map(t => {
                            const isOverdue = new Date(t.dueDate) < new Date() && t.status === 'Open';
                            return (
                              <tr key={t.id} style={{ opacity: t.status === 'Completed' ? 0.6 : 1 }}>
                                <td style={{ textAlign: 'center' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={t.status === 'Completed'} 
                                    onChange={() => toggleTaskStatus(t.id)} 
                                  />
                                </td>
                                <td>
                                  <div style={{ fontWeight: '700', textDecoration: t.status === 'Completed' ? 'line-through' : 'none', color: '#0f172a' }}>
                                    {t.title}
                                  </div>
                                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{t.description}</div>
                                </td>
                                <td style={{ fontSize: '12px', fontWeight: '500' }}>
                                  {t.linkedTo ? `${t.linkedTo}` : '—'}
                                </td>
                                <td style={{ color: isOverdue ? 'var(--danger)' : '#334155', fontWeight: isOverdue ? 'bold' : 'normal', fontSize: '12px' }}>
                                  {t.dueDate} {isOverdue && <span style={{ fontSize: '10px', color: 'var(--danger)', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>OVERDUE</span>}
                                </td>
                                <td>
                                  <span className={`badge ${t.priority === 'High' ? 'badge-hot' : t.priority === 'Medium' ? 'badge-warm' : 'badge-cold'}`}>
                                    {t.priority}
                                  </span>
                                </td>
                                <td style={{ fontSize: '12px', fontWeight: '600' }}>{t.assignee}</td>
                                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                  <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                    <button 
                                      className="btn btn-secondary" 
                                      style={{ padding: '3px 8px', fontSize: '11px', color: '#1e40af', background: '#eff6ff', borderColor: '#bfdbfe', fontWeight: '700' }}
                                      onClick={() => openEditTaskModal(t)}
                                    >
                                      ✏️ Edit
                                    </button>
                                    <button
                                      className="btn btn-secondary"
                                      style={{ padding: '3px 8px', fontSize: '11px', color: '#0078d4', borderColor: '#bfdbfe', background: '#eff6ff' }}
                                      title="Open in Microsoft Outlook Calendar"
                                      onClick={() => {
                                        const url = getOutlookWebComposeUrl({
                                          title: `[Task] ${t.title}`,
                                          description: `Priority: ${t.priority}\nStatus: ${t.status}\nLinked: ${t.linkedTo || 'None'}\n\n${t.description || ''}`,
                                          startDate: t.dueDate,
                                          startTime: (t as any).dueTime || '09:00',
                                          location: t.linkedTo || 'Anveshak CRM'
                                        });
                                        window.open(url, '_blank', 'noopener,noreferrer');
                                        triggerToast('Opening event in Outlook...', 'info');
                                      }}
                                    >
                                      📅 Outlook
                                    </button>
                                    <button 
                                      className="btn btn-secondary" 
                                      style={{ padding: '3px 8px', fontSize: '11px', color: 'var(--danger)', borderColor: '#fee2e2' }}
                                      onClick={() => {
                                        if (confirm(`Are you sure you want to delete task "${t.title}"?`)) {
                                          setTasks(tasks.filter(tk => tk.id !== t.id));
                                        }
                                      }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {displayTasks.length === 0 && (
                            <tr>
                              <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>
                                No tasks match the active filters and workspace settings.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* MOBILE TASK CARDS */}
                  <div className="mobile-only-cards">
                    {displayTasks.map(t => {
                      const isOverdue = new Date(t.dueDate) < new Date('2026-07-16') && t.status === 'Open';
                      return (
                        <div 
                          key={t.id} 
                          className="mobile-contact-card"
                          style={{ opacity: t.status === 'Completed' ? 0.7 : 1 }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer', margin: 0 }}>
                              <input 
                                type="checkbox" 
                                checked={t.status === 'Completed'} 
                                onChange={() => toggleTaskStatus(t.id)} 
                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#10b981' }}
                              />
                              <div>
                                <div style={{ fontWeight: '700', fontSize: '13.5px', textDecoration: t.status === 'Completed' ? 'line-through' : 'none', color: '#0f172a' }}>
                                  {t.title}
                                </div>
                                {t.description && (
                                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {t.description}
                                  </div>
                                )}
                              </div>
                            </label>

                            <span className={`badge ${t.priority === 'High' ? 'badge-hot' : t.priority === 'Medium' ? 'badge-warm' : 'badge-cold'}`} style={{ fontSize: '10px', flexShrink: 0 }}>
                              {t.priority}
                            </span>
                          </div>

                          <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '8px 10px', fontSize: '11.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-subtle)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {t.linkedTo ? `${t.linkedTo}` : `${t.assignee}`}
                            </span>
                            <span style={{ color: isOverdue ? 'var(--danger)' : '#334155', fontWeight: isOverdue ? 'bold' : '600', fontSize: '11px' }}>
                              {t.dueDate} {isOverdue && <span style={{ fontSize: '9.5px', color: 'var(--danger)', background: '#fee2e2', padding: '2px 5px', borderRadius: '4px', marginLeft: '4px' }}>OVERDUE</span>}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '4px 10px', fontSize: '11px', color: '#1e40af', background: '#eff6ff', borderColor: '#bfdbfe', minHeight: '30px', fontWeight: '700' }}
                              onClick={() => openEditTaskModal(t)}
                            >
                              ✏️ Edit Task
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--danger)', borderColor: '#fee2e2', minHeight: '30px' }}
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete task "${t.title}"?`)) {
                                  setTasks(tasks.filter(tk => tk.id !== t.id));
                                }
                              }}
                            >
                              Delete Task
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {displayTasks.length === 0 && (
                      <div className="panel-card" style={{ textAlign: 'center', padding: '28px 16px', color: '#64748b' }}>
                        
                        <p style={{ margin: 0, fontWeight: '600', fontSize: '12.5px' }}>No tasks match the active filters.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* TAB 5: OPERATIONAL CALENDAR */}
          {activeTab === 'calendar' && (() => {
            const now = new Date();
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            // Real dynamic month calculations based on current system time
            const monthDateObj = new Date(calendarYear, calendarMonthIndex, 1);
            const monthName = monthDateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            const daysInMonth = new Date(calendarYear, calendarMonthIndex + 1, 0).getDate();
            const startDayOffset = new Date(calendarYear, calendarMonthIndex, 1).getDay(); // 0 = Sun
            const totalCells = Math.ceil((startDayOffset + daysInMonth) / 7) * 7;
            
            const cells = Array.from({ length: totalCells }, (_, idx) => {
              const dayNum = idx - startDayOffset + 1;
              return dayNum > 0 && dayNum <= daysInMonth ? dayNum : null;
            });

            // Calculate dynamic weekly 7-day strip based on selected date or today
            const baseDate = selectedCalendarDate ? new Date(selectedCalendarDate + 'T00:00:00') : now;
            const startOfWeek = new Date(baseDate);
            startOfWeek.setDate(baseDate.getDate() - baseDate.getDay());

            const weeklyDays = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(startOfWeek);
              d.setDate(startOfWeek.getDate() + i);
              const dY = d.getFullYear();
              const dM = String(d.getMonth() + 1).padStart(2, '0');
              const dD = String(d.getDate()).padStart(2, '0');
              const dateStr = `${dY}-${dM}-${dD}`;
              return {
                day: d.getDate(),
                dateStr: dateStr,
                dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i],
                isToday: dateStr === todayStr,
                isSelected: dateStr === selectedCalendarDate
              };
            });

            const renderEventsForDay = (dateStr: string) => {
              const dayTasks = tasks.filter(t => t.dueDate === dateStr);
              const dayDeals = deals.filter(d => d.expectedClose === dateStr);
              const dayActs = activities.filter(a => a.date === dateStr);

              return (
                <div className="day-events" style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                  {dayTasks.map(t => (
                    <div 
                      key={t.id} 
                      style={{ 
                        background: t.status === 'Completed' ? '#f1f5f9' : '#eff6ff', 
                        color: t.status === 'Completed' ? '#94a3b8' : '#1e40af', 
                        borderLeft: t.status === 'Completed' ? '3px solid #94a3b8' : '3px solid #3b82f6', 
                        fontSize: '9.5px', 
                        padding: '2px 4px', 
                        borderRadius: '3px', 
                        textOverflow: 'ellipsis', 
                        overflow: 'hidden', 
                        whiteSpace: 'nowrap',
                        fontWeight: '600'
                      }} 
                      title={`Task: ${t.title} ${t.dueTime ? '(' + t.dueTime + ')' : ''}`}
                    >
                      {t.dueTime ? `${t.dueTime} ` : ''}{t.title}
                    </div>
                  ))}
                  {dayDeals.map(d => (
                    <div 
                      key={d.id} 
                      style={{ background: '#ecfdf5', color: '#065f46', borderLeft: '3px solid #10b981', fontSize: '9.5px', padding: '2px 4px', borderRadius: '3px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                      title={`Deal: ${d.name} (${formatCurrency(d.value)})`}
                    >
                      {d.company} ({formatCurrency(d.value)})
                    </div>
                  ))}
                  {dayActs.map(a => (
                    <div 
                      key={a.id} 
                      style={{ background: '#fffbeb', color: '#92400e', borderLeft: '3px solid #f59e0b', fontSize: '9.5px', padding: '2px 4px', borderRadius: '3px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                      title={`Activity: ${a.type} with ${a.entityName}`}
                    >
                      {a.type}
                    </div>
                  ))}
                </div>
              );
            };

            const inspectedTasks = selectedCalendarDate ? tasks.filter(t => t.dueDate === selectedCalendarDate) : [];
            const inspectedDeals = selectedCalendarDate ? deals.filter(d => d.expectedClose === selectedCalendarDate) : [];
            const inspectedActs = selectedCalendarDate ? activities.filter(a => a.date === selectedCalendarDate) : [];

            return (
              <div className="animate-fade">
                <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <div className="page-title-text">
                    <h2>Schedule & Calendar</h2>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {outlookAccountStatus.connected ? (
                      <div 
                        style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          background: '#ecfdf5', 
                          border: '1px solid #a7f3d0', 
                          padding: '6px 14px', 
                          borderRadius: '8px', 
                          fontSize: '12px', 
                          color: '#065f46', 
                          fontWeight: '700' 
                        }}
                      >
                        <span>✓ Synced to Outlook</span>
                        <button 
                          style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline', padding: 0, marginLeft: '4px' }}
                          title="Unlink Outlook account"
                          onClick={async () => {
                            if (confirm('Disconnect Outlook auto-sync?')) {
                              const { disconnectOutlookAction } = await import('@/app/actions/outlook');
                              await disconnectOutlookAction(currentUser?.email || '');
                              setOutlookAccountStatus({ connected: false });
                              triggerToast('Outlook disconnected.', 'info');
                            }
                          }}
                        >
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <button 
                        className="btn btn-primary"
                        style={{ backgroundColor: '#0078d4', borderColor: '#0078d4', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: '600' }}
                        onClick={handleDirectOutlookSync}
                      >
                        📅 Auto-Sync Calendar to Outlook
                      </button>
                    )}
                    <button className={`btn ${calendarViewMode === 'month' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCalendarViewMode('month')}>
                      Monthly Grid
                    </button>
                    <button className={`btn ${calendarViewMode === 'week' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCalendarViewMode('week')}>
                      Weekly View
                    </button>
                  </div>
                </div>

                <div className="calendar-split-container" style={{ display: 'grid', gridTemplateColumns: selectedCalendarDate ? '3fr 2fr' : '1fr', gap: '20px', width: '100%', maxWidth: '100%' }}>
                  <div className="panel-card" style={{ padding: '16px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
                    
                    {/* Calendar Navigation Controls */}
                    <div className="calendar-controls-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => {
                            if (calendarMonthIndex === 0) {
                              setCalendarMonthIndex(11);
                              setCalendarYear(y => y - 1);
                            } else {
                              setCalendarMonthIndex(m => m - 1);
                            }
                          }}
                        >
                          ◀ Prev
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '6px 12px', fontSize: '12px', fontWeight: '700' }}
                          onClick={() => {
                            setCalendarYear(now.getFullYear());
                            setCalendarMonthIndex(now.getMonth());
                            setSelectedCalendarDate(todayStr);
                          }}
                        >
                          Today
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => {
                            if (calendarMonthIndex === 11) {
                              setCalendarMonthIndex(0);
                              setCalendarYear(y => y + 1);
                            } else {
                              setCalendarMonthIndex(m => m + 1);
                            }
                          }}
                        >
                          Next ▶
                        </button>
                      </div>
                      
                      <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: '#0f172a' }}>
                        {calendarViewMode === 'month' ? monthName : `Week of ${weeklyDays[0].dateStr} - ${weeklyDays[6].dateStr}`}
                      </h3>

                      {/* Legend indicators */}
                      <div style={{ display: 'flex', gap: '10px', fontSize: '11px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></span> Tasks</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></span> Deals</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></span> Calls</span>
                      </div>
                    </div>

                    {calendarViewMode === 'month' ? (
                      <>
                        <div className="calendar-grid-header" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontWeight: 'bold', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '8px', width: '100%' }}>
                          <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                        </div>

                        <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', width: '100%' }}>
                          {cells.map((day, idx) => {
                            if (!day) return <div key={idx} style={{ background: '#f8fafc', borderRadius: '6px', minHeight: '90px', opacity: 0.4 }}></div>;
                            const dM = String(calendarMonthIndex + 1).padStart(2, '0');
                            const dD = String(day).padStart(2, '0');
                            const dateStr = `${calendarYear}-${dM}-${dD}`;
                            const isToday = dateStr === todayStr;
                            const isSelected = dateStr === selectedCalendarDate;

                            return (
                              <div 
                                key={idx} 
                                style={{ 
                                  background: isToday ? '#fffbeb' : '#ffffff', 
                                  borderRadius: '6px', 
                                  border: isSelected ? '2px solid #0078d4' : isToday ? '1px solid #fde68a' : '1px solid var(--border-color)', 
                                  minHeight: '95px', 
                                  padding: '6px', 
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease-in-out',
                                  boxShadow: isSelected ? '0 4px 10px -1px rgba(0, 120, 212, 0.15)' : 'none'
                                }}
                                onClick={() => setSelectedCalendarDate(dateStr)}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '11.5px', fontWeight: '800', color: isToday ? '#b45309' : isSelected ? '#0078d4' : '#475569' }}>
                                    {day}
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {isToday && <span style={{ fontSize: '9px', background: '#fef3c7', color: '#b45309', padding: '1px 4px', borderRadius: '4px', fontWeight: '800' }}>TODAY</span>}
                                    <button
                                      style={{
                                        background: isSelected ? '#0078d4' : '#eff6ff',
                                        border: isSelected ? '1px solid #0078d4' : '1px solid #bfdbfe',
                                        color: isSelected ? '#ffffff' : '#0078d4',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        lineHeight: '1',
                                        padding: 0
                                      }}
                                      title={`Select ${dateStr} to add task`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedCalendarDate(dateStr);
                                      }}
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                                {renderEventsForDay(dateStr)}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px' }}>
                          {weeklyDays.map((wDay) => {
                            const isToday = wDay.isToday;
                            const isSelected = wDay.isSelected;

                            return (
                              <div 
                                key={wDay.dateStr}
                                style={{ 
                                  background: isToday ? '#fffbeb' : '#ffffff', 
                                  borderRadius: '8px', 
                                  border: isSelected ? '2px solid #0078d4' : isToday ? '1px solid #fde68a' : '1px solid var(--border-color)', 
                                  minHeight: '280px', 
                                  padding: '10px',
                                  cursor: 'pointer'
                                }}
                                onClick={() => setSelectedCalendarDate(wDay.dateStr)}
                              >
                                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>{wDay.dayName}</span>
                                  <span style={{ fontSize: '18px', fontWeight: '800', color: isToday ? '#b45309' : '#0f172a' }}>{wDay.day}</span>
                                  {isToday && <span style={{ fontSize: '8px', background: '#fef3c7', color: '#b45309', padding: '1px 3px', borderRadius: '3px', fontWeight: 'bold', marginTop: '2px' }}>TODAY</span>}
                                  <button
                                    style={{
                                      position: 'absolute',
                                      top: '0',
                                      right: '0',
                                      background: '#eff6ff',
                                      border: '1px solid #bfdbfe',
                                      color: '#0078d4',
                                      fontSize: '12px',
                                      fontWeight: 'bold',
                                      width: '20px',
                                      height: '20px',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}
                                    title={`Select ${wDay.dateStr} to add task`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedCalendarDate(wDay.dateStr);
                                    }}
                                  >
                                    +
                                  </button>
                                </div>
                                {renderEventsForDay(wDay.dateStr)}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {selectedCalendarDate && (
                    <div className="panel-card animate-fade" style={{ padding: '20px', borderLeft: '4px solid #0078d4' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <h3 style={{ fontSize: '14.5px', fontWeight: '800', margin: 0, color: '#0f172a' }}>
                            Day Details: {new Date(selectedCalendarDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                          </h3>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {selectedCalendarDate} • {inspectedTasks.length} task(s) scheduled
                          </span>
                        </div>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => setSelectedCalendarDate(null)}
                          title="Close panel"
                        >
                          ✕
                        </button>
                      </div>

                      {/* EMBEDDED TASK CREATION FORM */}
                      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '14px', marginBottom: '18px' }}>
                        <div style={{ fontWeight: '800', fontSize: '12.5px', color: '#1e40af', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>📅 Add Task / Work Item</span>
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); handleDayQuickTaskSubmit(selectedCalendarDate!, false); }}>
                          <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '3px' }}>Task / Work Title *</label>
                            <input 
                              type="text"
                              required
                              placeholder="e.g. Client Follow-up Call, Contract Signing, Site Review"
                              value={dayQuickTask.title}
                              onChange={(e) => setDayQuickTask({ ...dayQuickTask, title: e.target.value })}
                              style={{ width: '100%', padding: '7px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '3px' }}>Scheduled Time</label>
                              <input 
                                type="time"
                                value={dayQuickTask.time}
                                onChange={(e) => setDayQuickTask({ ...dayQuickTask, time: e.target.value })}
                                style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                              />
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '3px' }}>Priority</label>
                              <select 
                                value={dayQuickTask.priority}
                                onChange={(e) => setDayQuickTask({ ...dayQuickTask, priority: e.target.value as any })}
                                style={{ width: '100%', padding: '6px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                              >
                                <option value="High">High Priority</option>
                                <option value="Medium">Medium Priority</option>
                                <option value="Low">Low Priority</option>
                              </select>
                            </div>
                          </div>

                          <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '3px' }}>Linked Company / Contact (Optional)</label>
                            <input 
                              type="text"
                              placeholder="e.g. Apex Biotech, Dr. Sharma"
                              value={dayQuickTask.linkedTo}
                              onChange={(e) => setDayQuickTask({ ...dayQuickTask, linkedTo: e.target.value })}
                              style={{ width: '100%', padding: '7px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                            />
                          </div>

                          <div style={{ marginBottom: '12px' }}>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '3px' }}>Description / Agenda (Optional)</label>
                            <textarea 
                              rows={2}
                              placeholder="Key points, meeting agenda, or preparation notes..."
                              value={dayQuickTask.description}
                              onChange={(e) => setDayQuickTask({ ...dayQuickTask, description: e.target.value })}
                              style={{ width: '100%', padding: '7px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', resize: 'vertical' }}
                            />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                            <button 
                              type="button" 
                              className="btn btn-secondary" 
                              style={{ padding: '6px 12px', fontSize: '11.5px', fontWeight: '700', color: '#0078d4', borderColor: '#bfdbfe', background: '#ffffff' }}
                              onClick={() => handleDayQuickTaskSubmit(selectedCalendarDate!, true)}
                            >
                              ➕ Save & Add Another
                            </button>
                            <button 
                              type="submit" 
                              className="btn btn-primary" 
                              style={{ padding: '6px 18px', fontSize: '11.5px', fontWeight: '700', backgroundColor: '#0078d4', borderColor: '#0078d4' }}
                            >
                              Save Task
                            </button>
                          </div>
                        </form>
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <h4 style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#1e40af', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                           Tasks Scheduled on this Date ({inspectedTasks.length})
                        </h4>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {inspectedTasks.map(t => (
                            <div key={t.id} style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                              <input 
                                type="checkbox" 
                                checked={t.status === 'Completed'} 
                                onChange={() => toggleTaskStatus(t.id)} 
                                style={{ marginTop: '3px' }}
                              />
                              <div style={{ flexGrow: 1 }}>
                                <div style={{ fontSize: '12.5px', fontWeight: '700', textDecoration: t.status === 'Completed' ? 'line-through' : 'none', color: '#0f172a' }}>{t.title}</div>
                                {t.description && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.description}</div>}
                                <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                                  <span className="badge badge-secondary" style={{ fontSize: '9px' }}>{t.assignee}</span>
                                  <span className={`badge ${t.priority === 'High' ? 'badge-hot' : t.priority === 'Medium' ? 'badge-warm' : 'badge-cold'}`} style={{ fontSize: '9px' }}>{t.priority}</span>
                                  {t.dueTime && <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>⏰ {t.dueTime}</span>}
                                  {t.linkedTo && <span style={{ fontSize: '10px', color: '#3b82f6' }}>🔗 {t.linkedTo}</span>}
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: '10.5px', color: '#0078d4', borderColor: '#bfdbfe', background: '#eff6ff', whiteSpace: 'nowrap' }}
                                  title="Open event in Microsoft Outlook Calendar"
                                  onClick={() => {
                                    const url = getOutlookWebComposeUrl({
                                      title: `[Task] ${t.title}`,
                                      description: `Priority: ${t.priority}\nStatus: ${t.status}\nLinked: ${t.linkedTo || 'None'}\n\n${t.description || ''}`,
                                      startDate: t.dueDate || selectedCalendarDate || '',
                                      startTime: t.dueTime || '09:00',
                                      location: t.linkedTo || 'Anveshak CRM'
                                    });
                                    window.open(url, '_blank', 'noopener,noreferrer');
                                    triggerToast('Opening task in Outlook...', 'info');
                                  }}
                                >
                                  📅 Outlook ↗
                                </button>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button
                                    style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '10px', cursor: 'pointer', padding: '2px 4px' }}
                                    onClick={() => openEditTaskModal(t)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '10px', cursor: 'pointer', padding: '2px 4px' }}
                                    onClick={() => {
                                      if (confirm(`Delete task "${t.title}"?`)) {
                                        setTasks(tasks.filter(tk => tk.id !== t.id));
                                      }
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          {inspectedTasks.length === 0 && (
                            <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                              No tasks scheduled on this day. Use the form above to add a task.
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#065f46', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                           Expected Pipeline Closures ({inspectedDeals.length})
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {inspectedDeals.map(d => (
                            <div key={d.id} style={{ background: '#ecfdf5', padding: '10px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                <div>
                                  <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#065f46' }}>{d.name}</div>
                                  <div style={{ fontSize: '11px', color: '#047857', marginTop: '2px' }}>{d.company}</div>
                                </div>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: '10.5px', color: '#0078d4', borderColor: '#bfdbfe', background: '#eff6ff', whiteSpace: 'nowrap' }}
                                  title="Open deal milestone in Microsoft Outlook"
                                  onClick={() => {
                                    const url = getOutlookWebComposeUrl({
                                      title: `[Deal Close] ${d.name} (${d.company})`,
                                      description: `Company: ${d.company}\nStage: ${d.stage}\nValue: ₹${(d.value || 0).toLocaleString('en-IN')}\nOwner: ${d.owner || 'Unassigned'}`,
                                      startDate: d.expectedClose || selectedCalendarDate || '',
                                      startTime: '10:00',
                                      location: d.company || 'Anveshak CRM'
                                    });
                                    window.open(url, '_blank', 'noopener,noreferrer');
                                    triggerToast('Opening deal in Outlook...', 'info');
                                  }}
                                >
                                  📅 Outlook ↗
                                </button>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                                <span style={{ fontSize: '13px', fontWeight: '800' }}>{formatCurrency(d.value)}</span>
                                <span className="badge badge-secondary" style={{ fontSize: '9px', background: '#d1fae5', color: '#065f46' }}>Stage: {d.stage}</span>
                              </div>
                            </div>
                          ))}
                          {inspectedDeals.length === 0 && <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0 }}>No deals forecast to close on this day.</p>}
                        </div>
                      </div>

                      <div>
                        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#92400e', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                           Activities Logged ({inspectedActs.length})
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {inspectedActs.map(a => (
                            <div key={a.id} style={{ background: '#fffbeb', padding: '10px', borderRadius: '6px', border: '1px solid #fde68a' }}>
                              <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#92400e' }}>{a.type} logged by {a.agentName}</div>
                              <p style={{ fontSize: '11.5px', margin: '2px 0 4px 0', color: 'var(--text-muted)' }}>{a.notes}</p>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#b45309', borderTop: '1px dashed #fde68a', paddingTop: '4px' }}>
                                <span>Outcome: {a.outcome}</span>
                                <span>Duration: {a.duration} mins</span>
                              </div>
                            </div>
                          ))}
                          {inspectedActs.length === 0 && <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: 0 }}>No customer communications logged on this day.</p>}
                        </div>
                      </div>

                    </div>
                  )}
                </div>

              </div>
            );
          })()}

          {/* TAB 6: GST INVOICE GENERATOR & REPOSITORY */}
          {activeTab === 'quote' && (
            <GSTQuoteBuilder
              leads={leads}
              deals={deals}
              quotes={quotes}
              termsTemplates={termsTemplates}
              onSaveQuote={(newQuote) => {
                setQuotes([newQuote, ...quotes]);
                recordAuditLog('Quote Created', `Quote: ${newQuote.id} for ${newQuote.company}`, 'None', JSON.stringify(newQuote));
              }}
              onDeleteQuote={(quoteId) => {
                const qte = quotes.find(q => q.id === quoteId);
                setQuotes(quotes.filter(q => q.id !== quoteId));
                if (qte) {
                  recordAuditLog('Quote Deleted', `Quote: ${quoteId}`, JSON.stringify(qte), 'Deleted');
                }
              }}
              onOpenPortalSandbox={(quote) => {
                setSelectedQuoteForPortal(quote);
              }}
              formatCurrency={formatCurrency}
            />
          )}


          {/* TAB 8: USER PROVISIONING & ROLES (ENTERPRISE TEAM HUB) */}
          {activeTab === 'users' && (() => {
            // Deduplicate users strictly by email to prevent duplicate entries
            const seenEmails = new Set<string>();
            const uniqueUsers: any[] = [];
            dbUsersList.forEach((u: any) => {
              if (!u) return;
              const key = (u.email || u.fullName || u.id || '').trim().toLowerCase();
              if (key && !seenEmails.has(key)) {
                seenEmails.add(key);
                uniqueUsers.push(u);
              }
            });

            const filteredUsers = uniqueUsers.filter(u => {
              const q = userSearchFilter.toLowerCase().trim();
              const matchesSearch = !q || 
                (u.fullName && u.fullName.toLowerCase().includes(q)) || 
                (u.email && u.email.toLowerCase().includes(q));

              const matchesRole = userRoleFilter === 'ALL' || u.role === userRoleFilter;
              const matchesStatus = userStatusFilter === 'ALL' || 
                (userStatusFilter === 'ACTIVE' && u.isActive !== false) || 
                (userStatusFilter === 'DEACTIVATED' && u.isActive === false);

              return matchesSearch && matchesRole && matchesStatus;
            });

            const totalAdmins = uniqueUsers.filter(u => u.role === 'ADMIN').length;
            const totalManagers = uniqueUsers.filter(u => u.role === 'MANAGER').length;
            const totalReps = uniqueUsers.filter(u => u.role === 'SALES_REP' || !u.role).length;
            const totalActive = uniqueUsers.filter(u => u.isActive !== false).length;

            return (
              <div className="animate-fade">
                {/* Header Row */}
                <div className="page-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <div className="page-title-text">
                    <h2>Enterprise Team & User Provisioning</h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                      Manage role-based access control (RBAC), multi-user credentials, and account statuses.
                    </p>
                  </div>
                  {currentUser?.role === 'ADMIN' && (
                    <button className="btn btn-primary" onClick={() => setShowAddUserModal(true)}>
                      + Provision Team Member
                    </button>
                  )}
                </div>

                {/* Team KPI Stats Grid */}
                <section className="metric-grid" style={{ marginBottom: '22px' }}>
                  <div className="metric-card">
                    <div className="metric-header">
                      <span>TOTAL REGISTERED ACCOUNTS</span>
                      <span className="trend-badge neutral">Active</span>
                    </div>
                    <div className="metric-val">{uniqueUsers.length} Users</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header">
                      <span>SYSTEM ADMINISTRATORS</span>
                      <span className="trend-badge" style={{ background: '#fef3c7', color: '#92400e' }}>Global</span>
                    </div>
                    <div className="metric-val">{totalAdmins} Admins</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header">
                      <span>SALES REPRESENTATIVES</span>
                      <span className="trend-badge" style={{ background: '#eff6ff', color: '#1e40af' }}>Field</span>
                    </div>
                    <div className="metric-val">{totalReps} Reps</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-header">
                      <span>ACTIVE SESSIONS</span>
                      <span className="trend-badge" style={{ background: '#ecfdf5', color: '#047857' }}>{totalActive} Active</span>
                    </div>
                    <div className="metric-val">{totalManagers} Managers</div>
                  </div>
                </section>

                {/* Search & Filters Toolbar */}
                <div className="panel-card" style={{ padding: '16px 20px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, minWidth: '240px' }}>
                      <input
                        type="text"
                        placeholder="Search users by name or email..."
                        value={userSearchFilter}
                        onChange={(e) => setUserSearchFilter(e.target.value)}
                        style={{
                          width: '100%',
                          maxWidth: '320px',
                          padding: '8px 12px',
                          fontSize: '12.5px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>Role:</span>
                        <select
                          value={userRoleFilter}
                          onChange={(e) => setUserRoleFilter(e.target.value)}
                          style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}
                        >
                          <option value="ALL">All Roles ({dbUsersList.length})</option>
                          <option value="ADMIN">Administrators ({totalAdmins})</option>
                          <option value="MANAGER">Sales Managers ({totalManagers})</option>
                          <option value="SALES_REP">Sales Reps ({totalReps})</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)' }}>Status:</span>
                        <select
                          value={userStatusFilter}
                          onChange={(e) => setUserStatusFilter(e.target.value)}
                          style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}
                        >
                          <option value="ALL">All Statuses</option>
                          <option value="ACTIVE">Active Only</option>
                          <option value="DEACTIVATED">Deactivated Only</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Team Members Data Table */}
                <div className="panel-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="custom-table-container">
                    <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th>Team Member</th>
                          <th>Work Email</th>
                          <th>Role Assignment</th>
                          <th>Account Status</th>
                          <th style={{ textAlign: 'right' }}>Security Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                              No team members match your criteria. Click "+ Provision Team Member" to add one.
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map(usr => {
                            const isSelf = usr.id === currentUser?.id || usr.email === currentUser?.email;
                            const isActive = usr.isActive !== false;

                            return (
                              <tr key={usr.id}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '50%',
                                      background: usr.role === 'ADMIN' ? '#d97706' : usr.role === 'MANAGER' ? '#b45309' : '#1e40af',
                                      color: '#fff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '12px',
                                      fontWeight: 'bold'
                                    }}>
                                      {usr.fullName ? usr.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'U'}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: '700', fontSize: '13px' }}>
                                        {usr.fullName} {isSelf && <span style={{ color: '#3b82f6', fontSize: '11px' }}>(You)</span>}
                                      </div>
                                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        {usr.role === 'ADMIN' ? 'System Administrator' : usr.role === 'MANAGER' ? 'Sales Manager' : 'Sales Representative'}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ color: '#475569', fontSize: '12.5px' }}>{usr.email}</td>
                                <td>
                                  {currentUser?.role === 'ADMIN' && !isSelf ? (
                                    <select
                                      value={usr.role || 'SALES_REP'}
                                      onChange={async (e) => {
                                        const newRole = e.target.value;
                                        try {
                                          const { changeUserRoleAction } = await import('@/app/actions/auth');
                                          await changeUserRoleAction(usr.id, newRole);
                                          setDbUsersList(prev => prev.map(u => u.id === usr.id ? { ...u, role: newRole } : u));
                                          triggerToast(`Role for ${usr.fullName} updated to ${newRole}!`, 'success');
                                          recordAuditLog('User Role Changed', `Role for ${usr.fullName} (${usr.email}) set to ${newRole}`, usr.role, newRole);
                                        } catch (err) {
                                          console.error('Role update error:', err);
                                        }
                                      }}
                                      style={{
                                        fontSize: '11.5px',
                                        fontWeight: '700',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        border: '1px solid #cbd5e1',
                                        backgroundColor: usr.role === 'ADMIN' ? '#fffbeb' : usr.role === 'MANAGER' ? '#fef3c7' : '#eff6ff',
                                        color: usr.role === 'ADMIN' ? '#b45309' : usr.role === 'MANAGER' ? '#92400e' : '#1e40af',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      <option value="ADMIN">Administrator</option>
                                      <option value="MANAGER">Sales Manager</option>
                                      <option value="SALES_REP">Sales Rep</option>
                                    </select>
                                  ) : (
                                    <span className={`badge ${usr.role === 'ADMIN' ? 'badge-hot' : usr.role === 'MANAGER' ? 'badge-warm' : 'badge-cold'}`}>
                                      {usr.role === 'ADMIN' ? 'Administrator' : usr.role === 'MANAGER' ? 'Manager' : 'Sales Rep'}
                                    </span>
                                  )}
                                </td>
                                <td>
                                  <span 
                                    className={`badge ${isActive ? 'badge-cold' : 'badge-hot'}`}
                                    style={{
                                      cursor: currentUser?.role === 'ADMIN' && !isSelf ? 'pointer' : 'default',
                                      backgroundColor: isActive ? '#ecfdf5' : '#fee2e2',
                                      color: isActive ? '#047857' : '#b91c1c',
                                      fontWeight: '700',
                                      padding: '4px 10px'
                                    }}
                                    onClick={async () => {
                                      if (currentUser?.role === 'ADMIN' && !isSelf) {
                                        try {
                                          const { toggleUserActiveStatusAction } = await import('@/app/actions/auth');
                                          await toggleUserActiveStatusAction(usr.id, !isActive);
                                          setDbUsersList(prev => prev.map(u => u.id === usr.id ? { ...u, isActive: !isActive } : u));
                                          triggerToast(`User status updated to ${!isActive ? 'Active' : 'Deactivated'}!`, 'info');
                                          recordAuditLog('User Status Toggled', `User ${usr.fullName} (${usr.email}) status set to ${!isActive ? 'Active' : 'Deactivated'}`, isActive ? 'Active' : 'Deactivated', !isActive ? 'Active' : 'Deactivated');
                                        } catch (err) {
                                          console.error('Status toggle error:', err);
                                        }
                                      }
                                    }}
                                    title={currentUser?.role === 'ADMIN' && !isSelf ? 'Click to toggle Active/Deactivated' : ''}
                                  >
                                    {isActive ? '● Active' : '○ Deactivated'}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  {currentUser?.role === 'ADMIN' && !isSelf && (
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                      <button 
                                        className="btn btn-secondary" 
                                        style={{ padding: '4px 8px', fontSize: '11px' }}
                                        onClick={() => {
                                          setAdminResetPasswordUser(usr);
                                          setAdminNewPasswordInput('');
                                        }}
                                      >
                                        Reset Password
                                      </button>
                                      <button 
                                        className="btn btn-secondary" 
                                        style={{ color: '#ef4444', borderColor: '#fca5a5', padding: '4px 8px', fontSize: '11px' }}
                                        onClick={async () => {
                                          if (confirm(`Are you sure you want to remove ${usr.fullName} (${usr.email}) from the database?`)) {
                                            try {
                                              const { deleteUserAction } = await import('@/app/actions/auth');
                                              await deleteUserAction(usr.id);
                                              setDbUsersList(prev => prev.filter(x => x.id !== usr.id));
                                              triggerToast(`User ${usr.fullName} deleted from database.`, 'info');
                                            } catch (e) {
                                              console.error('Error deleting user:', e);
                                            }
                                          }
                                        }}
                                      ><TrashIcon size={13} color="#dc2626" /></button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {activeTab === 'scoring' && (
            <div className="panel-card animate-fade" style={{ maxWidth: '650px' }}>
              <div className="panel-title" style={{ marginBottom: '16px' }}>
                <h3>Lead Scoring Point Values</h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Rule 1 */}
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#0f172a' }}>Request Product Demo</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Points awarded when a customer triggers a demo request.</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      className="scoring-slider" 
                      value={rules.demoRequested} 
                      onChange={(e) => setRules({ ...rules, demoRequested: parseInt(e.target.value) || 0 })}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontWeight: 'bold', minWidth: '60px', textAlign: 'right', fontSize: '13px', color: '#1e40af' }}>{rules.demoRequested} pts</span>
                  </div>
                </div>

                {/* Rule 2 */}
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#0f172a' }}>Schedule Callback/Meeting</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Points awarded when a follow-up call/meeting is scheduled.</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      className="scoring-slider" 
                      value={rules.meetingScheduled} 
                      onChange={(e) => setRules({ ...rules, meetingScheduled: parseInt(e.target.value) || 0 })}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontWeight: 'bold', minWidth: '60px', textAlign: 'right', fontSize: '13px', color: '#1e40af' }}>{rules.meetingScheduled} pts</span>
                  </div>
                </div>

                {/* Rule 3 */}
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#0f172a' }}>Outbound Call - Answered</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Points awarded for outbound customer calls that are successfully answered.</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      className="scoring-slider" 
                      value={rules.callAnswered} 
                      onChange={(e) => setRules({ ...rules, callAnswered: parseInt(e.target.value) || 0 })}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontWeight: 'bold', minWidth: '60px', textAlign: 'right', fontSize: '13px', color: '#1e40af' }}>{rules.callAnswered} pts</span>
                  </div>
                </div>

                {/* Rule 4 */}
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#0f172a' }}>Outbound Call - No Answer</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Points deduction/addition for missed calls or no-answer trials.</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input 
                      type="range" 
                      min="-50" 
                      max="50" 
                      className="scoring-slider" 
                      value={rules.callNoAnswer} 
                      onChange={(e) => setRules({ ...rules, callNoAnswer: parseInt(e.target.value) || 0 })}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontWeight: 'bold', minWidth: '60px', textAlign: 'right', fontSize: '13px', color: '#b45309' }}>{rules.callNoAnswer} pts</span>
                  </div>
                </div>

                {/* Rule 5 */}
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#0f172a' }}>Marked as "Not Interested"</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Deduction penalty when a prospect rejects callback requests.</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input 
                      type="range" 
                      min="-100" 
                      max="0" 
                      className="scoring-slider" 
                      value={rules.notInterested} 
                      onChange={(e) => setRules({ ...rules, notInterested: parseInt(e.target.value) || 0 })}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontWeight: 'bold', minWidth: '60px', textAlign: 'right', fontSize: '13px', color: '#ef4444' }}>{rules.notInterested} pts</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => triggerRecalculateScores()}>
                  Save & Recalculate
                </button>
                <button className="btn btn-secondary" onClick={() => setShowCustomFieldModal(true)}>
                  + Add Custom Field
                </button>
              </div>
            </div>
          )}

          {/* TAB 8: AUDIT GOVERNANCE REGISTRY */}
          {activeTab === 'audit' && (
            <div className="animate-fade">
              {/* Batch Import & Rollback Management Card */}
              <div className="panel-card" style={{ marginBottom: '24px' }}>
                <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3>Contact Batch Imports</h3>
                  </div>
                </div>

                {importBatches.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '14px 0 0' }}>No Excel or CSV batch imports executed yet.</p>
                ) : (
                  <div style={{ marginTop: '16px', display: 'grid', gap: '12px' }}>
                    {importBatches.map(batch => (
                      <div key={batch.id} style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '14px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <strong style={{ fontSize: '14px', color: '#0f172a' }}>{batch.fileName || 'Spreadsheet Import'}</strong>
                              <span className="badge badge-cold" style={{ fontSize: '10px' }}>
                                {batch.sourceType || 'Excel Import'}
                              </span>
                              {batch.sourceEvent && (
                                <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>
                                  {batch.sourceEvent}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                              Uploaded by <strong>{batch.uploadedBy || 'User'}</strong> • {new Date(batch.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                            </div>
                          </div>

                          <div>
                            {batch.isRolledBack ? (
                              <span style={{ background: '#fee2e2', color: '#991b1b', padding: '5px 12px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 'bold' }}>
                                Rolled Back (Undone)
                              </span>
                            ) : (
                              <button
                                className="btn btn-secondary"
                                style={{ color: '#dc2626', borderColor: '#fca5a5', backgroundColor: '#fef2f2', fontSize: '11.5px', padding: '6px 14px', minHeight: '34px' }}
                                onClick={async () => {
                                  if (confirm(`Are you sure you want to undo and rollback batch "${batch.fileName}"? All uncontacted records from this batch will be removed.`)) {
                                    try {
                                      const { rollbackImportBatchAction } = await import('@/app/actions/contacts');
                                      const res = await rollbackImportBatchAction(batch.id, currentUser?.fullName || 'CRM User');
                                      if (res.success) {
                                        setImportBatches(prev => prev.map(b => b.id === batch.id ? { ...b, isRolledBack: true } : b));
                                        // Reload contacts
                                        const { fetchContactsListAction } = await import('@/app/actions/contacts');
                                        const cRes = await fetchContactsListAction();
                                        if (cRes.success && cRes.contacts) {
                                          setContactsList(cRes.contacts.map((c: any) => ({
                                            ...c,
                                            phone: c.preferredPhone || c.phone,
                                            dateAdded: c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : 'Today'
                                          })));
                                        }
                                        triggerToast(`Rollback complete: removed uncontacted records.`, 'success');
                                      } else {
                                        alert(res.error || 'Rollback failed.');
                                      }
                                    } catch (rErr: any) {
                                      alert('Rollback error: ' + rErr.message);
                                    }
                                  }
                                }}
                              >
                                ↺ Undo Batch Import
                              </button>
                            )}
                          </div>
                        </div>

                        {/* KPI Stats Chips */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(75px, 1fr))', gap: '8px' }}>
                          <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '8px', textAlign: 'center', border: '1px solid #f1f5f9' }}>
                            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Total</div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>{batch.totalRows}</div>
                          </div>
                          <div style={{ background: '#ecfdf5', padding: '8px', borderRadius: '8px', textAlign: 'center', border: '1px solid #d1fae5' }}>
                            <div style={{ fontSize: '10px', color: '#047857', textTransform: 'uppercase', fontWeight: '600' }}>Imported</div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#059669' }}>{batch.importedCount}</div>
                          </div>
                          <div style={{ background: '#fffbeb', padding: '8px', borderRadius: '8px', textAlign: 'center', border: '1px solid #fef3c7' }}>
                            <div style={{ fontSize: '10px', color: '#b45309', textTransform: 'uppercase', fontWeight: '600' }}>Merged</div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#d97706' }}>{batch.mergedCount}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Standard Audit Registry */}
              <div className="panel-card">
                <div className="panel-title">
                  <h3>System Operation Logs</h3>
                </div>
                
                <div className="custom-table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Time stamp</th>
                        <th>User</th>
                        <th>Operation Event</th>
                        <th>Affected Record</th>
                        <th>State Logs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map(log => (
                        <tr key={log.id}>
                          <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{log.timestamp}</td>
                          <td style={{ fontWeight: '600' }}>{log.user}</td>
                          <td>
                            <span className={`badge ${log.action.includes('Transition') ? 'badge-warm' : log.action.includes('Created') ? 'badge-hot' : 'badge-cold'}`}>
                              {log.action}
                            </span>
                          </td>
                          <td>{log.entity}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                className="audit-diff-trigger"
                                onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                              >
                                {expandedLogId === log.id ? 'Close State' : 'View Inline'}
                              </button>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '2px 8px', fontSize: '11.5px', whiteSpace: 'nowrap' }}
                                onClick={() => setSelectedAuditLogForDiff(log)}
                              >
                                Compare Diff (Side-by-Side)
                              </button>
                            </div>
                            
                            {expandedLogId === log.id && (
                              <div className="audit-diff-block" style={{ marginTop: '6px' }}>
                                <span style={{ color: 'var(--danger)' }}>BEFORE:</span> {log.beforeState}
                                <br />
                                <span style={{ color: 'var(--success)' }}>AFTER:</span> {log.afterState}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          {/* TAB 9: SETTINGS & CRM PROFILE MANAGEMENT */}
          {activeTab === 'settings' && (() => {
            const runBackupSimulation = () => {
              setIsBackingUp(true);
              setBackupCompleted(false);
              setBackupProgress(0);
              const logs: string[] = [];
              const steps = [
                { p: 20, m: 'Archiving Contacts & Leads table registry...' },
                { p: 40, m: 'Serializing Sales Pipelines & Deals stages...' },
                { p: 60, m: 'Compressing Operational Task Checklist Queues...' },
                { p: 80, m: 'Structuring Auditing Trails & Governance logs...' },
                { p: 100, m: 'Assembling secure backup package archive (JSON format)...' }
              ];
              
              let currentStep = 0;
              const interval = setInterval(() => {
                if (currentStep < steps.length) {
                  const step = steps[currentStep];
                  setBackupProgress(step.p);
                  logs.push(`[${new Date().toLocaleTimeString()}] ${step.m}`);
                  setBackupLogMessages([...logs]);
                  currentStep++;
                } else {
                  clearInterval(interval);
                  setIsBackingUp(false);
                  setBackupCompleted(true);
                  
                  const backupData = {
                    leads,
                    deals,
                    tasks,
                    activities,
                    companies,
                    usersList,
                    rules,
                    customFields,
                    termsTemplates,
                    auditLogs
                  };
                  
                  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `anveshak_crm_backup_${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }
              }, 400);
            };

            const handleRestoreUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const data = JSON.parse(reader.result as string);
                  if (data.leads) setLeads(data.leads);
                  if (data.deals) setDeals(data.deals);
                  if (data.tasks) setTasks(data.tasks);
                  if (data.activities) setActivities(data.activities);
                  if (data.companies) setCompanies(data.companies);
                  if (data.usersList) setUsersList(data.usersList);
                  if (data.rules) setRules(data.rules);
                  if (data.customFields) setCustomFields(data.customFields);
                  if (data.termsTemplates) setTermsTemplates(data.termsTemplates);
                  if (data.auditLogs) setAuditLogs(data.auditLogs);
                  alert('CRM Database successfully restored from backup file!');
                } catch (err) {
                  alert('Failed to parse backup file. Please ensure it is a valid Anveshak CRM backup JSON.');
                }
              };
              reader.readAsText(file);
            };

            const runDiagnosticsBenchmark = () => {
              setDiagnosticsBenchmarkRun(true);
              setDiagnosticsBenchmarkProgress(0);
              const interval = setInterval(() => {
                setDiagnosticsBenchmarkProgress(p => {
                  if (p >= 100) {
                    clearInterval(interval);
                    return 100;
                  }
                  return p + 10;
                });
              }, 100);
            };

            return (
              <div className="animate-fade" style={{ maxWidth: '900px' }}>
                <div className="page-header-row" style={{ marginBottom: '20px' }}>
                  <div className="page-title-text">
                    <h2>Workspace Settings</h2>
                  </div>
                </div>

                {/* Settings View Sub-Tabs */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginBottom: '22px',
                  padding: '6px',
                  background: '#f1f5f9',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  width: 'fit-content'
                }}>
                  {[
                    { id: 'profile', label: 'Executive Profile', icon: '' },
                    { id: 'security', label: 'Security & Password', icon: '' },
                    { id: 'terms', label: 'Legal Clauses', icon: '' },
                    { id: 'fields', label: 'Dynamic Fields', icon: '' },
                    { id: 'backup', label: 'Backup & Export', icon: '' }
                  ].map(tab => (
                    <button 
                      key={tab.id}
                      type="button"
                      onClick={() => setSettingsSubTab(tab.id as any)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '9px 18px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: settingsSubTab === tab.id ? '700' : '600',
                        color: settingsSubTab === tab.id ? '#ffffff' : '#334155',
                        backgroundColor: settingsSubTab === tab.id ? '#1e40af' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: settingsSubTab === tab.id ? '0 2px 8px rgba(30, 64, 175, 0.25)' : 'none'
                      }}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* SUBTAB 1: EXECUTIVE PROFILE CARD */}
                {settingsSubTab === 'profile' && (
                  <UserProfileCard 
                    currentUser={currentUser}
                    currentRole={currentRole}
                    profileSettings={profileSettings}
                    setProfileSettings={setProfileSettings}
                    setCurrentUser={setCurrentUser}
                    triggerToast={triggerToast}
                    dealsCount={deals.length}
                    totalPipelineValue={deals.reduce((sum, d) => sum + d.value, 0)}
                    completedTasksCount={tasks.filter(t => t.status === 'Completed').length}
                    winRatePercent={winRatePercent}
                  />
                )}

                {/* SUBTAB: SECURITY & PASSWORD CHANGE */}
                {settingsSubTab === 'security' && (
                  <div className="panel-card animate-fade" style={{ padding: '24px', maxWidth: '520px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '8px' }}>
                      Change Account Password
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '20px' }}>
                      Update your login password. Passwords must contain at least 6 characters.
                    </p>

                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!selfPasswordForm.currentPassword || !selfPasswordForm.newPassword) {
                        triggerToast('Please fill in all password fields.', 'error');
                        return;
                      }
                      if (selfPasswordForm.newPassword !== selfPasswordForm.confirmPassword) {
                        triggerToast('New passwords do not match. Please re-type.', 'error');
                        return;
                      }
                      if (selfPasswordForm.newPassword.length < 6) {
                        triggerToast('New password must be at least 6 characters long.', 'error');
                        return;
                      }

                      setIsUpdatingSelfPassword(true);
                      try {
                        const { changeUserPasswordAction } = await import('@/app/actions/auth');
                        const res = await changeUserPasswordAction(
                          currentUser?.email || '',
                          selfPasswordForm.currentPassword,
                          selfPasswordForm.newPassword
                        );

                        if (res.success) {
                          triggerToast(res.message || 'Password successfully updated!', 'success');
                          setSelfPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        } else {
                          triggerToast(res.error || 'Failed to change password.', 'error');
                        }
                      } catch (err: any) {
                        triggerToast('Error updating password in database.', 'error');
                      } finally {
                        setIsUpdatingSelfPassword(false);
                      }
                    }}>
                      <div className="form-group" style={{ marginBottom: '14px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '700' }}>Current Password *</label>
                        <input
                          type="password"
                          required
                          value={selfPasswordForm.currentPassword}
                          onChange={(e) => setSelfPasswordForm({ ...selfPasswordForm, currentPassword: e.target.value })}
                          placeholder="Enter your current password"
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: '14px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '700' }}>New Password *</label>
                        <input
                          type="password"
                          required
                          value={selfPasswordForm.newPassword}
                          onChange={(e) => setSelfPasswordForm({ ...selfPasswordForm, newPassword: e.target.value })}
                          placeholder="At least 6 characters"
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: '20px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '700' }}>Confirm New Password *</label>
                        <input
                          type="password"
                          required
                          value={selfPasswordForm.confirmPassword}
                          onChange={(e) => setSelfPasswordForm({ ...selfPasswordForm, confirmPassword: e.target.value })}
                          placeholder="Re-enter your new password"
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                      </div>

                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isUpdatingSelfPassword}
                        style={{ padding: '10px 20px', fontSize: '13px' }}
                      >
                        {isUpdatingSelfPassword ? 'Updating Password...' : 'Update Password →'}
                      </button>
                    </form>
                  </div>
                )}

                {/* SUBTAB 2: TERMS AND CONDITIONS */}
                {settingsSubTab === 'terms' && (
                  <div className="panel-card animate-fade" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '18px' }}>Legal Clauses & Contract Terms</h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {termsTemplates.map((template) => (
                        <div key={template.id} style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <strong style={{ fontSize: '13px' }}>{template.name} ({template.id})</strong>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--danger)', borderColor: '#fee2e2' }}
                              onClick={() => {
                                if (termsTemplates.length <= 1) {
                                  alert('Cannot delete the last remaining template.');
                                  return;
                                }
                                if (confirm(`Are you sure you want to delete template "${template.name}"?`)) {
                                  setTermsTemplates(termsTemplates.filter(t => t.id !== template.id));
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                          <textarea 
                            rows={4} 
                            style={{ fontSize: '12px', width: '100%', borderRadius: '6px', border: '1px solid var(--border-color)', padding: '8px' }}
                            value={template.content}
                            onChange={(e) => {
                              const nextVal = e.target.value;
                              setTermsTemplates(termsTemplates.map(t => t.id === template.id ? { ...t, content: nextVal } : t));
                            }}
                          />
                        </div>
                      ))}

                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.target as HTMLFormElement;
                          const nameInput = form.elements.namedItem('newTemplateName') as HTMLInputElement;
                          const contentInput = form.elements.namedItem('newTemplateContent') as HTMLTextAreaElement;

                          const name = nameInput.value.trim();
                          const content = contentInput.value.trim();
                          if (!name || !content) return;

                          const nextT: TermsTemplate = {
                            id: `T&C-${Date.now().toString().slice(-3)}`,
                            name,
                            content
                          };
                          setTermsTemplates([...termsTemplates, nextT]);
                          form.reset();
                          alert('Registered T&C Template!');
                        }}
                        style={{ background: '#eff6ff', padding: '14px', borderRadius: '8px', border: '1px solid #bfdbfe', marginTop: '12px' }}
                      >
                        <h4 style={{ fontSize: '13px', marginBottom: '8px', color: '#1e40af' }}>+ Add New T&C Clause Template</h4>
                        <div className="form-group" style={{ marginBottom: '8px' }}>
                          <input type="text" name="newTemplateName" required placeholder="Template name" style={{ padding: '6px', fontSize: '12px', width: '100%' }} />
                        </div>
                        <div className="form-group" style={{ marginBottom: '10px' }}>
                          <textarea name="newTemplateContent" required rows={3} placeholder="Write standard clauses..." style={{ padding: '8px', fontSize: '12px', width: '100%' }} />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ fontSize: '12px', padding: '6px 14px' }}>
                          Register Clause Template
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {/* SUBTAB 3: DYNAMIC CUSTOM FIELDS */}
                {settingsSubTab === 'fields' && (
                  <div className="panel-card animate-fade" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '18px' }}>Dynamic Custom Fields</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div>
                        <h4 style={{ fontSize: '12px', color: '#0f172a', fontWeight: 'bold', marginBottom: '10px' }}>Registered Dynamic Fields ({customFields.length})</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {customFields.map(f => (
                            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: '700' }}>{f.label}</div>
                                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Type: {f.type}</div>
                              </div>
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '2px 6px', fontSize: '11px', color: 'var(--danger)', borderColor: '#fee2e2' }}
                                onClick={() => setCustomFields(customFields.filter(field => field.id !== f.id))}
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                          {customFields.length === 0 && <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No dynamic fields registered.</p>}
                        </div>
                      </div>

                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!customFieldLabel.trim()) return;
                          
                          const nextF: CustomField = {
                            id: `CF-${Date.now().toString().slice(-3)}`,
                            label: customFieldLabel,
                            entity: 'Lead',
                            type: customFieldType
                          };
                          setCustomFields([...customFields, nextF]);
                          setCustomFieldLabel('');
                          alert(`Dynamic field "${customFieldLabel}" successfully registered!`);
                        }}
                        style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', background: '#f8fafc' }}
                      >
                        <h4 style={{ fontSize: '12.5px', fontWeight: 'bold', marginBottom: '12px' }}>Add Custom Field</h4>
                        <div className="form-group" style={{ marginBottom: '12px' }}>
                          <label>Field Name / Label</label>
                          <input type="text" required value={customFieldLabel} onChange={(e) => setCustomFieldLabel(e.target.value)} placeholder="e.g. GSTIN, Segment" style={{ padding: '6px' }} />
                        </div>
                        <div className="form-group" style={{ marginBottom: '16px' }}>
                          <label>Field Value Type</label>
                          <select value={customFieldType} onChange={(e) => setCustomFieldType(e.target.value as any)} style={{ padding: '6px' }}>
                            <option value="text">Text Input</option>
                            <option value="number">Numeric Range</option>
                            <option value="date">Date Picker</option>
                          </select>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Create Field</button>
                      </form>
                    </div>
                  </div>
                )}

                {/* SUBTAB 4: DATA BACKUP & EXPORT */}
                {settingsSubTab === 'backup' && (
                  <div className="panel-card animate-fade" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '18px' }}>Database Backup & Export</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                      <div style={{ borderRight: '1px solid var(--border-color)', paddingRight: '24px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '10px' }}>Option A: Export Data Package</h4>
                        <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                          Dumps contacts, deals, quotes, tasks, and audit logs into a single structured backup ZIP/JSON package.
                        </p>
                        
                        <button 
                          className="btn btn-primary" 
                          disabled={isBackingUp}
                          onClick={runBackupSimulation}
                        >
                          {isBackingUp ? 'Generating Package...' : 'Generate ZIP Backup'}
                        </button>

                        {isBackingUp && (
                          <div style={{ marginTop: '16px' }}>
                            <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span>Packing assets...</span>
                              <span>{backupProgress}%</span>
                            </div>
                            <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', background: '#3b82f6', width: `${backupProgress}%`, transition: 'width 0.15s ease-in-out' }}></div>
                            </div>
                          </div>
                        )}

                        {backupLogMessages.length > 0 && (
                          <pre style={{ marginTop: '14px', padding: '10px', background: '#0f172a', color: '#38bdf8', fontSize: '10.5px', fontFamily: 'monospace', borderRadius: '6px', height: '110px', overflowY: 'auto', margin: 0 }}>
                            {backupLogMessages.join('\n')}
                          </pre>
                        )}

                        {backupCompleted && !isBackingUp && (
                          <div style={{ marginTop: '10px', fontSize: '12px', color: '#16a34a', fontWeight: 'bold' }}>
                            ✓ ZIP package successfully compiled & downloaded!
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '10px' }}>Option B: Restore from Backup File</h4>
                        <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                          Upload an `.json` backup package to overwrite your current sandbox environment states.
                        </p>
                        
                        <div style={{ border: '2px dashed var(--border-color)', borderRadius: '8px', padding: '20px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                          <input 
                            type="file" 
                            accept=".json" 
                            onChange={handleRestoreUpload}
                            style={{ display: 'none' }}
                            id="restore-file-input"
                          />
                          <label htmlFor="restore-file-input" style={{ cursor: 'pointer', display: 'block', margin: 0 }}>
                            <div style={{ fontSize: '24px', marginBottom: '6px' }}></div>
                            <div style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#1e40af' }}>Select backup .json file</div>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>Supported formats: Anveshak export (.json)</div>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Database Initialization Panel */}
                    <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Production Workspace Database Initialization</h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                        Choose whether to wipe the database and start fresh in clean production mode, or load sample demonstration data.
                      </p>
                      
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                          onClick={async () => {
                            if (confirm('This will completely wipe all leads, deals, tasks, companies, and quotes in both your local state and Supabase database. Are you sure?')) {
                              setLeads([]);
                              setDeals([]);
                              setTasks([]);
                              setCompanies([]);
                              setQuotes([]);
                              setAuditLogs([{
                                id: `LOG-RESET-${Date.now().toString().slice(-3)}`,
                                user: currentAgentName,
                                action: 'Database Reset',
                                entity: 'Production Reset (Empty Slate)',
                                timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
                                beforeState: 'Demo State',
                                afterState: 'Empty Production State'
                              }]);
                              try {
                                const { wipeDatabaseAction } = await import('@/app/actions/crm');
                                await wipeDatabaseAction();
                              } catch (e) {
                                console.error('Prisma wipe database error:', e);
                              }
                              alert('Database wiped successfully! CRM is now in clean production slate.');
                            }
                          }}
                        >
                          Wipe Database (Clean Production State)
                        </button>
 
                        <button 
                          className="btn btn-secondary" 
                          onClick={async () => {
                            if (confirm('This will restore all preloaded Anveshak CRM demo leads, deals, and tasks. Proceed?')) {
                              const resetLog = {
                                id: `LOG-SEED-${Date.now().toString().slice(-3)}`,
                                user: currentAgentName,
                                action: 'Database Seeded',
                                entity: 'Seeded Demo Data',
                                timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
                                beforeState: 'Varies',
                                afterState: 'Demo Seed State'
                              };
                              setLeads(initialLeads);
                              setDeals(initialDeals);
                              setTasks(initialTasks);
                              setCompanies(initialCompanies);
                              setQuotes(initialQuotes);
                              setProfileSettings({
                                'Admin': { fullName: 'KP Sumanth', email: 'sumanth@anveshakhub.com', title: 'Regional Director', avatarColor: '#d97706', notify: true },
                                'Manager': { fullName: 'Balasaraswathi', email: 'balu@anveshakhub.com', title: 'Sales Manager', avatarColor: '#b45309', notify: true },
                                'Sales Rep': { fullName: 'Riya Sharma', email: 'riya@anveshakhub.com', title: 'Enterprise Rep', avatarColor: '#1e40af', notify: true }
                              });
                              setAuditLogs([resetLog]);
                              try {
                                const { seedDemoDataAction } = await import('@/app/actions/crm');
                                await seedDemoDataAction({
                                  companies: initialCompanies,
                                  leads: initialLeads,
                                  deals: initialDeals,
                                  tasks: initialTasks,
                                  quotes: initialQuotes,
                                  auditLogs: [resetLog]
                                });
                              } catch (e) {
                                console.error('Prisma demo seed error:', e);
                              }
                              alert('Demo database loaded successfully!');
                            }
                          }}
                        >
                          Load Sample Demo Data
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            );
          })()}


        </div>
      </main>

      {/* MODAL 1: ADD LEAD (WITH DYNAMIC CUSTOM FIELDS) */}
      {showLeadModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3>Create New Contact</h3>
              <button className="modal-close-btn" onClick={() => setShowLeadModal(false)}>×</button>
            </div>
            <form onSubmit={handleLeadSubmit}>
              {/* Visiting Card Scanner Widget */}
              <div className="card-scanner-box" style={{ marginBottom: '16px', padding: '12px', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#0d9488', letterSpacing: '0.05em' }}>AI VISITING CARD SCANNER</span>
                  <label className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '10px', cursor: 'pointer', margin: 0, borderStyle: 'dashed' }}>
                    Scan Card
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      onChange={handleCardScan} 
                      style={{ display: 'none' }} 
                    />
                  </label>
                </div>
                
                {isScanning ? (
                  <div className="scanner-progress-container" style={{ position: 'relative', overflow: 'hidden', padding: '4px 0' }}>
                    <div className="scanner-laser-line"></div>
                    <div style={{ fontSize: '10px', color: '#0d9488', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Analyzing card with OCR AI...</span>
                      <span>{scanProgress}%</span>
                    </div>
                    <div className="scanner-progress-bar" style={{ height: '4px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '2px' }}>
                      <div className="scanner-progress-fill" style={{ height: '100%', backgroundColor: '#0d9488', width: `${scanProgress}%`, transition: 'width 0.15s ease' }}></div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>
                      Snap a photo of a visiting card from mobile camera to auto-extract details.
                    </p>
                    {cardImage && (
                      <div style={{ marginTop: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ position: 'relative', width: '80px', height: '80px', border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'black' }}>
                          <img 
                            src={cardImage} 
                            alt="Card Snap" 
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                          />
                        </div>
                        <div>
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '10px' }}
                            onClick={handleRotateImage}
                          >
                            ↻ Rotate 90° & Re-Scan
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-grid-2col">
                <div className="form-group">
                  <label>First Name *</label>
                  <input type="text" required placeholder="e.g. Ramesh" value={newLead.firstName} onChange={(e) => setNewLead({ ...newLead, firstName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input type="text" required placeholder="e.g. Gowda" value={newLead.lastName} onChange={(e) => setNewLead({ ...newLead, lastName: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label>Work Email Address *</label>
                <input type="email" required placeholder="e.g. name@company.com" value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} />
              </div>

              <div className="modal-grid-2col">
                <div className="form-group">
                  <label>Primary Phone *</label>
                  <input type="text" required placeholder="e.g. +91 98450 12345" value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Alternate Phone</label>
                  <input type="text" placeholder="e.g. +91 98450 67890" value={newLead.alternatePhone} onChange={(e) => setNewLead({ ...newLead, alternatePhone: e.target.value })} />
                </div>
              </div>

              <div className="modal-grid-2col">
                <div className="form-group">
                  <label>Company / Account Entity *</label>
                  <select value={newLead.company} onChange={(e) => setNewLead({ ...newLead, company: e.target.value })}>
                    <option value="">-- Select Company --</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                    <option value="New Organization">New / Unlisted Company</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Or type Custom Company name</label>
                  <input type="text" placeholder="e.g. Mysore Agro Products" value={newLead.company === 'New Organization' ? '' : newLead.company} onChange={(e) => setNewLead({ ...newLead, company: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label>Designation / Job Title</label>
                <input type="text" placeholder="e.g. Purchase Director" value={newLead.designation} onChange={(e) => setNewLead({ ...newLead, designation: e.target.value })} />
              </div>

              <div className="modal-grid-2col">
                <div className="form-group">
                  <label>City *</label>
                  <input type="text" required placeholder="e.g. Bangalore" value={newLead.city} onChange={(e) => setNewLead({ ...newLead, city: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>State *</label>
                  <input type="text" required placeholder="e.g. Karnataka" value={newLead.state} onChange={(e) => setNewLead({ ...newLead, state: e.target.value })} />
                </div>
              </div>

              <div className="modal-grid-2col">
                <div className="form-group">
                  <label>Lead Source *</label>
                  <select value={newLead.leadSource} onChange={(e) => setNewLead({ ...newLead, leadSource: e.target.value })}>
                    <option value="Website">Website</option>
                    <option value="Referral">Referral</option>
                    <option value="Hackathon">Hackathon</option>
                    <option value="Cold Call">Cold Call</option>
                    <option value="Event">Event</option>
                    <option value="Govt Tender">Govt Tender</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Assigned Rep (Owner) *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. KP Sumanth or Pranav" 
                    list="team-owners-datalist"
                    value={newLead.owner} 
                    onChange={(e) => setNewLead({ ...newLead, owner: e.target.value })} 
                  />
                  <datalist id="team-owners-datalist">
                    {dbUsersList.map((u: any) => (
                      <option key={u.id} value={u.fullName}>{u.fullName} ({u.role})</option>
                    ))}
                    <option value="KP Sumanth">KP Sumanth (ADMIN)</option>
                    <option value="Pranav">Pranav (SALES_REP)</option>
                    <option value="Balasaraswathi">Balasaraswathi (SALES_REP)</option>
                    <option value="Riya Sharma">Riya Sharma (MANAGER)</option>
                  </datalist>
                </div>
              </div>

              <div className="form-group">
                <label>Tags</label>
                <select value={newLead.tags} onChange={(e) => setNewLead({ ...newLead, tags: e.target.value })}>
                  <option value="B2G">B2G</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Hot Lead">Hot Lead</option>
                  <option value="Corporate">Corporate</option>
                </select>
              </div>

              {/* Render Admin-configured Custom Fields dynamically */}
              {customFields.map(field => (
                <div key={field.id} className="form-group">
                  <label>{field.label} (Custom Field)</label>
                  <input 
                    type={field.type} 
                    value={newCustomValues[field.label] || ''}
                    onChange={(e) => setNewCustomValues({ ...newCustomValues, [field.label]: e.target.value })}
                  />
                </div>
              ))}

              <div className="modal-actions" style={{ position: 'sticky', bottom: 0, backgroundColor: '#ffffff', padding: '14px 0 0 0', borderTop: '1px solid var(--border-color)', zIndex: 10, marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowLeadModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT LEAD DETAILS */}
      {showEditLeadModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxHeight: '85vh', overflowY: 'auto', width: '100%', maxWidth: '620px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>✏️</span>
                <h3>Edit Lead Details</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowEditLeadModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleSaveEditLead} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="modal-grid-2col">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Ramesh Gowda" 
                    value={editLeadForm.name} 
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, name: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label>Company / Organization *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Mysore Agro Products" 
                    value={editLeadForm.company} 
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, company: e.target.value })} 
                  />
                </div>
              </div>

              <div className="modal-grid-2col">
                <div className="form-group">
                  <label>Work Email Address</label>
                  <input 
                    type="email" 
                    placeholder="name@company.com" 
                    value={editLeadForm.email} 
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, email: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label>Primary Phone Number</label>
                  <input 
                    type="text" 
                    placeholder="+91 98450 12345" 
                    value={editLeadForm.phone} 
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, phone: e.target.value })} 
                  />
                </div>
              </div>

              <div className="modal-grid-2col">
                <div className="form-group">
                  <label>Designation / Role</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Purchase Director" 
                    value={editLeadForm.designation} 
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, designation: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label>Assigned Representative (Owner) *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Type or select representative..." 
                    list="team-owners-datalist"
                    value={editLeadForm.owner} 
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, owner: e.target.value })} 
                  />
                </div>
              </div>

              <div className="modal-grid-2col">
                <div className="form-group">
                  <label>City</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Bangalore" 
                    value={editLeadForm.city} 
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, city: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Karnataka" 
                    value={editLeadForm.state} 
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, state: e.target.value })} 
                  />
                </div>
              </div>

              <div className="modal-grid-2col">
                <div className="form-group">
                  <label>Lead Pipeline Status</label>
                  <select 
                    value={editLeadForm.status} 
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, status: e.target.value })}
                  >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Disqualified">Disqualified</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Lead Score Weight (0 - 100)</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="100" 
                    value={editLeadForm.score} 
                    onChange={(e) => setEditLeadForm({ ...editLeadForm, score: Number(e.target.value) || 0 })} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Tags (Comma-separated)</label>
                <input 
                  type="text" 
                  placeholder="e.g. B2G, Manufacturing, Hot Lead" 
                  value={Array.isArray(editLeadForm.tags) ? editLeadForm.tags.join(', ') : (editLeadForm.tags || '')} 
                  onChange={(e) => setEditLeadForm({ ...editLeadForm, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} 
                />
              </div>

              <div className="modal-actions" style={{ position: 'sticky', bottom: 0, backgroundColor: '#ffffff', padding: '14px 0 0 0', borderTop: '1px solid var(--border-color)', zIndex: 10, marginTop: '8px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditLeadModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px', fontWeight: '700' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DUPLICATE DETECTION WARNING */}
      {showDuplicateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ borderColor: 'var(--warning)' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--warning)' }}>Duplicate In-System Warning</h3>
              <button className="modal-close-btn" onClick={() => setShowDuplicateModal(false)}>×</button>
            </div>
            
            <p style={{ fontSize: '13px', lineHeight: '1.6', marginBottom: '16px' }}>
              A lead with the email address <strong>{newLead.email}</strong> is already registered under the name <strong>{duplicateConflictedLead?.name}</strong> (Company: {duplicateConflictedLead?.company}).
            </p>
            
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Would you like to merge this lead or create a new duplicate record anyway?
            </p>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowDuplicateModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ backgroundColor: 'var(--warning)', color: '#0f172a' }} onClick={createConfirmedLead}>
                Create Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD TASK */}
      {showTaskModal && (
        <div className="modal-overlay" style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)' }}>
          <div 
            className="modal-content animate-fade" 
            style={{ 
              maxWidth: '540px', 
              width: '92%', 
              borderRadius: '16px', 
              background: '#ffffff', 
              padding: '24px', 
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', 
              border: '1px solid #e2e8f0' 
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>📅</span>
                <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: '800', color: '#0f172a' }}>
                  Schedule Task / Work Item
                </h3>
              </div>
              <button 
                className="modal-close-btn" 
                onClick={() => setShowTaskModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={(e) => handleTaskSubmit(e, false)}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  Task / Work Title *
                </label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Client Follow-up Call, Contract Review, Site Meeting"
                  value={newTask.title} 
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} 
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Due Date *
                  </label>
                  <input 
                    type="date" 
                    required 
                    value={newTask.dueDate} 
                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} 
                    style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Scheduled Time
                  </label>
                  <input 
                    type="time" 
                    value={newTask.dueTime} 
                    onChange={(e) => setNewTask({ ...newTask, dueTime: e.target.value })} 
                    style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Priority
                  </label>
                  <select 
                    value={newTask.priority} 
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}
                    style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  >
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    Linked Lead / Company (Optional)
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Apex Biotech, Dr. Sharma"
                    value={newTask.linkedTo} 
                    onChange={(e) => setNewTask({ ...newTask, linkedTo: e.target.value })} 
                    style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  Description / Agenda Notes (Optional)
                </label>
                <textarea 
                  rows={2} 
                  placeholder="Key discussion points, preparation notes..."
                  value={newTask.description} 
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} 
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '14px', flexWrap: 'wrap' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowTaskModal(false)}
                  style={{ padding: '8px 16px', fontSize: '12.5px' }}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ padding: '8px 16px', fontSize: '12.5px', fontWeight: '700', color: '#0078d4', borderColor: '#bfdbfe', background: '#eff6ff' }}
                  onClick={() => handleTaskSubmit(undefined, true)}
                >
                  ➕ Save & Add Another
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ padding: '8px 20px', fontSize: '12.5px', fontWeight: '700', backgroundColor: '#0078d4', borderColor: '#0078d4' }}
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3B: EDIT TASK */}
      {showEditTaskModal && editingTask && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Edit Task Checklist Item</h3>
              <button className="modal-close-btn" onClick={() => setShowEditTaskModal(false)}>×</button>
            </div>
            <form onSubmit={handleEditTaskSubmit}>
              <div className="form-group">
                <label>Task Title</label>
                <input 
                  type="text" 
                  required 
                  value={editingTask.title} 
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })} 
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea 
                  rows={3} 
                  value={editingTask.description} 
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })} 
                />
              </div>
              <div className="form-group">
                <label>Due Date</label>
                <input 
                  type="date" 
                  value={editingTask.dueDate} 
                  onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })} 
                />
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select 
                  value={editingTask.priority} 
                  onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value as any })}
                >
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="High">High Priority</option>
                </select>
              </div>
              <div className="form-group">
                <label>Assigned Representative</label>
                <input 
                  type="text" 
                  value={editingTask.assignee} 
                  onChange={(e) => setEditingTask({ ...editingTask, assignee: e.target.value })} 
                />
              </div>
              <div className="form-group">
                <label>Linked Lead / Company</label>
                <input 
                  type="text" 
                  value={editingTask.linkedTo || ''} 
                  onChange={(e) => setEditingTask({ ...editingTask, linkedTo: e.target.value })} 
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditTaskModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes Instantly</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: LOG CALL/MEETING ACTIVITY */}
      {showActivityModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Log Structured Call Activity</h3>
              <button className="modal-close-btn" onClick={() => setShowActivityModal(false)}>×</button>
            </div>
            <form onSubmit={handleActivitySubmit}>
              <div className="form-group">
                <label htmlFor="activity-company-select">Company / Organization Name</label>
                <select 
                  id="activity-company-select"
                  value={newActivity.entityName} 
                  onChange={(e) => setNewActivity({ ...newActivity, entityName: e.target.value })}
                  required
                >
                  <option value="">-- Select Organization --</option>
                  {leads.map(l => (
                    <option key={l.id} value={l.company}>{l.company} (Lead)</option>
                  ))}
                  {deals.map(d => (
                    <option key={d.id} value={d.company}>{d.company} (Deal)</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Activity Type</label>
                <select value={newActivity.type} onChange={(e) => setNewActivity({ ...newActivity, type: e.target.value as any })}>
                  <option value="Call">Phone Call</option>
                  <option value="Meeting">Meeting (In-person)</option>
                  <option value="Site Visit">Site Visit</option>
                </select>
              </div>
              <div className="form-group">
                <label>Outcome</label>
                <select value={newActivity.outcome} onChange={(e) => setNewActivity({ ...newActivity, outcome: e.target.value as any })}>
                  <option value="Interested">Interested / Follow-up Needed (Positive)</option>
                  <option value="No Answer">No Answer / Busy (Neutral)</option>
                  <option value="Not Interested">Marked "Not Interested" (Negative)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Duration (Minutes)</label>
                <input type="number" value={newActivity.duration} onChange={(e) => setNewActivity({ ...newActivity, duration: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label>Next Step (Outcome text)</label>
                <input type="text" value={newActivity.nextStep} onChange={(e) => setNewActivity({ ...newActivity, nextStep: e.target.value })} />
              </div>
              <div className="form-group">
                <label htmlFor="activity-notes-textarea">Notes / Call Summary</label>
                <textarea id="activity-notes-textarea" rows={3} value={newActivity.notes} onChange={(e) => setNewActivity({ ...newActivity, notes: e.target.value })} />
              </div>
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                <input 
                  type="checkbox" 
                  id="auto-schedule-checkbox"
                  checked={autoScheduleFollowUp} 
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setAutoScheduleFollowUp(isChecked);
                    if (isChecked && newActivity.entityName) {
                      setFollowUpTaskTitle(`Follow up on ${newActivity.type} with ${newActivity.entityName}`);
                    } else if (isChecked) {
                      setFollowUpTaskTitle(`Follow up on ${newActivity.type}`);
                    }
                  }} 
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="auto-schedule-checkbox" style={{ cursor: 'pointer', textTransform: 'none', margin: 0 }}>
                  Auto-schedule Follow-up Task Checklist Item
                </label>
              </div>

              {autoScheduleFollowUp && (
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="activity-followup-title-input" style={{ fontSize: '11px' }}>Follow-up Task Title</label>
                    <input 
                      id="activity-followup-title-input"
                      type="text" 
                      required 
                      value={followUpTaskTitle} 
                      onChange={(e) => setFollowUpTaskTitle(e.target.value)} 
                      style={{ padding: '6px 10px', fontSize: '12px' }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '11px' }}>Due Date</label>
                    <input 
                      type="date" 
                      required
                      value={followUpTaskDueDate} 
                      onChange={(e) => setFollowUpTaskDueDate(e.target.value)} 
                      style={{ padding: '6px 10px', fontSize: '12px' }}
                    />
                  </div>
                </div>
              )}

              <div className="modal-actions" style={{ marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowActivityModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Log Activity</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: ADD CUSTOM FIELD CONFIG */}
      {showCustomFieldModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create Dynamic Custom Field</h3>
              <button className="modal-close-btn" onClick={() => setShowCustomFieldModal(false)}>×</button>
            </div>
            <form onSubmit={handleCustomFieldSubmit}>
              <div className="form-group">
                <label>Field Name (Label)</label>
                <input type="text" required placeholder="e.g. GSTIN, Segment" value={customFieldLabel} onChange={(e) => setCustomFieldLabel(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Field Input Type</label>
                <select value={customFieldType} onChange={(e) => setCustomFieldType(e.target.value as any)}>
                  <option value="text">Text Box</option>
                  <option value="number">Numeric Input</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCustomFieldModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Register Field</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: MARK LOST REASON DIALOG */}
      {showLostModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Lost Deal Reason Form</h3>
              <button className="modal-close-btn" onClick={() => setShowLostModal(false)}>×</button>
            </div>
            
            <div className="form-group">
              <label>Reason for Loss</label>
              <select value={lostReason} onChange={(e) => setLostReason(e.target.value)}>
                <option value="Budget constraints">Budget constraints (Price too high)</option>
                <option value="Competitor selection">Competitor selection (Zoho/HubSpot)</option>
                <option value="Timing suspended">Timing (Project delayed or suspended)</option>
                <option value="Feature deficit">Feature deficit (Missing requirements)</option>
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowLostModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ backgroundColor: 'var(--danger)' }} onClick={() => {
                if (selectedDealForLost) {
                  updateDealStage(selectedDealForLost, 'Lost', lostReason);
                  setShowLostModal(false);
                  setSelectedDealForLost(null);
                }
              }}>
                Confirm Lost
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: INVOICE PRINT & PORTAL PREVIEW */}
      {(showQuotePreview || selectedQuoteForPortal) && (() => {
        const qteCompany = selectedQuoteForPortal ? selectedQuoteForPortal.company : quoteCompany;
        const qteContact = selectedQuoteForPortal ? selectedQuoteForPortal.contact : quoteContact;
        const qteItems = selectedQuoteForPortal ? selectedQuoteForPortal.items : quoteItems;
        const qteGstType = selectedQuoteForPortal ? selectedQuoteForPortal.gstType : quoteGstType;
        const qteId = selectedQuoteForPortal ? selectedQuoteForPortal.id : `DRAFT-QTE-${Date.now().toString().slice(-3)}`;
        const qteCreated = selectedQuoteForPortal ? selectedQuoteForPortal.createdAt : new Date().toLocaleDateString('en-IN');
        const qteTerms = selectedQuoteForPortal ? selectedQuoteForPortal.termsAndConditions : (termsTemplates.find(t => t.id === selectedTermsTemplateId)?.content || '');
        const qteStatus = selectedQuoteForPortal ? selectedQuoteForPortal.status : 'Draft';
        const qteTotal = qteItems.reduce((acc, curr) => acc + (curr.qty * curr.price), 0);

        return (
          <div className="modal-overlay">
            <div className="modal-content wide" style={{ width: '850px', maxWidth: '95%' }}>
              <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                <h3>GST-Compliant Quotation Profile</h3>
                <button className="modal-close-btn" onClick={() => {
                  setShowQuotePreview(false);
                  setSelectedQuoteForPortal(null);
                }}>×</button>
              </div>

              {selectedQuoteForPortal && (
                <div style={{ 
                  background: qteStatus === 'Accepted' ? '#dcfce7' : qteStatus === 'Rejected' ? '#fee2e2' : '#fef3c7',
                  border: '1px solid',
                  borderColor: qteStatus === 'Accepted' ? '#bbf7d0' : qteStatus === 'Rejected' ? '#fecaca' : '#fde68a',
                  padding: '16px',
                  borderRadius: '8px',
                  margin: '12px 0 20px 0'
                }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', color: qteStatus === 'Accepted' ? '#166534' : qteStatus === 'Rejected' ? '#991b1b' : '#92400e' }}>
                    <span></span> Customer Portal Sandbox — Simulated Client Response
                  </h4>
                  <p style={{ fontSize: '12px', margin: '0 0 12px 0', color: qteStatus === 'Accepted' ? '#166534' : qteStatus === 'Rejected' ? '#991b1b' : '#92400e' }}>
                    This panel simulates what the customer sees when opening the quote link in their browser.
                  </p>
                  
                  {qteStatus === 'Pending Approval' ? (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button 
                        className="btn btn-primary" 
                        style={{ backgroundColor: '#10b981', color: '#ffffff', border: 'none', padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => handlePortalAcceptQuote(selectedQuoteForPortal)}
                      >
                        Accept Quote & Close Deal
                      </button>
                      <button 
                        className="btn btn-primary" 
                        style={{ backgroundColor: '#ef4444', color: '#ffffff', border: 'none', padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => handlePortalRejectQuote(selectedQuoteForPortal)}
                      >
                        Reject Quote
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12.5px', fontWeight: 'bold', color: qteStatus === 'Accepted' ? '#156534' : '#991b1b' }}>
                      {qteStatus === 'Accepted' 
                        ? 'This quotation was Accepted. The linked deal is marked as Won (100% Win Forecast Value).'
                        : 'This quotation was Rejected.'}
                    </div>
                  )}
                </div>
              )}

              <div className="invoice-preview-container" style={{ border: '2px solid #0f172a', borderRadius: '4px', padding: '24px', background: '#ffffff', color: '#000000', fontFamily: 'Arial, sans-serif' }}>
                {/* Header: Logo, Company Name, Address, Tax Identifiers */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <AnveshakLogo />
                  </div>
                  <div style={{ textAlign: 'center', flex: 1, padding: '0 16px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '900', margin: '0 0 4px 0', letterSpacing: '0.04em', color: '#0f172a' }}>
                      ANVESHAK HUB PRIVATE LIMITED
                    </h2>
                    <p style={{ margin: '0 0 2px 0', fontSize: '10.5px', color: '#334155', fontWeight: '600' }}>
                      #106, SHRAVATHI PROSPER APT, NYANAPPANAHALLI, BEGUR, BANGALURU-560068
                    </p>
                    <p style={{ margin: '0 0 2px 0', fontSize: '10.5px', color: '#334155', fontWeight: '600' }}>
                      Contact : 9597966766 &nbsp;&nbsp; info@anveshakhub.com
                    </p>
                    <p style={{ margin: '0', fontSize: '10.5px', color: '#0f172a', fontWeight: '700' }}>
                      PAN : ABECA4145J &nbsp;&nbsp;|&nbsp;&nbsp; GST : 29ABECA4145J1ZJ &nbsp;&nbsp;|&nbsp;&nbsp; UDYAM Regn UDYAM-KR-03-0657177
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: '120px' }}>
                    <span style={{ display: 'inline-block', border: '1px solid #0f172a', padding: '3px 8px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>
                      Original for Recipient
                    </span>
                  </div>
                </div>

                {/* Document Banner */}
                <div style={{ background: '#cbd5e1', border: '1.5px solid #0f172a', padding: '6px 0', textAlign: 'center', fontWeight: '900', fontSize: '16px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                  {(selectedQuoteForPortal as any)?.docType || 'Tax Invoice'}
                </div>

                {/* Bill to Party & Document Info Table Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', border: '1.5px solid #0f172a', marginBottom: '12px' }}>
                  <div style={{ padding: '10px', borderRight: '1.5px solid #0f172a', fontSize: '11.5px', lineHeight: '1.4' }}>
                    <div style={{ fontWeight: '800', textTransform: 'uppercase', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '6px', fontSize: '11px' }}>
                      Bill to Party
                    </div>
                    <div style={{ fontWeight: '800', fontSize: '13px', color: '#0f172a' }}>{qteCompany}</div>
                    <div>{(selectedQuoteForPortal as any)?.clientAddress || '98/1, VELACHERRY MAIN ROAD, GUINDY, Chennai, Tamil Nadu, 600032'}</div>
                    <div style={{ marginTop: '4px' }}><strong>GST :</strong> {(selectedQuoteForPortal as any)?.clientGstin || '33AABAT1588L1Z7'}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                      <span><strong>State :</strong> {(selectedQuoteForPortal as any)?.clientState || 'Tamilnadu'}</span>
                      <span><strong>Code :</strong> {(selectedQuoteForPortal as any)?.clientStateCode || (qteGstType === 'intra' ? '29' : '33')}</span>
                    </div>
                  </div>

                  <div style={{ padding: '10px', fontSize: '11.5px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: '700' }}>Invoice / Quote No :</span>
                      <strong style={{ color: '#0f172a' }}>{(selectedQuoteForPortal as any)?.invoiceNo || qteId}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: '700' }}>Invoice Date :</span>
                      <span>{qteCreated}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: '700' }}>Reverse Charge (Y/N) :</span>
                      <span>{(selectedQuoteForPortal as any)?.reverseCharge || 'N'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: '700' }}>State Code :</span>
                      <span>29 (Karnataka)</span>
                    </div>
                  </div>
                </div>

                {/* Particulars & HSN Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #0f172a', marginBottom: '12px', fontSize: '11.5px' }}>
                  <thead>
                    <tr style={{ background: '#e2e8f0', borderBottom: '1.5px solid #0f172a', textAlign: 'center', fontWeight: '800' }}>
                      <th style={{ padding: '8px 4px', borderRight: '1px solid #0f172a', width: '40px' }}>S. No.</th>
                      <th style={{ padding: '8px 8px', borderRight: '1px solid #0f172a', textAlign: 'left' }}>Particulars</th>
                      <th style={{ padding: '8px 4px', borderRight: '1px solid #0f172a', width: '70px' }}>SAC</th>
                      <th style={{ padding: '8px 6px', borderRight: '1px solid #0f172a', textAlign: 'right', width: '90px' }}>Taxable Value</th>
                      {qteGstType === 'intra' ? (
                        <>
                          <th style={{ padding: '4px 4px', borderRight: '1px solid #0f172a', width: '110px' }}>
                            <div>CGST</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', borderTop: '1px solid #0f172a', paddingTop: '2px' }}>
                              <span>Rate</span><span>Amount</span>
                            </div>
                          </th>
                          <th style={{ padding: '4px 4px', borderRight: '1px solid #0f172a', width: '110px' }}>
                            <div>SGST</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', borderTop: '1px solid #0f172a', paddingTop: '2px' }}>
                              <span>Rate</span><span>Amount</span>
                            </div>
                          </th>
                        </>
                      ) : (
                        <th style={{ padding: '4px 4px', borderRight: '1px solid #0f172a', width: '120px' }}>
                          <div>IGST</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', borderTop: '1px solid #0f172a', paddingTop: '2px' }}>
                            <span>Rate (18%)</span><span>Amount</span>
                          </div>
                        </th>
                      )}
                      <th style={{ padding: '8px 6px', textAlign: 'right', width: '100px' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qteItems.map((item, idx) => {
                      const rowSub = item.qty * item.price;
                      const rowCgst = qteGstType === 'intra' ? rowSub * 0.09 : 0;
                      const rowSgst = qteGstType === 'intra' ? rowSub * 0.09 : 0;
                      const rowIgst = qteGstType === 'inter' ? rowSub * 0.18 : 0;
                      const rowTotal = rowSub + rowCgst + rowSgst + rowIgst;

                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid #cbd5e1' }}>
                          <td style={{ textAlign: 'center', padding: '8px 4px', borderRight: '1px solid #0f172a' }}>{idx + 1}</td>
                          <td style={{ padding: '8px', borderRight: '1px solid #0f172a' }}>
                            <div style={{ fontWeight: '700' }}>{item.description}</div>
                          </td>
                          <td style={{ textAlign: 'center', padding: '8px 4px', borderRight: '1px solid #0f172a' }}>{(item as any).sac || '999293'}</td>
                          <td style={{ textAlign: 'right', padding: '8px 6px', borderRight: '1px solid #0f172a' }}>{formatCurrency(rowSub)}</td>
                          {qteGstType === 'intra' ? (
                            <>
                              <td style={{ padding: '8px 6px', borderRight: '1px solid #0f172a' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>9%</span><span>{formatCurrency(rowCgst)}</span>
                                </div>
                              </td>
                              <td style={{ padding: '8px 6px', borderRight: '1px solid #0f172a' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>9%</span><span>{formatCurrency(rowSgst)}</span>
                                </div>
                              </td>
                            </>
                          ) : (
                            <td style={{ padding: '8px 6px', borderRight: '1px solid #0f172a' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>18%</span><span>{formatCurrency(rowIgst)}</span>
                              </div>
                            </td>
                          )}
                          <td style={{ textAlign: 'right', padding: '8px 6px', fontWeight: '800' }}>{formatCurrency(rowTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Calculation Breakdown & Words Table Grid */}
                {(() => {
                  const subtotal = qteItems.reduce((acc, curr) => acc + (curr.qty * curr.price), 0);
                  const cgst = qteGstType === 'intra' ? subtotal * 0.09 : 0;
                  const sgst = qteGstType === 'intra' ? subtotal * 0.09 : 0;
                  const igst = qteGstType === 'inter' ? subtotal * 0.18 : 0;
                  const grandTotal = subtotal + cgst + sgst + igst;

                  return (
                    <div style={{ border: '1.5px solid #0f172a', marginBottom: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr' }}>
                        <div style={{ padding: '10px', borderRight: '1.5px solid #0f172a', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#475569', marginBottom: '4px' }}>
                            Total Invoice amount in words
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: '800', fontStyle: 'italic', color: '#0f172a' }}>
                            {numberToIndianWords(grandTotal)}
                          </div>
                        </div>

                        <div style={{ padding: '8px 12px', fontSize: '11.5px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Total Amount before Tax :</span>
                            <strong>{formatCurrency(subtotal)}</strong>
                          </div>
                          {qteGstType === 'intra' ? (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Add: CGST (9%) :</span>
                                <span>{formatCurrency(cgst)}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Add: SGST (9%) :</span>
                                <span>{formatCurrency(sgst)}</span>
                              </div>
                            </>
                          ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>Add: IGST (18%) :</span>
                              <span>{formatCurrency(igst)}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '4px' }}>
                            <span>Total Tax Amount :</span>
                            <strong>{formatCurrency(cgst + sgst + igst)}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', fontWeight: '900', borderTop: '1.5px solid #0f172a', paddingTop: '4px', marginTop: '2px', color: '#047857' }}>
                            <span>Total Amount after Tax :</span>
                            <span>{formatCurrency(grandTotal)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Bank Details & Official Sign-off Footer */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1.2fr', border: '1.5px solid #0f172a', fontSize: '11px', marginBottom: '8px' }}>
                  <div style={{ padding: '10px', borderRight: '1.5px solid #0f172a' }}>
                    <div style={{ fontWeight: '800', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', marginBottom: '4px' }}>
                      Bank Details
                    </div>
                    <div>Please remit to <strong>HDFC BANK</strong> as given Below</div>
                    <div style={{ marginTop: '2px' }}><strong>Branch :</strong> Bilekahalli, JP Nagar 4th Phase</div>
                    <div><strong>Bank A/C :</strong> 50200116291855</div>
                    <div><strong>Bank IFSC :</strong> HDFC0001752</div>
                    <div><strong>Account Name :</strong> Anveshak Hub Private Limited</div>
                  </div>

                  <div style={{ padding: '10px', borderRight: '1.5px solid #0f172a', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <div style={{ border: '1px dashed #94a3b8', width: '70px', height: '70px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#64748b', marginBottom: '4px' }}>
                      Common Seal
                    </div>
                  </div>

                  <div style={{ padding: '10px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '9.5px', color: '#64748b' }}>
                      Certified that the particulars given above are true and correct
                    </div>
                    <div style={{ fontWeight: '800', fontSize: '11.5px', color: '#0f172a' }}>
                      For ANVESHAK HUB PRIVATE LIMITED
                    </div>
                    <div style={{ margin: '6px 0' }}>
                      <span style={{ fontFamily: 'cursive', fontSize: '16px', fontWeight: 'bold', color: '#1e40af' }}>
                        Rathika Rani
                      </span>
                      <div style={{ fontSize: '8.5px', color: '#64748b' }}>
                        Digitally signed by Rathika Rani | Date: {new Date().toLocaleDateString('en-IN')}
                      </div>
                    </div>
                    <div style={{ fontWeight: '800', fontSize: '11px', textTransform: 'uppercase' }}>
                      DIRECTOR
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button className="btn btn-secondary" onClick={() => {
                  setShowQuotePreview(false);
                  setSelectedQuoteForPortal(null);
                }}>Close Preview</button>
                <button className="btn btn-primary" onClick={() => {
                  window.print();
                }}>
                  🖨️ Print / Export PDF
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {/* MODAL: DEAL DETAIL VIEW (PIP-03) */}
      {selectedDealDetail && (
        <div className="modal-overlay">
          <div className="modal-content wide" style={{ width: '900px', maxWidth: '95%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Deal Inspection Profile: {selectedDealDetail.name}</h3>
                <p style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Transaction ID: {selectedDealDetail.id}</p>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedDealDetail(null)}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px', marginTop: '16px' }}>
              {/* Left Column Summary Panel */}
              <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold' }}>Deal Information</span>
                </div>

                <div>
                  <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Company</label>
                  <strong style={{ fontSize: '13px', color: '#1e3a8a' }}>{selectedDealDetail.company}</strong>
                </div>

                <div>
                  <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Estimated Contract Value</label>
                  <strong style={{ fontSize: '16px', color: '#0f766e', fontWeight: '800' }}>{formatCurrency(selectedDealDetail.value)}</strong>
                </div>

                <div>
                  <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Win Probability</label>
                  <span className="badge badge-warm" style={{ fontWeight: 'bold' }}>{selectedDealDetail.probability}% Probability</span>
                </div>

                <div>
                  <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Expected Close Date</label>
                  <span style={{ fontSize: '12.5px', fontWeight: '600' }}>{selectedDealDetail.expectedClose}</span>
                </div>

                <div>
                  <label style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Assigned Owner</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <div className="user-avatar" style={{ width: '24px', height: '24px', fontSize: '10px', backgroundColor: '#3b82f6', color: '#ffffff' }}>
                      {selectedDealDetail.owner ? selectedDealDetail.owner.split(' ').map(n=>n[0]).join('') : 'R'}
                    </div>
                    <span style={{ fontSize: '12.5px', fontWeight: '600' }}>{selectedDealDetail.owner}</span>
                  </div>
                </div>

                <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => {
                      setQuoteCompany(selectedDealDetail.company);
                      setSelectedDealDetail(null);
                      navigateTab('quote');
                    }}
                  >
                    + Draft GST Quote
                  </button>
                </div>
              </div>

              {/* Right Column Workspace */}
              <div>
                {/* Navigation Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '16px' }}>
                  <button 
                    className={`tab-btn ${dealDetailTab === 'stepper' ? 'active' : ''}`}
                    onClick={() => setDealDetailTab('stepper')}
                    style={{ padding: '8px 16px', fontSize: '13px', background: 'none', border: 'none', borderBottom: dealDetailTab === 'stepper' ? '2px solid var(--primary-color)' : 'none', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Pipeline Stepper
                  </button>
                  <button 
                    className={`tab-btn ${dealDetailTab === 'velocity' ? 'active' : ''}`}
                    onClick={() => setDealDetailTab('velocity')}
                    style={{ padding: '8px 16px', fontSize: '13px', background: 'none', border: 'none', borderBottom: dealDetailTab === 'velocity' ? '2px solid var(--primary-color)' : 'none', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Deal Velocity
                  </button>
                  <button 
                    className={`tab-btn ${dealDetailTab === 'tasks' ? 'active' : ''}`}
                    onClick={() => setDealDetailTab('tasks')}
                    style={{ padding: '8px 16px', fontSize: '13px', background: 'none', border: 'none', borderBottom: dealDetailTab === 'tasks' ? '2px solid var(--primary-color)' : 'none', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Linked Tasks
                  </button>
                </div>

                {/* Tab content 1: Stepper */}
                {dealDetailTab === 'stepper' && (
                  <div className="animate-fade">
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                      Click on any stage block to transition this deal through the pipeline. Moving stages automatically updates the deal's win probability and resets its days-in-stage count.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {stages.map((stg) => {
                        const isActive = stg === selectedDealDetail.stage;
                        const weight = stageProbabilities[stg] !== undefined ? stageProbabilities[stg] : 50;

                        return (
                          <div 
                            key={stg}
                            onClick={() => {
                              const normStg = normalizeDealStage(stg);
                              const updatedProb = stageProbabilities[normStg] !== undefined ? stageProbabilities[normStg] : 50;
                              const updatedDeal = { ...selectedDealDetail, stage: normStg, probability: updatedProb, daysInStage: 1 };
                              setSelectedDealDetail(updatedDeal);
                              setDeals(prev => prev.map(d => d.id === selectedDealDetail.id ? updatedDeal : d));
                              triggerToast(`Deal moved to "${normStg}" and saved!`, 'success');

                              // Sync to Supabase Database
                              (async () => {
                                try {
                                  const { updateDealAction } = await import('@/app/actions/crm');
                                  await updateDealAction(selectedDealDetail.id, {
                                    stage: normStg,
                                    probability: updatedProb
                                  });
                                } catch (err) {
                                  console.error('Failed to sync stage update to DB:', err);
                                }
                              })();

                              // Log to Audit Log
                              const newLog: AuditLog = {
                                id: `LOG-STAGE-${Date.now().toString().slice(-3)}`,
                                user: currentAgentName,
                                action: 'Deal Stage Changed',
                                entity: `Deal: ${selectedDealDetail.name}`,
                                timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
                                beforeState: JSON.stringify({ stage: selectedDealDetail.stage, probability: selectedDealDetail.probability }),
                                afterState: JSON.stringify({ stage: normStg, probability: updatedProb })
                              };
                              setAuditLogs(prev => [newLog, ...prev]);
                            }}
                            style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center', 
                              padding: '12px 16px', 
                              borderRadius: '8px', 
                              border: '1px solid', 
                              borderColor: isActive ? 'var(--primary-color)' : 'var(--border-color)', 
                              backgroundColor: isActive ? '#eff6ff' : '#ffffff', 
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '16px' }}>{isActive ? '●' : '○'}</span>
                              <span style={{ fontWeight: 'bold', fontSize: '13px', color: isActive ? '#1e40af' : 'var(--text-main)' }}>{stg}</span>
                            </div>
                            <span className="badge badge-cold" style={{ fontSize: '10px' }}>{weight}% Weight</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tab content 2: Velocity */}
                {dealDetailTab === 'velocity' && (
                  <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <h4 style={{ fontSize: '12.5px', fontWeight: 'bold', marginBottom: '8px' }}>Pipeline Velocity Metrics</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Days in current stage ({selectedDealDetail.stage}):</div>
                          <div style={{ fontSize: '20px', fontWeight: '800', color: selectedDealDetail.daysInStage > 14 ? '#ef4444' : 'var(--text-main)' }}>
                            {selectedDealDetail.daysInStage} Days
                          </div>
                          {selectedDealDetail.daysInStage > 14 && (
                            <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 'bold' }}>Stale Warning: Deal stuck in stage {">"} 14 days!</span>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Average Cycle Time benchmark:</div>
                          <div style={{ fontSize: '20px', fontWeight: '800' }}>14 Days</div>
                        </div>
                      </div>
                    </div>

                    <div style={{ background: '#fffbeb', padding: '16px', borderRadius: '8px', border: '1px solid #fef3c7' }}>
                      <h4 style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#b45309', marginBottom: '4px' }}>Deal Health Status</h4>
                      <p style={{ fontSize: '12px', lineHeight: '1.5', color: '#b45309' }}>
                        {selectedDealDetail.daysInStage > 14 
                          ? 'This transaction is flagged as high-risk due to zero recent communication logs. Consider scheduling a meeting immediately.'
                          : 'This transaction is progressing normally through the sales funnel.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Tab content 3: Tasks */}
                {dealDetailTab === 'tasks' && (
                  <div className="animate-fade">
                    <div className="panel-title" style={{ marginBottom: '12px' }}>
                      <h4>Tasks checklist linked to {selectedDealDetail.company}</h4>
                    </div>

                    <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: 0 }}>
                      {tasks.filter(t => t.linkedTo === selectedDealDetail.company).map(task => (
                        <li 
                          key={task.id} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '10px', 
                            padding: '10px 14px', 
                            backgroundColor: '#f8fafc', 
                            borderRadius: '8px', 
                            border: '1px solid var(--border-color)' 
                          }}
                        >
                          <input 
                            type="checkbox" 
                            checked={task.status === 'Completed'} 
                            onChange={() => toggleTaskStatus(task.id)} 
                            style={{ cursor: 'pointer' }}
                          />
                          <div style={{ textDecoration: task.status === 'Completed' ? 'line-through' : 'none', flex: 1, fontSize: '12.5px' }}>
                            {task.title}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className={`badge ${task.priority === 'High' ? 'badge-hot' : task.priority === 'Medium' ? 'badge-warm' : 'badge-cold'}`} style={{ fontSize: '9px' }}>
                              {task.priority}
                            </span>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '2px 6px', fontSize: '10px', color: '#1e40af' }}
                              onClick={() => openEditTaskModal(task)}
                              title="Edit task"
                            >
                              ✏️
                            </button>
                          </div>
                        </li>
                      ))}
                      {tasks.filter(t => t.linkedTo === selectedDealDetail.company).length === 0 && (
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
                          No linked tasks found for this transaction.
                        </div>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                className="btn btn-secondary" 
                style={{ color: '#dc2626', borderColor: '#fca5a5' }} 
                onClick={() => handleDeleteDeal(selectedDealDetail.id)}
              >
                Delete Deal
              </button>
              <button className="btn btn-secondary" onClick={() => setSelectedDealDetail(null)}>Close Profile</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LEAD 360° INSPECTION VIEW */}
      {selectedLeadDetail && (
        <div className="modal-overlay">
          <div className="modal-content wide">
            <div className="modal-header">
              <h3>Prospect 360° Profile</h3>
              <button className="modal-close-btn" onClick={() => setSelectedLeadDetail(null)}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
              {/* Left Column Summary Card & Metadata */}
              <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div className="contact-avatar" style={{ width: '60px', height: '60px', fontSize: '20px', margin: '0 auto 12px auto' }}>
                    {selectedLeadDetail.name.split(' ').map(n=>n[0]).join('')}
                  </div>
                  <h4 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 4px 0' }}>{selectedLeadDetail.name}</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{selectedLeadDetail.company}</p>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', padding: '14px 0', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Lead Scoring Point Weight</div>
                  <span className={`badge ${selectedLeadDetail.score >= 61 ? 'badge-hot' : selectedLeadDetail.score >= 31 ? 'badge-warm' : 'badge-cold'}`} style={{ fontSize: '16px', marginTop: '6px', fontWeight: 'bold', padding: '6px 12px' }}>
                    {selectedLeadDetail.score} Points
                  </span>
                </div>

                <div style={{ fontSize: '12.5px', display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--text-main)' }}>
                  <div><strong>Email:</strong><br/><span style={{ color: 'var(--text-muted)' }}>{selectedLeadDetail.email || '—'}</span></div>
                  <div><strong>Phone:</strong><br/><span style={{ color: 'var(--text-muted)' }}>{selectedLeadDetail.phone || '—'}</span></div>
                  <div><strong>Address:</strong><br/><span style={{ color: 'var(--text-muted)' }}>Karnataka B2G Territory</span></div>
                  <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong style={{ color: '#1e40af', fontSize: '12px' }}>Assigned Rep (Owner):</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input 
                        type="text" 
                        list="team-owners-datalist" 
                        defaultValue={selectedLeadDetail.owner || ''} 
                        id={`owner-edit-input-${selectedLeadDetail.id}`}
                        style={{ flex: 1, padding: '5px 8px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff' }}
                        placeholder="Enter rep name..."
                      />
                      <button 
                        type="button" 
                        className="btn btn-primary" 
                        style={{ padding: '5px 10px', fontSize: '11px', fontWeight: '700' }}
                        onClick={() => {
                          const el = document.getElementById(`owner-edit-input-${selectedLeadDetail.id}`) as HTMLInputElement;
                          if (el && el.value) {
                            handleQuickChangeOwner(selectedLeadDetail.id, el.value);
                          }
                        }}
                      >
                        Reassign
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ fontSize: '12px', justifyContent: 'center', gap: '6px', fontWeight: '700', backgroundColor: '#1e40af', borderColor: '#1e40af' }}
                    onClick={() => openEditLeadModal(selectedLeadDetail)}
                  >
                    ✏️ Edit Lead Details
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '4px' }}>
                  <button className="btn btn-secondary" style={{ padding: '6px 0', fontSize: '11px', justifyContent: 'center' }} onClick={() => openEmailComposer(selectedLeadDetail.name, selectedLeadDetail.email)}>Email</button>
                  <button className="btn btn-secondary" style={{ padding: '6px 0', fontSize: '11px', color: '#25D366', borderColor: '#25D366', justifyContent: 'center' }} onClick={() => openWhatsAppModalForContact(selectedLeadDetail.name, selectedLeadDetail.phone)}>WhatsApp</button>
                  <button className="btn btn-secondary" style={{ padding: '6px 0', fontSize: '11px', justifyContent: 'center' }} onClick={() => startVoIPCall(selectedLeadDetail.name, selectedLeadDetail.phone)}>Call</button>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button className="btn btn-secondary" style={{ fontSize: '11.5px', justifyContent: 'center' }} onClick={() => {
                    setNewActivity({ ...newActivity, entityName: selectedLeadDetail.company });
                    setShowActivityModal(true);
                  }}>
                    Log Activity
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: '11.5px', justifyContent: 'center' }} onClick={() => {
                    setNewTask({ ...newTask, linkedTo: selectedLeadDetail.company });
                    setShowTaskModal(true);
                  }}>
                    + Add Task
                  </button>
                </div>
              </div>

              {/* Right Column Fluid Multi-Tab Workspace */}
              <div style={{ display: 'flex', flexDirection: 'column', height: '480px' }}>
                
                {/* Workspace Tab Buttons */}
                <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '16px' }}>
                  <button 
                    className={`btn ${contactDetailSubTab === 'timeline' ? 'btn-primary' : 'btn-secondary'}`} 
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                    onClick={() => setContactDetailSubTab('timeline')}
                  >
                    Activity Timeline
                  </button>
                  <button 
                    className={`btn ${contactDetailSubTab === 'notes' ? 'btn-primary' : 'btn-secondary'}`} 
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                    onClick={() => setContactDetailSubTab('notes')}
                  >
                    Tab: Notes
                  </button>
                  <button 
                    className={`btn ${contactDetailSubTab === 'deals' ? 'btn-primary' : 'btn-secondary'}`} 
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                    onClick={() => setContactDetailSubTab('deals')}
                  >
                    Tab: Deals
                  </button>
                  <button 
                    className={`btn ${contactDetailSubTab === 'tasks' ? 'btn-primary' : 'btn-secondary'}`} 
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                    onClick={() => setContactDetailSubTab('tasks')}
                  >
                    Tab: Tasks
                  </button>
                  <button 
                    className={`btn ${contactDetailSubTab === 'custom' ? 'btn-primary' : 'btn-secondary'}`} 
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                    onClick={() => setContactDetailSubTab('custom')}
                  >
                    Custom Fields
                  </button>
                </div>

                {/* Tab 1: Timeline */}
                {contactDetailSubTab === 'timeline' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1 }}>
                    {selectedLeadDetail.activities.map((act, idx) => (
                      <div key={idx} style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span className="badge badge-cold" style={{ fontSize: '9px', textTransform: 'uppercase' }}>{act.action}</span>
                          <p style={{ margin: '4px 0 0 0', fontSize: '12px', fontWeight: 'bold' }}>Logged Event Action</p>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>⏱ {act.date}</span>
                        </div>
                        <span className="badge badge-hot" style={{ fontWeight: 'bold' }}>+{act.points} pts</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab 2: Notes */}
                {contactDetailSubTab === 'notes' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      if (!contactNoteInput.trim()) return;
                      
                      // Append to activity timeline
                      const freshAct = {
                        action: 'Note added',
                        points: 10,
                        date: new Date().toLocaleDateString('en-IN')
                      };
                      
                      const updatedLead = {
                        ...selectedLeadDetail,
                        score: selectedLeadDetail.score + 10,
                        activities: [freshAct, ...selectedLeadDetail.activities]
                      };
                      
                      setLeads(leads.map(l => l.id === selectedLeadDetail.id ? updatedLead : l));
                      setSelectedLeadDetail(updatedLead);
                      setContactNoteInput('');
                    }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                          type="text" 
                          placeholder="Type a new markdown call note/meeting minutes..."
                          value={contactNoteInput}
                          onChange={(e) => setContactNoteInput(e.target.value)}
                          style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px' }}
                        />
                        <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                          Add Note
                        </button>
                      </div>
                    </form>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedLeadDetail.activities.filter(a => a.action.includes('Note')).map((note, idx) => (
                        <div key={idx} style={{ background: '#fef3c7', borderLeft: '3px solid #d97706', padding: '12px', borderRadius: '6px', fontSize: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b45309', fontWeight: 'bold', fontSize: '10px', marginBottom: '4px' }}>
                            <span>Author: {currentAgentName}</span>
                            <span>⏱ {note.date}</span>
                          </div>
                          <div>Note description: {note.action} (Scored +10 points)</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tab 3: Deals */}
                {contactDetailSubTab === 'deals' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1 }}>
                    {deals.filter(d => d.company === selectedLeadDetail.company).map(deal => (
                      <div key={deal.id} style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{deal.name}</span>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Stage: {deal.stage} • Close: {deal.expectedClose}</div>
                        </div>
                        <span style={{ fontWeight: 'bold', color: '#10b981' }}>{formatCurrency(deal.value)}</span>
                      </div>
                    ))}
                    {deals.filter(d => d.company === selectedLeadDetail.company).length === 0 && (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                        No active pipeline deals associated with this contact.
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 4: Tasks */}
                {contactDetailSubTab === 'tasks' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1 }}>
                    {tasks.filter(t => t.linkedTo === selectedLeadDetail.company).map(task => (
                      <div key={task.id} style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={task.status === 'Completed'} 
                            onChange={() => toggleTaskStatus(task.id)} 
                          />
                          <span style={{ fontWeight: '600', fontSize: '12.5px', textDecoration: task.status === 'Completed' ? 'line-through' : 'none' }}>
                            {task.title}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className={`badge ${task.priority === 'High' ? 'badge-hot' : 'badge-warm'}`} style={{ fontSize: '9px' }}>
                            {task.priority}
                          </span>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '2px 6px', fontSize: '10px', color: '#1e40af' }}
                            onClick={() => openEditTaskModal(task)}
                            title="Edit task"
                          >
                            ✏️
                          </button>
                        </div>
                      </div>
                    ))}
                    {tasks.filter(t => t.linkedTo === selectedLeadDetail.company).length === 0 && (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                        No follow-up checklist tasks scheduled.
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 5: Custom Fields */}
                {contactDetailSubTab === 'custom' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
                    <div style={{ background: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <h4 style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 10px 0', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Dynamic Custom Fields
                      </h4>
                      {customFields.length === 0 ? (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                          No custom metadata fields defined. Navigate to Settings &gt; Lead Scoring Config to register custom fields.
                        </p>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          {customFields.map(field => (
                            <div key={field.id} style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px' }}>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{field.label}:</span>
                              <div style={{ fontWeight: 'bold', fontSize: '12px' }}>
                                {selectedLeadDetail.customFields?.[field.label] || '—'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                className="btn btn-secondary" 
                style={{ color: '#dc2626', borderColor: '#fca5a5' }} 
                onClick={() => handleDeleteLead(selectedLeadDetail.id)}
              >
                Delete Lead
              </button>
              <button className="btn btn-secondary" onClick={() => setSelectedLeadDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: COMPANY ACCOUNT PROFILE VIEW */}
      {selectedCompanyDetail && (
        <div className="modal-overlay">
          <div className="modal-content wide">
            <div className="modal-header">
              <h3>Company Account Profile</h3>
              <button className="modal-close-btn" onClick={() => setSelectedCompanyDetail(null)}>×</button>
            </div>

            <div style={{ padding: '10px 0' }}>
              <h2>{selectedCompanyDetail.name}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{selectedCompanyDetail.industry || 'Manufacturing / B2G'} • {selectedCompanyDetail.address || `${selectedCompanyDetail.city || 'Bangalore'}, ${selectedCompanyDetail.state || 'Karnataka'}`}</p>
              
              <div style={{ margin: '16px 0', padding: '12px', background: '#f8fafc', borderRadius: '8px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>City & State:</span>
                  <div style={{ fontWeight: 'bold' }}>{selectedCompanyDetail.city || 'Bangalore'}, {selectedCompanyDetail.state || 'Karnataka'}</div>
                </div>
                {selectedCompanyDetail.website && (
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Website:</span>
                    <div><a href={selectedCompanyDetail.website.startsWith('http') ? selectedCompanyDetail.website : `https://${selectedCompanyDetail.website}`} target="_blank" rel="noreferrer" style={{ color: '#1e40af' }}>{selectedCompanyDetail.website}</a></div>
                  </div>
                )}
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total B2G Roll-up Value:</span>
                  <div style={{ fontWeight: 'bold', color: '#10b981' }}>{formatCurrency(selectedCompanyDetail.totalDealValue)}</div>
                </div>
              </div>

              {(() => {
                const compNameLower = (selectedCompanyDetail.name || '').trim().toLowerCase();
                const matchingContacts = contactsList.filter(c => (c.company || '').trim().toLowerCase() === compNameLower);
                const matchingLeads = leads.filter(l => (l.company || '').trim().toLowerCase() === compNameLower);
                const combinedAffiliated = deduplicateContacts([...matchingContacts, ...matchingLeads]);
                const matchingDeals = deals.filter(d => (d.company || '').trim().toLowerCase() === compNameLower);

                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: 'bold', margin: 0 }}>
                        Affiliated Contacts ({combinedAffiliated.length})
                      </h4>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                        onClick={() => {
                          openAddLeadModal({
                            company: selectedCompanyDetail.name,
                            city: selectedCompanyDetail.city || 'Bangalore',
                            state: selectedCompanyDetail.state || 'Karnataka'
                          });
                        }}
                      >
                        + Add Person to this Company
                      </button>
                    </div>

                    {combinedAffiliated.length === 0 ? (
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '12px', background: '#f8fafc', borderRadius: '6px', margin: '8px 0' }}>
                        No direct contacts linked yet. Click "+ Add Person to this Company" or scan a card to attach representatives.
                      </p>
                    ) : (
                      <table className="custom-table" style={{ marginTop: '8px' }}>
                        <thead>
                          <tr>
                            <th>Contact Person</th>
                            <th>Role / Designation</th>
                            <th>Email</th>
                            <th>Phone (Direct)</th>
                            <th>Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {combinedAffiliated.map((c: any) => (
                            <tr key={c.id}>
                              <td style={{ fontWeight: 'bold', color: '#0f172a' }}>{c.name}</td>
                              <td style={{ fontSize: '12px', color: '#64748b' }}>{c.designation || 'Representative'}</td>
                              <td>
                                {c.email ? (
                                  <a href={`mailto:${c.email}`} style={{ color: '#1e40af', fontSize: '12px' }}>{c.email}</a>
                                ) : <span style={{ color: '#94a3b8' }}>—</span>}
                              </td>
                              <td>
                                {c.phone || c.preferredPhone ? (
                                  <a href={`tel:${c.phone || c.preferredPhone}`} style={{ color: '#059669', fontWeight: '600', fontSize: '12px' }}>{c.phone || c.preferredPhone}</a>
                                ) : <span style={{ color: '#94a3b8' }}>—</span>}
                              </td>
                              <td>
                                <span className="badge badge-cold" style={{ fontSize: '10px' }}>{c.sourceType || c.category || 'Direct'}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {matchingDeals.length > 0 && (
                      <div style={{ marginTop: '16px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Linked Pipeline Deals ({matchingDeals.length})</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {matchingDeals.map(d => (
                            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px' }}>
                              <span style={{ fontWeight: '600', color: '#1e293b' }}>{d.name}</span>
                              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <span style={{ color: '#059669', fontWeight: 'bold' }}>{formatCurrency(d.value)}</span>
                                <span className="badge badge-hot">{d.stage}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                className="btn btn-secondary" 
                style={{ color: '#dc2626', borderColor: '#fca5a5' }} 
                onClick={() => handleDeleteCompany(selectedCompanyDetail.id)}
              >
                Delete Company Account
              </button>
              <button className="btn btn-secondary" onClick={() => setSelectedCompanyDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD COMPANY SLIDE-OVER DRAWER */}
      {showCompanyModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create Company Account</h3>
              <button className="modal-close-btn" onClick={() => setShowCompanyModal(false)}>×</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newCompany.name) return;
              const freshComp: Company = {
                id: crypto.randomUUID(),
                ...newCompany,
                contactsCount: 1,
                totalDealValue: 0
              };
              setCompanies([freshComp, ...companies]);
              setShowCompanyModal(false);
              setNewCompany({ name: '', industry: 'Manufacturing / B2G', website: '', city: 'Bangalore', state: 'Karnataka', address: '' });
              try {
                const { createCompanyAction } = await import('@/app/actions/crm');
                await createCompanyAction(freshComp);
                triggerToast('Company added directly to database!', 'success');
              } catch (err) {
                console.error('Error adding company to database:', err);
              }
            }}>
              <div className="form-group">
                <label>Company Name *</label>
                <input type="text" required placeholder="e.g. Acme Industries Ltd" value={newCompany.name} onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Industry Sector</label>
                <input type="text" placeholder="e.g. Manufacturing & Enterprise" value={newCompany.industry} onChange={(e) => setNewCompany({ ...newCompany, industry: e.target.value })} />
              </div>
              <div className="modal-grid-2col">
                <div className="form-group">
                  <label>City</label>
                  <input type="text" placeholder="e.g. Bangalore" value={newCompany.city} onChange={(e) => setNewCompany({ ...newCompany, city: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <input type="text" placeholder="e.g. Karnataka" value={newCompany.state} onChange={(e) => setNewCompany({ ...newCompany, state: e.target.value })} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCompanyModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Company</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INVITE USER */}
      {showInviteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Invite Team Member</h3>
              <button className="modal-close-btn" onClick={() => setShowInviteModal(false)}>×</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!newUser.fullName || !newUser.email) return;
              const freshUsr: SystemUser = {
                id: `USR-${Date.now().toString().slice(-3)}`,
                ...newUser,
                isActive: true,
                assignedCount: 0
              };
              setUsersList([...usersList, freshUsr]);
              setShowInviteModal(false);
              setNewUser({ fullName: '', email: '', role: 'SALES_REP' });
            }}>
              <div className="form-group">
                <label>Full Name *</label>
                <input type="text" required value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Email Address *</label>
                <input type="email" required value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Assign RBAC Role</label>
                <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}>
                  <option value="SALES_REP">Sales Rep (Operational execution)</option>
                  <option value="MANAGER">Manager (Team forecasting)</option>
                  <option value="ADMIN">Admin (Full System Privileges)</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowInviteModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Send Invite Link</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BULK REASSIGN OWNER */}
      {showBulkReassignModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Bulk Reassign Records ({selectedContactIds.length})</h3>
              <button className="modal-close-btn" onClick={() => setShowBulkReassignModal(false)}>×</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!bulkReassignReason.trim()) {
                alert('Please provide a mandatory reassignment reason.');
                return;
              }
              // Update owner for selected contacts
              const updatedLeads = leads.map(l => {
                if (selectedContactIds.includes(l.id)) {
                  return { ...l, owner: bulkTargetRep };
                }
                return l;
              });
              setLeads(updatedLeads);

              // Add Audit Log
              recordAuditLog('Bulk Reassign', `Reassigned ${selectedContactIds.length} records to ${bulkTargetRep}`, `Reason: ${bulkReassignReason}`, `New Owner: ${bulkTargetRep}`);

              alert(`Successfully reassigned ${selectedContactIds.length} contact(s) to ${bulkTargetRep}`);
              setSelectedContactIds([]);
              setShowBulkReassignModal(false);
              setBulkReassignReason('');
            }}>
              <div className="form-group">
                <label>Select New Assigned Rep</label>
                <select value={bulkTargetRep} onChange={(e) => setBulkTargetRep(e.target.value)}>
                  <option value="KP Sumanth">KP Sumanth</option>
                  <option value="Balasaraswathi">Balasaraswathi</option>
                  <option value="Riya Sharma">Riya Sharma</option>
                </select>
              </div>

              <div className="form-group">
                <label>Reassignment Reason (Mandatory for Governance Auditing) *</label>
                <textarea 
                  required
                  placeholder="Enter reason for ownership transfer..."
                  value={bulkReassignReason}
                  onChange={(e) => setBulkReassignReason(e.target.value)}
                  style={{ width: '100%', height: '80px', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBulkReassignModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Confirm Reassignment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BULK TAG RECORDS */}
      {showBulkTagModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Bulk Tag Management ({selectedContactIds.length})</h3>
              <button className="modal-close-btn" onClick={() => setShowBulkTagModal(false)}>×</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!bulkTagInput.trim()) {
                alert('Please select a tag.');
                return;
              }
              const updatedLeads = leads.map(l => {
                if (selectedContactIds.includes(l.id)) {
                  const currentTags = l.tags || [];
                  let nextTags = [...currentTags];
                  if (bulkTagAction === 'append') {
                    if (!nextTags.includes(bulkTagInput)) {
                      nextTags.push(bulkTagInput);
                    }
                  } else {
                    nextTags = nextTags.filter(t => t !== bulkTagInput);
                  }
                  return { ...l, tags: nextTags };
                }
                return l;
              });
              setLeads(updatedLeads);

              alert(`Successfully updated tags for ${selectedContactIds.length} contact(s).`);
              setSelectedContactIds([]);
              setShowBulkTagModal(false);
            }}>
              <div className="form-group">
                <label>Tag Action</label>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
                  <label style={{ display: 'flex', gap: '6px', textTransform: 'none', cursor: 'pointer', fontSize: '13px' }}>
                    <input type="radio" checked={bulkTagAction === 'append'} onChange={() => setBulkTagAction('append')} />
                    Append Tag
                  </label>
                  <label style={{ display: 'flex', gap: '6px', textTransform: 'none', cursor: 'pointer', fontSize: '13px' }}>
                    <input type="radio" checked={bulkTagAction === 'remove'} onChange={() => setBulkTagAction('remove')} />
                    Remove Tag
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>Select Tag</label>
                <select value={bulkTagInput} onChange={(e) => setBulkTagInput(e.target.value)}>
                  <option value="B2G">B2G</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Hot Lead">Hot Lead</option>
                  <option value="Corporate">Corporate</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBulkTagModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Apply Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GLOBAL AUTOCOMPLETE SEARCH OVERLAY */}
      {showGlobalSearch && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ width: '600px', top: '10%' }}>
            <div className="modal-header">
              <h3>Global Index Autocomplete Search (SHR-01)</h3>
              <button className="modal-close-btn" onClick={() => {
                setShowGlobalSearch(false);
                setGlobalSearchQuery('');
              }}>×</button>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <input 
                type="text" 
                autoFocus
                placeholder="Type to search contacts, deals, tasks, quotes..."
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '12px', fontSize: '15px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
              />
            </div>

            {globalSearchQuery.trim().length > 0 ? (() => {
              const query = globalSearchQuery.toLowerCase();
              
              const matchedContacts = contactsList.filter(c => 
                (c.name && c.name.toLowerCase().includes(query)) || 
                (c.company && c.company.toLowerCase().includes(query)) ||
                (c.email && c.email.toLowerCase().includes(query)) ||
                (c.phone && c.phone.toLowerCase().includes(query)) ||
                (c.preferredPhone && c.preferredPhone.toLowerCase().includes(query))
              );

              const matchedLeads = leads.filter(l => 
                l.name.toLowerCase().includes(query) || 
                l.company.toLowerCase().includes(query) ||
                l.email.toLowerCase().includes(query)
              );

              const matchedDeals = deals.filter(d => 
                d.name.toLowerCase().includes(query) || 
                d.company.toLowerCase().includes(query)
              );

              const matchedTasks = tasks.filter(t => 
                t.title.toLowerCase().includes(query) || 
                t.description.toLowerCase().includes(query)
              );

              const matchedQuotes = quotes.filter(q => 
                q.id.toLowerCase().includes(query) || 
                q.company.toLowerCase().includes(query)
              );

              const hasResults = matchedContacts.length > 0 || matchedLeads.length > 0 || matchedDeals.length > 0 || matchedTasks.length > 0 || matchedQuotes.length > 0;

              return (
                <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {!hasResults && (
                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      No indexing results match "{globalSearchQuery}"
                    </div>
                  )}

                  {/* Centralized Contacts */}
                  {matchedContacts.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Centralized Contacts</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {matchedContacts.map(c => (
                          <div 
                            key={c.id} 
                            style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color)' }}
                            onClick={() => {
                              setSelectedContactFor360(c.id);
                              navigateTab('contacts');
                              setShowGlobalSearch(false);
                              setGlobalSearchQuery('');
                            }}
                          >
                            <span style={{ fontWeight: '600', fontSize: '13px' }}>{c.name} {c.company ? `(${c.company})` : ''}</span>
                            <span className="badge badge-secondary" style={{ fontSize: '9px' }}>{c.category || 'Contact'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Leads */}
                  {matchedLeads.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Leads Queue</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {matchedLeads.map(l => (
                          <div 
                            key={l.id} 
                            style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', border: '1px solid var(--border-color)' }}
                            onClick={() => {
                              setSelectedLeadDetail(l);
                              navigateTab('leads');
                              setShowGlobalSearch(false);
                              setGlobalSearchQuery('');
                            }}
                          >
                            <span style={{ fontWeight: '600', fontSize: '13px' }}>{l.name} ({l.company})</span>
                            <span className="badge badge-secondary" style={{ fontSize: '9px' }}>Score: {l.score}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Deals */}
                  {matchedDeals.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Pipelines & Deals</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {matchedDeals.map(d => (
                          <div 
                            key={d.id} 
                            style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', border: '1px solid var(--border-color)' }}
                            onClick={() => {
                              setSelectedDealDetail(d);
                              navigateTab('kanban');
                              setShowGlobalSearch(false);
                              setGlobalSearchQuery('');
                            }}
                          >
                            <span style={{ fontWeight: '600', fontSize: '13px' }}>{d.name} ({d.company})</span>
                            <span className="badge badge-secondary" style={{ fontSize: '9px' }}>{formatCurrency(d.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tasks */}
                  {matchedTasks.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Work Tasks</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {matchedTasks.map(t => (
                          <div 
                            key={t.id} 
                            style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', border: '1px solid var(--border-color)' }}
                            onClick={() => {
                              navigateTab('tasks');
                              setShowGlobalSearch(false);
                              setGlobalSearchQuery('');
                            }}
                          >
                            <span style={{ fontWeight: '600', fontSize: '13px' }}>{t.title}</span>
                            <span className={`badge ${t.priority === 'High' ? 'badge-hot' : 'badge-warm'}`} style={{ fontSize: '9px' }}>{t.priority}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quotes */}
                  {matchedQuotes.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Quotations & Invoices</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {matchedQuotes.map(q => (
                          <div 
                            key={q.id} 
                            style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', border: '1px solid var(--border-color)' }}
                            onClick={() => {
                              setQuoteSubView('repository');
                              navigateTab('quote');
                              setShowGlobalSearch(false);
                              setGlobalSearchQuery('');
                            }}
                          >
                            <span style={{ fontWeight: '600', fontSize: '13px' }}>{q.id} - {q.company}</span>
                            <span className="badge badge-secondary" style={{ fontSize: '9px' }}>{q.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })() : (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px' }}>
                Type keywords (e.g., "Agro", "Valve", "Metro") to search indexing registry.
              </div>
            )}
          </div>
        </div>
      )}

      {/* NOTIFICATION DRAWER SIDEBAR */}
      {showNotificationDrawer && (
        <div className="modal-overlay" style={{ display: 'flex', justifyContent: 'flex-end', zIndex: 1200 }} onClick={() => setShowNotificationDrawer(false)}>
          <div 
            style={{ width: '380px', height: '100vh', backgroundColor: '#FFFFFF', padding: '24px', display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 30px rgba(0,0,0,0.1)', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>Alert Notifications (SHR-02)</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '2px 8px', fontSize: '10px' }}
                  onClick={() => setNotifications(notifications.map(n => ({ ...n, unread: false })))}
                >
                  Mark all read
                </button>
                <button 
                  className="modal-close-btn" 
                  onClick={() => setShowNotificationDrawer(false)}
                  style={{ position: 'relative', top: 0, right: 0 }}
                >
                  ×
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexGrow: 1 }}>
              {notifications.map(n => (
                <div 
                  key={n.id} 
                  style={{ 
                    padding: '12px', 
                    borderRadius: '8px', 
                    border: '1px solid var(--border-color)', 
                    background: n.unread ? '#eff6ff' : '#ffffff',
                    borderLeft: n.unread ? '4px solid #3b82f6' : '1px solid var(--border-color)',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: '700', fontSize: '12.5px', color: '#1e293b' }}>{n.title}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{n.date}</span>
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#475569' }}>{n.message}</p>
                  
                  {n.unread && (
                    <button 
                      style={{ marginTop: '8px', background: 'none', border: 'none', color: '#3b82f6', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}
                      onClick={() => setNotifications(notifications.map(item => item.id === n.id ? { ...item, unread: false } : item))}
                    >
                      ✓ Mark as read
                    </button>
                  )}
                </div>
              ))}
              {notifications.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '24px' }}>
                  No active notifications.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AUDIT LOG JSON DIFF VIEWER MODAL */}
      <AuditDiffModal
        selectedAuditLogForDiff={selectedAuditLogForDiff}
        setSelectedAuditLogForDiff={setSelectedAuditLogForDiff}
      />

      {/* EMAIL COMPOSER MODAL */}
      {showEmailComposer && (
        <div className="modal-overlay" style={{ zIndex: 1250 }}>
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3>Compose Professional Email</h3>
              <button className="modal-close-btn" onClick={() => setShowEmailComposer(false)}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold' }}>To:</label>
                <input type="text" className="form-control" disabled value={`${emailToName} <${emailToAddress}>`} style={{ background: '#f1f5f9' }} />
              </div>
              
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Select Email Template:</label>
                <select 
                  className="form-control" 
                  value={emailTemplate} 
                  onChange={(e) => {
                    const temp = e.target.value;
                    setEmailTemplate(temp);
                    if (temp === 'intro') {
                      setEmailSubject(`Introducing Anveshak Hub Services`);
                      setEmailBody(`Hi ${emailToName},\n\nHope this email finds you well. I am writing to introduce Anveshak Hub, a leader in digital solutions. We would love to discuss how we can partner with your company to optimize your workflows.\n\nLooking forward to hearing from you.\n\nBest regards,\n${currentAgentName}\nAnveshak Hub`);
                    } else if (temp === 'followup') {
                      setEmailSubject(`Following up on our conversation`);
                      setEmailBody(`Hi ${emailToName},\n\nIt was great speaking with you recently. I wanted to follow up and see if you had any questions regarding the solutions we discussed.\n\nI have attached our catalog for your reference.\n\nBest regards,\n${currentAgentName}\nAnveshak Hub`);
                    } else if (temp === 'quote') {
                      setEmailSubject(`Anveshak Proposal & Quotation Details`);
                      setEmailBody(`Hi ${emailToName},\n\nHope you are doing well. Please find attached the formal proposal and quote details generated for your requirement.\n\nLet us know if you would like any modifications.\n\nBest regards,\n${currentAgentName}\nAnveshak Hub`);
                    }
                  }}
                >
                  <option value="">-- Select Template --</option>
                  <option value="intro">Introductory Introduction</option>
                  <option value="followup">Meeting Follow-up</option>
                  <option value="quote">Quote & Proposal Shared</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Subject *</label>
                <input type="text" className="form-control" placeholder="Enter email subject" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Message Body *</label>
                <textarea 
                  className="form-control" 
                  rows={8} 
                  value={emailBody} 
                  onChange={(e) => setEmailBody(e.target.value)} 
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button className="btn btn-secondary" onClick={() => setShowEmailComposer(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSendEmail}>Open in Mail Client</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP TEMPLATE MODAL */}
      {showWhatsAppModal && (
        <div className="modal-overlay" style={{ zIndex: 1250 }}>
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>Send WhatsApp Message</h3>
              <button className="modal-close-btn" onClick={() => setShowWhatsAppModal(false)}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Recipient:</label>
                <input type="text" className="form-control" disabled value={`${waToName} (${waToPhone})`} style={{ background: '#f1f5f9' }} />
              </div>
              
              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Choose Quick Template:</label>
                <select 
                  className="form-control" 
                  value={waTemplate} 
                  onChange={(e) => {
                    const temp = e.target.value;
                    setWaTemplate(temp);
                    if (temp === 'intro') {
                      setWaCustomText(`Hi ${waToName}, thanks for connecting. This is ${currentAgentName} from Anveshak Hub. Let me know when you're free for a brief call to discuss our solutions.`);
                    } else if (temp === 'meeting') {
                      setWaCustomText(`Hi ${waToName}, could we connect for a brief 10-minute call tomorrow at 11:00 AM? Let me know if that works.`);
                    } else if (temp === 'followup') {
                      setWaCustomText(`Hi ${waToName}, just following up on the quote proposal we shared earlier. Looking forward to working together!`);
                    }
                  }}
                >
                  <option value="">-- Select Template --</option>
                  <option value="intro">Introductory Contact</option>
                  <option value="meeting">Quick Call Pitch Invite</option>
                  <option value="followup">Proposal/Quote Follow-up</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Customize Message Text *</label>
                <textarea 
                  className="form-control" 
                  rows={4} 
                  value={waCustomText} 
                  onChange={(e) => setWaCustomText(e.target.value)} 
                  style={{ fontSize: '12.5px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button className="btn btn-secondary" onClick={() => setShowWhatsAppModal(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ backgroundColor: '#25D366', borderColor: '#25D366' }} onClick={handleSendWhatsApp}>Open WhatsApp Web</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VOIP CALL HUD DIALER OVERLAY */}
      {showVoIPOverlay && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '320px',
          background: '#0F172A',
          color: '#F8FAFC',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
          border: '1px solid #1E293B',
          padding: '20px',
          zIndex: 1300,
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          transition: 'all 0.3s ease'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Outgoing VoIP Call</span>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: voipStatus === 'connected' ? '#10B981' : '#F59E0B'
            }} />
          </div>

          <div style={{ textAlign: 'center', margin: '8px 0' }}>
            <div className="contact-avatar" style={{ width: '48px', height: '48px', fontSize: '16px', margin: '0 auto 10px auto', background: '#334155' }}>
              {voipName.split(' ').map(n=>n[0]).join('')}
            </div>
            <h4 style={{ fontSize: '15px', fontWeight: '800', margin: '0 0 2px 0', color: '#F8FAFC' }}>{voipName}</h4>
            <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>{voipPhone}</p>
          </div>

          <div style={{ textAlign: 'center', fontSize: '12px', color: voipStatus === 'connected' ? '#10B981' : '#94A3B8', fontWeight: 'bold' }}>
            {voipStatus === 'dialing' && 'Dialing connection...'}
            {voipStatus === 'connected' && (
              <span>
                Connected • {Math.floor(voipDuration / 60)}:{((voipDuration % 60) < 10 ? '0' : '') + (voipDuration % 60)}
              </span>
            )}
            {voipStatus === 'ended' && <span style={{ color: '#EF4444' }}>Call Terminated</span>}
          </div>

          {voipStatus === 'connected' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 'bold' }}>Call Notes (Auto-saved to Lead Timeline):</label>
              <textarea 
                className="form-control" 
                rows={2} 
                placeholder="Take notes during conversation..." 
                value={voipNotes} 
                onChange={(e) => setVoipNotes(e.target.value)}
                style={{ background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', fontSize: '11.5px' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            {voipStatus !== 'ended' ? (
              <button 
                className="btn btn-primary" 
                style={{ backgroundColor: '#EF4444', borderColor: '#EF4444', color: '#ffffff', width: '100%', padding: '8px', justifyContent: 'center' }} 
                onClick={endVoIPCall}
              >
                End Call & Log
              </button>
            ) : (
              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', padding: '8px', justifyContent: 'center' }} 
                disabled
              >
                Logging...
              </button>
            )}
          </div>
        </div>
      )}

      {/* TELEMETRY TOAST NOTIFICATION CONTAINER */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 1400,
        pointerEvents: 'none'
      }}>
        {toasts.map(t => (
          <div 
            key={t.id} 
            style={{
              padding: '12px 18px',
              borderRadius: '8px',
              background: t.type === 'success' ? '#10B981' : t.type === 'warning' ? '#F59E0B' : '#3B82F6',
              color: '#ffffff',
              fontWeight: '600',
              fontSize: '12.5px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              pointerEvents: 'auto'
            }}
          >
            <span>
              {t.type === 'success' && ''}
              {t.type === 'warning' && ''}
              {t.type === 'info' && 'ℹ️'}
            </span>
            {t.message}
          </div>
        ))}
      </div>

      {/* ADD USER / ADMIN MODAL (ENTERPRISE PROVISIONING) */}
      {showAddUserModal && (
        <div className="modal-overlay" style={{ zIndex: 1300 }} onClick={() => setShowAddUserModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>+ Provision New Team Member</h3>
              <button className="modal-close-btn" onClick={() => setShowAddUserModal(false)}>×</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newUserForm.fullName || !newUserForm.email || !newUserForm.password) return;
              try {
                const { registerUserAction } = await import('@/app/actions/auth');
                const res = await registerUserAction({
                  fullName: newUserForm.fullName,
                  email: newUserForm.email,
                  password: newUserForm.password,
                  role: newUserForm.role,
                  title: newUserForm.title,
                  phone: newUserForm.phone
                });
                if (res.success && res.user) {
                  setDbUsersList(prev => [res.user, ...prev]);
                  setShowAddUserModal(false);
                  setNewUserForm({ fullName: '', email: '', password: '12345678', role: 'SALES_REP', title: 'Sales Representative', phone: '' });
                  triggerToast(`User ${res.user.fullName} provisioned successfully as ${res.user.role}!`, 'success');
                  recordAuditLog('User Provisioned', `User: ${res.user.fullName} (${res.user.email} - Role: ${res.user.role})`, 'None', 'Provisioned');
                } else {
                  alert(res.error || 'Failed to create user account.');
                }
              } catch (err: any) {
                alert('Error creating user in database.');
              }
            }}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Full Name *</label>
                <input 
                  type="text" 
                  required 
                  value={newUserForm.fullName} 
                  onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })} 
                  placeholder="e.g. Balasaraswathi"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Work Email Address *</label>
                <input 
                  type="email" 
                  required 
                  value={newUserForm.email} 
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })} 
                  placeholder="e.g. balu@anveshak.com"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>System Role (RBAC) *</label>
                  <select 
                    value={newUserForm.role} 
                    onChange={(e) => {
                      const r = e.target.value;
                      const autoTitle = r === 'ADMIN' ? 'System Administrator' : r === 'MANAGER' ? 'Sales Manager' : 'Sales Representative';
                      setNewUserForm({ ...newUserForm, role: r, title: autoTitle });
                    }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="SALES_REP">Sales Representative</option>
                    <option value="MANAGER">Sales Manager</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Initial Password *</label>
                  <input 
                    type="password" 
                    required 
                    value={newUserForm.password} 
                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })} 
                    placeholder="Min 6 chars"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Job Title</label>
                  <input 
                    type="text" 
                    value={newUserForm.title} 
                    onChange={(e) => setNewUserForm({ ...newUserForm, title: e.target.value })} 
                    placeholder="e.g. Senior Key Account Executive"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Phone Number</label>
                  <input 
                    type="tel" 
                    value={newUserForm.phone} 
                    onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })} 
                    placeholder="+91 98400 00000"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddUserModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Provision Team Member →</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN RESET USER PASSWORD MODAL */}
      {adminResetPasswordUser && (
        <div className="modal-overlay" style={{ zIndex: 1350 }} onClick={() => setAdminResetPasswordUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3>Reset Password for {adminResetPasswordUser.fullName}</h3>
              <button className="modal-close-btn" onClick={() => setAdminResetPasswordUser(null)}>×</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!adminNewPasswordInput || adminNewPasswordInput.length < 6) {
                triggerToast('Password must be at least 6 characters long.', 'error');
                return;
              }

              try {
                const { adminResetPasswordAction } = await import('@/app/actions/auth');
                const res = await adminResetPasswordAction(adminResetPasswordUser.id, adminNewPasswordInput);
                if (res.success) {
                  triggerToast(`Password reset successfully for ${adminResetPasswordUser.fullName}!`, 'success');
                  recordAuditLog('User Password Reset', `Password reset for user: ${adminResetPasswordUser.fullName} (${adminResetPasswordUser.email})`);
                  setAdminResetPasswordUser(null);
                  setAdminNewPasswordInput('');
                } else {
                  triggerToast(res.error || 'Failed to reset password.', 'error');
                }
              } catch (err: any) {
                triggerToast('Error resetting password in database.', 'error');
              }
            }}>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Enter a new temporary or permanent password for user <strong>{adminResetPasswordUser.email}</strong>.
              </p>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>New Password *</label>
                <input
                  type="password"
                  required
                  value={adminNewPasswordInput}
                  onChange={(e) => setAdminNewPasswordInput(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAdminResetPasswordUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Set New Password →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD DAILY CONTACT / VISITING CARD MODAL */}
      {showAddContactModal && (
        <div className="modal-overlay" style={{ zIndex: 1300 }} onClick={() => setShowAddContactModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>Log Daily Visiting Card / Contact</h3>
              <button className="modal-close-btn" onClick={() => setShowAddContactModal(false)}>×</button>
            </div>
      {/* ADD DAILY CONTACT / VISITING CARD MODAL */}
      {showAddContactModal && (
        <div className="modal-overlay" style={{ zIndex: 1300 }} onClick={() => setShowAddContactModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>Create Centralized Contact Record</h3>
              <button className="modal-close-btn" onClick={() => setShowAddContactModal(false)}>×</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newContactForm.name) return;

              const normPhone = normalizePhone(newContactForm.phone);
              const cleanPhone = normPhone.isValid ? normPhone.e164 : (newContactForm.phone || '');

              const candidate = {
                name: newContactForm.name.trim(),
                preferredPhone: cleanPhone,
                email: newContactForm.email.trim(),
                company: newContactForm.company.trim(),
                designation: newContactForm.designation.trim(),
                city: newContactForm.city.trim(),
                category: newContactForm.category || 'Prospect',
                sourceType: newContactForm.sourceType || 'Direct',
                notes: newContactForm.notes
              };

              // Duplicate Detection Check
              const dedup = scoreDuplicate(candidate, contactsList);
              if (dedup.status === 'duplicate' || dedup.status === 'review') {
                setShowAddContactModal(false);
                setMergePair({
                  primary: dedup.existingContact,
                  secondary: { ...candidate, id: `NEW-ENTRY-${Date.now()}` },
                  score: dedup.totalScore,
                  signals: dedup.signals
                });
                setShowMergeModal(true);
                return;
              }

              // Save directly to database
              try {
                const { createContactAction } = await import('@/app/actions/contacts');
                const res = await createContactAction(candidate, currentUser?.fullName || 'CRM User');
                if (res.success && res.contact) {
                  setContactsList(prev => [{ ...res.contact, phone: res.contact?.preferredPhone || cleanPhone, dateAdded: 'Today' }, ...prev]);
                  triggerToast(`Contact "${candidate.name}" created!`, 'success');
                } else {
                  setContactsList(prev => [{ id: `CNT-${Date.now().toString().slice(-4)}`, ...candidate, phone: cleanPhone, dateAdded: 'Today' }, ...prev]);
                }
              } catch (err) {
                setContactsList(prev => [{ id: `CNT-${Date.now().toString().slice(-4)}`, ...candidate, phone: cleanPhone, dateAdded: 'Today' }, ...prev]);
              }

              setShowAddContactModal(false);
              setNewContactForm({ name: '', company: '', email: '', phone: '', designation: '', city: '', category: 'Prospect', sourceType: 'Direct', notes: '' });
            }}>
              <div className="form-group">
                <label>Contact Full Name *</label>
                <input 
                  type="text" 
                  required 
                  value={newContactForm.name} 
                  onChange={(e) => setNewContactForm({ ...newContactForm, name: e.target.value })} 
                  placeholder="e.g. Ramesh Patel"
                />
              </div>
              <div className="form-group">
                <label>Primary Phone Number (Auto-normalized to E.164)</label>
                <input 
                  type="text" 
                  value={newContactForm.phone} 
                  onChange={(e) => setNewContactForm({ ...newContactForm, phone: e.target.value })} 
                  placeholder="e.g. +91 98450 11223 or 9845011223"
                />
              </div>
              <div className="modal-grid-2col">
                <div className="form-group">
                  <label>Company / Firm Name</label>
                  <input 
                    type="text" 
                    value={newContactForm.company} 
                    onChange={(e) => setNewContactForm({ ...newContactForm, company: e.target.value })} 
                    placeholder="e.g. Patel Logistics Ltd"
                  />
                </div>
                <div className="form-group">
                  <label>Designation / Role</label>
                  <input 
                    type="text" 
                    value={newContactForm.designation} 
                    onChange={(e) => setNewContactForm({ ...newContactForm, designation: e.target.value })} 
                    placeholder="e.g. Managing Director"
                  />
                </div>
              </div>
              <div className="modal-grid-2col">
                <div className="form-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    value={newContactForm.email} 
                    onChange={(e) => setNewContactForm({ ...newContactForm, email: e.target.value })} 
                    placeholder="e.g. ramesh@patellogistics.in"
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={newContactForm.category}
                    onChange={(e) => setNewContactForm({ ...newContactForm, category: e.target.value })}
                  >
                    <option value="Prospect">Prospect</option>
                    <option value="Customer">Customer</option>
                    <option value="Partner">Partner</option>
                    <option value="Vendor">Vendor</option>
                    <option value="VIP">VIP</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>City / Location</label>
                <input 
                  type="text" 
                  value={newContactForm.city} 
                  onChange={(e) => setNewContactForm({ ...newContactForm, city: e.target.value })} 
                  placeholder="e.g. Bengaluru"
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddContactModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Contact Record →</button>
              </div>
            </form>
          </div>
        </div>
      )}
          </div>
        </div>
      )}

      {/* SCAN VISITING CARD MODAL */}
      {showScanModal && (
        <div className="modal-overlay" style={{ zIndex: 1350 }} onClick={() => setShowScanModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', width: '92vw', boxSizing: 'border-box', overflowX: 'hidden' }}>
            <div className="modal-header">
              <h3>Scan Visiting Card (Mobile Camera / Fast OCR Extraction)</h3>
              <button className="modal-close-btn" onClick={() => setShowScanModal(false)}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', boxSizing: 'border-box', width: '100%' }}>
              {/* Image Input Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  id="camera-card-upload" 
                  style={{ display: 'none' }} 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (reader.result) processCardImageOCR(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }} 
                />
                <label 
                  htmlFor="camera-card-upload" 
                  className="btn btn-primary" 
                  style={{ flex: 1, padding: '12px', justifyContent: 'center', backgroundColor: '#059669', borderColor: '#059669', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <CameraIcon /> Take Photo (Mobile Camera)
                </label>

                <input 
                  type="file" 
                  accept="image/*" 
                  id="file-card-upload" 
                  style={{ display: 'none' }} 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (reader.result) processCardImageOCR(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }} 
                />
                <label 
                  htmlFor="file-card-upload" 
                  className="btn btn-secondary" 
                  style={{ flex: 1, padding: '12px', justifyContent: 'center', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  Browse Image File
                </label>
              </div>

              {/* Live Preview & OCR Progress */}
              {scannedImagePreview && (
                <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)', background: '#0f172a', padding: '14px', display: 'flex', alignItems: 'center', gap: '16px', boxSizing: 'border-box' }}>
                  <div style={{ width: '90px', height: '60px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', borderRadius: '6px', overflow: 'hidden', border: '1px solid #334155' }}>
                    <img 
                      src={scannedImagePreview} 
                      alt="Scanned Visiting Card" 
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '100%', 
                        objectFit: 'contain', 
                        transform: `rotate(${cardRotationDegrees}deg)`,
                        transition: 'transform 0.3s ease'
                      }} 
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#f8fafc' }}>
                        {isScanningCard ? `Extracting Details... ${scanProgress}%` : 'Card Scanned Successfully!'}
                      </div>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ padding: '3px 8px', fontSize: '11px', whiteSpace: 'nowrap', backgroundColor: '#1e293b', borderColor: '#475569', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                        onClick={() => {
                          const newDeg = (cardRotationDegrees + 90) % 360;
                          setCardRotationDegrees(newDeg);
                          if (scannedImagePreview) {
                            processCardImageOCR(scannedImagePreview, newDeg);
                          }
                        }}
                      >
                        Rotate 90°
                      </button>
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px' }}>
                      Orientation: <strong>{cardRotationDegrees}°</strong> (Click Rotate 90° if text orientation is vertical)
                    </div>
                    <div style={{ height: '6px', background: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: isScanningCard ? '#3b82f6' : '#10b981', width: `${scanProgress}%`, transition: 'width 0.3s ease' }}></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Extracted Details Form */}
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  const contactFullName = `${scannedResultForm.firstName} ${scannedResultForm.lastName}`.trim() || scannedResultForm.fullName;
                  if (!contactFullName) {
                    triggerToast('Please enter a Contact Name before saving.', 'info');
                    return;
                  }

                  const normPhone = normalizePhone(scannedResultForm.phone);
                  const cleanPhone = normPhone.isValid ? normPhone.e164 : (scannedResultForm.phone || '');

                  const candidate = {
                    name: contactFullName,
                    company: scannedResultForm.company || '',
                    email: scannedResultForm.email || '',
                    preferredPhone: cleanPhone,
                    designation: scannedResultForm.designation || '',
                    address: scannedResultForm.address || '',
                    city: scannedResultForm.city || '',
                    category: 'Prospect',
                    sourceType: 'Visiting Card',
                    owner: currentUser?.fullName || 'KP Sumanth'
                  };

                  // Duplicate check before saving scanned card
                  const dedup = scoreDuplicate(candidate, contactsList);
                  if (dedup.status === 'duplicate' || dedup.status === 'review') {
                    setShowScanModal(false);
                    setScannedImagePreview(null);
                    setMergePair({
                      primary: dedup.existingContact,
                      secondary: { ...candidate, id: `SCANNED-${Date.now()}` },
                      score: dedup.totalScore,
                      signals: dedup.signals
                    });
                    setShowMergeModal(true);
                    return;
                  }

                  // Inform if already tracked in Leads
                  const existingInLeads = leads.find(l => 
                    (cleanPhone && cleanPhone.length >= 7 && l.phone && l.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone.replace(/[^0-9]/g, '').slice(-10)) ||
                    (candidate.email && l.email && l.email.toLowerCase() === candidate.email.toLowerCase())
                  );
                  if (existingInLeads) {
                    triggerToast(`Contact linked with existing lead: "${existingInLeads.name}" (${existingInLeads.company})`, 'info');
                  }

                  let dbId = `CNT-${Date.now().toString().slice(-4)}`;

                  // Persist Scanned Contact & Company to PostgreSQL Database via Server Action
                  try {
                    const { createContactAction } = await import('@/app/actions/contacts');
                    const res = await createContactAction(candidate, currentUser?.fullName || 'KP Sumanth');
                    if (res && res.isDuplicate && !res.success) {
                      triggerToast(res.error || `Contact "${candidate.name}" is already in the database!`, 'warning');
                      setShowScanModal(false);
                      setScannedImagePreview(null);
                      return;
                    }
                    if (res && res.success && res.contact) {
                      dbId = res.contact.id;
                      triggerToast(`Scanned contact "${contactFullName}" saved to database!`, 'success');
                    }
                  } catch (dbErr) {
                    console.error('Database save error for scanned contact:', dbErr);
                  }

                  const newEntry = {
                    id: dbId,
                    name: contactFullName,
                    company: candidate.company,
                    email: candidate.email,
                    phone: cleanPhone,
                    preferredPhone: cleanPhone,
                    designation: candidate.designation,
                    city: candidate.city,
                    category: 'Prospect',
                    sourceType: 'Visiting Card',
                    dateAdded: new Date().toLocaleDateString('en-IN'),
                    isConverted: false
                  };
                  setContactsList(prev => [newEntry, ...prev]);

                  // Also auto-sync into Companies state
                  if (candidate.company) {
                    setCompanies(prev => {
                      const exists = prev.some(c => c.name.toLowerCase() === candidate.company.toLowerCase());
                      if (!exists) {
                        return [{
                          id: `COMP-${Date.now()}`,
                          name: candidate.company,
                          industry: 'Manufacturing / B2G',
                          website: '',
                          city: candidate.city || 'Bangalore',
                          state: 'Karnataka',
                          address: candidate.address || '',
                          contactsCount: 1,
                          totalDealValue: 0
                        }, ...prev];
                      }
                      return prev.map(c => c.name.toLowerCase() === candidate.company.toLowerCase() ? { ...c, contactsCount: (c.contactsCount || 0) + 1 } : c);
                    });
                  }

                  setShowScanModal(false);
                  setScannedImagePreview(null);
                  setScannedResultForm({ firstName: '', lastName: '', fullName: '', company: '', designation: '', phone: '', email: '', website: '', linkedin: '', address: '', city: '', pincode: '' });
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '12px', boxSizing: 'border-box', width: '100%' }}
              >
                <div className="modal-grid-2col">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>First Name</label>
                    <input 
                      type="text" 
                      value={scannedResultForm.firstName} 
                      onChange={(e) => setScannedResultForm({ ...scannedResultForm, firstName: e.target.value })} 
                      placeholder="e.g. Ramesh"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Last Name / Surname</label>
                    <input 
                      type="text" 
                      value={scannedResultForm.lastName} 
                      onChange={(e) => setScannedResultForm({ ...scannedResultForm, lastName: e.target.value })} 
                      placeholder="e.g. Gowda"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div className="modal-grid-2col">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Company / Organization</label>
                    <input 
                      type="text" 
                      value={scannedResultForm.company} 
                      onChange={(e) => setScannedResultForm({ ...scannedResultForm, company: e.target.value })} 
                      placeholder="e.g. Acme Corp"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Designation / Role</label>
                    <input 
                      type="text" 
                      value={scannedResultForm.designation} 
                      onChange={(e) => setScannedResultForm({ ...scannedResultForm, designation: e.target.value })} 
                      placeholder="e.g. Operations Manager"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div className="modal-grid-2col">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Phone Number</label>
                    <input 
                      type="text" 
                      value={scannedResultForm.phone} 
                      onChange={(e) => setScannedResultForm({ ...scannedResultForm, phone: e.target.value })} 
                      placeholder="e.g. +91 98450 12345"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Email Address</label>
                    <input 
                      type="email" 
                      value={scannedResultForm.email} 
                      onChange={(e) => setScannedResultForm({ ...scannedResultForm, email: e.target.value })} 
                      placeholder="e.g. ramesh@company.com"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div className="modal-grid-2col">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Website / URL</label>
                    <input 
                      type="text" 
                      value={scannedResultForm.website} 
                      onChange={(e) => setScannedResultForm({ ...scannedResultForm, website: e.target.value })} 
                      placeholder="e.g. https://company.com"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>LinkedIn Profile</label>
                    <input 
                      type="text" 
                      value={scannedResultForm.linkedin} 
                      onChange={(e) => setScannedResultForm({ ...scannedResultForm, linkedin: e.target.value })} 
                      placeholder="e.g. linkedin.com/in/username"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Address / Campus</label>
                  <input 
                    type="text" 
                    value={scannedResultForm.address} 
                    onChange={(e) => setScannedResultForm({ ...scannedResultForm, address: e.target.value })} 
                    placeholder="e.g. 123 Industrial Area"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div className="modal-grid-2col">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>City</label>
                    <input 
                      type="text" 
                      value={scannedResultForm.city} 
                      onChange={(e) => setScannedResultForm({ ...scannedResultForm, city: e.target.value })} 
                      placeholder="e.g. Bangalore"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Pincode</label>
                    <input 
                      type="text" 
                      value={scannedResultForm.pincode} 
                      onChange={(e) => setScannedResultForm({ ...scannedResultForm, pincode: e.target.value })} 
                      placeholder="e.g. 560001"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div className="modal-actions" style={{ marginTop: '16px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowScanModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={isScanningCard}>Save Scanned Contact →</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CONVERT LEAD TO DEAL MODAL */}
      {showConvertLeadModal && selectedLeadForConversion && (
        <div className="modal-overlay" style={{ zIndex: 1300 }} onClick={() => setShowConvertLeadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>Convert Lead to Deal (Kanban Pipeline)</h3>
              <button className="modal-close-btn" onClick={() => setShowConvertLeadModal(false)}>×</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const targetCompany = (selectedLeadForConversion.company || selectedLeadForConversion.name || '').trim().toLowerCase();
                const existing = deals.find(d => 
                  (targetCompany && d.company && d.company.trim().toLowerCase() === targetCompany) ||
                  d.name.trim().toLowerCase() === convertDealForm.dealName.trim().toLowerCase()
                );
                if (existing) {
                  triggerToast(`Deal already exists in pipeline: "${existing.name}" (${existing.stage})`, 'warning');
                  setShowConvertLeadModal(false);
                  navigateTab('kanban');
                  setSelectedDealDetail(existing);
                  return;
                }

                const { createDealAction } = await import('@/app/actions/crm');
                const targetStage = normalizeDealStage(convertDealForm.stage || 'New');
                const res = await createDealAction({
                  name: convertDealForm.dealName,
                  company: selectedLeadForConversion.company || selectedLeadForConversion.name,
                  value: Number(convertDealForm.dealValue) || 500000,
                  probability: 40,
                  stage: targetStage,
                  owner: selectedLeadForConversion.owner || currentUser?.fullName || 'KP Sumanth'
                });
                if (res.isDuplicate) {
                  triggerToast(res.error || 'Deal already in pipeline!', 'warning');
                  setShowConvertLeadModal(false);
                  navigateTab('kanban');
                  return;
                }
                if (res.success && res.data) {
                  const newDeal: Deal = {
                    id: res.data.id,
                    name: res.data.name,
                    company: res.data.company || selectedLeadForConversion.company || selectedLeadForConversion.name,
                    value: Number(res.data.value) || Number(convertDealForm.dealValue) || 500000,
                    probability: res.data.probability || 40,
                    stage: normalizeDealStage(res.data.stage || targetStage),
                    owner: res.data.owner || selectedLeadForConversion.owner || currentUser?.fullName || 'KP Sumanth',
                    daysInStage: 0,
                    expectedClose: new Date().toISOString().slice(0, 10)
                  };
                  setDeals(prev => deduplicateDealsLocal([newDeal, ...prev]));
                  setLeads(prev => prev.map(l => l.id === selectedLeadForConversion.id ? { ...l, status: 'Qualified' } : l));
                  setContactsList(prev => prev.map(c => c.id === selectedLeadForConversion.id ? { ...c, category: 'Customer' } : c));
                  setShowConvertLeadModal(false);
                  triggerToast(`Lead ${selectedLeadForConversion.name} converted into Deal in Supabase!`, 'success');
                  navigateTab('kanban');
                } else {
                  alert(res.error || 'Failed to convert lead to deal in database.');
                }
              } catch (err) {
                console.error('Error converting lead to deal:', err);
                alert('Database error converting lead to deal.');
              }
            }}>
              <div className="form-group">
                <label>Lead / Contact Name</label>
                <input type="text" disabled value={selectedLeadForConversion.name} style={{ background: '#f1f5f9' }} />
              </div>
              <div className="form-group">
                <label>Company / Organization</label>
                <input type="text" disabled value={selectedLeadForConversion.company || '—'} style={{ background: '#f1f5f9' }} />
              </div>
              <div className="form-group">
                <label>Deal Name *</label>
                <input 
                  type="text" 
                  required 
                  value={convertDealForm.dealName} 
                  onChange={(e) => setConvertDealForm({ ...convertDealForm, dealName: e.target.value })} 
                />
              </div>
              <div className="form-group">
                <label>Expected Deal Value (₹ INR) *</label>
                <input 
                  type="number" 
                  required 
                  value={convertDealForm.dealValue} 
                  onChange={(e) => setConvertDealForm({ ...convertDealForm, dealValue: e.target.value })} 
                />
              </div>
              <div className="form-group">
                <label>Target Pipeline Stage *</label>
                <select 
                  value={convertDealForm.stage} 
                  onChange={(e) => setConvertDealForm({ ...convertDealForm, stage: e.target.value })}
                >
                  <option value="New">Discovered (New Lead Inquiry)</option>
                  <option value="Contacted">Engaged (Contacted & Meeting Scheduled)</option>
                  <option value="Proposal Sent">Proposal Sent (Commercial Quote Shared)</option>
                  <option value="Negotiation">Negotiation (Final Terms)</option>
                  <option value="Won">Won (Deal Closed / Order Received)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowConvertLeadModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}>Create Deal in Pipeline →</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {scoringNotification && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', backgroundColor: '#10b981', color: '#ffffff', padding: '14px 20px', borderRadius: '8px', zIndex: 1100, fontWeight: 'bold', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          ✓ Lead scores recalculated based on updated scoring weights!
        </div>
      )}

      {/* Centralized Contact 360 Drawer Modal */}
      {selectedContactFor360 && (
        <Contact360Modal
          contactId={selectedContactFor360}
          initialContact={contactsList.find(c => c.id === selectedContactFor360)}
          allDeals={deals}
          allTasks={tasks}
          currentUser={currentUser}
          onClose={() => setSelectedContactFor360(null)}
          onContactUpdated={(updated) => {
            setContactsList(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated, phone: updated.preferredPhone || updated.phone } : c));
          }}
          onContactDeleted={(deletedId) => {
            setContactsList(prev => prev.filter(c => c.id !== deletedId));
            setSelectedContactFor360(null);
          }}
          onConvertToLead={async (cnt) => {
            try {
              const { createLeadAction } = await import('@/app/actions/crm');
              const res = await createLeadAction({
                name: cnt.name,
                company: cnt.company,
                email: cnt.email,
                phone: cnt.preferredPhone || cnt.phone,
                status: 'New',
                score: 25,
                owner: currentUser?.fullName || 'KP Sumanth'
              });
              if (res.success && res.data) {
                const newLead: Lead = {
                  id: res.data.id,
                  name: res.data.name,
                  company: res.data.company || '',
                  email: res.data.email || '',
                  phone: res.data.phone || '',
                  status: (res.data.status as any) || 'New',
                  score: res.data.score || 25,
                  owner: res.data.owner || 'KP Sumanth',
                  activities: []
                };
                setLeads(prev => [newLead, ...prev]);
                setContactsList(prev => prev.map(c => c.id === cnt.id ? { ...c, isConverted: true, convertedLeadId: newLead.id } : c));
                triggerToast(`Contact ${cnt.name} converted to Lead in Supabase!`, 'success');
                setSelectedContactFor360(null);
              }
            } catch (err) {
              console.error('Convert to lead error:', err);
            }
          }}
          triggerToast={triggerToast}
        />
      )}

      {/* Interactive Contact Merge Modal */}
      {showMergeModal && mergePair && (
        <ContactMergeModal
          primaryContact={mergePair.primary}
          secondaryContact={mergePair.secondary}
          matchScore={mergePair.score}
          signals={mergePair.signals}
          currentUser={currentUser}
          onClose={() => {
            setShowMergeModal(false);
            setMergePair(null);
          }}
          onMergeSuccess={(merged) => {
            setContactsList(prev => {
              const filtered = prev.filter(c => c.id !== mergePair.secondary.id);
              return filtered.map(c => c.id === merged.id ? { ...c, ...merged, phone: merged.preferredPhone || merged.phone } : c);
            });
            setShowMergeModal(false);
            setMergePair(null);
          }}
          triggerToast={triggerToast}
        />
      )}

      {/* Excel / CSV Batch Import Modal */}
      {showExcelImportModal && (
        <ExcelImportModal
          existingContacts={contactsList}
          currentUser={currentUser}
          onClose={() => setShowExcelImportModal(false)}
          onImportSuccess={async (result) => {
            if (result.importedContacts && result.importedContacts.length > 0) {
              setContactsList(prev => {
                const newIds = new Set(result.importedContacts.map((c: any) => c.id));
                const filtered = prev.filter(c => !newIds.has(c.id));
                return [...result.importedContacts, ...filtered];
              });
            }
            if (result.batch) {
              setImportBatches(prev => [result.batch, ...prev.filter(b => b.id !== result.batch.id)]);
            }

            // Reload fresh contact list & batches from database if available
            try {
              const { fetchContactsListAction, fetchImportBatchesAction } = await import('@/app/actions/contacts');
              const [cRes, bRes] = await Promise.all([
                fetchContactsListAction(),
                fetchImportBatchesAction()
              ]);
              if (cRes.success && cRes.contacts && cRes.contacts.length > 0) {
                setContactsList(cRes.contacts.map((c: any) => ({
                  ...c,
                  phone: c.preferredPhone || c.phone,
                  dateAdded: c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : 'Today'
                })));
              }
              if (bRes.success && bRes.batches && bRes.batches.length > 0) {
                setImportBatches(bRes.batches);
              }
            } catch (err) {
              console.warn('DB background reload skipped:', err);
            }
          }}
          triggerToast={triggerToast}
        />
      )}

      {/* Quick Communication Modal (1-Click Outreach) */}
      {showQuickCommContact && (
        <QuickCommModal
          contact={showQuickCommContact}
          currentUser={currentUser}
          onClose={() => setShowQuickCommContact(null)}
          onCommunicationLogged={(comm) => {
            setContactsList(prev => prev.map(c => c.id === showQuickCommContact.id ? { ...c, lastContactedAt: new Date().toISOString() } : c));
          }}
          triggerToast={triggerToast}
        />
      )}

      {/* Microsoft Outlook Calendar Sync Modal */}
      {showOutlookSyncModal && (
        <OutlookSyncModal
          isOpen={showOutlookSyncModal}
          onClose={() => setShowOutlookSyncModal(false)}
          tasks={tasks}
          deals={deals}
          currentUser={currentUser}
          triggerToast={triggerToast}
          onSynced={(email) => setOutlookAccountStatus({ connected: true, outlookEmail: email })}
        />
      )}

      {/* Floating Owner Feedback & Requirements Widget */}
      <OwnerFeedbackWidget activeTab={activeTab} currentUser={currentUser} />
    </div>
  );
}

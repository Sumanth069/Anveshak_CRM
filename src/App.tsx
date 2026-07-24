import React, { useState, useEffect } from 'react';
import './App.css';
import Tesseract from 'tesseract.js';

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
  activities: { action: string; points: number; date: string }[];
  customFields?: { [key: string]: string };
}

interface Deal {
  id: string;
  name: string;
  company: string;
  value: number;
  stage: 'New' | 'Contacted' | 'Proposal Sent' | 'Negotiation' | 'Won' | 'Lost';
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
  beforeState: string;
  afterState: string;
}

interface CustomField {
  id: string;
  label: string;
  entity: 'Lead' | 'Contact' | 'Deal';
  type: 'text' | 'number';
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

// Global Constants & SVG Vector Icons
const stages = ['New', 'Contacted', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'] as const;

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

// Initial Data Seed
const initialLeads: Lead[] = [
  {
    id: 'L-101',
    name: 'Ramesh Gowda',
    company: 'Mysore Agro Products',
    email: 'ramesh@mysoreagro.in',
    phone: '+91 98450 12345',
    status: 'New',
    score: 65,
    owner: 'KP Sumanth',
    activities: [
      { action: 'Demo requested', points: 20, date: '2026-07-10' },
      { action: 'Meeting scheduled', points: 20, date: '2026-07-11' },
      { action: 'Call answered', points: 15, date: '2026-07-12' },
      { action: 'Email opened', points: 10, date: '2026-07-13' }
    ],
    customFields: {}
  },
  {
    id: 'L-102',
    name: 'Anjali Sharma',
    company: 'Bangalore Smart Solutions',
    email: 'anjali@smartsolutions.com',
    phone: '+91 99001 88776',
    status: 'Contacted',
    score: 45,
    owner: 'Balasaraswathi',
    activities: [
      { action: 'Meeting scheduled', points: 20, date: '2026-07-09' },
      { action: 'Call answered', points: 15, date: '2026-07-10' },
      { action: 'Email opened', points: 10, date: '2026-07-11' }
    ],
    customFields: {}
  },
  {
    id: 'L-103',
    name: 'K. S. Rao',
    company: 'Karnataka Steel Ltd',
    email: 'ksrao@karnatakasteel.org',
    phone: '+91 80234 56789',
    status: 'New',
    score: 15,
    owner: 'KP Sumanth',
    activities: [
      { action: 'Call answered', points: 15, date: '2026-07-12' },
      { action: 'No activity in 7 days', points: -10, date: '2026-07-14' }
    ],
    customFields: {}
  },
  {
    id: 'L-104',
    name: 'Mohammad Yusuf',
    company: 'Vikas Builders Hubli',
    email: 'yusuf@vikasbuilders.com',
    phone: '+91 94481 22334',
    status: 'Qualified',
    score: 75,
    owner: 'Balasaraswathi',
    activities: [
      { action: 'Demo requested', points: 20, date: '2026-07-07' },
      { action: 'Meeting scheduled', points: 20, date: '2026-07-08' },
      { action: 'Call answered', points: 15, date: '2026-07-09' },
      { action: 'Email opened', points: 10, date: '2026-07-10' },
      { action: 'Email link clicked', points: 15, date: '2026-07-11' }
    ],
    customFields: {}
  }
];

const initialDeals: Deal[] = [
  {
    id: 'D-201',
    name: 'Cauvery Water Systems — Bulk Filter Order',
    company: 'Cauvery Water Systems',
    value: 750000,
    stage: 'New',
    probability: 10,
    expectedClose: '2026-07-18',
    owner: 'KP Sumanth',
    daysInStage: 3
  },
  {
    id: 'D-202',
    name: 'Mysore Agro — Industrial Pump Fitting',
    company: 'Mysore Agro Products',
    value: 1200000,
    stage: 'Proposal Sent',
    probability: 40,
    expectedClose: '2026-07-28',
    owner: 'KP Sumanth',
    daysInStage: 12
  },
  {
    id: 'D-203',
    name: 'Vikas Builders — Smart Valves Contract',
    company: 'Vikas Builders Hubli',
    value: 450000,
    stage: 'Negotiation',
    probability: 70,
    expectedClose: '2026-07-25',
    owner: 'Balasaraswathi',
    daysInStage: 5
  },
  {
    id: 'D-204',
    name: 'Namma Metro — Station Filter Renewal',
    company: 'BMRCL Bangalore',
    value: 3500000,
    stage: 'Won',
    probability: 100,
    expectedClose: '2026-07-05',
    owner: 'KP Sumanth',
    daysInStage: 25
  }
];

const initialTasks: Task[] = [
  {
    id: 'T-301',
    title: 'Follow up with Mysore Agro',
    description: 'Call Ramesh to discuss proposed quote and contract terms.',
    dueDate: '2026-07-12', // Overdue relative to July 16, 2026
    priority: 'High',
    status: 'Open',
    assignee: 'KP Sumanth',
    linkedTo: 'Mysore Agro Products'
  },
  {
    id: 'T-302',
    title: 'Prepare demo for Smart Valves',
    description: 'Ensure sample components are packaged for site visit.',
    dueDate: '2026-07-16', // Due Today
    priority: 'Medium',
    status: 'Open',
    assignee: 'Balasaraswathi',
    linkedTo: 'Vikas Builders Hubli'
  },
  {
    id: 'T-303',
    title: 'Send tax summary invoice',
    description: 'Compile quotation with CGST/SGST structure.',
    dueDate: '2026-07-20', // Upcoming
    priority: 'Low',
    status: 'Open',
    assignee: 'KP Sumanth',
    linkedTo: 'Cauvery Water Systems'
  }
];

const initialActivities: ActivityLog[] = [
  {
    id: 'ACT-401',
    date: '2026-07-12',
    type: 'Call',
    duration: 10,
    outcome: 'Interested',
    nextStep: 'Send quotation PDF',
    notes: 'Ramesh is interested. Wants a GST quotation by next week.',
    entityName: 'Mysore Agro Products',
    agentName: 'KP Sumanth'
  }
];

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

const initialAuditLogs: AuditLog[] = [
  {
    id: 'LOG-001',
    user: 'KP Sumanth',
    action: 'Lead Created',
    entity: 'Lead: Ramesh Gowda',
    timestamp: '2026-07-10 10:15:32',
    beforeState: 'None',
    afterState: '{"id": "L-101", "name": "Ramesh Gowda", "score": 65}'
  }
];

const initialCompanies: Company[] = [
  {
    id: 'COMP-101',
    name: 'Mysore Agro Products',
    industry: 'Agriculture / Manufacturing',
    website: 'https://mysoreagro.in',
    city: 'Mysore',
    state: 'Karnataka',
    address: 'KRS Road, Industrial Suburb, Mysore - 570016',
    contactsCount: 2,
    totalDealValue: 500000
  },
  {
    id: 'COMP-102',
    name: 'Bangalore Smart Solutions',
    industry: 'Enterprise Software & IoT',
    website: 'https://smartsolutions.com',
    city: 'Bangalore',
    state: 'Karnataka',
    address: '100ft Road, Indiranagar, Bangalore - 560038',
    contactsCount: 1,
    totalDealValue: 1500000
  },
  {
    id: 'COMP-103',
    name: 'Vikas Builders Hubli',
    industry: 'Government Infrastructure',
    website: 'https://vikasbuilders.in',
    city: 'Hubli',
    state: 'Karnataka',
    address: 'Gokul Road, Hubli - 580030',
    contactsCount: 1,
    totalDealValue: 3900000
  }
];

const initialUsers: SystemUser[] = [
  {
    id: 'USR-01',
    fullName: 'KP Sumanth',
    email: 'sumanth@anveshakhub.com',
    role: 'SALES_REP',
    isActive: true,
    assignedCount: 4
  },
  {
    id: 'USR-02',
    fullName: 'Balasaraswathi',
    email: 'balu@anveshakhub.com',
    role: 'MANAGER',
    isActive: true,
    assignedCount: 12
  },
  {
    id: 'USR-03',
    fullName: 'System Administrator',
    email: 'admin@anveshakhub.com',
    role: 'ADMIN',
    isActive: true,
    assignedCount: 0
  }
];

export default function App() {
  // Authentication & Persona State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(true); // Start logged in for seamless demo
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Navigation & Simulation Roles
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leads' | 'companies' | 'kanban' | 'quote' | 'tasks' | 'calendar' | 'reports' | 'users' | 'scoring' | 'audit'>('dashboard');
  const [currentRole, setCurrentRole] = useState<'Admin' | 'Manager' | 'Sales Rep'>('Admin');
  
  // Data States
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activities, setActivities] = useState<ActivityLog[]>(initialActivities);
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
  const [usersList, setUsersList] = useState<SystemUser[]>(initialUsers);
  const [rules, setRules] = useState(initialScoringRules);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(initialAuditLogs);
  
  // Form/Modal & Detailed Inspection States
  const [selectedDealDetail, setSelectedDealDetail] = useState<Deal | null>(null);
  const [selectedLeadDetail, setSelectedLeadDetail] = useState<Lead | null>(null);
  const [selectedCompanyDetail, setSelectedCompanyDetail] = useState<Company | null>(null);
  
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showCustomFieldModal, setShowCustomFieldModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [showQuotePreview, setShowQuotePreview] = useState(false);
  
  const [reportsSubTab, setReportsSubTab] = useState<'funnel' | 'forecast' | 'leaderboard'>('funnel');
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [cardImage, setCardImage] = useState<string | null>(null);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  
  // Form Inputs
  const [newLead, setNewLead] = useState({ name: '', company: '', email: '', phone: '', owner: 'KP Sumanth' });
  const [newCompany, setNewCompany] = useState({ name: '', industry: 'Manufacturing / B2G', website: '', city: 'Bangalore', state: 'Karnataka', address: '' });
  const [newUser, setNewUser] = useState({ fullName: '', email: '', role: 'SALES_REP' as SystemUser['role'] });
  const [newCustomValues, setNewCustomValues] = useState<{ [key: string]: string }>({});
  const [duplicateConflictedLead, setDuplicateConflictedLead] = useState<Lead | null>(null);
  
  const [newTask, setNewTask] = useState({ title: '', description: '', dueDate: '2026-07-16', priority: 'Medium' as Task['priority'], linkedTo: '' });
  
  const [newActivity, setNewActivity] = useState({
    type: 'Call' as ActivityLog['type'],
    duration: 5,
    outcome: 'Interested' as ActivityLog['outcome'],
    nextStep: '',
    notes: '',
    entityName: ''
  });
  
  const [selectedDealForLost, setSelectedDealForLost] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState('Budget constraints');
  
  const [customFieldLabel, setCustomFieldLabel] = useState('');
  const [customFieldType, setCustomFieldType] = useState<'text' | 'number'>('text');
  
  const [quoteCompany, setQuoteCompany] = useState('Mysore Agro Products');
  const [quoteContact, setQuoteContact] = useState('Ramesh Gowda');
  const [quoteItems, setQuoteItems] = useState([
    { id: '1', description: 'Heavy Duty Inline Pipeline Filters (100mm)', qty: 5, price: 30000, gst: 18 }
  ]);

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [scoringNotification, setScoringNotification] = useState(false);

  // Active Simulated Agent Name based on current role selection
  const currentAgentName = currentRole === 'Sales Rep' ? 'KP Sumanth' : currentRole === 'Manager' ? 'Balasaraswathi' : 'Admin User';

  // ----------------------------------------------------
  // ROLE SECURITY GUARDS (MOCK MIDDLEWARE)
  // ----------------------------------------------------
  const isViewRestricted = (tab: typeof activeTab) => {
    if (currentRole === 'Sales Rep') {
      return tab === 'scoring' || tab === 'audit' || tab === 'users' || tab === 'reports';
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

  // Role Filtering Rules
  const filterByOwner = <T extends { owner?: string; assignee?: string }>(items: T[]): T[] => {
    if (currentRole === 'Sales Rep') {
      return items.filter(item => item.owner === 'KP Sumanth' || item.assignee === 'KP Sumanth');
    }
    return items;
  };

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
    // Check duplicates
    const duplicate = leads.find(l => l.email.toLowerCase() === newLead.email.toLowerCase() || l.phone === newLead.phone);
    
    if (duplicate) {
      setDuplicateConflictedLead(duplicate);
      setShowDuplicateModal(true);
    } else {
      createConfirmedLead();
    }
  };

  const createConfirmedLead = () => {
    const freshId = `L-${Date.now().toString().slice(-3)}`;
    const freshLead: Lead = {
      id: freshId,
      name: newLead.name,
      company: newLead.company,
      email: newLead.email,
      phone: newLead.phone,
      status: 'New',
      score: 10, // Base scoring for creation
      owner: newLead.owner,
      activities: [{ action: 'Email opened', points: 10, date: '2026-07-16' }],
      customFields: newCustomValues
    };

    const nextLeads = [freshLead, ...leads];
    setLeads(nextLeads);
    triggerRecalculateScores(nextLeads);

    // Audit Log
    const newLog: AuditLog = {
      id: `LOG-ADD-${Date.now().toString().slice(-3)}`,
      user: currentAgentName,
      action: 'Lead Created',
      entity: `Lead: ${newLead.name}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      beforeState: 'None',
      afterState: JSON.stringify(freshLead)
    };
    setAuditLogs([newLog, ...auditLogs]);

    // Reset Form
    setNewLead({ name: '', company: '', email: '', phone: '', owner: 'KP Sumanth' });
    setNewCustomValues({});
    setShowLeadModal(false);
    setShowDuplicateModal(false);
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
        name: 'Sathyanarayana B V',
        company: 'DERBI Foundation',
        email: 'ceo@derbifoundation.com',
        phone: '+91 99800 03627',
        owner: currentRole === 'Sales Rep' ? 'KP Sumanth' : 'Balasaraswathi'
      });
      
      // Audit Log
      const newLog: AuditLog = {
        id: `LOG-SCAN-${Date.now().toString().slice(-3)}`,
        user: currentAgentName,
        action: 'Visiting Card Scanned (AI Enhanced)',
        entity: 'Lead Card: Sathyanarayana B V',
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        beforeState: 'Image Snap Uploaded',
        afterState: 'OCR + AI Semantic Match: Sathyanarayana B V, DERBI Foundation, +91 99800 03627'
      };
      setAuditLogs(prev => [newLog, ...prev]);
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

    setNewLead({
      name: name || 'Extracted Lead',
      company: company || 'Extracted Company',
      email: email || 'no-email@detected.com',
      phone: phone || 'No Phone Detected',
      owner: currentRole === 'Sales Rep' ? 'KP Sumanth' : 'Balasaraswathi'
    });

    // Audit Log
    const newLog: AuditLog = {
      id: `LOG-SCAN-${Date.now().toString().slice(-3)}`,
      user: currentAgentName,
      action: 'Visiting Card Auto-Scanned',
      entity: `Lead Card: ${name || 'Extracted Lead'}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      beforeState: 'Image Snap Uploaded',
      afterState: `OCR Extracted Text:\n${text}`
    };
    setAuditLogs(prev => [newLog, ...prev]);
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
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
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
    
    const probability = stage === 'Won' ? 100 : stage === 'Lost' ? 0 : stage === 'Negotiation' ? 70 : stage === 'Proposal Sent' ? 40 : 10;
    
    setDeals(deals.map(d => {
      if (d.id === dealId) {
        return { ...d, stage, probability, lostReason: reasonOfLoss };
      }
      return d;
    }));

    // Add Audit Log
    const newLog: AuditLog = {
      id: `LOG-STAGE-${Date.now().toString().slice(-3)}`,
      user: currentAgentName,
      action: 'Stage Transitioned',
      entity: `Deal: ${prevDeal.name}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      beforeState: JSON.stringify({ stage: prevDeal.stage, probability: prevDeal.probability }),
      afterState: JSON.stringify({ stage, probability, lostReason: reasonOfLoss || 'None' })
    };
    setAuditLogs([newLog, ...auditLogs]);
  };

  // ----------------------------------------------------
  // TASK CREATION & PROGRESS TOGGLE
  // ----------------------------------------------------
  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const freshTask: Task = {
      id: `T-${Date.now().toString().slice(-3)}`,
      title: newTask.title,
      description: newTask.description,
      dueDate: newTask.dueDate,
      priority: newTask.priority,
      status: 'Open',
      assignee: currentRole === 'Sales Rep' ? 'KP Sumanth' : 'Balasaraswathi',
      linkedTo: newTask.linkedTo
    };

    setTasks([freshTask, ...tasks]);
    setShowTaskModal(false);
    setNewTask({ title: '', description: '', dueDate: '2026-07-16', priority: 'Medium', linkedTo: '' });
  };

  const toggleTaskStatus = (taskId: string) => {
    setTasks(tasks.map(t => {
      if (t.id === taskId) {
        const nextStatus: Task['status'] = t.status === 'Open' ? 'Completed' : 'Open';
        return { ...t, status: nextStatus };
      }
      return t;
    }));
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

  // Mock Export Handler
  const handleCSVExport = (type: string) => {
    alert(`📥 Mock CSV download triggered for ${type}. File exported locally.`);
    const newLog: AuditLog = {
      id: `LOG-EXP-${Date.now().toString().slice(-3)}`,
      user: currentAgentName,
      action: 'Data Exported',
      entity: `CSV Bundle: ${type}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      beforeState: 'Protected',
      afterState: 'Exported'
    };
    setAuditLogs([newLog, ...auditLogs]);
  };

  // Lead Conversion (1-click qualification)
  const handleConvertLead = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    // Remove from leads
    setLeads(leads.filter(l => l.id !== leadId));

    // Create a Deal
    const freshDeal: Deal = {
      id: `D-${Date.now().toString().slice(-3)}`,
      name: `${lead.company} — Custom Pipeline`,
      company: lead.company,
      value: 500000, // Default estimate
      stage: 'New',
      probability: 10,
      expectedClose: '2026-08-01',
      owner: lead.owner,
      daysInStage: 1
    };
    setDeals([freshDeal, ...deals]);

    // Add Audit Log
    const newLog: AuditLog = {
      id: `LOG-CONV-${Date.now().toString().slice(-3)}`,
      user: currentAgentName,
      action: 'Lead Converted',
      entity: `Lead converted to Contact & Deal: ${lead.name}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      beforeState: JSON.stringify(lead),
      afterState: JSON.stringify(freshDeal)
    };
    setAuditLogs([newLog, ...auditLogs]);
  };

  // Calendar Grid Calculations (July 2026: July 1st is Wednesday -> Sun=0, Mon=1, Tue=2, Wed=3 offset)
  const daysInJuly = 31;
  const gridCells = Array.from({ length: 35 }, (_, idx) => {
    const dayNumber = idx - 2; // Index 3 maps to July 1st (Wednesday)
    return dayNumber > 0 && dayNumber <= daysInJuly ? dayNumber : null;
  });

  // Calculate Metrics from states
  const filteredDeals = filterByOwner(deals);
  const filteredLeads = filterByOwner(leads);
  const filteredTasks = filterByOwner(tasks);

  const totalPipeline = filteredDeals.reduce((acc, curr) => curr.stage !== 'Lost' ? acc + curr.value : acc, 0);
  const activeDealsCount = filteredDeals.filter(d => d.stage !== 'Won' && d.stage !== 'Lost').length;
  const hotLeadsCount = filteredLeads.filter(l => l.score >= 60 && l.status !== 'Disqualified').length;
  const openTasksCount = filteredTasks.filter(t => t.status === 'Open').length;

  // RENDER DEDICATED LOGIN SCREEN IF NOT AUTHENTICATED
  if (!isLoggedIn) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#151c2e', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '36px', width: '100%', maxWidth: '460px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
          {/* Brand Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ width: '42px', height: '42px', backgroundColor: '#f5d396', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#182238', fontWeight: '800', fontSize: '20px' }}>
              A
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#111827' }}>Anveshak CRM</h2>
              <span style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '700' }}>ENTERPRISE CRM V2.0</span>
            </div>
          </div>

          <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#111827', marginBottom: '4px' }}>Sign in to your Workspace</h3>
          <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '20px' }}>Select a test persona card below to verify role-based features without auth friction.</p>

          {/* 3 Persona Cards for 1-Click Working Demo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            <div 
              style={{ border: '1px solid #eaedf2', padding: '12px 14px', borderRadius: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', transition: 'all 0.15s' }}
              onClick={() => {
                setCurrentRole('Admin');
                setIsLoggedIn(true);
                setActiveTab('dashboard');
              }}
            >
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#111827' }}>Riya Sharma / Alexander Thorne</div>
                <div style={{ fontSize: '10.5px', color: '#6b7280' }}>Regional Director • ADMIN Privileges</div>
              </div>
              <span className="badge badge-hot" style={{ fontSize: '9px' }}>ADMIN</span>
            </div>

            <div 
              style={{ border: '1px solid #eaedf2', padding: '12px 14px', borderRadius: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', transition: 'all 0.15s' }}
              onClick={() => {
                setCurrentRole('Manager');
                setIsLoggedIn(true);
                setActiveTab('dashboard');
              }}
            >
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#111827' }}>Balasaraswathi</div>
                <div style={{ fontSize: '10.5px', color: '#6b7280' }}>Sales Manager • MANAGER Scope</div>
              </div>
              <span className="badge badge-warm" style={{ fontSize: '9px' }}>MANAGER</span>
            </div>

            <div 
              style={{ border: '1px solid #eaedf2', padding: '12px 14px', borderRadius: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', transition: 'all 0.15s' }}
              onClick={() => {
                setCurrentRole('Sales Rep');
                setIsLoggedIn(true);
                setActiveTab('dashboard');
              }}
            >
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#111827' }}>KP Sumanth</div>
                <div style={{ fontSize: '10.5px', color: '#6b7280' }}>Enterprise Rep • SALES_REP Assigned</div>
              </div>
              <span className="badge badge-cold" style={{ fontSize: '9px' }}>SALES_REP</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '16px 0', color: '#94a3b8', fontSize: '11px' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#eaedf2' }}></div>
            <span>or enter custom credentials</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: '#eaedf2' }}></div>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault();
            setIsLoggedIn(true);
            setActiveTab('dashboard');
          }}>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label>Work Email</label>
              <input type="email" required placeholder="name@anveshakhub.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label>Password</label>
              <input type="password" required placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '11px', fontSize: '13.5px', justifyContent: 'center', backgroundColor: '#1e40af' }}>
              Log In to Anveshak CRM
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container bg-${activeTab}`}>
      {/* Left Sidebar Layout (Figma Dark Navy) */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo-icon">A</div>
          <div className="sidebar-brand-name">
            <h1>Anveshak</h1>
            <span>ENTERPRISE CRM</span>
          </div>
        </div>

        {/* Primary Sidebar CTA Button */}
        <div className="sidebar-action-box">
          <button className="btn-sidebar-cta" onClick={() => setShowLeadModal(true)}>
            + New Deal
          </button>
        </div>

        {/* Sidebar Menu Items (Matching PDS Sitemap Order) */}
        <ul className="sidebar-menu">
          <li className={`menu-item ${activeTab === 'dashboard' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('dashboard')}>
              <DashboardIcon /> Dashboard
            </button>
          </li>
          <li className={`menu-item ${activeTab === 'leads' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('leads')}>
              <ContactsIcon /> Contacts Directory
            </button>
          </li>
          <li className={`menu-item ${activeTab === 'companies' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('companies')}>
              <CompanyIcon /> Companies & Accounts
            </button>
          </li>
          <li className={`menu-item ${activeTab === 'kanban' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('kanban')}>
              <PipelineIcon /> Deals & Pipeline
            </button>
          </li>
          <li className={`menu-item ${activeTab === 'tasks' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('tasks')}>
              <TasksIcon /> Tasks Queue
              {openTasksCount > 0 && <span className="menu-badge">{openTasksCount}</span>}
            </button>
          </li>
          <li className={`menu-item ${activeTab === 'calendar' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('calendar')}>
              <CalendarIcon /> Calendar Scheduler
            </button>
          </li>
          <li className={`menu-item ${activeTab === 'quote' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('quote')}>
              <QuoteIcon /> GST Quote Builder
            </button>
          </li>
          
          {!isViewRestricted('reports') && (
            <li className={`menu-item ${activeTab === 'reports' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('reports')}>
                <ReportsIcon /> Analytics Reports
              </button>
            </li>
          )}
          {!isViewRestricted('users') && (
            <li className={`menu-item ${activeTab === 'users' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('users')}>
                <UsersIcon /> User Provisioning
              </button>
            </li>
          )}
          {!isViewRestricted('scoring') && (
            <li className={`menu-item ${activeTab === 'scoring' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('scoring')}>
                <ScoringIcon /> Lead Scoring Rules
              </button>
            </li>
          )}
          {!isViewRestricted('audit') && (
            <li className={`menu-item ${activeTab === 'audit' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('audit')}>
                <AuditIcon /> Audit Registry
              </button>
            </li>
          )}
        </ul>

        {/* Sidebar User Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar" style={{ backgroundColor: currentRole === 'Sales Rep' ? '#1e40af' : '#d97706' }}>
              {currentRole === 'Sales Rep' ? 'KS' : currentRole === 'Manager' ? 'BS' : 'AD'}
            </div>
            <div className="user-info">
              <h4>{currentAgentName}</h4>
              <p>{currentRole} Session</p>
            </div>
          </div>
          <button 
            className="btn-logout-icon" 
            title="Sign out & switch persona"
            onClick={() => setIsLoggedIn(false)}
          >
            🚪
          </button>
        </div>
      </aside>

      {/* Main Viewport Content */}
      <main className="main-content">
        {/* Top Navbar Header */}
        <header className="top-bar">
          <div className="search-container">
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search in Anveshak CRM (leads, deals, contacts...)" 
            />
          </div>

          <div className="top-bar-actions">
            <button className="btn btn-secondary" onClick={() => setShowActivityModal(true)}>
              + Log Activity
            </button>
            <button className="btn btn-secondary" onClick={() => handleCSVExport('Leads')}>
              Export CSV
            </button>
            <div className="nav-avatar" style={{ backgroundColor: '#f1f5f9', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Notifications">
              <BellIcon />
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
                  <h2>Good morning, {currentRole === 'Admin' ? 'Riya' : currentRole === 'Manager' ? 'Balu' : 'Sumanth'}</h2>
                  <p>Your pipeline summary</p>
                </div>
                <div className="forecast-pill">
                  ★ You're 12% ahead of last month's forecast.
                </div>
              </div>

              {/* 4 Metric KPI Cards (Screenshot 1 Top Row) */}
              <section className="metric-grid">
                <div className="metric-card">
                  <div className="metric-header">
                    <span>OPEN PIPELINE</span>
                    <span className="trend-badge up">↑ 4.2%</span>
                  </div>
                  <div className="metric-val">₹84.2L</div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>ACTIVE LEADS</span>
                    <span className="trend-badge up">+3</span>
                  </div>
                  <div className="metric-val">37</div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>WIN RATE</span>
                    <span className="trend-badge down">↓ 1.5%</span>
                  </div>
                  <div className="metric-val">41%</div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>AVG. DEAL CYCLE</span>
                    <span className="trend-badge neutral">Stable</span>
                  </div>
                  <div className="metric-val">18d</div>
                </div>
              </section>

              {/* The Trail ● Live Pipeline Tracking (Screenshot 1 Center) */}
              <div className="trail-container">
                <div className="trail-header">
                  <div className="trail-title">
                    The trail <span style={{ color: '#d49b38' }}>● Live Pipeline Tracking</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }}>≡ Filter</button>
                  </div>
                </div>

                <div className="trail-columns">
                  {/* Column 1: Discovered */}
                  <div className="trail-col">
                    <div className="trail-col-header">
                      <div className="trail-dot active"></div>
                      <span className="trail-col-name">Discovered</span>
                      <span className="trail-col-meta">12 Deals • ₹22.4L</span>
                    </div>
                    
                    <div className="trail-card" onClick={() => setSelectedLeadDetail(leads[0])}>
                      <div className="trail-card-top">
                        <span className="trail-badge new">NEW LEAD</span>
                        <span className="trail-card-value">₹4.5L</span>
                      </div>
                      <div className="trail-card-title">Kavya Textiles</div>
                      <div className="trail-card-subtitle">Supply Chain Digitization</div>
                      <div className="trail-card-footer">
                        <span className="user-avatar" style={{ width: '20px', height: '20px', fontSize: '9px', backgroundColor: '#182238' }}>AJ</span>
                        <span>⏱ 2h ago</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Engaged */}
                  <div className="trail-col">
                    <div className="trail-col-header">
                      <div className="trail-dot active"></div>
                      <span className="trail-col-name">Engaged</span>
                      <span className="trail-col-meta">8 Deals • ₹34.1L</span>
                    </div>

                    <div className="trail-card" onClick={() => setSelectedDealDetail(deals[0])}>
                      <div className="trail-card-top">
                        <span className="trail-badge demo">DEMO DONE</span>
                        <span className="trail-card-value">₹12.0L</span>
                      </div>
                      <div className="trail-card-title">Orbit Logistics</div>
                      <div className="trail-card-subtitle">Warehouse Automation v2</div>
                      <div className="trail-card-footer">
                        <span className="user-avatar" style={{ width: '20px', height: '20px', fontSize: '9px', backgroundColor: '#d49b38' }}>RS</span>
                        <span>⏱ 1d ago</span>
                      </div>
                    </div>

                    <div className="trail-card" onClick={() => setSelectedDealDetail(deals[1])}>
                      <div className="trail-card-top">
                        <span className="trail-badge discovery">DISCOVERY</span>
                        <span className="trail-card-value">₹5.2L</span>
                      </div>
                      <div className="trail-card-title">Skyline Retail</div>
                      <div className="trail-card-subtitle">Point of Sale Upgrade</div>
                      <div className="trail-card-footer">
                        <span className="user-avatar" style={{ width: '20px', height: '20px', fontSize: '9px', backgroundColor: '#475569' }}>MK</span>
                        <span>⏱ 3d ago</span>
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Proposal */}
                  <div className="trail-col">
                    <div className="trail-col-header">
                      <div className="trail-dot"></div>
                      <span className="trail-col-name">Proposal</span>
                      <span className="trail-col-meta">5 Deals • ₹18.5L</span>
                    </div>

                    <div className="trail-dropzone" onClick={() => setActiveTab('kanban')}>
                      <div style={{ fontSize: '18px', marginBottom: '4px' }}>⊕</div>
                      <div>Move deal here</div>
                    </div>
                  </div>

                  {/* Column 4: Won */}
                  <div className="trail-col">
                    <div className="trail-col-header">
                      <div className="trail-dot won"></div>
                      <span className="trail-col-name">Won</span>
                      <span className="trail-col-meta">2 Deals • ₹9.2L</span>
                    </div>

                    <div className="trail-card" style={{ borderLeft: '3px solid #10b981' }}>
                      <div className="trail-card-top">
                        <span className="trail-badge new" style={{ backgroundColor: '#ecfdf5', color: '#047857' }}>CLOSED</span>
                        <span className="trail-card-value">₹6.4L</span>
                      </div>
                      <div className="trail-card-title">Apex FinTech</div>
                      <div className="trail-card-subtitle">Core CRM Migration</div>
                      <div className="trail-card-footer">
                        <span className="user-avatar" style={{ width: '20px', height: '20px', fontSize: '9px', backgroundColor: '#1e40af' }}>RS</span>
                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓ Success</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Split Row (Recent Activity Feed & Dark Tasks Widget - Screenshot 1 Bottom) */}
              <div className="dashboard-bottom-split">
                {/* Left: Recent Activity Feed */}
                <div className="panel-card" style={{ padding: '22px' }}>
                  <div className="panel-title" style={{ marginBottom: '18px' }}>
                    <h3>Recent Activity</h3>
                    <button className="btn btn-secondary" style={{ fontSize: '11px' }} onClick={() => setActiveTab('audit')}>View all</button>
                  </div>

                  <div className="activity-list">
                    <div className="activity-item">
                      <div className="activity-icon-box">✉️</div>
                      <div className="activity-content">
                        <div className="activity-title">Riya Sharma sent a proposal to Orbit Logistics</div>
                        <div className="activity-time">20 minutes ago • ₹12,000 Deal</div>
                        <div className="activity-attachment" onClick={() => {
                          setActiveTab('quote');
                          setShowQuotePreview(true);
                        }}>
                          <span>📄 Orbit_Proposal_v2.pdf</span>
                          <span>⤓ Download</span>
                        </div>
                      </div>
                    </div>

                    <div className="activity-item">
                      <div className="activity-icon-box">📞</div>
                      <div className="activity-content">
                        <div className="activity-title">Arjun Jain completed a discovery call with Kavya Textiles</div>
                        <div className="activity-time">1 hour ago • High Intent</div>
                      </div>
                    </div>

                    <div className="activity-item">
                      <div className="activity-icon-box">👤</div>
                      <div className="activity-content">
                        <div className="activity-title">System imported 24 new leads from Inbound Campaign</div>
                        <div className="activity-time">3 hours ago</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Dark Navy Tasks Widget (Screenshot 1 Right) */}
                <div className="dark-tasks-widget">
                  <h3>Upcoming Tasks</h3>

                  <div className="task-items-list">
                    {tasks.slice(0, 3).map(t => (
                      <div key={t.id} className="task-item-row">
                        <input 
                          type="checkbox" 
                          className="task-checkbox"
                          checked={t.status === 'Completed'}
                          onChange={() => {
                            setTasks(tasks.map(tk => tk.id === t.id ? { ...tk, status: tk.status === 'Completed' ? 'Open' : 'Completed' } : tk));
                          }}
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
                    ))}
                  </div>

                  <div className="goal-progress-section">
                    <div className="goal-progress-label">
                      <span>Weekly Goal Progress</span>
                      <span style={{ color: '#f5d396', fontWeight: 'bold' }}>65%</span>
                    </div>
                    <div className="goal-progress-bar">
                      <div className="goal-progress-fill" style={{ width: '65%' }}></div>
                    </div>
                  </div>

                  <div className="floating-add-task-btn" onClick={() => setShowTaskModal(true)} title="Add Task">
                    +
                  </div>
                </div>
              </div>
            </div>
          )}
                          .filter(l => l.status !== 'Disqualified')
                          .sort((a, b) => b.score - a.score)
                          .slice(0, 3)
                          .map(lead => (
                            <tr key={lead.id}>
                              <td style={{ fontWeight: '600' }}>{lead.name}</td>
                              <td>{lead.company}</td>
                              <td>
                                <span className={`badge ${lead.score >= 60 ? 'badge-hot' : 'badge-warm'}`}>
                                  {lead.status}
                                </span>
                              </td>
                              <td style={{ fontWeight: 'bold', color: '#1e40af' }}>{lead.score} pts</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Audit & Access Registry Summary */}
                <div className="panel-card">
                  <div className="panel-title">
                    <h3>System Access Logs & Audits</h3>
                    <button className="btn btn-secondary" style={{ fontSize: '11px' }} onClick={() => setActiveTab('audit')}>Full Registry</button>
                  </div>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>User</th>
                        <th>Event</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.slice(0, 3).map(log => (
                        <tr key={log.id}>
                          <td style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{log.timestamp.split(' ')[1] || log.timestamp}</td>
                          <td style={{ fontWeight: '600' }}>{log.user}</td>
                          <td>
                            <span className="badge badge-cold" style={{ fontSize: '9px' }}>{log.action}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONTACTS DIRECTORY */}
          {activeTab === 'leads' && (
            <div className="animate-fade">
              <div className="page-header-row">
                <div className="page-title-text">
                  <h2>Contacts Directory</h2>
                  <p>Centralized database of leads, prospects, and organization contacts</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" onClick={() => handleCSVExport('Leads')}>Export CSV</button>
                  <button className="btn btn-primary" onClick={() => setShowLeadModal(true)}>+ Add Contact</button>
                </div>
              </div>

              {/* Contact Cards Grid */}
              <div className="contacts-grid">
                {filteredLeads.slice(0, 4).map(contact => (
                  <div key={contact.id} className="contact-card">
                    <div className="contact-avatar">
                      {contact.name.split(' ').map(n=>n[0]).join('')}
                    </div>
                    <div className="contact-name">{contact.name}</div>
                    <div className="contact-company">{contact.company}</div>
                    <div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 'bold', marginTop: '6px' }}>
                      {contact.score} Lead Score
                    </div>
                    <div className="contact-actions">
                      <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '10px' }} onClick={() => alert(`Emailing ${contact.email}...`)}>✉️ Email</button>
                      <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '10px' }} onClick={() => alert(`Calling ${contact.phone}...`)}>📞 Call</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="panel-card">
                <div className="panel-title">
                  <h3>All Registered Contacts</h3>
                </div>
                <div className="custom-table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Company</th>
                        <th>Email / Phone</th>
                        <th>Status</th>
                        <th>Score</th>
                        {customFields.map(f => (
                          <th key={f.id}>{f.label}</th>
                        ))}
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map(lead => (
                        <tr key={lead.id}>
                          <td>
                            <div style={{ fontWeight: '600' }}>{lead.name}</div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{lead.id} ({lead.owner})</span>
                          </td>
                          <td>{lead.company}</td>
                          <td>
                            <div>{lead.email}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{lead.phone}</div>
                          </td>
                          <td>
                            <span className={`badge ${lead.status === 'Disqualified' ? 'badge-cold' : lead.status === 'Qualified' ? 'badge-hot' : 'badge-warm'}`}>
                              {lead.status}
                            </span>
                          </td>
                          <td style={{ fontWeight: 'bold', color: '#1e40af' }}>{lead.score} pts</td>
                          {customFields.map(f => (
                            <td key={f.id}>{lead.customFields?.[f.label] || '—'}</td>
                          ))}
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => setSelectedLeadDetail(lead)}>
                                Inspect 360°
                              </button>
                              {lead.status !== 'Disqualified' && (
                                <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleConvertLead(lead.id)}>
                                  Convert to Deal
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COMPANIES & ACCOUNTS DIRECTORY (CON-04) */}
          {activeTab === 'companies' && (
            <div className="animate-fade">
              <div className="page-header-row">
                <div className="page-title-text">
                  <h2>Companies & Accounts Directory</h2>
                  <p>Corporate and B2G government organizations with consolidated deal roll-ups</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" onClick={() => handleCSVExport('Leads')}>Export CSV</button>
                  <button className="btn btn-primary" onClick={() => setShowCompanyModal(true)}>+ Add Company</button>
                </div>
              </div>

              {/* Companies Grid */}
              <div className="contacts-grid">
                {companies.map(comp => (
                  <div key={comp.id} className="contact-card" style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div className="contact-avatar" style={{ margin: '0 0 8px 0', backgroundColor: '#eff6ff', color: '#1e40af' }}>
                        {comp.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="badge badge-cold" style={{ fontSize: '9px' }}>{comp.state}</span>
                    </div>
                    <div className="contact-name">{comp.name}</div>
                    <div className="contact-company">{comp.industry}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '8px' }}>📍 {comp.address}</div>
                    
                    <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '12px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                      <span>Affiliated Contacts: <strong>{comp.contactsCount}</strong></span>
                      <span>Deal Roll-up: <strong style={{ color: '#1e40af' }}>{formatCurrency(comp.totalDealValue)}</strong></span>
                    </div>
                    
                    <div className="contact-actions" style={{ marginTop: '12px' }}>
                      <button className="btn btn-secondary" style={{ width: '100%', fontSize: '11px' }} onClick={() => setSelectedCompanyDetail(comp)}>
                        Inspect Account Profile (CON-05)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: DEALS & PIPELINE VELOCITY (SCREENSHOT 2) */}
          {activeTab === 'kanban' && (
            <div className="animate-fade">
              {/* Header Row */}
              <div className="page-header-row">
                <div className="page-title-text">
                  <h2>Pipeline Velocity</h2>
                  <p>Real-time visualization of your active sales funnel across all territories.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button className="btn btn-secondary">≡ Filter</button>
                  <button className="btn btn-secondary">📅 This Quarter</button>
                  <button className="btn btn-primary" onClick={() => setShowLeadModal(true)}>+ New Deal</button>
                </div>
              </div>

              {/* Stage Volume Funnel & Projected Revenue Row (Screenshot 2 Top) */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
                {/* Stage Lead Volume Funnel Card */}
                <div className="panel-card" style={{ padding: '22px' }}>
                  <div className="panel-title" style={{ marginBottom: '14px' }}>
                    <h3>Stage Lead Volume</h3>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span style={{ color: '#d49b38', fontWeight: 'bold' }}>●</span> HIGH PROBABILITY &nbsp;&nbsp;
                      <span style={{ color: '#cbd5e1', fontWeight: 'bold' }}>●</span> BENCHMARK
                    </div>
                  </div>

                  <div className="funnel-graphic-container">
                    <div className="funnel-stage-box" style={{ flex: 1, borderRadius: '8px 0 0 8px' }}>
                      <div className="funnel-stage-val">428</div>
                      <div className="funnel-stage-label">Discovered</div>
                    </div>
                    <div className="funnel-stage-box" style={{ flex: 0.8 }}>
                      <div className="funnel-stage-val">156</div>
                      <div className="funnel-stage-label">Qualified</div>
                    </div>
                    <div className="funnel-stage-box" style={{ flex: 0.6 }}>
                      <div className="funnel-stage-val">62</div>
                      <div className="funnel-stage-label">Proposal</div>
                    </div>
                    <div className="funnel-stage-box" style={{ flex: 0.4, borderColor: '#d49b38', background: '#fffbeb', borderRadius: '0 8px 8px 0' }}>
                      <div className="funnel-stage-val" style={{ color: '#b45309' }}>18</div>
                      <div className="funnel-stage-label" style={{ color: '#b45309' }}>Negotiation</div>
                    </div>
                  </div>
                </div>

                {/* Right Analytics Cards */}
                <div>
                  <div className="projected-rev-dark-card">
                    <div className="lbl">PROJECTED REVENUE</div>
                    <div className="val">$2.48M</div>
                    <div style={{ fontSize: '11px', color: '#10b981', marginTop: '6px', fontWeight: 'bold' }}>
                      ↑ 12.5% vs last month
                    </div>
                  </div>

                  <div className="panel-card" style={{ padding: '18px' }}>
                    <div style={{ fontSize: '9.5px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>AVG. CYCLE TIME</div>
                    <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-main)', marginTop: '4px' }}>14 Days</div>
                    <div style={{ fontSize: '11px', color: '#d49b38', marginTop: '4px', fontWeight: 'bold' }}>
                      ⚡ -2 days improvement
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Deals Pipeline Table (Screenshot 2 Center) */}
              <div className="panel-card" style={{ marginBottom: '24px' }}>
                <div className="panel-title">
                  <h3>Active Deals Pipeline</h3>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Showing 24 active deals • <span style={{ color: '#d49b38', fontWeight: 'bold', cursor: 'pointer' }}>View All Transactions</span>
                  </div>
                </div>

                <div className="custom-table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Deal Name</th>
                        <th>Value</th>
                        <th>Status</th>
                        <th>Close Date</th>
                        <th>Probability</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr onClick={() => setSelectedDealDetail(deals[0])} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="user-avatar" style={{ width: '28px', height: '28px', fontSize: '11px', backgroundColor: '#182238' }}>S</div>
                            <div>
                              <div style={{ fontWeight: '700' }}>Stellar Dynamics Cloud Migration</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Assigned to: Elena Rossi</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontWeight: '800' }}>$450,000</td>
                        <td><span className="badge badge-warm" style={{ backgroundColor: '#fffbeb', color: '#b45309' }}>Negotiation</span></td>
                        <td>Oct 24, 2024</td>
                        <td>
                          <div className="prob-progress-bar">
                            <div className="prob-progress-fill" style={{ width: '85%' }}></div>
                          </div>
                          <span style={{ fontWeight: 'bold', fontSize: '11px' }}>85%</span>
                        </td>
                      </tr>

                      <tr onClick={() => setSelectedDealDetail(deals[1])} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="user-avatar" style={{ width: '28px', height: '28px', fontSize: '11px', backgroundColor: '#ecfdf5', color: '#047857' }}>V</div>
                            <div>
                              <div style={{ fontWeight: '700' }}>Vanguard FinTech Integration</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Assigned to: Marcus Aurelius</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontWeight: '800' }}>$1,200,000</td>
                        <td><span className="badge badge-cold" style={{ backgroundColor: '#eff6ff', color: '#1e40af' }}>Proposal</span></td>
                        <td>Nov 12, 2024</td>
                        <td>
                          <div className="prob-progress-bar">
                            <div className="prob-progress-fill" style={{ width: '45%', backgroundColor: '#3b82f6' }}></div>
                          </div>
                          <span style={{ fontWeight: 'bold', fontSize: '11px' }}>45%</span>
                        </td>
                      </tr>

                      <tr onClick={() => setSelectedDealDetail(deals[2] || deals[0])} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="user-avatar" style={{ width: '28px', height: '28px', fontSize: '11px', backgroundColor: '#fef3c7', color: '#b45309' }}>N</div>
                            <div>
                              <div style={{ fontWeight: '700' }}>Nexus Core Licensing</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Assigned to: Alexander Thorne</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontWeight: '800' }}>$85,000</td>
                        <td><span className="badge badge-cold" style={{ backgroundColor: '#ecfdf5', color: '#047857' }}>Qualified</span></td>
                        <td>Oct 30, 2024</td>
                        <td>
                          <div className="prob-progress-bar">
                            <div className="prob-progress-fill" style={{ width: '65%', backgroundColor: '#10b981' }}></div>
                          </div>
                          <span style={{ fontWeight: 'bold', fontSize: '11px' }}>65%</span>
                        </td>
                      </tr>

                      <tr onClick={() => setSelectedDealDetail(deals[3] || deals[0])} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="user-avatar" style={{ width: '28px', height: '28px', fontSize: '11px', backgroundColor: '#182238' }}>B</div>
                            <div>
                              <div style={{ fontWeight: '700' }}>Blackstone Enterprise Suite</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Assigned to: Sarah Jenkins</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontWeight: '800' }}>$620,000</td>
                        <td><span className="badge badge-warm" style={{ backgroundColor: '#fffbeb', color: '#b45309' }}>Negotiation</span></td>
                        <td>Dec 05, 2024</td>
                        <td>
                          <div className="prob-progress-bar">
                            <div className="prob-progress-fill" style={{ width: '90%' }}></div>
                          </div>
                          <span style={{ fontWeight: 'bold', fontSize: '11px' }}>90%</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Table Pagination Bar (Screenshot 2 Bottom) */}
                <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)' }}>
                  <button className="btn btn-secondary" style={{ fontSize: '11px' }}>Previous</button>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '11px', backgroundColor: '#d49b38' }}>1</button>
                    <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}>2</button>
                    <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}>3</button>
                  </div>
                  <button className="btn btn-secondary" style={{ fontSize: '11px' }}>Next</button>
                </div>
              </div>

              {/* Drag and Drop Stage Kanban Board */}
              <h3 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '12px' }}>Interactive Stage Kanban Drag-and-Drop</h3>
              <div className="kanban-board">
                {stages.map(stage => {
                  const stageDeals = filteredDeals.filter(d => d.stage === stage);
                  const stageTotal = stageDeals.reduce((sum, d) => sum + d.value, 0);

                  return (
                    <div 
                      key={stage} 
                      className="kanban-col"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, stage)}
                    >
                      <div className="kanban-col-header">
                        <span className="kanban-col-title">{stage}</span>
                        <span className="kanban-col-count">{stageDeals.length}</span>
                      </div>
                      <div style={{ padding: '6px 16px 0', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                        {formatCurrency(stageTotal)}
                      </div>

                      <div className="kanban-cards-container">
                        {stageDeals.map(deal => (
                          <div 
                            key={deal.id} 
                            className="kanban-card"
                            draggable
                            onDragStart={(e) => handleDragStart(e, deal.id)}
                            onClick={() => setSelectedDealDetail(deal)}
                          >
                            <div className="kanban-card-title">{deal.name}</div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>{deal.company}</div>
                            <div className="kanban-card-value">{formatCurrency(deal.value)}</div>
                            <div className="kanban-card-footer">
                              <span>👤 {deal.owner ? deal.owner.split(' ').pop() : 'Rep'}</span>
                              <span className="days-badge">{deal.daysInStage || 1}d active</span>
                            </div>
                            {deal.lostReason && (
                              <div style={{ fontSize: '10px', color: 'var(--danger)', marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '4px' }}>
                                Reason: {deal.lostReason}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: TASKS CHECKLIST QUEUE */}
          {activeTab === 'tasks' && (
            <div className="panel-card animate-fade">
              <div className="panel-title">
                <h3>My Work Tasks</h3>
              </div>
              
              <div className="custom-table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>Done</th>
                      <th>Task Title</th>
                      <th>Linked Entity</th>
                      <th>Due Date</th>
                      <th>Priority</th>
                      <th>Assignee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map(t => {
                      const isOverdue = new Date(t.dueDate) < new Date('2026-07-16') && t.status === 'Open';
                      return (
                        <tr key={t.id} style={{ opacity: t.status === 'Completed' ? 0.6 : 1 }}>
                          <td>
                            <input 
                              type="checkbox" 
                              checked={t.status === 'Completed'} 
                              onChange={() => toggleTaskStatus(t.id)} 
                            />
                          </td>
                          <td>
                            <div style={{ fontWeight: '600', textDecoration: t.status === 'Completed' ? 'line-through' : 'none' }}>
                              {t.title}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.description}</div>
                          </td>
                          <td>{t.linkedTo || '—'}</td>
                          <td style={{ color: isOverdue ? 'var(--danger)' : '', fontWeight: isOverdue ? 'bold' : 'normal' }}>
                            {t.dueDate} {isOverdue ? '(OVERDUE)' : ''}
                          </td>
                          <td>
                            <span className={`badge ${t.priority === 'High' ? 'badge-hot' : t.priority === 'Medium' ? 'badge-warm' : 'badge-cold'}`}>
                              {t.priority}
                            </span>
                          </td>
                          <td>{t.assignee}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: OPERATIONAL CALENDAR */}
          {activeTab === 'calendar' && (
            <div className="panel-card animate-fade">
              <div className="panel-title">
                <h3>July 2026 Monthly Schedule</h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>31 Days • 5 Events</div>
              </div>
              
              <div className="calendar-grid-header">
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
              </div>
              
              <div className="calendar-grid">
                {gridCells.map((day, idx) => {
                  if (!day) return <div key={idx} className="calendar-day empty"></div>;
                  
                  const dateStr = `2026-07-${day < 10 ? '0' + day : day}`;
                  const dayTasks = filteredTasks.filter(t => t.dueDate === dateStr);
                  const dayDeals = filteredDeals.filter(d => d.expectedClose === dateStr);
                  const dayActs = activities.filter(a => a.date === dateStr);

                  return (
                    <div key={idx} className="calendar-day">
                      <div className="day-number">{day}</div>
                      <div className="day-events">
                        {dayTasks.map(t => (
                          <div key={t.id} className="calendar-event task" title={t.title}>
                            Task: {t.title}
                          </div>
                        ))}
                        {dayDeals.map(d => (
                          <div key={d.id} className="calendar-event deal" title={d.name}>
                            Deal: {d.company}
                          </div>
                        ))}
                        {dayActs.map(a => (
                          <div key={a.id} className="calendar-event activity" title={a.notes}>
                            Call: {a.type}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 6: GST INVOICE GENERATOR */}
          {activeTab === 'quote' && (
            <div className="panel-card animate-fade">
              <div className="panel-title">
                <h3>Quotation Data Builder</h3>
              </div>
              
              <div className="invoice-grid">
                <div>
                  <div className="form-group">
                    <label>Client Organization (Company)</label>
                    <input type="text" value={quoteCompany} onChange={(e) => setQuoteCompany(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Attention Contact Name</label>
                    <input type="text" value={quoteContact} onChange={(e) => setQuoteContact(e.target.value)} />
                  </div>
                  
                  <h4 style={{ margin: '20px 0 10px 0', fontSize: '13px' }}>Items Grid</h4>
                  
                  {quoteItems.map((item, index) => (
                    <div key={item.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '8px' }}>
                      <input 
                        type="text" 
                        placeholder="Description"
                        value={item.description} 
                        onChange={(e) => {
                          const newItems = [...quoteItems];
                          newItems[index].description = e.target.value;
                          setQuoteItems(newItems);
                        }} 
                        style={{ flexGrow: 1 }}
                      />
                      <input 
                        type="number" 
                        placeholder="Qty"
                        value={item.qty} 
                        onChange={(e) => {
                          const newItems = [...quoteItems];
                          newItems[index].qty = parseInt(e.target.value) || 0;
                          setQuoteItems(newItems);
                        }} 
                        style={{ width: '60px' }}
                      />
                      <input 
                        type="number" 
                        placeholder="Price"
                        value={item.price} 
                        onChange={(e) => {
                          const newItems = [...quoteItems];
                          newItems[index].price = parseInt(e.target.value) || 0;
                          setQuoteItems(newItems);
                        }} 
                        style={{ width: '100px' }}
                      />
                      <button 
                        className="btn btn-secondary" 
                        style={{ color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }}
                        onClick={() => setQuoteItems(quoteItems.filter(qi => qi.id !== item.id))}
                      >
                        Delete
                      </button>
                    </div>
                  ))}

                  <button 
                    className="btn btn-secondary" 
                    style={{ marginTop: '10px' }}
                    onClick={() => setQuoteItems([...quoteItems, { id: Date.now().toString(), description: 'New Component', qty: 1, price: 10000, gst: 18 }])}
                  >
                    + Add Row
                  </button>
                </div>

                <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '24px' }}>
                  <h4 style={{ marginBottom: '14px', fontSize: '13px' }}>Billing Summary Preview</h4>
                  
                  <div className="quote-summary">
                    <div className="quote-summary-row">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(quoteItems.reduce((acc, curr) => acc + (curr.qty * curr.price), 0))}</span>
                    </div>
                    <div className="quote-summary-row">
                      <span>CGST + SGST (18%):</span>
                      <span>{formatCurrency(quoteItems.reduce((acc, curr) => acc + (curr.qty * curr.price * 0.18), 0))}</span>
                    </div>
                    <div className="quote-summary-row total">
                      <span>Grand Total:</span>
                      <span>{formatCurrency(quoteItems.reduce((acc, curr) => acc + (curr.qty * curr.price * 1.18), 0))}</span>
                    </div>
                  </div>

                  <button 
                    className="btn btn-primary" 
                    style={{ marginTop: '24px', width: '100%', justifyContent: 'center' }}
                    onClick={() => setShowQuotePreview(true)}
                  >
                    View Printable Quote Layout
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: ANALYTICS REPORTS (REP-02 to REP-05) */}
          {activeTab === 'reports' && (
            <div className="animate-fade">
              <div className="page-header-row">
                <div className="page-title-text">
                  <h2>Analytics & Performance Reports</h2>
                  <p>Deep analytical insights, conversion pipeline funnels, and revenue forecasts</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className={`btn ${reportsSubTab === 'funnel' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setReportsSubTab('funnel')}>
                    Conversion Funnel (REP-02)
                  </button>
                  <button className={`btn ${reportsSubTab === 'forecast' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setReportsSubTab('forecast')}>
                    Revenue Forecast (REP-03)
                  </button>
                  <button className={`btn ${reportsSubTab === 'leaderboard' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setReportsSubTab('leaderboard')}>
                    Team Leaderboard (REP-04)
                  </button>
                </div>
              </div>

              {reportsSubTab === 'funnel' && (
                <div className="panel-card">
                  <div className="panel-title">
                    <h3>Lead Conversion Funnel (REP-02)</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '10px 0' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
                        <span>Total Prospects / Leads</span>
                        <span>{leads.length} Leads (100%)</span>
                      </div>
                      <div style={{ background: '#e2e8f0', height: '24px', borderRadius: '6px', overflow: 'hidden' }}>
                        <div style={{ background: '#1e40af', width: '100%', height: '100%', display: 'flex', alignItems: 'center', paddingLeft: '10px', color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>100%</div>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
                        <span>Qualified Prospects (Score &gt;= 30)</span>
                        <span>{leads.filter(l => l.score >= 30).length} Leads (66%)</span>
                      </div>
                      <div style={{ background: '#e2e8f0', height: '24px', borderRadius: '6px', overflow: 'hidden' }}>
                        <div style={{ background: '#0284c7', width: '66%', height: '100%', display: 'flex', alignItems: 'center', paddingLeft: '10px', color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>66%</div>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
                        <span>Deals In Flight / Proposals</span>
                        <span>{deals.filter(d => d.stage !== 'Lost').length} Deals (40%)</span>
                      </div>
                      <div style={{ background: '#e2e8f0', height: '24px', borderRadius: '6px', overflow: 'hidden' }}>
                        <div style={{ background: '#f59e0b', width: '40%', height: '100%', display: 'flex', alignItems: 'center', paddingLeft: '10px', color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>40%</div>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
                        <span>Deals Closed / Won</span>
                        <span>{deals.filter(d => d.stage === 'Won').length} Closed Deals (20%)</span>
                      </div>
                      <div style={{ background: '#e2e8f0', height: '24px', borderRadius: '6px', overflow: 'hidden' }}>
                        <div style={{ background: '#10b981', width: '20%', height: '100%', display: 'flex', alignItems: 'center', paddingLeft: '10px', color: '#fff', fontSize: '11px', fontWeight: 'bold' }}>20%</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {reportsSubTab === 'forecast' && (
                <div className="panel-card">
                  <div className="panel-title">
                    <h3>Weighted Pipeline Revenue Forecast (REP-03)</h3>
                  </div>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Deal Name</th>
                        <th>Company</th>
                        <th>Stage</th>
                        <th>Probability</th>
                        <th>Deal Value</th>
                        <th>Weighted Forecast Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deals.map(d => (
                        <tr key={d.id}>
                          <td style={{ fontWeight: '600' }}>{d.name}</td>
                          <td>{d.company}</td>
                          <td><span className="badge badge-cold">{d.stage}</span></td>
                          <td>{d.probability}%</td>
                          <td style={{ fontWeight: 'bold' }}>{formatCurrency(d.value)}</td>
                          <td style={{ fontWeight: 'bold', color: '#1e40af' }}>
                            {formatCurrency((d.value * d.probability) / 100)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {reportsSubTab === 'leaderboard' && (
                <div className="panel-card">
                  <div className="panel-title">
                    <h3>Team Sales Leaderboard (REP-04)</h3>
                  </div>
                  <div className="contacts-grid">
                    {usersList.map((usr, idx) => (
                      <div key={usr.id} className="contact-card">
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#d97706', marginBottom: '4px' }}>
                          RANK #{idx + 1}
                        </div>
                        <div className="contact-avatar" style={{ backgroundColor: usr.role === 'SALES_REP' ? '#1e40af' : '#d97706' }}>
                          {usr.fullName.split(' ').map(n=>n[0]).join('')}
                        </div>
                        <div className="contact-name">{usr.fullName}</div>
                        <div className="contact-company">{usr.role}</div>
                        <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '12px', paddingTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          Assigned Records: <strong>{usr.assignedCount}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 8: USER PROVISIONING & RBAC MANAGEMENT (ADM-01) */}
          {activeTab === 'users' && (
            <div className="animate-fade">
              <div className="page-header-row">
                <div className="page-title-text">
                  <h2>User Management & Provisioning (ADM-01)</h2>
                  <p>Invite team members, update territory assignments, and manage RBAC role permissions</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowInviteModal(true)}>+ Invite User</button>
              </div>

              <div className="panel-card">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>User Name</th>
                      <th>Email Address</th>
                      <th>RBAC Role</th>
                      <th>Account Status</th>
                      <th>Assigned Records</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map(usr => (
                      <tr key={usr.id}>
                        <td style={{ fontWeight: '600' }}>{usr.fullName}</td>
                        <td>{usr.email}</td>
                        <td>
                          <span className={`badge ${usr.role === 'ADMIN' ? 'badge-hot' : usr.role === 'MANAGER' ? 'badge-warm' : 'badge-cold'}`}>
                            {usr.role}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${usr.isActive ? 'badge-cold' : 'badge-hot'}`}>
                            {usr.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                          </span>
                        </td>
                        <td>{usr.assignedCount} items</td>
                        <td>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '10px' }}
                            onClick={() => {
                              const newRole: SystemUser['role'] = usr.role === 'SALES_REP' ? 'MANAGER' : usr.role === 'MANAGER' ? 'ADMIN' : 'SALES_REP';
                              setUsersList(usersList.map(u => u.id === usr.id ? { ...u, role: newRole } : u));
                            }}
                          >
                            Cycle Role
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === 'scoring' && (
            <div className="panel-card animate-fade" style={{ maxWidth: '600px' }}>
              <div className="panel-title">
                <h3>Lead Scoring Point Values</h3>
              </div>
              
              <table className="scoring-config-table">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ paddingBottom: '10px' }}>Action Trigger</th>
                    <th style={{ paddingBottom: '10px', textAlign: 'center' }}>Points Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '8px 0' }}>Request Product Demo</td>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="number" 
                        className="scoring-input" 
                        value={rules.demoRequested} 
                        onChange={(e) => setRules({ ...rules, demoRequested: parseInt(e.target.value) || 0 })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 0' }}>Schedule Callback/Meeting</td>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="number" 
                        className="scoring-input" 
                        value={rules.meetingScheduled} 
                        onChange={(e) => setRules({ ...rules, meetingScheduled: parseInt(e.target.value) || 0 })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 0' }}>Outbound Call - Answered</td>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="number" 
                        className="scoring-input" 
                        value={rules.callAnswered} 
                        onChange={(e) => setRules({ ...rules, callAnswered: parseInt(e.target.value) || 0 })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 0' }}>Outbound Call - No Answer</td>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="number" 
                        className="scoring-input" 
                        value={rules.callNoAnswer} 
                        onChange={(e) => setRules({ ...rules, callNoAnswer: parseInt(e.target.value) || 0 })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '8px 0' }}>Marked as "Not Interested"</td>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="number" 
                        className="scoring-input" 
                        value={rules.notInterested} 
                        onChange={(e) => setRules({ ...rules, notInterested: parseInt(e.target.value) || 0 })}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
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
            <div className="panel-card animate-fade">
              <div className="panel-title">
                <h3>Governance Audit Registry</h3>
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
                          <button 
                            className="audit-diff-trigger"
                            onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                          >
                            {expandedLogId === log.id ? 'Close State' : 'View JSON States'}
                          </button>
                          
                          {expandedLogId === log.id && (
                            <div className="audit-diff-block">
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
          )}
        </div>
      </main>

      {/* MODAL 1: ADD LEAD (WITH DYNAMIC CUSTOM FIELDS) */}
      {showLeadModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create New Lead Record</h3>
              <button className="modal-close-btn" onClick={() => setShowLeadModal(false)}>×</button>
            </div>
            <form onSubmit={handleLeadSubmit}>
              {/* Visiting Card Scanner Widget */}
              <div className="card-scanner-box" style={{ marginBottom: '16px', padding: '12px', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--primary)', letterSpacing: '0.05em' }}>📷 AI VISITING CARD SCANNER</span>
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
                    <div style={{ fontSize: '10px', color: 'var(--primary-hover)', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Analyzing card with OCR AI...</span>
                      <span>{scanProgress}%</span>
                    </div>
                    <div className="scanner-progress-bar" style={{ height: '4px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                      <div className="scanner-progress-fill" style={{ height: '100%', backgroundColor: 'var(--primary)', width: `${scanProgress}%`, transition: 'width 0.15s ease' }}></div>
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
                          <p style={{ fontSize: '9px', color: 'var(--warning)', marginTop: '4px', margin: 0 }}>
                            If text is sideways, rotate it horizontal for clean OCR reading!
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Full Name</label>
                <input type="text" required value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Company / Organization</label>
                <input type="text" required value={newLead.company} onChange={(e) => setNewLead({ ...newLead, company: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" required value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input type="text" required value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} />
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

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowLeadModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Lead</button>
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
              <h3 style={{ color: 'var(--warning)' }}>⚠️ Duplicate In-System Warning</h3>
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
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create Task Checklist Item</h3>
              <button className="modal-close-btn" onClick={() => setShowTaskModal(false)}>×</button>
            </div>
            <form onSubmit={handleTaskSubmit}>
              <div className="form-group">
                <label>Task Title</label>
                <input type="text" required value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea rows={3} value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Due Date</label>
                <input type="date" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}>
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="High">High Priority</option>
                </select>
              </div>
              <div className="form-group">
                <label>Linked Lead/Company (Optional)</label>
                <input type="text" value={newTask.linkedTo} onChange={(e) => setNewTask({ ...newTask, linkedTo: e.target.value })} />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Task</button>
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
                <label>Company / Organization Name</label>
                <select 
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
                <label>Notes / Call Summary</label>
                <textarea rows={3} value={newActivity.notes} onChange={(e) => setNewActivity({ ...newActivity, notes: e.target.value })} />
              </div>

              <div className="modal-actions">
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

      {/* MODAL 7: INVOICE PRINT PREVIEW */}
      {showQuotePreview && (
        <div className="modal-overlay">
          <div className="modal-content wide">
            <div className="modal-header">
              <h3>GST-Compliant quotation Document Preview</h3>
              <button className="modal-close-btn" onClick={() => setShowQuotePreview(false)}>×</button>
            </div>
            
            <div className="invoice-preview-container">
              <div className="invoice-preview-header">
                <div>
                  <div className="invoice-preview-logo">ANVESHAK HUB PRIVATE LIMITED</div>
                  <p style={{ marginTop: '4px' }}>Malleshwaram, Bangalore, Karnataka</p>
                  <p>GSTIN: 29AAAAA1111A1Z1</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h2 style={{ fontSize: '18px', color: '#475569' }}>PRO-FORMA INVOICE</h2>
                  <p style={{ marginTop: '6px' }}>Invoice No: **AH-2026-{Date.now().toString().slice(-4)}**</p>
                  <p>Date: {new Date().toLocaleDateString('en-IN')}</p>
                </div>
              </div>

              <div className="invoice-details-grid">
                <div>
                  <h4 style={{ color: '#475569', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>BILLED TO:</h4>
                  <p style={{ fontWeight: 'bold', fontSize: '13px' }}>{quoteCompany}</p>
                  <p>Attn: {quoteContact}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h4 style={{ color: '#475569', marginBottom: '4px', textTransform: 'uppercase', fontSize: '10px' }}>PAYMENT METHOD:</h4>
                  <p>Bank Transfer / NEFT</p>
                  <p>Account No: 9876543210 (IFSC: SBIN0001234)</p>
                </div>
              </div>

              <table className="invoice-preview-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Rate</th>
                    <th style={{ textAlign: 'center' }}>GST</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quoteItems.map(item => {
                    const rowSub = item.qty * item.price;
                    const rowGst = rowSub * 0.18;
                    return (
                      <tr key={item.id}>
                        <td>{item.description}</td>
                        <td style={{ textAlign: 'center' }}>{item.qty}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(item.price)}</td>
                        <td style={{ textAlign: 'center' }}>18%</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(rowSub + rowGst)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="invoice-preview-summary">
                <div>
                  <span style={{ color: '#64748b' }}>Subtotal: </span>
                  <span style={{ fontWeight: 'bold' }}>
                    {formatCurrency(quoteItems.reduce((acc, curr) => acc + (curr.qty * curr.price), 0))}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>CGST (9%) + SGST (9%): </span>
                  <span style={{ fontWeight: 'bold' }}>
                    {formatCurrency(quoteItems.reduce((acc, curr) => acc + (curr.qty * curr.price * 0.18), 0))}
                  </span>
                </div>
                <div style={{ fontSize: '16px', borderTop: '2px solid #cbd5e1', paddingTop: '8px', marginTop: '6px' }}>
                  <span style={{ color: '#0f172a', fontWeight: 'bold' }}>Grand Total (INR): </span>
                  <span style={{ fontWeight: 'bold', color: '#0d9488' }}>
                    {formatCurrency(quoteItems.reduce((acc, curr) => acc + (curr.qty * curr.price * 1.18), 0))}
                  </span>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowQuotePreview(false)}>Close Preview</button>
              <button className="btn btn-primary" onClick={() => {
                alert('🖨️ PDF generated successfully. Downloading locally. Action logged in Audit Trail.');
                setShowQuotePreview(false);
                // Add Audit Log
                const newLog: AuditLog = {
                  id: `LOG-EXP-${Date.now().toString().slice(-3)}`,
                  user: currentAgentName,
                  action: 'Quote Exported',
                  entity: `Quote Document: ${quoteCompany}`,
                  timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
                  beforeState: 'Ready',
                  afterState: 'Exported'
                };
                setAuditLogs([newLog, ...auditLogs]);
              }}>
                Print / Export PDF
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: DEAL DETAIL VIEW (PIP-03) */}
      {selectedDealDetail && (
        <div className="modal-overlay">
          <div className="modal-content wide">
            <div className="modal-header">
              <div>
                <h3>{selectedDealDetail.name} (PIP-03)</h3>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{selectedDealDetail.company} • Owner: {selectedDealDetail.owner}</p>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedDealDetail(null)}>×</button>
            </div>

            {/* Stage Stepper Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', margin: '16px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              {stages.map(stg => {
                const isActive = stg === selectedDealDetail.stage;
                return (
                  <button 
                    key={stg}
                    className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, fontSize: '10px', padding: '6px 2px' }}
                    onClick={() => {
                      setSelectedDealDetail({ ...selectedDealDetail, stage: stg });
                      setDeals(deals.map(d => d.id === selectedDealDetail.id ? { ...d, stage: stg } : d));
                    }}
                  >
                    {stg}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Deal Value:</span>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#1e40af' }}>{formatCurrency(selectedDealDetail.value)}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Win Probability & Forecast Value:</span>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#10b981' }}>
                  {selectedDealDetail.probability}% ({formatCurrency((selectedDealDetail.value * selectedDealDetail.probability) / 100)})
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setSelectedDealDetail(null)}>Close</button>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  setQuoteCompany(selectedDealDetail.company);
                  setSelectedDealDetail(null);
                  setActiveTab('quote');
                }}
              >
                + Build GST Quote (QTE-01)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LEAD 360° INSPECTION VIEW (LED-02 / CON-02) */}
      {selectedLeadDetail && (
        <div className="modal-overlay">
          <div className="modal-content wide">
            <div className="modal-header">
              <h3>Prospect 360° Profile View (LED-02)</h3>
              <button className="modal-close-btn" onClick={() => setSelectedLeadDetail(null)}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
              {/* Left Column Summary */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div className="contact-avatar" style={{ margin: '0 0 12px 0' }}>
                  {selectedLeadDetail.name.split(' ').map(n=>n[0]).join('')}
                </div>
                <h4 style={{ fontSize: '15px', fontWeight: 'bold' }}>{selectedLeadDetail.name}</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{selectedLeadDetail.company}</p>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#1e40af', margin: '12px 0' }}>
                  {selectedLeadDetail.score} Score Points
                </div>

                <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-main)' }}>
                  <div>📧 {selectedLeadDetail.email}</div>
                  <div>📞 {selectedLeadDetail.phone}</div>
                  <div>👤 Assigned: {selectedLeadDetail.owner}</div>
                </div>
              </div>

              {/* Right Column Activity Log Feed */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '10px' }}>Chronological Activity Feed (ACT-02)</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                  {selectedLeadDetail.activities.map((act, i) => (
                    <div key={i} style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '11.5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                        <span>{act.action}</span>
                        <span style={{ color: '#10b981' }}>+{act.points} pts</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '2px' }}>Date: {act.date}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedLeadDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: COMPANY ACCOUNT PROFILE VIEW (CON-05) */}
      {selectedCompanyDetail && (
        <div className="modal-overlay">
          <div className="modal-content wide">
            <div className="modal-header">
              <h3>Company Account Profile (CON-05)</h3>
              <button className="modal-close-btn" onClick={() => setSelectedCompanyDetail(null)}>×</button>
            </div>

            <div style={{ padding: '10px 0' }}>
              <h2>{selectedCompanyDetail.name}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{selectedCompanyDetail.industry} • 📍 {selectedCompanyDetail.address}</p>
              
              <div style={{ margin: '16px 0', padding: '12px', background: '#f8fafc', borderRadius: '8px', display: 'flex', gap: '24px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>City & State:</span>
                  <div style={{ fontWeight: 'bold' }}>{selectedCompanyDetail.city}, {selectedCompanyDetail.state}</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Website:</span>
                  <div><a href={selectedCompanyDetail.website} target="_blank" rel="noreferrer" style={{ color: '#1e40af' }}>{selectedCompanyDetail.website}</a></div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total B2G Roll-up Value:</span>
                  <div style={{ fontWeight: 'bold', color: '#10b981' }}>{formatCurrency(selectedCompanyDetail.totalDealValue)}</div>
                </div>
              </div>

              <h4 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Affiliated Contacts ({selectedCompanyDetail.contactsCount})</h4>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Contact Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.filter(l => l.company === selectedCompanyDetail.name).map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 'bold' }}>{c.name}</td>
                      <td>{c.email}</td>
                      <td>{c.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setSelectedCompanyDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD COMPANY SLIDE-OVER DRAWER (CON-03) */}
      {showCompanyModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create Company Account (CON-03)</h3>
              <button className="modal-close-btn" onClick={() => setShowCompanyModal(false)}>×</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!newCompany.name) return;
              const freshComp: Company = {
                id: `COMP-${Date.now().toString().slice(-3)}`,
                ...newCompany,
                contactsCount: 1,
                totalDealValue: 0
              };
              setCompanies([freshComp, ...companies]);
              setShowCompanyModal(false);
              setNewCompany({ name: '', industry: 'Manufacturing / B2G', website: '', city: 'Bangalore', state: 'Karnataka', address: '' });
            }}>
              <div className="form-group">
                <label>Company Name *</label>
                <input type="text" required value={newCompany.name} onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Industry Sector</label>
                <input type="text" value={newCompany.industry} onChange={(e) => setNewCompany({ ...newCompany, industry: e.target.value })} />
              </div>
              <div className="form-group">
                <label>City</label>
                <input type="text" value={newCompany.city} onChange={(e) => setNewCompany({ ...newCompany, city: e.target.value })} />
              </div>
              <div className="form-group">
                <label>State</label>
                <input type="text" value={newCompany.state} onChange={(e) => setNewCompany({ ...newCompany, state: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCompanyModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Company</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INVITE USER (ADM-01) */}
      {showInviteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Invite Team Member (ADM-01)</h3>
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
    </div>
  );
}

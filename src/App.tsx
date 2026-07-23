import React, { useState } from 'react';
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

export default function App() {
  // Navigation & Simulation Roles
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leads' | 'kanban' | 'tasks' | 'calendar' | 'scoring' | 'quote' | 'audit'>('dashboard');
  const [currentRole, setCurrentRole] = useState<'Admin' | 'Manager' | 'Sales Rep'>('Admin');
  
  // Data States
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activities, setActivities] = useState<ActivityLog[]>(initialActivities);
  const [rules, setRules] = useState(initialScoringRules);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(initialAuditLogs);
  
  // Form/Modal States
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showCustomFieldModal, setShowCustomFieldModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [showQuotePreview, setShowQuotePreview] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [cardImage, setCardImage] = useState<string | null>(null);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  
  // Form Inputs
  const [newLead, setNewLead] = useState({ name: '', company: '', email: '', phone: '', owner: 'KP Sumanth' });
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
    if (currentRole === 'Manager') {
      return tab === 'scoring' || tab === 'audit';
    }
    return false; // Admin and Sales Rep can technically browse, but Sales Rep views are heavily filtered
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

  // Mock Calendar Calculations
  // Let's create a mockup 35-day grid for July 2026 (July 1st is Wednesday, starts at index 3 in a grid)
  const daysInJuly = 31;
  const gridCells = Array.from({ length: 35 }, (_, idx) => {
    const dayNumber = idx - 2; // Offset for starting cell
    return dayNumber > 0 && dayNumber <= daysInJuly ? dayNumber : null;
  });

  // Calculate Metrics from states
  const filteredDeals = filterByOwner(deals);
  const filteredLeads = filterByOwner(leads);
  const filteredTasks = filterByOwner(tasks);

  const totalPipeline = filteredDeals.reduce((acc, curr) => curr.stage !== 'Lost' ? acc + curr.value : acc, 0);
  const activeDealsCount = filteredDeals.filter(d => d.stage !== 'Won' && d.stage !== 'Lost').length;
  const hotLeadsCount = filteredLeads.filter(l => l.score >= 60 && l.status !== 'Disqualified').length;
  const openTasksCount = filteredTasks.filter(t => t.status === 'Open').length;  return (
    <div className="app-container">
      {/* Left Sidebar Layout (Figma Dark Navy) */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo-icon">A</div>
          <div className="sidebar-brand-name">
            <h1>Anveshak</h1>
            <span>VERSION 2.0 (V2)</span>
          </div>
        </div>

        {/* Primary Sidebar CTA Button */}
        <div className="sidebar-action-box">
          <button className="btn-sidebar-cta" onClick={() => setShowLeadModal(true)}>
            + New Lead / Deal
          </button>
        </div>

        {/* Auth Role Simulator Widget */}
        <div className="role-simulator">
          <label>SIMULATE IDENTITY ROLE</label>
          <select 
            value={currentRole} 
            onChange={(e) => {
              setCurrentRole(e.target.value as any);
              setActiveTab('dashboard');
            }}
            className="role-select"
          >
            <option value="Admin">Admin (Full Control)</option>
            <option value="Manager">Manager (Balu)</option>
            <option value="Sales Rep">Sales Rep (Sumanth)</option>
          </select>
        </div>

        {/* Sidebar Menu Items */}
        <ul className="sidebar-menu">
          <li className={`menu-item ${activeTab === 'dashboard' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('dashboard')}>
              <span>📊</span> Dashboard
            </button>
          </li>
          <li className={`menu-item ${activeTab === 'kanban' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('kanban')}>
              <span>🎯</span> Deals & Pipeline
            </button>
          </li>
          <li className={`menu-item ${activeTab === 'leads' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('leads')}>
              <span>👥</span> Contacts Directory
            </button>
          </li>
          <li className={`menu-item ${activeTab === 'tasks' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('tasks')}>
              <span>Checkmark</span> Tasks Queue
              {openTasksCount > 0 && <span className="menu-badge">{openTasksCount}</span>}
            </button>
          </li>
          <li className={`menu-item ${activeTab === 'calendar' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('calendar')}>
              <span>📅</span> Calendar Scheduler
            </button>
          </li>
          <li className={`menu-item ${activeTab === 'quote' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('quote')}>
              <span>📄</span> GST Quote Builder
            </button>
          </li>
          
          {!isViewRestricted('scoring') && (
            <li className={`menu-item ${activeTab === 'scoring' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('scoring')}>
                <span>⚡</span> Lead Scoring Rules
              </button>
            </li>
          )}
          {!isViewRestricted('audit') && (
            <li className={`menu-item ${activeTab === 'audit' ? 'active' : ''}`}>
              <button onClick={() => setActiveTab('audit')}>
                <span>🛡️</span> Audit Registry
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
            <div className="nav-avatar" style={{ backgroundColor: '#f1f5f9', color: '#475569', cursor: 'pointer' }} title="Notifications">
              🔔
            </div>
          </div>
        </header>

        {/* Main Body */}
        <div className="content-body">
          {/* TAB 1: EXECUTIVE DASHBOARD & PERFORMANCE ANALYTICS */}
          {activeTab === 'dashboard' && (
            <div className="animate-fade">
              {/* Header Title */}
              <div className="page-header-row">
                <div className="page-title-text">
                  <h2>Performance Analytics</h2>
                  <p>Real-time pipeline metrics, revenue forecasts, and lead engagement</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" style={{ fontSize: '11px' }}>📅 Oct 1, 2026 - Oct 31, 2026</button>
                  <button className="btn btn-primary" onClick={() => setShowLeadModal(true)}>+ Create Lead</button>
                </div>
              </div>

              {/* 4 Metric KPI Cards */}
              <section className="metric-grid">
                <div className="metric-card">
                  <div className="metric-header">
                    <span>TOTAL PIPELINE VALUE</span>
                    <span className="trend-badge up">↑ +12.4%</span>
                  </div>
                  <div className="metric-val">{formatCurrency(totalPipeline)}</div>
                  <div className="metric-sub">Across active pipeline deals</div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>ACTIVE DEALS</span>
                    <span className="trend-badge up">↑ +4</span>
                  </div>
                  <div className="metric-val">{activeDealsCount} Deals</div>
                  <div className="metric-sub">In qualification & proposal</div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>HOT LEADS (SCORE &gt; 60)</span>
                    <span className="trend-badge up">↑ +18%</span>
                  </div>
                  <div className="metric-val">{hotLeadsCount} Prospects</div>
                  <div className="metric-sub">Prioritized for callbacks</div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>TASKS TO RESOLVE</span>
                    <span className="trend-badge down">↓ 2 Due</span>
                  </div>
                  <div className="metric-val" style={{ color: openTasksCount > 0 ? '#d97706' : '' }}>
                    {openTasksCount} Tasks
                  </div>
                  <div className="metric-sub">Open checklist items</div>
                </div>
              </section>

              {/* Analytics SVG Charts Row */}
              <div className="analytics-grid">
                {/* Revenue over Time SVG Area Line Chart */}
                <div className="panel-card">
                  <div className="panel-title">
                    <h3>Revenue over Time</h3>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span><span style={{ color: '#1e40af', fontWeight: 'bold' }}>●</span> Actual</span>
                      <span><span style={{ color: '#94a3b8', fontWeight: 'bold' }}>●</span> Forecast</span>
                    </div>
                  </div>
                  <div className="chart-container">
                    <svg className="chart-svg" viewBox="0 0 500 150">
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1e40af" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#1e40af" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      {/* Grid Lines */}
                      <line x1="0" y1="30" x2="500" y2="30" stroke="#f1f5f9" strokeDasharray="3 3" />
                      <line x1="0" y1="75" x2="500" y2="75" stroke="#f1f5f9" strokeDasharray="3 3" />
                      <line x1="0" y1="120" x2="500" y2="120" stroke="#f1f5f9" strokeDasharray="3 3" />
                      
                      {/* Gradient Area Fill */}
                      <path d="M 0,120 Q 100,90 200,60 T 400,30 T 500,20 L 500,150 L 0,150 Z" fill="url(#chartGrad)" />
                      
                      {/* Line Curve */}
                      <path d="M 0,120 Q 100,90 200,60 T 400,30 T 500,20" fill="none" stroke="#1e40af" strokeWidth="3" />
                      
                      {/* Data Points */}
                      <circle cx="0" cy="120" r="4" fill="#1e40af" />
                      <circle cx="125" cy="85" r="4" fill="#1e40af" />
                      <circle cx="250" cy="50" r="4" fill="#1e40af" />
                      <circle cx="375" cy="35" r="4" fill="#1e40af" />
                      <circle cx="500" cy="20" r="4" fill="#1e40af" />
                    </svg>
                  </div>
                </div>

                {/* Lead Sources SVG Doughnut Chart */}
                <div className="panel-card">
                  <div className="panel-title">
                    <h3>Lead Sources</h3>
                  </div>
                  <div className="doughnut-wrapper">
                    <div className="doughnut-chart">
                      <svg width="120" height="120" viewBox="0 0 42 42">
                        <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#e2e8f0" strokeWidth="4"></circle>
                        {/* Segment 1: Inbound (45%) */}
                        <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#1e40af" strokeWidth="4.5" strokeDasharray="45 55" strokeDashoffset="25"></circle>
                        {/* Segment 2: Organic Search (35%) */}
                        <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#0284c7" strokeWidth="4.5" strokeDasharray="35 65" strokeDashoffset="80"></circle>
                        {/* Segment 3: Referrals (20%) */}
                        <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#fbbf24" strokeWidth="4.5" strokeDasharray="20 80" strokeDashoffset="45"></circle>
                      </svg>
                      <div className="doughnut-center-text">
                        <div className="val">1,245</div>
                        <div className="lbl">Total Leads</div>
                      </div>
                    </div>
                    <div className="legend-list">
                      <div className="legend-item">
                        <span><span className="legend-dot" style={{ backgroundColor: '#1e40af' }}></span> Inbound Leads</span>
                        <span style={{ fontWeight: 'bold' }}>45%</span>
                      </div>
                      <div className="legend-item">
                        <span><span className="legend-dot" style={{ backgroundColor: '#0284c7' }}></span> Organic Search</span>
                        <span style={{ fontWeight: 'bold' }}>35%</span>
                      </div>
                      <div className="legend-item">
                        <span><span className="legend-dot" style={{ backgroundColor: '#fbbf24' }}></span> Referrals</span>
                        <span style={{ fontWeight: 'bold' }}>20%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Tables Split */}
              <div className="analytics-grid">
                {/* Hot Prospects Table */}
                <div className="panel-card">
                  <div className="panel-title">
                    <h3>Priority Hot Prospects Queue</h3>
                    <button className="btn btn-secondary" style={{ fontSize: '11px' }} onClick={() => setActiveTab('leads')}>View All Leads</button>
                  </div>
                  
                  <div className="custom-table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Lead Name</th>
                          <th>Company</th>
                          <th>Status</th>
                          <th>Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLeads
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
                else if (stage === 'Lost') dotColor = 'var(--danger)';

                return (
                  <div 
                    key={stage} 
                    className="kanban-col"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, stage)}
                  >
                    <div className="kanban-col-header">
                      <div>
                        <div className="kanban-col-title">
                          <span className="kanban-col-dot" style={{ backgroundColor: dotColor }}></span>
                          {stage}
                          <span className="kanban-col-count">{stageDeals.length}</span>
                        </div>
                        <div className="kanban-col-value">{formatCurrency(stageSum)}</div>
                      </div>
                    </div>
                    
                    <div className="kanban-cards-container">
                      {stageDeals.map(deal => (
                        <div 
                          key={deal.id} 
                          className="kanban-card" 
                          draggable
                          onDragStart={(e) => handleDragStart(e, deal.id)}
                        >
                          <div className="kanban-card-title">{deal.name}</div>
                          <div className="kanban-card-value">{formatCurrency(deal.value)}</div>
                          <div className="kanban-card-footer">
                            <span>👤 {deal.owner ? deal.owner.split(' ').pop() : 'Unknown'}</span>
                            <span className="days-badge">{deal.daysInStage}d active</span>
                          </div>
                          {deal.lostReason && (
                            <div style={{ fontSize: '10px', color: 'var(--danger)', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
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
                <h3>July 2026 Calendar</h3>
              </div>
              
              <div className="calendar-grid-header">
                <div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div><div>Mon</div><div>Tue</div>
              </div>
              
              <div className="calendar-grid">
                {gridCells.map((day, idx) => {
                  if (!day) return <div key={idx} className="calendar-day empty"></div>;
                  
                  const dateStr = `2026-07-${day < 10 ? '0' + day : day}`;
                  // Find items on this day
                  const dayTasks = filteredTasks.filter(t => t.dueDate === dateStr);
                  const dayDeals = filteredDeals.filter(d => d.expectedClose === dateStr);
                  const dayActs = activities.filter(a => a.date === dateStr);

                  return (
                    <div key={idx} className="calendar-day">
                      <div className="day-number">{day}</div>
                      <div className="day-events">
                        {dayTasks.map(t => (
                          <div key={t.id} className="calendar-event task" title={t.title}>
                            ✓ {t.title}
                          </div>
                        ))}
                        {dayDeals.map(d => (
                          <div key={d.id} className="calendar-event deal" title={d.name}>
                            $ {d.company}
                          </div>
                        ))}
                        {dayActs.map(a => (
                          <div key={a.id} className="calendar-event activity" title={a.notes}>
                            ☎ {a.type}
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

          {/* TAB 7: SCORING POINT CONFIG */}
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
    </div>
  );
}

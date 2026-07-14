import React, { useState } from 'react';
import './App.css';

// Initial Mock Data
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

interface AuditLog {
  id: string;
  user: string;
  action: string;
  entity: string;
  timestamp: string;
  beforeState: string;
  afterState: string;
}

interface QuoteItem {
  id: string;
  description: string;
  qty: number;
  price: number;
  gst: number;
}

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
    ]
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
    ]
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
    ]
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
    ]
  },
  {
    id: 'L-105',
    name: 'Suresh Kumar',
    company: 'Cauvery Water Systems',
    email: 'suresh@cauverywater.net',
    phone: '+91 98860 54321',
    status: 'Disqualified',
    score: -10,
    owner: 'KP Sumanth',
    activities: [
      { action: 'Call - no answer', points: -5, date: '2026-07-08' },
      { action: 'Marked "Not Interested"', points: -30, date: '2026-07-10' }
    ]
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
    expectedClose: '2026-08-15',
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
    expectedClose: '2026-09-01',
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
    expectedClose: '2026-07-30',
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
    expectedClose: '2026-07-01',
    owner: 'KP Sumanth',
    daysInStage: 25
  },
  {
    id: 'D-205',
    name: 'Hassan Spares — Custom Pipeline Setup',
    company: 'Hassan Spares Corp',
    value: 850000,
    stage: 'Lost',
    probability: 0,
    expectedClose: '2026-06-20',
    owner: 'Balasaraswathi',
    lostReason: 'Budget constraints',
    daysInStage: 8
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
    afterState: '{"id": "L-101", "name": "Ramesh Gowda", "company": "Mysore Agro Products", "score": 65}'
  },
  {
    id: 'LOG-002',
    user: 'Balasaraswathi',
    action: 'Deal Won',
    entity: 'Deal: Namma Metro Station Filter Renewal',
    timestamp: '2026-07-11 16:45:00',
    beforeState: '{"id": "D-204", "stage": "Negotiation", "probability": 70}',
    afterState: '{"id": "D-204", "stage": "Won", "probability": 100}'
  },
  {
    id: 'LOG-003',
    user: 'System Automator',
    action: 'Score Recalculated',
    entity: 'Lead: Suresh Kumar',
    timestamp: '2026-07-12 00:00:05',
    beforeState: '{"score": 20}',
    afterState: '{"score": -10, "status": "Disqualified"}'
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leads' | 'kanban' | 'scoring' | 'quote' | 'audit'>('dashboard');
  
  // Data States
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [rules, setRules] = useState(initialScoringRules);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(initialAuditLogs);
  
  // Quote Builder State
  const [quoteCompany, setQuoteCompany] = useState('Mysore Agro Products');
  const [quoteContact, setQuoteContact] = useState('Ramesh Gowda');
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([
    { id: '1', description: 'Industrial Centrifugal Water Pump v4', qty: 2, price: 450000, gst: 18 },
    { id: '2', description: 'Heavy Duty Inline Pipeline Filters (100mm)', qty: 10, price: 30000, gst: 18 }
  ]);
  
  // UI States
  const [showQuotePreview, setShowQuotePreview] = useState(false);
  const [showLostReasonModal, setShowLostReasonModal] = useState(false);
  const [selectedDealForLost, setSelectedDealForLost] = useState<string | null>(null);
  const [lostReasonInput, setLostReasonInput] = useState('Budget constraints');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [scoringNotification, setScoringNotification] = useState(false);

  // Helper: Format Currency (INR)
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Kanban Drag and Drop Logic
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
        setShowLostReasonModal(true);
      } else {
        updateDealStage(dealId, targetStage);
      }
    }
  };

  const updateDealStage = (dealId: string, stage: Deal['stage'], lostReason?: string) => {
    const prevDeal = deals.find(d => d.id === dealId);
    if (!prevDeal) return;
    
    const probability = stage === 'Won' ? 100 : stage === 'Lost' ? 0 : stage === 'Negotiation' ? 70 : stage === 'Proposal Sent' ? 40 : 10;
    
    setDeals(deals.map(d => {
      if (d.id === dealId) {
        return { ...d, stage, probability, lostReason };
      }
      return d;
    }));

    // Add Audit Log
    const newLog: AuditLog = {
      id: `LOG-${Date.now().toString().slice(-3)}`,
      user: 'KP Sumanth',
      action: 'Stage Transitioned',
      entity: `Deal: ${prevDeal.name}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      beforeState: JSON.stringify({ stage: prevDeal.stage, probability: prevDeal.probability }),
      afterState: JSON.stringify({ stage, probability, lostReason: lostReason || 'None' })
    };
    setAuditLogs([newLog, ...auditLogs]);

    if (stage === 'Won') {
      alert(`🎉 Deal Won! ${prevDeal.name} closed successfully.`);
    }
  };

  const handleLostReasonSubmit = () => {
    if (selectedDealForLost) {
      updateDealStage(selectedDealForLost, 'Lost', lostReasonInput);
      setShowLostReasonModal(false);
      setSelectedDealForLost(null);
    }
  };

  // Score Recalculator Logic
  const handleRecalculateScores = () => {
    setScoringNotification(true);
    setTimeout(() => setScoringNotification(false), 2500);

    setLeads(leads.map(lead => {
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
        // Log recalculation audit
        const newLog: AuditLog = {
          id: `LOG-${Date.now().toString().slice(-3)}`,
          user: 'System Automator',
          action: 'Dynamic Score Update',
          entity: `Lead: ${lead.name}`,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
          beforeState: JSON.stringify({ score: prevScore }),
          afterState: JSON.stringify({ score: newScore, status })
        };
        setAuditLogs(prev => [newLog, ...prev]);
      }

      return { ...lead, score: newScore, status };
    }));
  };

  // Calculations for dashboard indicators
  const totalPipeline = deals.reduce((acc, curr) => curr.stage !== 'Lost' ? acc + curr.value : acc, 0);
  const activeDealsCount = deals.filter(d => d.stage !== 'Won' && d.stage !== 'Lost').length;
  const hotLeadsCount = leads.filter(l => l.score >= 60 && l.status !== 'Disqualified').length;

  return (
    <div className="app-container">
      {/* Sidebar navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo-icon">A</div>
          <div className="sidebar-brand-name">
            <h1>Anveshak CRM</h1>
            <span>Version 2.0 (V2)</span>
          </div>
        </div>
        
        <ul className="sidebar-menu">
          <li className={`menu-item ${activeTab === 'dashboard' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('dashboard')}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
              Dashboard
            </button>
          </li>
          <li className={`menu-item ${activeTab === 'leads' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('leads')}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm8-2h6m-3-3v6"></path></svg>
              Lead Prioritization
            </button>
          </li>
          <li className={`menu-item ${activeTab === 'kanban' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('kanban')}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
              Kanban Board
            </button>
          </li>
          <li className={`menu-item ${activeTab === 'scoring' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('scoring')}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              Scoring Weights
            </button>
          </li>
          <li className={`menu-item ${activeTab === 'quote' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('quote')}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              GST Quote Generator
            </button>
          </li>
          <li className={`menu-item ${activeTab === 'audit' ? 'active' : ''}`}>
            <button onClick={() => setActiveTab('audit')}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
              Audit logs
            </button>
          </li>
        </ul>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">KP</div>
            <div className="user-info">
              <h4>KP Sumanth</h4>
              <p>System Admin (Owner)</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main-content">
        <header className="top-bar">
          <div className="page-title">
            <h2>
              {activeTab === 'dashboard' && 'Executive Performance Dashboard'}
              {activeTab === 'leads' && 'Priority Lead Queue'}
              {activeTab === 'kanban' && 'Interactive Deal Pipeline'}
              {activeTab === 'scoring' && 'Rule-Based Lead Scoring Weights'}
              {activeTab === 'quote' && 'GST-Compliant Quote Compiler'}
              {activeTab === 'audit' && 'Security Governance Audit Trail'}
            </h2>
          </div>
          
          <div className="top-bar-actions">
            {activeTab === 'leads' && (
              <button className="btn btn-primary pulse-border" onClick={handleRecalculateScores}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17"></path></svg>
                Recalculate Scores
              </button>
            )}
            <div className="notification-bell">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
              <span className="bell-dot"></span>
            </div>
          </div>
        </header>

        <div className="content-body">
          {/* Notifications Alert */}
          {scoringNotification && (
            <div className="badge badge-hot animate-fade" style={{ display: 'flex', width: '100%', padding: '16px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px' }}>
              ⚡ Scoring rules successfully updated! Scores and priority badges recalculated across all system records.
            </div>
          )}

          {/* TAB 1: EXECUTIVE DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="animate-fade">
              <section className="metric-grid">
                <div className="metric-card">
                  <div className="metric-header">
                    <span>TOTAL PIPELINE VALUE</span>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                  <div className="metric-val">{formatCurrency(totalPipeline)}</div>
                  <div className="metric-sub">▲ 14.2% from last month</div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>ACTIVE NEGOTIATIONS</span>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  </div>
                  <div className="metric-val">{activeDealsCount} Deals</div>
                  <div className="metric-sub">6 in Proposal stage</div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>HOT LEADS (SCORE &gt; 60)</span>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  </div>
                  <div className="metric-val">{hotLeadsCount} Leads</div>
                  <div className="metric-sub">Prioritized for callbacks</div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>AVERAGE WIN RATE</span>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z"></path></svg>
                  </div>
                  <div className="metric-val">76%</div>
                  <div className="metric-sub">▲ 2% compared to industry</div>
                </div>
              </section>

              <div className="dashboard-split">
                {/* Hot Leads Table */}
                <div className="panel-card">
                  <div className="panel-title">
                    <h3>Hottest Prospects Queue</h3>
                    <button className="btn btn-secondary" onClick={() => setActiveTab('leads')}>View All</button>
                  </div>
                  
                  <div className="custom-table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Lead</th>
                          <th>Company</th>
                          <th>Status</th>
                          <th>Priority</th>
                          <th>Lead Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leads
                          .filter(l => l.status !== 'Disqualified')
                          .sort((a, b) => b.score - a.score)
                          .slice(0, 4)
                          .map(lead => (
                            <tr key={lead.id}>
                              <td>
                                <div className="lead-name-cell">
                                  <div className="lead-initials">{lead.name.split(' ').map(n=>n[0]).join('')}</div>
                                  <span>{lead.name}</span>
                                </div>
                              </td>
                              <td>{lead.company}</td>
                              <td>{lead.status}</td>
                              <td>
                                <span className={`badge ${lead.score >= 60 ? 'badge-hot' : 'badge-warm'}`}>
                                  {lead.score >= 60 ? 'Hot' : 'Warm'}
                                </span>
                              </td>
                              <td style={{ fontWeight: 'bold', color: 'var(--primary-hover)' }}>{lead.score} pts</td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Conversion Funnel */}
                <div className="panel-card">
                  <div className="panel-title">
                    <h3>Pipeline Funnel</h3>
                  </div>
                  <div className="funnel-container">
                    <div className="funnel-row">
                      <span className="funnel-label">Lead</span>
                      <div className="funnel-bar-container">
                        <div className="funnel-bar" style={{ width: '100%' }}>100%</div>
                      </div>
                      <span className="funnel-val">12</span>
                    </div>
                    <div className="funnel-row">
                      <span className="funnel-label">Contacted</span>
                      <div className="funnel-bar-container">
                        <div className="funnel-bar" style={{ width: '83%' }}>83%</div>
                      </div>
                      <span className="funnel-val">10</span>
                    </div>
                    <div className="funnel-row">
                      <span className="funnel-label">Proposal</span>
                      <div className="funnel-bar-container">
                        <div className="funnel-bar" style={{ width: '58%' }}>58%</div>
                      </div>
                      <span className="funnel-val">7</span>
                    </div>
                    <div className="funnel-row">
                      <span className="funnel-label">Negotiation</span>
                      <div className="funnel-bar-container">
                        <div className="funnel-bar" style={{ width: '33%' }}>33%</div>
                      </div>
                      <span className="funnel-val">4</span>
                    </div>
                    <div className="funnel-row">
                      <span className="funnel-label">Closed Won</span>
                      <div className="funnel-bar-container">
                        <div className="funnel-bar" style={{ width: '25%', backgroundColor: 'var(--success)' }}>25%</div>
                      </div>
                      <span className="funnel-val">3</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRIORITY LEAD LIST */}
          {activeTab === 'leads' && (
            <div className="panel-card animate-fade">
              <div className="panel-title">
                <h3>System Leads Database</h3>
              </div>
              
              <div className="custom-table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Lead Contact</th>
                      <th>Company</th>
                      <th>Email / Phone</th>
                      <th>Status</th>
                      <th>Assigned Owner</th>
                      <th>Scoring Audit Breakdown</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map(lead => (
                      <tr key={lead.id}>
                        <td>
                          <div className="lead-name-cell">
                            <div className="lead-initials" style={{ backgroundColor: lead.score < 0 ? 'var(--danger-bg)' : '' }}>
                              {lead.name.split(' ').map(n=>n[0]).join('')}
                            </div>
                            <div>
                              <div style={{ fontWeight: '600' }}>{lead.name}</div>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{lead.id}</span>
                            </div>
                          </div>
                        </td>
                        <td>{lead.company}</td>
                        <td>
                          <div>{lead.email}</div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{lead.phone}</span>
                        </td>
                        <td>
                          <span className={`badge ${lead.status === 'Disqualified' ? 'badge-cold' : lead.status === 'Qualified' ? 'badge-hot' : 'badge-warm'}`}>
                            {lead.status}
                          </span>
                        </td>
                        <td>{lead.owner}</td>
                        <td style={{ maxWidth: '280px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {lead.activities.map((act, i) => (
                              <span key={i} style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                                {act.action} ({act.points > 0 ? `+${act.points}` : act.points})
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ fontWeight: 'bold', fontSize: '14px', color: lead.score >= 60 ? 'var(--success)' : lead.score < 0 ? 'var(--danger)' : 'var(--warning)' }}>
                          {lead.score}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: KANBAN DEAL PIPELINE */}
          {activeTab === 'kanban' && (
            <div className="kanban-board animate-fade">
              {(['New', 'Contacted', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'] as const).map(stage => {
                const stageDeals = deals.filter(d => d.stage === stage);
                const stageSum = stageDeals.reduce((acc, curr) => acc + curr.value, 0);
                
                let dotColor = 'var(--text-muted)';
                if (stage === 'Proposal Sent') dotColor = 'var(--info)';
                else if (stage === 'Negotiation') dotColor = 'var(--warning)';
                else if (stage === 'Won') dotColor = 'var(--success)';
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
                          <div className="kanban-card-title">{deal.company}</div>
                          <div className="kanban-card-value">{formatCurrency(deal.value)}</div>
                          <div className="kanban-card-footer">
                            <span>👤 {deal.owner.split(' ').slice(-1)}</span>
                            <span className="days-badge">{deal.daysInStage}d active</span>
                          </div>
                          {deal.lostReason && (
                            <div style={{ fontSize: '10px', color: 'var(--danger)', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                              ⚠️ {deal.lostReason}
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

          {/* TAB 4: SCORING RULES CONFIGURATOR */}
          {activeTab === 'scoring' && (
            <div className="panel-card animate-fade" style={{ maxWidth: '600px' }}>
              <div className="panel-title">
                <h3>Admin Lead Scoring Points Weights</h3>
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
                    <td style={{ padding: '12px 0' }}>Request Product Demo</td>
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
                    <td style={{ padding: '12px 0' }}>Schedule Callback/Meeting</td>
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
                    <td style={{ padding: '12px 0' }}>Outbound Call - Answered</td>
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
                    <td style={{ padding: '12px 0' }}>Inbound Email Opened</td>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="number" 
                        className="scoring-input" 
                        value={rules.emailOpened} 
                        onChange={(e) => setRules({ ...rules, emailOpened: parseInt(e.target.value) || 0 })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '12px 0' }}>Email Link Clicked</td>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="number" 
                        className="scoring-input" 
                        value={rules.emailClicked} 
                        onChange={(e) => setRules({ ...rules, emailClicked: parseInt(e.target.value) || 0 })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '12px 0' }}>Outbound Call - No Answer</td>
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
                    <td style={{ padding: '12px 0' }}>No activity in 7 days</td>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="number" 
                        className="scoring-input" 
                        value={rules.noActivity7Days} 
                        onChange={(e) => setRules({ ...rules, noActivity7Days: parseInt(e.target.value) || 0 })}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '12px 0' }}>Marked as "Not Interested"</td>
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
                <button className="btn btn-primary" onClick={handleRecalculateScores}>
                  Save & Apply Rules
                </button>
                <button className="btn btn-secondary" onClick={() => setRules(initialScoringRules)}>
                  Reset Defaults
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: GST QUOTE GENERATOR */}
          {activeTab === 'quote' && (
            <div className="panel-card animate-fade">
              <div className="panel-title">
                <h3>Quotation Data Compilation</h3>
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
                  
                  <h4 style={{ margin: '20px 0 10px 0', fontSize: '14px' }}>Quotation Line Items</h4>
                  
                  {quoteItems.map((item, index) => (
                    <div key={item.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '12px' }}>
                      <div className="form-group" style={{ flexGrow: 1, marginBottom: 0 }}>
                        <label style={{ fontSize: '11px' }}>Description</label>
                        <input 
                          type="text" 
                          value={item.description} 
                          onChange={(e) => {
                            const newItems = [...quoteItems];
                            newItems[index].description = e.target.value;
                            setQuoteItems(newItems);
                          }} 
                        />
                      </div>
                      <div className="form-group" style={{ width: '70px', marginBottom: 0 }}>
                        <label style={{ fontSize: '11px' }}>Qty</label>
                        <input 
                          type="number" 
                          value={item.qty} 
                          onChange={(e) => {
                            const newItems = [...quoteItems];
                            newItems[index].qty = parseInt(e.target.value) || 0;
                            setQuoteItems(newItems);
                          }} 
                        />
                      </div>
                      <div className="form-group" style={{ width: '110px', marginBottom: 0 }}>
                        <label style={{ fontSize: '11px' }}>Rate (INR)</label>
                        <input 
                          type="number" 
                          value={item.price} 
                          onChange={(e) => {
                            const newItems = [...quoteItems];
                            newItems[index].price = parseInt(e.target.value) || 0;
                            setQuoteItems(newItems);
                          }} 
                        />
                      </div>
                      <div className="form-group" style={{ width: '80px', marginBottom: 0 }}>
                        <label style={{ fontSize: '11px' }}>GST %</label>
                        <input 
                          type="number" 
                          value={item.gst} 
                          onChange={(e) => {
                            const newItems = [...quoteItems];
                            newItems[index].gst = parseInt(e.target.value) || 0;
                            setQuoteItems(newItems);
                          }} 
                        />
                      </div>
                      <button 
                        className="btn btn-secondary" 
                        style={{ height: '38px', color: 'var(--danger)', borderColor: 'var(--danger-bg)' }}
                        onClick={() => setQuoteItems(quoteItems.filter(qi => qi.id !== item.id))}
                      >
                        🗑️
                      </button>
                    </div>
                  ))}

                  <button 
                    className="btn btn-secondary" 
                    style={{ marginTop: '10px' }}
                    onClick={() => setQuoteItems([...quoteItems, { id: Date.now().toString(), description: 'New Line Item', qty: 1, price: 10000, gst: 18 }])}
                  >
                    + Add Row
                  </button>
                </div>

                <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '24px' }}>
                  <h4 style={{ marginBottom: '14px', fontSize: '14px' }}>Billing Summary Preview</h4>
                  
                  <div className="quote-summary">
                    <div className="quote-summary-row">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(quoteItems.reduce((acc, curr) => acc + (curr.qty * curr.price), 0))}</span>
                    </div>
                    <div className="quote-summary-row">
                      <span>GST Component:</span>
                      <span>{formatCurrency(quoteItems.reduce((acc, curr) => acc + (curr.qty * curr.price * (curr.gst / 100)), 0))}</span>
                    </div>
                    <div className="quote-summary-row total">
                      <span>Grand Total:</span>
                      <span>{formatCurrency(quoteItems.reduce((acc, curr) => acc + (curr.qty * curr.price * (1 + curr.gst / 100)), 0))}</span>
                    </div>
                  </div>

                  <button 
                    className="btn btn-primary" 
                    style={{ marginTop: '24px', width: '100%', justifyContent: 'center' }}
                    onClick={() => {
                      setShowQuotePreview(true);
                      // Add Audit Log for quote creation
                      const newLog: AuditLog = {
                        id: `LOG-${Date.now().toString().slice(-3)}`,
                        user: 'KP Sumanth',
                        action: 'Quote Compiled',
                        entity: `Quote: ${quoteCompany}`,
                        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
                        beforeState: 'Draft',
                        afterState: JSON.stringify({ company: quoteCompany, total: quoteItems.reduce((acc, curr) => acc + (curr.qty * curr.price * (1 + curr.gst / 100)), 0) })
                      };
                      setAuditLogs([newLog, ...auditLogs]);
                    }}
                  >
                    Generate Printable GST Invoice
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: AUDIT GOVERNANCE LOGS */}
          {activeTab === 'audit' && (
            <div className="panel-card animate-fade">
              <div className="panel-title">
                <h3>Data Governance Registry</h3>
              </div>
              
              <div className="audit-filters">
                <input type="text" placeholder="Search by user/action..." style={{ width: '250px' }} />
                <select>
                  <option>All Operations</option>
                  <option>Stage Transitioned</option>
                  <option>Dynamic Score Update</option>
                  <option>Quote Compiled</option>
                </select>
              </div>

              <div className="custom-table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Time stamp</th>
                      <th>Executing User</th>
                      <th>Operation Event</th>
                      <th>Affected Record</th>
                      <th>Security State Logs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map(log => (
                      <tr key={log.id}>
                        <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{log.timestamp}</td>
                        <td style={{ fontWeight: '600' }}>{log.user}</td>
                        <td>
                          <span className={`badge ${log.action.includes('Transition') ? 'badge-warm' : log.action.includes('Update') ? 'badge-hot' : 'badge-cold'}`}>
                            {log.action}
                          </span>
                        </td>
                        <td>{log.entity}</td>
                        <td>
                          <button 
                            className="audit-diff-trigger"
                            onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                          >
                            {expandedLogId === log.id ? 'Close State Block' : 'View State Diff JSON'}
                          </button>
                          
                          {expandedLogId === log.id && (
                            <div className="audit-diff-block">
                              <span style={{ color: 'var(--danger)' }}>- BEFORE STATE:</span> {log.beforeState}
                              <br />
                              <span style={{ color: 'var(--success)' }}>+ AFTER STATE:</span> {log.afterState}
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

      {/* MODAL 1: LOST DEAL REASON DIALOG */}
      {showLostReasonModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Specify Lost Opportunity Reason</h3>
              <button className="modal-close-btn" onClick={() => setShowLostReasonModal(false)}>×</button>
            </div>
            
            <div className="form-group">
              <label>Reason for Loss</label>
              <select value={lostReasonInput} onChange={(e) => setLostReasonInput(e.target.value)}>
                <option value="Budget constraints">Budget constraints (Price too high)</option>
                <option value="Competitor selection">Competitor selection (Zoho/HubSpot)</option>
                <option value="Timing / Project suspended">Timing (Project delayed or suspended)</option>
                <option value="Feature deficit">Feature deficit (No mobile app v1)</option>
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowLostReasonModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ backgroundColor: 'var(--danger)' }} onClick={handleLostReasonSubmit}>
                Confirm Mark Lost
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: INVOICE/QUOTE PRINT PREVIEW */}
      {showQuotePreview && (
        <div className="modal-overlay">
          <div className="modal-content wide">
            <div className="modal-header">
              <h3>GST-Compliant Invoice Document Preview</h3>
              <button className="modal-close-btn" onClick={() => setShowQuotePreview(false)}>×</button>
            </div>
            
            <div className="invoice-preview-container">
              <div className="invoice-preview-header">
                <div>
                  <div className="invoice-preview-logo">ANVESHAK HUB PRIVATE LIMITED</div>
                  <p style={{ marginTop: '4px' }}>Registered Office: Malleshwaram, Bangalore, Karnataka</p>
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
                    const rowGst = rowSub * (item.gst / 100);
                    return (
                      <tr key={item.id}>
                        <td>{item.description}</td>
                        <td style={{ textAlign: 'center' }}>{item.qty}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(item.price)}</td>
                        <td style={{ textAlign: 'center' }}>{item.gst}%</td>
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
                    {formatCurrency(quoteItems.reduce((acc, curr) => acc + (curr.qty * curr.price * (curr.gst / 100)), 0))}
                  </span>
                </div>
                <div style={{ fontSize: '16px', borderTop: '2px solid #cbd5e1', paddingTop: '8px', marginTop: '6px' }}>
                  <span style={{ color: '#0f172a', fontWeight: 'bold' }}>Grand Total (INR): </span>
                  <span style={{ fontWeight: 'bold', color: '#0d9488' }}>
                    {formatCurrency(quoteItems.reduce((acc, curr) => acc + (curr.qty * curr.price * (1 + curr.gst / 100)), 0))}
                  </span>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowQuotePreview(false)}>Close Preview</button>
              <button className="btn btn-primary" onClick={() => {
                alert('🖨️ Simulating Print Layout / PDF Dispatch. Action logged in Audit Trail.');
                setShowQuotePreview(false);
                // Add Audit Log for quote export
                const newLog: AuditLog = {
                  id: `LOG-${Date.now().toString().slice(-3)}`,
                  user: 'KP Sumanth',
                  action: 'Quote Exported',
                  entity: `Quote Doc: AH-2026-${quoteCompany.slice(0, 3).toUpperCase()}`,
                  timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
                  beforeState: 'Ready',
                  afterState: 'Exported & Sim-Mailed'
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

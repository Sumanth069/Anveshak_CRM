"use client";

import React, { useState, useMemo } from 'react';

export function normalizeDealStage(stage?: string): string {
  if (!stage) return 'New';
  const s = stage.trim().toLowerCase();
  if (s === 'new' || s === 'discovered' || s === 'discovery' || s === 'lead' || s === 'inquiry') return 'New';
  if (s === 'contacted' || s === 'engaged' || s === 'meeting' || s === 'scheduled') return 'Contacted';
  if (s === 'proposal sent' || s === 'proposal' || s === 'quote shared' || s === 'quote' || s === 'pricing') return 'Proposal Sent';
  if (s === 'negotiation' || s === 'terms' || s === 'in review') return 'Negotiation';
  if (s === 'won' || s === 'closed won' || s === 'closed-won') return 'Won';
  if (s === 'lost' || s === 'closed lost' || s === 'closed-lost' || s === 'rejected') return 'Lost';
  return 'New';
}

export interface Deal {
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

interface KanbanBoardProps {
  deals: Deal[];
  filteredDeals?: Deal[];
  stages: string[];
  pipelineLayoutMode: 'kanban' | 'table';
  setPipelineLayoutMode: (mode: 'kanban' | 'table') => void;
  setShowLeadModal: (show: boolean) => void;
  setSelectedDealDetail: (deal: Deal | null) => void;
  handleDragStart: (e: React.DragEvent, id: string) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, stage: string) => void;
  onStageChange?: (dealId: string, newStage: string, reason?: string) => void;
  onUpdateDeal?: (dealId: string, updates: Partial<Deal>) => void;
  onDeleteDeal?: (dealId: string) => void;
  onQuickAddDeal?: (stage: string) => void;
  onNavigateTab?: (tab: string) => void;
  formatCurrency: (val: number) => string;
}


const TrashIcon = ({ size = 14, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
);
const EditIcon = ({ size = 14, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
);
const BriefcaseIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
);
const PlusIcon = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
);
const BuildingIcon = ({ size = 13, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 10V11m4 10V11m-4 0h4M7 7h.01M7 11h.01M7 15h.01M17 7h.01M17 11h.01M17 15h.01"/></svg>
);
const CalendarIcon = ({ size = 13, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
);
const TrophyIcon = ({ size = 14, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
);

export default function KanbanBoard({
  deals,
  filteredDeals,
  stages,
  pipelineLayoutMode,
  setPipelineLayoutMode,
  setShowLeadModal,
  setSelectedDealDetail,
  handleDragStart,
  handleDragOver,
  handleDrop,
  onStageChange,
  onUpdateDeal,
  onDeleteDeal,
  onQuickAddDeal,
  onNavigateTab,
  formatCurrency
}: KanbanBoardProps) {
  const [selectedMobileStage, setSelectedMobileStage] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [valueFilter, setValueFilter] = useState<'all' | 'high' | 'mid' | 'low'>('all');
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    company: string;
    value: string;
    stage: string;
    probability: number;
    expectedClose: string;
    lostReason?: string;
  }>({
    name: '',
    company: '',
    value: '500000',
    stage: 'New',
    probability: 10,
    expectedClose: new Date().toISOString().slice(0, 10),
    lostReason: ''
  });
  const [showLostModalFor, setShowLostModalFor] = useState<string | null>(null);
  const [lostReasonText, setLostReasonText] = useState<string>('Budget constraints / competitor chosen');

  // Deduplicate and normalize list
  const normalizedUniqueDeals = useMemo(() => {
    const list = filteredDeals && filteredDeals.length > 0 ? filteredDeals : deals;
    const seen = new Set<string>();
    const unique: Deal[] = [];
    for (const d of list) {
      if (!d) continue;
      const comp = (d.company || '').trim().toLowerCase();
      const nm = (d.name || '').trim().toLowerCase();
      const key = comp ? `${comp}::${nm}` : (nm ? `name:${nm}` : `id:${d.id}`);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push({ ...d, stage: normalizeDealStage(d.stage) });
      }
    }
    return unique;
  }, [filteredDeals, deals]);

  // Filtered by Search & Value
  const displayedDeals = useMemo(() => {
    return normalizedUniqueDeals.filter(d => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = !q || d.name.toLowerCase().includes(q) || (d.company && d.company.toLowerCase().includes(q)) || (d.owner && d.owner.toLowerCase().includes(q));
      
      let matchesValue = true;
      if (valueFilter === 'high') matchesValue = d.value >= 500000;
      else if (valueFilter === 'mid') matchesValue = d.value >= 100000 && d.value < 500000;
      else if (valueFilter === 'low') matchesValue = d.value < 100000;

      return matchesSearch && matchesValue;
    });
  }, [normalizedUniqueDeals, searchTerm, valueFilter]);

  const visibleStages = selectedMobileStage === 'All' 
    ? stages 
    : stages.filter(s => s === selectedMobileStage);

  const totalPipelineSum = useMemo(() => {
    return displayedDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  }, [displayedDeals]);

  const getNextStage = (currentStage: string): string | null => {
    const idx = stages.indexOf(currentStage);
    if (idx !== -1 && idx < stages.length - 2) {
      return stages[idx + 1];
    }
    return null;
  };

  const getPrevStage = (currentStage: string): string | null => {
    const idx = stages.indexOf(currentStage);
    if (idx > 0 && idx < stages.length - 1) {
      return stages[idx - 1];
    }
    return null;
  };

  const openEditModal = (deal: Deal, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDeal(deal);
    setEditForm({
      name: deal.name,
      company: deal.company,
      value: String(deal.value),
      stage: deal.stage,
      probability: deal.probability,
      expectedClose: deal.expectedClose || new Date().toISOString().slice(0, 10),
      lostReason: deal.lostReason || ''
    });
  };

  const saveEditModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeal) return;
    const numVal = parseFloat(editForm.value) || 0;
    if (onUpdateDeal) {
      onUpdateDeal(editingDeal.id, {
        name: editForm.name,
        company: editForm.company,
        value: numVal,
        stage: editForm.stage,
        probability: editForm.probability,
        expectedClose: editForm.expectedClose,
        lostReason: editForm.stage === 'Lost' ? editForm.lostReason : undefined
      });
    }
    setEditingDeal(null);
  };

  const handleStageAdvance = (dealId: string, targetStage: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (targetStage === 'Lost') {
      setShowLostModalFor(dealId);
    } else {
      if (onStageChange) onStageChange(dealId, targetStage);
    }
  };

  return (
    <div className="animate-fade">
      {/* Header Row */}
      <div className="page-header-row kanban-header-wrap">
        <div className="page-title-text">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            Deals & Pipeline
            <span style={{ 
              fontSize: '12px', 
              background: '#1e293b', 
              color: '#f59e0b', 
              padding: '3px 10px', 
              borderRadius: '20px', 
              fontWeight: 700 
            }}>
              {displayedDeals.length} Deals • {formatCurrency(totalPipelineSum)}
            </span>
          </h2>
        </div>

        <div className="kanban-controls-row">
          {/* Quick Search */}
          <input
            type="text"
            placeholder="Search deals or companies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              width: '200px',
              backgroundColor: '#fff'
            }}
          />

          {/* Value Filter */}
          <select
            value={valueFilter}
            onChange={(e) => setValueFilter(e.target.value as any)}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#fff',
              fontWeight: 600
            }}
          >
            <option value="all">All Values</option>
            <option value="high">High (&gt; ₹5L)</option>
            <option value="mid">Mid (₹1L - ₹5L)</option>
            <option value="low">Starter (&lt; ₹1L)</option>
          </select>

          {/* Layout Toggle Option */}
          <div className="layout-toggle-pills">
            <button 
              className={`btn ${pipelineLayoutMode === 'kanban' ? 'btn-primary' : 'btn-secondary'}`} 
              style={{ padding: '6px 14px', fontSize: '11.5px', height: '32px' }}
              onClick={() => setPipelineLayoutMode('kanban')}
            >
              Kanban Board
            </button>
            <button 
              className={`btn ${pipelineLayoutMode === 'table' ? 'btn-primary' : 'btn-secondary'}`} 
              style={{ padding: '6px 14px', fontSize: '11.5px', height: '32px' }}
              onClick={() => setPipelineLayoutMode('table')}
            >
              Table Funnel
            </button>
          </div>
          
          <button className="btn btn-primary" onClick={() => setShowLeadModal(true)}>
            + New Deal
          </button>
        </div>
      </div>

      {/* Global Empty State Banner */}
      {normalizedUniqueDeals.length === 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #1e293b, #0f172a)',
          border: '1px solid #334155',
          borderRadius: '16px',
          padding: '36px 24px',
          textAlign: 'center',
          color: '#fff',
          marginBottom: '24px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)'
        }}>
          <div style={{ marginBottom: "12px", display: "flex", justifyContent: "center" }}><BriefcaseIcon size={40} color="#3b82f6" /></div>
          <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#f8fafc', marginBottom: '8px' }}>
            Pipeline is Ready for Your Deals
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '13.5px', maxWidth: '520px', margin: '0 auto 20px auto', lineHeight: '1.6' }}>
            There are currently no deals in this pipeline view. You can convert prospects from your Contacts Directory or create custom opportunities directly.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-primary" 
              style={{ padding: '10px 22px', fontSize: '13px' }}
              onClick={() => setShowLeadModal(true)}
            >
              + Create New Deal Now
            </button>
            {onNavigateTab && (
              <button 
                className="btn btn-secondary" 
                style={{ padding: '10px 22px', fontSize: '13px', backgroundColor: '#334155', color: '#fff', borderColor: '#475569' }}
                onClick={() => onNavigateTab('contacts')}
              >
                Convert from Contacts Directory →
              </button>
            )}
          </div>
        </div>
      )}

      {pipelineLayoutMode === 'table' ? (
        <>
          {/* Active Deals Pipeline Table */}
          <div className="panel-card" style={{ marginBottom: '24px' }}>
            <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Active Deals Pipeline Funnel</h3>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Showing {displayedDeals.length} active deals
              </div>
            </div>

            <div className="custom-table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Deal Name & Account</th>
                    <th>Stage</th>
                    <th>Value</th>
                    <th>Close Target</th>
                    <th>Probability</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedDeals.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        No deals match your search criteria. Click "+ New Deal" to create one.
                      </td>
                    </tr>
                  ) : (
                    displayedDeals.map(deal => (
                      <tr key={deal.id} onClick={() => setSelectedDealDetail(deal)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="user-avatar" style={{ width: '28px', height: '28px', fontSize: '11px', backgroundColor: '#182238', color: '#f5d396' }}>
                              {deal.name ? deal.name[0] : 'D'}
                            </div>
                            <div>
                              <div style={{ fontWeight: '700' }}>{deal.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{deal.company} • {deal.owner}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${deal.stage === 'Won' ? 'badge-success' : deal.stage === 'Lost' ? 'badge-danger' : 'badge-warm'}`}>
                            {deal.stage}
                          </span>
                        </td>
                        <td style={{ fontWeight: '800', color: '#10b981' }}>{formatCurrency(deal.value)}</td>
                        <td style={{ fontSize: '12px' }}>{deal.expectedClose}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div className="prob-progress-bar" style={{ width: '60px' }}>
                              <div className="prob-progress-fill" style={{ width: `${deal.probability}%` }}></div>
                            </div>
                            <span style={{ fontWeight: 'bold', fontSize: '11px' }}>{deal.probability}%</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '11px', marginRight: '6px' }}
                            onClick={(e) => openEditModal(deal, e)}
                          >
                            Edit
                          </button>
                          {onDeleteDeal && (
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '4px 8px', fontSize: '11px', color: '#dc2626', borderColor: '#fca5a5' }}
                              onClick={(e) => { e.stopPropagation(); if (confirm(`Delete deal "${deal.name}"?`)) onDeleteDeal(deal.id); }}
                            ><TrashIcon size={13} color="#dc2626" /></button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Mobile Stage Selector Tab Bar */}
          <div className="mobile-stage-selector-wrap">
            <div className="mobile-stage-selector">
              <button
                className={`stage-pill-btn ${selectedMobileStage === 'All' ? 'active' : ''}`}
                onClick={() => setSelectedMobileStage('All')}
              >
                All ({displayedDeals.length})
              </button>
              {stages.map(s => {
                const count = displayedDeals.filter(d => normalizeDealStage(d.stage) === s).length;
                return (
                  <button
                    key={s}
                    className={`stage-pill-btn ${selectedMobileStage === s ? 'active' : ''}`}
                    onClick={() => setSelectedMobileStage(s)}
                  >
                    {s} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Drag and Drop Stage Kanban Board */}
          <div className="kanban-board">
            {visibleStages.map(stage => {
              const stageDeals = displayedDeals.filter(d => normalizeDealStage(d.stage) === stage);
              const stageTotal = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);

              return (
                <div 
                  key={stage} 
                  className="kanban-col"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage)}
                >
                  <div className="kanban-col-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="kanban-col-title">{stage}</span>
                      <span className="kanban-col-count">{stageDeals.length}</span>
                    </div>
                    {onQuickAddDeal && (
                      <button 
                        title={`Add Deal to ${stage}`}
                        onClick={() => onQuickAddDeal(stage)}
                        style={{
                          background: '#f1f5f9',
                          border: 'none',
                          borderRadius: '6px',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          color: '#475569'
                        }}
                      >
                        +
                      </button>
                    )}
                  </div>

                  <div style={{ padding: '4px 16px 8px', fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>
                    {formatCurrency(stageTotal)}
                  </div>

                  <div className="kanban-cards-container">
                    {stageDeals.length === 0 ? (
                      <div 
                        className="kanban-empty-col"
                        style={{ cursor: onQuickAddDeal ? 'pointer' : 'default' }}
                        onClick={() => onQuickAddDeal && onQuickAddDeal(stage)}
                      >
                        <div style={{ marginBottom: "4px", display: "flex", justifyContent: "center" }}><PlusIcon size={18} color="#94a3b8" /></div>
                        <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: '600' }}>
                          Drop deals here or click to add
                        </p>
                      </div>
                    ) : (
                      stageDeals.map(deal => {
                        const nextStage = getNextStage(stage);
                        const prevStage = getPrevStage(stage);

                        return (
                          <div 
                            key={deal.id} 
                            className="kanban-card"
                            draggable
                            onDragStart={(e) => handleDragStart(e, deal.id)}
                            onClick={() => setSelectedDealDetail(deal)}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div className="kanban-card-title">{deal.name}</div>
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <button 
                                  title="Quick Edit Deal"
                                  onClick={(e) => openEditModal(deal, e)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    color: '#64748b',
                                    padding: '0 2px'
                                  }}
                                ><EditIcon size={13} color="#64748b" /></button>
                                {onDeleteDeal && (
                                  <button 
                                    title="Delete Deal"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteDeal(deal.id);
                                    }}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      color: '#dc2626',
                                      padding: '0 2px'
                                    }}
                                  ><TrashIcon size={13} color="#dc2626" /></button>
                                )}
                              </div>
                            </div>

                            <div style={{ fontSize: '11.5px', color: '#d49b38', fontWeight: '700', margin: '2px 0 6px 0', textTransform: 'uppercase' }}>
                              {deal.company}
                            </div>

                            <div className="kanban-card-value" style={{ fontSize: '14px', fontWeight: '800', color: '#10b981' }}>
                              {formatCurrency(deal.value)}
                            </div>
                            
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 8px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span>Close: <strong>{deal.expectedClose}</strong></span>
                              <span style={{ fontWeight: '700', color: '#3b82f6' }}>{deal.probability}%</span>
                            </div>

                            <div className="kanban-card-footer">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div className="user-avatar" style={{ width: '22px', height: '22px', fontSize: '9px', backgroundColor: '#151c2e', color: '#f5d396' }}>
                                  {deal.owner ? deal.owner.split(' ').map(n=>n[0]).join('') : 'R'}
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{deal.owner ? deal.owner.split(' ').pop() : 'Rep'}</span>
                              </div>
                              <span 
                                className="days-badge" 
                                style={deal.daysInStage > 14 ? { backgroundColor: '#fee2e2', color: '#ef4444', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' } : { backgroundColor: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}
                              >
                                {deal.daysInStage > 14 ? `${deal.daysInStage}d` : `${deal.daysInStage}d`}
                              </span>
                            </div>

                            {deal.lostReason && (
                              <div style={{ fontSize: '10px', color: 'var(--danger)', marginTop: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '4px' }}>
                                Reason: {deal.lostReason}
                              </div>
                            )}

                            {/* One-Click Stage Transition Action Bar */}
                            <div 
                              style={{ 
                                marginTop: '10px', 
                                paddingTop: '8px', 
                                borderTop: '1px solid #f1f5f9', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between', 
                                gap: '4px' 
                              }} 
                              onClick={(e) => e.stopPropagation()}
                            >
                              {prevStage && (
                                <button
                                  className="btn btn-secondary"
                                  title={`Move back to ${prevStage}`}
                                  style={{ padding: '3px 6px', fontSize: '10px', minHeight: 'auto', height: '24px' }}
                                  onClick={(e) => handleStageAdvance(deal.id, prevStage, e)}
                                >
                                  ← {prevStage.slice(0, 4)}
                                </button>
                              )}

                              {nextStage && (
                                <button
                                  className="btn btn-primary"
                                  title={`Advance to ${nextStage}`}
                                  style={{ padding: '3px 8px', fontSize: '10.5px', minHeight: 'auto', height: '24px', flex: 1, justifyContent: 'center' }}
                                  onClick={(e) => handleStageAdvance(deal.id, nextStage, e)}
                                >
                                  {nextStage} →
                                </button>
                              )}

                              {stage !== 'Won' && stage !== 'Lost' && (
                                <div style={{ display: 'flex', gap: '3px' }}>
                                  <button
                                    title="Mark Deal as Won"
                                    style={{
                                      background: '#ecfdf5',
                                      border: '1px solid #a7f3d0',
                                      color: '#059669',
                                      borderRadius: '4px',
                                      padding: '2px 5px',
                                      fontSize: '10px',
                                      cursor: 'pointer',
                                      fontWeight: 'bold'
                                    }}
                                    onClick={(e) => handleStageAdvance(deal.id, 'Won', e)}
                                  >
                                    Won (Closed)
                                  </button>
                                  <button
                                    title="Mark Deal as Lost"
                                    style={{
                                      background: '#fef2f2',
                                      border: '1px solid #fecaca',
                                      color: '#dc2626',
                                      borderRadius: '4px',
                                      padding: '2px 5px',
                                      fontSize: '10px',
                                      cursor: 'pointer',
                                      fontWeight: 'bold'
                                    }}
                                    onClick={(e) => handleStageAdvance(deal.id, 'Lost', e)}
                                  >
                                    Lost
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* INLINE EDIT DEAL MODAL */}
      {editingDeal && (
        <div className="modal-overlay" onClick={() => setEditingDeal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>Edit Deal Opportunity</h3>
              <button className="modal-close-btn" onClick={() => setEditingDeal(null)}>×</button>
            </div>
            <form onSubmit={saveEditModal}>
              <div className="form-group">
                <label>Deal Opportunity Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Company / Account *</label>
                <input
                  type="text"
                  required
                  value={editForm.company}
                  onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Deal Value (₹) *</label>
                  <input
                    type="number"
                    required
                    value={editForm.value}
                    onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Stage</label>
                  <select
                    value={editForm.stage}
                    onChange={(e) => setEditForm({ ...editForm, stage: e.target.value })}
                  >
                    {stages.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Probability (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editForm.probability}
                    onChange={(e) => setEditForm({ ...editForm, probability: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="form-group">
                  <label>Expected Close Date</label>
                  <input
                    type="date"
                    value={editForm.expectedClose}
                    onChange={(e) => setEditForm({ ...editForm, expectedClose: e.target.value })}
                  />
                </div>
              </div>

              {editForm.stage === 'Lost' && (
                <div className="form-group">
                  <label>Reason for Loss</label>
                  <input
                    type="text"
                    placeholder="e.g. Budget constraints, Competitor chosen"
                    value={editForm.lostReason || ''}
                    onChange={(e) => setEditForm({ ...editForm, lostReason: e.target.value })}
                  />
                </div>
              )}

              <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {onDeleteDeal && editingDeal ? (
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                    onClick={() => {
                      onDeleteDeal(editingDeal.id);
                      setEditingDeal(null);
                    }}
                  >
                    Delete Deal
                  </button>
                ) : <div />}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingDeal(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MARK DEAL AS LOST REASON MODAL */}
      {showLostModalFor && (
        <div className="modal-overlay" onClick={() => setShowLostModalFor(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3>Mark Deal as Lost</h3>
              <button className="modal-close-btn" onClick={() => setShowLostModalFor(null)}>×</button>
            </div>
            <div className="form-group" style={{ marginTop: '12px' }}>
              <label>Specify Reason for Loss:</label>
              <select
                value={lostReasonText}
                onChange={(e) => setLostReasonText(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="Budget constraints / competitor chosen">Budget constraints / competitor chosen</option>
                <option value="Project postponed / cancelled">Project postponed / cancelled</option>
                <option value="Product scope mismatch">Product scope mismatch</option>
                <option value="Pricing too high">Pricing too high</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setShowLostModalFor(null)}>Cancel</button>
              <button 
                className="btn btn-primary" 
                style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}
                onClick={() => {
                  if (onStageChange) onStageChange(showLostModalFor, 'Lost', lostReasonText);
                  setShowLostModalFor(null);
                }}
              >
                Confirm Lost
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .kanban-header-wrap {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .kanban-controls-row {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .layout-toggle-pills {
          display: flex;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 10px;
          border: 1px solid var(--border-color);
          gap: 4px;
        }

        .mobile-stage-selector-wrap {
          display: none;
          margin-bottom: 14px;
        }

        .mobile-stage-selector {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          scrollbar-width: none;
          padding-bottom: 4px;
          -webkit-overflow-scrolling: touch;
        }

        .mobile-stage-selector::-webkit-scrollbar {
          display: none;
        }

        .stage-pill-btn {
          padding: 7px 14px;
          border-radius: 20px;
          font-size: 11.5px;
          font-weight: 600;
          background: #ffffff;
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .stage-pill-btn.active {
          background: #151c2e;
          border-color: #151c2e;
          color: #f5d396;
          font-weight: 800;
        }

        .kanban-empty-col {
          padding: 24px 16px;
          text-align: center;
          border: 1px dashed var(--border-color);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.6);
          transition: background 0.15s ease;
        }

        .kanban-empty-col:hover {
          background: #f8fafc;
        }

        @media (max-width: 768px) {
          .kanban-header-wrap {
            flex-direction: column;
            align-items: stretch;
            text-align: left;
            gap: 12px;
          }

          .kanban-controls-row {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
            width: 100%;
          }

          .layout-toggle-pills {
            width: 100%;
            justify-content: center;
          }

          .layout-toggle-pills button {
            flex: 1;
            justify-content: center;
            font-size: 11px !important;
            padding: 6px 8px !important;
          }

          .mobile-stage-selector-wrap {
            display: block;
            margin-bottom: 12px;
          }

          .kanban-board {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            gap: 14px !important;
            overflow-x: visible !important;
            padding: 0 !important;
          }

          .kanban-col {
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            background: #ffffff !important;
            border: 1px solid var(--border-color) !important;
            border-radius: 14px !important;
            padding: 14px !important;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03) !important;
          }

          .kanban-cards-container {
            max-height: none !important;
            overflow-y: visible !important;
          }
        }
      `}</style>
    </div>
  );
}

"use client";

import React, { useState } from 'react';

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

interface KanbanBoardProps {
  deals: Deal[];
  filteredDeals: Deal[];
  stages: string[];
  pipelineLayoutMode: 'kanban' | 'table';
  setPipelineLayoutMode: (mode: 'kanban' | 'table') => void;
  setShowLeadModal: (show: boolean) => void;
  setSelectedDealDetail: (deal: Deal | null) => void;
  handleDragStart: (e: React.DragEvent, id: string) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, stage: string) => void;
  formatCurrency: (val: number) => string;
}

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
  formatCurrency
}: KanbanBoardProps) {
  const [selectedMobileStage, setSelectedMobileStage] = useState<string>('All');

  const visibleStages = selectedMobileStage === 'All' 
    ? stages 
    : stages.filter(s => s === selectedMobileStage);

  return (
    <div className="animate-fade">
      {/* Header Row */}
      <div className="page-header-row kanban-header-wrap">
        <div className="page-title-text">
          <h2>Pipeline Velocity</h2>
          <p>Real-time visualization of your active sales funnel across all territories.</p>
        </div>
        <div className="kanban-controls-row">
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

      {pipelineLayoutMode === 'table' ? (
        <>
          {/* Stage Volume Funnel & Projected Revenue Row */}
          <div className="funnel-analytics-grid">
            {/* Stage Lead Volume Funnel Card */}
            <div className="panel-card" style={{ padding: '18px' }}>
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
            <div className="analytics-stacked-cards">
              <div className="projected-rev-dark-card">
                <div className="lbl">PROJECTED REVENUE</div>
                <div className="val">₹2.48 Cr</div>
                <div style={{ fontSize: '11px', color: '#10b981', marginTop: '6px', fontWeight: 'bold' }}>
                  ↑ 12.5% vs last month
                </div>
              </div>

              <div className="panel-card" style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: '9.5px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>AVG. CYCLE TIME</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>14 Days</div>
                <div style={{ fontSize: '11px', color: '#d49b38', marginTop: '2px', fontWeight: 'bold' }}>
                  ⚡ -2 days improvement
                </div>
              </div>
            </div>
          </div>

          {/* Active Deals Pipeline Table */}
          <div className="panel-card" style={{ marginBottom: '24px' }}>
            <div className="panel-title">
              <h3>Active Deals Pipeline</h3>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Showing {deals.length} active deals
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
                  {deals.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        No deals in pipeline. Click "+ New Deal" to create one.
                      </td>
                    </tr>
                  ) : (
                    deals.map(deal => (
                      <tr key={deal.id} onClick={() => setSelectedDealDetail(deal)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="user-avatar" style={{ width: '28px', height: '28px', fontSize: '11px', backgroundColor: '#182238', color: '#f5d396' }}>
                              {deal.name[0]}
                            </div>
                            <div>
                              <div style={{ fontWeight: '700' }}>{deal.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{deal.company} • {deal.owner}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontWeight: '800', color: '#10b981' }}>{formatCurrency(deal.value)}</td>
                        <td>
                          <span className={`badge ${deal.stage === 'Won' ? 'badge-success' : deal.stage === 'Lost' ? 'badge-danger' : 'badge-warm'}`}>
                            {deal.stage}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px' }}>{deal.expectedClose}</td>
                        <td>
                          <div className="prob-progress-bar">
                            <div className="prob-progress-fill" style={{ width: `${deal.probability}%` }}></div>
                          </div>
                          <span style={{ fontWeight: 'bold', fontSize: '11px' }}>{deal.probability}%</span>
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
                All ({filteredDeals.length})
              </button>
              {stages.map(s => {
                const count = filteredDeals.filter(d => d.stage === s).length;
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

          {/* Drag and Drop Stage Kanban Board */}
          <div className="kanban-board">
            {visibleStages.map(stage => {
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
                  <div style={{ padding: '6px 16px 8px', fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: '700' }}>
                    {formatCurrency(stageTotal)}
                  </div>

                  <div className="kanban-cards-container">
                    {stageDeals.length === 0 ? (
                      <div className="kanban-empty-col">
                        <div style={{ fontSize: '20px', marginBottom: '4px' }}>📋</div>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
                          No deals in {stage}
                        </p>
                      </div>
                    ) : (
                      stageDeals.map(deal => (
                        <div 
                          key={deal.id} 
                          className="kanban-card"
                          draggable
                          onDragStart={(e) => handleDragStart(e, deal.id)}
                          onClick={() => setSelectedDealDetail(deal)}
                        >
                          <div className="kanban-card-title">{deal.name}</div>
                          <div style={{ fontSize: '11.5px', color: '#d49b38', fontWeight: '700', margin: '2px 0 6px 0', textTransform: 'uppercase' }}>
                            🏢 {deal.company}
                          </div>
                          <div className="kanban-card-value" style={{ fontSize: '14px', fontWeight: '800', color: '#10b981' }}>
                            {formatCurrency(deal.value)}
                          </div>
                          
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '6px 0 8px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>📅 Close:</span>
                            <strong>{deal.expectedClose}</strong>
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
                              {deal.daysInStage > 14 ? `⚠️ ${deal.daysInStage}d stuck` : `${deal.daysInStage}d active`}
                            </span>
                          </div>
                          {deal.lostReason && (
                            <div style={{ fontSize: '10px', color: 'var(--danger)', marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '4px' }}>
                              Reason: {deal.lostReason}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
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

        .funnel-analytics-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 16px;
          margin-bottom: 20px;
        }

        .analytics-stacked-cards {
          display: flex;
          flex-direction: column;
          gap: 14px;
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
          padding: 30px 16px;
          text-align: center;
          border: 1px dashed var(--border-color);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.6);
        }

        @media (max-width: 768px) {
          .kanban-header-wrap {
            flex-direction: column;
            align-items: stretch;
            text-align: center;
          }

          .kanban-controls-row {
            flex-direction: column;
            width: 100%;
          }

          .layout-toggle-pills {
            width: 100%;
            justify-content: center;
          }

          .layout-toggle-pills button {
            flex: 1;
            justify-content: center;
          }

          .funnel-analytics-grid {
            grid-template-columns: 1fr;
          }

          .mobile-stage-selector-wrap {
            display: block;
          }
        }
      `}</style>
    </div>
  );
}

import React from 'react';

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
  return (
    <div className="animate-fade">
      {/* Header Row */}
      <div className="page-header-row">
        <div className="page-title-text">
          <h2>Pipeline Velocity</h2>
          <p>Real-time visualization of your active sales funnel across all territories.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Layout Toggle Option */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0', gap: '4px' }}>
            <button 
              className={`btn ${pipelineLayoutMode === 'kanban' ? 'btn-primary' : 'btn-secondary'}`} 
              style={{ padding: '6px 12px', fontSize: '11px', height: '28px', lineHeight: '1' }}
              onClick={() => setPipelineLayoutMode('kanban')}
            >
              Kanban Board
            </button>
            <button 
              className={`btn ${pipelineLayoutMode === 'table' ? 'btn-primary' : 'btn-secondary'}`} 
              style={{ padding: '6px 12px', fontSize: '11px', height: '28px', lineHeight: '1' }}
              onClick={() => setPipelineLayoutMode('table')}
            >
              Table Funnel
            </button>
          </div>
          <button className="btn btn-secondary">≡ Filter</button>
          <button className="btn btn-secondary">📅 This Quarter</button>
          <button className="btn btn-primary" onClick={() => setShowLeadModal(true)}>+ New Deal</button>
        </div>
      </div>

      {pipelineLayoutMode === 'table' ? (
        <>
          {/* Stage Volume Funnel & Projected Revenue Row */}
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

          {/* Active Deals Pipeline Table */}
          <div className="panel-card" style={{ marginBottom: '24px' }}>
            <div className="panel-title">
              <h3>Active Deals Pipeline</h3>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Showing {deals.length} active deals • <span style={{ color: '#d49b38', fontWeight: 'bold', cursor: 'pointer' }}>View All Transactions</span>
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
                  {deals.map(deal => (
                    <tr key={deal.id} onClick={() => setSelectedDealDetail(deal)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="user-avatar" style={{ width: '28px', height: '28px', fontSize: '11px', backgroundColor: '#182238' }}>
                            {deal.name[0]}
                          </div>
                          <div>
                            <div style={{ fontWeight: '700' }}>{deal.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Assigned to: {deal.owner}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontWeight: '800' }}>{formatCurrency(deal.value)}</td>
                      <td>
                        <span className={`badge ${deal.stage === 'Won' ? 'badge-success' : deal.stage === 'Lost' ? 'badge-danger' : 'badge-warm'}`}>
                          {deal.stage}
                        </span>
                      </td>
                      <td>{deal.expectedClose}</td>
                      <td>
                        <div className="prob-progress-bar">
                          <div className="prob-progress-fill" style={{ width: `${deal.probability}%` }}></div>
                        </div>
                        <span style={{ fontWeight: 'bold', fontSize: '11px' }}>{deal.probability}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Pagination Bar */}
            <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)' }}>
              <button className="btn btn-secondary" style={{ fontSize: '11px' }}>Previous</button>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '11px', backgroundColor: '#d49b38' }}>1</button>
              </div>
              <button className="btn btn-secondary" style={{ fontSize: '11px' }}>Next</button>
            </div>
          </div>
        </>
      ) : (
        <>
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
                        <div className="kanban-card-title" style={{ fontWeight: '700', fontSize: '13px' }}>{deal.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 6px 0' }}>🏢 {deal.company}</div>
                        <div className="kanban-card-value" style={{ fontSize: '14px', fontWeight: '800', color: '#1e3a8a' }}>{formatCurrency(deal.value)}</div>
                        
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '6px 0 8px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>📅 Close:</span>
                          <strong>{deal.expectedClose}</strong>
                        </div>

                        <div className="kanban-card-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div className="user-avatar" style={{ width: '20px', height: '20px', fontSize: '9px', backgroundColor: '#3b82f6', color: '#ffffff' }}>
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
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

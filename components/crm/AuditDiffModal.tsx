import React from 'react';

interface AuditLog {
  id: string;
  user: string;
  action: string;
  entity: string;
  timestamp: string;
  beforeState: string;
  afterState: string;
}

interface AuditDiffModalProps {
  selectedAuditLogForDiff: AuditLog | null;
  setSelectedAuditLogForDiff: (log: AuditLog | null) => void;
}

export default function AuditDiffModal({
  selectedAuditLogForDiff,
  setSelectedAuditLogForDiff
}: AuditDiffModalProps) {
  if (!selectedAuditLogForDiff) return null;

  let beforeObj: Record<string, any> = {};
  let afterObj: Record<string, any> = {};
  try {
    beforeObj = JSON.parse(selectedAuditLogForDiff.beforeState);
  } catch {
    beforeObj = { value: selectedAuditLogForDiff.beforeState };
  }
  try {
    afterObj = JSON.parse(selectedAuditLogForDiff.afterState);
  } catch {
    afterObj = { value: selectedAuditLogForDiff.afterState };
  }

  const allKeys = Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]));

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div className="modal-content wide" style={{ width: '800px' }}>
        <div className="modal-header">
          <h3>Registry Log Diff Comparison</h3>
          <button className="modal-close-btn" onClick={() => setSelectedAuditLogForDiff(null)}>×</button>
        </div>
        
        <div style={{ marginBottom: '14px' }}>
          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>Action: {selectedAuditLogForDiff.action}</span>
          <span style={{ marginLeft: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>Timestamp: {selectedAuditLogForDiff.timestamp}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ borderRight: '1px solid var(--border-color)', background: '#fee2e2' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '12px', background: '#fecaca', color: '#991b1b' }}>
              Before State (Old values)
            </div>
            <pre style={{ padding: '12px', margin: 0, fontSize: '11.5px', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(beforeObj, null, 2)}
            </pre>
          </div>
          <div style={{ background: '#d1fae5' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '12px', background: '#a7f3d0', color: '#065f46' }}>
              After State (New values)
            </div>
            <pre style={{ padding: '12px', margin: 0, fontSize: '11.5px', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(afterObj, null, 2)}
            </pre>
          </div>
        </div>

        <div style={{ marginTop: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', backgroundColor: '#f8fafc' }}>
          <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Key Changes Summary
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '6px' }}>Parameter</th>
                <th style={{ padding: '6px' }}>Original</th>
                <th style={{ padding: '6px' }}>Modified</th>
              </tr>
            </thead>
            <tbody>
              {allKeys.map(k => {
                const beforeVal = beforeObj[k];
                const afterVal = afterObj[k];
                const hasChanged = JSON.stringify(beforeVal) !== JSON.stringify(afterVal);
                
                return (
                  <tr key={k} style={{ borderBottom: '1px dotted var(--border-color)', backgroundColor: hasChanged ? '#fef08a' : 'transparent' }}>
                    <td style={{ padding: '6px', fontWeight: 'bold' }}>{k}</td>
                    <td style={{ padding: '6px', color: '#991b1b' }}>{beforeVal !== undefined ? String(beforeVal) : '—'}</td>
                    <td style={{ padding: '6px', color: '#065f46', fontWeight: hasChanged ? 'bold' : 'normal' }}>{afterVal !== undefined ? String(afterVal) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="modal-actions" style={{ marginTop: '16px' }}>
          <button className="btn btn-secondary" onClick={() => setSelectedAuditLogForDiff(null)}>Close Diff Viewer</button>
        </div>
      </div>
    </div>
  );
}

import React from 'react';

interface SystemDiagnosticsProps {
  diagnosticsBenchmarkRun: boolean;
  diagnosticsBenchmarkProgress: number;
  runDiagnosticsBenchmark: () => void;
}

export default function SystemDiagnostics({
  diagnosticsBenchmarkRun,
  diagnosticsBenchmarkProgress,
  runDiagnosticsBenchmark
}: SystemDiagnosticsProps) {
  return (
    <div className="panel-card animate-fade" style={{ padding: '24px' }}>
      <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '12px' }}>📊 System Diagnostics & Health Monitor</h3>
      <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '20px' }}>
        Live performance metrics monitoring CPU load, active database connection threads, and average API latency.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>CPU Load</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b', marginTop: '6px' }}>
            {diagnosticsBenchmarkRun && diagnosticsBenchmarkProgress < 100 ? '4%' : '12%'}
          </div>
          <span style={{ fontSize: '9px', color: '#16a34a', fontWeight: 'bold' }}>● Optimal (Healthy)</span>
        </div>

        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Memory Allocated</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b', marginTop: '6px' }}>112.5 MB</div>
          <span style={{ fontSize: '9px', color: '#16a34a', fontWeight: 'bold' }}>● 14% of limit</span>
        </div>

        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>API Latency</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b', marginTop: '6px' }}>
            {diagnosticsBenchmarkRun && diagnosticsBenchmarkProgress < 100 ? '2ms' : '8.4ms'}
          </div>
          <span style={{ fontSize: '9px', color: '#16a34a', fontWeight: 'bold' }}>● HTTP SLA OK</span>
        </div>

        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>DB Active Pools</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b', marginTop: '6px' }}>3 / 16</div>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>13 idle connections</span>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', backgroundColor: '#f8fafc' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <strong style={{ fontSize: '13px' }}>Synthetic Performance Benchmarking</strong>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Executes a round-trip database transaction test suite to check execution velocity.</div>
          </div>
          <button 
            className="btn btn-primary" 
            disabled={diagnosticsBenchmarkRun && diagnosticsBenchmarkProgress < 100}
            onClick={runDiagnosticsBenchmark}
          >
            {diagnosticsBenchmarkRun && diagnosticsBenchmarkProgress < 100 ? 'Running...' : '⚡ Run Benchmark'}
          </button>
        </div>

        {diagnosticsBenchmarkRun && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
              <span>Benchmarking transaction pools...</span>
              <span>{diagnosticsBenchmarkProgress}%</span>
            </div>
            <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#10b981', width: `${diagnosticsBenchmarkProgress}%`, transition: 'width 0.1s linear' }}></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

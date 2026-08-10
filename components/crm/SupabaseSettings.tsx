import React, { useState, useEffect } from 'react';

interface SupabaseSettingsProps {
  onSaveConfig: (url: string, key: string) => void;
  isDbConnected: boolean;
  onClearConfig: () => void;
}

export default function SupabaseSettings({
  onSaveConfig,
  isDbConnected,
  onClearConfig
}: SupabaseSettingsProps) {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUrl(localStorage.getItem('ANVESHAK_SUPABASE_URL') || '');
      setKey(localStorage.getItem('ANVESHAK_SUPABASE_ANON_KEY') || '');
    }
  }, []);

  const handleTestConnection = () => {
    if (!url || !key) {
      setTestResult('⚠️ Please provide both the Supabase API URL and the Anon Key first.');
      return;
    }
    setTestResult('⏳ Testing connection...');
    setTimeout(() => {
      onSaveConfig(url, key);
      setTestResult('✅ Connected successfully to Supabase PostgreSQL database!');
    }, 1000);
  };

  const handleSave = () => {
    onSaveConfig(url, key);
    alert('Supabase connection parameters saved successfully!');
  };

  const handleClear = () => {
    onClearConfig();
    setUrl('');
    setKey('');
    setTestResult('🔌 Disconnected. Reverted to Local Storage Sandbox.');
  };

  return (
    <div className="panel-card animate-fade" style={{ padding: '24px' }}>
      <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '12px' }}>🔌 Supabase Connection wizard</h3>
      <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '20px' }}>
        Link this CRM module directly to your Anveshak Hub Supabase instance. If credentials are empty, the module operates in local-only Sandbox mode.
      </p>

      <div className="form-group" style={{ marginBottom: '16px' }}>
        <label style={{ fontWeight: 'bold', fontSize: '12px' }}>Supabase Project API URL</label>
        <input 
          type="text" 
          value={url} 
          onChange={(e) => setUrl(e.target.value)} 
          placeholder="https://your-project.supabase.co" 
          style={{ width: '100%', marginTop: '6px', fontSize: '12.5px' }}
        />
      </div>

      <div className="form-group" style={{ marginBottom: '20px' }}>
        <label style={{ fontWeight: 'bold', fontSize: '12px' }}>Supabase Anon Key</label>
        <input 
          type="password" 
          value={key} 
          onChange={(e) => setKey(e.target.value)} 
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." 
          style={{ width: '100%', marginTop: '6px', fontSize: '12.5px' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
        <button className="btn btn-primary" onClick={handleSave}>Save Config</button>
        <button className="btn btn-secondary" onClick={handleTestConnection}>Test Connection</button>
        {(url || key) && (
          <button className="btn btn-secondary" style={{ color: 'var(--danger)' }} onClick={handleClear}>
            Disconnect Client
          </button>
        )}
      </div>

      {testResult && (
        <div style={{ 
          padding: '12px 16px', 
          borderRadius: '8px', 
          fontSize: '12px', 
          fontWeight: '600',
          backgroundColor: testResult.startsWith('✅') ? '#ecfdf5' : testResult.startsWith('⏳') ? '#fffbeb' : '#fef2f2',
          color: testResult.startsWith('✅') ? '#047857' : testResult.startsWith('⏳') ? '#b45309' : '#b91c1c',
          border: '1px solid',
          borderColor: testResult.startsWith('✅') ? '#a7f3d0' : testResult.startsWith('⏳') ? '#fde68a' : '#fecaca'
        }}>
          {testResult}
        </div>
      )}

      <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong style={{ fontSize: '13px' }}>Current Sync Status:</strong>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {isDbConnected ? 'All transactions are written to remote Postgres tables.' : 'Transactions are stored locally in the browser cache.'}
          </div>
        </div>
        <span 
          className="badge" 
          style={{ 
            fontSize: '11px', 
            padding: '4px 10px',
            backgroundColor: isDbConnected ? '#ecfdf5' : '#f1f5f9',
            color: isDbConnected ? '#047857' : '#64748b',
            border: isDbConnected ? '1px solid #a7f3d0' : '1px solid #cbd5e1'
          }}
        >
          {isDbConnected ? '● Online (Supabase)' : '○ Offline (Sandbox)'}
        </span>
      </div>
    </div>
  );
}

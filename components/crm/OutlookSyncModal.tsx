'use client';

import React, { useState } from 'react';
import { 
  getOutlookWebComposeUrl, 
  getOffice365ComposeUrl, 
  downloadIcsFile, 
  CalendarEventParams 
} from '@/lib/outlookCalendar';

interface OutlookSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: any[];
  deals: any[];
  currentUser?: any;
  triggerToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function OutlookSyncModal({
  isOpen,
  onClose,
  tasks,
  deals,
  currentUser,
  triggerToast
}: OutlookSyncModalProps) {
  const [activeTab, setActiveTab] = useState<'link' | 'subscribe' | 'export' | 'instant'>('link');
  const [copied, setCopied] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const userParam = currentUser?.email ? `?user=${encodeURIComponent(currentUser.email)}` : '';
  const feedUrl = `${origin}/api/calendar/feed${userParam}`;
  const webcalUrl = feedUrl.replace(/^http/, 'webcal');
  const connectUrl = `/api/auth/microsoft/connect?user=${encodeURIComponent(currentUser?.email || '')}`;

  // Convert tasks & deals to CalendarEventParams
  const allEvents: CalendarEventParams[] = [
    ...tasks.filter(t => t.dueDate).map(t => ({
      title: `[Task] ${t.title}`,
      description: `Priority: ${t.priority || 'Medium'}\nStatus: ${t.status || 'Open'}\nLinked: ${t.linkedTo || 'None'}\n\n${t.description || ''}`,
      startDate: t.dueDate,
      startTime: t.dueTime || '09:00',
      durationMinutes: 45,
      location: t.linkedTo || 'Anveshak CRM'
    })),
    ...deals.filter(d => d.expectedClose).map(d => ({
      title: `[Deal Close] ${d.name} (${d.company})`,
      description: `Company: ${d.company}\nStage: ${d.stage}\nValue: ₹${(d.value || 0).toLocaleString('en-IN')}\nOwner: ${d.owner || 'Unassigned'}`,
      startDate: d.expectedClose,
      startTime: '10:00',
      durationMinutes: 60,
      location: d.company || 'Anveshak CRM'
    }))
  ];

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    triggerToast('Outlook calendar feed URL copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExportAllIcs = () => {
    if (allEvents.length === 0) {
      triggerToast('No scheduled calendar events to export.', 'warning');
      return;
    }
    downloadIcsFile(allEvents, `Anveshak_CRM_Calendar_${new Date().toISOString().slice(0, 10)}.ics`);
    triggerToast(`Exported ${allEvents.length} events to Outlook .ics file!`, 'success');
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)' }}>
      <div 
        className="modal-content animate-fade" 
        style={{ 
          maxWidth: '680px', 
          width: '94%', 
          borderRadius: '16px', 
          background: '#ffffff', 
          padding: '24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e2e8f0'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#0078d4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>
              📅
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                Microsoft Outlook Calendar Sync
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                Link your registered account to auto-sync CRM events with Outlook
              </p>
            </div>
          </div>
          <button 
            className="modal-close-btn" 
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
          >
            ×
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('link')}
            style={{
              padding: '8px 14px',
              fontSize: '12.5px',
              fontWeight: '700',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'link' ? '#0078d4' : '#f1f5f9',
              color: activeTab === 'link' ? '#ffffff' : '#475569',
              transition: 'all 0.15s ease'
            }}
          >
            🔗 Link Registered Account (Auto-Sync)
          </button>
          <button
            onClick={() => setActiveTab('subscribe')}
            style={{
              padding: '8px 14px',
              fontSize: '12.5px',
              fontWeight: '600',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'subscribe' ? '#0078d4' : '#f1f5f9',
              color: activeTab === 'subscribe' ? '#ffffff' : '#475569',
              transition: 'all 0.15s ease'
            }}
          >
            ⚡ 1-Click Feed Sync
          </button>
          <button
            onClick={() => setActiveTab('export')}
            style={{
              padding: '8px 14px',
              fontSize: '12.5px',
              fontWeight: '600',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'export' ? '#0078d4' : '#f1f5f9',
              color: activeTab === 'export' ? '#ffffff' : '#475569',
              transition: 'all 0.15s ease'
            }}
          >
            📥 Export .ICS File
          </button>
          <button
            onClick={() => setActiveTab('instant')}
            style={{
              padding: '8px 14px',
              fontSize: '12.5px',
              fontWeight: '600',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'instant' ? '#0078d4' : '#f1f5f9',
              color: activeTab === 'instant' ? '#ffffff' : '#475569',
              transition: 'all 0.15s ease'
            }}
          >
            🔗 1-Click Compose
          </button>
        </div>

        {/* Tab 0: Link Registered Account (Option 2) */}
        {activeTab === 'link' && (
          <div className="animate-fade">
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '16px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '18px' }}>👤</span>
                <span style={{ fontWeight: '800', fontSize: '13.5px', color: '#1e40af' }}>
                  Registered CRM Account: {currentUser?.email || 'Logged In User'}
                </span>
              </div>
              <p style={{ margin: '0 0 12px 0', fontSize: '12.5px', color: '#3b82f6', lineHeight: '1.5' }}>
                Link your registered CRM account once to enable <strong>100% automatic background synchronization</strong>. Any task, meeting, or deal deadline you add will be pushed directly to your Microsoft Outlook Calendar.
              </p>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <a
                  href={connectUrl}
                  className="btn btn-primary"
                  style={{
                    backgroundColor: '#0078d4',
                    borderColor: '#0078d4',
                    padding: '10px 18px',
                    fontSize: '13px',
                    fontWeight: '700',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 10px rgba(0, 120, 212, 0.25)'
                  }}
                  onClick={() => setIsLinking(true)}
                >
                  {isLinking ? 'Redirecting to Microsoft...' : '🔗 Authorize & Link Outlook Account'}
                </a>
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>
                How this works:
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#64748b', lineHeight: '1.6' }}>
                <li>Authorizes Anveshak CRM with your Microsoft account.</li>
                <li>Saves your secure token against your registered email (<code>{currentUser?.email}</code>).</li>
                <li>Whenever you create a new Task or Deal milestone, it pushes to your Outlook Calendar in real-time.</li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab 1: Live Subscribe */}
        {activeTab === 'subscribe' && (
          <div className="animate-fade">
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px' }}>
              <div style={{ fontWeight: '700', fontSize: '13px', color: '#166534', marginBottom: '4px' }}>
                ✓ Instant Automatic Sync (No Azure / Complex Setup Needed)
              </div>
              <div style={{ fontSize: '12px', color: '#15803d', lineHeight: '1.4' }}>
                Click either button below to connect your Outlook Calendar with 1 click. Any task, meeting, or deal deadline you add in Anveshak CRM will automatically reflect in Outlook in real time.
              </div>
            </div>

            {/* Direct 1-Click Action Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
              <a
                href={webcalUrl}
                className="btn btn-primary"
                style={{
                  backgroundColor: '#0078d4',
                  borderColor: '#0078d4',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 4px 10px rgba(0, 120, 212, 0.2)'
                }}
                onClick={() => triggerToast('Connecting to Outlook Calendar app...', 'info')}
              >
                <span style={{ fontSize: '13.5px', fontWeight: '800' }}>⚡ 1-Click Outlook App</span>
                <span style={{ fontSize: '11px', opacity: 0.9, fontWeight: 'normal' }}>Launches Windows / Mac Outlook</span>
              </a>

              <a
                href={`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feedUrl)}&name=Anveshak+CRM`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  borderColor: '#0078d4',
                  color: '#0078d4',
                  background: '#eff6ff'
                }}
                onClick={() => triggerToast('Opening Outlook Web subscription dialog...', 'info')}
              >
                <span style={{ fontSize: '13.5px', fontWeight: '800' }}>🌐 1-Click Outlook Web</span>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>Opens Outlook.com / Office 365</span>
              </a>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
                Or manually copy your Calendar Feed URL:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  value={feedUrl}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: '#0f172a'
                  }}
                />
                <button
                  onClick={handleCopyUrl}
                  className="btn btn-secondary"
                  style={{
                    padding: '0 14px',
                    fontSize: '12px',
                    fontWeight: '600',
                    borderRadius: '8px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {copied ? '✓ Copied' : '📋 Copy URL'}
                </button>
              </div>
            </div>

            {/* Step-by-step instructions */}
            <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px 16px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>
                How to add to Microsoft Outlook:
              </div>
              <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#475569', lineHeight: '1.6' }}>
                <li>Click either the <strong>⚡ 1-Click Outlook App</strong> or <strong>🌐 1-Click Outlook Web</strong> button above.</li>
                <li>In Outlook, click <strong>"Import"</strong> / <strong>"Yes"</strong> to confirm the subscription.</li>
                <li>Done! Any event added to Anveshak CRM will automatically reflect in Outlook.</li>
              </ol>
            </div>
          </div>
        )}

        {/* Tab 2: Export .ICS */}
        {activeTab === 'export' && (
          <div className="animate-fade">
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5', marginBottom: '16px' }}>
              Download a standard <strong>.ics (iCalendar)</strong> file containing all your currently scheduled tasks and deals ({allEvents.length} events total). Double-clicking this file will immediately import them into Microsoft Outlook Desktop, Apple Calendar, or Google Calendar.
            </p>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <button
                onClick={handleExportAllIcs}
                className="btn btn-primary"
                style={{
                  backgroundColor: '#0078d4',
                  borderColor: '#0078d4',
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: '700',
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                📥 Download Calendar (.ICS) File
              </button>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '12px 16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                Summary of Events Included in Export:
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#64748b' }}>
                <li><strong>{tasks.filter(t => t.dueDate).length} Tasks</strong> with scheduled due dates and priority tags</li>
                <li><strong>{deals.filter(d => d.expectedClose).length} Deal Milestones</strong> with expected closing dates and amounts</li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab 3: 1-Click Compose */}
        {activeTab === 'instant' && (
          <div className="animate-fade">
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5', marginBottom: '14px' }}>
              Select any of your pending CRM tasks or deals below to immediately open and save it directly in Microsoft Outlook Web:
            </p>

            <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {allEvents.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  No scheduled events found. Add tasks with due dates to see them here.
                </div>
              ) : (
                allEvents.map((evt, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0f172a' }}>{evt.title}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>📅 Date: {evt.startDate} at {evt.startTime}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <a
                        href={getOutlookWebComposeUrl(evt)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '11px', color: '#0078d4', borderColor: '#bfdbfe', background: '#eff6ff' }}
                      >
                        Outlook Web ↗
                      </a>
                      <a
                        href={getOffice365ComposeUrl(evt)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '11px', color: '#0078d4', borderColor: '#bfdbfe', background: '#eff6ff' }}
                      >
                        Microsoft 365 ↗
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '14px', marginTop: '16px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '8px 18px', fontSize: '12.5px', borderRadius: '8px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

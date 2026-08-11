"use client";

import React, { useState, useEffect } from 'react';

interface OwnerFeedbackWidgetProps {
  activeTab: string;
  currentUser?: { fullName?: string; email?: string } | null;
}

interface FeedbackItem {
  id: string;
  pageTab: string;
  category: 'Requirement' | 'Suggestion' | 'Bug' | 'Design';
  noteText: string;
  authorName: string;
  status: 'New' | 'In Progress' | 'Resolved';
  createdAt: string;
}

// Clean SVG Vector Icons (No Emojis)
const MessageSquareIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
);

const RequirementIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
);

const SuggestionIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
);

const BugIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
);

const DesignIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/></svg>
);

const CloseIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
);

export default function OwnerFeedbackWidget({ activeTab, currentUser }: OwnerFeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'submit' | 'list'>('submit');
  const [category, setCategory] = useState<'Requirement' | 'Suggestion' | 'Bug' | 'Design'>('Requirement');
  const [noteText, setNoteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadFeedbackFromDb = async () => {
    try {
      const { getOwnerFeedbackListAction } = await import('@/app/actions/crm');
      const res = await getOwnerFeedbackListAction();
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        setFeedbackList(res.data as any);
        localStorage.setItem('ANVESHAK_OWNER_FEEDBACK_LIST', JSON.stringify(res.data));
      } else {
        const saved = localStorage.getItem('ANVESHAK_OWNER_FEEDBACK_LIST');
        if (saved) {
          setFeedbackList(JSON.parse(saved));
        }
      }
    } catch (err) {
      const saved = localStorage.getItem('ANVESHAK_OWNER_FEEDBACK_LIST');
      if (saved) {
        try {
          setFeedbackList(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  // Load stored feedback notes from Supabase & poll every 10 seconds for multi-device sync
  useEffect(() => {
    loadFeedbackFromDb();
    const interval = setInterval(loadFeedbackFromDb, 10000);
    return () => clearInterval(interval);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    setIsSubmitting(true);
    const newNote: FeedbackItem = {
      id: `FB-${Date.now().toString().slice(-5)}`,
      pageTab: activeTab,
      category,
      noteText: noteText.trim(),
      authorName: currentUser?.fullName || 'CRM Owner',
      status: 'New',
      createdAt: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
    };

    // Save to Supabase DB via Server Action
    try {
      const { saveOwnerFeedbackAction } = await import('@/app/actions/crm');
      const res = await saveOwnerFeedbackAction({
        pageTab: activeTab,
        category,
        noteText: noteText.trim(),
        authorName: currentUser?.fullName || 'CRM Owner'
      });
      if (res && res.success) {
        triggerToast('Feedback saved to Supabase DB!');
        await loadFeedbackFromDb();
        setNoteText('');
        setIsSubmitting(false);
        setActiveSubTab('list');
        return;
      }
    } catch (err) {
      console.warn('Supabase DB save fallback to local storage:', err);
    }

    const updatedList = [newNote, ...feedbackList];
    setFeedbackList(updatedList);
    localStorage.setItem('ANVESHAK_OWNER_FEEDBACK_LIST', JSON.stringify(updatedList));

    setNoteText('');
    setIsSubmitting(false);
    triggerToast('Feedback note saved locally');
    setActiveSubTab('list');
  };

  const toggleStatus = async (id: string) => {
    const updated = feedbackList.map(item => {
      if (item.id === id) {
        const nextStatus: 'New' | 'In Progress' | 'Resolved' = item.status === 'Resolved' ? 'New' : 'Resolved';
        return { ...item, status: nextStatus };
      }
      return item;
    });
    setFeedbackList(updated);
    localStorage.setItem('ANVESHAK_OWNER_FEEDBACK_LIST', JSON.stringify(updated));

    try {
      const { updateOwnerFeedbackStatusAction } = await import('@/app/actions/crm');
      const targetItem = updated.find(i => i.id === id);
      if (targetItem) {
        await updateOwnerFeedbackStatusAction(id, targetItem.status);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const pendingCount = feedbackList.filter(f => f.status !== 'Resolved').length;

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <div className="owner-feedback-fab-container">
        <button
          className={`owner-feedback-fab ${isOpen ? 'active' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          title="Owner Feedback & Requirements"
        >
          <span className="fab-icon-box">
            {isOpen ? <CloseIcon /> : <MessageSquareIcon />}
          </span>
          <span className="fab-label">Owner Feedback</span>
          {pendingCount > 0 && (
            <span className="fab-badge">{pendingCount}</span>
          )}
        </button>
      </div>

      {/* Floating Feedback Panel */}
      {isOpen && (
        <div className="owner-feedback-panel animate-fade">
          {/* Header */}
          <div className="feedback-panel-header">
            <div className="feedback-header-title">
              <div className="header-icon-box">
                <MessageSquareIcon />
              </div>
              <div>
                <h4>Owner Feedback & Requirements</h4>
                <p>Internal Notes & Requirement Collector</p>
              </div>
            </div>
            <button className="feedback-close-btn" onClick={() => setIsOpen(false)}>
              <CloseIcon />
            </button>
          </div>

          {/* Context Tag Banner */}
          <div className="feedback-context-banner">
            <span className="context-dot"></span>
            <span>Active Section:</span>
            <strong>{activeTab.toUpperCase()}</strong>
          </div>

          {/* Sub-tab Switcher */}
          <div className="feedback-subtabs">
            <button
              className={activeSubTab === 'submit' ? 'active' : ''}
              onClick={() => setActiveSubTab('submit')}
            >
              + Submit Note
            </button>
            <button
              className={activeSubTab === 'list' ? 'active' : ''}
              onClick={() => setActiveSubTab('list')}
            >
              Inbox ({feedbackList.length})
            </button>
          </div>

          {/* Tab 1: Submit Form */}
          {activeSubTab === 'submit' && (
            <form onSubmit={handleSubmit} className="feedback-form">
              <div className="feedback-form-group">
                <label>Category</label>
                <div className="category-pills">
                  {(['Requirement', 'Suggestion', 'Bug', 'Design'] as const).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      className={`cat-pill ${category === cat ? 'active' : ''}`}
                      onClick={() => setCategory(cat)}
                    >
                      {cat === 'Requirement' && <RequirementIcon />}
                      {cat === 'Suggestion' && <SuggestionIcon />}
                      {cat === 'Bug' && <BugIcon />}
                      {cat === 'Design' && <DesignIcon />}
                      <span>{cat}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="feedback-form-group">
                <label>Requirement / Note Details *</label>
                <textarea
                  rows={4}
                  required
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={`Enter your note or requirement for ${activeTab}...`}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span style={{ fontSize: '11px', color: '#8c9ba5' }}>
                  Auto-tagged to <strong>{activeTab}</strong>
                </span>
                <button
                  type="submit"
                  disabled={isSubmitting || !noteText.trim()}
                  className="btn-submit-feedback"
                >
                  {isSubmitting ? 'Saving...' : 'Submit Note →'}
                </button>
              </div>
            </form>
          )}

          {/* Tab 2: Feedback Inbox List */}
          {activeSubTab === 'list' && (
            <div className="feedback-list-container">
              {feedbackList.length === 0 ? (
                <div className="empty-feedback">
                  <p>No feedback notes recorded yet.</p>
                  <span style={{ fontSize: '11px', color: '#8c9ba5' }}>Use "+ Submit Note" to log feedback for this section.</span>
                </div>
              ) : (
                feedbackList.map(item => (
                  <div key={item.id} className={`feedback-item-card ${item.status === 'Resolved' ? 'resolved' : ''}`}>
                    <div className="feedback-card-top">
                      <span className={`cat-tag ${item.category.toLowerCase()}`}>
                        {item.category === 'Requirement' && <RequirementIcon />}
                        {item.category === 'Suggestion' && <SuggestionIcon />}
                        {item.category === 'Bug' && <BugIcon />}
                        {item.category === 'Design' && <DesignIcon />}
                        <span>{item.category}</span>
                      </span>
                      <span className="page-tag">{item.pageTab}</span>
                      <button
                        className={`status-toggle-btn ${item.status === 'Resolved' ? 'done' : ''}`}
                        onClick={() => toggleStatus(item.id)}
                        title="Toggle Resolution Status"
                      >
                        {item.status === 'Resolved' ? (
                          <>
                            <CheckIcon />
                            <span>Resolved</span>
                          </>
                        ) : (
                          <span>Mark Resolved</span>
                        )}
                      </button>
                    </div>
                    <p className="feedback-text">{item.noteText}</p>
                    <div className="feedback-card-meta">
                      <span>By: {item.authorName}</span>
                      <span>{item.createdAt}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {toastMessage && (
            <div className="feedback-toast">
              <CheckIcon /> {toastMessage}
            </div>
          )}
        </div>
      )}

      {/* Embedded Modern Professional Styles */}
      <style jsx global>{`
        /* Floating Action Button Container */
        .owner-feedback-fab-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 1000;
        }

        .owner-feedback-fab {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #151c2e;
          border: 1px solid rgba(212, 155, 56, 0.5);
          color: #ffffff;
          padding: 10px 18px;
          border-radius: 30px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
          transition: all 0.2s ease;
        }

        .owner-feedback-fab:hover {
          transform: translateY(-2px);
          border-color: #d49b38;
          box-shadow: 0 12px 28px rgba(212, 155, 56, 0.3);
          background: #1e293b;
        }

        .owner-feedback-fab.active {
          background: #1e293b;
          border-color: #ef4444;
        }

        .fab-icon-box {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #f5d396;
        }

        .fab-badge {
          background: #d49b38;
          color: #151c2e;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 7px;
          border-radius: 10px;
        }

        /* Feedback Pop-up Drawer */
        .owner-feedback-panel {
          position: fixed;
          bottom: 80px;
          right: 24px;
          width: 380px;
          max-width: 92vw;
          max-height: 520px;
          background: #151c2e;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 14px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
          z-index: 1050;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          color: #ffffff;
        }

        .feedback-panel-header {
          padding: 14px 16px;
          background: #182238;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .feedback-header-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .header-icon-box {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(212, 155, 56, 0.15);
          color: #f5d396;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .feedback-header-title h4 {
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
        }

        .feedback-header-title p {
          font-size: 10px;
          color: #8c9ba5;
          margin: 0;
        }

        .feedback-close-btn {
          background: transparent;
          border: none;
          color: #8c9ba5;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        .feedback-close-btn:hover {
          color: #ffffff;
        }

        .feedback-context-banner {
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          padding: 7px 16px;
          font-size: 11px;
          color: #8c9ba5;
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .context-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #d49b38;
        }

        .feedback-subtabs {
          display: flex;
          background: #111827;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .feedback-subtabs button {
          flex: 1;
          padding: 10px;
          background: transparent;
          border: none;
          color: #8c9ba5;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .feedback-subtabs button.active {
          color: #ffffff;
          border-bottom: 2px solid #d49b38;
          background: rgba(255, 255, 255, 0.04);
        }

        /* Form */
        .feedback-form {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow-y: auto;
        }

        .feedback-form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .feedback-form-group label {
          font-size: 11px;
          font-weight: 700;
          color: #cbd5e1;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .category-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .cat-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 10px;
          background: #182238;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #8c9ba5;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }

        .cat-pill.active {
          background: #d49b38;
          color: #151c2e;
          border-color: #d49b38;
          font-weight: 700;
        }

        .feedback-form textarea {
          width: 100%;
          background: #182238;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          color: #ffffff;
          padding: 10px 12px;
          font-size: 12.5px;
          outline: none;
          box-sizing: border-box;
          resize: vertical;
        }

        .feedback-form textarea:focus {
          border-color: #d49b38;
        }

        .btn-submit-feedback {
          padding: 8px 16px;
          background: linear-gradient(135deg, #d49b38 0%, #b8822b 100%);
          color: #ffffff;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(212, 155, 56, 0.2);
        }

        /* List */
        .feedback-list-container {
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          overflow-y: auto;
          max-height: 360px;
        }

        .empty-feedback {
          text-align: center;
          padding: 40px 20px;
          color: #64748b;
        }

        .feedback-item-card {
          background: #182238;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          transition: all 0.2s;
        }

        .feedback-item-card.resolved {
          opacity: 0.6;
          background: rgba(15, 23, 42, 0.6);
        }

        .feedback-card-top {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .cat-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 9.5px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 4px;
          text-transform: uppercase;
          background: #334155;
          color: #f1f5f9;
        }

        .cat-tag.requirement { background: #0284c7; color: #fff; }
        .cat-tag.suggestion { background: #d49b38; color: #fff; }
        .cat-tag.bug { background: #ef4444; color: #fff; }
        .cat-tag.design { background: #8b5cf6; color: #fff; }

        .page-tag {
          font-size: 9px;
          background: rgba(255, 255, 255, 0.08);
          padding: 2px 6px;
          border-radius: 4px;
          color: #8c9ba5;
          text-transform: uppercase;
        }

        .status-toggle-btn {
          margin-left: auto;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          border: 1px solid rgba(255, 255, 255, 0.15);
          cursor: pointer;
        }

        .status-toggle-btn.done {
          background: #10b981;
          color: #ffffff;
          border-color: #10b981;
        }

        .feedback-text {
          font-size: 12px;
          line-height: 1.4;
          color: #f8fafc;
          margin: 0;
          white-space: pre-wrap;
        }

        .feedback-card-meta {
          display: flex;
          justify-content: space-between;
          font-size: 9.5px;
          color: #64748b;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 6px;
        }

        .feedback-toast {
          position: absolute;
          bottom: 12px;
          left: 50%;
          transform: translateX(-50%);
          background: #10b981;
          color: #ffffff;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        /* Mobile Screen Adjustments */
        @media (max-width: 768px) {
          .owner-feedback-fab-container {
            bottom: 74px !important;
            right: 14px !important;
          }
          .owner-feedback-panel {
            bottom: 130px !important;
            right: 14px !important;
            left: 14px !important;
            width: auto !important;
          }
        }
      `}</style>
    </>
  );
}

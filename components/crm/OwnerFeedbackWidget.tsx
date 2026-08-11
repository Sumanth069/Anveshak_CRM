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

export default function OwnerFeedbackWidget({ activeTab, currentUser }: OwnerFeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'submit' | 'list'>('submit');
  const [category, setCategory] = useState<'Requirement' | 'Suggestion' | 'Bug' | 'Design'>('Requirement');
  const [noteText, setNoteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load stored feedback notes from localStorage & Supabase
  useEffect(() => {
    const saved = localStorage.getItem('ANVESHAK_OWNER_FEEDBACK_LIST');
    if (saved) {
      try {
        setFeedbackList(JSON.parse(saved));
      } catch (err) {
        console.error(err);
      }
    }
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

    // Try Supabase Server Action
    try {
      const { saveOwnerFeedbackAction } = await import('@/app/actions/crm');
      const res = await saveOwnerFeedbackAction({
        pageTab: activeTab,
        category,
        noteText: noteText.trim(),
        authorName: currentUser?.fullName || 'CRM Owner'
      });
      if (res && res.success && res.data) {
        newNote.id = res.data.id || newNote.id;
      }
    } catch (err) {
      console.warn('Supabase DB save fallback to local storage:', err);
    }

    const updatedList = [newNote, ...feedbackList];
    setFeedbackList(updatedList);
    localStorage.setItem('ANVESHAK_OWNER_FEEDBACK_LIST', JSON.stringify(updatedList));

    setNoteText('');
    setIsSubmitting(false);
    triggerToast('✓ Feedback note saved!');
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

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <div className="owner-feedback-fab-container">
        <button
          className={`owner-feedback-fab ${isOpen ? 'active' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          title="Owner Suggestions & Page Requirements"
        >
          <span className="fab-icon">{isOpen ? '✕' : '💬'}</span>
          <span className="fab-label">Owner Feedback</span>
          {feedbackList.filter(f => f.status !== 'Resolved').length > 0 && (
            <span className="fab-badge">{feedbackList.filter(f => f.status !== 'Resolved').length}</span>
          )}
        </button>
      </div>

      {/* Floating Chat / Feedback Pop-up Drawer */}
      {isOpen && (
        <div className="owner-feedback-panel animate-fade">
          {/* Header */}
          <div className="feedback-panel-header">
            <div className="feedback-header-title">
              <span style={{ fontSize: '16px' }}>⚡</span>
              <div>
                <h4>Owner Feedback & Requirements</h4>
                <p>Live Note Collector for Vercel CRM</p>
              </div>
            </div>
            <button className="feedback-close-btn" onClick={() => setIsOpen(false)}>✕</button>
          </div>

          {/* Context Tag Banner */}
          <div className="feedback-context-banner">
            <span>📍 Active Page:</span>
            <strong>{activeTab.toUpperCase()}</strong>
          </div>

          {/* Sub-tab Switcher */}
          <div className="feedback-subtabs">
            <button
              className={activeSubTab === 'submit' ? 'active' : ''}
              onClick={() => setActiveSubTab('submit')}
            >
              + Add Note / Requirement
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
                <label>Feedback Category</label>
                <div className="category-pills">
                  {(['Requirement', 'Suggestion', 'Bug', 'Design'] as const).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      className={`cat-pill ${category === cat ? 'active' : ''}`}
                      onClick={() => setCategory(cat)}
                    >
                      {cat === 'Requirement' && '📝 Requirement'}
                      {cat === 'Suggestion' && '💡 Suggestion'}
                      {cat === 'Bug' && '🐛 Bug Report'}
                      {cat === 'Design' && '🎨 Layout/UI'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="feedback-form-group">
                <label>Suggestion / Requirement Note *</label>
                <textarea
                  rows={4}
                  required
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={`Describe your tweak, bug, or requirement for page [${activeTab}]...`}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Auto-tagged to <strong>{activeTab}</strong>
                </span>
                <button
                  type="submit"
                  disabled={isSubmitting || !noteText.trim()}
                  className="btn-submit-feedback"
                >
                  {isSubmitting ? 'Saving...' : 'Send Suggestion →'}
                </button>
              </div>
            </form>
          )}

          {/* Tab 2: Feedback Inbox List */}
          {activeSubTab === 'list' && (
            <div className="feedback-list-container">
              {feedbackList.length === 0 ? (
                <div className="empty-feedback">
                  <p>No feedback notes submitted yet.</p>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Switch to "+ Add Note" to submit suggestions for this page.</span>
                </div>
              ) : (
                feedbackList.map(item => (
                  <div key={item.id} className={`feedback-item-card ${item.status === 'Resolved' ? 'resolved' : ''}`}>
                    <div className="feedback-card-top">
                      <span className={`cat-tag ${item.category.toLowerCase()}`}>{item.category}</span>
                      <span className="page-tag">{item.pageTab}</span>
                      <button
                        className={`status-toggle-btn ${item.status === 'Resolved' ? 'done' : ''}`}
                        onClick={() => toggleStatus(item.id)}
                        title="Toggle Resolution Status"
                      >
                        {item.status === 'Resolved' ? '✓ Resolved' : '○ Mark Fixed'}
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
              {toastMessage}
            </div>
          )}
        </div>
      )}

      {/* Embedded CSS for Floating Feedback Widget */}
      <style jsx global>{`
        /* Floating Action Button */
        .owner-feedback-fab-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 1000;
        }

        .owner-feedback-fab {
          display: flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #151c2e 0%, #1e293b 100%);
          border: 1px solid #d49b38;
          color: #ffffff;
          padding: 10px 18px;
          border-radius: 30px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
          transition: all 0.25s ease;
        }

        .owner-feedback-fab:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(212, 155, 56, 0.35);
          background: #1e2b48;
        }

        .owner-feedback-fab.active {
          background: #ef4444;
          border-color: #ef4444;
        }

        .fab-icon {
          font-size: 16px;
        }

        .fab-badge {
          background-color: #d49b38;
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
          border: 1px solid rgba(212, 155, 56, 0.4);
          border-radius: 16px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
          z-index: 1050;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          color: #ffffff;
        }

        .feedback-panel-header {
          padding: 14px 16px;
          background: #1e293b;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .feedback-header-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .feedback-header-title h4 {
          font-size: 13.5px;
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
          font-size: 14px;
          cursor: pointer;
          padding: 4px;
        }

        .feedback-close-btn:hover {
          color: #ffffff;
        }

        .feedback-context-banner {
          background: rgba(212, 155, 56, 0.12);
          border-bottom: 1px solid rgba(212, 155, 56, 0.2);
          padding: 6px 16px;
          font-size: 11px;
          color: #f5d396;
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .feedback-subtabs {
          display: flex;
          background: #0f172a;
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
          padding: 6px 10px;
          background: #1e293b;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #94a3b8;
          border-radius: 6px;
          font-size: 10.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }

        .cat-pill.active {
          background: #d49b38;
          color: #151c2e;
          border-color: #d49b38;
          font-weight: 800;
        }

        .feedback-form textarea {
          width: 100%;
          background: #0f172a;
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
          background: #1e293b;
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
          font-size: 9px;
          font-weight: 800;
          padding: 2px 6px;
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
          color: #94a3b8;
          text-transform: uppercase;
        }

        .status-toggle-btn {
          margin-left: auto;
          font-size: 10px;
          font-weight: 700;
          padding: 3px 8px;
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
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        /* Mobile Screen Adjustments */
        @media (max-width: 768px) {
          .owner-feedback-fab-container {
            bottom: 74px !important; /* Positions fab cleanly above fixed mobile bottom nav bar */
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

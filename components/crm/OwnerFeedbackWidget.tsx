"use client";

import React, { useState, useEffect, useRef } from 'react';

interface OwnerFeedbackWidgetProps {
  activeTab: string;
  currentUser?: { fullName?: string; email?: string; role?: string; title?: string } | null;
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

// Clean SVG Vector Icons
const UserIcon = () => (
  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
);
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

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [editCategory, setEditCategory] = useState<'Requirement' | 'Suggestion' | 'Bug' | 'Design'>('Requirement');

  const [fabPosition, setFabPosition] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number }>({ x: 0, y: 0, posX: 0, posY: 0 });
  const hasMovedRef = useRef(false);
  const fabRef = useRef<HTMLDivElement>(null);

  const broadcastSync = () => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('anveshak_feedback_sync');
        channel.postMessage({ type: 'REFRESH_FEEDBACK' });
        channel.close();
      } catch (e) {}
    }
  };

  const loadFeedbackFromDb = async () => {
    let localItems: FeedbackItem[] = [];
    try {
      const saved = localStorage.getItem('ANVESHAK_OWNER_FEEDBACK_LIST');
      if (saved) localItems = JSON.parse(saved);
    } catch (e) {}

    try {
      const { getOwnerFeedbackListAction } = await import('@/app/actions/crm');
      const res = await getOwnerFeedbackListAction();
      if (res && res.success && Array.isArray(res.data)) {
        const dbItems: FeedbackItem[] = res.data as any;
        const mergedMap = new Map<string, FeedbackItem>();
        [...localItems, ...dbItems].forEach(item => {
          if (item && item.id) {
            mergedMap.set(item.id, item);
          }
        });
        const mergedList = Array.from(mergedMap.values());
        setFeedbackList(mergedList);
        localStorage.setItem('ANVESHAK_OWNER_FEEDBACK_LIST', JSON.stringify(mergedList));
      } else if (localItems.length > 0) {
        setFeedbackList(localItems);
      }
    } catch (err) {
      if (localItems.length > 0) setFeedbackList(localItems);
    }
  };

  useEffect(() => {
    loadFeedbackFromDb();
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel('anveshak_feedback_sync');
        channel.onmessage = (event) => {
          if (event.data && event.data.type === 'REFRESH_FEEDBACK') loadFeedbackFromDb();
        };
      } catch (e) {}
    }

    const interval = setInterval(loadFeedbackFromDb, 4000);
    const handleFocus = () => loadFeedbackFromDb();
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      if (channel) channel.close();
    };
  }, []);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.hypot(dx, dy) > 5) hasMovedRef.current = true;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const fabWidth = 140;
      const fabHeight = 50;
      let newX = dragStartRef.current.posX + dx;
      let newY = dragStartRef.current.posY + dy;
      newX = Math.max(10, Math.min(viewportWidth - fabWidth, newX));
      newY = Math.max(10, Math.min(viewportHeight - fabHeight, newY));
      setFabPosition({ x: newX, y: newY });
    };
    const handlePointerUp = () => { if (isDraggingRef.current) isDraggingRef.current = false; };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = fabRef.current?.getBoundingClientRect();
    if (!rect) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY, posX: rect.left, posY: rect.top };
  };

  const handleFabClick = () => { if (!hasMovedRef.current) setIsOpen(prev => !prev); };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setIsSubmitting(true);
    const roleTag = currentUser?.role === 'ADMIN' ? 'Admin' : currentUser?.role === 'MANAGER' ? 'Manager' : 'Sales Rep';
    const author = currentUser?.fullName ? `${currentUser.fullName} (${roleTag})` : 'Anveshak Team';
    const newNote: FeedbackItem = {
      id: `FB-${Date.now()}`,
      pageTab: activeTab,
      category,
      noteText: noteText.trim(),
      authorName: author,
      status: 'New',
      createdAt: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
    };
    setFeedbackList(prev => {
      const updated = [newNote, ...prev];
      localStorage.setItem('ANVESHAK_OWNER_FEEDBACK_LIST', JSON.stringify(updated));
      return updated;
    });
    try {
      const { saveOwnerFeedbackAction } = await import('@/app/actions/crm');
      const res = await saveOwnerFeedbackAction({ pageTab: activeTab, category, noteText: noteText.trim(), authorName: author });
      if (res && res.success && res.data) {
        newNote.id = res.data.id || newNote.id;
        triggerToast('Feedback recorded in DB!');
      }
    } catch (err) { console.warn('Supabase DB save fallback to local storage:', err); }
    setNoteText('');
    setIsSubmitting(false);
    broadcastSync();
    setActiveSubTab('list');
  };

  const handleStartEdit = (item: FeedbackItem) => {
    setEditingItemId(item.id);
    setEditNoteText(item.noteText);
    setEditCategory(item.category);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItemId || !editNoteText.trim()) return;
    const updated = feedbackList.map(item => item.id === editingItemId ? { ...item, noteText: editNoteText.trim(), category: editCategory } : item);
    setFeedbackList(updated);
    localStorage.setItem('ANVESHAK_OWNER_FEEDBACK_LIST', JSON.stringify(updated));
    triggerToast('Feedback updated & synced!');
    try {
      const { updateOwnerFeedbackMessageAction } = await import('@/app/actions/crm');
      await updateOwnerFeedbackMessageAction(editingItemId, { noteText: editNoteText.trim(), category: editCategory });
      broadcastSync();
    } catch (err) { console.error(err); }
    setEditingItemId(null);
  };

  const toggleStatus = async (id: string) => {
    const updated: FeedbackItem[] = feedbackList.map(item => {
      if (item.id === id) {
        const nextStatus: FeedbackItem['status'] = item.status === 'Resolved' ? 'New' : 'Resolved';
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
        broadcastSync();
      }
    } catch (err) {}
  };

  const pendingCount = feedbackList.filter(f => f.status !== 'Resolved').length;

  return (
    <>
      <div 
        ref={fabRef}
        className="feedback-fab-container"
        style={{
          position: 'fixed',
          left: fabPosition ? `${fabPosition.x}px` : undefined,
          top: fabPosition ? `${fabPosition.y}px` : undefined,
          bottom: fabPosition ? undefined : '24px',
          right: fabPosition ? undefined : '24px',
          zIndex: 1000,
          touchAction: 'none',
          userSelect: 'none'
        }}
        onPointerDown={handlePointerDown}
      >
        <button
          className={`feedback-fab ${isOpen ? 'active' : ''}`}
          onClick={handleFabClick}
          title="Drag anywhere • Click for Feedback"
        >
          <span className="fab-icon-box">
            {isOpen ? <CloseIcon /> : <MessageSquareIcon />}
          </span>
          <span className="fab-label">Feedback</span>
          {pendingCount > 0 && <span className="fab-badge">{pendingCount}</span>}
        </button>
      </div>

      <div className={`feedback-panel-wrapper ${isOpen ? 'open' : 'closed'}`}>
        <div className="feedback-panel">
          <div className="feedback-panel-header">
            <div className="feedback-header-title">
              <div className="header-icon-box"><MessageSquareIcon /></div>
              <div><h4>Universal Feedback</h4></div>
            </div>
            <button className="feedback-close-btn" onClick={() => setIsOpen(false)}><CloseIcon /></button>
          </div>

          <div className="feedback-context-banner">
            <span className="context-dot"></span>
            <span>Section:</span>
            <strong>{activeTab.toUpperCase()}</strong>
            {currentUser?.fullName && (
              <span style={{ marginLeft: 'auto', fontSize: '10.5px', color: '#f5d396' }}>👤 {currentUser.fullName}</span>
            )}
          </div>

          <div className="feedback-subtabs">
            <button className={activeSubTab === 'submit' ? 'active' : ''} onClick={() => { setActiveSubTab('submit'); setEditingItemId(null); }}>+ Send Feedback</button>
            <button className={activeSubTab === 'list' ? 'active' : ''} onClick={() => setActiveSubTab('list')}>Timeline ({feedbackList.length})</button>
          </div>

          {activeSubTab === 'submit' && (
            <form onSubmit={handleSubmit} className="feedback-form">
              <div className="feedback-form-group">
                <label>Category</label>
                <div className="category-pills">
                  {(['Requirement', 'Suggestion', 'Bug', 'Design'] as const).map(cat => (
                    <button key={cat} type="button" className={`cat-pill ${category === cat ? 'active' : ''}`} onClick={() => setCategory(cat)}><span>{cat}</span></button>
                  ))}
                </div>
              </div>
              <div className="feedback-form-group">
                <label>Feedback / Note Details *</label>
                <textarea rows={4} required value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder={`Enter your feedback or suggestions for ${activeTab}...`} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span style={{ fontSize: '11px', color: '#8c9ba5' }}>Auto-tagged to <strong>{activeTab}</strong></span>
                <button type="submit" disabled={isSubmitting || !noteText.trim()} className="btn-submit-feedback">{isSubmitting ? 'Saving...' : 'Send Feedback →'}</button>
              </div>
            </form>
          )}

          {activeSubTab === 'list' && (
            <div className="feedback-list-container">
              {editingItemId ? (
                <form onSubmit={handleSaveEdit} className="feedback-form animate-fade">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '12.5px', color: '#f5d396' }}>✏️ Edit Your Message</strong>
                    <button type="button" onClick={() => setEditingItemId(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                  <div className="feedback-form-group">
                    <label>Category</label>
                    <div className="category-pills">
                      {(['Requirement', 'Suggestion', 'Bug', 'Design'] as const).map(cat => (
                        <button key={cat} type="button" className={`cat-pill ${editCategory === cat ? 'active' : ''}`} onClick={() => setEditCategory(cat)}><span>{cat}</span></button>
                      ))}
                    </div>
                  </div>
                  <div className="feedback-form-group">
                    <label>Updated Message</label>
                    <textarea rows={4} required value={editNoteText} onChange={(e) => setEditNoteText(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                    <button type="button" className="btn-cancel" onClick={() => setEditingItemId(null)}>Cancel</button>
                    <button type="submit" className="btn-submit-feedback">Save & Resubmit</button>
                  </div>
                </form>
              ) : (
                feedbackList.length === 0 ? (
                  <div className="empty-feedback"><p>No feedback recorded yet.</p><span style={{ fontSize: '11px', color: '#8c9ba5' }}>Click "+ Send Feedback" to share feedback.</span></div>
                ) : (
                  feedbackList.map(item => {
                    const isAuthor = !currentUser?.fullName || item.authorName.toLowerCase().includes(currentUser.fullName.toLowerCase()) || currentUser.role === 'ADMIN';
                    return (
                      <div key={item.id} className={`feedback-item-card ${item.status === 'Resolved' ? 'resolved' : ''}`}>
                        <div className="feedback-card-top">
                          <span className={`cat-tag ${item.category.toLowerCase()}`}>
                            {item.category === 'Requirement' && <RequirementIcon />} {item.category === 'Suggestion' && <SuggestionIcon />} {item.category === 'Bug' && <BugIcon />} {item.category === 'Design' && <DesignIcon />}
                            <span>{item.category}</span>
                          </span>
                          <span className="page-tag">{item.pageTab}</span>
                          <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                            {isAuthor && <button className="edit-feedback-btn" onClick={() => handleStartEdit(item)}>✏️ Edit</button>}
                            <button className={`status-toggle-btn ${item.status === 'Resolved' ? 'done' : ''}`} onClick={() => toggleStatus(item.id)} title="Toggle Resolution Status">
                              {item.status === 'Resolved' ? <><CheckIcon /><span>Resolved</span></> : <span>Mark Done</span>}
                            </button>
                          </div>
                        </div>
                        <p className="feedback-text">{item.noteText}</p>
                        <div className="feedback-card-meta">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#d49b38', fontWeight: '600' }}><UserIcon /> {item.authorName}</span>
                          <span>{item.createdAt}</span>
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>
          )}

          {toastMessage && <div className="feedback-toast"><CheckIcon /> {toastMessage}</div>}
        </div>
      </div>

      <style jsx global>{`
        .feedback-fab-container { cursor: grab; }
        .feedback-fab-container:active { cursor: grabbing; }
        .feedback-fab {
          display: flex;
          align-items: center;
          gap: 9px;
          background: linear-gradient(135deg, #0f172a, #1e293b);
          border: 1.5px solid rgba(212, 155, 56, 0.6);
          color: #ffffff;
          padding: 10px 18px;
          border-radius: 30px;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .feedback-fab:hover { transform: translateY(-2px) scale(1.03); border-color: #d49b38; box-shadow: 0 14px 32px rgba(212, 155, 56, 0.35); }
        .feedback-fab.active { border-color: #ef4444; background: #1e293b; }
        .fab-icon-box { display: flex; align-items: center; justify-content: center; color: #f5d396; }
        .fab-badge { background: #d49b38; color: #0f172a; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 10px; }
        .feedback-panel-wrapper { position: fixed; bottom: 80px; right: 24px; z-index: 1050; transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.28s; }
        .feedback-panel-wrapper.open { transform: scale(1) translateY(0); opacity: 1; visibility: visible; pointer-events: auto; }
        .feedback-panel-wrapper.closed { transform: scale(0.92) translateY(14px); opacity: 0; visibility: hidden; pointer-events: none; }
        .feedback-panel { width: 380px; max-width: 92vw; max-height: 540px; background: #0f172a; border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 16px; box-shadow: 0 20px 48px rgba(0, 0, 0, 0.45); display: flex; flex-direction: column; overflow: hidden; color: #ffffff; }
        .feedback-panel-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #1e293b; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
        .feedback-header-title { display: flex; align-items: center; gap: 10px; }
        .feedback-header-title h4 { margin: 0; font-size: 14px; font-weight: 800; color: #f8fafc; }
        .header-icon-box { color: #f5d396; }
        .feedback-close-btn { background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px; display: flex; align-items: center; }
        .feedback-close-btn:hover { color: #ffffff; }
        .feedback-context-banner { display: flex; align-items: center; gap: 6px; padding: 7px 16px; background: rgba(2, 132, 199, 0.12); border-bottom: 1px solid rgba(2, 132, 199, 0.2); font-size: 11px; color: #38bdf8; }
        .context-dot { width: 6px; height: 6px; border-radius: 50%; background: #38bdf8; }
        .feedback-subtabs { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
        .feedback-subtabs button { background: none; border: none; color: #94a3b8; padding: 10px 0; font-size: 12px; font-weight: 700; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; }
        .feedback-subtabs button.active { color: #f5d396; border-bottom-color: #d49b38; background: rgba(212, 155, 56, 0.05); }
        .feedback-form { padding: 16px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
        .feedback-form-group label { display: block; font-size: 11px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px; }
        .feedback-form-group textarea { width: 100%; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; color: #ffffff; padding: 10px; font-size: 12px; font-family: inherit; resize: none; }
        .feedback-form-group textarea:focus { outline: none; border-color: #0284c7; }
        .category-pills { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
        .cat-pill { display: flex; align-items: center; gap: 6px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #cbd5e1; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; }
        .cat-pill.active { background: rgba(2, 132, 199, 0.2); border-color: #0284c7; color: #38bdf8; }
        .btn-submit-feedback { background: linear-gradient(135deg, #059669, #10b981); color: #ffffff; border: none; padding: 8px 14px; border-radius: 8px; font-size: 11.5px; font-weight: 700; cursor: pointer; }
        .btn-cancel { background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: #cbd5e1; padding: 6px 12px; border-radius: 8px; font-size: 11.5px; cursor: pointer; }
        .feedback-list-container { padding: 14px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; max-height: 380px; }
        .empty-feedback { text-align: center; padding: 36px 12px; color: #94a3b8; }
        .feedback-item-card { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
        .feedback-item-card.resolved { opacity: 0.6; }
        .feedback-card-top { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .cat-tag { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; }
        .cat-tag.requirement { background: rgba(2, 132, 199, 0.2); color: #38bdf8; }
        .cat-tag.suggestion { background: rgba(16, 185, 129, 0.2); color: #34d399; }
        .cat-tag.bug { background: rgba(239, 68, 68, 0.2); color: #f87171; }
        .cat-tag.design { background: rgba(168, 85, 247, 0.2); color: #c084fc; }
        .page-tag { font-size: 10px; color: #94a3b8; background: rgba(255, 255, 255, 0.05); padding: 2px 6px; border-radius: 4px; }
        .edit-feedback-btn { font-size: 10px; padding: 3px 6px; border-radius: 4px; background: rgba(2, 132, 199, 0.15); color: #38bdf8; border: 1px solid rgba(2, 132, 199, 0.3); cursor: pointer; font-weight: 700; }
        .status-toggle-btn { font-size: 10px; padding: 3px 6px; border-radius: 4px; background: rgba(255, 255, 255, 0.08); color: #cbd5e1; border: 1px solid rgba(255, 255, 255, 0.15); cursor: pointer; }
        .status-toggle-btn.done { background: #10b981; color: #ffffff; border-color: #10b981; }
        @media (max-width: 768px) {
          .feedback-panel-wrapper {
            bottom: 74px !important;
            right: 12px !important;
            left: 12px !important;
          }
          .feedback-panel {
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>
    </>
  );
}

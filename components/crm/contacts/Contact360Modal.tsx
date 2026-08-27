"use client";

import React, { useState, useEffect } from 'react';
import { fetchContact360Action, updateContactAction, deleteContactAction } from '@/app/actions/contacts';
import { formatPhoneDisplay } from '@/lib/phone';
import QuickCommModal from './QuickCommModal';

interface Contact360ModalProps {
  contactId: string;
  initialContact?: any;
  allDeals?: any[];
  allTasks?: any[];
  currentUser?: { fullName?: string; email?: string } | null;
  onClose: () => void;
  onContactUpdated: (updated: any) => void;
  onContactDeleted: (id: string) => void;
  onConvertToLead: (contact: any) => void;
  triggerToast?: (msg: string, type?: any) => void;
}

export default function Contact360Modal({
  contactId,
  initialContact,
  allDeals = [],
  allTasks = [],
  currentUser,
  onClose,
  onContactUpdated,
  onContactDeleted,
  onConvertToLead,
  triggerToast
}: Contact360ModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'pipeline' | 'merge'>('overview');
  const [loading, setLoading] = useState(!initialContact);
  const [contactData, setContactData] = useState<any>(initialContact || null);
  const [communications, setCommunications] = useState<any[]>([]);
  const [mergeLogs, setMergeLogs] = useState<any[]>([]);
  const [linkedTasks, setLinkedTasks] = useState<any[]>(() => {
    if (!initialContact) return [];
    return allTasks.filter(t => 
      (t.linkedTo && initialContact.name && t.linkedTo.toLowerCase().includes(initialContact.name.toLowerCase())) ||
      (t.linkedTo && initialContact.company && t.linkedTo.toLowerCase().includes(initialContact.company.toLowerCase()))
    );
  });
  const [linkedDeals, setLinkedDeals] = useState<any[]>(() => {
    if (!initialContact) return [];
    return allDeals.filter(d => 
      (d.name && initialContact.name && d.name.toLowerCase().includes(initialContact.name.toLowerCase())) ||
      (d.company && initialContact.company && d.company.toLowerCase().includes(initialContact.company.toLowerCase()))
    );
  });
  const [showQuickComm, setShowQuickComm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>(initialContact || {});

  const loadData = async () => {
    try {
      const res = await fetchContact360Action(contactId);
      if (res.success && res.data) {
        setContactData(res.data.contact);
        setEditForm(res.data.contact);
        if (res.data.communications && res.data.communications.length > 0) {
          setCommunications(res.data.communications);
        }
        if (res.data.mergeLogs && res.data.mergeLogs.length > 0) {
          setMergeLogs(res.data.mergeLogs);
        }
        if (res.data.linkedTasks && res.data.linkedTasks.length > 0) {
          setLinkedTasks(res.data.linkedTasks);
        }
        if (res.data.linkedDeals && res.data.linkedDeals.length > 0) {
          setLinkedDeals(res.data.linkedDeals);
        }
      }
    } catch (err) {
      console.warn('Prisma fetchContact360Action background load skipped (using local contact data):', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialContact) {
      setContactData(initialContact);
      setEditForm(initialContact);
      setLoading(false);
    }
    if (contactId) {
      loadData();
    }
  }, [contactId, initialContact]);

  if (loading || !contactData) {
    return (
      <div className="modal-overlay" style={{ zIndex: 1100 }}>
        <div className="modal-content" style={{ padding: '32px 20px', textAlign: 'center', maxWidth: '420px' }}>
          <div style={{ fontSize: '28px', marginBottom: '12px' }}>⏳</div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px', fontWeight: '600' }}>Loading Contact 360 Profile...</p>
        </div>
      </div>
    );
  }

  const handleSaveEdit = async () => {
    try {
      const res = await updateContactAction(contactId, editForm, currentUser?.fullName || 'CRM User');
      if (res.success && res.contact) {
        setContactData(res.contact);
        onContactUpdated(res.contact);
        setIsEditing(false);
        if (triggerToast) triggerToast('Contact profile updated!', 'success');
      } else {
        alert((res as any).error || 'Failed to update contact.');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete "${contactData.name}"? This action cannot be undone.`)) {
      try {
        const res = await deleteContactAction(contactId, currentUser?.fullName || 'CRM User');
        if (res.success) {
          onContactDeleted(contactId);
          if (triggerToast) triggerToast('Contact deleted.', 'info');
          onClose();
        } else {
          alert((res as any).error || 'Failed to delete contact.');
        }
      } catch (err: any) {
        alert('Error: ' + err.message);
      }
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'Customer': return { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' };
      case 'Prospect': return { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' };
      case 'VIP': return { bg: '#fffbeb', text: '#b45309', border: '#fde68a' };
      case 'Partner': return { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' };
      case 'Vendor': return { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' };
      default: return { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' };
    }
  };

  const catStyle = getCategoryBadge(contactData.category || 'Prospect');
  const rawPhone = contactData.preferredPhone || contactData.phone;

  return (
    <>
      <div className="modal-overlay" style={{ zIndex: 1100 }}>
        <div className="modal-content wide c360-sheet-container">
          
          {/* TOP 360 PROFILE HEADER */}
          <div className="c360-header">
            <div className="c360-header-info">
              <div className="c360-avatar">
                {(contactData.name || 'C').charAt(0).toUpperCase()}
              </div>

              <div className="c360-identity">
                <div className="c360-name-row">
                  <h3 className="c360-name">{contactData.name}</h3>
                </div>

                <p className="c360-company-line">
                  {contactData.designation ? `${contactData.designation} • ` : ''}
                  <strong style={{ color: '#d49b38' }}>{contactData.company || 'No Company Listed'}</strong>
                  {contactData.city ? ` (${contactData.city})` : ''}
                </p>

                {/* Badges Bar */}
                <div className="c360-badges-bar">
                  <span style={{
                    backgroundColor: catStyle.bg,
                    color: catStyle.text,
                    border: `1px solid ${catStyle.border}`,
                    padding: '2px 8px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: '700'
                  }}>
                    {contactData.category || 'Prospect'}
                  </span>
                  {contactData.doNotContact ? (
                    <span style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '700' }}>
                      Do Not Contact
                    </span>
                  ) : (
                    <span style={{ backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '600' }}>
                      ✓ Consent Active
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Top Controls */}
            <div className="c360-header-actions">
              <button
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '6px 12px', minHeight: '34px' }}
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
              <button className="modal-close-btn" style={{ position: 'static' }} onClick={onClose}>✕</button>
            </div>
          </div>

          {/* QUICK ACTION HUB TOOLBAR */}
          <div className="c360-action-toolbar">
            <div className="c360-action-buttons">
              <button
                className="btn btn-primary"
                style={{ backgroundColor: '#10b981', borderColor: '#10b981', color: '#fff', fontSize: '12px', padding: '8px 14px', flex: 1 }}
                onClick={() => setShowQuickComm(true)}
              >
                WhatsApp / Call / Email
              </button>

              <button
                className="btn btn-primary"
                style={{ backgroundColor: '#1e40af', borderColor: '#1e40af', fontSize: '12px', padding: '8px 14px', flex: 1 }}
                onClick={() => onConvertToLead(contactData)}
              >
                Convert to Lead →
              </button>
            </div>

            <div className="c360-recency-text">
              Last Contacted: <strong>{contactData.lastContactedAt ? new Date(contactData.lastContactedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}</strong>
            </div>
          </div>

          {/* SUB-TABS NAVIGATION (HORIZONTAL SCROLL ON MOBILE) */}
          <div className="c360-tabs-nav">
            {[
              { id: 'overview', label: 'Profile & Metadata' },
              { id: 'timeline', label: `Timeline (${communications.length})` },
              { id: 'pipeline', label: `Deals & Tasks (${linkedDeals.length + linkedTasks.length})` },
              { id: 'merge', label: `Provenance (${mergeLogs.length})` }
            ].map(tab => (
              <button
                key={tab.id}
                className={`c360-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id as any)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB CONTENT AREA */}
          <div className="c360-tab-body">
            
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div>
                {isEditing ? (
                  /* INLINE EDIT MODE */
                  <div className="c360-edit-grid">
                    <div>
                      <label className="c360-form-label">Full Name *</label>
                      <input
                        type="text"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="form-control"
                      />
                    </div>
                    <div>
                      <label className="c360-form-label">Preferred Phone</label>
                      <input
                        type="text"
                        value={editForm.preferredPhone || ''}
                        onChange={(e) => setEditForm({ ...editForm, preferredPhone: e.target.value })}
                        className="form-control"
                      />
                    </div>
                    <div>
                      <label className="c360-form-label">Email Address</label>
                      <input
                        type="email"
                        value={editForm.email || ''}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="form-control"
                      />
                    </div>
                    <div>
                      <label className="c360-form-label">Company</label>
                      <input
                        type="text"
                        value={editForm.company || ''}
                        onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                        className="form-control"
                      />
                    </div>
                    <div>
                      <label className="c360-form-label">Designation</label>
                      <input
                        type="text"
                        value={editForm.designation || ''}
                        onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                        className="form-control"
                      />
                    </div>
                    <div>
                      <label className="c360-form-label">Category</label>
                      <select
                        value={editForm.category || 'Prospect'}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        className="form-control"
                      >
                        <option value="Prospect">Prospect</option>
                        <option value="Customer">Customer</option>
                        <option value="Partner">Partner</option>
                        <option value="Vendor">Vendor</option>
                        <option value="VIP">VIP</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="c360-form-label">City</label>
                      <input
                        type="text"
                        value={editForm.city || ''}
                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                        className="form-control"
                      />
                    </div>
                    <div>
                      <label className="c360-form-label">State</label>
                      <input
                        type="text"
                        value={editForm.state || ''}
                        onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                        className="form-control"
                      />
                    </div>
                    <div className="c360-full-col">
                      <label className="c360-form-label">Notes & Remarks</label>
                      <textarea
                        rows={3}
                        value={editForm.notes || ''}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        className="form-control"
                      />
                    </div>
                    <div className="c360-full-col" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                      <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
                      <button className="btn btn-primary" onClick={handleSaveEdit}>Save Changes</button>
                    </div>
                  </div>
                ) : (
                  /* READ-ONLY METADATA VIEW */
                  <div className="c360-content-grid">
                    {/* Left Col: Contact Info & Notes */}
                    <div className="c360-col-section">
                      <div className="c360-card">
                        <div className="c360-card-header">
                          <h4>Contact Information</h4>
                        </div>
                        
                        <div className="c360-field-group">
                          <span className="c360-field-lbl">Primary Phone (E.164):</span>
                          {rawPhone ? (
                            <a href={`tel:${rawPhone}`} className="c360-link-val">
                              {formatPhoneDisplay(rawPhone)}
                            </a>
                          ) : (
                            <span className="c360-val">—</span>
                          )}
                        </div>

                        {Array.isArray(contactData.alternatePhones) && contactData.alternatePhones.length > 0 && (
                          <div className="c360-field-group">
                            <span className="c360-field-lbl">Alternate Phones:</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                              {contactData.alternatePhones.map((p: string, idx: number) => (
                                <a key={idx} href={`tel:${p}`} className="c360-pill-tag">
                                  {formatPhoneDisplay(p)}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="c360-field-group">
                          <span className="c360-field-lbl">Primary Email:</span>
                          {contactData.email ? (
                            <a href={`mailto:${contactData.email}`} className="c360-link-val">
                              {contactData.email}
                            </a>
                          ) : (
                            <span className="c360-val">—</span>
                          )}
                        </div>

                        <div className="c360-field-group" style={{ marginBottom: 0 }}>
                          <span className="c360-field-lbl">Location:</span>
                          <span className="c360-val">{[contactData.city, contactData.state].filter(Boolean).join(', ') || '—'}</span>
                        </div>
                      </div>

                      <div className="c360-card">
                        <div className="c360-card-header">
                          <h4>Notes & Remarks</h4>
                        </div>
                        <p style={{ margin: 0, fontSize: '12.5px', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                          {contactData.notes || 'No notes added yet for this contact.'}
                        </p>
                      </div>
                    </div>

                    {/* Right Col: Source & Danger Zone */}
                    <div className="c360-col-section">
                      <div className="c360-card">
                        <div className="c360-card-header">
                          <h4>Source & Provenance</h4>
                        </div>

                        <div className="c360-field-group">
                          <span className="c360-field-lbl">Origin Channel:</span>
                          <span className="c360-val" style={{ fontWeight: '700', color: '#1e40af' }}>{contactData.sourceType || 'Direct Entry'}</span>
                        </div>

                        {contactData.sourceEvent && (
                          <div className="c360-field-group">
                            <span className="c360-field-lbl">Campaign / Event:</span>
                            <span className="c360-val">{contactData.sourceEvent}</span>
                          </div>
                        )}

                        <div className="c360-field-group">
                          <span className="c360-field-lbl">Created On:</span>
                          <span className="c360-val">{new Date(contactData.createdAt).toLocaleString('en-IN')}</span>
                        </div>

                        <div className="c360-field-group" style={{ marginBottom: 0 }}>
                          <span className="c360-field-lbl">Record Owner:</span>
                          <span className="c360-val">{contactData.owner || 'KP Sumanth'}</span>
                        </div>
                      </div>

                      {/* Danger Zone */}
                      <div className="c360-danger-card">
                        <div style={{ fontWeight: '700', fontSize: '12px', color: '#dc2626', marginBottom: '4px' }}>
                          Danger Zone
                        </div>
                        <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#991b1b', lineHeight: '1.4' }}>
                          Permanently delete this contact record and all associated timeline communications.
                        </p>
                        <button
                          className="btn btn-secondary"
                          style={{ color: '#dc2626', borderColor: '#fca5a5', backgroundColor: '#fff', fontSize: '11px', width: '100%', justifyContent: 'center' }}
                          onClick={handleDelete}
                        >
                          Delete Contact Record
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: TIMELINE */}
            {activeTab === 'timeline' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text-main)' }}>Communication Timeline</h4>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '11px', padding: '5px 12px' }}
                    onClick={() => setShowQuickComm(true)}
                  >
                    + Log Outreach
                  </button>
                </div>

                {communications.length === 0 ? (
                  <div className="c360-empty-state">
                    
                    <p style={{ margin: '0 0 4px', fontWeight: '700', color: 'var(--text-main)' }}>No communications logged</p>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Use the button above to log calls, WhatsApps, or meeting notes.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {communications.map((comm) => (
                      <div key={comm.id} className="c360-timeline-item">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              background: comm.type === 'WhatsApp' ? '#ecfdf5' : comm.type === 'Call' ? '#eff6ff' : '#f5f3ff',
                              color: comm.type === 'WhatsApp' ? '#059669' : comm.type === 'Call' ? '#1e40af' : '#6d28d9',
                              border: '1px solid currentColor',
                              padding: '2px 6px',
                              borderRadius: '6px',
                              fontSize: '10.5px',
                              fontWeight: '700'
                            }}>
                              {comm.type === 'WhatsApp' ? 'WhatsApp' : comm.type === 'Call' ? 'Call' : comm.type === 'Email' ? 'Email' : 'Meeting'}
                            </span>
                            <span style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--text-main)' }}>
                              {comm.subject || comm.type}
                            </span>
                          </div>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                            {new Date(comm.createdAt).toLocaleString('en-IN')}
                          </span>
                        </div>

                        {comm.notes && (
                          <div style={{ fontSize: '12px', color: '#334155', whiteSpace: 'pre-wrap', background: '#f8fafc', padding: '8px 10px', borderRadius: '6px', marginTop: '6px', border: '1px solid var(--border-color)' }}>
                            {comm.notes}
                          </div>
                        )}

                        <div style={{ marginTop: '6px', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                          Logged by: <strong>{comm.loggedBy || 'System User'}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: PIPELINE & DEALS */}
            {activeTab === 'pipeline' && (
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: 'var(--text-main)' }}>Linked Deals in Funnel</h4>
                {linkedDeals.length === 0 ? (
                  <div className="c360-empty-state" style={{ marginBottom: '18px' }}>
                    <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)' }}>No active deals linked to this contact or company.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '8px', marginBottom: '18px' }}>
                    {linkedDeals.map(deal => (
                      <div key={deal.id} className="c360-pipeline-card">
                        <div>
                          <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>{deal.name}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Stage: {deal.stage} • Probability: {deal.probability}%</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: '#10b981' }}>
                            ₹{Number(deal.value).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: 'var(--text-main)' }}>Linked Tasks & Reminders</h4>
                {linkedTasks.length === 0 ? (
                  <div className="c360-empty-state">
                    <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)' }}>No pending tasks linked to this contact.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {linkedTasks.map(task => (
                      <div key={task.id} className="c360-pipeline-card">
                        <div>
                          <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>{task.title}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Assignee: {task.assignee} • Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}</div>
                        </div>
                        <span style={{ background: task.status === 'Completed' ? '#ecfdf5' : '#fffbeb', color: task.status === 'Completed' ? '#047857' : '#b45309', border: '1px solid currentColor', padding: '2px 8px', borderRadius: '6px', fontSize: '10.5px', fontWeight: '700' }}>
                          {task.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: MERGE & AUDIT LOGS */}
            {activeTab === 'merge' && (
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: 'var(--text-main)' }}>Provenance & Merge History</h4>
                {mergeLogs.length === 0 ? (
                  <div className="c360-empty-state">
                    <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)' }}>This contact has not been merged with any other duplicate records.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {mergeLogs.map(log => (
                      <div key={log.id} className="c360-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e40af' }}>
                            Merged Record: {log.mergedFromSnapshot?.name || 'Duplicate Contact'}
                          </span>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                            {new Date(log.createdAt).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                          Merged by: <strong>{log.mergedBy || 'System User'}</strong>
                        </div>
                        <details style={{ fontSize: '11px' }}>
                          <summary style={{ cursor: 'pointer', color: '#d49b38', fontWeight: '700' }}>View Preserved Snapshot JSON</summary>
                          <pre style={{ background: '#151c2e', color: '#f8fafc', padding: '10px', borderRadius: '6px', marginTop: '6px', overflowX: 'auto', fontSize: '10.5px' }}>
                            {JSON.stringify(log.mergedFromSnapshot, null, 2)}
                          </pre>
                        </details>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QUICK COMM POPUP MODAL */}
      {showQuickComm && (
        <QuickCommModal
          contact={contactData}
          currentUser={currentUser}
          onClose={() => setShowQuickComm(false)}
          onCommunicationLogged={(newComm) => {
            setCommunications(prev => [newComm, ...prev]);
            setContactData((prev: any) => ({ ...prev, lastContactedAt: new Date().toISOString() }));
          }}
          triggerToast={triggerToast}
        />
      )}

      {/* COMPONENT-SCOPED STYLING */}
      <style jsx>{`
        .c360-sheet-container {
          width: 920px;
          max-width: 96vw;
          height: 88vh;
          display: flex;
          flex-direction: column;
          padding: 0 !important;
          background: #ffffff;
          overflow: hidden;
        }

        .c360-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          background: #ffffff;
        }

        .c360-header-info {
          display: flex;
          gap: 14px;
          align-items: center;
          flex: 1;
          min-width: 0;
        }

        .c360-avatar {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: #151c2e;
          border: 2px solid #d49b38;
          color: #f5d396;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 800;
          flex-shrink: 0;
          box-shadow: 0 4px 10px rgba(21, 28, 46, 0.15);
        }

        .c360-identity {
          min-width: 0;
          flex: 1;
        }

        .c360-name {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
          color: #111827;
          line-height: 1.2;
          word-break: break-word;
        }

        .c360-company-line {
          margin: 2px 0 6px;
          font-size: 12.5px;
          color: var(--text-muted);
          word-break: break-word;
        }

        .c360-badges-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .c360-header-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-shrink: 0;
        }

        .c360-action-toolbar {
          background: #f8fafc;
          border-bottom: 1px solid var(--border-color);
          padding: 10px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .c360-action-buttons {
          display: flex;
          gap: 8px;
          flex: 1;
        }

        .c360-recency-text {
          font-size: 11.5px;
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .c360-tabs-nav {
          display: flex;
          border-bottom: 1px solid var(--border-color);
          padding: 0 16px;
          background: #ffffff;
          overflow-x: auto;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          gap: 4px;
        }

        .c360-tabs-nav::-webkit-scrollbar {
          display: none;
        }

        .c360-tab-btn {
          padding: 12px 14px;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--text-muted);
          border: none;
          background: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }

        .c360-tab-btn:hover {
          color: #111827;
        }

        .c360-tab-btn.active {
          color: #1e40af;
          border-bottom-color: #d49b38;
          font-weight: 800;
        }

        .c360-tab-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          -webkit-overflow-scrolling: touch;
        }

        .c360-content-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 16px;
        }

        .c360-col-section {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .c360-card {
          background: #f8fafc;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 14px;
        }

        .c360-card-header h4 {
          margin: 0 0 10px;
          font-size: 13px;
          font-weight: 700;
          color: #151c2e;
        }

        .c360-field-group {
          margin-bottom: 10px;
        }

        .c360-field-lbl {
          color: var(--text-muted);
          display: block;
          font-size: 11px;
          font-weight: 600;
          margin-bottom: 1px;
        }

        .c360-val {
          font-size: 13px;
          font-weight: 600;
          color: #111827;
        }

        .c360-link-val {
          font-size: 13px;
          font-weight: 700;
          color: #1e40af;
          text-decoration: none;
        }

        .c360-link-val:hover {
          text-decoration: underline;
        }

        .c360-pill-tag {
          display: inline-block;
          background: #e2e8f0;
          color: #334155;
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          text-decoration: none;
        }

        .c360-danger-card {
          background: #fef2f2;
          border: 1px dashed #fca5a5;
          border-radius: 12px;
          padding: 14px;
        }

        .c360-edit-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .c360-full-col {
          grid-column: 1 / -1;
        }

        .c360-form-label {
          display: block;
          font-size: 11.5px;
          font-weight: 700;
          color: #4b5563;
          margin-bottom: 4px;
        }

        .c360-empty-state {
          text-align: center;
          padding: 30px 16px;
          background: #f8fafc;
          border: 1px dashed var(--border-color);
          border-radius: 12px;
        }

        .c360-timeline-item {
          background: #ffffff;
          border: 1px solid var(--border-color);
          border-radius: 10px;
          padding: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
        }

        .c360-pipeline-card {
          background: #f8fafc;
          border: 1px solid var(--border-color);
          border-radius: 10px;
          padding: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        /* MOBILE FRAME ADJUSTMENTS */
        @media (max-width: 768px) {
          .c360-sheet-container {
            width: 100vw !important;
            max-width: 100vw !important;
            height: 92vh !important;
            border-radius: 20px 20px 0 0 !important;
          }

          .c360-header {
            padding: 14px 14px 12px !important;
          }

          .c360-avatar {
            width: 42px !important;
            height: 42px !important;
            font-size: 16px !important;
          }

          .c360-name {
            font-size: 16px !important;
          }

          .c360-company-line {
            font-size: 12px !important;
          }

          .c360-action-toolbar {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 10px 14px !important;
            gap: 8px !important;
          }

          .c360-action-buttons {
            flex-direction: column !important;
          }

          .c360-action-buttons button {
            width: 100% !important;
          }

          .c360-recency-text {
            text-align: center;
            font-size: 11px;
          }

          .c360-tab-body {
            padding: 14px !important;
          }

          .c360-content-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          .c360-edit-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}

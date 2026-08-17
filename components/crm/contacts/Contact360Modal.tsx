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
        <div className="modal-content" style={{ padding: '40px', textAlign: 'center', width: '500px' }}>
          <div style={{ fontSize: '28px', marginBottom: '12px' }}>⏳</div>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Loading Contact 360 Profile...</p>
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

  const getCategoryBadgeColor = (cat: string) => {
    switch (cat) {
      case 'Customer': return { bg: '#dcfce7', text: '#15803d' };
      case 'Prospect': return { bg: '#e0f2fe', text: '#0369a1' };
      case 'VIP': return { bg: '#fef3c7', text: '#b45309' };
      case 'Partner': return { bg: '#f3e8ff', text: '#7e22ce' };
      case 'Vendor': return { bg: '#f1f5f9', text: '#475569' };
      default: return { bg: '#f1f5f9', text: '#64748b' };
    }
  };

  const catStyle = getCategoryBadgeColor(contactData.category || 'Prospect');

  return (
    <>
      <div className="modal-overlay" style={{ zIndex: 1100 }}>
        <div className="modal-content wide" style={{ width: '920px', maxWidth: '96vw', height: '85vh', display: 'flex', flexDirection: 'column' }}>
          
          {/* TOP 360 PROFILE HEADER */}
          <div style={{
            paddingBottom: '16px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start'
          }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 'bold',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
              }}>
                {contactData.name.charAt(0).toUpperCase()}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#0f172a' }}>
                    {contactData.name}
                  </h3>
                  <span style={{
                    backgroundColor: catStyle.bg,
                    color: catStyle.text,
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}>
                    {contactData.category || 'Prospect'}
                  </span>
                  {contactData.doNotContact ? (
                    <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                      🚫 Do Not Contact
                    </span>
                  ) : (
                    <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
                      ✓ Consent Active
                    </span>
                  )}
                </div>

                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  {contactData.designation ? `${contactData.designation} at ` : ''}
                  <strong style={{ color: '#334155' }}>{contactData.company || 'No Company Listed'}</strong>
                  {contactData.city ? ` • ${contactData.city}` : ''}
                </p>
              </div>
            </div>

            {/* Top Controls */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '6px 12px' }}
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? 'Cancel Edit' : '✏️ Edit'}
              </button>
              <button className="modal-close-btn" onClick={onClose}>✕</button>
            </div>
          </div>

          {/* QUICK ACTION HUB TOOLBAR */}
          <div style={{
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '10px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-primary"
                style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: '#fff', fontSize: '12px', padding: '6px 14px' }}
                onClick={() => setShowQuickComm(true)}
              >
                💬 WhatsApp / Call / Email
              </button>

              <button
                className="btn btn-primary"
                style={{ backgroundColor: '#0284c7', borderColor: '#0284c7', fontSize: '12px', padding: '6px 14px' }}
                onClick={() => onConvertToLead(contactData)}
              >
                🎯 Convert to Lead →
              </button>
            </div>

            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Last Contacted: <strong>{contactData.lastContactedAt ? new Date(contactData.lastContactedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}</strong>
            </div>
          </div>

          {/* SUB-TABS NAVIGATION */}
          <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid #e2e8f0', padding: '0 16px', background: '#fff' }}>
            {[
              { id: 'overview', label: '📋 Profile & Metadata' },
              { id: 'timeline', label: `💬 Communication Timeline (${communications.length})` },
              { id: 'pipeline', label: `💼 Linked Deals & Tasks (${linkedDeals.length + linkedTasks.length})` },
              { id: 'merge', label: `🔀 Merge & Provenance (${mergeLogs.length})` }
            ].map(tab => (
              <button
                key={tab.id}
                style={{
                  padding: '12px 16px',
                  fontSize: '13px',
                  fontWeight: activeTab === tab.id ? '600' : 'normal',
                  color: activeTab === tab.id ? '#0284c7' : '#64748b',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid #0284c7' : '2px solid transparent',
                  cursor: 'pointer'
                }}
                onClick={() => setActiveTab(tab.id as any)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB CONTENT AREA */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div>
                {isEditing ? (
                  /* INLINE EDIT MODE */
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Full Name *</label>
                      <input
                        type="text"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Preferred Phone</label>
                      <input
                        type="text"
                        value={editForm.preferredPhone || ''}
                        onChange={(e) => setEditForm({ ...editForm, preferredPhone: e.target.value })}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Email Address</label>
                      <input
                        type="email"
                        value={editForm.email || ''}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Company</label>
                      <input
                        type="text"
                        value={editForm.company || ''}
                        onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Designation</label>
                      <input
                        type="text"
                        value={editForm.designation || ''}
                        onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Category</label>
                      <select
                        value={editForm.category || 'Prospect'}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
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
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>City</label>
                      <input
                        type="text"
                        value={editForm.city || ''}
                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>State</label>
                      <input
                        type="text"
                        value={editForm.state || ''}
                        onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>Notes</label>
                      <textarea
                        rows={3}
                        value={editForm.notes || ''}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                      <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
                      <button className="btn btn-primary" onClick={handleSaveEdit}>Save Changes</button>
                    </div>
                  </div>
                ) : (
                  /* READ-ONLY METADATA VIEW */
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#0f172a' }}>Contact Information</h4>
                      <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '16px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                        <div style={{ marginBottom: '10px' }}>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Primary Phone (E.164):</span>
                          <strong>{formatPhoneDisplay(contactData.preferredPhone)}</strong>
                        </div>
                        {Array.isArray(contactData.alternatePhones) && contactData.alternatePhones.length > 0 && (
                          <div style={{ marginBottom: '10px' }}>
                            <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Alternate Phones:</span>
                            {contactData.alternatePhones.map((p: string, idx: number) => (
                              <span key={idx} style={{ display: 'inline-block', marginRight: '8px', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                                {formatPhoneDisplay(p)}
                              </span>
                            ))}
                          </div>
                        )}
                        <div style={{ marginBottom: '10px' }}>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Primary Email:</span>
                          <strong>{contactData.email || '—'}</strong>
                        </div>
                        {Array.isArray(contactData.alternateEmails) && contactData.alternateEmails.length > 0 && (
                          <div style={{ marginBottom: '10px' }}>
                            <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Alternate Emails:</span>
                            {contactData.alternateEmails.map((e: string, idx: number) => (
                              <span key={idx} style={{ display: 'inline-block', marginRight: '8px', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                                {e}
                              </span>
                            ))}
                          </div>
                        )}
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Location:</span>
                          <strong>{[contactData.city, contactData.state].filter(Boolean).join(', ') || '—'}</strong>
                        </div>
                      </div>

                      <h4 style={{ margin: '20px 0 12px', fontSize: '14px', color: '#0f172a' }}>Notes & Remarks</h4>
                      <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '14px', border: '1px solid #e2e8f0', fontSize: '12px', whiteSpace: 'pre-wrap', color: '#334155' }}>
                        {contactData.notes || 'No notes added yet.'}
                      </div>
                    </div>

                    <div>
                      <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#0f172a' }}>Source & Provenance</h4>
                      <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '16px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Origin Channel:</span>
                          <strong>{contactData.sourceType || 'Direct Entry'}</strong>
                        </div>
                        {contactData.sourceEvent && (
                          <div style={{ marginBottom: '8px' }}>
                            <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Campaign / Event:</span>
                            <strong>{contactData.sourceEvent}</strong>
                          </div>
                        )}
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Created On:</span>
                          <strong>{new Date(contactData.createdAt).toLocaleString('en-IN')}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Record Owner:</span>
                          <strong>{contactData.owner || 'KP Sumanth'}</strong>
                        </div>
                      </div>

                      {/* Danger Zone */}
                      <div style={{ marginTop: '30px', padding: '14px', border: '1px dashed #fca5a5', borderRadius: '8px', background: '#fef2f2' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#991b1b' }}>Danger Zone</span>
                        <p style={{ margin: '4px 0 10px', fontSize: '11px', color: '#7f1d1d' }}>
                          Permanently delete this contact record and all associated timeline communications.
                        </p>
                        <button
                          className="btn btn-secondary"
                          style={{ color: '#dc2626', borderColor: '#fca5a5', backgroundColor: '#fff', fontSize: '11px' }}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', color: '#0f172a' }}>Logged Communications Stream</h4>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '11px', padding: '4px 12px' }}
                    onClick={() => setShowQuickComm(true)}
                  >
                    + Log New Communication
                  </button>
                </div>

                {communications.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>💬</div>
                    <p style={{ margin: 0, fontSize: '13px' }}>No communications logged yet for this contact.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {communications.map((comm) => (
                      <div
                        key={comm.id}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '14px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              background: comm.type === 'WhatsApp' ? '#dcfce7' : comm.type === 'Call' ? '#e0f2fe' : '#f3e8ff',
                              color: comm.type === 'WhatsApp' ? '#15803d' : comm.type === 'Call' ? '#0369a1' : '#7e22ce',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 'bold'
                            }}>
                              {comm.type === 'WhatsApp' ? '💬 WhatsApp' : comm.type === 'Call' ? '📞 Call' : comm.type === 'Email' ? '✉️ Email' : '🤝 Meeting'}
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                              {comm.subject || comm.type}
                            </span>
                            {comm.autoLogged && (
                              <span style={{ fontSize: '10px', color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                                Auto-logged
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {new Date(comm.createdAt).toLocaleString('en-IN')}
                          </span>
                        </div>

                        {comm.notes && (
                          <div style={{ fontSize: '12px', color: '#334155', whiteSpace: 'pre-wrap', background: '#f8fafc', padding: '8px 10px', borderRadius: '6px', marginTop: '6px' }}>
                            {comm.notes}
                          </div>
                        )}

                        <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
                          Logged by: <strong>{comm.loggedBy || 'System'}</strong>
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
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#0f172a' }}>Linked Deals & Pipeline</h4>
                {linkedDeals.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>No active deals linked to this contact or company.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
                    {linkedDeals.map(deal => (
                      <div key={deal.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '13px', color: '#0f172a' }}>{deal.name}</strong>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Stage: {deal.stage} • Probability: {deal.probability}%</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#16a34a' }}>
                            ₹{Number(deal.value).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <h4 style={{ margin: '20px 0 12px', fontSize: '14px', color: '#0f172a' }}>Linked Tasks & Follow-ups</h4>
                {linkedTasks.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#64748b' }}>No pending tasks linked to this contact.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {linkedTasks.map(task => (
                      <div key={task.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '13px', color: '#0f172a' }}>{task.title}</strong>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Assignee: {task.assignee} • Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}</div>
                        </div>
                        <span style={{ background: task.status === 'Completed' ? '#dcfce7' : '#fef3c7', color: task.status === 'Completed' ? '#15803d' : '#b45309', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
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
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', color: '#0f172a' }}>Merge & Provenance History</h4>
                {mergeLogs.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#64748b' }}>This contact has not been merged with any other duplicate records.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {mergeLogs.map(log => (
                      <div key={log.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0369a1' }}>
                            Merged Record: {log.mergedFromSnapshot?.name || 'Duplicate Contact'}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {new Date(log.createdAt).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#475569', marginBottom: '8px' }}>
                          Merged by: <strong>{log.mergedBy || 'System User'}</strong>
                        </div>
                        <details style={{ fontSize: '11px' }}>
                          <summary style={{ cursor: 'pointer', color: '#0284c7', fontWeight: '600' }}>View Merged Snapshot Data</summary>
                          <pre style={{ background: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '6px', overflowX: 'auto' }}>
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
    </>
  );
}

"use client";

import React, { useState, useEffect } from 'react';
import { fetchContact360Action, updateContactAction, deleteContactAction } from '@/app/actions/contacts';
import { formatPhoneDisplay } from '@/lib/phone';
import QuickCommModal from './QuickCommModal';

export const COMPANY_SCALE_OPTIONS = [
  'Micro Enterprise (< ₹5 Cr / 1-10 Emp)',
  'Small Scale / MSME (₹5-50 Cr / 10-50 Emp)',
  'Medium Enterprise (₹50-250 Cr / 50-250 Emp)',
  'Large Enterprise / OEM (> ₹250 Cr / 250+ Emp)',
  'PSU / Public Sector Enterprise',
  'Defense / Govt Department (B2G)'
];

export const PRESET_TAG_OPTIONS = [
  'B2G',
  'MSME',
  'Defence',
  'Tier-1',
  'Enterprise',
  'PSU',
  'Direct',
  'Partner',
  'Priority',
  'OEM'
];

export const LEAD_SOURCE_OPTIONS = [
  'Direct',
  'Website',
  'Visiting Card',
  'Referral',
  'Event',
  'Hackathon',
  'Cold Call',
  'Govt Tender'
];

interface Contact360ModalProps {
  contactId: string;
  initialContact?: any;
  allDeals?: any[];
  allTasks?: any[];
  currentUser?: { fullName?: string; email?: string } | null;
  onClose: () => void;
  onContactUpdated: (updated: any) => void;
  onContactDeleted: (id: string) => void;
  onConvertToLead?: (contact: any) => void;
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
  const [isSaving, setIsSaving] = useState(false);

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
        <div className="modal-content" style={{ padding: '32px 20px', textAlign: 'center', maxWidth: '420px', borderRadius: '16px' }}>
          <div style={{ fontSize: '28px', marginBottom: '12px' }}>⏳</div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px', fontWeight: '600' }}>Loading Contact 360 Profile...</p>
        </div>
      </div>
    );
  }

  const handleSaveEdit = async () => {
    if (!editForm.name?.trim()) {
      alert('Contact full name is required.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        ...editForm,
        name: editForm.name.trim(),
        phone: editForm.preferredPhone || editForm.phone,
        preferredPhone: editForm.preferredPhone || editForm.phone,
        email: editForm.email?.trim() || null,
        company: editForm.company?.trim() || null,
        tags: Array.isArray(editForm.tags) ? editForm.tags : []
      };
      delete payload.tagInput;
      const res = await updateContactAction(contactId, payload, currentUser?.fullName || 'CRM User');
      if (res.success && res.contact) {
        setContactData(res.contact);
        setEditForm(res.contact);
        onContactUpdated(res.contact);
        setIsEditing(false);
        if (triggerToast) triggerToast('Contact profile updated successfully!', 'success');
      } else {
        alert((res as any).error || 'Failed to update contact.');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsSaving(false);
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
        <div className="modal-content wide c360-sheet-container" style={{
          width: '920px',
          maxWidth: '96vw',
          maxHeight: '90vh',
          height: 'auto',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          background: '#ffffff',
          overflow: 'hidden',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}>
          
          {/* TOP 360 PROFILE HEADER */}
          <div className="c360-header" style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            background: '#ffffff',
            flexShrink: 0
          }}>
            <div className="c360-header-info" style={{ display: 'flex', gap: '14px', alignItems: 'center', flex: 1, minWidth: 0 }}>
              <div className="c360-avatar" style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: '#151c2e',
                border: '2px solid #d49b38',
                color: '#f5d396',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: '800',
                flexShrink: 0
              }}>
                {(contactData.name || 'C').charAt(0).toUpperCase()}
              </div>

              <div className="c360-identity" style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a', lineHeight: '1.2' }}>{contactData.name}</h3>
                  {contactData.isConverted && (
                    <span style={{ backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '700' }}>
                      ✓ Converted Lead
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                    {contactData.designation ? `${contactData.designation} • ` : ''}
                    <strong style={{ color: '#0284c7' }}>{contactData.company || 'No Company Listed'}</strong>
                    {contactData.city ? ` (${contactData.city})` : ''}
                  </span>
                  
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
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
              <button
                className={`btn ${isEditing ? 'btn-secondary' : 'btn-primary'}`}
                style={{ fontSize: '12.5px', padding: '7px 16px', fontWeight: '700' }}
                onClick={() => {
                  if (isEditing) {
                    setEditForm(contactData);
                  }
                  setIsEditing(!isEditing);
                }}
              >
                {isEditing ? '✕ Cancel Edit' : '✏️ Edit Profile'}
              </button>
              <button className="modal-close-btn" style={{ position: 'static' }} onClick={onClose}>✕</button>
            </div>
          </div>

          {/* QUICK ACTION HUB TOOLBAR */}
          <div className="c360-action-toolbar" style={{
            background: '#f8fafc',
            borderBottom: '1px solid var(--border-color)',
            padding: '12px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                style={{ backgroundColor: '#10b981', borderColor: '#10b981', color: '#fff', fontSize: '12.5px', padding: '8px 16px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setShowQuickComm(true)}
              >
                <span>💬</span> WhatsApp / Call / Email
              </button>

              <button
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '8px 14px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => {
                  setActiveTab('timeline');
                  setShowQuickComm(true);
                }}
              >
                <span>📝</span> + Log Outreach
              </button>
            </div>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ffffff',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              fontSize: '12px',
              color: '#64748b'
            }}>
              <span>🕒</span> Last Contacted: <strong style={{ color: '#0f172a' }}>{contactData.lastContactedAt ? new Date(contactData.lastContactedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}</strong>
            </div>
          </div>

          {/* SUB-TABS NAVIGATION */}
          <div className="c360-tabs-nav" style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-color)',
            padding: '0 24px',
            background: '#ffffff',
            overflowX: 'auto',
            gap: '8px',
            flexShrink: 0
          }}>
            {[
              { id: 'overview', label: '👤 Profile & Metadata' },
              { id: 'timeline', label: `💬 Timeline (${communications.length})` },
              { id: 'pipeline', label: `💼 Deals & Tasks (${linkedDeals.length + linkedTasks.length})` },
              { id: 'merge', label: `🧬 Provenance (${mergeLogs.length})` }
            ].map(tab => (
              <button
                key={tab.id}
                className={`c360-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                style={{
                  padding: '12px 16px',
                  fontSize: '13px',
                  fontWeight: activeTab === tab.id ? '800' : '600',
                  color: activeTab === tab.id ? '#1e40af' : '#64748b',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === tab.id ? '3px solid #1e40af' : '3px solid transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
                onClick={() => setActiveTab(tab.id as any)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB CONTENT AREA */}
          <div className="c360-tab-body" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
            
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                {isEditing ? (
                  /* INLINE EDIT MODE - CLEAN BALANCED GRID */
                  <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(); }} style={{ display: 'flex', flexDirection: 'column', flex: 1, margin: 0 }}>
                    <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      
                      <div className="modal-grid-2col">
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-label)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Full Name *</label>
                          <input
                            type="text"
                            required
                            value={editForm.name || ''}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            placeholder="e.g. Ramesh Patel"
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-label)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Primary Phone *</label>
                          <input
                            type="text"
                            required
                            value={editForm.preferredPhone || editForm.phone || ''}
                            onChange={(e) => setEditForm({ ...editForm, preferredPhone: e.target.value, phone: e.target.value })}
                            placeholder="e.g. +91 98450 12345"
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}
                          />
                        </div>
                      </div>

                      <div className="modal-grid-2col">
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-label)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Work Email Address</label>
                          <input
                            type="email"
                            value={editForm.email || ''}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            placeholder="e.g. ramesh@company.com"
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-label)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Company / Organization Name</label>
                          <input
                            type="text"
                            value={editForm.company || ''}
                            onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                            placeholder="e.g. Acme Precision Tools Pvt Ltd"
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}
                          />
                        </div>
                      </div>

                      <div className="modal-grid-2col">
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-label)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Designation / Role</label>
                          <input
                            type="text"
                            value={editForm.designation || ''}
                            onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                            placeholder="e.g. Purchase Director"
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-label)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Company Scale / MSME Classification</label>
                          <select
                            value={editForm.companyScale || editForm.customFields?.companyScale || 'Small Scale / MSME (₹5-50 Cr / 10-50 Emp)'}
                            onChange={(e) => setEditForm({ ...editForm, companyScale: e.target.value, customFields: { ...(editForm.customFields || {}), companyScale: e.target.value } })}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', background: '#fff' }}
                          >
                            {COMPANY_SCALE_OPTIONS.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="modal-grid-2col">
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-label)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Category / Status</label>
                          <select
                            value={editForm.category || 'Prospect'}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', background: '#fff' }}
                          >
                            <option value="Prospect">Prospect</option>
                            <option value="Customer">Customer</option>
                            <option value="Partner">Partner</option>
                            <option value="Vendor">Vendor</option>
                            <option value="VIP">VIP</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-label)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Lead Source</label>
                          <select
                            value={editForm.sourceType || 'Direct'}
                            onChange={(e) => setEditForm({ ...editForm, sourceType: e.target.value })}
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', background: '#fff' }}
                          >
                            {LEAD_SOURCE_OPTIONS.map(src => (
                              <option key={src} value={src}>{src}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="modal-grid-2col">
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-label)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>City</label>
                          <input
                            type="text"
                            value={editForm.city || ''}
                            onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                            placeholder="e.g. Bangalore"
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-label)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>State</label>
                          <input
                            type="text"
                            value={editForm.state || ''}
                            onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                            placeholder="e.g. Karnataka"
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}
                          />
                        </div>
                      </div>

                      <div className="modal-grid-2col">
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-label)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Record Owner (Account Manager)</label>
                          <input
                            type="text"
                            value={editForm.owner || ''}
                            onChange={(e) => setEditForm({ ...editForm, owner: e.target.value })}
                            placeholder="Enter record owner name..."
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}
                          />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-label)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Assigned Sales Rep (Employee)</label>
                          <input
                            type="text"
                            value={editForm.assignedRep || editForm.customFields?.assignedRep || editForm.owner || ''}
                            onChange={(e) => setEditForm({ ...editForm, assignedRep: e.target.value, customFields: { ...(editForm.customFields || {}), assignedRep: e.target.value } })}
                            placeholder="Enter assigned representative..."
                            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}
                          />
                        </div>
                      </div>

                      {/* Interactive Tags */}
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-label)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Tags & Classification</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'none', fontWeight: 'normal' }}>Click to toggle or type custom tag</span>
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                          {PRESET_TAG_OPTIONS.map(t => {
                            const isSel = (editForm.tags || []).includes(t);
                            return (
                              <button
                                key={t}
                                type="button"
                                className={`badge ${isSel ? 'badge-hot' : 'badge-cold'}`}
                                style={{ cursor: 'pointer', padding: '3px 8px', fontSize: '11px' }}
                                onClick={() => {
                                  if (isSel) {
                                    setEditForm({ ...editForm, tags: (editForm.tags || []).filter((tag: string) => tag !== t) });
                                  } else {
                                    setEditForm({ ...editForm, tags: [...(editForm.tags || []), t] });
                                  }
                                }}
                              >
                                {isSel ? '✓ ' : '+ '}{t}
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input
                            type="text"
                            placeholder="Type custom tag & press Enter..."
                            value={editForm.tagInput || ''}
                            onChange={(e) => setEditForm({ ...editForm, tagInput: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const trimmed = (editForm.tagInput || '').trim();
                                if (trimmed && !(editForm.tags || []).includes(trimmed)) {
                                  setEditForm({ ...editForm, tags: [...(editForm.tags || []), trimmed], tagInput: '' });
                                }
                              }
                            }}
                            style={{ flex: 1, padding: '7px 10px', fontSize: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                          />
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '6px 14px', fontSize: '12px' }}
                            onClick={() => {
                              const trimmed = (editForm.tagInput || '').trim();
                              if (trimmed && !(editForm.tags || []).includes(trimmed)) {
                                setEditForm({ ...editForm, tags: [...(editForm.tags || []), trimmed], tagInput: '' });
                              }
                            }}
                          >
                            + Add
                          </button>
                        </div>
                        {(editForm.tags || []).length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                            {(editForm.tags || []).map((tag: string) => (
                              <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#e0f2fe', color: '#0369a1', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>
                                #{tag}
                                <span style={{ cursor: 'pointer', fontWeight: 'bold', marginLeft: '2px' }} onClick={() => setEditForm({ ...editForm, tags: (editForm.tags || []).filter((t: string) => t !== tag) })}>×</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Notes & Remarks */}
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-label)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Notes & Remarks</label>
                        <textarea
                          rows={3}
                          value={editForm.notes || ''}
                          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                          placeholder="Add background context, discussion history, key pain points..."
                          style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', lineHeight: '1.5' }}
                        />
                      </div>
                    </div>

                    {/* Dedicated Pinned Modal Footer */}
                    <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', backgroundColor: '#f8fafc', margin: 0, display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
                      <button type="button" className="btn btn-secondary" style={{ padding: '8px 18px', fontSize: '13px', fontWeight: '600' }} onClick={() => setIsEditing(false)}>Cancel</button>
                      <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ padding: '8px 22px', fontSize: '13px', fontWeight: '700' }}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                ) : (
                  /* READ-ONLY METADATA VIEW - BALANCED STRUCTURED CARDS */
                  <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '18px' }}>
                    
                    {/* Card 1: Contact Details & Identity */}
                    <div className="c360-card" style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
                      <h4 style={{ margin: '0 0 14px', fontSize: '13.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>📞</span> Contact Information
                      </h4>
                      
                      <div className="c360-field-group" style={{ marginBottom: '10px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Primary Phone (E.164):</span>
                        {rawPhone ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                            <a href={`tel:${rawPhone}`} style={{ fontSize: '13.5px', fontWeight: '700', color: '#1e40af', textDecoration: 'none' }}>
                              {formatPhoneDisplay(rawPhone)}
                            </a>
                            <button
                              type="button"
                              onClick={() => setShowQuickComm(true)}
                              style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', fontWeight: '700' }}
                            >
                              💬 WhatsApp
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '13px', color: '#64748b' }}>—</span>
                        )}
                      </div>

                      {Array.isArray(contactData.alternatePhones) && contactData.alternatePhones.length > 0 && (
                        <div className="c360-field-group" style={{ marginBottom: '10px' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Alternate Phone Numbers:</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                            {contactData.alternatePhones.map((p: string, idx: number) => (
                              <a key={idx} href={`tel:${p}`} style={{ background: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', textDecoration: 'none' }}>
                                {formatPhoneDisplay(p)}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="c360-field-group" style={{ marginBottom: '10px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Work Email Address:</span>
                        {contactData.email ? (
                          <a href={`mailto:${contactData.email}`} style={{ fontSize: '13px', fontWeight: '700', color: '#1e40af', textDecoration: 'none' }}>
                            {contactData.email}
                          </a>
                        ) : (
                          <span style={{ fontSize: '13px', color: '#64748b' }}>—</span>
                        )}
                      </div>

                      <div className="c360-field-group" style={{ marginBottom: 0 }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Location:</span>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>
                          {[contactData.city, contactData.state].filter(Boolean).join(', ') || 'Not Specified'}
                        </span>
                      </div>
                    </div>

                    {/* Card 2: Company & MSME Scale */}
                    <div className="c360-card" style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
                      <h4 style={{ margin: '0 0 14px', fontSize: '13.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🏢</span> Organization & Scale
                      </h4>

                      <div className="c360-field-group" style={{ marginBottom: '10px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Company Name:</span>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#0284c7' }}>
                          {contactData.company || 'Direct Individual (No Company)'}
                        </span>
                      </div>

                      <div className="c360-field-group" style={{ marginBottom: '10px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Designation / Job Role:</span>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>
                          {contactData.designation || 'Not specified'}
                        </span>
                      </div>

                      <div className="c360-field-group" style={{ marginBottom: 0 }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>MSME / Enterprise Classification:</span>
                        <span style={{ display: 'inline-block', marginTop: '2px', background: '#eff6ff', color: '#1e40af', padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700', border: '1px solid #bfdbfe' }}>
                          {contactData.companyScale || contactData.customFields?.companyScale || 'Small Scale / MSME (₹5-50 Cr / 10-50 Emp)'}
                        </span>
                      </div>
                    </div>

                    {/* Card 3: Ownership & Governance */}
                    <div className="c360-card" style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
                      <h4 style={{ margin: '0 0 14px', fontSize: '13.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>📋</span> Ownership & Governance
                      </h4>

                      <div className="c360-field-group" style={{ marginBottom: '10px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Origin Channel / Source:</span>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e40af' }}>
                          {contactData.sourceType || 'Direct Entry'}
                        </span>
                      </div>

                      <div className="c360-field-group" style={{ marginBottom: '10px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Record Owner:</span>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                          {contactData.owner || 'Authenticated User'}
                        </span>
                      </div>

                      <div className="c360-field-group" style={{ marginBottom: 0 }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Created On:</span>
                        <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                          {new Date(contactData.createdAt).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Card 4: Tags & Notes */}
                    <div className="c360-card" style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
                      <h4 style={{ margin: '0 0 14px', fontSize: '13.5px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>🏷️</span> Tags & Contextual Notes
                      </h4>

                      <div className="c360-field-group" style={{ marginBottom: '10px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Classification Tags:</span>
                        {Array.isArray(contactData.tags) && contactData.tags.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                            {contactData.tags.map((t: string) => (
                              <span key={t} style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' }}>
                                #{t}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>No tags assigned</span>
                        )}
                      </div>

                      <div className="c360-field-group" style={{ marginBottom: 0 }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Notes & Remarks:</span>
                        <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#334155', whiteSpace: 'pre-wrap', lineHeight: '1.5', background: '#ffffff', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          {contactData.notes || 'No notes added yet for this contact.'}
                        </p>
                      </div>
                    </div>

                    {/* Card 5: Danger Zone */}
                    <div style={{ gridColumn: '1 / -1', background: '#fef2f2', border: '1px dashed #fca5a5', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: '800', fontSize: '13px', color: '#dc2626', marginBottom: '2px' }}>
                          ⚠️ Danger Zone
                        </div>
                        <p style={{ margin: 0, fontSize: '12px', color: '#991b1b' }}>
                          Permanently delete this contact record and all associated timeline communications.
                        </p>
                      </div>
                      <button
                        className="btn btn-secondary"
                        style={{ color: '#dc2626', borderColor: '#fca5a5', backgroundColor: '#fff', fontSize: '12px', fontWeight: '700', padding: '6px 14px' }}
                        onClick={handleDelete}
                      >
                        Delete Contact Record
                      </button>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* TAB 2: TIMELINE */}
            {activeTab === 'timeline' && (
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: 'var(--text-main)' }}>Communication & Outreach Timeline</h4>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '6px 14px', fontWeight: '600' }}
                    onClick={() => setShowQuickComm(true)}
                  >
                    + Log Outreach
                  </button>
                </div>

                {communications.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 16px', background: '#f8fafc', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>📭</div>
                    <p style={{ margin: '0 0 4px', fontWeight: '700', color: 'var(--text-main)' }}>No communications logged</p>
                    <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)' }}>Use the button above to log phone calls, WhatsApp messages, or meeting notes.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {communications.map((comm) => (
                      <div key={comm.id} style={{ background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              background: comm.type === 'WhatsApp' ? '#ecfdf5' : comm.type === 'Call' ? '#eff6ff' : '#f5f3ff',
                              color: comm.type === 'WhatsApp' ? '#059669' : comm.type === 'Call' ? '#1e40af' : '#6d28d9',
                              border: '1px solid currentColor',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700'
                            }}>
                              {comm.type === 'WhatsApp' ? 'WhatsApp' : comm.type === 'Call' ? 'Call' : comm.type === 'Email' ? 'Email' : 'Meeting'}
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>
                              {comm.subject || comm.type}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {new Date(comm.createdAt).toLocaleString('en-IN')}
                          </span>
                        </div>

                        {comm.notes && (
                          <div style={{ fontSize: '12.5px', color: '#334155', whiteSpace: 'pre-wrap', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', marginTop: '6px', border: '1px solid var(--border-color)' }}>
                            {comm.notes}
                          </div>
                        )}

                        <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
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
              <div style={{ padding: '24px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '800', color: 'var(--text-main)' }}>Linked Deals in Pipeline</h4>
                {linkedDeals.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 16px', background: '#f8fafc', border: '1px dashed var(--border-color)', borderRadius: '12px', marginBottom: '20px' }}>
                    <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)' }}>No active deals currently linked to this contact or company.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
                    {linkedDeals.map(deal => (
                      <div key={deal.id} style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                        <div>
                          <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>{deal.name}</strong>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>Stage: <strong>{deal.stage}</strong> • Probability: {deal.probability}%</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '14px', fontWeight: '800', color: '#10b981' }}>
                            ₹{Number(deal.value).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '800', color: 'var(--text-main)' }}>Linked Tasks & Reminders</h4>
                {linkedTasks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 16px', background: '#f8fafc', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                    <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)' }}>No pending tasks linked to this contact.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {linkedTasks.map(task => (
                      <div key={task.id} style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                        <div>
                          <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>{task.title}</strong>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>Assignee: <strong>{task.assignee}</strong> • Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}</div>
                        </div>
                        <span style={{ background: task.status === 'Completed' ? '#ecfdf5' : '#fffbeb', color: task.status === 'Completed' ? '#047857' : '#b45309', border: '1px solid currentColor', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
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
              <div style={{ padding: '24px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '800', color: 'var(--text-main)' }}>Provenance & Merge History</h4>
                {mergeLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 16px', background: '#f8fafc', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                    <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)' }}>This contact has not been merged with any other duplicate records.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {mergeLogs.map(log => (
                      <div key={log.id} style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e40af' }}>
                            Merged Record: {log.mergedFromSnapshot?.name || 'Duplicate Contact'}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {new Date(log.createdAt).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                          Merged by: <strong>{log.mergedBy || 'System User'}</strong>
                        </div>
                        <details style={{ fontSize: '11.5px' }}>
                          <summary style={{ cursor: 'pointer', color: '#0284c7', fontWeight: '700' }}>View Preserved Snapshot Data</summary>
                          <pre style={{ background: '#151c2e', color: '#f8fafc', padding: '12px', borderRadius: '8px', marginTop: '8px', overflowX: 'auto', fontSize: '11px' }}>
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

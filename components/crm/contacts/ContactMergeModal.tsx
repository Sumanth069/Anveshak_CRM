"use client";

import React, { useState } from 'react';
import { mergeContactsAction } from '@/app/actions/contacts';
import { DuplicateSignal } from '@/lib/dedup';
import { formatPhoneDisplay } from '@/lib/phone';

interface ContactMergeModalProps {
  primaryContact: any;
  secondaryContact: any;
  matchScore?: number;
  signals?: DuplicateSignal[];
  currentUser?: { fullName?: string; email?: string } | null;
  onClose: () => void;
  onMergeSuccess: (mergedContact: any) => void;
  triggerToast?: (msg: string, type: 'success' | 'warning' | 'info' | 'error') => void;
}

export default function ContactMergeModal({
  primaryContact,
  secondaryContact,
  matchScore = 100,
  signals = [],
  currentUser,
  onClose,
  onMergeSuccess,
  triggerToast
}: ContactMergeModalProps) {
  const [fieldSelections, setFieldSelections] = useState<Record<string, 'primary' | 'secondary'>>({
    name: secondaryContact.name ? 'secondary' : 'primary',
    preferredPhone: secondaryContact.preferredPhone ? 'secondary' : 'primary',
    email: secondaryContact.email ? 'secondary' : 'primary',
    company: secondaryContact.company ? 'secondary' : 'primary',
    designation: secondaryContact.designation ? 'secondary' : 'primary',
    city: secondaryContact.city ? 'secondary' : 'primary',
    state: secondaryContact.state ? 'secondary' : 'primary',
    category: secondaryContact.category ? 'secondary' : 'primary',
    notes: 'primary',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fields = [
    { key: 'name', label: 'Full Name' },
    { key: 'preferredPhone', label: 'Primary Phone', isPhone: true },
    { key: 'email', label: 'Email Address' },
    { key: 'company', label: 'Company Name' },
    { key: 'designation', label: 'Job Title / Designation' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'category', label: 'Category' },
  ];

  const handleFieldSelect = (fieldKey: string, choice: 'primary' | 'secondary') => {
    setFieldSelections(prev => ({
      ...prev,
      [fieldKey]: choice
    }));
  };

  const handleExecuteMerge = async () => {
    setIsSubmitting(true);
    try {
      // Build field overrides map from selections
      const fieldOverrides: Record<string, any> = {};
      for (const field of fields) {
        const choice = fieldSelections[field.key];
        const chosenVal = choice === 'secondary' ? secondaryContact[field.key] : primaryContact[field.key];
        if (chosenVal !== undefined) {
          fieldOverrides[field.key] = chosenVal;
        }
      }

      const res = await mergeContactsAction({
        primaryId: primaryContact.id,
        secondaryId: secondaryContact.id,
        fieldOverrides,
        authorName: currentUser?.fullName || 'CRM User'
      });

      if (res.success && res.contact) {
        onMergeSuccess(res.contact);
        if (triggerToast) triggerToast(`Successfully merged ${secondaryContact.name} into ${res.contact.name}!`, 'success');
        onClose();
      } else {
        alert(res.error || 'Failed to merge contact records.');
      }
    } catch (err: any) {
      console.error('Merge execution error:', err);
      alert('Error occurred during contact merge: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div className="modal-content wide" style={{ width: '880px', maxWidth: '96vw' }}>
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                🔀 Contact Duplicate Resolution & Merge
              </h3>
              <span style={{
                background: matchScore >= 90 ? '#fee2e2' : '#fef3c7',
                color: matchScore >= 90 ? '#991b1b' : '#b45309',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 'bold'
              }}>
                Match Score: {matchScore}%
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
              Select which attributes to preserve in the unified permanent record. All communications, phone numbers, and tags will be automatically united.
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Signals Breakdown */}
        {signals.length > 0 && (
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '10px 14px',
            margin: '14px 0',
            fontSize: '12px'
          }}>
            <strong style={{ color: '#334155' }}>Matched Signals:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: '20px', color: '#64748b' }}>
              {signals.map((sig, idx) => (
                <li key={idx}>
                  <strong>+{sig.points} pts</strong> — {sig.description}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Side-by-side field diff comparison */}
        <div style={{ maxHeight: '50vh', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', width: '22%' }}>Field</th>
                <th style={{ padding: '10px 12px', width: '38%', color: '#1e293b' }}>
                  Existing Record (Primary)
                </th>
                <th style={{ padding: '10px 12px', width: '40%', color: '#0369a1' }}>
                  Incoming / Duplicate Record
                </th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => {
                const primaryVal = field.isPhone ? formatPhoneDisplay(primaryContact[field.key]) : (primaryContact[field.key] || '—');
                const secondaryVal = field.isPhone ? formatPhoneDisplay(secondaryContact[field.key]) : (secondaryContact[field.key] || '—');
                const isSelectedSecondary = fieldSelections[field.key] === 'secondary';

                return (
                  <tr key={field.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '600', color: '#475569' }}>
                      {field.label}
                    </td>

                    {/* Primary Option */}
                    <td
                      onClick={() => handleFieldSelect(field.key, 'primary')}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        background: !isSelectedSecondary ? '#f0fdf4' : 'transparent',
                        transition: 'background 0.15s'
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name={`diff-${field.key}`}
                          checked={!isSelectedSecondary}
                          onChange={() => handleFieldSelect(field.key, 'primary')}
                        />
                        <span style={{ fontWeight: !isSelectedSecondary ? '600' : 'normal', color: !isSelectedSecondary ? '#166534' : '#64748b' }}>
                          {primaryVal}
                        </span>
                      </label>
                    </td>

                    {/* Secondary Option */}
                    <td
                      onClick={() => handleFieldSelect(field.key, 'secondary')}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        background: isSelectedSecondary ? '#e0f2fe' : 'transparent',
                        transition: 'background 0.15s'
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name={`diff-${field.key}`}
                          checked={isSelectedSecondary}
                          onChange={() => handleFieldSelect(field.key, 'secondary')}
                        />
                        <span style={{ fontWeight: isSelectedSecondary ? '600' : 'normal', color: isSelectedSecondary ? '#0369a1' : '#64748b' }}>
                          {secondaryVal}
                        </span>
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Auto-Union Notice */}
        <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', fontSize: '11px', color: '#64748b', marginBottom: '16px' }}>
          ℹ️ <strong>Automatic Union Policy</strong>: Alternate phone numbers, secondary email addresses, tag taxonomies, and source history from both records will be automatically retained in the primary record. A snapshot of the secondary record will be saved in the merge registry.
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
            onClick={handleExecuteMerge}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Merging Records...' : 'Execute Resolution & Merge Records →'}
          </button>
        </div>
      </div>
    </div>
  );
}

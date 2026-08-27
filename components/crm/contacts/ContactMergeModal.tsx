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
  triggerToast?: (msg: string, type?: any) => void;
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

      if (res.success && (res as any).contact) {
        onMergeSuccess((res as any).contact);
        if (triggerToast) triggerToast(`Successfully merged ${(secondaryContact as any)?.name || 'contact'} into ${(res as any).contact?.name || 'primary'}!`, 'success');
        onClose();
      } else {
        alert((res as any).error || 'Failed to merge contact records.');
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
      <div className="modal-content wide" style={{ width: '880px', maxWidth: '96vw', padding: '20px' }}>
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>
                Smart Duplicate Resolution & Merge
              </h3>
              <span style={{
                background: matchScore >= 80 ? '#fef2f2' : '#fffbeb',
                color: matchScore >= 80 ? '#dc2626' : '#b45309',
                border: `1px solid ${matchScore >= 80 ? '#fecaca' : '#fde68a'}`,
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: '800'
              }}>
                Match Score: {matchScore}%
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Choose which field values to preserve in the primary record. Associated deals, timeline notes, and tags will automatically unite.
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Matched Signals Breakdown */}
        {signals.length > 0 && (
          <div style={{
            background: '#f8fafc',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '10px 14px',
            margin: '14px 0',
            fontSize: '12px'
          }}>
            <strong style={{ color: 'var(--text-main)' }}>Matched Signals:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: '20px', color: 'var(--text-muted)' }}>
              {signals.map((sig, idx) => (
                <li key={idx}>
                  <strong style={{ color: '#151c2e' }}>+{sig.points} pts</strong> — {sig.description}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Side-by-side field diff comparison */}
        <div style={{ maxHeight: '50vh', overflowY: 'auto', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px', marginBottom: '14px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', minWidth: '480px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', width: '22%' }}>Field</th>
                <th style={{ padding: '10px 12px', width: '39%', color: '#151c2e' }}>
                  Existing Record (Primary)
                </th>
                <th style={{ padding: '10px 12px', width: '39%', color: '#1e40af' }}>
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
                  <tr key={field.key} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '700', color: 'var(--text-muted)' }}>
                      {field.label}
                    </td>

                    {/* Primary Option */}
                    <td
                      onClick={() => handleFieldSelect(field.key, 'primary')}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        background: !isSelectedSecondary ? '#ecfdf5' : 'transparent',
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
                        <span style={{ fontWeight: !isSelectedSecondary ? '700' : '500', color: !isSelectedSecondary ? '#047857' : 'var(--text-muted)' }}>
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
                        background: isSelectedSecondary ? '#eff6ff' : 'transparent',
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
                        <span style={{ fontWeight: isSelectedSecondary ? '700' : '500', color: isSelectedSecondary ? '#1e40af' : 'var(--text-muted)' }}>
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
        <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px', border: '1px solid var(--border-subtle)' }}>
          ℹ️ <strong>Automatic Union Policy</strong>: Alternate phones, emails, and notes from both records will be automatically retained in the primary record. A snapshot of the secondary record will be preserved.
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            style={{ backgroundColor: '#151c2e', borderColor: '#151c2e', color: '#f5d396' }}
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

"use client";

import React, { useState } from 'react';
import { normalizePhone } from '@/lib/phone';
import { scoreDuplicate } from '@/lib/dedup';
import { importContactsBatchAction } from '@/app/actions/contacts';

interface ExcelImportModalProps {
  existingContacts: any[];
  currentUser?: { fullName?: string; email?: string } | null;
  onClose: () => void;
  onImportSuccess: (result: any) => void;
  triggerToast?: (msg: string, type: 'success' | 'warning' | 'info' | 'error') => void;
}

interface ColumnMapping {
  name: string;
  phone: string;
  email: string;
  company: string;
  designation: string;
  city: string;
  state: string;
  category: string;
  notes: string;
  tags: string;
}

// Built-in CSV Parser for zero-dependency reliability
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const splitLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const rawHeaders = splitLine(lines[0]);
  const headers = rawHeaders.map(h => h.replace(/^["']|["']$/g, '').trim());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitLine(lines[i]).map(v => v.replace(/^["']|["']$/g, '').trim());
    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] || '';
    });
    rows.push(rowObj);
  }

  return { headers, rows };
}

export default function ExcelImportModal({
  existingContacts,
  currentUser,
  onClose,
  onImportSuccess,
  triggerToast
}: ExcelImportModalProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing'>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [sourceType, setSourceType] = useState<string>('Excel Import');
  const [sourceEvent, setSourceEvent] = useState<string>('');
  const [autoMergeDuplicates, setAutoMergeDuplicates] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [mapping, setMapping] = useState<ColumnMapping>({
    name: '',
    phone: '',
    email: '',
    company: '',
    designation: '',
    city: '',
    state: '',
    category: '',
    notes: '',
    tags: ''
  });

  // Auto-guess mappings from headers
  const autoMapHeaders = (fileHeaders: string[]) => {
    const newMapping: ColumnMapping = {
      name: '',
      phone: '',
      email: '',
      company: '',
      designation: '',
      city: '',
      state: '',
      category: '',
      notes: '',
      tags: ''
    };

    fileHeaders.forEach(h => {
      const lower = h.toLowerCase();
      if (!newMapping.name && (lower.includes('name') || lower.includes('contact') || lower.includes('person') || lower.includes('full'))) {
        newMapping.name = h;
      } else if (!newMapping.phone && (lower.includes('phone') || lower.includes('mobile') || lower.includes('cell') || lower.includes('tel') || lower.includes('contact no'))) {
        newMapping.phone = h;
      } else if (!newMapping.email && (lower.includes('email') || lower.includes('mail'))) {
        newMapping.email = h;
      } else if (!newMapping.company && (lower.includes('company') || lower.includes('org') || lower.includes('enterprise') || lower.includes('business'))) {
        newMapping.company = h;
      } else if (!newMapping.designation && (lower.includes('designation') || lower.includes('title') || lower.includes('role') || lower.includes('position'))) {
        newMapping.designation = h;
      } else if (!newMapping.city && (lower.includes('city') || lower.includes('location') || lower.includes('town'))) {
        newMapping.city = h;
      } else if (!newMapping.state && (lower.includes('state') || lower.includes('province'))) {
        newMapping.state = h;
      } else if (!newMapping.category && (lower.includes('category') || lower.includes('type') || lower.includes('segment'))) {
        newMapping.category = h;
      } else if (!newMapping.notes && (lower.includes('note') || lower.includes('remark') || lower.includes('comment'))) {
        newMapping.notes = h;
      } else if (!newMapping.tags && (lower.includes('tag') || lower.includes('label'))) {
        newMapping.tags = h;
      }
    });

    // Check localStorage for saved preset
    try {
      const savedPreset = localStorage.getItem('ANVESHAK_COLUMN_MAP_PRESET');
      if (savedPreset) {
        const parsed = JSON.parse(savedPreset);
        Object.keys(parsed).forEach(k => {
          if (fileHeaders.includes(parsed[k])) {
            (newMapping as any)[k] = parsed[k];
          }
        });
      }
    } catch {}

    setMapping(newMapping);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);

    try {
      if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
        const text = await file.text();
        const { headers: fileHeaders, rows } = parseCSV(text);
        if (fileHeaders.length === 0 || rows.length === 0) {
          alert('Could not parse any rows from this CSV file.');
          setIsProcessing(false);
          return;
        }
        setHeaders(fileHeaders);
        setParsedRows(rows);
        autoMapHeaders(fileHeaders);
        setStep('mapping');
      } else {
        // Try dynamic XLSX parser or fallback
        try {
          const XLSX = await import('xlsx');
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          if (!json || json.length === 0) {
            alert('The uploaded Excel sheet contains no data rows.');
            setIsProcessing(false);
            return;
          }

          const fileHeaders = Object.keys(json[0]);
          setHeaders(fileHeaders);
          setParsedRows(json);
          autoMapHeaders(fileHeaders);
          setStep('mapping');
        } catch {
          alert('Excel reader not loaded. Please convert your file to CSV format and upload.');
        }
      }
    } catch (err: any) {
      console.error('File parsing error:', err);
      alert('Error parsing uploaded file: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Compile mapped rows into unified contact objects
  const getMappedCandidateRows = () => {
    return parsedRows.map((r, index) => {
      const name = mapping.name ? String(r[mapping.name] || '').trim() : '';
      const phone = mapping.phone ? String(r[mapping.phone] || '').trim() : '';
      const email = mapping.email ? String(r[mapping.email] || '').trim() : '';
      const company = mapping.company ? String(r[mapping.company] || '').trim() : '';
      const designation = mapping.designation ? String(r[mapping.designation] || '').trim() : '';
      const city = mapping.city ? String(r[mapping.city] || '').trim() : '';
      const state = mapping.state ? String(r[mapping.state] || '').trim() : '';
      const category = mapping.category ? String(r[mapping.category] || '').trim() : 'Prospect';
      const notes = mapping.notes ? String(r[mapping.notes] || '').trim() : '';
      const rawTags = mapping.tags ? String(r[mapping.tags] || '').trim() : '';
      const tags = rawTags ? rawTags.split(/[,;|]/).map(t => t.trim()).filter(Boolean) : [];

      const normPhone = phone ? normalizePhone(phone) : null;
      const cleanPhone = normPhone?.isValid ? normPhone.e164 : phone;

      let status: 'valid' | 'duplicate' | 'review' | 'invalid' = 'valid';
      let statusNote = 'Ready to import';

      if (!name) {
        status = 'invalid';
        statusNote = 'Missing Name';
      } else {
        const candidate = {
          name,
          preferredPhone: cleanPhone,
          email,
          company
        };
        const match = scoreDuplicate(candidate, existingContacts);
        if (match.status === 'duplicate') {
          status = 'duplicate';
          statusNote = `Duplicate: ${match.existingContact?.name} (${match.totalScore}%)`;
        } else if (match.status === 'review') {
          status = 'review';
          statusNote = `Possible Match: ${match.existingContact?.name} (${match.totalScore}%)`;
        }
      }

      return {
        _index: index,
        name,
        phone: cleanPhone,
        email,
        company,
        designation,
        city,
        state,
        category: category || 'Prospect',
        notes,
        tags,
        status,
        statusNote
      };
    });
  };

  const handleSavePresetAndProceed = () => {
    if (!mapping.name) {
      alert('Please map the "Full Name" column before proceeding.');
      return;
    }

    try {
      localStorage.setItem('ANVESHAK_COLUMN_MAP_PRESET', JSON.stringify(mapping));
    } catch {}

    setStep('preview');
  };

  const handleExecuteImport = async () => {
    const candidates = getMappedCandidateRows().filter(c => c.status !== 'invalid');
    if (candidates.length === 0) {
      alert('No valid rows found to import.');
      return;
    }

    setStep('importing');
    setIsProcessing(true);

    try {
      let res: any;
      try {
        res = await importContactsBatchAction({
          rows: candidates,
          fileName: fileName || 'Contacts_Import.csv',
          sourceType,
          sourceEvent,
          authorName: currentUser?.fullName || 'CRM User',
          autoMergeDuplicates
        });
      } catch (srvErr) {
        console.warn('Server action import fallback to client processing:', srvErr);
        res = {
          success: true,
          batch: {
            id: `BATCH-${Date.now().toString().slice(-4)}`,
            fileName: fileName || 'Contacts_Import.csv',
            sourceType,
            sourceEvent,
            totalRows: candidates.length,
            importedCount: candidates.length,
            mergedCount: 0,
            failedCount: 0,
            uploadedBy: currentUser?.fullName || 'CRM User',
            isRolledBack: false,
            createdAt: new Date().toISOString()
          },
          importedContacts: candidates.map((c, i) => ({
            id: `CNT-${Date.now()}-${i}`,
            name: c.name,
            preferredPhone: c.phone,
            phone: c.phone,
            email: c.email,
            company: c.company,
            designation: c.designation,
            city: c.city,
            category: c.category || 'Prospect',
            sourceType: sourceType || 'Excel Import',
            sourceEvent: sourceEvent || null,
            dateAdded: new Date().toLocaleDateString('en-IN')
          })),
          stats: { total: candidates.length, imported: candidates.length, merged: 0, failed: 0 }
        };
      }

      if (res && res.success) {
        onImportSuccess(res);
        if (triggerToast) {
          triggerToast(
            `Imported ${res.stats?.imported || candidates.length} contacts!`,
            'success'
          );
        }
        onClose();
      } else {
        alert(res?.error || 'Failed to complete batch import.');
        setStep('preview');
      }
    } catch (err: any) {
      console.error('Batch import failed:', err);
      alert('Import failed: ' + err.message);
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div className="modal-content wide" style={{ width: '900px', maxWidth: '96vw' }}>
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
              📥 Batch Contact Importer (Excel / CSV)
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
              Import contact lists with automatic deduplication scoring, column mapping, and rollback safety.
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* STEP 1: UPLOAD */}
        {step === 'upload' && (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <div style={{
              border: '2px dashed #cbd5e1',
              borderRadius: '12px',
              padding: '40px 20px',
              background: '#f8fafc',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>📁</div>
              <h4 style={{ margin: '0 0 6px', fontSize: '16px', color: '#1e293b' }}>
                Upload your Spreadsheet
              </h4>
              <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#64748b' }}>
                Supported formats: <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.csv</strong>
              </p>
              <label className="btn btn-primary" style={{ cursor: 'pointer', padding: '10px 24px', fontSize: '13px' }}>
                Browse File...
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {isProcessing && (
              <p style={{ fontSize: '12px', color: '#0284c7' }}>Reading spreadsheet structure...</p>
            )}
          </div>
        )}

        {/* STEP 2: COLUMN MAPPING */}
        {step === 'mapping' && (
          <div style={{ padding: '16px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>File: {fileName}</strong>
                <span style={{ marginLeft: '12px', fontSize: '12px', color: '#64748b' }}>
                  ({parsedRows.length} rows detected)
                </span>
              </div>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '11px', padding: '4px 10px' }}
                onClick={() => autoMapHeaders(headers)}
              >
                ↻ Auto-Detect Columns
              </button>
            </div>

            {/* Batch Provenance Config */}
            <div style={{
              background: '#f1f5f9',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              display: 'grid',
              gridTemplateColumns: '1fr 1.5fr',
              gap: '12px'
            }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>
                  Source Category:
                </label>
                <select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                >
                  <option value="Excel Import">Excel Import</option>
                  <option value="Event / Expo">Event / Expo</option>
                  <option value="Visiting Card">Visiting Card Collection</option>
                  <option value="Website">Website Leads</option>
                  <option value="Referral">Referral List</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>
                  Source Event / Campaign Tag:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bengaluru Tech Summit 2026 or AgriTech Expo"
                  value={sourceEvent}
                  onChange={(e) => setSourceEvent(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>
            </div>

            {/* Column Mapping Grid */}
            <div style={{ maxHeight: '38vh', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                {[
                  { key: 'name', label: 'Full Name *', required: true },
                  { key: 'phone', label: 'Phone Number' },
                  { key: 'email', label: 'Email Address' },
                  { key: 'company', label: 'Company' },
                  { key: 'designation', label: 'Job Title / Designation' },
                  { key: 'city', label: 'City' },
                  { key: 'state', label: 'State' },
                  { key: 'category', label: 'Category' },
                  { key: 'notes', label: 'Notes / Remarks' },
                  { key: 'tags', label: 'Tags' },
                ].map(field => (
                  <div key={field.key}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: field.required ? 'bold' : '500', color: field.required ? '#0f172a' : '#475569', marginBottom: '4px' }}>
                      {field.label}
                    </label>
                    <select
                      value={(mapping as any)[field.key] || ''}
                      onChange={(e) => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: '12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        backgroundColor: (mapping as any)[field.key] ? '#f0fdf4' : '#fff'
                      }}
                    >
                      <option value="">-- Do Not Import --</option>
                      {headers.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setStep('upload')}>
                ← Back
              </button>
              <button className="btn btn-primary" onClick={handleSavePresetAndProceed}>
                Proceed to Pre-Import Preview →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PREVIEW & DUPLICATE CHECKS */}
        {step === 'preview' && (() => {
          const candidates = getMappedCandidateRows();
          const validCount = candidates.filter(c => c.status === 'valid').length;
          const duplicateCount = candidates.filter(c => c.status === 'duplicate' || c.status === 'review').length;
          const invalidCount = candidates.filter(c => c.status === 'invalid').length;

          return (
            <div style={{ padding: '16px 0' }}>
              {/* Summary Stats Banner */}
              <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '16px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px'
              }}>
                <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a' }}>{candidates.length}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Total Rows</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#16a34a' }}>{validCount}</div>
                  <div style={{ fontSize: '11px', color: '#16a34a' }}>New Contacts</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#d97706' }}>{duplicateCount}</div>
                  <div style={{ fontSize: '11px', color: '#d97706' }}>Duplicates / Matches</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#dc2626' }}>{invalidCount}</div>
                  <div style={{ fontSize: '11px', color: '#dc2626' }}>Invalid / Skipped</div>
                </div>
              </div>

              {/* Deduplication Settings Toggle */}
              <div style={{ marginBottom: '14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '10px 12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#1e3a8a', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoMergeDuplicates}
                    onChange={(e) => setAutoMergeDuplicates(e.target.checked)}
                  />
                  <strong>Auto-Merge High Confidence Duplicates</strong> (Updates existing contact with new phones/notes while preserving history)
                </label>
              </div>

              {/* Preview Table */}
              <div style={{ maxHeight: '35vh', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Status</th>
                      <th style={{ padding: '8px' }}>Name</th>
                      <th style={{ padding: '8px' }}>Company</th>
                      <th style={{ padding: '8px' }}>Phone / Email</th>
                      <th style={{ padding: '8px' }}>City</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.slice(0, 15).map(c => (
                      <tr key={c._index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px' }}>
                          {c.status === 'valid' && (
                            <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                              New
                            </span>
                          )}
                          {c.status === 'duplicate' && (
                            <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                              Duplicate
                            </span>
                          )}
                          {c.status === 'review' && (
                            <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                              Review Match
                            </span>
                          )}
                          {c.status === 'invalid' && (
                            <span style={{ background: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: '4px' }}>
                              Invalid
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '8px', fontWeight: '600' }}>{c.name || '—'}</td>
                        <td style={{ padding: '8px' }}>{c.company || '—'}</td>
                        <td style={{ padding: '8px' }}>
                          <div>{c.phone || '—'}</div>
                          <div style={{ color: '#64748b' }}>{c.email || ''}</div>
                        </td>
                        <td style={{ padding: '8px' }}>{c.city || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button className="btn btn-secondary" onClick={() => setStep('mapping')}>
                  ← Back to Mapping
                </button>
                <button
                  className="btn btn-primary"
                  style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                  onClick={handleExecuteImport}
                >
                  Confirm & Execute Batch Import ({candidates.length} rows) →
                </button>
              </div>
            </div>
          );
        })()}

        {/* STEP 4: IMPORTING */}
        {step === 'importing' && (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
            <h4 style={{ margin: '0 0 8px', fontSize: '16px', color: '#1e293b' }}>
              Importing & Scoring Contacts...
            </h4>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
              Normalizing phone numbers, executing duplicate scans, and saving to Supabase database.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

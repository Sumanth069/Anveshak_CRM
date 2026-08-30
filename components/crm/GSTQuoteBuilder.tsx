"use client";

import React, { useState, useEffect } from 'react';

// Anveshak Hub Official Brand Logo SVG
export const AnveshakLogo = ({ width = 140, height = 44 }: { width?: number; height?: number }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    <svg width="42" height="42" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ah-logo-grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
        <linearGradient id="ah-logo-grad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>
      {/* Letter A & H geometric polygon */}
      <path d="M 16 82 L 46 18 L 60 46 L 36 46 L 50 72 L 36 82 Z" fill="url(#ah-logo-grad1)" />
      <path d="M 46 18 L 62 18 L 86 82 L 70 82 L 60 56 L 46 56 Z" fill="url(#ah-logo-grad2)" />
      {/* Amber/Orange Connective Sunburst Dot */}
      <circle cx="53" cy="50" r="7.5" fill="#f97316" />
      <path d="M 38 50 L 68 50" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
    </svg>
    <div>
      <div style={{ fontWeight: '900', fontSize: '17px', letterSpacing: '-0.02em', color: '#0f172a', lineHeight: '1.1' }}>
        ANVESHAK <span style={{ color: '#0284c7' }}>HUB</span>
      </div>
      <div style={{ fontSize: '7.5px', fontWeight: '700', color: '#64748b', letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: '2px' }}>
        Ignite • Innovate • Imagine
      </div>
    </div>
  </div>
);

// Number to Indian Currency Words
export function numberToIndianWords(num: number): string {
  if (isNaN(num) || num === 0) return 'Rupees Zero Only';
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n: number): string => {
    let str = '';
    if (n > 19) {
      str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : ' ');
    } else {
      str += a[n];
    }
    return str;
  };

  let n = Math.floor(num);
  let crore = Math.floor(n / 10000000);
  n %= 10000000;
  let lakh = Math.floor(n / 100000);
  n %= 100000;
  let thousand = Math.floor(n / 1000);
  n %= 1000;
  let hundred = Math.floor(n / 100);
  let remaining = n % 100;

  let res = 'Rupees ';
  if (crore > 0) res += inWords(crore) + 'Crore ';
  if (lakh > 0) res += inWords(lakh) + 'Lakh ';
  if (thousand > 0) res += inWords(thousand) + 'Thousand ';
  if (hundred > 0) res += inWords(hundred) + 'Hundred ';
  if (remaining > 0) res += inWords(remaining);
  res += 'Only';
  return res.replace(/\s+/g, ' ').trim();
}

interface Lead {
  id: string;
  name: string;
  company: string;
}

interface Deal {
  id: string;
  name: string;
  company: string;
  stage: string;
}

export interface QuoteItem {
  id: string;
  description: string;
  sac?: string;
  qty: number;
  price: number;
  gst: number;
}

export interface Quote {
  id: string;
  docType?: 'Tax Invoice' | 'Quotation' | 'Pro-forma Invoice';
  dealId?: string;
  company: string;
  contact: string;
  clientAddress?: string;
  clientGstin?: string;
  clientState?: string;
  clientStateCode?: string;
  invoiceNo?: string;
  reverseCharge?: string;
  gstType: 'intra' | 'inter';
  items: QuoteItem[];
  termsAndConditions: string;
  status: 'Draft' | 'Pending Approval' | 'Accepted' | 'Rejected';
  totalAmount: number;
  createdAt: string;
}

export interface ExternalDocument {
  id: string;
  title: string;
  documentType: 'Tax Invoice' | 'Vendor Quotation' | 'GST PMT-06 Challan' | 'Purchase Order' | 'Contract' | 'Other';
  company: string;
  amount?: number;
  date: string;
  fileName: string;
  fileDataUrl?: string;
  fileType?: string;
  notes?: string;
  uploadedAt: string;
}

interface TermsTemplate {
  id: string;
  name: string;
  content: string;
}

interface GSTQuoteBuilderProps {
  leads: Lead[];
  deals: Deal[];
  quotes: Quote[];
  termsTemplates: TermsTemplate[];
  onSaveQuote: (quote: Quote) => void;
  onDeleteQuote: (id: string) => void;
  onOpenPortalSandbox: (quote: Quote) => void;
  formatCurrency: (val: number) => string;
}

export default function GSTQuoteBuilder({
  leads,
  deals,
  quotes,
  termsTemplates,
  onSaveQuote,
  onDeleteQuote,
  onOpenPortalSandbox,
  formatCurrency
}: GSTQuoteBuilderProps) {
  const [subView, setSubView] = useState<'repository' | 'externalDocs' | 'builder'>('repository');
  const [wizardStep, setWizardStep] = useState(1);

  // Wizard State
  const [docType, setDocType] = useState<'Tax Invoice' | 'Quotation' | 'Pro-forma Invoice'>('Tax Invoice');
  const [invoiceNo, setInvoiceNo] = useState(`04/${new Date().getFullYear().toString().slice(-2)}-${(new Date().getFullYear()+1).toString().slice(-2)}`);
  const [linkedDealId, setLinkedDealId] = useState('');
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientGstin, setClientGstin] = useState('');
  const [clientState, setClientState] = useState('Tamilnadu');
  const [clientStateCode, setClientStateCode] = useState('33');
  const [reverseCharge, setReverseCharge] = useState('N');
  const [gstType, setGstType] = useState<'intra' | 'inter'>('inter');
  const [selectedTermsId, setSelectedTermsId] = useState(termsTemplates[0]?.id || '');
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);

  // Item Temp Fields
  const [itemDesc, setItemDesc] = useState('');
  const [itemSac, setItemSac] = useState('999293');
  const [itemQty, setItemQty] = useState(1);
  const [itemPrice, setItemPrice] = useState(90000);
  const [itemGst, setItemGst] = useState(18);

  // External Documents Repository
  const [externalDocs, setExternalDocs] = useState<ExternalDocument[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newDocForm, setNewDocForm] = useState<{
    title: string;
    documentType: ExternalDocument['documentType'];
    company: string;
    amount: string;
    date: string;
    notes: string;
    file: File | null;
    fileDataUrl: string;
    fileName: string;
  }>({
    title: '',
    documentType: 'Tax Invoice',
    company: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    file: null,
    fileDataUrl: '',
    fileName: ''
  });

  // Load external docs from localStorage / DB
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ANVESHAK_EXTERNAL_DOCS');
      if (saved) {
        setExternalDocs(JSON.parse(saved));
      } else {
        const seedDocs: ExternalDocument[] = [
          {
            id: 'DOC-EXT-001',
            title: 'Anveshak Tax Invoice (Tamil Nadu Dev Centre)',
            documentType: 'Tax Invoice',
            company: 'Tamilnadu Tech Dev & Promotion Centre',
            amount: 106200,
            date: '2026-08-06',
            fileName: 'Invoice_04_26-27_TamilnaduTech.pdf',
            notes: 'Agentic AI Online Workshop 10-day batch',
            uploadedAt: '06/08/2026'
          },
          {
            id: 'DOC-EXT-002',
            title: 'Form GST PMT-06 Payment Challan (May Return)',
            documentType: 'GST PMT-06 Challan',
            company: 'Government of India / GST Portal',
            amount: 143974,
            date: '2026-06-18',
            fileName: 'GST_Challan_PMT06_26062900234082.pdf',
            notes: 'CPIN 26062900234082 - CGST & SGST payment receipt',
            uploadedAt: '18/06/2026'
          }
        ];
        setExternalDocs(seedDocs);
        localStorage.setItem('ANVESHAK_EXTERNAL_DOCS', JSON.stringify(seedDocs));
      }
    } catch (e) {}
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setNewDocForm(prev => ({
        ...prev,
        file,
        fileName: file.name,
        fileDataUrl: reader.result as string,
        title: prev.title || file.name.replace(/\.[^/.]+$/, "")
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveExternalDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocForm.title || !newDocForm.company) {
      alert('Please fill out the document title and company name.');
      return;
    }

    const newDoc: ExternalDocument = {
      id: `DOC-EXT-${Date.now().toString().slice(-4)}`,
      title: newDocForm.title,
      documentType: newDocForm.documentType,
      company: newDocForm.company,
      amount: newDocForm.amount ? Number(newDocForm.amount) : undefined,
      date: newDocForm.date || new Date().toISOString().split('T')[0],
      fileName: newDocForm.fileName || `${newDocForm.title}.pdf`,
      fileDataUrl: newDocForm.fileDataUrl,
      notes: newDocForm.notes,
      uploadedAt: new Date().toLocaleDateString('en-IN')
    };

    const updated = [newDoc, ...externalDocs];
    setExternalDocs(updated);
    localStorage.setItem('ANVESHAK_EXTERNAL_DOCS', JSON.stringify(updated));

    // Reset form
    setNewDocForm({
      title: '',
      documentType: 'Tax Invoice',
      company: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      file: null,
      fileDataUrl: '',
      fileName: ''
    });
    setShowUploadModal(false);
  };

  const handleDeleteExternalDoc = (id: string) => {
    if (!confirm('Are you sure you want to delete this document from the repository?')) return;
    const updated = externalDocs.filter(d => d.id !== id);
    setExternalDocs(updated);
    localStorage.setItem('ANVESHAK_EXTERNAL_DOCS', JSON.stringify(updated));
  };

  const handleAddLineItem = () => {
    if (!itemDesc) return;
    const newItem: QuoteItem = {
      id: `ITEM-${Date.now().toString().slice(-4)}`,
      description: itemDesc,
      sac: itemSac || '999293',
      qty: itemQty,
      price: itemPrice,
      gst: itemGst
    };
    setQuoteItems([...quoteItems, newItem]);
    setItemDesc('');
    setItemQty(1);
    setItemPrice(0);
  };

  const handleRemoveLineItem = (id: string) => {
    setQuoteItems(quoteItems.filter(i => i.id !== id));
  };

  const handleFinalizeAndSave = () => {
    if (!company || !contact) {
      alert('Please fill out the client company and contact name.');
      return;
    }
    if (quoteItems.length === 0) {
      alert('Please add at least one line item to the proposal.');
      return;
    }

    const templateContent = termsTemplates.find(t => t.id === selectedTermsId)?.content || '';
    const taxableSubtotal = quoteItems.reduce((acc, curr) => acc + (curr.qty * curr.price), 0);
    const taxAmt = taxableSubtotal * 0.18;
    const totalAmount = taxableSubtotal + taxAmt;

    const newQuote: Quote = {
      id: `AH-QTE-${Date.now().toString().slice(-4)}`,
      docType,
      invoiceNo: invoiceNo || `04/${new Date().getFullYear().toString().slice(-2)}-${(new Date().getFullYear()+1).toString().slice(-2)}`,
      dealId: linkedDealId || undefined,
      company,
      contact,
      clientAddress,
      clientGstin,
      clientState,
      clientStateCode,
      reverseCharge,
      gstType,
      items: quoteItems,
      termsAndConditions: templateContent,
      status: 'Pending Approval',
      totalAmount,
      createdAt: new Date().toLocaleDateString('en-IN')
    };

    onSaveQuote(newQuote);

    // Reset state
    setLinkedDealId('');
    setCompany('');
    setContact('');
    setClientAddress('');
    setClientGstin('');
    setQuoteItems([]);
    setWizardStep(1);
    setSubView('repository');
  };

  return (
    <div className="panel-card animate-fade" style={{ padding: '0', background: '#ffffff', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      {/* Top Banner Header with Anveshak Hub Logo */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '24px', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: '#ffffff', padding: '8px 14px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            <AnveshakLogo />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#ffffff' }}>Commercial Quotes & Tax Invoices</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
              Official GST-compliant billing engine, Form PMT-06 challans & document repository
            </p>
          </div>
        </div>

        {/* View Switcher Controls (Mobile Optimized) */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            className={`btn ${subView === 'repository' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ padding: '8px 14px', fontSize: '12px', fontWeight: '700' }}
            onClick={() => setSubView('repository')}
          >
            📋 Generated Proposals ({quotes.length})
          </button>
          <button 
            className={`btn ${subView === 'externalDocs' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ padding: '8px 14px', fontSize: '12px', fontWeight: '700' }}
            onClick={() => setSubView('externalDocs')}
          >
            📁 External Invoices & Challans ({externalDocs.length})
          </button>
          <button 
            className="btn btn-primary" 
            style={{ padding: '8px 16px', fontSize: '12px', fontWeight: '800', background: 'linear-gradient(135deg, #059669, #10b981)', borderColor: '#059669' }}
            onClick={() => {
              setSubView('builder');
              setWizardStep(1);
            }}
          >
            + Create New GST Proposal
          </button>
        </div>
      </div>

      <div style={{ padding: '24px' }}>
        {/* SUB-VIEW 1: BUILDER WIZARD */}
        {subView === 'builder' && (
          <div className="animate-fade">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: '800', margin: 0, color: '#0f172a' }}>
                  {wizardStep === 1 ? 'Step 1: Document & Client Information' : wizardStep === 2 ? 'Step 2: Line Items & HSN/SAC Breakdown' : 'Step 3: Review & Terms'}
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Configure GST rates, customer tax identity, and service breakdown</span>
              </div>
              <button className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={() => setSubView('repository')}>
                ✕ Cancel & Back
              </button>
            </div>

            {wizardStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                  <div className="form-group">
                    <label>Document Nature *</label>
                    <select value={docType} onChange={(e) => setDocType(e.target.value as any)}>
                      <option value="Tax Invoice">Tax Invoice (Official GST Invoice)</option>
                      <option value="Quotation">Quotation (Commercial Proposal)</option>
                      <option value="Pro-forma Invoice">Pro-forma Invoice</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Invoice / Quote Number *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. 04/26-27 or AH-QTE-2026-001" 
                      value={invoiceNo} 
                      onChange={(e) => setInvoiceNo(e.target.value)} 
                    />
                  </div>

                  <div className="form-group">
                    <label>Reverse Charge (Y/N)</label>
                    <select value={reverseCharge} onChange={(e) => setReverseCharge(e.target.value)}>
                      <option value="N">N (No)</option>
                      <option value="Y">Y (Yes)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                  <div className="form-group">
                    <label>Client Organization Name (Bill To) *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Tamilnadu Tech Dev & Promotion Centre" 
                      value={company} 
                      onChange={(e) => setCompany(e.target.value)} 
                    />
                  </div>

                  <div className="form-group">
                    <label>Attention / Contact Person *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Dr. K. Soundrapandi" 
                      value={contact} 
                      onChange={(e) => setContact(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Client Billing Address *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 98/1, Velacherry Main Road, Guindy, Chennai, Tamil Nadu, 600032" 
                    value={clientAddress} 
                    onChange={(e) => setClientAddress(e.target.value)} 
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                  <div className="form-group">
                    <label>Client GSTIN</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 33AABAT1588L1Z7" 
                      value={clientGstin} 
                      onChange={(e) => setClientGstin(e.target.value.toUpperCase())} 
                    />
                  </div>

                  <div className="form-group">
                    <label>Client State</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Tamilnadu or Karnataka" 
                      value={clientState} 
                      onChange={(e) => setClientState(e.target.value)} 
                    />
                  </div>

                  <div className="form-group">
                    <label>State Code</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 33 (TN), 29 (KA)" 
                      value={clientStateCode} 
                      onChange={(e) => setClientStateCode(e.target.value)} 
                    />
                  </div>

                  <div className="form-group">
                    <label>GST Supply Type *</label>
                    <select value={gstType} onChange={(e) => setGstType(e.target.value as any)}>
                      <option value="intra">Intra-State (CGST 9% + SGST 9%) - Karnataka (29)</option>
                      <option value="inter">Inter-State (IGST 18%) - Outside Karnataka</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ padding: '10px 24px', fontWeight: '700' }}
                    onClick={() => {
                      if (!company || !contact) {
                        alert('Please enter client organization name and attention contact.');
                        return;
                      }
                      setWizardStep(2);
                    }}
                  >
                    Next: Add Particulars & HSN Codes →
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Line Item Adder Form */}
                <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>+ Add Itemized Service / Product</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label>Particulars / Scope Description *</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Program on Agentic AI Online Workshop Organised for 10 days" 
                        value={itemDesc} 
                        onChange={(e) => setItemDesc(e.target.value)} 
                      />
                    </div>
                    <div className="form-group">
                      <label>SAC / HSN Code</label>
                      <input 
                        type="text" 
                        placeholder="999293" 
                        value={itemSac} 
                        onChange={(e) => setItemSac(e.target.value)} 
                      />
                    </div>
                    <div className="form-group">
                      <label>Qty / Days</label>
                      <input 
                        type="number" 
                        min="1" 
                        value={itemQty} 
                        onChange={(e) => setItemQty(Number(e.target.value) || 1)} 
                      />
                    </div>
                    <div className="form-group">
                      <label>Taxable Rate (₹)</label>
                      <input 
                        type="number" 
                        min="0" 
                        value={itemPrice} 
                        onChange={(e) => setItemPrice(Number(e.target.value) || 0)} 
                      />
                    </div>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      style={{ height: '38px', fontWeight: '700', minWidth: '100px' }}
                      onClick={handleAddLineItem}
                    >
                      + Add Item
                    </button>
                  </div>
                </div>

                {/* Items Table */}
                <div className="custom-table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>S.No</th>
                        <th>Particulars</th>
                        <th>SAC Code</th>
                        <th>Qty</th>
                        <th>Taxable Value</th>
                        <th>GST Rate</th>
                        <th>Total (₹)</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quoteItems.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                            No items added yet. Use the form above to add particulars.
                          </td>
                        </tr>
                      ) : (
                        quoteItems.map((item, idx) => {
                          const rowTaxable = item.qty * item.price;
                          const rowGst = rowTaxable * (item.gst / 100);
                          return (
                            <tr key={item.id}>
                              <td style={{ fontWeight: '700', textAlign: 'center' }}>{idx + 1}</td>
                              <td><strong>{item.description}</strong></td>
                              <td><span className="badge badge-cold">{item.sac || '999293'}</span></td>
                              <td>{item.qty}</td>
                              <td>{formatCurrency(rowTaxable)}</td>
                              <td>{item.gst}%</td>
                              <td style={{ fontWeight: '800', color: '#047857' }}>{formatCurrency(rowTaxable + rowGst)}</td>
                              <td>
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ color: '#dc2626', borderColor: '#fca5a5', padding: '3px 8px', fontSize: '11px' }}
                                  onClick={() => handleRemoveLineItem(item.id)}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Live Grand Total & Number to Words */}
                {quoteItems.length > 0 && (() => {
                  const subtotal = quoteItems.reduce((acc, curr) => acc + (curr.qty * curr.price), 0);
                  const cgst = gstType === 'intra' ? subtotal * 0.09 : 0;
                  const sgst = gstType === 'intra' ? subtotal * 0.09 : 0;
                  const igst = gstType === 'inter' ? subtotal * 0.18 : 0;
                  const grandTotal = subtotal + cgst + sgst + igst;

                  return (
                    <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span>Total Amount before Tax:</span>
                        <strong>{formatCurrency(subtotal)}</strong>
                      </div>
                      {gstType === 'intra' ? (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b' }}>
                            <span>Add: CGST (9%):</span>
                            <span>{formatCurrency(cgst)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b' }}>
                            <span>Add: SGST (9%):</span>
                            <span>{formatCurrency(sgst)}</span>
                          </div>
                        </>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b' }}>
                          <span>Add: IGST (18%):</span>
                          <span>{formatCurrency(igst)}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '800', color: '#047857', borderTop: '2px solid #cbd5e1', paddingTop: '10px', marginTop: '4px' }}>
                        <span>Total Amount after Tax (Grand Total):</span>
                        <span>{formatCurrency(grandTotal)}</span>
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#1e40af', background: '#eff6ff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #bfdbfe', marginTop: '4px' }}>
                        <strong>Amount in Words: </strong> {numberToIndianWords(grandTotal)}
                      </div>
                    </div>
                  );
                })()}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                  <button className="btn btn-secondary" onClick={() => setWizardStep(1)}>
                    ← Back to Step 1
                  </button>
                  <button 
                    className="btn btn-primary" 
                    style={{ padding: '10px 24px', fontWeight: '800', background: 'linear-gradient(135deg, #059669, #10b981)' }}
                    onClick={handleFinalizeAndSave}
                  >
                    ✓ Finalize & Generate Document
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUB-VIEW 2: GENERATED PROPOSALS REPOSITORY */}
        {subView === 'repository' && (
          <div className="animate-fade">
            {quotes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>No Proposals or Invoices Generated</h3>
                <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '440px', margin: '0 auto 20px auto' }}>
                  Generate your first official GST Tax Invoice or Proposal with Anveshak Hub branding and HSN breakdown.
                </p>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '10px 20px', fontWeight: '700' }}
                  onClick={() => {
                    setSubView('builder');
                    setWizardStep(1);
                  }}
                >
                  + Create New Proposal
                </button>
              </div>
            ) : (
              <div className="custom-table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Document ID</th>
                      <th>Type</th>
                      <th>Client Organization</th>
                      <th>Contact Person</th>
                      <th>GST Supply</th>
                      <th>Total Value</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map(quote => (
                      <tr key={quote.id}>
                        <td style={{ fontWeight: '800', color: '#0f172a' }}>{quote.id}</td>
                        <td>
                          <span className="badge badge-cold" style={{ fontWeight: '700' }}>
                            {quote.docType || 'Tax Invoice'}
                          </span>
                        </td>
                        <td><strong>{quote.company}</strong></td>
                        <td>{quote.contact}</td>
                        <td>{quote.gstType === 'intra' ? 'Intra-State (KA)' : 'Inter-State (IGST)'}</td>
                        <td style={{ fontWeight: '800', color: '#047857' }}>{formatCurrency(quote.totalAmount)}</td>
                        <td>
                          <span className={`badge ${quote.status === 'Accepted' ? 'badge-hot' : quote.status === 'Rejected' ? 'badge-cold' : 'badge-warm'}`}>
                            {quote.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '5px 10px', fontSize: '11.5px', fontWeight: '700', color: '#1e40af', background: '#eff6ff', borderColor: '#bfdbfe' }}
                              onClick={() => onOpenPortalSandbox(quote)}
                            >
                              👁️ View & Print
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '5px 8px', fontSize: '11px', color: '#dc2626', borderColor: '#fca5a5' }}
                              onClick={() => onDeleteQuote(quote.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SUB-VIEW 3: EXTERNAL DOCUMENTS & CHALLANS REPOSITORY */}
        {subView === 'externalDocs' && (
          <div className="animate-fade">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: '800', margin: 0, color: '#0f172a' }}>External Invoices, Challans & Contracts</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Store and reference supplier invoices, Form GST PMT-06 tax receipts, and customer POs</span>
              </div>
              <button 
                className="btn btn-primary" 
                style={{ padding: '8px 16px', fontWeight: '700' }}
                onClick={() => setShowUploadModal(true)}
              >
                + Upload External Document
              </button>
            </div>

            {externalDocs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>No External Documents in Repository</h3>
                <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '440px', margin: '0 auto 20px auto' }}>
                  Upload vendor invoices, GST payment receipts (PMT-06), or client purchase orders to maintain a unified repository.
                </p>
                <button 
                  className="btn btn-primary" 
                  style={{ padding: '10px 20px', fontWeight: '700' }}
                  onClick={() => setShowUploadModal(true)}
                >
                  + Upload Document Now
                </button>
              </div>
            ) : (
              <div className="custom-table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Document Title</th>
                      <th>Category</th>
                      <th>Company / Entity</th>
                      <th>Amount</th>
                      <th>Doc Date</th>
                      <th>File Name</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {externalDocs.map(doc => (
                      <tr key={doc.id}>
                        <td>
                          <div style={{ fontWeight: '700', color: '#0f172a' }}>{doc.title}</div>
                          {doc.notes && <span style={{ fontSize: '11px', color: '#64748b' }}>{doc.notes}</span>}
                        </td>
                        <td>
                          <span className={`badge ${doc.documentType.includes('Challan') ? 'badge-hot' : 'badge-cold'}`} style={{ fontWeight: '700' }}>
                            {doc.documentType}
                          </span>
                        </td>
                        <td><strong>{doc.company}</strong></td>
                        <td style={{ fontWeight: '700' }}>{doc.amount ? formatCurrency(doc.amount) : '—'}</td>
                        <td>{doc.date}</td>
                        <td>
                          <span style={{ fontSize: '11.5px', color: '#0284c7', textDecoration: 'underline' }}>
                            📄 {doc.fileName}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '4px 8px', fontSize: '11px', color: '#1e40af', borderColor: '#bfdbfe', background: '#eff6ff' }}
                              onClick={() => {
                                if (doc.fileDataUrl) {
                                  const win = window.open();
                                  win?.document.write(`<iframe src="${doc.fileDataUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                                } else {
                                  alert(`Opening document ${doc.fileName}`);
                                }
                              }}
                            >
                              View File
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '4px 8px', fontSize: '11px', color: '#dc2626', borderColor: '#fca5a5' }}
                              onClick={() => handleDeleteExternalDoc(doc.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: UPLOAD EXTERNAL DOCUMENT */}
      {showUploadModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📁</span>
                <h3>Upload External Invoice or Challan</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowUploadModal(false)}>×</button>
            </div>

            <form onSubmit={handleSaveExternalDoc} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label>Document Title *</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. GST Challan PMT-06 May 2026 or Vendor Invoice" 
                  value={newDocForm.title} 
                  onChange={(e) => setNewDocForm({ ...newDocForm, title: e.target.value })} 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Document Category *</label>
                  <select 
                    value={newDocForm.documentType} 
                    onChange={(e) => setNewDocForm({ ...newDocForm, documentType: e.target.value as any })}
                  >
                    <option value="Tax Invoice">Tax Invoice</option>
                    <option value="GST PMT-06 Challan">GST PMT-06 Payment Challan</option>
                    <option value="Vendor Quotation">Vendor Quotation</option>
                    <option value="Purchase Order">Purchase Order (PO)</option>
                    <option value="Contract">Agreement / Contract</option>
                    <option value="Other">Other Document</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Company / Authority *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Tamilnadu Tech or GST Portal" 
                    value={newDocForm.company} 
                    onChange={(e) => setNewDocForm({ ...newDocForm, company: e.target.value })} 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Monetary Amount (₹ Optional)</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 143974" 
                    value={newDocForm.amount} 
                    onChange={(e) => setNewDocForm({ ...newDocForm, amount: e.target.value })} 
                  />
                </div>

                <div className="form-group">
                  <label>Document Date *</label>
                  <input 
                    type="date" 
                    required 
                    value={newDocForm.date} 
                    onChange={(e) => setNewDocForm({ ...newDocForm, date: e.target.value })} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Select File (PDF, PNG, JPG) *</label>
                <input 
                  type="file" 
                  accept=".pdf,image/*" 
                  onChange={handleFileUpload} 
                  required 
                  style={{ padding: '8px', border: '1px dashed #cbd5e1', borderRadius: '8px', background: '#f8fafc' }}
                />
                {newDocForm.fileName && (
                  <span style={{ fontSize: '11.5px', color: '#0284c7', marginTop: '4px', display: 'block' }}>
                    Selected: {newDocForm.fileName}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label>Notes / References (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. CPIN 26062900234082" 
                  value={newDocForm.notes} 
                  onChange={(e) => setNewDocForm({ ...newDocForm, notes: e.target.value })} 
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowUploadModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px', fontWeight: '700' }}>Save to Repository</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

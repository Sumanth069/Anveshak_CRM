import React, { useState } from 'react';

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

interface QuoteItem {
  id: string;
  description: string;
  qty: number;
  price: number;
  gst: number;
}

interface Quote {
  id: string;
  dealId?: string;
  company: string;
  contact: string;
  gstType: 'intra' | 'inter';
  items: QuoteItem[];
  termsAndConditions: string;
  status: 'Draft' | 'Pending Approval' | 'Accepted' | 'Rejected';
  totalAmount: number;
  createdAt: string;
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
  const [subView, setSubView] = useState<'builder' | 'repository'>('repository');
  const [wizardStep, setWizardStep] = useState(1);

  // Wizard Fields
  const [linkedDealId, setLinkedDealId] = useState('');
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [gstType, setGstType] = useState<'intra' | 'inter'>('intra');
  const [selectedTermsId, setSelectedTermsId] = useState(termsTemplates[0]?.id || '');
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);

  // Item Temp Fields
  const [itemDesc, setItemDesc] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [itemPrice, setItemPrice] = useState(0);
  const [itemGst, setItemGst] = useState(18);

  const handleAddLineItem = () => {
    if (!itemDesc) return;
    const newItem: QuoteItem = {
      id: `ITEM-${Date.now().toString().slice(-4)}`,
      description: itemDesc,
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
      alert('Please fill out the client company and contact attention name.');
      return;
    }
    if (quoteItems.length === 0) {
      alert('Please add at least one line item to the quotation.');
      return;
    }

    const templateContent = termsTemplates.find(t => t.id === selectedTermsId)?.content || '';
    const newQuote: Quote = {
      id: `QTE-${Date.now().toString().slice(-4)}`,
      dealId: linkedDealId || undefined,
      company,
      contact,
      gstType,
      items: quoteItems,
      termsAndConditions: templateContent,
      status: 'Pending Approval',
      totalAmount: quoteItems.reduce((acc, curr) => acc + (curr.qty * curr.price), 0),
      createdAt: new Date().toLocaleDateString('en-IN')
    };

    onSaveQuote(newQuote);
    alert(`Quotation ${newQuote.id} created and marked as Pending client approval!`);
    
    // Reset state
    setLinkedDealId('');
    setCompany('');
    setContact('');
    setQuoteItems([]);
    setWizardStep(1);
    setSubView('repository');
  };

  return (
    <div className="panel-card animate-fade">
      {/* Header with Sub-tabs */}
      <div className="page-header-row" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px', padding: '20px 20px 0 20px' }}>
        <div className="page-title-text">
          <h2>Quotations & Invoices</h2>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`btn ${subView === 'builder' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => {
              setSubView('builder');
              setWizardStep(1);
            }}
          >
            + Draft New Quote
          </button>
          <button 
            className={`btn ${subView === 'repository' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => setSubView('repository')}
          >
            📂 Quote Repository ({quotes.length})
          </button>
        </div>
      </div>

      <div style={{ padding: '0 20px 20px 20px' }}>
        {/* Sub-view 1: Wizard Builder */}
        {subView === 'builder' && (
          <div>
            {/* Wizard Step Stepper */}
            <div className="quote-wizard-stepper" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '24px' }}>
              <div style={{ flex: 1, padding: '8px', borderBottom: '3px solid', borderColor: wizardStep >= 1 ? 'var(--primary)' : 'var(--border-color)', textAlign: 'center', fontWeight: 'bold', fontSize: '12px', color: wizardStep >= 1 ? 'var(--primary)' : 'var(--text-muted)' }}>
                1. Context & GST Config
              </div>
              <div style={{ flex: 1, padding: '8px', borderBottom: '3px solid', borderColor: wizardStep >= 2 ? 'var(--primary)' : 'var(--border-color)', textAlign: 'center', fontWeight: 'bold', fontSize: '12px', color: wizardStep >= 2 ? 'var(--primary)' : 'var(--text-muted)' }}>
                2. Terms Template
              </div>
              <div style={{ flex: 1, padding: '8px', borderBottom: '3px solid', borderColor: wizardStep >= 3 ? 'var(--primary)' : 'var(--border-color)', textAlign: 'center', fontWeight: 'bold', fontSize: '12px', color: wizardStep >= 3 ? 'var(--primary)' : 'var(--text-muted)' }}>
                3. Line Items Matrix & Save
              </div>
            </div>

            {/* Step 1 Content */}
            {wizardStep === 1 && (
              <div className="animate-fade" style={{ maxWidth: '600px' }}>
                <div className="form-group">
                  <label>Associate with Active Deal *</label>
                  <select 
                    value={linkedDealId} 
                    onChange={(e) => {
                      const dealId = e.target.value;
                      setLinkedDealId(dealId);
                      const deal = deals.find(d => d.id === dealId);
                      if (deal) {
                        setCompany(deal.company);
                        const contact = leads.find(l => l.company === deal.company);
                        setContact(contact ? contact.name : 'Ramesh Gowda');
                      }
                    }}
                  >
                    <option value="">-- Standalone Quote (No Deal Link) --</option>
                    {deals.filter(d => d.stage !== 'Won' && d.stage !== 'Lost').map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.company})</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  <div className="form-group">
                    <label>Client Entity (Company)</label>
                    <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Attention Contact Name</label>
                    <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="gst-transaction-select">GST Transaction Type *</label>
                  <select id="gst-transaction-select" value={gstType} onChange={(e) => setGstType(e.target.value as any)}>
                    <option value="intra">Intra-State Karnataka (CGST 9% + SGST 9%)</option>
                    <option value="inter">Inter-State Out-of-State (IGST 18%)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                  <button className="btn btn-primary" onClick={() => setWizardStep(2)}>
                    Next: Terms Template →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2 Content */}
            {wizardStep === 2 && (
              <div className="animate-fade" style={{ maxWidth: '600px' }}>
                <div className="form-group">
                  <label>Select Terms & Conditions Template *</label>
                  <select 
                    value={selectedTermsId} 
                    onChange={(e) => setSelectedTermsId(e.target.value)}
                  >
                    {termsTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', background: '#f8fafc', maxHeight: '200px', overflowY: 'auto', fontSize: '12.5px', whiteSpace: 'pre-wrap', marginBottom: '20px' }}>
                  <strong>Selected Template Content preview:</strong>
                  <div style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
                    {termsTemplates.find(t => t.id === selectedTermsId)?.content || 'No template selected.'}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                  <button className="btn btn-secondary" onClick={() => setWizardStep(1)}>← Back</button>
                  <button className="btn btn-primary" onClick={() => setWizardStep(3)}>Next: Line Items Matrix →</button>
                </div>
              </div>
            )}

            {/* Step 3 Content */}
            {wizardStep === 3 && (
              <div className="animate-fade">
                <h4 style={{ fontSize: '13px', marginBottom: '8px' }}>Create Commercial Quote Items Table:</h4>
                
                {/* Form to append Line Items */}
                <div className="quote-item-add-box">
                  <div className="form-group" style={{ margin: 0, width: '100%' }}>
                    <label style={{ fontSize: '10.5px' }}>Item / Service Description</label>
                    <input type="text" value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} placeholder="e.g. Enterprise License" style={{ width: '100%' }} />
                  </div>
                  <div className="quote-item-inputs-row">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '10.5px' }}>Qty</label>
                      <input type="number" value={itemQty} onChange={(e) => setItemQty(Number(e.target.value))} style={{ width: '100%' }} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '10.5px' }}>Unit Price (INR)</label>
                      <input type="number" value={itemPrice} onChange={(e) => setItemPrice(Number(e.target.value))} style={{ width: '100%' }} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '10.5px' }}>GST Rate</label>
                      <select value={itemGst} onChange={(e) => setItemGst(Number(e.target.value))} style={{ width: '100%' }}>
                        <option value={18}>18% Std</option>
                        <option value={12}>12% Red</option>
                        <option value={5}>5% Merch</option>
                        <option value={0}>0% Exm</option>
                      </select>
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={handleAddLineItem} style={{ height: '38px', minWidth: '90px' }}>+ Add Row</button>
                </div>

                {/* Added Items: Desktop Table View */}
                <div className="desktop-only-table">
                  <table className="custom-table" style={{ marginBottom: '20px' }}>
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th>GST</th>
                        <th>Subtotal</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quoteItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No items added yet. Append items above.</td>
                        </tr>
                      ) : (
                        quoteItems.map(item => (
                          <tr key={item.id}>
                            <td>{item.description}</td>
                            <td>{item.qty}</td>
                            <td>{formatCurrency(item.price)}</td>
                            <td>{item.gst}%</td>
                            <td style={{ fontWeight: 'bold' }}>{formatCurrency(item.qty * item.price)}</td>
                            <td>
                              <button className="btn btn-secondary" style={{ color: 'var(--danger)', padding: '2px 8px', fontSize: '11px' }} onClick={() => handleRemoveLineItem(item.id)}>Remove</button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Added Items: Mobile Card List View */}
                <div className="mobile-only-cards" style={{ marginBottom: '20px' }}>
                  {quoteItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                      No items added yet. Append items above.
                    </div>
                  ) : (
                    quoteItems.map(item => (
                      <div key={item.id} className="quote-item-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <strong style={{ fontSize: '13px', color: '#0f172a' }}>{item.description}</strong>
                          <button className="btn btn-secondary" style={{ color: 'var(--danger)', borderColor: '#fee2e2', padding: '2px 8px', fontSize: '11px' }} onClick={() => handleRemoveLineItem(item.id)}>Remove</button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                          <span>Qty: {item.qty} × {formatCurrency(item.price)}</span>
                          <span>GST: {item.gst}%</span>
                        </div>
                        <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '13px', color: '#10b981', marginTop: '2px' }}>
                          Subtotal: {formatCurrency(item.qty * item.price)}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', gap: '10px' }}>
                  <button className="btn btn-secondary" onClick={() => setWizardStep(2)}>← Back</button>
                  <button className="btn btn-primary" onClick={handleFinalizeAndSave} style={{ backgroundColor: '#10b981' }}>
                    ✔ Finalize & Save Quote
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sub-view 2: Repository Table & Mobile Cards */}
        {subView === 'repository' && (
          <>
            {quotes.length === 0 ? (
              <div className="panel-card animate-fade" style={{
                padding: '48px 24px',
                textAlign: 'center',
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px dashed #cbd5e1',
                margin: '20px 0'
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: '#eff6ff',
                  color: '#1e40af',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  margin: '0 auto 16px auto',
                  boxShadow: '0 4px 12px rgba(30, 64, 175, 0.1)'
                }}>
                  📄
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>
                  No Quotations Generated Yet
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '440px', margin: '0 auto 20px auto', lineHeight: '1.5' }}>
                  Build and deliver formal GST-compliant commercial proposals with itemized HSN breakdowns and corporate terms.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ padding: '10px 20px', fontSize: '13px' }}
                    onClick={() => {
                      setSubView('builder');
                      setWizardStep(1);
                    }}
                  >
                    + Create New Quotation →
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="desktop-only-table">
                  <div className="custom-table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Quote ID</th>
                          <th>Client Company</th>
                          <th>Attention</th>
                          <th>GST Type</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quotes.map(quote => (
                          <tr key={quote.id}>
                            <td style={{ fontWeight: 'bold' }}>{quote.id}</td>
                            <td>{quote.company}</td>
                            <td>{quote.contact}</td>
                            <td>{quote.gstType === 'intra' ? 'Intra-State' : 'Inter-State'}</td>
                            <td>
                              <span className={`badge ${quote.status === 'Accepted' ? 'badge-success' : quote.status === 'Rejected' ? 'badge-danger' : 'badge-warm'}`}>
                                {quote.status}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => onOpenPortalSandbox(quote)}>
                                  🌐 Open Portal Preview
                                </button>
                                <button className="btn btn-secondary" style={{ color: 'var(--danger)', padding: '4px 8px', fontSize: '11px' }} onClick={() => onDeleteQuote(quote.id)}>
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mobile-only-cards">
                  {quotes.map(quote => (
                    <div key={quote.id} className="mobile-contact-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '800', fontSize: '13px', color: '#0f172a' }}>{quote.id}</span>
                        <span className={`badge ${quote.status === 'Accepted' ? 'badge-success' : quote.status === 'Rejected' ? 'badge-danger' : 'badge-warm'}`} style={{ fontSize: '10.5px' }}>
                          {quote.status}
                        </span>
                      </div>

                      <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '3px', border: '1px solid var(--border-subtle)' }}>
                        <div>Client: <strong>{quote.company}</strong></div>
                        {quote.contact && <div style={{ color: 'var(--text-muted)' }}>Attn: {quote.contact}</div>}
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Type: {quote.gstType === 'intra' ? 'Intra-State GST' : 'Inter-State IGST'}</div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ fontSize: '11.5px', padding: '6px 8px', justifyContent: 'center', minHeight: '34px' }} 
                          onClick={() => onOpenPortalSandbox(quote)}
                        >
                          🌐 Portal Preview
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ color: 'var(--danger)', borderColor: '#fee2e2', padding: '6px 10px', minHeight: '34px' }} 
                          onClick={() => onDeleteQuote(quote.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

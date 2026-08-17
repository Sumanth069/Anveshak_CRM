"use client";

import React, { useState } from 'react';
import { normalizePhone } from '@/lib/phone';
import { logCommunicationAction } from '@/app/actions/contacts';

interface QuickCommModalProps {
  contact: {
    id: string;
    name: string;
    preferredPhone?: string | null;
    email?: string | null;
    company?: string | null;
    sourceEvent?: string | null;
    city?: string | null;
    doNotContact?: boolean | null;
    consentGiven?: boolean | null;
  };
  currentUser?: { fullName?: string; email?: string } | null;
  onClose: () => void;
  onCommunicationLogged: (comm: any) => void;
  triggerToast?: (msg: string, type: 'success' | 'warning' | 'info' | 'error') => void;
}

const TEMPLATES = [
  {
    id: 'intro',
    title: 'Introductory Follow-up',
    channel: 'WhatsApp',
    subject: 'Introduction - Anveshak Technologies',
    body: 'Hi [Name], it was great connecting with you from [Company]. I would love to share a quick overview of how Anveshak helps streamline operations. Looking forward to speaking soon.\n\nBest regards,\n[Your Name]'
  },
  {
    id: 'card_thank_you',
    title: 'Visiting Card Thank You',
    channel: 'WhatsApp',
    subject: 'Great meeting you at [Source/Place]',
    body: 'Hi [Name], thank you for sharing your visiting card at [Source/Place]. I wanted to follow up and see how we can collaborate with [Company]. When would be a good time for a quick 10-min call?\n\nWarm regards,\n[Your Name]'
  },
  {
    id: 'meeting_request',
    title: 'Meeting Request',
    channel: 'Email',
    subject: 'Exploratory Discussion - [Company] & Anveshak',
    body: 'Dear [Name],\n\nHope this message finds you well. Following up on our recent connection regarding [Company], I would like to schedule a brief 15-minute introductory call this week.\n\nPlease let me know what day and time works best for your schedule.\n\nSincerely,\n[Your Name]'
  },
  {
    id: 'proposal_followup',
    title: 'Proposal Follow-up',
    channel: 'Email',
    subject: 'Following Up on Commercial Proposal for [Company]',
    body: 'Dear [Name],\n\nI hope you are doing well. I am following up on the proposal sent recently for [Company]. Please let me know if you have any questions or need any clarifications.\n\nBest regards,\n[Your Name]'
  }
];

export default function QuickCommModal({
  contact,
  currentUser,
  onClose,
  onCommunicationLogged,
  triggerToast
}: QuickCommModalProps) {
  const [activeChannel, setActiveChannel] = useState<'WhatsApp' | 'Call' | 'Email' | 'Meeting'>('WhatsApp');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('card_thank_you');
  const [subject, setSubject] = useState<string>('Great meeting you');
  const [messageBody, setMessageBody] = useState<string>('');
  const [callNotes, setCallNotes] = useState<string>('');
  const [callDuration, setCallDuration] = useState<number>(5);
  const [overrideDoNotContact, setOverrideDoNotContact] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const authorName = currentUser?.fullName || 'Sales Representative';

  // Replace template tags
  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    let text = template.body;
    let sub = template.subject;
    const place = contact.sourceEvent || contact.city || 'our recent event';
    const comp = contact.company || 'your team';

    text = text.replace(/\[Name\]/g, contact.name);
    text = text.replace(/\[Your Name\]/g, authorName);
    text = text.replace(/\[Company\]/g, comp);
    text = text.replace(/\[Source\/Place\]/g, place);

    sub = sub.replace(/\[Name\]/g, contact.name);
    sub = sub.replace(/\[Company\]/g, comp);
    sub = sub.replace(/\[Source\/Place\]/g, place);

    setMessageBody(text);
    setSubject(sub);
  };

  React.useEffect(() => {
    const defaultTpl = TEMPLATES.find(t => t.id === selectedTemplateId) || TEMPLATES[0];
    applyTemplate(defaultTpl);
  }, [selectedTemplateId]);

  const normPhone = normalizePhone(contact.preferredPhone);
  const isBlocked = !!contact.doNotContact && !overrideDoNotContact;

  // 1. Dispatch WhatsApp
  const handleSendWhatsApp = async () => {
    if (isBlocked) {
      alert('This contact is marked DO NOT CONTACT. Please check the override box to proceed.');
      return;
    }
    if (!normPhone.isValid) {
      alert('Contact does not have a valid phone number for WhatsApp.');
      return;
    }

    const cleanNumber = normPhone.e164.replace(/\+/g, '');
    const encodedText = encodeURIComponent(messageBody);
    const waUrl = `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encodedText}`;

    // Auto-log communication in database
    setIsSubmitting(true);
    try {
      const res = await logCommunicationAction({
        contactId: contact.id,
        type: 'WhatsApp',
        direction: 'Outbound',
        subject: `WhatsApp: ${selectedTemplateId}`,
        notes: messageBody,
        templateUsed: selectedTemplateId,
        autoLogged: true,
        authorName
      });

      if (res.success && res.communication) {
        onCommunicationLogged(res.communication);
        if (triggerToast) triggerToast('WhatsApp logged to timeline & opened!', 'success');
      }
    } catch (err) {
      console.error('Error logging comm:', err);
    } finally {
      setIsSubmitting(false);
      window.open(waUrl, '_blank');
      onClose();
    }
  };

  // 2. Dispatch Email
  const handleSendEmail = async () => {
    if (isBlocked) {
      alert('This contact is marked DO NOT CONTACT.');
      return;
    }
    if (!contact.email) {
      alert('Contact does not have an email address.');
      return;
    }

    const mailtoUrl = `mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(messageBody)}`;

    setIsSubmitting(true);
    try {
      const res = await logCommunicationAction({
        contactId: contact.id,
        type: 'Email',
        direction: 'Outbound',
        subject,
        notes: messageBody,
        templateUsed: selectedTemplateId,
        autoLogged: true,
        authorName
      });

      if (res.success && res.communication) {
        onCommunicationLogged(res.communication);
        if (triggerToast) triggerToast('Email logged to timeline & opened!', 'success');
      }
    } catch (err) {
      console.error('Error logging comm:', err);
    } finally {
      setIsSubmitting(false);
      window.location.href = mailtoUrl;
      onClose();
    }
  };

  // 3. Dispatch Phone Call
  const handleLogCall = async (triggerDial = true) => {
    if (isBlocked) {
      alert('This contact is marked DO NOT CONTACT.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await logCommunicationAction({
        contactId: contact.id,
        type: 'Call',
        direction: 'Outbound',
        subject: `Phone Call (${callDuration} min)`,
        notes: callNotes || `Call completed with ${contact.name}.`,
        autoLogged: false,
        authorName
      });

      if (res.success && res.communication) {
        onCommunicationLogged(res.communication);
        if (triggerToast) triggerToast('Call logged to contact timeline!', 'success');
      }
    } catch (err) {
      console.error('Error logging call:', err);
    } finally {
      setIsSubmitting(false);
      if (triggerDial && normPhone.isValid) {
        window.location.href = `tel:${normPhone.e164}`;
      }
      onClose();
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ width: '640px', maxWidth: '95vw' }}>
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
              Quick Communication Hub
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
              Communicating with <strong>{contact.name}</strong> ({contact.company || 'No Company'})
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Do Not Contact Warning Banner */}
        {contact.doNotContact && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            padding: '12px',
            margin: '16px 0',
            fontSize: '12px',
            color: '#991b1b'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', marginBottom: '4px' }}>
              <span>⚠️ DO NOT CONTACT NOTICE</span>
            </div>
            <p style={{ margin: '0 0 8px' }}>
              This contact has opted out or has been flagged for no outreach.
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: '500' }}>
              <input
                type="checkbox"
                checked={overrideDoNotContact}
                onChange={(e) => setOverrideDoNotContact(e.target.checked)}
              />
              I have verified consent and wish to override restriction
            </label>
          </div>
        )}

        {/* Channel Switcher Tabs */}
        <div style={{ display: 'flex', gap: '8px', margin: '16px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
          {(['WhatsApp', 'Call', 'Email', 'Meeting'] as const).map((chan) => (
            <button
              key={chan}
              type="button"
              className={`btn ${activeChannel === chan ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                padding: '6px 16px',
                fontSize: '12px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onClick={() => setActiveChannel(chan)}
            >
              {chan === 'WhatsApp' && '💬 WhatsApp'}
              {chan === 'Call' && '📞 Phone Call'}
              {chan === 'Email' && '✉️ Email'}
              {chan === 'Meeting' && '🤝 Meeting'}
            </button>
          ))}
        </div>

        {/* Channel 1 & 3: WhatsApp or Email Content */}
        {(activeChannel === 'WhatsApp' || activeChannel === 'Email') && (
          <div>
            {/* Template Picker */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>
                Select Message Template:
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  backgroundColor: '#f8fafc'
                }}
              >
                {TEMPLATES.map(tpl => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.title} ({tpl.channel})
                  </option>
                ))}
              </select>
            </div>

            {activeChannel === 'Email' && (
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>
                  Email Subject:
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px'
                  }}
                />
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
                  Message Content (Interpolated):
                </label>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Tags: [Name], [Your Name], [Company], [Source/Place]
                </span>
              </div>
              <textarea
                rows={6}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                  lineHeight: '1.4'
                }}
              />
            </div>

            {/* Target Destination Indicator */}
            <div style={{ background: '#f1f5f9', padding: '10px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '16px', color: '#334155' }}>
              {activeChannel === 'WhatsApp' ? (
                <div>Target WhatsApp Number: <strong>{normPhone.isValid ? normPhone.display : '⚠️ No valid phone'}</strong></div>
              ) : (
                <div>Target Email Address: <strong>{contact.email || '⚠️ No email specified'}</strong></div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              {activeChannel === 'WhatsApp' ? (
                <button
                  className="btn btn-primary"
                  style={{ backgroundColor: '#25D366', borderColor: '#25D366', color: '#fff' }}
                  onClick={handleSendWhatsApp}
                  disabled={isSubmitting || isBlocked || !normPhone.isValid}
                >
                  {isSubmitting ? 'Logging...' : 'Launch WhatsApp Web & Auto-Log →'}
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={handleSendEmail}
                  disabled={isSubmitting || isBlocked || !contact.email}
                >
                  {isSubmitting ? 'Logging...' : 'Launch Mail Client & Auto-Log →'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Channel 2: Phone Call */}
        {activeChannel === 'Call' && (
          <div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', color: '#0f172a', marginBottom: '6px' }}>
                Dialing: <strong>{normPhone.isValid ? normPhone.display : contact.preferredPhone || 'No Phone'}</strong>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                Clicking "Dial & Log" will trigger your device dialer (tel:) and record an entry into this contact's communication history.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>
                  Call Duration (Mins):
                </label>
                <input
                  type="number"
                  min={1}
                  value={callDuration}
                  onChange={(e) => setCallDuration(parseInt(e.target.value) || 1)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>
                  Call Notes / Outcome:
                </label>
                <input
                  type="text"
                  placeholder="e.g., Discussed Q3 incubator requirements, requested quote"
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleLogCall(false)}
                disabled={isSubmitting || isBlocked}
              >
                Log Call Notes Only
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleLogCall(true)}
                disabled={isSubmitting || isBlocked || !normPhone.isValid}
              >
                📞 Dial & Auto-Log Call
              </button>
            </div>
          </div>
        )}

        {/* Channel 4: Meeting Notes */}
        {activeChannel === 'Meeting' && (
          <div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>
                Meeting Subject / Topic:
              </label>
              <input
                type="text"
                placeholder="e.g. In-person discussion at Bengaluru Tech Summit"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>
                Meeting Minutes / Action Items:
              </label>
              <textarea
                rows={5}
                placeholder="Key takeaways, action items, next steps agreed upon..."
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  setIsSubmitting(true);
                  try {
                    const res = await logCommunicationAction({
                      contactId: contact.id,
                      type: 'Meeting',
                      direction: 'Inbound',
                      subject: subject || 'Meeting Minutes',
                      notes: callNotes,
                      autoLogged: false,
                      authorName
                    });
                    if (res.success && res.communication) {
                      onCommunicationLogged(res.communication);
                      if (triggerToast) triggerToast('Meeting note logged!', 'success');
                    }
                  } finally {
                    setIsSubmitting(false);
                    onClose();
                  }
                }}
                disabled={isSubmitting}
              >
                Save Meeting Note →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

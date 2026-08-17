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

  // 4. Log Meeting
  const handleLogMeeting = async () => {
    if (isBlocked) {
      alert('This contact is marked DO NOT CONTACT.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await logCommunicationAction({
        contactId: contact.id,
        type: 'Meeting',
        direction: 'Outbound',
        subject: subject || `Meeting with ${contact.name}`,
        notes: callNotes || messageBody || 'Meeting completed.',
        autoLogged: false,
        authorName
      });

      if (res.success && res.communication) {
        onCommunicationLogged(res.communication);
        if (triggerToast) triggerToast('Meeting logged to contact timeline!', 'success');
      }
    } catch (err) {
      console.error('Error logging meeting:', err);
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ width: '640px', maxWidth: '96vw', padding: '20px' }}>
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>
              Quick Outreach Hub
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Connecting with <strong>{contact.name}</strong> • <strong style={{ color: '#d49b38' }}>{contact.company || 'No Company'}</strong>
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
            margin: '14px 0',
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
        <div style={{ display: 'flex', gap: '6px', margin: '14px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {(['WhatsApp', 'Call', 'Email', 'Meeting'] as const).map((chan) => (
            <button
              key={chan}
              type="button"
              className={`btn ${activeChannel === chan ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                padding: '7px 14px',
                fontSize: '12px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                flex: 1,
                justifyContent: 'center',
                ...(activeChannel === chan && chan === 'WhatsApp' ? { backgroundColor: '#10b981', borderColor: '#10b981' } : {})
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
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Select Message Template:
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  fontSize: '12.5px',
                  background: '#f8fafc'
                }}
              >
                {TEMPLATES.map(tpl => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.title} ({tpl.channel})
                  </option>
                ))}
              </select>
            </div>

            {/* Email Subject */}
            {activeChannel === 'Email' && (
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Email Subject Line:
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    fontSize: '12.5px',
                    background: '#f8fafc'
                  }}
                />
              </div>
            )}

            {/* Message Body */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Message Text (Personalized):
              </label>
              <textarea
                rows={5}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  fontSize: '12.5px',
                  lineHeight: '1.4',
                  background: '#f8fafc'
                }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              {activeChannel === 'WhatsApp' ? (
                <button
                  className="btn btn-primary"
                  style={{ backgroundColor: '#10b981', borderColor: '#10b981', color: '#fff' }}
                  onClick={handleSendWhatsApp}
                  disabled={isSubmitting || isBlocked}
                >
                  {isSubmitting ? 'Opening WhatsApp...' : '🚀 Open in WhatsApp & Auto-Log'}
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  style={{ backgroundColor: '#1e40af', borderColor: '#1e40af', color: '#fff' }}
                  onClick={handleSendEmail}
                  disabled={isSubmitting || isBlocked}
                >
                  {isSubmitting ? 'Opening Email...' : '✉️ Open Email Client & Auto-Log'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Channel 2: Phone Call */}
        {activeChannel === 'Call' && (
          <div>
            <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target Phone:</div>
                  <strong style={{ fontSize: '15px', color: '#151c2e' }}>
                    {normPhone.isValid ? normPhone.display : (contact.preferredPhone || 'No valid phone')}
                  </strong>
                </div>
                {normPhone.isValid && (
                  <a
                    href={`tel:${normPhone.e164}`}
                    className="btn btn-primary"
                    style={{ backgroundColor: '#10b981', borderColor: '#10b981', color: '#fff', fontSize: '12px', padding: '6px 14px', textDecoration: 'none' }}
                  >
                    📞 Tap to Call
                  </a>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Call Duration (Minutes):
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={callDuration}
                onChange={(e) => setCallDuration(Number(e.target.value))}
                style={{ width: '100px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Call Notes & Discussion Summary:
              </label>
              <textarea
                rows={4}
                placeholder="What was discussed during the call? Next steps?"
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12.5px', background: '#f8fafc' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ backgroundColor: '#151c2e', borderColor: '#151c2e', color: '#f5d396' }}
                onClick={() => handleLogCall(false)}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Logging...' : '✓ Log Call Notes to Timeline'}
              </button>
            </div>
          </div>
        )}

        {/* Channel 4: Meeting */}
        {activeChannel === 'Meeting' && (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Meeting Subject / Topic:
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12.5px', background: '#f8fafc' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Meeting Minutes & Key Decisions:
              </label>
              <textarea
                rows={5}
                placeholder="Record key conversation points, requirements, and next action items..."
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '12.5px', background: '#f8fafc' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ backgroundColor: '#6d28d9', borderColor: '#6d28d9', color: '#fff' }}
                onClick={handleLogMeeting}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : '🤝 Save Meeting to Timeline'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

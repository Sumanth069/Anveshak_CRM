"use client";

import React, { useState } from 'react';

interface UserProfileCardProps {
  currentUser: any;
  currentRole: string;
  profileSettings: {
    [key: string]: { fullName: string; email: string; title: string; avatarColor: string; notify: boolean; avatarUrl?: string; phone?: string; department?: string };
  };
  setProfileSettings: React.Dispatch<React.SetStateAction<any>>;
  triggerToast: (msg: string, type?: any) => void;
  dealsCount?: number;
  totalPipelineValue?: number;
  completedTasksCount?: number;
  winRatePercent?: number;
}

export default function UserProfileCard({
  currentUser,
  currentRole,
  profileSettings,
  setProfileSettings,
  triggerToast,
  dealsCount = 8,
  totalPipelineValue = 2450000,
  completedTasksCount = 14,
  winRatePercent = 68
}: UserProfileCardProps) {
  const currentProfile = profileSettings[currentRole] || {
    fullName: currentUser?.fullName || 'KP Sumanth',
    email: currentUser?.email || 'sumanth@anveshakhub.com',
    title: 'Regional Director & System Administrator',
    avatarColor: '#d97706',
    notify: true,
    phone: '+91 98450 12345',
    department: 'B2G & Industrial Enterprise Sales'
  };

  const [formState, setFormState] = useState({
    fullName: currentProfile.fullName || '',
    email: currentProfile.email || '',
    title: currentProfile.title || '',
    phone: currentProfile.phone || '+91 98450 12345',
    department: currentProfile.department || 'B2G & Industrial Enterprise Sales',
    notify: currentProfile.notify !== false,
    avatarUrl: currentProfile.avatarUrl || ''
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        triggerToast('Image size exceeds 2MB limit.', 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          setFormState(prev => ({ ...prev, avatarUrl: reader.result as string }));
          triggerToast('Profile photo loaded! Click Save to apply.', 'info');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const updated = {
      ...profileSettings,
      [currentRole]: {
        ...currentProfile,
        ...formState
      }
    };

    setProfileSettings(updated);
    localStorage.setItem('ANVESHAK_CRM_PROFILES', JSON.stringify(updated));

    setTimeout(() => {
      setIsSaving(false);
      triggerToast('🎉 Executive Profile saved successfully!', 'success');
    }, 300);
  };

  const formatLakhs = (val: number) => {
    return `₹${(val / 100000).toFixed(1)}L`;
  };

  return (
    <div className="profile-container animate-fade">
      {/* 1. Hero Executive Profile Banner */}
      <div className="profile-hero-card">
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
            {/* Avatar with live photo or initials */}
            <div style={{ position: 'relative' }}>
              {formState.avatarUrl ? (
                <img 
                  src={formState.avatarUrl} 
                  alt={formState.fullName}
                  style={{
                    width: '84px',
                    height: '84px',
                    borderRadius: '24px',
                    objectFit: 'cover',
                    border: '3px solid #ffffff',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.35)'
                  }}
                />
              ) : (
                <div style={{
                  width: '84px',
                  height: '84px',
                  borderRadius: '24px',
                  background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '32px',
                  fontWeight: '800',
                  border: '3px solid rgba(255, 255, 255, 0.4)',
                  boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)'
                }}>
                  {formState.fullName ? formState.fullName.slice(0, 2).toUpperCase() : 'KP'}
                </div>
              )}

              {/* Replace Image Button Overlay */}
              <label 
                htmlFor="profile-avatar-input"
                style={{
                  position: 'absolute',
                  bottom: '-4px',
                  right: '-4px',
                  background: '#3b82f6',
                  color: '#ffffff',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  border: '2px solid #0f172a'
                }}
                title="Change Photo"
              >
                📷
              </label>
              <input 
                type="file" 
                id="profile-avatar-input" 
                accept="image/*" 
                onChange={handleAvatarUpload} 
                style={{ display: 'none' }} 
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: '#ffffff', letterSpacing: '-0.02em' }}>
                  {formState.fullName || 'KP Sumanth'}
                </h2>
                <span style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: '700'
                }}>
                  🟢 Active Session
                </span>
              </div>

              <div style={{ color: '#94a3b8', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span>💼 {formState.title || 'Regional Director'}</span>
                <span>•</span>
                <span style={{ color: '#cbd5e1' }}>🏢 {formState.department || 'Enterprise Sales'}</span>
              </div>

              <div style={{ marginTop: '6px', fontSize: '12px', color: '#60a5fa', fontFamily: 'monospace' }}>
                ✉️ {formState.email || 'sumanth@anveshakhub.com'}
              </div>
            </div>
          </div>

          {/* Role Tier Badge */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '10px 16px',
            textAlign: 'right'
          }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', fontWeight: '700' }}>
              Access Tier
            </div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: '#fbbf24', marginTop: '2px' }}>
              👑 {currentRole.toUpperCase()}
            </div>
          </div>

        </div>

        {/* Executive Stats Bar */}
        <div className="profile-stats-grid">
          <div className="profile-stat-box">
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#60a5fa' }}>{dealsCount}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontWeight: '600' }}>Deals Managed</div>
          </div>
          <div className="profile-stat-box">
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#34d399' }}>{formatLakhs(totalPipelineValue)}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontWeight: '600' }}>Pipeline Value</div>
          </div>
          <div className="profile-stat-box">
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#fbbf24' }}>{completedTasksCount}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontWeight: '600' }}>Tasks Cleared</div>
          </div>
          <div className="profile-stat-box">
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#a78bfa' }}>{winRatePercent}%</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontWeight: '600' }}>Win Rate</div>
          </div>
        </div>
      </div>

      {/* 2. Profile Details & Settings Form */}
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Card: Personal & Work Info */}
        <div className="profile-card-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
            <span style={{ fontSize: '18px' }}>👤</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>Personal & Corporate Information</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>Configure your identity and contact parameters displayed across CRM modules</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>
                Full Name *
              </label>
              <input 
                type="text" 
                required 
                value={formState.fullName} 
                onChange={(e) => setFormState({ ...formState, fullName: e.target.value })}
                placeholder="Your full name"
                style={{ width: '100%', boxSizing: 'border-box', borderRadius: '10px' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>
                Work Email Address *
              </label>
              <input 
                type="email" 
                required 
                value={formState.email} 
                onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                placeholder="name@company.com"
                style={{ width: '100%', boxSizing: 'border-box', borderRadius: '10px' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>
                Direct Phone Number
              </label>
              <input 
                type="text" 
                value={formState.phone} 
                onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                placeholder="+91 98450 12345"
                style={{ width: '100%', boxSizing: 'border-box', borderRadius: '10px' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>
                Title / Designation
              </label>
              <input 
                type="text" 
                required
                value={formState.title} 
                onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                placeholder="e.g. Regional Director"
                style={{ width: '100%', boxSizing: 'border-box', borderRadius: '10px' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px', display: 'block' }}>
                Department / Business Unit
              </label>
              <input 
                type="text" 
                value={formState.department} 
                onChange={(e) => setFormState({ ...formState, department: e.target.value })}
                placeholder="e.g. B2G & Industrial Enterprise Sales"
                style={{ width: '100%', boxSizing: 'border-box', borderRadius: '10px' }}
              />
            </div>
          </div>
        </div>

        {/* Card: Notification Preferences & Audio Telemetry */}
        <div className="profile-card-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
            <span style={{ fontSize: '18px' }}>🔔</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>Workspace Audio & Telemetry Preferences</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>Control real-time acoustic cues and lead arrival telemetry</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#1e293b' }}>
                  🔊 Real-Time Audio Telemetry
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Play futuristic acoustic feedback chords on toast notifications and successful database commits
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={formState.notify} 
                onChange={(e) => setFormState({ ...formState, notify: e.target.checked })}
                style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#4f46e5' }}
              />
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={() => {
              setFormState({
                fullName: currentProfile.fullName || '',
                email: currentProfile.email || '',
                title: currentProfile.title || '',
                phone: currentProfile.phone || '+91 98450 12345',
                department: currentProfile.department || 'B2G & Industrial Enterprise Sales',
                notify: currentProfile.notify !== false,
                avatarUrl: currentProfile.avatarUrl || ''
              });
              triggerToast('Profile changes reset to previous values.', 'info');
            }}
            style={{ borderRadius: '12px', padding: '10px 20px', fontSize: '13.5px' }}
          >
            Reset Changes
          </button>

          <button 
            type="submit" 
            disabled={isSaving}
            style={{
              background: 'linear-gradient(135deg, #4f46e5, #3b82f6)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '10px 28px',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            {isSaving ? 'Saving...' : '💾 Save Profile Settings'}
          </button>
        </div>

      </form>
    </div>
  );
}

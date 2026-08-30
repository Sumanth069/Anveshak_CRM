'use server';

import { supabase } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';

export interface OutlookConnection {
  userEmail: string;
  outlookEmail: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in ms
  autoSync: boolean;
}

// In-memory runtime cache fallback if database table is being created
const memoryTokenStore = new Map<string, OutlookConnection>();

/**
 * Get the user's connected Outlook account status
 */
export async function getOutlookConnectionStatusAction(userEmail: string) {
  if (!userEmail) return { connected: false };
  const cleanEmail = userEmail.trim().toLowerCase();

  // 1. Check memory cache first
  if (memoryTokenStore.has(cleanEmail)) {
    const conn = memoryTokenStore.get(cleanEmail)!;
    return {
      connected: true,
      outlookEmail: conn.outlookEmail,
      autoSync: conn.autoSync
    };
  }

  // 2. Query Supabase
  try {
    const { data, error } = await supabase
      .from('outlook_connections')
      .select('*')
      .eq('user_email', cleanEmail)
      .single();

    if (data && !error) {
      const conn: OutlookConnection = {
        userEmail: data.user_email,
        outlookEmail: data.outlook_email || data.user_email,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Number(data.expires_at) || 0,
        autoSync: data.auto_sync !== false
      };
      memoryTokenStore.set(cleanEmail, conn);
      return {
        connected: true,
        outlookEmail: conn.outlookEmail,
        autoSync: conn.autoSync
      };
    }
  } catch (e) {
    // Silent catch
  }

  return { connected: false };
}

/**
 * Save or update tokens for a registered user
 */
export async function saveOutlookTokensAction(
  userEmail: string,
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number; // seconds
    outlookEmail: string;
  }
) {
  if (!userEmail) return { success: false, error: 'User email is required' };
  const cleanEmail = userEmail.trim().toLowerCase();
  const expiresAt = Date.now() + tokens.expiresIn * 1000;

  const conn: OutlookConnection = {
    userEmail: cleanEmail,
    outlookEmail: tokens.outlookEmail || cleanEmail,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt,
    autoSync: true
  };

  memoryTokenStore.set(cleanEmail, conn);

  try {
    await supabase.from('outlook_connections').upsert(
      {
        user_email: cleanEmail,
        outlook_email: conn.outlookEmail,
        access_token: conn.accessToken,
        refresh_token: conn.refreshToken,
        expires_at: conn.expiresAt,
        auto_sync: true,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_email' }
    );
  } catch (e) {
    console.warn('Database token save warning (using memory token):', e);
  }

  return { success: true, outlookEmail: conn.outlookEmail };
}

/**
 * Disconnect Outlook for a user
 */
export async function disconnectOutlookAction(userEmail: string) {
  if (!userEmail) return { success: false };
  const cleanEmail = userEmail.trim().toLowerCase();

  memoryTokenStore.delete(cleanEmail);

  try {
    await supabase.from('outlook_connections').delete().eq('user_email', cleanEmail);
  } catch (e) {
    // Ignore error
  }

  return { success: true };
}

/**
 * Refresh access token using Microsoft OAuth 2.0 refresh endpoint
 */
async function getValidAccessToken(userEmail: string): Promise<string | null> {
  const cleanEmail = userEmail.trim().toLowerCase();
  let conn = memoryTokenStore.get(cleanEmail);

  if (!conn) {
    const status = await getOutlookConnectionStatusAction(cleanEmail);
    if (status.connected) {
      conn = memoryTokenStore.get(cleanEmail);
    }
  }

  if (!conn) return null;

  // If token is still valid (with 5 min buffer), return it
  if (conn.accessToken && conn.expiresAt > Date.now() + 5 * 60 * 1000) {
    return conn.accessToken;
  }

  // Refresh token
  if (!conn.refreshToken) return conn.accessToken || null;

  try {
    const clientId = process.env.MICROSOFT_CLIENT_ID || '';
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || '';

    if (!clientId) {
      return conn.accessToken;
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: conn.refreshToken
    });

    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const data = await res.json();
    if (data.access_token) {
      conn.accessToken = data.access_token;
      if (data.refresh_token) conn.refreshToken = data.refresh_token;
      conn.expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
      memoryTokenStore.set(cleanEmail, conn);

      // Update in database in background
      supabase
        .from('outlook_connections')
        .update({
          access_token: conn.accessToken,
          refresh_token: conn.refreshToken,
          expires_at: conn.expiresAt
        })
        .eq('user_email', cleanEmail)
        .then(() => {});

      return conn.accessToken;
    }
  } catch (err) {
    console.error('Failed to refresh Microsoft token:', err);
  }

  return conn.accessToken || null;
}

/**
 * Automatically sync a task to the user's Microsoft Outlook Calendar in the background
 */
export async function syncTaskToOutlookAction(
  userEmail: string,
  task: {
    title: string;
    description?: string;
    dueDate: string; // YYYY-MM-DD
    dueTime?: string; // HH:mm
    priority?: string;
    linkedTo?: string;
  }
) {
  if (!userEmail || !task.dueDate) {
    return { success: false, error: 'User email and due date are required' };
  }

  const token = await getValidAccessToken(userEmail);
  if (!token) {
    return { success: false, error: 'Outlook account not linked yet for this user' };
  }

  try {
    const timeStr = task.dueTime || '09:00';
    const startDateTime = `${task.dueDate}T${timeStr}:00`;
    
    // Default duration 45 mins
    const [h, m] = timeStr.split(':').map(Number);
    const endDate = new Date(`${task.dueDate}T${timeStr}:00`);
    endDate.setMinutes(endDate.getMinutes() + 45);
    const endHour = String(endDate.getHours()).padStart(2, '0');
    const endMin = String(endDate.getMinutes()).padStart(2, '0');
    const endDateTime = `${task.dueDate}T${endHour}:${endMin}:00`;

    const eventPayload = {
      subject: `[CRM Task] ${task.title}`,
      body: {
        contentType: 'HTML',
        content: `<p><strong>Priority:</strong> ${task.priority || 'Medium'}</p><p><strong>Linked Entity:</strong> ${task.linkedTo || 'None'}</p><hr/><p>${(task.description || '').replace(/\n/g, '<br/>')}</p><p><em>Created automatically by Anveshak CRM</em></p>`
      },
      start: {
        dateTime: startDateTime,
        timeZone: 'Asia/Kolkata'
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'Asia/Kolkata'
      },
      location: {
        displayName: task.linkedTo || 'Anveshak CRM'
      },
      importance: task.priority === 'High' ? 'High' : task.priority === 'Low' ? 'Low' : 'Normal',
      reminderMinutesBeforeStart: 15
    };

    const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventPayload)
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, eventId: data.id, webLink: data.webLink };
    } else {
      const errData = await res.json();
      console.warn('Microsoft Graph API event creation warning:', errData);
      return { success: false, error: errData.error?.message || 'Graph API request failed' };
    }
  } catch (err: any) {
    console.error('Error syncing task to Outlook Calendar:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Automatically sync a deal closure milestone to the user's Microsoft Outlook Calendar
 */
export async function syncDealToOutlookAction(
  userEmail: string,
  deal: {
    name: string;
    company: string;
    value: number;
    stage: string;
    expectedClose: string; // YYYY-MM-DD
  }
) {
  if (!userEmail || !deal.expectedClose) {
    return { success: false, error: 'User email and expected close date required' };
  }

  const token = await getValidAccessToken(userEmail);
  if (!token) return { success: false, error: 'Outlook account not linked' };

  try {
    const startDateTime = `${deal.expectedClose}T10:00:00`;
    const endDateTime = `${deal.expectedClose}T11:00:00`;

    const eventPayload = {
      subject: `[Deal Milestone] ${deal.name} (${deal.company})`,
      body: {
        contentType: 'HTML',
        content: `<p><strong>Company:</strong> ${deal.company}</p><p><strong>Stage:</strong> ${deal.stage}</p><p><strong>Expected Deal Value:</strong> ₹${deal.value.toLocaleString('en-IN')}</p><hr/><p><em>Tracked via Anveshak CRM Pipeline</em></p>`
      },
      start: { dateTime: startDateTime, timeZone: 'Asia/Kolkata' },
      end: { dateTime: endDateTime, timeZone: 'Asia/Kolkata' },
      location: { displayName: deal.company || 'Anveshak CRM' }
    };

    const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventPayload)
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, eventId: data.id };
    }
  } catch (e: any) {
    return { success: false, error: e.message };
  }

  return { success: false };
}

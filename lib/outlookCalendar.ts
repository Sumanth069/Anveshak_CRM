/**
 * Outlook Calendar Integration Utilities for Anveshak CRM
 * Supports Microsoft 365 / Outlook Web, Outlook Desktop, and standard iCalendar (.ics) exports.
 */

export interface CalendarEventParams {
  title: string;
  description?: string;
  startDate: string; // YYYY-MM-DD
  startTime?: string; // HH:mm (default '09:00')
  durationMinutes?: number; // default 60
  location?: string;
}

/**
 * Format Date to iCalendar UTC string: YYYYMMDDTHHmmssZ
 */
function formatIcsDate(date: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

/**
 * Escape text for iCalendar RFC-5545 standard
 */
function escapeIcsText(text: string): string {
  return (text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Generate Microsoft Outlook Web / Office 365 deep link to pre-fill event compose
 */
export function getOutlookWebComposeUrl({
  title,
  description = '',
  startDate,
  startTime = '09:00',
  durationMinutes = 60,
  location = 'Anveshak CRM'
}: CalendarEventParams): string {
  try {
    const [year, month, day] = startDate.split('-').map(Number);
    const [hours, minutes] = (startTime || '09:00').split(':').map(Number);
    const start = new Date(year, month - 1, day, hours || 9, minutes || 0);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    const params = new URLSearchParams({
      path: '/calendar/action/compose',
      rru: 'addevent',
      startdt: start.toISOString(),
      enddt: end.toISOString(),
      subject: title,
      body: description,
      location: location
    });

    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
  } catch (e) {
    return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(title)}`;
  }
}

/**
 * Generate Microsoft 365 / Office 365 Work & Enterprise Web Calendar link
 */
export function getOffice365ComposeUrl({
  title,
  description = '',
  startDate,
  startTime = '09:00',
  durationMinutes = 60,
  location = 'Anveshak CRM'
}: CalendarEventParams): string {
  try {
    const [year, month, day] = startDate.split('-').map(Number);
    const [hours, minutes] = (startTime || '09:00').split(':').map(Number);
    const start = new Date(year, month - 1, day, hours || 9, minutes || 0);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    const params = new URLSearchParams({
      path: '/calendar/action/compose',
      rru: 'addevent',
      startdt: start.toISOString(),
      enddt: end.toISOString(),
      subject: title,
      body: description,
      location: location
    });

    return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
  } catch (e) {
    return `https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(title)}`;
  }
}

/**
 * Generate RFC-5545 VEVENT string
 */
export function generateVEvent({
  title,
  description = '',
  startDate,
  startTime = '09:00',
  durationMinutes = 60,
  location = 'Anveshak CRM'
}: CalendarEventParams): string {
  const [year, month, day] = startDate.split('-').map(Number);
  const [hours, minutes] = (startTime || '09:00').split(':').map(Number);
  const start = new Date(year, month - 1, day, hours || 9, minutes || 0);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const now = new Date();
  const uid = `anveshak-${Date.now()}-${Math.random().toString(36).substring(2, 8)}@anveshakhub.com`;

  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDate(now)}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(location)}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT'
  ].join('\r\n');
}

/**
 * Generate full iCalendar file content for single or multiple events
 */
export function generateIcsCalendar(events: CalendarEventParams[], calendarName = 'Anveshak CRM Calendar'): string {
  const vEvents = events.map(generateVEvent).join('\r\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Anveshak CRM//Calendar Integration//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calendarName}`,
    'X-WR-TIMEZONE:Asia/Kolkata',
    vEvents,
    'END:VCALENDAR'
  ].join('\r\n');
}

/**
 * Trigger automatic download of an .ics file in the browser
 */
export function downloadIcsFile(events: CalendarEventParams | CalendarEventParams[], filename = 'anveshak_event.ics') {
  if (typeof window === 'undefined') return;
  const eventList = Array.isArray(events) ? events : [events];
  const icsText = generateIcsCalendar(eventList);
  const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.ics') ? filename : `${filename}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Open Outlook Web composer directly in a new browser tab
 */
export function openInOutlookWeb(params: CalendarEventParams) {
  if (typeof window === 'undefined') return;
  const url = getOutlookWebComposeUrl(params);
  window.open(url, '_blank', 'noopener,noreferrer');
}

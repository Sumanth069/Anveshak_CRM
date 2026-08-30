import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabase } from '@/lib/supabase';
import { generateIcsCalendar, CalendarEventParams } from '@/lib/outlookCalendar';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('user') || '';

    const eventParams: CalendarEventParams[] = [];

    // 1. Fetch Tasks
    try {
      let tQuery = supabase.from('tasks').select('*');
      if (userEmail) {
        tQuery = tQuery.eq('assignee', userEmail);
      }
      const { data: tasks } = await tQuery;
      if (tasks && Array.isArray(tasks)) {
        for (const t of tasks) {
          if (t.due_date) {
            eventParams.push({
              title: `[Task] ${t.title || 'CRM Task'}`,
              description: `Priority: ${t.priority || 'Medium'}\nStatus: ${t.status || 'Open'}\nLinked: ${t.linked_to || 'None'}\n\n${t.description || ''}`,
              startDate: t.due_date,
              startTime: t.due_time || '09:00',
              durationMinutes: 45,
              location: t.linked_to || 'Anveshak CRM'
            });
          }
        }
      }
    } catch (e) {
      console.warn('Feed tasks query fallback:', e);
    }

    // 2. Fetch Deals
    try {
      let dQuery = supabase.from('deals').select('*');
      if (userEmail) {
        dQuery = dQuery.eq('owner', userEmail);
      }
      const { data: deals } = await dQuery;
      if (deals && Array.isArray(deals)) {
        for (const d of deals) {
          if (d.expected_close) {
            eventParams.push({
              title: `[Deal Close] ${d.name || d.company} (₹${(d.value || 0).toLocaleString('en-IN')})`,
              description: `Company: ${d.company}\nStage: ${d.stage || 'New'}\nProbability: ${d.probability || 0}%\nOwner: ${d.owner || 'Unassigned'}`,
              startDate: d.expected_close,
              startTime: '10:00',
              durationMinutes: 60,
              location: d.company || 'Anveshak CRM'
            });
          }
        }
      }
    } catch (e) {
      console.warn('Feed deals query fallback:', e);
    }

    // 3. Fetch Activities
    try {
      const { data: activities } = await supabase.from('audit_logs').select('*').limit(50);
      if (activities && Array.isArray(activities)) {
        for (const a of activities) {
          const actDate = a.timestamp ? a.timestamp.split('T')[0] : null;
          if (actDate) {
            eventParams.push({
              title: `[CRM Activity] ${a.action || 'Activity'} - ${a.entity || ''}`,
              description: `User: ${a.user || 'CRM User'}\nAction: ${a.action}\nDetails: ${a.after_state || ''}`,
              startDate: actDate,
              startTime: '11:00',
              durationMinutes: 30,
              location: 'Anveshak CRM'
            });
          }
        }
      }
    } catch (e) {
      console.warn('Feed activities query fallback:', e);
    }

    const icsContent = generateIcsCalendar(eventParams, 'Anveshak CRM Live Calendar');

    return new Response(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="anveshak_crm_calendar.ics"',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

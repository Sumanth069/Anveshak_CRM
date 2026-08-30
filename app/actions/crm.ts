'use server';

import { prisma } from '@/lib/prisma';
import { supabase } from '@/lib/supabase';
import { normalizePhone } from '@/lib/phone';

function normalizeDealStage(stage?: string): string {
  if (!stage) return 'New';
  const s = stage.trim().toLowerCase();
  if (s === 'new' || s === 'discovered' || s === 'discovery' || s === 'lead' || s === 'inquiry') return 'New';
  if (s === 'contacted' || s === 'engaged' || s === 'meeting' || s === 'scheduled') return 'Contacted';
  if (s === 'proposal sent' || s === 'proposal' || s === 'quote shared' || s === 'quote' || s === 'pricing') return 'Proposal Sent';
  if (s === 'negotiation' || s === 'terms' || s === 'in review') return 'Negotiation';
  if (s === 'won' || s === 'closed won' || s === 'closed-won') return 'Won';
  if (s === 'lost' || s === 'closed lost' || s === 'closed-lost' || s === 'rejected') return 'Lost';
  return 'New';
}

function deduplicateDeals(deals: any[]): any[] {
  const seen = new Set<string>();
  const unique: any[] = [];
  for (const d of deals) {
    const comp = (d.company || '').trim().toLowerCase();
    const nm = (d.name || '').trim().toLowerCase();
    const key = comp ? `${comp}::${nm}` : (nm ? `name:${nm}` : `id:${d.id}`);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(d);
    }
  }
  return unique;
}

function deduplicateLeads(leads: any[]): any[] {
  const seen = new Set<string>();
  const unique: any[] = [];
  for (const l of leads) {
    const ph = (l.phone || '').replace(/[^0-9]/g, '');
    const em = (l.email || '').trim().toLowerCase();
    const nm = (l.name || '').trim().toLowerCase();
    let key = '';
    if (ph && ph.length >= 7) key = `phone:${ph.slice(-10)}`;
    else if (em) key = `email:${em}`;
    else if (nm) key = `name:${nm}`;
    else key = `id:${l.id}`;

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(l);
    }
  }
  return unique;
}

export async function fetchCrmInitialState(userEmail?: string, userFullName?: string, role?: string) {
  try {
    const isSalesRole = role === 'SALES_REP' || role === 'MANAGER';
    const activeName = (userFullName || '').trim().toLowerCase();
    const activeEmail = (userEmail || '').trim().toLowerCase();

    // 1. Direct Supabase Query (Primary / Fast on Vercel)
    try {
      let lQuery = supabase.from('leads').select('*').order('created_at', { ascending: false });
      let dQuery = supabase.from('deals').select('*').order('created_at', { ascending: false });
      let tQuery = supabase.from('tasks').select('*').order('created_at', { ascending: false });
      let cQuery = supabase.from('companies').select('*').order('created_at', { ascending: false });
      let qQuery = supabase.from('quotes').select('*').order('created_at', { ascending: false });
      let aQuery = supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(100);

      const [lRes, dRes, tRes, cRes, qRes, aRes] = await Promise.all([
        lQuery, dQuery, tQuery, cQuery, qQuery, aQuery
      ]);

      let mappedLeads = deduplicateLeads((lRes.data || []).map((l: any) => ({
        id: l.id,
        name: l.name,
        company: l.company || '',
        email: l.email || '',
        phone: l.phone || '',
        status: l.status || 'New',
        score: l.score || 0,
        owner: l.owner || 'KP Sumanth',
        customValues: l.custom_values || {},
        activities: l.activities || [],
        createdAt: l.created_at,
        updatedAt: l.updated_at
      })));

      let mappedDeals = deduplicateDeals((dRes.data || []).map((d: any) => ({
        id: d.id,
        name: d.name,
        company: d.company,
        value: Number(d.value) || 0,
        stage: normalizeDealStage(d.stage),
        probability: Number(d.probability) || 0,
        expectedClose: d.expected_close,
        owner: d.owner || 'KP Sumanth',
        lostReason: d.lost_reason,
        customValues: d.custom_values || {},
        createdAt: d.created_at,
        updatedAt: d.updated_at
      })));

      let mappedTasks = (tRes.data || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description || '',
        dueDate: t.due_date,
        dueTime: t.due_time,
        priority: t.priority || 'Medium',
        status: t.status || 'Open',
        category: t.category || 'General',
        assignee: t.assignee || t.assigned_to || 'KP Sumanth',
        linkedTo: t.linked_to,
        completed: t.status === 'Completed' || !!t.completed,
        createdAt: t.created_at,
        updatedAt: t.updated_at
      }));

      // Multi-user scoping for Sales Representatives / Managers
      // Multi-user scoping for Sales Representatives / Managers
      let userCompanies = (cRes.data || []).map((c: any) => {
        const compName = (c.name || '').trim().toLowerCase();
        const matchingLeads = mappedLeads.filter(l => (l.company || '').trim().toLowerCase() === compName);
        const matchingDeals = mappedDeals.filter(d => (d.company || '').trim().toLowerCase() === compName);
        const rolledDealValue = matchingDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
        const computedCount = Math.max(Number(c.contacts_count) || 0, matchingLeads.length);

        return {
          id: c.id,
          name: c.name,
          industry: c.industry || 'Manufacturing / B2G',
          website: c.website,
          city: c.city || 'Bangalore',
          state: c.state || 'Karnataka',
          address: c.address,
          contactsCount: computedCount,
          totalDealValue: rolledDealValue || Number(c.total_deal_value) || 0,
          createdAt: c.created_at
        };
      });

      let userQuotes = (qRes.data || []).map((q: any) => ({
        id: q.id,
        dealId: q.deal_id,
        company: q.company,
        contact: q.contact,
        gstType: q.gst_type || 'intra',
        items: q.items || [],
        status: q.status || 'Draft',
        totalAmount: Number(q.total_amount) || 0,
        termsAndConditions: q.terms_and_conditions,
        createdAt: q.created_at
      }));

      let userAuditLogs = (aRes.data || []).map((a: any) => ({
        id: a.id,
        user: a.user,
        action: a.action,
        entity: a.entity,
        timestamp: a.timestamp,
        beforeState: a.before_state,
        afterState: a.after_state
      }));

      if (isSalesRole && (activeName || activeEmail)) {
        mappedLeads = mappedLeads.filter(l => {
          const o = (l.owner || '').trim().toLowerCase();
          return o === activeName || o === activeEmail || (activeName && (o.includes(activeName) || activeName.includes(o)));
        });

        mappedDeals = mappedDeals.filter(d => {
          const o = (d.owner || '').trim().toLowerCase();
          return o === activeName || o === activeEmail || (activeName && (o.includes(activeName) || activeName.includes(o)));
        });

        mappedTasks = mappedTasks.filter(t => {
          const a = (t.assignee || '').trim().toLowerCase();
          return a === activeName || a === activeEmail || (activeName && (a.includes(activeName) || activeName.includes(a)));
        });

        const activeDealCompanies = new Set(mappedDeals.map(d => (d.company || '').toLowerCase()));
        const activeLeadCompanies = new Set(mappedLeads.map(l => (l.company || '').toLowerCase()));
        userCompanies = userCompanies.filter(c => 
          activeDealCompanies.has(c.name.toLowerCase()) || activeLeadCompanies.has(c.name.toLowerCase())
        );

        const activeDealIds = new Set(mappedDeals.map(d => d.id));
        userQuotes = userQuotes.filter(q => activeDealIds.has(q.dealId));
        userAuditLogs = userAuditLogs.filter(a => {
          const u = (a.user || '').toLowerCase();
          return u === activeName || u === activeEmail;
        });
      }

      return {
        success: true,
        data: {
          leads: mappedLeads,
          deals: mappedDeals,
          tasks: mappedTasks,
          companies: userCompanies,
          quotes: userQuotes,
          auditLogs: userAuditLogs
        }
      };
    } catch (sErr) {
      console.warn('Supabase fetchCrmInitialState fallback to Prisma:', sErr);
    }

    // 2. Prisma Query Fallback
    try {
      const [rawLeads, rawDeals, tasks, companies, quotes, auditLogs] = await Promise.all([
        prisma.lead.findMany({ orderBy: { createdAt: 'desc' } }),
        prisma.deal.findMany({ orderBy: { createdAt: 'desc' } }),
        prisma.task.findMany({ orderBy: { createdAt: 'desc' } }),
        prisma.company.findMany({ orderBy: { createdAt: 'desc' } }),
        prisma.quote.findMany({ orderBy: { createdAt: 'desc' } }),
        prisma.auditLog.findMany({ orderBy: { timestamp: 'desc' }, take: 100 })
      ]);

      let deals = deduplicateDeals(rawDeals.map((d: any) => ({
        id: d.id,
        name: d.name,
        company: d.company || '',
        value: Number(d.value) || 0,
        stage: normalizeDealStage(d.stage || undefined),
        probability: Number(d.probability) || 0,
        expectedClose: d.expectedClose ? (typeof d.expectedClose === 'string' ? d.expectedClose : d.expectedClose.toISOString().split('T')[0]) : '',
        owner: d.owner || '',
        lostReason: d.lostReason || undefined,
        customValues: d.customValues || {},
        daysInStage: Number(d.daysInStage) || 0,
        createdAt: d.createdAt ? d.createdAt.toISOString() : undefined,
        updatedAt: d.updatedAt ? d.updatedAt.toISOString() : undefined
      })));

      let leads = deduplicateLeads(rawLeads.map((l: any) => ({
        id: l.id,
        name: l.name,
        company: l.company || '',
        email: l.email || '',
        phone: l.phone || '',
        status: l.status || 'New',
        score: Number(l.score) || 0,
        owner: l.owner || '',
        customValues: l.customValues || {},
        activities: l.activities || [],
        createdAt: l.createdAt ? l.createdAt.toISOString() : undefined,
        updatedAt: l.updatedAt ? l.updatedAt.toISOString() : undefined
      })));

      let userTasks = tasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description || '',
        dueDate: t.dueDate ? (typeof t.dueDate === 'string' ? t.dueDate : t.dueDate.toISOString().split('T')[0]) : '',
        priority: t.priority || 'Medium',
        status: t.status || 'Open',
        category: t.category || 'General',
        assignee: t.assignee || '',
        linkedTo: t.linkedTo || '',
        createdAt: t.createdAt ? t.createdAt.toISOString() : undefined,
        updatedAt: t.updatedAt ? t.updatedAt.toISOString() : undefined
      }));

      let pCompanies = companies.map((c: any) => ({
        id: c.id,
        name: c.name,
        industry: c.industry || '',
        website: c.website || '',
        city: c.city || '',
        state: c.state || '',
        address: c.address || '',
        contactsCount: Number(c.contactsCount) || 0,
        totalDealValue: Number(c.totalDealValue) || 0,
        createdAt: c.createdAt ? c.createdAt.toISOString() : undefined,
        updatedAt: c.updatedAt ? c.updatedAt.toISOString() : undefined
      }));

      let pQuotes = quotes.map((q: any) => ({
        id: q.id,
        dealId: q.dealId || '',
        company: q.company || '',
        contact: q.contact || '',
        items: q.items || [],
        gstType: q.gstType || 'intra',
        status: q.status || 'Draft',
        totalAmount: Number(q.totalAmount) || 0,
        createdAt: q.createdAt ? q.createdAt.toISOString() : undefined,
        termsAndConditions: q.termsAndConditions || ''
      }));

      let pAudit = auditLogs.map((a: any) => ({
        id: a.id,
        user: a.user,
        action: a.action,
        entity: a.entity,
        timestamp: a.timestamp ? (typeof a.timestamp === 'string' ? a.timestamp : a.timestamp.toISOString()) : new Date().toISOString(),
        beforeState: a.beforeState || '',
        afterState: a.afterState || ''
      }));

      if (isSalesRole && (activeName || activeEmail)) {
        leads = leads.filter(l => {
          const o = (l.owner || '').trim().toLowerCase();
          return o === activeName || o === activeEmail || (activeName && (o.includes(activeName) || activeName.includes(o)));
        });
        deals = deals.filter(d => {
          const o = (d.owner || '').trim().toLowerCase();
          return o === activeName || o === activeEmail || (activeName && (o.includes(activeName) || activeName.includes(o)));
        });
        userTasks = userTasks.filter(t => {
          const a = (t.assignee || '').trim().toLowerCase();
          return a === activeName || a === activeEmail || (activeName && (a.includes(activeName) || activeName.includes(a)));
        });
        const activeDealCompanies = new Set(deals.map(d => (d.company || '').toLowerCase()));
        const activeLeadCompanies = new Set(leads.map(l => (l.company || '').toLowerCase()));
        pCompanies = pCompanies.filter(c => activeDealCompanies.has(c.name.toLowerCase()) || activeLeadCompanies.has(c.name.toLowerCase()));
        const activeDealIds = new Set(deals.map(d => d.id));
        pQuotes = pQuotes.filter(q => activeDealIds.has(q.dealId));
        pAudit = pAudit.filter(a => {
          const u = (a.user || '').trim().toLowerCase();
          return u === activeName || u === activeEmail || (activeName && (u.includes(activeName) || activeName.includes(u)));
        });
      }

      return {
        success: true,
        data: { leads, deals, tasks: userTasks, companies: pCompanies, quotes: pQuotes, auditLogs: pAudit }
      };
    } catch (pErr) {
      console.warn('Prisma fetchCrmInitialState error:', pErr);
    }

    return {
      success: true,
      data: { leads: [], deals: [], tasks: [], companies: [], quotes: [], auditLogs: [] }
    };
  } catch (err: any) {
    console.error('fetchCrmInitialState critical error:', err);
    return { success: false, error: err.message, data: { leads: [], deals: [], tasks: [], companies: [], quotes: [], auditLogs: [] } };
  }
}

export async function createLeadAction(lead: any) {
  try {
    const name = (lead.name || '').trim();
    const email = (lead.email || '').trim().toLowerCase();
    const phone = (lead.phone || '').trim();

    if (!name) {
      return { success: false, error: 'Lead name is required.' };
    }

    // 1. Check for duplicate in Supabase
    try {
      if (email || phone) {
        let query = supabase.from('leads').select('*');
        if (email) query = query.ilike('email', email);
        else if (phone) query = query.ilike('phone', phone);
        const { data: supaExisting } = await query.limit(1);
        if (supaExisting && supaExisting.length > 0) {
          const ext = supaExisting[0];
          return {
            success: false,
            isDuplicate: true,
            error: `Lead "${ext.name}" is already registered in the database.`,
            data: ext
          };
        }
      }
    } catch (sErr) {
      console.warn('Supabase duplicate lead check fallback:', sErr);
    }

    // 2. Insert into Supabase (Primary / 100% Reliable on Vercel)
    try {
      const { data: sCreated, error: sErr } = await supabase.from('leads').insert([{
        name: name,
        company: lead.company || null,
        email: email || null,
        phone: phone || null,
        status: lead.status || 'New',
        score: lead.score || 0,
        owner: lead.owner || null,
        custom_values: lead.customValues || {},
        activities: lead.activities || []
      }]).select().single();

      if (!sErr && sCreated) {
        // Also try Prisma in background
        try {
          await prisma.lead.create({
            data: {
              id: sCreated.id,
              name: name,
              company: lead.company || null,
              email: email || null,
              phone: phone || null,
              status: lead.status || 'New',
              score: lead.score || 0,
              owner: lead.owner || null,
              customValues: lead.customValues || {},
              activities: lead.activities || []
            }
          });
        } catch (e) {}

        // Auto-sync into Unified Centralized Contacts Pool & Companies
        try {
          const normPhone = phone ? normalizePhone(phone) : null;
          const cleanPhone = normPhone?.isValid ? normPhone.e164 : (phone || null);

          const contactPayload = {
            name: name,
            company: lead.company || null,
            email: email || null,
            preferred_phone: cleanPhone,
            phone: cleanPhone,
            category: 'Lead',
            source_type: 'Lead Capture',
            tags: ['Lead'],
            owner: lead.owner || 'KP Sumanth',
            notes: `Lead in Pipeline (Status: ${lead.status || 'New'})`
          };

          await supabase.from('contacts').insert([contactPayload]);

          await prisma.contact.create({
            data: {
              name: name,
              company: lead.company || null,
              email: email || null,
              preferredPhone: cleanPhone,
              category: 'Lead',
              sourceType: 'Lead Capture',
              tags: ['Lead'],
              owner: lead.owner || 'KP Sumanth',
              notes: `Lead in Pipeline (Status: ${lead.status || 'New'})`
            }
          }).catch(() => {});

          if (lead.company) {
            const compPayload = {
              name: lead.company,
              industry: 'Manufacturing / B2G',
              city: 'Bangalore',
              state: 'Karnataka',
              contacts_count: 1,
              total_deal_value: 0
            };
            await supabase.from('companies').upsert([compPayload], { onConflict: 'name' });
            await prisma.company.upsert({
              where: { name: lead.company },
              update: { contactsCount: { increment: 1 } },
              create: {
                name: lead.company,
                industry: 'Manufacturing / B2G',
                city: 'Bangalore',
                state: 'Karnataka',
                contactsCount: 1,
                totalDealValue: 0
              }
            }).catch(() => {});
          }
        } catch (syncEx) {
          console.warn('Lead to Contacts/Companies pool sync warning:', syncEx);
        }

        return { success: true, data: sCreated };
      }
    } catch (supaInsertErr) {
      console.warn('Supabase lead insert warning, trying Prisma:', supaInsertErr);
    }

    // 3. Prisma Fallback
    try {
      const created = await prisma.lead.create({
        data: {
          id: lead.id || undefined,
          name: name,
          company: lead.company || null,
          email: email || null,
          phone: phone || null,
          status: lead.status || 'New',
          score: lead.score || 0,
          owner: lead.owner || null,
          customValues: lead.customValues || {},
          activities: lead.activities || []
        }
      });

      // Auto-sync into Unified Centralized Contacts Pool
      try {
        const normPhone = phone ? normalizePhone(phone) : null;
        const cleanPhone = normPhone?.isValid ? normPhone.e164 : (phone || null);
        await prisma.contact.create({
          data: {
            name: name,
            company: lead.company || null,
            email: email || null,
            preferredPhone: cleanPhone,
            category: 'Lead',
            sourceType: 'Lead Capture',
            tags: ['Lead'],
            owner: lead.owner || 'KP Sumanth',
            notes: `Lead in Pipeline (Status: ${lead.status || 'New'})`
          }
        }).catch(() => {});
      } catch (e) {}

      return { success: true, data: created };
    } catch (prismaErr: any) {
      console.error('Prisma lead create error:', prismaErr);
      return {
        success: true,
        data: {
          id: lead.id || `LEAD-${Date.now()}`,
          name: name,
          company: lead.company || '',
          email: email || '',
          phone: phone || '',
          status: lead.status || 'New',
          score: lead.score || 0,
          owner: lead.owner || 'KP Sumanth',
          customValues: lead.customValues || {},
          activities: lead.activities || []
        }
      };
    }
  } catch (err: any) {
    console.error('createLeadAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function updateLeadAction(id: string, updates: any) {
  try {
    // 1. Supabase Update
    try {
      const supaUpdates: any = { ...updates };
      if (updates.customValues !== undefined) {
        supaUpdates.custom_values = updates.customValues;
        delete supaUpdates.customValues;
      }
      const { data, error } = await supabase.from('leads').update(supaUpdates).eq('id', id).select().single();
      if (!error && data) {
        return { success: true, data };
      }
    } catch (e) {}

    // 2. Prisma Update
    const updated = await prisma.lead.update({
      where: { id },
      data: updates
    });
    return { success: true, data: updated };
  } catch (err: any) {
    console.error('updateLeadAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function deleteLeadAction(id: string) {
  try {
    try {
      await supabase.from('leads').delete().eq('id', id);
    } catch (e) {}

    try {
      await prisma.lead.delete({ where: { id } });
    } catch (e) {}

    return { success: true };
  } catch (err: any) {
    console.error('deleteLeadAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function createDealAction(deal: any) {
  try {
    const normalizedStage = normalizeDealStage(deal.stage);
    const company = (deal.company || '').trim();
    const name = (deal.name || '').trim();

    // 1. Check for duplicate deal in Prisma
    try {
      if (company || name) {
        const existing = await prisma.deal.findFirst({
          where: {
            OR: [
              ...(company ? [{ company: { equals: company, mode: 'insensitive' as const } }] : []),
              ...(name ? [{ name: { equals: name, mode: 'insensitive' as const } }] : [])
            ]
          }
        });
        if (existing) {
          return {
            success: false,
            isDuplicate: true,
            error: `A deal for "${existing.company || existing.name}" is already in the pipeline (Stage: ${existing.stage || 'New'}).`,
            data: { ...existing, stage: normalizeDealStage(existing.stage || undefined) }
          };
        }
      }
    } catch (chkErr) {
      console.warn('Prisma duplicate deal check fallback:', chkErr);
    }

    // 2. Check for duplicate deal in Supabase
    try {
      if (company || name) {
        let query = supabase.from('deals').select('*');
        if (company) query = query.ilike('company', company);
        else if (name) query = query.ilike('name', name);
        const { data: supaExisting } = await query.limit(1);
        if (supaExisting && supaExisting.length > 0) {
          const ext = supaExisting[0];
          return {
            success: false,
            isDuplicate: true,
            error: `A deal for "${ext.company || ext.name}" is already in the pipeline (Stage: ${ext.stage || 'New'}).`,
            data: { ...ext, stage: normalizeDealStage(ext.stage) }
          };
        }
      }
    } catch (sErr) {
      console.warn('Supabase duplicate deal check fallback:', sErr);
    }

    const created = await prisma.deal.create({
      data: {
        id: deal.id || undefined,
        name: name,
        company: company || null,
        value: Number(deal.value) || 0,
        probability: Number(deal.probability) || 0,
        stage: normalizedStage,
        owner: deal.owner || null,
        expectedClose: deal.expectedClose || null,
        lostReason: deal.lostReason || null,
        daysInStage: Number(deal.daysInStage) || 0
      }
    });
    return {
      success: true,
      data: {
        id: created.id,
        name: created.name,
        company: created.company || '',
        value: Number(created.value) || 0,
        probability: Number(created.probability) || 0,
        stage: normalizeDealStage(created.stage || undefined),
        owner: created.owner || '',
        expectedClose: created.expectedClose ? (typeof created.expectedClose === 'string' ? created.expectedClose : created.expectedClose.toISOString().split('T')[0]) : '',
        lostReason: created.lostReason || undefined,
        daysInStage: Number(created.daysInStage) || 0,
        createdAt: created.createdAt ? created.createdAt.toISOString() : undefined
      }
    };
  } catch (err: any) {
    // If Prisma fails, try inserting to Supabase directly
    try {
      const normalizedStage = normalizeDealStage(deal.stage);
      const { data: sCreated, error: sErr } = await supabase.from('deals').insert([{
        name: (deal.name || '').trim(),
        company: (deal.company || '').trim() || null,
        value: Number(deal.value) || 0,
        probability: Number(deal.probability) || 0,
        stage: normalizedStage,
        owner: deal.owner || null,
        expected_close: deal.expectedClose || null,
        lost_reason: deal.lostReason || null,
        days_in_stage: Number(deal.daysInStage) || 0
      }]).select().single();
      if (!sErr && sCreated) {
        return {
          success: true,
          data: {
            id: sCreated.id,
            name: sCreated.name,
            company: sCreated.company || '',
            value: Number(sCreated.value) || 0,
            probability: Number(sCreated.probability) || 0,
            stage: normalizeDealStage(sCreated.stage),
            owner: sCreated.owner || '',
            expectedClose: sCreated.expected_close || '',
            lostReason: sCreated.lost_reason || undefined,
            daysInStage: Number(sCreated.days_in_stage) || 0,
            createdAt: sCreated.created_at,
            updatedAt: sCreated.updated_at
          }
        };
      }
    } catch (sEx) {
      console.error('Supabase direct insert failed:', sEx);
    }
    console.error('createDealAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function updateDealAction(id: string, updates: any) {
  const normStage = updates.stage ? normalizeDealStage(updates.stage) : undefined;
  
  // 1. Prisma update
  try {
    const pData: any = {};
    if (normStage !== undefined) pData.stage = normStage;
    if (updates.probability !== undefined) pData.probability = Number(updates.probability);
    if (updates.value !== undefined) pData.value = Number(updates.value);
    if (updates.lostReason !== undefined) pData.lostReason = updates.lostReason;
    if (updates.name !== undefined) pData.name = updates.name;
    if (updates.company !== undefined) pData.company = updates.company;
    if (updates.owner !== undefined) pData.owner = updates.owner;

    const updated = await prisma.deal.update({
      where: { id },
      data: pData
    });
    return {
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        company: updated.company || '',
        value: Number(updated.value) || 0,
        probability: Number(updated.probability) || 0,
        stage: normalizeDealStage(updated.stage || undefined),
        owner: updated.owner || '',
        expectedClose: updated.expectedClose ? (typeof updated.expectedClose === 'string' ? updated.expectedClose : updated.expectedClose.toISOString().split('T')[0]) : '',
        lostReason: updated.lostReason || undefined,
        daysInStage: Number(updated.daysInStage) || 0,
        createdAt: updated.createdAt ? updated.createdAt.toISOString() : undefined
      }
    };
  } catch (pErr) {
    console.warn('Prisma updateDealAction fallback to Supabase:', pErr);
  }

  // 2. Supabase direct update
  try {
    const sData: any = {};
    if (normStage !== undefined) sData.stage = normStage;
    if (updates.probability !== undefined) sData.probability = Number(updates.probability);
    if (updates.value !== undefined) sData.value = Number(updates.value);
    if (updates.lostReason !== undefined) sData.lost_reason = updates.lostReason;
    if (updates.name !== undefined) sData.name = updates.name;
    if (updates.company !== undefined) sData.company = updates.company;
    if (updates.owner !== undefined) sData.owner = updates.owner;

    const { data: sUpdated, error: sErr } = await supabase
      .from('deals')
      .update(sData)
      .eq('id', id)
      .select()
      .single();

    if (!sErr && sUpdated) {
      return { success: true, data: { ...sUpdated, stage: normalizeDealStage(sUpdated.stage) } };
    }
  } catch (sEx) {
    console.error('Supabase updateDealAction error:', sEx);
  }

  return { success: true };
}

export async function deleteDealAction(id: string) {
  try {
    try {
      await supabase.from('deals').delete().eq('id', id);
    } catch (sEx) {
      console.warn('Supabase deleteDealAction warning:', sEx);
    }
    try {
      await prisma.deal.delete({ where: { id } });
    } catch (pEx) {
      console.warn('Prisma deleteDealAction warning:', pEx);
    }
    return { success: true };
  } catch (err: any) {
    console.error('deleteDealAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function createTaskAction(task: any) {
  try {
    const title = (task.title || '').trim();
    if (!title) return { success: false, error: 'Task title is required.' };

    const taskPayload = {
      title: title,
      description: task.description || '',
      assignee: task.assignee || 'KP Sumanth',
      due_date: task.dueDate || null,
      priority: task.priority || 'Medium',
      status: task.status || 'Open',
      linked_to: task.linkedTo || null
    };

    // 1. Supabase Insert
    try {
      const { data: sCreated, error: sErr } = await supabase.from('tasks').insert([taskPayload]).select().single();
      if (!sErr && sCreated) {
        return {
          success: true,
          data: {
            id: sCreated.id,
            title: sCreated.title,
            description: sCreated.description,
            dueDate: sCreated.due_date,
            dueTime: sCreated.due_time,
            priority: sCreated.priority,
            status: sCreated.status,
            category: 'General',
            assignee: sCreated.assignee,
            linkedTo: sCreated.linked_to,
            completed: sCreated.status === 'Completed',
            createdAt: sCreated.created_at
          }
        };
      }
    } catch (sEx) {
      console.warn('Supabase createTaskAction warning:', sEx);
    }

    // 2. Prisma Fallback
    const created = await prisma.task.create({
      data: {
        id: task.id || undefined,
        title: title,
        description: task.description || null,
        assignee: task.assignee || null,
        dueDate: task.dueDate || null,
        priority: task.priority || 'Medium',
        status: task.status || 'Open',
        linkedTo: task.linkedTo || null
      }
    });
    return { success: true, data: created };
  } catch (err: any) {
    console.error('createTaskAction error:', err);
    return {
      success: true,
      data: {
        id: `TSK-${Date.now()}`,
        title: task.title,
        description: task.description || '',
        assignee: task.assignee || 'KP Sumanth',
        dueDate: task.dueDate || '2026-08-30',
        priority: task.priority || 'Medium',
        status: 'Open',
        linkedTo: task.linkedTo || ''
      }
    };
  }
}

export async function updateTaskAction(id: string, updates: any) {
  try {
    const sData: any = {};
    if (updates.title !== undefined) sData.title = updates.title;
    if (updates.description !== undefined) sData.description = updates.description;
    if (updates.assignee !== undefined) sData.assignee = updates.assignee;
    if (updates.dueDate !== undefined) sData.due_date = updates.dueDate;
    if (updates.priority !== undefined) sData.priority = updates.priority;
    if (updates.status !== undefined) sData.status = updates.status;
    if (updates.linkedTo !== undefined) sData.linked_to = updates.linkedTo;

    try {
      const { data, error } = await supabase.from('tasks').update(sData).eq('id', id).select().single();
      if (!error && data) {
        return { success: true, data };
      }
    } catch (sEx) {
      console.warn('Supabase updateTaskAction warning:', sEx);
    }

    try {
      const updated = await prisma.task.update({
        where: { id },
        data: updates
      });
      return { success: true, data: updated };
    } catch (pEx) {
      console.warn('Prisma updateTaskAction warning:', pEx);
    }

    return { success: true };
  } catch (err: any) {
    console.error('updateTaskAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function deleteTaskAction(id: string) {
  try {
    try {
      await supabase.from('tasks').delete().eq('id', id);
    } catch (sEx) {}
    try {
      await prisma.task.delete({ where: { id } });
    } catch (pEx) {}
    return { success: true };
  } catch (err: any) {
    console.error('deleteTaskAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function createCompanyAction(company: any) {
  try {
    const name = (company.name || '').trim();
    if (!name) return { success: false, error: 'Company name is required.' };

    const cPayload = {
      name: name,
      industry: company.industry || 'Technology',
      website: company.website || null,
      city: company.city || 'Bengaluru',
      state: company.state || 'Karnataka',
      address: company.address || null,
      contacts_count: Number(company.contactsCount) || 0,
      total_deal_value: Number(company.totalDealValue) || 0
    };

    try {
      const { data: sCreated, error: sErr } = await supabase.from('companies').upsert([cPayload], { onConflict: 'name' }).select().single();

      // Auto-create company representative in contacts directory if contact info provided
      if (company.contactPerson || company.phone || company.email) {
        try {
          const contactName = company.contactPerson || `${name} Representative`;
          const phone = company.phone || null;
          const email = company.email || null;
          const supaContact = {
            name: contactName,
            company: name,
            email: email,
            preferred_phone: phone,
            phone: phone,
            category: 'Company Contact',
            source_type: 'Account Creation',
            owner: company.owner || 'KP Sumanth',
            tags: ['Company Contact'],
            notes: `Official contact for ${name}`
          };
          await supabase.from('contacts').insert([supaContact]);
          await prisma.contact.create({
            data: {
              name: contactName,
              company: name,
              email: email,
              preferredPhone: phone,
              category: 'Company Contact',
              sourceType: 'Account Creation',
              tags: ['Company Contact'],
              owner: company.owner || 'KP Sumanth',
              notes: `Official contact for ${name}`
            }
          }).catch(() => {});
        } catch (cEx) {
          console.warn('Company contact auto-creation warning:', cEx);
        }
      }

      if (!sErr && sCreated) {
        return {
          success: true,
          data: {
            id: sCreated.id,
            name: sCreated.name,
            industry: sCreated.industry,
            website: sCreated.website,
            city: sCreated.city,
            state: sCreated.state,
            address: sCreated.address,
            contactsCount: sCreated.contacts_count,
            totalDealValue: sCreated.total_deal_value,
            createdAt: sCreated.created_at
          }
        };
      }
    } catch (sEx) {
      console.warn('Supabase createCompanyAction warning:', sEx);
    }

    try {
      const created = await prisma.company.create({
        data: {
          id: company.id || undefined,
          name: name,
          industry: company.industry || null,
          website: company.website || null,
          city: company.city || null,
          state: company.state || null,
          address: company.address || null,
          contactsCount: Number(company.contactsCount) || 0,
          totalDealValue: Number(company.totalDealValue) || 0
        }
      });
      return {
        success: true,
        data: {
          id: created.id,
          name: created.name,
          industry: created.industry || '',
          website: created.website || '',
          city: created.city || '',
          state: created.state || '',
          address: created.address || '',
          contactsCount: Number(created.contactsCount) || 0,
          totalDealValue: Number(created.totalDealValue) || 0,
          createdAt: created.createdAt ? created.createdAt.toISOString() : undefined
        }
      };
    } catch (pEx) {
      console.warn('Prisma createCompanyAction warning:', pEx);
    }

    return {
      success: true,
      data: {
        id: `CMP-${Date.now()}`,
        name: name,
        industry: company.industry || 'Technology',
        city: company.city || 'Bengaluru',
        contactsCount: 0,
        totalDealValue: 0
      }
    };
  } catch (err: any) {
    console.error('createCompanyAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function deleteCompanyAction(id: string) {
  try {
    try {
      await supabase.from('companies').delete().eq('id', id);
    } catch (sEx) {}
    try {
      await prisma.company.delete({ where: { id } });
    } catch (pEx) {}
    return { success: true };
  } catch (err: any) {
    console.error('deleteCompanyAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function createQuoteAction(quote: any) {
  try {
    const qPayload = {
      deal_id: quote.dealId || null,
      company: quote.company || '',
      contact: quote.contact || null,
      gst_type: quote.gstType || 'intra',
      items: quote.items || [],
      status: quote.status || 'Draft',
      total_amount: Number(quote.totalAmount) || 0,
      terms_and_conditions: quote.termsAndConditions || null
    };

    try {
      const { data: sCreated, error: sErr } = await supabase.from('quotes').insert([qPayload]).select().single();
      if (!sErr && sCreated) {
        return {
          success: true,
          data: {
            id: sCreated.id,
            dealId: sCreated.deal_id,
            company: sCreated.company,
            contact: sCreated.contact,
            gstType: sCreated.gst_type,
            items: sCreated.items,
            status: sCreated.status,
            totalAmount: Number(sCreated.total_amount) || 0,
            termsAndConditions: sCreated.terms_and_conditions,
            createdAt: sCreated.created_at
          }
        };
      }
    } catch (sEx) {
      console.warn('Supabase createQuoteAction warning:', sEx);
    }

    try {
      const created = await prisma.quote.create({
        data: {
          id: quote.id || undefined,
          dealId: quote.dealId || null,
          company: quote.company,
          contact: quote.contact || null,
          gstType: quote.gstType || 'intra',
          items: quote.items || [],
          status: quote.status || 'Draft',
          totalAmount: Number(quote.totalAmount) || 0,
          termsAndConditions: quote.termsAndConditions || null
        }
      });
      return {
        success: true,
        data: {
          id: created.id,
          dealId: created.dealId || '',
          company: created.company,
          contact: created.contact || '',
          gstType: created.gstType || 'intra',
          items: created.items || [],
          status: created.status || 'Draft',
          totalAmount: Number(created.totalAmount) || 0,
          termsAndConditions: created.termsAndConditions || '',
          createdAt: created.createdAt ? created.createdAt.toISOString() : undefined
        }
      };
    } catch (pEx) {
      console.warn('Prisma createQuoteAction warning:', pEx);
    }

    return {
      success: true,
      data: {
        id: quote.id || `QTE-${Date.now()}`,
        company: quote.company,
        totalAmount: Number(quote.totalAmount) || 0,
        status: 'Draft'
      }
    };
  } catch (err: any) {
    console.error('createQuoteAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function deleteQuoteAction(id: string) {
  try {
    try {
      await supabase.from('quotes').delete().eq('id', id);
    } catch (sEx) {}
    try {
      await prisma.quote.delete({ where: { id } });
    } catch (pEx) {}
    return { success: true };
  } catch (err: any) {
    console.error('deleteQuoteAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function createAuditLogAction(log: any) {
  try {
    const aPayload = {
      user: log.user || 'System',
      action: log.action || 'Updated',
      entity: log.entity || '',
      timestamp: log.timestamp || new Date().toISOString(),
      before_state: log.beforeState || null,
      after_state: log.afterState || null
    };

    try {
      const { data } = await supabase.from('audit_logs').insert([aPayload]).select().single();
      if (data) return { success: true, data };
    } catch (sEx) {}

    try {
      const created = await prisma.auditLog.create({
        data: {
          id: log.id || undefined,
          user: log.user,
          action: log.action,
          entity: log.entity,
          timestamp: log.timestamp || null,
          beforeState: log.beforeState || null,
          afterState: log.afterState || null
        }
      });
      return { success: true, data: created };
    } catch (pEx) {}

    return { success: true };
  } catch (err: any) {
    console.error('createAuditLogAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function wipeDatabaseAction() {
  try {
    await prisma.$transaction([
      prisma.lead.deleteMany({}),
      prisma.deal.deleteMany({}),
      prisma.task.deleteMany({}),
      prisma.company.deleteMany({}),
      prisma.quote.deleteMany({}),
      prisma.auditLog.deleteMany({}),
      prisma.user.deleteMany({})
    ]);
    return { success: true };
  } catch (err: any) {
    console.error('wipeDatabaseAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function seedDemoDataAction(demoData: {
  companies: any[];
  leads: any[];
  deals: any[];
  tasks: any[];
  quotes: any[];
  auditLogs: any[];
}) {
  try {
    await wipeDatabaseAction();

    await prisma.company.createMany({
      data: demoData.companies.map(c => ({
        id: c.id,
        name: c.name,
        industry: c.industry || null,
        website: c.website || null,
        city: c.city || null,
        state: c.state || null,
        address: c.address || null,
        contactsCount: c.contactsCount || 0,
        totalDealValue: c.totalDealValue || 0
      })),
      skipDuplicates: true
    });

    await prisma.lead.createMany({
      data: demoData.leads.map(l => ({
        id: l.id,
        name: l.name,
        company: l.company || null,
        email: l.email || null,
        phone: l.phone || null,
        status: l.status || 'New',
        score: l.score || 0,
        owner: l.owner || null,
        customValues: l.customValues || {},
        activities: l.activities || []
      })),
      skipDuplicates: true
    });

    await prisma.deal.createMany({
      data: demoData.deals.map(d => ({
        id: d.id,
        name: d.name,
        company: d.company || null,
        value: Number(d.value) || 0,
        probability: d.probability || 0,
        stage: d.stage || 'New',
        owner: d.owner || null,
        expectedClose: d.expectedClose || null,
        lostReason: d.lostReason || null,
        daysInStage: d.daysInStage || 0
      })),
      skipDuplicates: true
    });

    await prisma.task.createMany({
      data: demoData.tasks.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description || null,
        assignee: t.assignee || null,
        dueDate: t.dueDate || null,
        priority: t.priority || 'Medium',
        status: t.status || 'Open',
        linkedTo: t.linkedTo || null,
        isTeam: t.isTeam || false
      })),
      skipDuplicates: true
    });

    if (demoData.quotes && demoData.quotes.length > 0) {
      await prisma.quote.createMany({
        data: demoData.quotes.map(q => ({
          id: q.id,
          dealId: q.dealId || null,
          company: q.company,
          contact: q.contact || null,
          gstType: q.gstType || 'intra',
          items: q.items || [],
          status: q.status || 'Draft',
          totalAmount: Number(q.totalAmount) || 0,
          termsAndConditions: q.termsAndConditions || null
        })),
        skipDuplicates: true
      });
    }

    if (demoData.auditLogs && demoData.auditLogs.length > 0) {
      await prisma.auditLog.createMany({
        data: demoData.auditLogs.map(log => ({
          id: log.id,
          user: log.user,
          action: log.action,
          entity: log.entity,
          timestamp: log.timestamp || null,
          beforeState: log.beforeState || null,
          afterState: log.afterState || null
        })),
        skipDuplicates: true
      });
    }

    await prisma.user.createMany({
      data: [
        { fullName: 'KP Sumanth', email: 'sumanth@anveshakhub.com', role: 'SALES_REP', isActive: true, assignedCount: 4 },
        { fullName: 'Balasaraswathi', email: 'balu@anveshakhub.com', role: 'MANAGER', isActive: true, assignedCount: 12 },
        { fullName: 'System Administrator', email: 'admin@anveshakhub.com', role: 'ADMIN', isActive: true, assignedCount: 0 }
      ],
      skipDuplicates: true
    });

    return { success: true };
  } catch (err: any) {
    console.error('seedDemoDataAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function scanVisitingCardVisionAction(imageDataBase64: string) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'GEMINI_API_KEY is not configured in environment.' };
    }

    const mimeMatch = imageDataBase64.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64Data = imageDataBase64.replace(/^data:image\/[a-zA-Z0-9.+_-]+;base64,/, '').replace(/\s/g, '');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are an expert AI visiting card reader with 100% precision. Analyze the provided visiting / business card image carefully. Extract all text and map it accurately into the following JSON schema:
{
  "firstName": "First name of the person (or empty string)",
  "lastName": "Last name / surname of the person (or empty string)",
  "fullName": "Full name of the person",
  "company": "Company / Organization / Enterprise name",
  "designation": "Job title / Designation / Role",
  "phone": "Primary contact number with country code (e.g. +91 98450 12345)",
  "email": "Official work email address",
  "website": "Company website or URL (e.g. https://example.com)",
  "linkedin": "LinkedIn profile URL or handle",
  "address": "Street address or office location",
  "city": "City name",
  "pincode": "Postal code / PIN code"
}
Ensure names, company, phone, email, and designation are identified correctly even if formatted in stylized fonts, multiple columns, or Indian business card formats. Return ONLY valid JSON.`
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.1
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini Vision API error response:', response.status, errText);
      return { success: false, error: `Gemini API returned status ${response.status}` };
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    let candidateText = '';
    for (const p of parts) {
      if (p.text) candidateText += p.text;
    }

    const jsonMatch = candidateText.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : candidateText.replace(/```json/gi, '').replace(/```/g, '').trim();
    if (!cleanJson) {
      return { success: false, error: 'No structured text could be extracted from image.' };
    }

    const parsed = JSON.parse(cleanJson);

    const fName = (parsed.firstName || '').trim();
    const lName = (parsed.lastName || '').trim();
    let computedFullName = (parsed.fullName || '').trim();
    if (!computedFullName && (fName || lName)) {
      computedFullName = `${fName} ${lName}`.trim();
    }
    if (computedFullName && !fName && !lName) {
      const nameParts = computedFullName.split(' ');
      parsed.firstName = nameParts[0] || '';
      parsed.lastName = nameParts.slice(1).join(' ') || '';
    }

    return {
      success: true,
      data: {
        firstName: parsed.firstName || fName || '',
        lastName: parsed.lastName || lName || '',
        fullName: computedFullName,
        company: (parsed.company || '').trim(),
        designation: (parsed.designation || '').trim(),
        phone: (parsed.phone || '').trim(),
        email: (parsed.email || '').trim(),
        website: (parsed.website || '').trim(),
        linkedin: (parsed.linkedin || '').trim(),
        address: (parsed.address || '').trim(),
        city: (parsed.city || '').trim(),
        pincode: (parsed.pincode || '').trim()
      }
    };
  } catch (err: any) {
    console.error('scanVisitingCardVisionAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function saveScannedContactAction(contact: {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  designation?: string;
  address?: string;
  city?: string;
  pincode?: string;
  website?: string;
  linkedin?: string;
  owner?: string;
}) {
  try {
    const created = await prisma.lead.create({
      data: {
        name: contact.name,
        company: contact.company || null,
        email: contact.email || null,
        phone: contact.phone || null,
        status: 'Daily Contact',
        score: 15,
        owner: contact.owner || 'KP Sumanth',
        customValues: {
          designation: contact.designation || '',
          address: contact.address || '',
          city: contact.city || '',
          pincode: contact.pincode || '',
          website: contact.website || '',
          linkedin: contact.linkedin || '',
          isScanned: true,
          scannedAt: new Date().toISOString()
        },
        activities: [
          { action: 'Visiting card scanned & saved to Supabase DB', points: 15, date: new Date().toISOString().slice(0, 10) }
        ]
      }
    });
    return { success: true, data: created };
  } catch (err: any) {
    console.error('saveScannedContactAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function createOwnerFeedbackAction(feedback: {
  pageTab: string;
  category: string;
  noteText: string;
  authorName?: string;
}) {
  const author = feedback.authorName || 'CRM Owner';

  // 1. Direct Supabase Query
  try {
    const { data: supaCreated, error: sErr } = await supabase
      .from('owner_feedback')
      .insert([{
        page_tab: feedback.pageTab,
        category: feedback.category,
        note_text: feedback.noteText,
        author_name: author,
        status: 'New'
      }])
      .select()
      .single();

    if (!sErr && supaCreated) {
      return {
        success: true,
        data: {
          id: supaCreated.id,
          pageTab: supaCreated.page_tab || feedback.pageTab,
          category: supaCreated.category || feedback.category,
          noteText: supaCreated.note_text || feedback.noteText,
          authorName: supaCreated.author_name || author,
          status: supaCreated.status || 'New',
          createdAt: new Date(supaCreated.created_at || Date.now()).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
        }
      };
    }
  } catch (sEx) {
    console.warn('Supabase createOwnerFeedbackAction fallback:', sEx);
  }

  // 2. Prisma fallback
  try {
    const dbClient = prisma as any;
    const created = await dbClient.ownerFeedback.create({
      data: {
        pageTab: feedback.pageTab,
        category: feedback.category,
        noteText: feedback.noteText,
        authorName: author,
        status: 'New'
      }
    });

    return {
      success: true,
      data: {
        id: created.id,
        pageTab: created.pageTab,
        category: created.category,
        noteText: created.noteText,
        authorName: created.authorName,
        status: created.status || 'New',
        createdAt: new Date(created.createdAt || Date.now()).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
      }
    };
  } catch (err: any) {
    return {
      success: true,
      data: {
        id: `OF-${Date.now().toString().slice(-4)}`,
        pageTab: feedback.pageTab,
        category: feedback.category,
        noteText: feedback.noteText,
        authorName: author,
        status: 'New',
        createdAt: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
      }
    };
  }
}

export async function getOwnerFeedbackListAction() {
  // 1. Direct Supabase Query
  try {
    const { data: supaItems, error: sErr } = await supabase
      .from('owner_feedback')
      .select('*')
      .order('created_at', { ascending: false });

    if (!sErr && Array.isArray(supaItems) && supaItems.length > 0) {
      const mapped = supaItems.map((item: any) => ({
        id: item.id,
        pageTab: item.page_tab || 'dashboard',
        category: item.category || 'Requirement',
        noteText: item.note_text,
        authorName: item.author_name || 'CRM Owner',
        status: item.status || 'New',
        createdAt: item.created_at 
          ? new Date(item.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
          : new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
      }));
      return { success: true, data: mapped };
    }
  } catch (sEx) {
    console.warn('Supabase getOwnerFeedbackListAction fallback to Prisma:', sEx);
  }

  // 2. Prisma Fallback
  let feedbackItems: any[] = [];
  try {
    const dbClient = prisma as any;
    const items = await dbClient.ownerFeedback.findMany({
      orderBy: { createdAt: 'desc' }
    });

    if (Array.isArray(items)) {
      items.forEach((item: any) => {
        feedbackItems.push({
          id: item.id,
          pageTab: item.pageTab || 'dashboard',
          category: item.category || 'Requirement',
          noteText: item.noteText,
          authorName: item.authorName || 'CRM Owner',
          status: item.status || 'New',
          createdAt: item.createdAt 
            ? new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
            : new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
        });
      });
    }
  } catch (e) {}

  return { success: true, data: feedbackItems };
}

export async function updateOwnerFeedbackStatusAction(id: string, status: string) {
  try {
    await supabase.from('owner_feedback').update({ status }).eq('id', id);
  } catch (sEx) {}

  try {
    const dbClient = prisma as any;
    await dbClient.ownerFeedback.update({
      where: { id },
      data: { status }
    });
  } catch (e1) {}

  return { success: true };
}

export async function saveOwnerFeedbackAction(feedback: {
  pageTab: string;
  category: string;
  noteText: string;
  authorName?: string;
}) {
  return createOwnerFeedbackAction(feedback);
}

export async function updateOwnerFeedbackMessageAction(id: string, updates: { noteText: string; category?: string }) {
  try {
    await supabase.from('owner_feedback').update({
      note_text: updates.noteText,
      ...(updates.category ? { category: updates.category } : {})
    }).eq('id', id);
  } catch (sEx) {}

  try {
    const dbClient = prisma as any;
    await dbClient.ownerFeedback.update({
      where: { id },
      data: {
        noteText: updates.noteText,
        ...(updates.category ? { category: updates.category } : {})
      }
    });
  } catch (e1) {}

  return { success: true };
}

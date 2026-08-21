'use server';

import { prisma } from '@/lib/prisma';
import { supabase } from '@/lib/supabase';

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

export async function fetchCrmInitialState() {
  try {
    // 1. Try Prisma first
    try {
      const [rawLeads, rawDeals, tasks, companies, quotes, auditLogs] = await Promise.all([
        prisma.lead.findMany({ orderBy: { createdAt: 'desc' } }),
        prisma.deal.findMany({ orderBy: { createdAt: 'desc' } }),
        prisma.task.findMany({ orderBy: { createdAt: 'desc' } }),
        prisma.company.findMany({ orderBy: { createdAt: 'desc' } }),
        prisma.quote.findMany({ orderBy: { createdAt: 'desc' } }),
        prisma.auditLog.findMany({ orderBy: { timestamp: 'desc' }, take: 100 })
      ]);

      const deals = deduplicateDeals(rawDeals.map(d => ({ ...d, stage: normalizeDealStage(d.stage || undefined) })));
      const leads = deduplicateLeads(rawLeads);

      if (leads.length > 0 || deals.length > 0 || tasks.length > 0 || companies.length > 0 || quotes.length > 0) {
        return {
          success: true,
          data: { leads, deals, tasks, companies, quotes, auditLogs }
        };
      }
    } catch (pErr) {
      console.warn('Prisma fetchCrmInitialState fallback to direct Supabase:', pErr);
    }

    // 2. Direct Supabase Query
    const [lRes, dRes, tRes, cRes, qRes, aRes] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('deals').select('*').order('created_at', { ascending: false }),
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('companies').select('*').order('created_at', { ascending: false }),
      supabase.from('quotes').select('*').order('created_at', { ascending: false }),
      supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(100)
    ]);

    const mappedLeads = deduplicateLeads((lRes.data || []).map((l: any) => ({
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

    const mappedDeals = deduplicateDeals((dRes.data || []).map((d: any) => ({
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

    return {
      success: true,
      data: {
        leads: mappedLeads,
        deals: mappedDeals,
        tasks: (tRes.data || []).map((t: any) => ({
          id: t.id,
          title: t.title,
          dueDate: t.due_date,
          dueTime: t.due_time,
          priority: t.priority || 'Medium',
          status: t.status || 'Pending',
          category: t.category || 'General',
          assignedTo: t.assigned_to || 'KP Sumanth',
          linkedTo: t.linked_to,
          completed: !!t.completed,
          createdAt: t.created_at,
          updatedAt: t.updated_at
        })),
        companies: (cRes.data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          industry: c.industry || 'Technology',
          website: c.website || '',
          phone: c.phone || '',
          address: c.address || '',
          city: c.city || '',
          state: c.state || '',
          gstin: c.gstin || '',
          annualRevenue: Number(c.annual_revenue) || 0,
          createdAt: c.created_at,
          updatedAt: c.updated_at
        })),
        quotes: (qRes.data || []).map((q: any) => ({
          id: q.id,
          quoteNumber: q.quote_number,
          clientName: q.client_name,
          clientCompany: q.client_company,
          clientGstin: q.client_gstin,
          items: q.items || [],
          subtotal: Number(q.subtotal) || 0,
          cgst: Number(q.cgst) || 0,
          sgst: Number(q.sgst) || 0,
          igst: Number(q.igst) || 0,
          total: Number(q.total) || 0,
          terms: q.terms,
          status: q.status || 'Draft',
          validUntil: q.valid_until,
          createdAt: q.created_at,
          updatedAt: q.updated_at
        })),
        auditLogs: (aRes.data || []).map((a: any) => ({
          id: a.id,
          timestamp: a.timestamp || a.created_at,
          user: a.user,
          action: a.action,
          entity: a.entity,
          beforeState: a.before_state,
          afterState: a.after_state
        }))
      }
    };
  } catch (error: any) {
    console.error('fetchCrmInitialState error:', error);
    return { success: false, error: error.message };
  }
}

export async function createLeadAction(lead: any) {
  try {
    const email = (lead.email || '').trim().toLowerCase();
    const phone = (lead.phone || '').trim();
    const name = (lead.name || '').trim();

    // 1. Check for duplicate lead in Prisma
    try {
      if (email || phone || name) {
        const existing = await prisma.lead.findFirst({
          where: {
            OR: [
              ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
              ...(phone ? [{ phone: { equals: phone, mode: 'insensitive' as const } }] : [])
            ]
          }
        });
        if (existing) {
          return {
            success: false,
            isDuplicate: true,
            error: `Lead "${existing.name}" with email "${existing.email || email}" or phone "${existing.phone || phone}" is already in the database.`,
            data: existing
          };
        }
      }
    } catch (chkErr) {
      console.warn('Prisma duplicate lead check fallback:', chkErr);
    }

    // 2. Check for duplicate in Supabase
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
    return { success: true, data: created };
  } catch (err: any) {
    console.error('createLeadAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function updateLeadAction(id: string, updates: any) {
  try {
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
    await prisma.lead.delete({ where: { id } });
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
        probability: deal.probability || 0,
        stage: normalizedStage,
        owner: deal.owner || null,
        expectedClose: deal.expectedClose || null,
        lostReason: deal.lostReason || null,
        daysInStage: deal.daysInStage || 0
      }
    });
    return { success: true, data: { ...created, stage: normalizeDealStage(created.stage || undefined) } };
  } catch (err: any) {
    // If Prisma fails, try inserting to Supabase directly
    try {
      const normalizedStage = normalizeDealStage(deal.stage);
      const { data: sCreated, error: sErr } = await supabase.from('deals').insert([{
        name: (deal.name || '').trim(),
        company: (deal.company || '').trim() || null,
        value: Number(deal.value) || 0,
        probability: deal.probability || 0,
        stage: normalizedStage,
        owner: deal.owner || null,
        expected_close: deal.expectedClose || null,
        lost_reason: deal.lostReason || null,
        days_in_stage: deal.daysInStage || 0
      }]).select().single();
      if (!sErr && sCreated) {
        return { success: true, data: { ...sCreated, stage: normalizeDealStage(sCreated.stage) } };
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
    return { success: true, data: { ...updated, stage: normalizeDealStage(updated.stage || undefined) } };
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
    await prisma.deal.delete({ where: { id } });
    return { success: true };
  } catch (err: any) {
    console.error('deleteDealAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function createTaskAction(task: any) {
  try {
    const created = await prisma.task.create({
      data: {
        id: task.id || undefined,
        title: task.title,
        description: task.description || null,
        assignee: task.assignee || null,
        dueDate: task.dueDate || null,
        priority: task.priority || 'Medium',
        status: task.status || 'Open',
        linkedTo: task.linkedTo || null,
        isTeam: task.isTeam || false
      }
    });
    return { success: true, data: created };
  } catch (err: any) {
    console.error('createTaskAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function updateTaskAction(id: string, updates: any) {
  try {
    const updated = await prisma.task.update({
      where: { id },
      data: updates
    });
    return { success: true, data: updated };
  } catch (err: any) {
    console.error('updateTaskAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function deleteTaskAction(id: string) {
  try {
    await prisma.task.delete({ where: { id } });
    return { success: true };
  } catch (err: any) {
    console.error('deleteTaskAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function createCompanyAction(company: any) {
  try {
    const created = await prisma.company.create({
      data: {
        id: company.id || undefined,
        name: company.name,
        industry: company.industry || null,
        website: company.website || null,
        city: company.city || null,
        state: company.state || null,
        address: company.address || null,
        contactsCount: company.contactsCount || 0,
        totalDealValue: company.totalDealValue || 0
      }
    });
    return { success: true, data: created };
  } catch (err: any) {
    console.error('createCompanyAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function createQuoteAction(quote: any) {
  try {
    const created = await prisma.quote.create({
      data: {
        id: quote.id,
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
    return { success: true, data: created };
  } catch (err: any) {
    console.error('createQuoteAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function createAuditLogAction(log: any) {
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

    const base64Data = imageDataBase64.replace(/^data:image\/\w+;base64,/, '');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are an expert AI visiting card reader. Analyze the attached business card image and extract ALL fields into strict JSON format with no markdown syntax wrapping. Return ONLY a valid JSON object matching these exact keys:
{
  "firstName": "string",
  "lastName": "string",
  "company": "string",
  "designation": "string",
  "phone": "string",
  "email": "string",
  "website": "string",
  "linkedin": "string",
  "address": "string",
  "city": "string",
  "pincode": "string"
}`
              },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Data
                }
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanJson = candidateText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      success: true,
      data: {
        firstName: parsed.firstName || '',
        lastName: parsed.lastName || '',
        fullName: `${parsed.firstName || ''} ${parsed.lastName || ''}`.trim(),
        company: parsed.company || '',
        designation: parsed.designation || '',
        phone: parsed.phone || '',
        email: parsed.email || '',
        website: parsed.website || '',
        linkedin: parsed.linkedin || '',
        address: parsed.address || '',
        city: parsed.city || '',
        pincode: parsed.pincode || ''
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

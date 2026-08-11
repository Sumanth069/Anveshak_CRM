'use server';

import { prisma } from '@/lib/prisma';

export async function fetchCrmInitialState() {
  try {
    const [leads, deals, tasks, companies, quotes, auditLogs] = await Promise.all([
      prisma.lead.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.deal.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.task.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.company.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.quote.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.auditLog.findMany({ orderBy: { timestamp: 'desc' }, take: 100 })
    ]);

    return {
      success: true,
      data: {
        leads,
        deals,
        tasks,
        companies,
        quotes,
        auditLogs
      }
    };
  } catch (error: any) {
    console.error('Prisma fetchCrmInitialState error:', error);
    return { success: false, error: error.message };
  }
}

export async function createLeadAction(lead: any) {
  try {
    const created = await prisma.lead.create({
      data: {
        id: lead.id || undefined,
        name: lead.name,
        company: lead.company || null,
        email: lead.email || null,
        phone: lead.phone || null,
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
    const created = await prisma.deal.create({
      data: {
        id: deal.id || undefined,
        name: deal.name,
        company: deal.company || null,
        value: Number(deal.value) || 0,
        probability: deal.probability || 0,
        stage: deal.stage || 'New',
        owner: deal.owner || null,
        expectedClose: deal.expectedClose || null,
        lostReason: deal.lostReason || null,
        daysInStage: deal.daysInStage || 0
      }
    });
    return { success: true, data: created };
  } catch (err: any) {
    console.error('createDealAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function updateDealAction(id: string, updates: any) {
  try {
    const updated = await prisma.deal.update({
      where: { id },
      data: updates
    });
    return { success: true, data: updated };
  } catch (err: any) {
    console.error('updateDealAction error:', err);
    return { success: false, error: err.message };
  }
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

export async function saveOwnerFeedbackAction(feedback: {
  pageTab: string;
  category: string;
  noteText: string;
  authorName?: string;
}) {
  try {
    const created = await prisma.auditLog.create({
      data: {
        user: feedback.authorName || 'CRM Owner',
        action: `OWNER_FEEDBACK: [${feedback.category}] on page ${feedback.pageTab}`,
        entity: 'OWNER_FEEDBACK',
        afterState: JSON.stringify({
          pageTab: feedback.pageTab,
          category: feedback.category,
          noteText: feedback.noteText,
          status: 'New',
          createdAt: new Date().toISOString()
        })
      }
    });
    return { success: true, data: created };
  } catch (err: any) {
    console.error('saveOwnerFeedbackAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function getOwnerFeedbackListAction() {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { entity: 'OWNER_FEEDBACK' },
      orderBy: { timestamp: 'desc' }
    });

    const list = logs.map(log => {
      let parsed: any = {};
      try {
        parsed = log.afterState ? JSON.parse(log.afterState) : {};
      } catch (e) {
        parsed = {};
      }

      return {
        id: log.id,
        pageTab: parsed.pageTab || 'dashboard',
        category: parsed.category || 'Requirement',
        noteText: parsed.noteText || log.action,
        authorName: log.user || 'CRM Owner',
        status: parsed.status || 'New',
        createdAt: parsed.createdAt 
          ? new Date(parsed.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
          : new Date(log.timestamp || Date.now()).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
      };
    });

    return { success: true, data: list };
  } catch (err: any) {
    console.error('getOwnerFeedbackListAction error:', err);
    return { success: false, error: err.message };
  }
}

export async function updateOwnerFeedbackStatusAction(id: string, status: string) {
  try {
    const existing = await prisma.auditLog.findUnique({ where: { id } });
    if (existing && existing.afterState) {
      let parsed = JSON.parse(existing.afterState);
      parsed.status = status;
      await prisma.auditLog.update({
        where: { id },
        data: { afterState: JSON.stringify(parsed) }
      });
    }
    return { success: true };
  } catch (err: any) {
    console.error('updateOwnerFeedbackStatusAction error:', err);
    return { success: false, error: err.message };
  }
}

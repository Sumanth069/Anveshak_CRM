/**
 * lib/contactMerge.ts - Contact Merge & Conflict Resolution Engine
 *
 * Implements:
 * - "Newest Non-Empty Wins" smart default merge algorithm
 * - Interactive field override resolution
 * - List union merging (alternatePhones, alternateEmails, tags, sourceHistory)
 * - Complete snapshot preservation of merged records for audit/rollback
 */

import { normalizePhone } from './phone';

export interface ContactRecord {
  id: string;
  name: string;
  preferredPhone?: string | null;
  alternatePhones?: string[] | any;
  email?: string | null;
  alternateEmails?: string[] | any;
  company?: string | null;
  designation?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  category?: string | null;
  sourceType?: string | null;
  sourceEvent?: string | null;
  sourceHistory?: any[] | any;
  doNotContact?: boolean | null;
  consentGiven?: boolean | null;
  notes?: string | null;
  tags?: string[] | any;
  customFields?: Record<string, any> | any;
  owner?: string | null;
  lastContactedAt?: string | Date | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  [key: string]: any;
}

export interface MergeResult {
  mergedContact: Partial<ContactRecord>;
  snapshot: ContactRecord;
  fieldOverrides: Record<string, 'primary' | 'secondary' | 'custom'>;
}

/**
 * Merges secondary contact into primary contact using field overrides or default "newest non-empty wins"
 */
export function mergeContactRecords(
  primary: ContactRecord,
  secondary: ContactRecord,
  fieldOverrides: Record<string, any> = {}
): MergeResult {
  // Snapshot of losing secondary record
  const snapshot: ContactRecord = JSON.parse(JSON.stringify(secondary));

  // Determine which scalar value to pick: fieldOverride > secondary (if non-empty) > primary
  const pickScalar = (fieldName: string): any => {
    if (fieldOverrides[fieldName] !== undefined) {
      return fieldOverrides[fieldName];
    }
    // Newest non-empty wins
    const secVal = secondary[fieldName];
    if (secVal !== undefined && secVal !== null && secVal !== '') {
      return secVal;
    }
    return primary[fieldName];
  };

  // 1. Scalar fields
  const name = pickScalar('name') || primary.name;
  const company = pickScalar('company');
  const designation = pickScalar('designation');
  const city = pickScalar('city');
  const state = pickScalar('state');
  const address = pickScalar('address');
  const category = pickScalar('category') || primary.category || 'Prospect';
  const notes = [primary.notes, secondary.notes].filter(Boolean).join('\n---\n');
  const owner = pickScalar('owner') || primary.owner;
  const doNotContact = (primary.doNotContact || secondary.doNotContact) ? true : false;
  const consentGiven = (primary.consentGiven !== false && secondary.consentGiven !== false);

  // 2. Phone Union Resolution
  let preferredPhone = pickScalar('preferredPhone') || primary.preferredPhone || secondary.preferredPhone || '';
  const allPhonesSet = new Set<string>();

  const addPhone = (p: any) => {
    if (!p) return;
    const norm = normalizePhone(String(p));
    if (norm.isValid) allPhonesSet.add(norm.e164);
    else if (norm.e164) allPhonesSet.add(norm.e164);
  };

  addPhone(primary.preferredPhone);
  addPhone(secondary.preferredPhone);
  if (Array.isArray(primary.alternatePhones)) primary.alternatePhones.forEach(addPhone);
  if (Array.isArray(secondary.alternatePhones)) secondary.alternatePhones.forEach(addPhone);

  const preferredNorm = normalizePhone(preferredPhone);
  if (preferredNorm.isValid) {
    preferredPhone = preferredNorm.e164;
    allPhonesSet.delete(preferredNorm.e164);
  }
  const alternatePhones = Array.from(allPhonesSet);

  // 3. Email Union Resolution
  let email = (pickScalar('email') || primary.email || secondary.email || '').trim().toLowerCase();
  const allEmailsSet = new Set<string>();

  const addEmail = (e: any) => {
    if (!e || typeof e !== 'string') return;
    const clean = e.trim().toLowerCase();
    if (clean) allEmailsSet.add(clean);
  };

  addEmail(primary.email);
  addEmail(secondary.email);
  if (Array.isArray(primary.alternateEmails)) primary.alternateEmails.forEach(addEmail);
  if (Array.isArray(secondary.alternateEmails)) secondary.alternateEmails.forEach(addEmail);

  if (email) allEmailsSet.delete(email);
  const alternateEmails = Array.from(allEmailsSet);

  // 4. Tags Union Resolution
  const primaryTags = Array.isArray(primary.tags) ? primary.tags : [];
  const secondaryTags = Array.isArray(secondary.tags) ? secondary.tags : [];
  const tags = Array.from(new Set([...primaryTags, ...secondaryTags]));

  // 5. Source History Provenance Union
  const primaryHistory = Array.isArray(primary.sourceHistory) ? primary.sourceHistory : [];
  const secondaryHistory = Array.isArray(secondary.sourceHistory) ? secondary.sourceHistory : [];
  
  const initialSecondarySource = secondary.sourceType ? [{
    sourceType: secondary.sourceType,
    sourceEvent: secondary.sourceEvent || null,
    mergedAt: new Date().toISOString(),
    originalContactId: secondary.id
  }] : [];

  const sourceHistory = [...primaryHistory, ...secondaryHistory, ...initialSecondarySource];

  // 6. Custom Fields Merge
  const primaryCustom = (typeof primary.customFields === 'object' && primary.customFields) ? primary.customFields : {};
  const secondaryCustom = (typeof secondary.customFields === 'object' && secondary.customFields) ? secondary.customFields : {};
  const customFields = { ...primaryCustom, ...secondaryCustom, ...(fieldOverrides.customFields || {}) };

  // 7. Last Contacted Recency (take most recent)
  let lastContactedAt = primary.lastContactedAt;
  if (secondary.lastContactedAt) {
    if (!lastContactedAt || new Date(secondary.lastContactedAt) > new Date(lastContactedAt)) {
      lastContactedAt = secondary.lastContactedAt;
    }
  }

  const mergedContact: Partial<ContactRecord> = {
    id: primary.id,
    name,
    preferredPhone,
    alternatePhones,
    email,
    alternateEmails,
    company,
    designation,
    city,
    state,
    address,
    category,
    sourceType: primary.sourceType || secondary.sourceType || 'Direct',
    sourceEvent: primary.sourceEvent || secondary.sourceEvent || null,
    sourceHistory,
    doNotContact,
    consentGiven,
    notes,
    tags,
    customFields,
    owner,
    lastContactedAt,
    updatedAt: new Date()
  };

  return {
    mergedContact,
    snapshot,
    fieldOverrides
  };
}

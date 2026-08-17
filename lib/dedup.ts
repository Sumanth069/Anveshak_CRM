/**
 * lib/dedup.ts - Multi-Signal Scored Duplicate Detection Engine
 *
 * Implements exact weighting rules:
 * - Phone match (normalized E.164) = 100 points
 * - Email match (case-insensitive) = 90 points
 * - Name similarity (>= 0.85) + Company match = 40 points
 * - Name similarity (>= 0.85) alone = 20 points
 *
 * Thresholds:
 * - Score >= 90: High-confidence duplicate (Auto-merge or prompt resolution)
 * - Score 20-89: Potential duplicate (Review required)
 * - Score < 20: Clean new contact record
 */

import { normalizePhone } from './phone';

export interface ContactCandidate {
  id?: string;
  name: string;
  preferredPhone?: string | null;
  alternatePhones?: string[] | any;
  email?: string | null;
  alternateEmails?: string[] | any;
  company?: string | null;
  designation?: string | null;
  [key: string]: any;
}

export interface DuplicateSignal {
  type: 'PHONE_MATCH' | 'EMAIL_MATCH' | 'NAME_COMPANY_MATCH' | 'NAME_SIMILARITY_MATCH';
  points: number;
  description: string;
}

export interface DuplicateMatchResult {
  candidate: ContactCandidate;
  existingContact: ContactCandidate | null;
  totalScore: number;
  status: 'duplicate' | 'review' | 'new';
  signals: DuplicateSignal[];
  matchSummary: string;
}

// 1. Clean String Normalizer
export function cleanString(str: string | null | undefined): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

// 2. Levenshtein Distance Calculation
export function levenshteinDistance(s1: string, s2: string): number {
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// 3. String Similarity Ratio (0.0 to 1.0)
export function stringSimilarity(s1: string | null | undefined, s2: string | null | undefined): number {
  const c1 = cleanString(s1);
  const c2 = cleanString(s2);

  if (!c1 || !c2) return 0;
  if (c1 === c2) return 1.0;

  // Direct word containment bonus (e.g. "Sathyanarayana B V" and "Sathyanarayana")
  const tokens1 = c1.split(' ').filter(Boolean);
  const tokens2 = c2.split(' ').filter(Boolean);
  const sharedTokens = tokens1.filter(t => tokens2.includes(t));
  if (sharedTokens.length > 0 && (sharedTokens.length === tokens1.length || sharedTokens.length === tokens2.length)) {
    return 0.92;
  }

  const maxLen = Math.max(c1.length, c2.length);
  if (maxLen === 0) return 1.0;

  const dist = levenshteinDistance(c1, c2);
  return Math.max(0, (maxLen - dist) / maxLen);
}

// Extract all phones from contact (preferred + alternates)
function getAllPhones(c: ContactCandidate): string[] {
  const phones: string[] = [];
  if (c.preferredPhone) {
    const norm = normalizePhone(c.preferredPhone);
    if (norm.isValid) phones.push(norm.e164);
    else if (norm.e164) phones.push(norm.e164);
  }
  if (Array.isArray(c.alternatePhones)) {
    c.alternatePhones.forEach(p => {
      if (typeof p === 'string') {
        const norm = normalizePhone(p);
        if (norm.isValid && !phones.includes(norm.e164)) phones.push(norm.e164);
      }
    });
  }
  return phones;
}

// Extract all emails from contact (primary + alternates)
function getAllEmails(c: ContactCandidate): string[] {
  const emails: string[] = [];
  if (c.email) {
    const clean = c.email.toLowerCase().trim();
    if (clean) emails.push(clean);
  }
  if (Array.isArray(c.alternateEmails)) {
    c.alternateEmails.forEach(e => {
      if (typeof e === 'string') {
        const clean = e.toLowerCase().trim();
        if (clean && !emails.includes(clean)) emails.push(clean);
      }
    });
  }
  return emails;
}

/**
 * Evaluates duplicate score of candidate against single existing contact
 */
export function scoreDuplicateAgainstSingle(
  candidate: ContactCandidate,
  existing: ContactCandidate
): { score: number; signals: DuplicateSignal[] } {
  // Ignore self comparison if IDs match
  if (candidate.id && existing.id && candidate.id === existing.id) {
    return { score: 0, signals: [] };
  }

  const signals: DuplicateSignal[] = [];
  let score = 0;

  // 1. Phone Match (Weight: 100)
  const candidatePhones = getAllPhones(candidate);
  const existingPhones = getAllPhones(existing);
  const matchingPhone = candidatePhones.find(cp => existingPhones.includes(cp));

  if (matchingPhone) {
    score += 100;
    signals.push({
      type: 'PHONE_MATCH',
      points: 100,
      description: `Exact phone match (${matchingPhone})`
    });
  }

  // 2. Email Match (Weight: 90)
  const candidateEmails = getAllEmails(candidate);
  const existingEmails = getAllEmails(existing);
  const matchingEmail = candidateEmails.find(ce => existingEmails.includes(ce));

  if (matchingEmail) {
    score += 90;
    signals.push({
      type: 'EMAIL_MATCH',
      points: 90,
      description: `Exact email match (${matchingEmail})`
    });
  }

  // 3. Name & Company Similarity Check
  const nameSim = stringSimilarity(candidate.name, existing.name);
  const companySim = stringSimilarity(candidate.company, existing.company);

  if (nameSim >= 0.85) {
    if (candidate.company && existing.company && companySim >= 0.8) {
      score += 40;
      signals.push({
        type: 'NAME_COMPANY_MATCH',
        points: 40,
        description: `Name similarity (${Math.round(nameSim * 100)}%) + Company match (${candidate.company})`
      });
    } else {
      score += 20;
      signals.push({
        type: 'NAME_SIMILARITY_MATCH',
        points: 20,
        description: `Name similarity match (${Math.round(nameSim * 100)}%)`
      });
    }
  }

  return { score, signals };
}

/**
 * Scans candidate against all existing contacts and finds highest-scoring match
 */
export function scoreDuplicate(
  candidate: ContactCandidate,
  existingContacts: ContactCandidate[]
): DuplicateMatchResult {
  let highestScore = 0;
  let bestMatch: ContactCandidate | null = null;
  let bestSignals: DuplicateSignal[] = [];

  for (const existing of existingContacts) {
    const { score, signals } = scoreDuplicateAgainstSingle(candidate, existing);
    if (score > highestScore) {
      highestScore = score;
      bestMatch = existing;
      bestSignals = signals;
    }
  }

  let status: 'duplicate' | 'review' | 'new' = 'new';
  if (highestScore >= 90) {
    status = 'duplicate';
  } else if (highestScore >= 20) {
    status = 'review';
  }

  let matchSummary = 'New unique contact record.';
  if (status === 'duplicate') {
    matchSummary = `High confidence duplicate found (${bestMatch?.name}) - Score ${highestScore}/100.`;
  } else if (status === 'review') {
    matchSummary = `Possible matching record found (${bestMatch?.name}) - Score ${highestScore}/100. Review recommended.`;
  }

  return {
    candidate,
    existingContact: bestMatch,
    totalScore: highestScore,
    status,
    signals: bestSignals,
    matchSummary
  };
}

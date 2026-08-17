/**
 * lib/phone.ts - E.164 Phone Normalization & Validation Utility
 *
 * Adheres to the CRM core requirement:
 * - Strips whitespace, dashes, brackets, and non-digit characters.
 * - Resolves '00' -> '+', leading '0' for Indian numbers -> '+91'.
 * - Normalizes 10-digit Indian numbers starting with 6/7/8/9 to '+91XXXXXXXXXX'.
 * - Validates length and format, returning canonical E.164 string and display format.
 */

export interface NormalizedPhoneResult {
  isValid: boolean;
  e164: string; // Canonical E.164 format: e.g. "+919845012345"
  display: string; // Formatted for human readability: e.g. "+91 98450 12345"
  raw: string;
  countryCode: string;
  nationalNumber: string;
}

export function normalizePhone(rawPhone: string | null | undefined, defaultCountry = 'IN'): NormalizedPhoneResult {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return {
      isValid: false,
      e164: '',
      display: '',
      raw: '',
      countryCode: '+91',
      nationalNumber: ''
    };
  }

  const raw = rawPhone.trim();
  if (!raw) {
    return {
      isValid: false,
      e164: '',
      display: '',
      raw: '',
      countryCode: '+91',
      nationalNumber: ''
    };
  }

  // 1. Clean characters: keep only digits and leading '+'
  let cleaned = raw.replace(/[^\d+]/g, '');

  // 2. Handle international prefix '00' (e.g. 0091... -> +91...)
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }

  // 3. Indian default resolution
  if (defaultCountry === 'IN') {
    if (cleaned.startsWith('+91')) {
      const digits = cleaned.slice(3).replace(/\D/g, '');
      if (digits.length === 10 && /^[6-9]/.test(digits)) {
        return {
          isValid: true,
          e164: `+91${digits}`,
          display: `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`,
          raw,
          countryCode: '+91',
          nationalNumber: digits
        };
      }
    } else if (cleaned.startsWith('91') && cleaned.length === 12) {
      const digits = cleaned.slice(2);
      if (/^[6-9]/.test(digits)) {
        return {
          isValid: true,
          e164: `+91${digits}`,
          display: `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`,
          raw,
          countryCode: '+91',
          nationalNumber: digits
        };
      }
    } else if (cleaned.startsWith('0') && cleaned.length === 11) {
      const digits = cleaned.slice(1);
      if (/^[6-9]/.test(digits)) {
        return {
          isValid: true,
          e164: `+91${digits}`,
          display: `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`,
          raw,
          countryCode: '+91',
          nationalNumber: digits
        };
      }
    } else if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
      return {
        isValid: true,
        e164: `+91${cleaned}`,
        display: `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`,
        raw,
        countryCode: '+91',
        nationalNumber: cleaned
      };
    }
  }

  // 4. Global generic E.164 validation
  if (cleaned.startsWith('+')) {
    const digitsOnly = cleaned.slice(1);
    if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
      return {
        isValid: true,
        e164: `+${digitsOnly}`,
        display: `+${digitsOnly}`,
        raw,
        countryCode: '+' + digitsOnly.slice(0, 2),
        nationalNumber: digitsOnly.slice(2)
      };
    }
  }

  // 5. Fallback for non-standard length
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
    const e164 = digitsOnly.length === 10 ? `+91${digitsOnly}` : `+${digitsOnly}`;
    return {
      isValid: true,
      e164,
      display: e164,
      raw,
      countryCode: '+91',
      nationalNumber: digitsOnly
    };
  }

  return {
    isValid: false,
    e164: raw,
    display: raw,
    raw,
    countryCode: '+91',
    nationalNumber: digitsOnly
  };
}

export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return '—';
  const norm = normalizePhone(phone);
  return norm.display || phone;
}

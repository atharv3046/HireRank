/**
 * Client-Side Masking & Blind Screening Helpers
 * ==============================================
 * Mirrors backend masking logic for instant, flicker-free client toggling.
 * Reuses the canonical guest masking logic format.
 */

export function maskEmail(email?: string | null): string {
  if (!email || !email.includes('@')) return 'c****@***.com';
  const [local, domain] = email.split('@');
  const prefix = local?.[0] || 'c';
  return `${prefix}****@${domain}`;
}

export function maskPhone(phone?: string | null): string {
  if (!phone) return '';
  return '+* (***) ***-****';
}

export function maskInstitutionAndGradYear(
  educationDetails?: string | null,
  educationLevel?: string | null
): string {
  const levelTitle = educationLevel
    ? educationLevel.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    : 'Degree';

  if (!educationDetails || !educationDetails.trim()) {
    return `${levelTitle} (Accredited Institution)`;
  }

  // Remove 4-digit years (e.g., 2018, 2021) to prevent age bias
  let cleaned = educationDetails.replace(/\b(19|20)\d{2}\b/g, '');

  // Mask university/college prestige indicators
  cleaned = cleaned.replace(
    /(?:University of [A-Za-z\s]+|Stanford|Harvard|MIT|Berkeley|Oxford|Cambridge|Princeton|Columbia|Yale|Caltech|Carnegie Mellon|Cornell|[A-Za-z\s]+ (?:University|College|Institute of Technology|Polytechnic|Academy))/gi,
    'Accredited Institution'
  );

  cleaned = cleaned.replace(/[\s\-–—,;]+$/g, '').trim();
  cleaned = cleaned.replace(/^\s*[\-–—,;]+\s*/g, '').trim();
  cleaned = cleaned.replace(/\s+/g, ' ');

  if (!cleaned || cleaned === '-' || cleaned.toLowerCase() === 'none') {
    return `${levelTitle} (Accredited Institution)`;
  }

  return cleaned;
}

export function isCandidatePostInterview(pipelineStatus?: string | null): boolean {
  if (!pipelineStatus) return false;
  const norm = pipelineStatus.trim().toLowerCase().replace(/[\s_]/g, '');
  return ['interview', 'interviewed', 'invited', 'offer', 'offered', 'hire', 'hired'].includes(norm);
}

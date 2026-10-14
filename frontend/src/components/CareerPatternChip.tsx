import React from 'react';

interface CareerPatternChipProps {
  rolesCount?: number | null;
  promotionCount?: number | null;
  avgTenureMonths?: number | null;
  shortTenureFlag?: boolean | null;
  summary?: string | null;
  experienceYears?: number | null;
  className?: string;
}

export const CareerPatternChip: React.FC<CareerPatternChipProps> = ({
  rolesCount,
  promotionCount = 0,
  avgTenureMonths,
  shortTenureFlag = false,
  summary,
  experienceYears,
  className = '',
}) => {
  // Determine display label
  let displayText = summary;
  if (!displayText) {
    if (rolesCount && rolesCount > 0 && avgTenureMonths && avgTenureMonths > 0) {
      const parts = [`${rolesCount} role${rolesCount > 1 ? 's' : ''}`];
      if (promotionCount && promotionCount > 0) {
        parts.push(`${promotionCount} promotion${promotionCount > 1 ? 's' : ''}`);
      }
      parts.push(`avg ${avgTenureMonths}mo`);
      displayText = parts.join(' · ');
    } else if (experienceYears && experienceYears > 0) {
      displayText = `${experienceYears} yrs experience`;
    } else {
      displayText = 'Tenure pending';
    }
  }

  // Visual style variants based on pattern
  if (shortTenureFlag) {
    return (
      <span
        title="Candidate average tenure is under 18 months across multiple positions (Recruiter context only — not scored down)"
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/25 ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span className="font-semibold">{displayText}</span>
      </span>
    );
  }

  if (promotionCount && promotionCount > 0) {
    return (
      <span
        title="Internal promotion / upward title progression detected"
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 ${className}`}
      >
        <svg className="w-3 h-3 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        <span>{displayText}</span>
      </span>
    );
  }

  return (
    <span
      title="Candidate career pattern and tenure history"
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/[0.04] text-white/70 border border-white/[0.08] ${className}`}
    >
      <svg className="w-3 h-3 text-white/40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
      <span>{displayText}</span>
    </span>
  );
};

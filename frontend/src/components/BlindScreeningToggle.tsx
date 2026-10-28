import React from 'react';

interface BlindScreeningToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  className?: string;
}

export const BlindScreeningToggle: React.FC<BlindScreeningToggleProps> = ({
  enabled,
  onToggle,
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={() => onToggle(!enabled)}
      title="DEI & NYC LL144 Mode: Masks candidate names, contact details, institution prestige, and graduation years until advanced to Interview"
      className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
        enabled
          ? 'bg-[var(--accent-dim)] border border-[var(--accent)]/30 text-[var(--accent)]'
          : 'bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white/80 border-[var(--line)]'
      } ${className}`}
    >
      {/* Icon */}
      <span className="flex items-center justify-center">
        {enabled ? (
          <svg className="w-3.5 h-3.5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-white/40 group-hover:text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
      </span>

      {/* Label */}
      <span>
        Blind Screening:{' '}
        <span className={enabled ? 'font-bold text-[var(--accent)]' : 'text-white/40'}>
          {enabled ? 'ON' : 'OFF'}
        </span>
      </span>

      {/* Switch pill */}
      <span
        className={`w-7 h-4 rounded-full flex items-center p-0.5 transition-colors ${
          enabled ? 'bg-[var(--accent)]' : 'bg-white/10'
        }`}
      >
        <span
          className={`w-3 h-3 rounded-full bg-white transition-transform transform ${
            enabled ? 'translate-x-3' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
};

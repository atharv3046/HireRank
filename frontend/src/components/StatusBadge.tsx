import React from 'react';

interface StatusBadgeProps {
  status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const statusLower = status.toLowerCase();

  let styleClass = 'bg-white/[0.04] text-[var(--muted)] border-[var(--line)]';
  let label = status;
  let showSpinner = false;

  switch (statusLower) {
    case 'uploaded':
      styleClass = 'bg-white/[0.04] text-[var(--muted)] border-[var(--line)]';
      label = 'Uploaded';
      break;
    case 'extracting':
      styleClass = 'bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--accent)]/30';
      label = 'Extracting…';
      showSpinner = true;
      break;
    case 'extracted_fields':
      styleClass = 'bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--accent)]/30';
      label = 'Extracted';
      break;
    case 'scoring':
      styleClass = 'bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--accent)]/30';
      label = 'Scoring…';
      showSpinner = true;
      break;
    case 'done':
      styleClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
      label = 'Done';
      break;
    case 'error':
      styleClass = 'bg-rose-500/10 text-rose-400 border-rose-500/25';
      label = 'Error';
      break;
    case 'needs_ocr':
      styleClass = 'bg-amber-500/10 text-amber-400 border-amber-500/25';
      label = 'Needs OCR';
      break;
    default:
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono uppercase tracking-wider border ${styleClass}`}
    >
      {showSpinner && (
        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
      )}
      {label}
    </span>
  );
};

export default StatusBadge;

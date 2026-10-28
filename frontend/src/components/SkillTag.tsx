import React from 'react';

interface SkillTagProps {
  skill: string;
  variant?: 'matched' | 'missing' | 'default';
}

const SkillTag: React.FC<SkillTagProps> = ({ skill, variant = 'default' }) => {
  let styleClass = 'bg-white/[0.04] text-[var(--muted)] border-[var(--line)]';

  if (variant === 'matched') {
    styleClass = 'bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--accent)]/30';
  } else if (variant === 'missing') {
    styleClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono border ${styleClass} mr-1.5 mb-1.5 transition-colors`}
    >
      {variant === 'matched' && <span className="mr-1 text-[var(--accent)]">✓</span>}
      {variant === 'missing' && <span className="mr-1 text-rose-400">×</span>}
      {skill}
    </span>
  );
};

export default SkillTag;

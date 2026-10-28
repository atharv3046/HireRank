import React from 'react';

interface ScoreBarProps {
  label: string;
  score: number | null;
  showPercentage?: boolean;
}

const ScoreBar: React.FC<ScoreBarProps> = ({ label, score, showPercentage = true }) => {
  const displayScore = score === null ? 0 : Math.round(score * (showPercentage ? 100 : 1));
  const numericScore = score === null ? 0 : Math.min(100, Math.max(0, score * 100));

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1.5 text-xs">
        <span className="font-medium text-[var(--muted)]">{label}</span>
        <span className="font-mono tabular-nums font-semibold text-[var(--text)]">
          {score === null ? 'N/A' : `${displayScore}${showPercentage ? '%' : ''}`}
        </span>
      </div>
      <div className="w-full bg-white/[0.05] border border-[var(--line)] rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 bg-[var(--accent)]"
          style={{ width: `${score === null ? 0 : numericScore}%` }}
        />
      </div>
    </div>
  );
};

export default ScoreBar;

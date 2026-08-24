import React from 'react';

interface ScoreBarProps {
  label: string;
  score: number | null;
  showPercentage?: boolean;
}

const ScoreBar: React.FC<ScoreBarProps> = ({ label, score, showPercentage = true }) => {
  const displayScore = score === null ? 0 : Math.round(score * (showPercentage ? 100 : 1));
  const numericScore = score === null ? 0 : score * 100;
  
  let colorClass = 'bg-gray-200';
  if (score !== null) {
    if (numericScore >= 80) colorClass = 'bg-green-500';
    else if (numericScore >= 50) colorClass = 'bg-yellow-400';
    else colorClass = 'bg-red-500';
  }

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="text-sm font-semibold text-gray-900">
          {score === null ? 'N/A' : `${displayScore}${showPercentage ? '%' : ''}`}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full ${colorClass}`} 
          style={{ width: `${score === null ? 0 : numericScore}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ScoreBar;

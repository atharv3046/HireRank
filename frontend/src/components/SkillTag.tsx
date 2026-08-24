import React from 'react';

interface SkillTagProps {
  skill: string;
  variant?: 'matched' | 'missing' | 'default';
}

const SkillTag: React.FC<SkillTagProps> = ({ skill, variant = 'default' }) => {
  let colorClass = 'bg-gray-100 text-gray-700 border-gray-200';
  
  if (variant === 'matched') {
    colorClass = 'bg-green-50 text-green-700 border-green-200';
  } else if (variant === 'missing') {
    colorClass = 'bg-red-50 text-red-700 border-red-200';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClass} mr-1 mb-1`}>
      {skill}
    </span>
  );
};

export default SkillTag;

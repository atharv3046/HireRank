import React from 'react';

interface StatusBadgeProps {
  status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const statusLower = status.toLowerCase();
  
  let colorClass = 'bg-gray-100 text-gray-800';
  let label = status;
  let showSpinner = false;

  switch (statusLower) {
    case 'uploaded':
      colorClass = 'bg-gray-100 text-gray-800 border border-gray-200';
      label = 'Uploaded';
      break;
    case 'extracting':
      colorClass = 'bg-amber-100 text-amber-800 border border-amber-200';
      label = 'Extracting...';
      showSpinner = true;
      break;
    case 'extracted_fields':
      colorClass = 'bg-blue-100 text-blue-800 border border-blue-200';
      label = 'Extracted';
      break;
    case 'scoring':
      colorClass = 'bg-orange-100 text-orange-800 border border-orange-200';
      label = 'Scoring...';
      showSpinner = true;
      break;
    case 'done':
      colorClass = 'bg-green-100 text-green-800 border border-green-200';
      label = 'Done';
      break;
    case 'error':
      colorClass = 'bg-red-100 text-red-800 border border-red-200';
      label = 'Error';
      break;
    case 'needs_ocr':
      colorClass = 'bg-purple-100 text-purple-800 border border-purple-200';
      label = 'Needs OCR';
      break;
    default:
      // Leave defaults
      break;
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {showSpinner && (
        <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {label}
    </span>
  );
};

export default StatusBadge;

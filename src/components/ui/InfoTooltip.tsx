import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface InfoTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
}

export function InfoTooltip({ children, content, className = '' }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <div
        className={`inline-flex items-center gap-1 cursor-help ${className}`}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
        <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors" />
      </div>
      
      {isVisible && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg whitespace-nowrap">
          {content}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
}

import React from 'react';

interface DetailsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  title?: string;
  children?: React.ReactNode;
}

const DetailsModal: React.FC<DetailsModalProps> = ({ isOpen = false, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black opacity-50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg max-w-xl w-full p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">{title ?? 'Details'}</h3>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-900">✕</button>
        </div>
        <div className="text-sm text-gray-700">{children}</div>
      </div>
    </div>
  );
};

export default DetailsModal;


import React from 'react';

interface ComingSoonModalProps {
  onClose: () => void;
}

const ComingSoonModal: React.FC<ComingSoonModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full">
        <h3 className="text-lg font-medium text-slate-900 mb-4">Coming Soon!</h3>
        <p className="text-slate-600 mb-6">
          This feature is currently under development and will be available soon.
        </p>
        <button
          onClick={onClose}
          className="btn-primary w-full"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default ComingSoonModal;

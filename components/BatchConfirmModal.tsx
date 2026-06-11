import React from 'react';
import { XMarkIcon } from './Icons';

interface BatchConfirmModalProps {
  message: string;
  isDangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const BatchConfirmModal: React.FC<BatchConfirmModalProps> = ({
  message,
  isDangerous = false,
  onConfirm,
  onCancel
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-4 border-b ${isDangerous ? 'border-red-500/20 bg-red-500/5' : 'border-white/10'}`}>
          <div className="flex items-center justify-between">
            <h3 className={`text-lg font-semibold ${isDangerous ? 'text-red-400' : 'text-white'}`}>
              {isDangerous ? '⚠️ 确认操作' : '确认操作'}
            </h3>
            <button
              onClick={onCancel}
              className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-gray-300 leading-relaxed">{message}</p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-white/5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-all text-sm font-medium"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              isDangerous
                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 border border-red-500/30'
                : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 hover:text-cyan-300 border border-cyan-500/30'
            }`}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchConfirmModal;

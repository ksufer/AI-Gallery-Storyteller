import React, { useState } from 'react';
import { XMarkIcon, TagIcon } from './Icons';

interface BatchTagDialogProps {
  onConfirm: (tagName: string) => void;
  onCancel: () => void;
}

const BatchTagDialog: React.FC<BatchTagDialogProps> = ({ onConfirm, onCancel }) => {
  const [tagName, setTagName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmed = tagName.trim();
    
    if (!trimmed) {
      setError('标签名称不能为空');
      return;
    }
    
    if (trimmed.length > 50) {
      setError('标签名称不能超过 50 个字符');
      return;
    }
    
    onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <TagIcon className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">批量添加标签</h3>
            </div>
            <button
              onClick={onCancel}
              className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              标签名称
            </label>
            <input
              type="text"
              value={tagName}
              onChange={(e) => {
                setTagName(e.target.value);
                setError('');
              }}
              placeholder="输入标签名称..."
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-400">{error}</p>
            )}
            <p className="mt-2 text-xs text-gray-500">
              标签将被添加到所有选中的图片
            </p>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 bg-white/5 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-all text-sm font-medium"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 hover:text-purple-300 border border-purple-500/30 transition-all text-sm font-medium"
            >
              添加标签
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BatchTagDialog;

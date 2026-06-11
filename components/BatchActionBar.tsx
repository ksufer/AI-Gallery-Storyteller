import React, { useState } from 'react';
import { TrashIcon, HeartIcon, TagIcon, SparklesIcon, XMarkIcon } from './Icons';
import BatchConfirmModal from './BatchConfirmModal';
import BatchTagDialog from './BatchTagDialog';

interface BatchActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDelete: (imageIds: string[]) => void;
  onFavorite: (imageIds: string[], isFavorite: boolean) => void;
  onAddTag: (imageIds: string[], tagName: string) => void;
  onGenerateStories: (imageIds: string[]) => void;
  onExitBatchMode: () => void;
  selectedImageIds: string[];
}

type ConfirmAction = 'delete' | 'favorite' | 'unfavorite' | 'generateStories' | null;

const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onDelete,
  onFavorite,
  onAddTag,
  onGenerateStories,
  onExitBatchMode,
  selectedImageIds
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [showTagDialog, setShowTagDialog] = useState(false);

  const handleAction = (action: ConfirmAction) => {
    if (selectedCount === 0) return;
    
    setConfirmAction(action);
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    switch (confirmAction) {
      case 'delete':
        onDelete(selectedImageIds);
        break;
      case 'favorite':
        onFavorite(selectedImageIds, true);
        break;
      case 'unfavorite':
        onFavorite(selectedImageIds, false);
        break;
      case 'generateStories':
        onGenerateStories(selectedImageIds);
        break;
    }
    setShowConfirm(false);
    setConfirmAction(null);
  };

  const handleAddTag = (tagName: string) => {
    onAddTag(selectedImageIds, tagName);
    setShowTagDialog(false);
  };

  const getConfirmMessage = (): string => {
    switch (confirmAction) {
      case 'delete':
        return `确定要删除选中的 ${selectedCount} 张图片吗？此操作无法撤销。`;
      case 'favorite':
        return `确定要收藏选中的 ${selectedCount} 张图片吗？`;
      case 'unfavorite':
        return `确定要取消收藏选中的 ${selectedCount} 张图片吗？`;
      case 'generateStories':
        return `确定要为选中的 ${selectedCount} 张图片生成故事吗？这可能需要一些时间。`;
      default:
        return '';
    }
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 md:left-64 z-40 bg-black/60 backdrop-blur-xl border-t border-white/10 px-8 py-4 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)]">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          {/* Left: Selection info */}
          <div className="flex items-center gap-4">
            <div className="text-white">
              <span className="font-semibold text-lg">{selectedCount}</span>
              <span className="text-gray-400 text-sm ml-2">已选择</span>
            </div>
            
            {selectedCount === totalCount ? (
              <button
                onClick={onClearSelection}
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                取消全选
              </button>
            ) : (
              <button
                onClick={onSelectAll}
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                全选 ({totalCount})
              </button>
            )}
          </div>

          {/* Center: Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleAction('favorite')}
              disabled={selectedCount === 0}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
              title="批量收藏"
            >
              <HeartIcon className="w-4 h-4" />
              <span>收藏</span>
            </button>

            <button
              onClick={() => handleAction('unfavorite')}
              disabled={selectedCount === 0}
              className="px-4 py-2 bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 hover:text-gray-300 border border-gray-500/20 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
              title="取消收藏"
            >
              <HeartIcon className="w-4 h-4" />
              <span>取消收藏</span>
            </button>

            <button
              onClick={() => setShowTagDialog(true)}
              disabled={selectedCount === 0}
              className="px-4 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 hover:text-purple-300 border border-purple-500/20 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
              title="批量添加标签"
            >
              <TagIcon className="w-4 h-4" />
              <span>添加标签</span>
            </button>

            <button
              onClick={() => handleAction('generateStories')}
              disabled={selectedCount === 0}
              className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 border border-cyan-500/20 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium shadow-[0_0_15px_rgba(6,182,212,0.1)] hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]"
              title="批量生成故事"
            >
              <SparklesIcon className="w-4 h-4" />
              <span>生成故事</span>
            </button>

            <button
              onClick={() => handleAction('delete')}
              disabled={selectedCount === 0}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
              title="批量删除"
            >
              <TrashIcon className="w-4 h-4" />
              <span>删除</span>
            </button>
          </div>

          {/* Right: Exit button */}
          <button
            onClick={onExitBatchMode}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-transparent hover:border-white/10"
            title="退出批量模式"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirm && (
        <BatchConfirmModal
          message={getConfirmMessage()}
          isDangerous={confirmAction === 'delete'}
          onConfirm={handleConfirm}
          onCancel={() => {
            setShowConfirm(false);
            setConfirmAction(null);
          }}
        />
      )}

      {/* Tag Dialog */}
      {showTagDialog && (
        <BatchTagDialog
          onConfirm={handleAddTag}
          onCancel={() => setShowTagDialog(false)}
        />
      )}
    </>
  );
};

export default BatchActionBar;

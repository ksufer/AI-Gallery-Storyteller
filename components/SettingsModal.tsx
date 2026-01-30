import React, { useState, useEffect } from 'react';
import { XMarkIcon, TrashIcon, PlusIcon } from './Icons';

interface SettingsModalProps {
  onClose: () => void;
}

interface ForbiddenWords {
  [key: string]: string;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [words, setWords] = useState<ForbiddenWords>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/forbidden-words');
      const result = await response.json();
      
      if (result.success) {
        setWords(result.data || {});
      } else {
        setMessage({ text: `加载失败: ${result.error}`, type: 'error' });
      }
    } catch (error: any) {
      console.error('Failed to fetch settings:', error);
      setMessage({ text: `加载失败: ${error.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/settings/forbidden-words', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(words)
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ text: '设置已保存！重新生成故事时将应用新规则。', type: 'success' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ text: `保存失败: ${result.error}`, type: 'error' });
      }
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      setMessage({ text: `保存失败: ${error.message}`, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddWord = () => {
    const newKey = `新词${Object.keys(words).length + 1}`;
    setWords({ ...words, [newKey]: '替换词' });
  };

  const handleUpdateWord = (oldKey: string, newKey: string, value: string) => {
    const newWords = { ...words };
    
    if (oldKey !== newKey) {
      delete newWords[oldKey];
    }
    
    newWords[newKey] = value;
    setWords(newWords);
  };

  const handleDeleteWord = (key: string) => {
    const newWords = { ...words };
    delete newWords[key];
    setWords(newWords);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/90 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative flex flex-col w-full max-w-4xl h-full max-h-[90vh] glass-panel rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#18181b]/95 backdrop-blur">
          <div>
            <h3 className="text-xl font-semibold text-white">设置</h3>
            <p className="text-sm text-gray-500 mt-1">配置禁词替换表</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#18181b] custom-scrollbar">
          
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Info Box */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-blue-400">
                  配置禁词替换表，在生成故事前自动替换提示词中的敏感词汇。例如："少女" → "美女"
                </p>
              </div>

              {/* Words List */}
              {Object.keys(words).length === 0 ? (
                <div className="text-center py-12 text-gray-600">
                  <p className="text-lg mb-2">暂无配置</p>
                  <p className="text-sm">点击下方"添加规则"按钮开始配置</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Table Header */}
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-4 px-4 py-2 bg-white/5 rounded-lg">
                    <div className="text-xs font-semibold text-gray-500 uppercase">原词</div>
                    <div className="text-xs font-semibold text-gray-500 uppercase">替换词</div>
                    <div className="w-10"></div>
                  </div>

                  {/* Table Rows */}
                  {Object.entries(words).map(([key, value], index) => (
                    <WordRow
                      key={`${key}-${index}`}
                      originalKey={key}
                      value={value}
                      onUpdate={handleUpdateWord}
                      onDelete={handleDeleteWord}
                    />
                  ))}
                </div>
              )}

              {/* Add Button */}
              <button
                onClick={handleAddWord}
                className="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/50 rounded-lg transition-all flex items-center justify-center gap-2 text-gray-400 hover:text-cyan-400"
              >
                <PlusIcon className="w-5 h-5" />
                添加规则
              </button>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 bg-[#18181b]/95 backdrop-blur flex items-center justify-between">
          <div className="flex-1">
            {message && (
              <div className={`text-sm px-4 py-2 rounded-md inline-block ${
                message.type === 'success' 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {message.text}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white rounded-lg transition-all shadow-lg shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? '保存中...' : '保存设置'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

interface WordRowProps {
  originalKey: string;
  value: string;
  onUpdate: (oldKey: string, newKey: string, value: string) => void;
  onDelete: (key: string) => void;
}

const WordRow: React.FC<WordRowProps> = ({ originalKey, value, onUpdate, onDelete }) => {
  const [key, setKey] = useState(originalKey);
  const [val, setVal] = useState(value);

  const handleKeyBlur = () => {
    if (key.trim() !== originalKey) {
      onUpdate(originalKey, key.trim(), val);
    }
  };

  const handleValueBlur = () => {
    if (val !== value) {
      onUpdate(originalKey, key, val);
    }
  };

  return (
    <div className="grid grid-cols-[1fr_1fr_auto] gap-4 p-4 bg-black/30 rounded-lg border border-white/5 hover:border-white/10 transition-colors group">
      <input
        type="text"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        onBlur={handleKeyBlur}
        className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50"
        placeholder="原词"
      />
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleValueBlur}
        className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50"
        placeholder="替换词"
      />
      <button
        onClick={() => onDelete(originalKey)}
        className="p-2 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
        title="删除"
      >
        <TrashIcon className="w-5 h-5" />
      </button>
    </div>
  );
};

export default SettingsModal;

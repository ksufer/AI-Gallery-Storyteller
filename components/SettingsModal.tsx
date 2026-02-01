import React, { useState, useEffect } from 'react';
import { XMarkIcon, TrashIcon, PlusIcon } from './Icons';

interface SettingsModalProps {
  onClose: () => void;
}

interface ForbiddenWords {
  [key: string]: string;
}

interface SystemPromptData {
  content: string;
}

type TabType = 'forbidden-words' | 'blocked-tags' | 'system-prompt';

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('forbidden-words');
  const [words, setWords] = useState<ForbiddenWords>({});
  const [blockedTags, setBlockedTags] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (activeTab === 'forbidden-words') {
      fetchForbiddenWords();
    } else if (activeTab === 'blocked-tags') {
      fetchBlockedTags();
    } else if (activeTab === 'system-prompt') {
      fetchSystemPrompt();
    }
  }, [activeTab]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const fetchForbiddenWords = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/forbidden-words');
      const result = await response.json();
      
      if (result.success) {
        setWords(result.data || {});
      } else {
        setMessage({ text: `加载失败: ${result.error}`, type: 'error' });
      }
    } catch (error: any) {
      console.error('Failed to fetch forbidden words:', error);
      setMessage({ text: `加载失败: ${error.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBlockedTags = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/blocked-tags');
      const result = await response.json();
      
      if (result.success) {
        setBlockedTags(result.data || []);
      } else {
        setMessage({ text: `加载失败: ${result.error}`, type: 'error' });
      }
    } catch (error: any) {
      console.error('Failed to fetch blocked tags:', error);
      setMessage({ text: `加载失败: ${error.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSystemPrompt = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/system-prompt');
      const result = await response.json();
      
      if (result.success) {
        setSystemPrompt(result.data?.content || '');
      } else {
        setMessage({ text: `加载失败: ${result.error}`, type: 'error' });
      }
    } catch (error: any) {
      console.error('Failed to fetch system prompt:', error);
      setMessage({ text: `加载失败: ${error.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      if (activeTab === 'forbidden-words') {
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
      } else if (activeTab === 'blocked-tags') {
        const response = await fetch('/api/settings/blocked-tags', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(blockedTags)
        });

        const result = await response.json();

        if (result.success) {
          setMessage({ text: '设置已保存！新导入的图片将应用屏蔽规则。', type: 'success' });
          setTimeout(() => setMessage(null), 3000);
        } else {
          setMessage({ text: `保存失败: ${result.error}`, type: 'error' });
        }
      } else if (activeTab === 'system-prompt') {
        const response = await fetch('/api/settings/system-prompt', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: systemPrompt })
        });

        const result = await response.json();

        if (result.success) {
          setMessage({ text: '系统提示词已更新！生成故事时将使用新的提示词。', type: 'success' });
          setTimeout(() => setMessage(null), 3000);
        } else {
          setMessage({ text: `保存失败: ${result.error}`, type: 'error' });
        }
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

  const handleAddTag = () => {
    setBlockedTags([...blockedTags, '']);
  };

  const handleUpdateTag = (index: number, value: string) => {
    const newTags = [...blockedTags];
    newTags[index] = value;
    setBlockedTags(newTags);
  };

  const handleDeleteTag = (index: number) => {
    setBlockedTags(blockedTags.filter((_, i) => i !== index));
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
        <div className="border-b border-white/5 bg-[#18181b]/95 backdrop-blur">
          <div className="p-6 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">设置</h3>
              <p className="text-sm text-gray-500 mt-1">管理应用配置</p>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-1 px-6">
            <button
              onClick={() => setActiveTab('forbidden-words')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'forbidden-words'
                  ? 'bg-[#18181b] text-white border-t-2 border-cyan-500'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              禁词替换表
            </button>
            <button
              onClick={() => setActiveTab('blocked-tags')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'blocked-tags'
                  ? 'bg-[#18181b] text-white border-t-2 border-purple-500'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              标签屏蔽列表
            </button>
            <button
              onClick={() => setActiveTab('system-prompt')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'system-prompt'
                  ? 'bg-[#18181b] text-white border-t-2 border-green-500'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              系统提示词
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#18181b] custom-scrollbar">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            </div>
          ) : activeTab === 'forbidden-words' ? (
            <div className="space-y-2">
              
              {/* Info Box */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-blue-400">
                  配置禁词替换表，在生成故事前自动替换提示词中的敏感词汇。例如："少女" → "美女"
                </p>
                <p className="text-xs text-blue-400/70 mt-2">
                  💡 修改后保存即可生效，无需重启服务器（刷新页面即可）
                </p>
              </div>

              {/* Words List */}
              {Object.keys(words).length === 0 ? (
                <div className="text-center py-12 text-gray-600">
                  <p className="text-lg mb-2">暂无配置</p>
                  <p className="text-sm">点击下方"添加规则"按钮开始配置</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {/* Table Header */}
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-4 py-2 bg-white/5 rounded-t-lg border-b border-white/5">
                    <div className="text-xs font-semibold text-gray-500 uppercase">原词</div>
                    <div className="text-xs font-semibold text-gray-500 uppercase">替换词</div>
                    <div className="w-8"></div>
                  </div>

                  {/* Table Rows */}
                  <div className="divide-y divide-white/5 border border-white/5 rounded-lg overflow-hidden">
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
                </div>
              )}

              {/* Add Button */}
              <button
                onClick={handleAddWord}
                className="w-full p-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/50 rounded-lg transition-all flex items-center justify-center gap-2 text-gray-400 hover:text-cyan-400"
              >
                <PlusIcon className="w-5 h-5" />
                添加规则
              </button>

            </div>
          ) : activeTab === 'blocked-tags' ? (
            <div className="space-y-2">
              
              {/* Info Box */}
              <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <p className="text-sm text-purple-400">
                  配置标签屏蔽列表，在从图片元数据提取标签时自动过滤无意义的标签（如图像质量词、镜头词等）
                </p>
                <p className="text-xs text-purple-400/70 mt-2">
                  💡 修改后保存即可生效，无需重启服务器。仅对新导入的图片有效
                </p>
              </div>

              {/* Tags List */}
              {blockedTags.length === 0 ? (
                <div className="text-center py-12 text-gray-600">
                  <p className="text-lg mb-2">暂无屏蔽标签</p>
                  <p className="text-sm">点击下方"添加标签"按钮开始配置</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5 border border-white/5 rounded-lg overflow-hidden">
                  {blockedTags.map((tag, index) => (
                    <div key={index} className="flex gap-2 items-center px-2 py-1 bg-black/20 hover:bg-black/40 transition-colors group">
                      <input
                        type="text"
                        value={tag}
                        onChange={(e) => handleUpdateTag(index, e.target.value)}
                        className="flex-1 bg-transparent border-none px-2 py-1 text-sm text-gray-300 focus:outline-none focus:text-white placeholder-gray-600"
                        placeholder="标签名称（如：masterpiece）"
                      />
                      <button
                        onClick={() => handleDeleteTag(index)}
                        className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                        title="删除"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Button */}
              <button
                onClick={handleAddTag}
                className="w-full p-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 rounded-lg transition-all flex items-center justify-center gap-2 text-gray-400 hover:text-purple-400"
              >
                <PlusIcon className="w-5 h-5" />
                添加标签
              </button>

            </div>
          ) : activeTab === 'system-prompt' ? (
            <div className="space-y-2">
              
              {/* Info Box */}
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-green-400">
                  配置 AI 生成故事时使用的系统提示词（System Prompt）。这将直接影响生成内容的风格和质量。
                </p>
                <p className="text-xs text-green-400/70 mt-2">
                  💡 修改后保存即可生效，无需重启服务器
                </p>
              </div>

              {/* Textarea */}
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full h-[calc(100vh-32rem)] bg-black/40 border border-white/10 rounded-lg p-4 text-sm text-gray-300 font-mono focus:outline-none focus:border-green-500/50 transition-colors custom-scrollbar resize-none"
                placeholder="请输入系统提示词..."
                spellCheck={false}
              />

              {/* Character Count */}
              <div className="text-xs text-gray-500 text-right">
                {systemPrompt.length} 字符
              </div>

            </div>
          ) : null}

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
    <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-2 py-1 bg-black/20 hover:bg-black/40 transition-colors group items-center">
      <input
        type="text"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        onBlur={handleKeyBlur}
        className="bg-transparent border-none px-2 py-1 text-sm text-gray-300 focus:outline-none focus:text-white placeholder-gray-600"
        placeholder="原词"
      />
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleValueBlur}
        className="bg-transparent border-none px-2 py-1 text-sm text-gray-300 focus:outline-none focus:text-white placeholder-gray-600"
        placeholder="替换词"
      />
      <button
        onClick={() => onDelete(originalKey)}
        className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
        title="删除"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );
};

export default SettingsModal;

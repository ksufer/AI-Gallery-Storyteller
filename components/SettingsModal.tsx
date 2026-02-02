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

interface AISettings {
  provider: 'gemini' | 'openai';
  gemini: {
    apiKey: string;
    maskedKey: string;
    model: string;
    hasKey: boolean;
  };
  openai: {
    apiKey: string;
    maskedKey: string;
    baseUrl: string;
    model: string;
    hasKey: boolean;
  };
  proxy: {
    enabled: boolean;
    url: string;
  };
}

interface ModelOption {
  id: string;
  name: string;
  description?: string;
}

type TabType = 'ai-settings' | 'forbidden-words' | 'blocked-tags' | 'system-prompt';

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('ai-settings');
  const [words, setWords] = useState<ForbiddenWords>({});
  const [blockedTags, setBlockedTags] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // AI Settings state
  const [aiSettings, setAiSettings] = useState<AISettings | null>(null);
  const [editingGeminiKey, setEditingGeminiKey] = useState<string>('');
  const [editingOpenaiKey, setEditingOpenaiKey] = useState<string>('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [geminiModels, setGeminiModels] = useState<ModelOption[]>([]);
  const [openaiModels, setOpenaiModels] = useState<ModelOption[]>([]);
  const [loadingGeminiModels, setLoadingGeminiModels] = useState(false);
  const [loadingOpenaiModels, setLoadingOpenaiModels] = useState(false);
  const [testingConnection, setTestingConnection] = useState<'gemini' | 'openai' | null>(null);
  const [connectionResult, setConnectionResult] = useState<{ provider: string; success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (activeTab === 'forbidden-words') {
      fetchForbiddenWords();
    } else if (activeTab === 'blocked-tags') {
      fetchBlockedTags();
    } else if (activeTab === 'system-prompt') {
      fetchSystemPrompt();
    } else if (activeTab === 'ai-settings') {
      fetchAiSettings();
    }
  }, [activeTab]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const fetchAiSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/ai');
      const result = await response.json();
      
      if (result.success) {
        setAiSettings(result.data);
        setEditingGeminiKey('');
        setEditingOpenaiKey('');
      } else {
        setMessage({ text: `加载失败: ${result.error}`, type: 'error' });
      }
    } catch (error: any) {
      console.error('Failed to fetch AI settings:', error);
      setMessage({ text: `加载失败: ${error.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

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

  const fetchGeminiModels = async (apiKey?: string) => {
    setLoadingGeminiModels(true);
    try {
      const response = await fetch('/api/models/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey || editingGeminiKey || undefined })
      });
      const result = await response.json();
      
      if (result.success) {
        setGeminiModels(result.data || []);
      } else {
        setMessage({ text: `获取模型列表失败: ${result.error}`, type: 'error' });
      }
    } catch (error: any) {
      setMessage({ text: `获取模型列表失败: ${error.message}`, type: 'error' });
    } finally {
      setLoadingGeminiModels(false);
    }
  };

  const fetchOpenaiModels = async (apiKey?: string, baseUrl?: string) => {
    setLoadingOpenaiModels(true);
    try {
      const response = await fetch('/api/models/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          apiKey: apiKey || editingOpenaiKey || undefined,
          baseUrl: baseUrl || aiSettings?.openai.baseUrl || undefined
        })
      });
      const result = await response.json();
      
      if (result.success) {
        setOpenaiModels(result.data || []);
      } else {
        setMessage({ text: `获取模型列表失败: ${result.error}`, type: 'error' });
      }
    } catch (error: any) {
      setMessage({ text: `获取模型列表失败: ${error.message}`, type: 'error' });
    } finally {
      setLoadingOpenaiModels(false);
    }
  };

  const testConnection = async (provider: 'gemini' | 'openai') => {
    setTestingConnection(provider);
    setConnectionResult(null);
    
    try {
      const body: any = { provider };
      
      if (provider === 'gemini') {
        if (editingGeminiKey) {
          body.apiKey = editingGeminiKey;
        }
      } else {
        if (editingOpenaiKey) {
          body.apiKey = editingOpenaiKey;
        }
        if (aiSettings?.openai.baseUrl) {
          body.baseUrl = aiSettings.openai.baseUrl;
        }
      }
      
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      
      setConnectionResult({
        provider,
        success: result.success,
        message: result.message + (result.model ? ` (${result.model})` : '')
      });
    } catch (error: any) {
      setConnectionResult({
        provider,
        success: false,
        message: error.message || '连接测试失败'
      });
    } finally {
      setTestingConnection(null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      if (activeTab === 'ai-settings' && aiSettings) {
        const updateData: any = {
          provider: aiSettings.provider,
          gemini: {
            model: aiSettings.gemini.model
          },
          openai: {
            baseUrl: aiSettings.openai.baseUrl,
            model: aiSettings.openai.model
          },
          proxy: aiSettings.proxy
        };
        
        // Only include API keys if they were edited
        if (editingGeminiKey) {
          updateData.gemini.apiKey = editingGeminiKey;
        }
        if (editingOpenaiKey) {
          updateData.openai.apiKey = editingOpenaiKey;
        }
        
        const response = await fetch('/api/settings/ai', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        });

        const result = await response.json();

        if (result.success) {
          setMessage({ text: 'AI 设置已保存！配置已立即生效。', type: 'success' });
          // Refresh settings to get updated masked keys
          await fetchAiSettings();
          setTimeout(() => setMessage(null), 3000);
        } else {
          setMessage({ text: `保存失败: ${result.error}`, type: 'error' });
        }
      } else if (activeTab === 'forbidden-words') {
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

  // Render AI Settings Tab
  const renderAiSettingsTab = () => {
    if (!aiSettings) return null;

    return (
      <div className="space-y-6">
        {/* Provider Selection */}
        <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
          <h4 className="text-sm font-semibold text-white mb-3">AI 服务提供商</h4>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="provider"
                value="gemini"
                checked={aiSettings.provider === 'gemini'}
                onChange={() => setAiSettings({ ...aiSettings, provider: 'gemini' })}
                className="w-4 h-4 text-cyan-500 bg-black/40 border-white/20 focus:ring-cyan-500"
              />
              <span className="text-gray-300">Google Gemini</span>
              <span className="text-xs text-gray-500">(默认)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="provider"
                value="openai"
                checked={aiSettings.provider === 'openai'}
                onChange={() => setAiSettings({ ...aiSettings, provider: 'openai' })}
                className="w-4 h-4 text-purple-500 bg-black/40 border-white/20 focus:ring-purple-500"
              />
              <span className="text-gray-300">OpenAI 兼容</span>
              <span className="text-xs text-gray-500">(OpenRouter, DeepSeek 等)</span>
            </label>
          </div>
        </div>

        {/* Gemini Settings */}
        <div className={`p-4 border rounded-lg transition-all ${
          aiSettings.provider === 'gemini' 
            ? 'bg-cyan-500/10 border-cyan-500/30' 
            : 'bg-white/5 border-white/10 opacity-60'
        }`}>
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <span>Gemini 设置</span>
            {aiSettings.gemini.hasKey && (
              <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">已配置</span>
            )}
          </h4>
          
          <div className="space-y-3">
            {/* API Key */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">API Key</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={editingGeminiKey || (showGeminiKey ? '' : aiSettings.gemini.maskedKey)}
                    onChange={(e) => setEditingGeminiKey(e.target.value)}
                    placeholder={aiSettings.gemini.hasKey ? '输入新 Key 以更换' : '输入 Gemini API Key'}
                    className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50 font-mono"
                  />
                </div>
                <button
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-gray-400"
                >
                  {showGeminiKey ? '隐藏' : '显示'}
                </button>
              </div>
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">模型</label>
              <div className="flex gap-2">
                <select
                  value={aiSettings.gemini.model}
                  onChange={(e) => setAiSettings({
                    ...aiSettings,
                    gemini: { ...aiSettings.gemini, model: e.target.value }
                  })}
                  className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50"
                >
                  <option value={aiSettings.gemini.model}>{aiSettings.gemini.model}</option>
                  {geminiModels.filter(m => m.id !== aiSettings.gemini.model).map(model => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => fetchGeminiModels()}
                  disabled={loadingGeminiModels}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-gray-400 disabled:opacity-50"
                >
                  {loadingGeminiModels ? '加载中...' : '刷新列表'}
                </button>
              </div>
            </div>

            {/* Test Connection */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => testConnection('gemini')}
                disabled={testingConnection === 'gemini'}
                className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded text-sm text-cyan-400 disabled:opacity-50"
              >
                {testingConnection === 'gemini' ? '测试中...' : '测试连接'}
              </button>
              {connectionResult?.provider === 'gemini' && (
                <span className={`text-sm ${connectionResult.success ? 'text-green-400' : 'text-red-400'}`}>
                  {connectionResult.message}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* OpenAI Settings */}
        <div className={`p-4 border rounded-lg transition-all ${
          aiSettings.provider === 'openai' 
            ? 'bg-purple-500/10 border-purple-500/30' 
            : 'bg-white/5 border-white/10 opacity-60'
        }`}>
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <span>OpenAI 兼容设置</span>
            {aiSettings.openai.hasKey && (
              <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">已配置</span>
            )}
          </h4>
          
          <div className="space-y-3">
            {/* API Key */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">API Key</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showOpenaiKey ? 'text' : 'password'}
                    value={editingOpenaiKey || (showOpenaiKey ? '' : aiSettings.openai.maskedKey)}
                    onChange={(e) => setEditingOpenaiKey(e.target.value)}
                    placeholder={aiSettings.openai.hasKey ? '输入新 Key 以更换' : '输入 API Key'}
                    className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-purple-500/50 font-mono"
                  />
                </div>
                <button
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-gray-400"
                >
                  {showOpenaiKey ? '隐藏' : '显示'}
                </button>
              </div>
            </div>

            {/* Base URL */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Base URL</label>
              <input
                type="text"
                value={aiSettings.openai.baseUrl}
                onChange={(e) => setAiSettings({
                  ...aiSettings,
                  openai: { ...aiSettings.openai, baseUrl: e.target.value }
                })}
                placeholder="https://api.openai.com/v1"
                className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-purple-500/50 font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">
                OpenRouter: https://openrouter.ai/api/v1 | DeepSeek: https://api.deepseek.com
              </p>
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">模型</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiSettings.openai.model}
                  onChange={(e) => setAiSettings({
                    ...aiSettings,
                    openai: { ...aiSettings.openai, model: e.target.value }
                  })}
                  placeholder="gpt-4o"
                  className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-purple-500/50 font-mono"
                  list="openai-models"
                />
                <datalist id="openai-models">
                  {openaiModels.map(model => (
                    <option key={model.id} value={model.id} />
                  ))}
                </datalist>
                <button
                  onClick={() => fetchOpenaiModels()}
                  disabled={loadingOpenaiModels}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-gray-400 disabled:opacity-50"
                >
                  {loadingOpenaiModels ? '加载中...' : '获取列表'}
                </button>
              </div>
            </div>

            {/* Test Connection */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => testConnection('openai')}
                disabled={testingConnection === 'openai'}
                className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded text-sm text-purple-400 disabled:opacity-50"
              >
                {testingConnection === 'openai' ? '测试中...' : '测试连接'}
              </button>
              {connectionResult?.provider === 'openai' && (
                <span className={`text-sm ${connectionResult.success ? 'text-green-400' : 'text-red-400'}`}>
                  {connectionResult.message}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Proxy Settings */}
        <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
          <h4 className="text-sm font-semibold text-white mb-3">代理设置</h4>
          
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={aiSettings.proxy.enabled}
                onChange={(e) => setAiSettings({
                  ...aiSettings,
                  proxy: { ...aiSettings.proxy, enabled: e.target.checked }
                })}
                className="w-4 h-4 text-cyan-500 bg-black/40 border-white/20 rounded focus:ring-cyan-500"
              />
              <span className="text-gray-300 text-sm">启用代理</span>
            </label>

            {aiSettings.proxy.enabled && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">代理地址</label>
                <input
                  type="text"
                  value={aiSettings.proxy.url}
                  onChange={(e) => setAiSettings({
                    ...aiSettings,
                    proxy: { ...aiSettings.proxy, url: e.target.value }
                  })}
                  placeholder="http://127.0.0.1:7890"
                  className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50 font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  提示：国内访问 Gemini API 需要配置代理。常用端口：Clash (7890), v2ray (10809)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-400">
            修改后点击"保存设置"即可生效，无需重启服务器。
          </p>
        </div>
      </div>
    );
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
          <div className="flex gap-1 px-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('ai-settings')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                activeTab === 'ai-settings'
                  ? 'bg-[#18181b] text-white border-t-2 border-blue-500'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              模型设置
            </button>
            <button
              onClick={() => setActiveTab('forbidden-words')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                activeTab === 'forbidden-words'
                  ? 'bg-[#18181b] text-white border-t-2 border-cyan-500'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              禁词替换表
            </button>
            <button
              onClick={() => setActiveTab('blocked-tags')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                activeTab === 'blocked-tags'
                  ? 'bg-[#18181b] text-white border-t-2 border-purple-500'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              标签屏蔽列表
            </button>
            <button
              onClick={() => setActiveTab('system-prompt')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
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
          ) : activeTab === 'ai-settings' ? (
            renderAiSettingsTab()
          ) : activeTab === 'forbidden-words' ? (
            <div className="space-y-2">
              
              {/* Info Box */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-blue-400">
                  配置禁词替换表，在生成故事前自动替换提示词中的敏感词汇。例如："少女" → "美女"
                </p>
                <p className="text-xs text-blue-400/70 mt-2">
                  修改后保存即可生效，无需重启服务器（刷新页面即可）
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
                  修改后保存即可生效，无需重启服务器。仅对新导入的图片有效
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
                  修改后保存即可生效，无需重启服务器
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

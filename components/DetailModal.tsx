import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { GalleryImage } from '../types';
import { SparklesIcon, XMarkIcon, HeartIcon, TrashIcon, PlusIcon, PencilIcon, EyeIcon, ArrowPathIcon } from './Icons';

interface DetailModalProps {
  image: GalleryImage;
  onClose: () => void;
  onUpdateStory: (id: string, story: string) => void;
  onToggleFavorite: (id: string) => void;
  onDelete?: (id: string) => void;
  onTagsChanged?: () => void;
  onSameStyleCreated?: (newImage: GalleryImage) => void;
}

type RightPanelTab = 'story' | 'chat';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const MAX_CHAT_HISTORY_DISPLAY = 10;

const DetailModal: React.FC<DetailModalProps> = ({ image, onClose, onUpdateStory, onToggleFavorite, onDelete, onTagsChanged, onSameStyleCreated }) => {
  const [story, setStory] = useState(image.story || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [sameStyleLoading, setSameStyleLoading] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [userKeywords, setUserKeywords] = useState('');
  const [isEditingStory, setIsEditingStory] = useState(false);
  const [loadingText, setLoadingText] = useState('AI 生成故事');

  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('story');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');

  // Sync internal state if prop changes
  useEffect(() => {
    setStory(image.story || '');
    // Fetch tags for this image
    fetchTags();
  }, [image.id, image.story]);

  const fetchTags = async () => {
    try {
      const response = await fetch(`/api/images/${image.id}/tags`);
      if (response.ok) {
        const data = await response.json();
        setTags(data.tags || []);
      }
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    }
  };

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleGenerateStory = useCallback(async () => {
    setIsGenerating(true);
    setStory(''); // Clear existing story
    setLoadingText('正在连接...');
    
    try {
      const response = await fetch(`/api/images/${image.id}/generate-story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userKeywords })
      });

      if (!response.ok) {
        let errorMessage = '生成失败';
        try {
            const error = await response.json();
            errorMessage = error.error || errorMessage;
        } catch {
            errorMessage = await response.text() || errorMessage;
        }
        throw new Error(errorMessage);
      }

      if (!response.body) throw new Error('无法读取流');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedStory = '';
      let buffer = '';
      
      setLoadingText('正在生成...');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || ''; // Keep incomplete part in buffer

        for (const part of parts) {
            if (part.startsWith('data: ')) {
                const jsonStr = part.slice(6);
                if (!jsonStr.trim()) continue;
                
                try {
                    const data = JSON.parse(jsonStr);
                    if (data.chunk) {
                        accumulatedStory += data.chunk;
                        setStory(accumulatedStory);
                    }
                    if (data.error) {
                        throw new Error(data.error);
                    }
                } catch (e) {
                    console.warn('Error parsing SSE data:', e);
                }
            }
        }
      }
      
      onUpdateStory(image.id, accumulatedStory);

    } catch (e: any) {
      console.error(e);
      setStory(prev => prev + `\n\n[生成出错] ${e.message || "未知错误，请重试。"}`);
    } finally {
      setIsGenerating(false);
      setLoadingText('AI 生成故事');
    }
  }, [image.id, onUpdateStory, userKeywords]);

  const handleStorySave = () => {
     onUpdateStory(image.id, story);
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    
    const confirmed = window.confirm('确定要删除这张图片吗？此操作无法撤销，将同时删除文件和数据库记录。');
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/images/${image.id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        onDelete(image.id);
        onClose();
      } else {
        alert(`删除失败: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Delete error:', error);
      alert(`删除失败: ${error.message}`);
    }
  };

  const handleAddTag = async () => {
    const tagName = newTagInput.trim();
    if (!tagName) return;

    setIsAddingTag(true);
    try {
      const response = await fetch(`/api/images/${image.id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagName })
      });

      const result = await response.json();

      if (result.success) {
        setTags(result.tags || []);
        setNewTagInput('');
        // Notify parent to refresh sidebar
        if (onTagsChanged) {
          onTagsChanged();
        }
      } else {
        alert(`添加标签失败: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Add tag error:', error);
      alert(`添加标签失败: ${error.message}`);
    } finally {
      setIsAddingTag(false);
    }
  };

  const handleRemoveTag = async (tagName: string) => {
    try {
      const response = await fetch(`/api/images/${image.id}/tags/${encodeURIComponent(tagName)}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        setTags(result.tags || []);
        // Notify parent to refresh sidebar
        if (onTagsChanged) {
          onTagsChanged();
        }
      } else {
        alert(`删除标签失败: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Remove tag error:', error);
      alert(`删除标签失败: ${error.message}`);
    }
  };

  const sendChatRequest = useCallback(async (message: string, history: ChatMessage[]) => {
    const response = await fetch(`/api/images/${image.id}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '对话失败');
    return data.reply ?? '';
  }, [image.id]);

  const handleSendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    setChatLoading(true);
    const userMsg: ChatMessage = { role: 'user', text };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');

    try {
      const reply = await sendChatRequest(text, chatMessages);
      setChatMessages((prev) => [...prev, { role: 'model', text: reply }]);
    } catch (e: any) {
      console.error(e);
      setChatMessages((prev) => [...prev, { role: 'model', text: `[出错] ${e.message || '请重试'}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  const canRegenerate = chatMessages.length >= 2 && chatMessages[chatMessages.length - 1]?.role === 'model';

  const handleRegenerateLastReply = async () => {
    if (!canRegenerate || chatLoading) return;
    const lastUserText = chatMessages[chatMessages.length - 2]!.text;
    const historyBeforeLastUser = chatMessages.slice(0, -2);
    setChatMessages((prev) => prev.slice(0, -1));

    setChatLoading(true);
    try {
      const reply = await sendChatRequest(lastUserText, historyBeforeLastUser);
      setChatMessages((prev) => [...prev, { role: 'model', text: reply }]);
    } catch (e: any) {
      console.error(e);
      setChatMessages((prev) => [...prev, { role: 'model', text: `[出错] ${e.message || '请重试'}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleClearChat = () => {
    if (chatMessages.length === 0) return;
    if (window.confirm('确定清空当前对话记录？')) {
      setChatMessages([]);
    }
  };

  const isSdWebUi = image.metadata?.type === 'SD WebUI';

  const handleMakeSameStyle = async () => {
    if (!isSdWebUi || sameStyleLoading) return;
    setSameStyleLoading(true);
    try {
      const response = await fetch(`/api/images/${image.id}/make-same-style`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '做同款失败');
      }
      if (data.success && data.image) {
        if (onSameStyleCreated) {
          onSameStyleCreated(data.image);
        } else {
          onClose();
        }
      } else {
        throw new Error('未返回新图片');
      }
    } catch (e: any) {
      alert(e?.message || '做同款失败，请检查 SD WebUI 是否已配置并启动（--api）');
    } finally {
      setSameStyleLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-8">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/90 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative flex flex-col lg:flex-row w-full max-w-7xl h-full max-h-[90vh] glass-panel rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
        
        {/* Left Side: Image */}
        <div className="lg:w-3/5 bg-[#000] flex items-center justify-center relative overflow-hidden group">
           {/* Background Blur Effect */}
           <div 
             className="absolute inset-0 opacity-20 blur-3xl scale-110 pointer-events-none"
             style={{ backgroundImage: `url(${image.url})`, backgroundPosition: 'center', backgroundSize: 'cover' }}
           />
           <img 
             src={image.url} 
             alt={image.fileName} 
             className="relative max-w-full max-h-full object-contain z-10 shadow-lg"
           />
           <div className="absolute bottom-6 left-6 z-20">
             <h2 className="text-white text-xl font-bold drop-shadow-md truncate max-w-md">{image.fileName}</h2>
             <div className="flex gap-2 mt-2">
                <span className={`text-xs px-2 py-1 rounded bg-black/60 border border-white/10 ${image.metadata.type === 'ComfyUI' ? 'text-green-400' : 'text-blue-400'}`}>
                    {image.metadata.type}
                </span>
                <span className="text-xs px-2 py-1 rounded bg-black/60 border border-white/10 text-gray-300">
                    {image.metadata.image_size.join(', ')}
                </span>
             </div>
           </div>
        </div>

        {/* Right Side: Info & Story */}
        <div className="lg:w-2/5 flex flex-col bg-[#18181b] border-l border-white/5 overflow-y-auto custom-scrollbar">
          
          {/* Action Bar */}
          <div className="p-6 pr-14 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#18181b]/95 backdrop-blur z-10">
            <h3 className="text-lg font-semibold text-white">详情</h3>
            <div className="flex items-center gap-2">
              {isSdWebUi && (
                <button
                  onClick={handleMakeSameStyle}
                  disabled={sameStyleLoading}
                  className="p-2 rounded-full border border-white/10 text-gray-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-all disabled:opacity-50"
                  title="做同款（用相同参数在 SD WebUI 生成新图）"
                >
                  <ArrowPathIcon className={`w-5 h-5 ${sameStyleLoading ? 'animate-spin' : ''}`} />
                </button>
              )}
              <button 
                onClick={() => onToggleFavorite(image.id)}
                className={`p-2 rounded-full border transition-all ${image.isFavorite ? 'bg-red-500/10 border-red-500/50 text-red-500' : 'border-white/10 text-gray-400 hover:text-white'}`}
                title="收藏"
              >
                <HeartIcon className="w-5 h-5" solid={image.isFavorite} />
              </button>
              {onDelete && (
                <button 
                  onClick={handleDelete}
                  className="p-2 rounded-full border border-white/10 text-gray-400 hover:text-red-400 hover:border-red-500/50 transition-all"
                  title="删除图片"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              )}
              <button 
                onClick={onClose} 
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10"
                title="关闭"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-8">
            {/* Tab: 故事 / 对话 */}
            <div className="flex gap-1 p-1 bg-black/30 rounded-lg border border-white/5 w-fit">
              <button
                type="button"
                onClick={() => setRightPanelTab('story')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${rightPanelTab === 'story' ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50' : 'text-gray-400 hover:text-white'}`}
              >
                故事
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab('chat')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${rightPanelTab === 'chat' ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50' : 'text-gray-400 hover:text-white'}`}
              >
                对话
              </button>
            </div>

            {/* Story Teller Section (visible when tab = story) */}
            {rightPanelTab === 'story' && (
            <div className="space-y-3">
               <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-purple-400 uppercase tracking-wider">故事模式</h4>
                    <div className="flex items-center gap-2">
                         <button 
                           onClick={() => setIsEditingStory(!isEditingStory)}
                           className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                           title={isEditingStory ? "预览 Markdown" : "编辑源码"}
                         >
                           {isEditingStory ? <EyeIcon className="w-4 h-4" /> : <PencilIcon className="w-4 h-4" />}
                         </button>
                         <button 
                           onClick={handleGenerateStory}
                           disabled={isGenerating}
                           className="flex items-center gap-2 text-xs font-semibold bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white px-3 py-1.5 rounded-full transition-all shadow-lg shadow-purple-900/20 disabled:opacity-50 min-w-[100px] justify-center"
                         >
                           <SparklesIcon className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                           {loadingText}
                         </button>
                    </div>
                  </div>
                  
                  {/* User Keywords Input */}
                  <div className="relative">
                    <input
                      type="text"
                      value={userKeywords}
                      onChange={(e) => setUserKeywords(e.target.value)}
                      placeholder="输入关键词（可选），AI 将围绕它进行创作..."
                      className="w-full bg-black/20 border border-purple-500/20 rounded-lg px-3 py-2 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:bg-black/40 transition-all"
                    />
                  </div>
               </div>

               <div className="relative group min-h-[300px]">
                 {isEditingStory ? (
                     <textarea
                        value={story}
                        onChange={(e) => setStory(e.target.value)}
                        onBlur={handleStorySave}
                        placeholder="为这张图写一段故事，或使用 AI 生成..."
                        className="w-full h-full min-h-[300px] bg-black/30 border border-white/10 rounded-lg p-4 text-gray-300 text-sm leading-relaxed focus:outline-none focus:border-purple-500/50 resize-y font-sans font-mono"
                     />
                 ) : (
                     <div 
                        className="w-full h-full min-h-[300px] bg-black/30 border border-white/10 rounded-lg p-4 text-gray-300 text-sm leading-relaxed overflow-y-auto prose prose-invert prose-sm max-w-none"
                     >
                        {story ? (
                            <ReactMarkdown>{story}</ReactMarkdown>
                        ) : (
                            <span className="text-gray-600 italic">点击上方按钮开始编辑...</span>
                        )}
                     </div>
                 )}
                 {!isEditingStory && (
                    <div className="absolute inset-0 rounded-lg pointer-events-none border border-transparent group-hover:border-white/5 transition-colors"></div>
                 )}
               </div>
            </div>
            )}

            {/* 对话 Tab：与画中人对话 */}
            {rightPanelTab === 'chat' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                {image.story?.trim()
                  ? '基于当前故事与画中人对话，角色会以第一人称回应。'
                  : '暂无故事时，角色将仅根据画面自由发挥。建议先在「故事」Tab 生成故事后体验更佳。'}
              </p>
              <div className="flex flex-col gap-2 min-h-[260px] max-h-[280px] overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-3 custom-scrollbar">
                {chatMessages.length === 0 ? (
                  <span className="text-xs text-gray-600 italic">发送一句话开始与画中人对话…</span>
                ) : (
                  chatMessages.slice(-MAX_CHAT_HISTORY_DISPLAY).map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                          msg.role === 'user'
                            ? 'bg-purple-500/30 text-purple-100 border border-purple-500/30'
                            : 'bg-white/10 text-gray-200 border border-white/10'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <button
                  type="button"
                  onClick={handleRegenerateLastReply}
                  disabled={chatLoading || !canRegenerate}
                  title="重新生成上一条回复"
                  className="px-3 py-2 text-xs text-gray-400 hover:text-purple-300 border border-white/10 hover:border-purple-500/30 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  重说
                </button>
                <button
                  type="button"
                  onClick={handleClearChat}
                  disabled={chatMessages.length === 0}
                  title="清空对话记录"
                  className="px-3 py-2 text-xs text-gray-400 hover:text-red-400 border border-white/10 hover:border-red-500/30 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  清空
                </button>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
                  placeholder="输入想对画中人说的话…"
                  className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
                  disabled={chatLoading}
                />
                <button
                  type="button"
                  onClick={handleSendChat}
                  disabled={chatLoading || !chatInput.trim()}
                  className="px-4 py-2 bg-purple-500/30 hover:bg-purple-500/40 text-purple-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {chatLoading ? '…' : '发送'}
                </button>
              </div>
            </div>
            )}

            {/* Tags Management */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-cyan-400 uppercase tracking-wider">标签管理</h4>
              <div className="flex flex-wrap gap-2 p-3 bg-black/30 rounded-lg border border-white/5 min-h-[60px]">
                {tags.length === 0 ? (
                  <span className="text-xs text-gray-600">暂无标签</span>
                ) : (
                  tags.map(tag => (
                    <span 
                      key={tag}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded-full text-xs text-cyan-400 group hover:border-cyan-500/50 transition-colors"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="opacity-60 hover:opacity-100 hover:text-red-400 transition-all"
                        title="删除标签"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                  placeholder="添加新标签..."
                  className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                  disabled={isAddingTag}
                />
                <button
                  onClick={handleAddTag}
                  disabled={isAddingTag || !newTagInput.trim()}
                  className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <PlusIcon className="w-4 h-4" />
                  添加
                </button>
              </div>
            </div>

            {/* Prompts */}
            <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">正向提示词</h4>
                <div className="p-3 bg-black/30 rounded-lg border border-white/5">
                    <p className="text-sm text-gray-300 leading-relaxed font-mono text-xs opacity-90 break-words">
                        {image.metadata.prompts.join(', ')}
                    </p>
                </div>
            </div>

            {/* Negative Prompts */}
            {image.metadata.negative_prompts.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-sm font-medium text-red-400/70 uppercase tracking-wider">反向提示词</h4>
                    <div className="p-3 bg-red-900/5 rounded-lg border border-red-500/10">
                        <p className="text-sm text-gray-400 leading-relaxed font-mono text-xs opacity-80 break-words">
                            {image.metadata.negative_prompts.join(', ')}
                        </p>
                    </div>
                </div>
            )}

            {/* Technical Metadata Grid */}
            <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">生成参数</h4>
                <div className="grid grid-cols-2 gap-3">
                    <MetaItem label="模型" value={image.metadata.checkpoints[0] || '未知'} />
                    <MetaItem label="采样器" value={image.metadata.sampler.sampler_name} />
                    <MetaItem label="步数" value={image.metadata.sampler.steps} />
                    <MetaItem label="CFG" value={image.metadata.sampler.cfg} />
                    <MetaItem label="种子" value={image.metadata.sampler.seed} />
                    {image.metadata.loras.length > 0 && (
                         <div className="col-span-2">
                            <MetaItem label="LoRA" value={image.metadata.loras.join(', ')} />
                         </div>
                    )}
                </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

const MetaItem = ({ label, value }: { label: string, value: string | number | undefined }) => (
    <div className="flex flex-col p-2 bg-white/5 rounded border border-white/5">
        <span className="text-[10px] uppercase text-gray-500 font-semibold">{label}</span>
        <span className="text-xs text-gray-200 font-mono mt-1 break-words" title={String(value)}>{value || '-'}</span>
    </div>
);

export default DetailModal;
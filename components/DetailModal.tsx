import React, { useState, useEffect, useCallback } from 'react';
import { GalleryImage } from '../types';
import { SparklesIcon, XMarkIcon, HeartIcon } from './Icons';
import { generateStoryFromPrompts } from '../services/geminiService';

interface DetailModalProps {
  image: GalleryImage;
  onClose: () => void;
  onUpdateStory: (id: string, story: string) => void;
  onToggleFavorite: (id: string) => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ image, onClose, onUpdateStory, onToggleFavorite }) => {
  const [story, setStory] = useState(image.story || '');
  const [isGenerating, setIsGenerating] = useState(false);

  // Sync internal state if prop changes
  useEffect(() => {
    setStory(image.story || '');
  }, [image.story]);

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
    try {
      // Fetch image data
      const response = await fetch(image.url);
      const blob = await response.blob();
      
      // Convert to base64
      const reader = new FileReader();
      const base64Promise = new Promise<{data: string, mimeType: string}>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64String = result.split(',')[1];
          resolve({
            data: base64String,
            mimeType: blob.type
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      
      const imageData = await base64Promise;

      const newStory = await generateStoryFromPrompts(image.metadata.prompts, imageData);
      setStory(newStory);
      onUpdateStory(image.id, newStory);
    } catch (e: any) {
      console.error(e);
      // Show error in the text area so user knows what happened
      setStory(`[生成出错] ${e.message || "未知错误，请重试。"}`);
    } finally {
      setIsGenerating(false);
    }
  }, [image.metadata.prompts, image.id, image.url, onUpdateStory]);

  const handleStorySave = () => {
     onUpdateStory(image.id, story);
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
        
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/50 hover:bg-white/20 text-white transition-colors"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>

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
          <div className="p-6 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#18181b]/95 backdrop-blur z-10">
            <h3 className="text-lg font-semibold text-white">详情</h3>
            <button 
              onClick={() => onToggleFavorite(image.id)}
              className={`p-2 rounded-full border transition-all ${image.isFavorite ? 'bg-red-500/10 border-red-500/50 text-red-500' : 'border-white/10 text-gray-400 hover:text-white'}`}
            >
              <HeartIcon className="w-5 h-5" solid={image.isFavorite} />
            </button>
          </div>

          <div className="p-6 space-y-8">
            
            {/* Story Teller Section */}
            <div className="space-y-3">
               <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-purple-400 uppercase tracking-wider">故事模式</h4>
                  <button 
                    onClick={handleGenerateStory}
                    disabled={isGenerating}
                    className="flex items-center gap-2 text-xs font-semibold bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white px-3 py-1.5 rounded-full transition-all shadow-lg shadow-purple-900/20 disabled:opacity-50"
                  >
                    <SparklesIcon className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                    {isGenerating ? '生成中...' : 'AI 生成故事'}
                  </button>
               </div>
               <div className="relative group">
                 <textarea
                    value={story}
                    onChange={(e) => setStory(e.target.value)}
                    onBlur={handleStorySave}
                    placeholder="为这张图写一段故事，或使用 AI 生成..."
                    className="w-full h-40 bg-black/30 border border-white/10 rounded-lg p-4 text-gray-300 text-sm leading-relaxed focus:outline-none focus:border-purple-500/50 resize-none font-sans"
                 />
                 <div className="absolute inset-0 rounded-lg pointer-events-none border border-transparent group-hover:border-white/5 transition-colors"></div>
               </div>
            </div>

            {/* Prompts */}
            <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">正向提示词</h4>
                <div className="p-3 bg-black/30 rounded-lg border border-white/5">
                    <p className="text-sm text-gray-300 leading-relaxed font-mono text-xs opacity-90">
                        {image.metadata.prompts.join(', ')}
                    </p>
                </div>
            </div>

            {/* Negative Prompts */}
            {image.metadata.negative_prompts.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-sm font-medium text-red-400/70 uppercase tracking-wider">反向提示词</h4>
                    <div className="p-3 bg-red-900/5 rounded-lg border border-red-500/10">
                        <p className="text-sm text-gray-400 leading-relaxed font-mono text-xs opacity-80">
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
        <span className="text-xs text-gray-200 truncate font-mono mt-1" title={String(value)}>{value || '-'}</span>
    </div>
);

export default DetailModal;
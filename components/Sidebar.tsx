import React, { useMemo, useState } from 'react';
import { GalleryImage, FilterState } from '../types';
import { TagIcon, HeartIcon, MagnifyingGlassIcon } from './Icons';

interface SidebarProps {
  images: GalleryImage[];
  currentFilter: FilterState;
  onFilterChange: (filter: FilterState) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ images, currentFilter, onFilterChange }) => {
  const [tagSearch, setTagSearch] = useState('');

  // Aggregate data for filters
  const allCheckpoints = Array.from(new Set(images.flatMap(img => img.metadata.checkpoints)));
  const allLoras = Array.from(new Set(images.flatMap(img => img.metadata.loras)));

  // Extract Tags from Prompts
  const allTags = useMemo(() => {
      const tagCounts: Record<string, number> = {};
      
      images.forEach(img => {
          img.metadata.prompts.forEach(prompt => {
              const parts = prompt.split(',');
              parts.forEach(part => {
                  const tag = part.trim();
                  if (tag.length > 0 && tag.length < 50) {
                      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                  }
              });
          });
      });

      let tags = Object.entries(tagCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([tag]) => tag);
      
      if (tagSearch) {
          const lowerSearch = tagSearch.toLowerCase();
          tags = tags.filter(t => t.toLowerCase().includes(lowerSearch));
      } else {
          // Limit to top 100 if no search
          tags = tags.slice(0, 100);
      }
      
      return tags;
  }, [images, tagSearch]);

  return (
    <div className="w-64 h-screen fixed left-0 top-0 bg-[#121212] border-r border-white/5 flex flex-col z-40 hidden md:flex">
      {/* Brand */}
      <div className="p-6">
        <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
          AI 图库
        </h1>
        <p className="text-xs text-gray-500 mt-1">故事版</p>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6 custom-scrollbar">
        
        {/* Main Links */}
        <div className="space-y-1">
          <NavItem 
            active={currentFilter.type === 'all'} 
            onClick={() => onFilterChange({ type: 'all' })}
            label="全部图片"
            count={images.length}
          />
          <NavItem 
            active={currentFilter.type === 'favorite'} 
            onClick={() => onFilterChange({ type: 'favorite' })}
            label="收藏"
            icon={<HeartIcon className="w-4 h-4" />}
            count={images.filter(i => i.isFavorite).length}
          />
        </div>

        {/* Tags Section */}
        <div>
           <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2 flex justify-between items-center">
             常用标签
             <span className="text-[10px] text-gray-600">{allTags.length}</span>
           </h3>
           
           {/* Search Box */}
           <div className="px-2 mb-3">
             <div className="relative group">
                <MagnifyingGlassIcon className="w-3 h-3 text-gray-500 absolute left-2 top-2" />
                <input 
                  type="text" 
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  placeholder="搜索标签..." 
                  className="w-full bg-[#18181b] border border-white/5 rounded-md py-1.5 pl-7 pr-2 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                />
             </div>
           </div>

           {/* Tags Cloud / List */}
           <div className="flex flex-wrap gap-1.5 px-2 max-h-60 overflow-y-auto custom-scrollbar">
            {allTags.map(tag => {
              const isActive = currentFilter.type === 'tag' && currentFilter.value === tag;
              return (
                <button
                  key={tag}
                  onClick={() => onFilterChange({ type: 'tag', value: tag })}
                  className={`text-[10px] px-2 py-1 rounded border transition-all truncate max-w-full ${
                    isActive 
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' 
                      : 'bg-white/5 border-transparent text-gray-400 hover:border-white/10 hover:text-gray-200'
                  }`}
                  title={tag}
                >
                  {tag}
                </button>
              );
            })}
             {allTags.length === 0 && <span className="text-xs text-gray-700 px-2 w-full text-center py-2">无结果</span>}
           </div>
        </div>

        {/* Checkpoints Section */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">模型</h3>
          <div className="space-y-1">
            {allCheckpoints.map(ckpt => (
              <NavItem 
                key={ckpt}
                active={currentFilter.type === 'checkpoint' && currentFilter.value === ckpt}
                onClick={() => onFilterChange({ type: 'checkpoint', value: ckpt })}
                label={ckpt}
                icon={<TagIcon className="w-3 h-3 text-cyan-500" />}
              />
            ))}
            {allCheckpoints.length === 0 && <span className="text-xs text-gray-700 px-2">暂无模型</span>}
          </div>
        </div>

        {/* Loras Section */}
        <div>
           <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">LoRA</h3>
           <div className="space-y-1">
            {allLoras.map(lora => (
              <NavItem 
                key={lora}
                active={currentFilter.type === 'lora' && currentFilter.value === lora}
                onClick={() => onFilterChange({ type: 'lora', value: lora })}
                label={lora}
                icon={<TagIcon className="w-3 h-3 text-purple-500" />}
              />
            ))}
             {allLoras.length === 0 && <span className="text-xs text-gray-700 px-2">暂无 LoRA</span>}
           </div>
        </div>

      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/5 text-[10px] text-gray-600">
        本地图库 v1.1.0
      </div>
    </div>
  );
};

const NavItem = ({ active, onClick, label, count, icon }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all group ${
      active 
        ? 'bg-white/10 text-white font-medium' 
        : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
    }`}
  >
    <div className="flex items-center gap-2 truncate">
      {icon}
      <span className="truncate" title={label}>{label}</span>
    </div>
    {count !== undefined && (
      <span className={`text-[10px] py-0.5 px-1.5 rounded-full ${active ? 'bg-white/20' : 'bg-white/5'}`}>
        {count}
      </span>
    )}
  </button>
);

export default Sidebar;

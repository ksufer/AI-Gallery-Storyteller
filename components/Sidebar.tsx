import React, { useMemo, useState, useEffect } from 'react';
import { GalleryImage, FilterState } from '../types';
import { TagIcon, HeartIcon, MagnifyingGlassIcon, CalendarIcon } from './Icons';

interface SidebarProps {
  images: GalleryImage[];
  currentFilter: FilterState;
  onFilterChange: (filter: FilterState) => void;
  refreshKey?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ images, currentFilter, onFilterChange, refreshKey }) => {
  const [tagSearch, setTagSearch] = useState('');
  const [userTagSearch, setUserTagSearch] = useState('');
  const [folders, setFolders] = useState<string[]>([]);
  const [folderCounts, setFolderCounts] = useState<{ [key: string]: number }>({});
  const [autoTags, setAutoTags] = useState<Array<{ name: string, count: number }>>([]);
  const [userTags, setUserTags] = useState<Array<{ name: string, count: number }>>([]);
  const [totalImageCount, setTotalImageCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);

  // Fetch counts, folders and tags on mount
  useEffect(() => {
    fetchCounts();
    fetchFolders();
    fetchAutoTags();
    fetchUserTags();
  }, []); // Only on mount

  // Refetch counts when images change
  useEffect(() => {
    fetchCounts();
  }, [images.length]);

  // Refetch tags and counts when refreshKey changes (triggered by tag additions/removals or favorite changes)
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      fetchCounts();
      fetchAutoTags();
      fetchUserTags();
    }
  }, [refreshKey]);

  // Refetch tags when search changes
  useEffect(() => {
    fetchAutoTags();
  }, [tagSearch]);

  useEffect(() => {
    fetchUserTags();
  }, [userTagSearch]);

  const fetchCounts = async () => {
    try {
      // Fetch total count
      const totalResponse = await fetch('/api/images?page=1&limit=1');
      const totalData = await totalResponse.json();
      if (totalData.total !== undefined) {
        setTotalImageCount(totalData.total);
      }

      // Fetch favorite count
      const favoriteResponse = await fetch('/api/images?page=1&limit=1&favorite=true');
      const favoriteData = await favoriteResponse.json();
      if (favoriteData.total !== undefined) {
        setFavoriteCount(favoriteData.total);
      }
    } catch (error) {
      console.error('Failed to fetch counts:', error);
    }
  };

  const fetchFolders = async () => {
    try {
      const response = await fetch('/api/folders');
      const result = await response.json();
      
      if (result.success) {
        setFolders(result.folders || []);
        setFolderCounts(result.counts || {});
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error);
    }
  };

  const fetchAutoTags = async () => {
    try {
      const params = new URLSearchParams({ source: 'auto' });
      if (tagSearch) params.set('q', tagSearch);
      
      const response = await fetch(`/api/tags?${params}`);
      const tags = await response.json();
      
      // Limit to top 100
      setAutoTags((tags || []).slice(0, 100));
    } catch (error) {
      console.error('Failed to fetch auto tags:', error);
    }
  };

  const fetchUserTags = async () => {
    try {
      const params = new URLSearchParams({ source: 'user' });
      if (userTagSearch) params.set('q', userTagSearch);
      
      const response = await fetch(`/api/tags?${params}`);
      const tags = await response.json();
      
      setUserTags(tags || []);
    } catch (error) {
      console.error('Failed to fetch user tags:', error);
    }
  };

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
            count={totalImageCount}
          />
          <NavItem 
            active={currentFilter.type === 'favorite'} 
            onClick={() => onFilterChange({ type: 'favorite' })}
            label="收藏"
            icon={<HeartIcon className="w-4 h-4" />}
            count={favoriteCount}
          />
        </div>

        {/* User Tags Section */}
        <div>
           <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2 flex justify-between items-center">
             用户标签
             <span className="text-[10px] text-gray-600">{userTags.length}</span>
           </h3>
           
           {/* Search Box */}
           <div className="px-2 mb-3">
             <div className="relative group">
                <MagnifyingGlassIcon className="w-3 h-3 text-gray-500 absolute left-2 top-2" />
                <input 
                  type="text" 
                  value={userTagSearch}
                  onChange={(e) => setUserTagSearch(e.target.value)}
                  placeholder="搜索用户标签..." 
                  className="w-full bg-[#18181b] border border-white/5 rounded-md py-1.5 pl-7 pr-2 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors"
                />
             </div>
           </div>

           {/* Tags Cloud / List */}
           <div className="flex flex-wrap gap-1.5 px-2 max-h-40 overflow-y-auto custom-scrollbar">
            {userTags.map(tag => {
              const isActive = currentFilter.type === 'tag' && currentFilter.value === tag.name;
              return (
                <button
                  key={tag.name}
                  onClick={() => onFilterChange({ type: 'tag', value: tag.name })}
                  className={`text-[10px] px-2 py-1 rounded border transition-all truncate max-w-full ${
                    isActive 
                      ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' 
                      : 'bg-white/5 border-transparent text-gray-400 hover:border-white/10 hover:text-gray-200'
                  }`}
                  title={`${tag.name} (${tag.count})`}
                >
                  {tag.name}
                </button>
              );
            })}
             {userTags.length === 0 && <span className="text-xs text-gray-700 px-2 w-full text-center py-2">暂无用户标签</span>}
           </div>
        </div>

        {/* Auto Tags Section */}
        <div>
           <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2 flex justify-between items-center">
             常用标签
             <span className="text-[10px] text-gray-600">{autoTags.length}</span>
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
            {autoTags.map(tag => {
              const isActive = currentFilter.type === 'tag' && currentFilter.value === tag.name;
              return (
                <button
                  key={tag.name}
                  onClick={() => onFilterChange({ type: 'tag', value: tag.name })}
                  className={`text-[10px] px-2 py-1 rounded border transition-all truncate max-w-full ${
                    isActive 
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' 
                      : 'bg-white/5 border-transparent text-gray-400 hover:border-white/10 hover:text-gray-200'
                  }`}
                  title={`${tag.name} (${tag.count})`}
                >
                  {tag.name}
                </button>
              );
            })}
             {autoTags.length === 0 && <span className="text-xs text-gray-700 px-2 w-full text-center py-2">无结果</span>}
           </div>
        </div>

        {/* Folders Section */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2 flex justify-between items-center">
            按日期浏览
            <span className="text-[10px] text-gray-600">{folders.length}</span>
          </h3>
          <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
            {folders.map(folder => (
              <NavItem 
                key={folder}
                active={currentFilter.type === 'folder' && currentFilter.value === folder}
                onClick={() => onFilterChange({ type: 'folder', value: folder })}
                label={folder}
                icon={<CalendarIcon className="w-3 h-3 text-green-500" />}
                count={folderCounts[folder]}
              />
            ))}
            {folders.length === 0 && <span className="text-xs text-gray-700 px-2">暂无日期文件夹</span>}
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

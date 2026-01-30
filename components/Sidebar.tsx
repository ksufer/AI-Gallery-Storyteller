import React from 'react';
import { GalleryImage, FilterState } from '../types';
import { TagIcon, HeartIcon } from './Icons';

interface SidebarProps {
  images: GalleryImage[];
  currentFilter: FilterState;
  onFilterChange: (filter: FilterState) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ images, currentFilter, onFilterChange }) => {
  // Aggregate data for filters
  const allCheckpoints = Array.from(new Set(images.flatMap(img => img.metadata.checkpoints)));
  const allLoras = Array.from(new Set(images.flatMap(img => img.metadata.loras)));

  return (
    <div className="w-64 h-screen fixed left-0 top-0 bg-[#121212] border-r border-white/5 flex flex-col z-40 hidden md:flex">
      {/* Brand */}
      <div className="p-6">
        <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
          AIGallery
        </h1>
        <p className="text-xs text-gray-500 mt-1">Storyteller Edition</p>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6 custom-scrollbar">
        
        {/* Main Links */}
        <div className="space-y-1">
          <NavItem 
            active={currentFilter.type === 'all'} 
            onClick={() => onFilterChange({ type: 'all' })}
            label="All Images"
            count={images.length}
          />
          <NavItem 
            active={currentFilter.type === 'favorite'} 
            onClick={() => onFilterChange({ type: 'favorite' })}
            label="Favorites"
            icon={<HeartIcon className="w-4 h-4" />}
            count={images.filter(i => i.isFavorite).length}
          />
        </div>

        {/* Checkpoints Section */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">Models</h3>
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
            {allCheckpoints.length === 0 && <span className="text-xs text-gray-700 px-2">No models found</span>}
          </div>
        </div>

        {/* Loras Section */}
        <div>
           <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">LoRAs</h3>
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
             {allLoras.length === 0 && <span className="text-xs text-gray-700 px-2">No LoRAs found</span>}
           </div>
        </div>

      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/5 text-[10px] text-gray-600">
        Local Library v1.0.0
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
      <span className="truncate">{label}</span>
    </div>
    {count !== undefined && (
      <span className={`text-[10px] py-0.5 px-1.5 rounded-full ${active ? 'bg-white/20' : 'bg-white/5'}`}>
        {count}
      </span>
    )}
  </button>
);

export default Sidebar;
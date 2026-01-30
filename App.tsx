import React, { useState, useMemo, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DetailModal from './components/DetailModal';
import { GalleryImage, FilterState } from './types';
import { SparklesIcon, DocumentTextIcon, HeartIcon } from './components/Icons';

function App() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterState>({ type: 'all' });
  const [isLoading, setIsLoading] = useState(true);

  // Fetch images from backend
  useEffect(() => {
    fetch('/api/images')
      .then(res => res.json())
      .then(data => {
        setImages(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Failed to load images:", err);
        setIsLoading(false);
      });
  }, []);

  // Filter Logic
  const filteredImages = useMemo(() => {
    return images.filter(img => {
      if (filter.type === 'favorite') return img.isFavorite;
      if (filter.type === 'checkpoint' && filter.value) return img.metadata.checkpoints.includes(filter.value);
      if (filter.type === 'lora' && filter.value) return img.metadata.loras.includes(filter.value);
      return true;
    });
  }, [images, filter]);

  // Handlers
  const handleUpdateStory = (id: string, newStory: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, story: newStory } : img));
  };

  const handleToggleFavorite = (id: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, isFavorite: !img.isFavorite } : img));
  };

  const selectedImage = images.find(img => img.id === selectedImageId);

  return (
    <div className="min-h-screen bg-[#121212] text-gray-200 font-sans selection:bg-cyan-500/30">
      
      {/* Sidebar Navigation */}
      <Sidebar 
        images={images} 
        currentFilter={filter} 
        onFilterChange={setFilter} 
      />

      {/* Main Content */}
      <main className="md:pl-64 min-h-screen transition-all duration-300">
        <header className="sticky top-0 z-30 bg-[#121212]/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-medium text-white capitalize">
              {filter.type === 'all' ? '图库' : filter.type === 'favorite' ? '收藏' : filter.value}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">共 {filteredImages.length} 张</p>
          </div>
        </header>

        <div className="p-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <SparklesIcon className="w-8 h-8 animate-spin text-cyan-500" />
            </div>
          ) : (
            /* Masonry-style Grid using Tailwind Columns */
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
              {filteredImages.map(image => (
                <div 
                  key={image.id} 
                  onClick={() => setSelectedImageId(image.id)}
                  className="break-inside-avoid relative group cursor-pointer rounded-xl overflow-hidden bg-[#18181b] border border-white/5 hover:border-white/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-900/10"
                >
                  {/* Image */}
                  <img 
                    src={image.url} 
                    alt={image.fileName} 
                    className="w-full h-auto object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                    loading="lazy"
                  />
                  
                  {/* Overlay Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                    <div className="flex items-center justify-between">
                       <div>
                          <p className="text-sm font-medium text-white truncate w-40">{image.fileName}</p>
                          <p className="text-[10px] text-gray-400">{image.metadata.type}</p>
                       </div>
                       {image.story && <DocumentTextIcon className="w-4 h-4 text-purple-400" />}
                    </div>
                  </div>

                  {/* Status Indicators (Always Visible or on Hover) */}
                  <div className="absolute top-3 right-3 flex gap-2">
                      {image.isFavorite && (
                          <div className="bg-black/50 backdrop-blur rounded-full p-1.5">
                              <HeartIcon className="w-3 h-3 text-red-500" solid />
                          </div>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && filteredImages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[50vh] text-gray-600">
              <SparklesIcon className="w-12 h-12 mb-4 opacity-20" />
              <p>当前筛选下没有图片。</p>
            </div>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      {selectedImage && (
        <DetailModal 
          image={selectedImage} 
          onClose={() => setSelectedImageId(null)} 
          onUpdateStory={handleUpdateStory}
          onToggleFavorite={handleToggleFavorite}
        />
      )}
    </div>
  );
}

export default App;

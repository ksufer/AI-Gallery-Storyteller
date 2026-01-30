import React, { useState, useMemo, useRef } from 'react';
import Sidebar from './components/Sidebar';
import DetailModal from './components/DetailModal';
import { GalleryImage, FilterState } from './types';
import { MOCK_IMAGES } from './constants';
import { SparklesIcon, DocumentTextIcon, HeartIcon, ArrowUpTrayIcon } from './components/Icons';
import { parseImageFile } from './services/imageParser';

function App() {
  const [images, setImages] = useState<GalleryImage[]>(MOCK_IMAGES);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterState>({ type: 'all' });
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const metadata = await parseImageFile(file);
      const newImage: GalleryImage = {
        id: crypto.randomUUID(),
        url: URL.createObjectURL(file),
        fileName: file.name,
        metadata: metadata,
        isFavorite: false,
        dateAdded: new Date().toISOString(),
      };
      setImages(prev => [newImage, ...prev]);
    } catch (error) {
      console.error("Failed to process image:", error);
      alert("Could not process image metadata.");
    } finally {
      setIsProcessing(false);
      // Reset input so same file can be selected again
      if (event.target) event.target.value = '';
    }
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
              {filter.type === 'all' ? 'Library' : filter.type === 'favorite' ? 'Favorites' : filter.value}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{filteredImages.length} items</p>
          </div>
          
          <div className="flex items-center gap-4">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/png" 
              className="hidden" 
            />
            <button 
              onClick={handleUploadClick}
              disabled={isProcessing}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium px-4 py-2 rounded-lg transition-colors text-white disabled:opacity-50"
            >
              <ArrowUpTrayIcon className={`w-4 h-4 ${isProcessing ? 'animate-bounce' : ''}`} />
              {isProcessing ? 'Scanning...' : 'Upload Image'}
            </button>
          </div>
        </header>

        <div className="p-6">
          {/* Masonry-style Grid using Tailwind Columns */}
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

          {filteredImages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[50vh] text-gray-600">
              <SparklesIcon className="w-12 h-12 mb-4 opacity-20" />
              <p>No images found for this filter.</p>
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
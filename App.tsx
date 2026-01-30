import React, { useState, useMemo, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DetailModal from './components/DetailModal';
import SettingsModal from './components/SettingsModal';
import VirtualMasonryGallery from './components/VirtualMasonryGallery';
import { GalleryImage, FilterState, PaginatedResponse } from './types';
import { MOCK_IMAGES } from './constants';
import { SparklesIcon, CogIcon } from './components/Icons';

function App() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterState>({ type: 'all' });
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const folderInputRef = React.useRef<HTMLInputElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalImages, setTotalImages] = useState(0);
  
  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  // Fetch images from backend with pagination
  const fetchImages = async (pageNum: number = 1, append: boolean = false) => {
    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      // Build query parameters
      let queryParams = `page=${pageNum}&limit=20`;
      if (filter.type === 'folder' && filter.value) {
        queryParams += `&folder=${encodeURIComponent(filter.value)}`;
      }
      if (filter.type === 'tag' && filter.value) {
        queryParams += `&tag=${encodeURIComponent(filter.value)}`;
      }

      const response = await fetch(`/api/images?${queryParams}`);
      const data = await response.json();
      
      // Check if response is paginated
      const isPaginated = 'data' in data && 'total' in data;
      
      if (isPaginated) {
        const paginatedData = data as PaginatedResponse<GalleryImage>;
        
        if (append) {
          setImages(prev => [...prev, ...paginatedData.data]);
        } else {
          setImages(paginatedData.data);
        }
        
        setHasMore(paginatedData.hasMore);
        setPage(paginatedData.page);
        setTotalImages(paginatedData.total);
      } else {
        // Legacy response (array of images)
        const legacyData = data as GalleryImage[];
        if (legacyData.length === 0) {
          setImages(MOCK_IMAGES);
          setTotalImages(MOCK_IMAGES.length);
        } else {
          setImages(legacyData);
          setTotalImages(legacyData.length);
        }
        setHasMore(false);
      }
    } catch (err) {
      console.error("Failed to load images:", err);
      setImages(MOCK_IMAGES);
      setTotalImages(MOCK_IMAGES.length);
      setHasMore(false);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Load more images
  const loadMore = () => {
    if (hasMore && !isLoadingMore) {
      fetchImages(page + 1, true);
    }
  };

  // Reset and fetch from beginning when filter changes
  useEffect(() => {
    setPage(1);
    setImages([]);
    fetchImages(1, false);
  }, [filter]);

  // Filter Logic (only for client-side filters)
  const filteredImages = useMemo(() => {
    return images.filter(img => {
      // Tag and folder filters are handled by the API, so no need to filter again
      if (filter.type === 'tag' || filter.type === 'folder') return true;
      
      if (filter.type === 'favorite') return img.isFavorite;
      if (filter.type === 'checkpoint' && filter.value) return img.metadata.checkpoints.includes(filter.value);
      if (filter.type === 'lora' && filter.value) return img.metadata.loras.includes(filter.value);
      return true;
    });
  }, [images, filter]);

  // Handlers
  const handleUpdateStory = (id: string, newStory: string) => {
    // Optimistic update
    setImages(prev => prev.map(img => img.id === id ? { ...img, story: newStory } : img));

    // Persist to backend
    fetch(`/api/images/${id}/story`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ story: newStory })
    }).catch(err => console.error("Failed to persist story:", err));
  };

  const handleToggleFavorite = (id: string) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, isFavorite: !img.isFavorite } : img));
  };

  const handleDeleteImage = (id: string) => {
    // Remove from local state
    setImages(prev => prev.filter(img => img.id !== id));
    setTotalImages(prev => prev - 1);
  };

  // Upload files (extracted logic for reuse)
  const uploadFiles = React.useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Only append image files
      if (['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type.toLowerCase()) || 
          /\.(png|jpe?g|webp)$/i.test(file.name)) {
        formData.append('files', file);
        // Append lastModified timestamp for each file
        formData.append('lastModified', file.lastModified.toString());
      }
    }

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadStatus({ 
          message: `成功上传 ${result.files.filter((f: any) => f.success).length} 个文件`, 
          type: 'success' 
        });
        // Refresh images list
        fetchImages(1, false);
        // Clear file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setUploadStatus({ 
          message: result.error || '上传失败', 
          type: 'error' 
        });
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      setUploadStatus({ 
        message: error.message || '上传失败', 
        type: 'error' 
      });
    } finally {
      setIsUploading(false);
      // Clear status message after 3 seconds
      setTimeout(() => setUploadStatus(null), 3000);
    }
  }, []);

  const handleBatchUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    await uploadFiles(Array.from(files));
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFolderUploadClick = () => {
    folderInputRef.current?.click();
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if we're leaving the main container
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter((file: File) => 
      file.type.startsWith('image/')
    );

    if (files.length > 0) {
      await uploadFiles(files);
    }
  };

  // Paste handler
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        await uploadFiles(imageFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [uploadFiles]);

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
      <main 
        className="md:pl-64 h-screen flex flex-col transition-all duration-300 relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag and Drop Overlay */}
        {isDragging && (
          <div className="fixed inset-0 md:left-64 z-50 bg-cyan-500/20 backdrop-blur-sm border-4 border-dashed border-cyan-500 flex items-center justify-center pointer-events-none">
            <div className="bg-[#121212]/90 p-8 rounded-2xl border border-cyan-500/50 shadow-2xl">
              <div className="flex flex-col items-center gap-4">
                <svg className="w-16 h-16 text-cyan-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white mb-2">拖放图片到这里</p>
                  <p className="text-sm text-gray-400">支持 PNG, JPG, WEBP 格式</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <header className="flex-none sticky top-0 z-30 bg-[#121212]/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-medium text-white capitalize">
              {filter.type === 'all' ? '图库' : 
               filter.type === 'favorite' ? '收藏' : 
               filter.type === 'folder' ? filter.value :
               filter.value}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">共 {filteredImages.length} 张</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors border border-white/10"
              title="设置"
            >
              <CogIcon className="w-5 h-5" />
            </button>
            {uploadStatus && (
              <div className={`text-sm px-3 py-1 rounded-md ${
                uploadStatus.type === 'success' 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {uploadStatus.message}
              </div>
            )}
            <button
              onClick={handleFolderUploadClick}
              disabled={isUploading}
              className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isUploading ? (
                <SparklesIcon className="w-4 h-4 animate-spin" />
              ) : (
                <span>上传文件夹</span>
              )}
            </button>
            <button
              onClick={handleUploadClick}
              disabled={isUploading}
              className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <SparklesIcon className="w-4 h-4 animate-spin" />
                  <span>上传中...</span>
                </>
              ) : (
                <span>批量上传</span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleBatchUpload}
              className="hidden"
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              // @ts-ignore
              webkitdirectory=""
              // @ts-ignore
              directory=""
              onChange={handleBatchUpload}
              className="hidden"
            />
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <SparklesIcon className="w-8 h-8 animate-spin text-cyan-500" />
            </div>
          ) : (
            <VirtualMasonryGallery
              images={filteredImages}
              onImageClick={setSelectedImageId}
              onLoadMore={loadMore}
              hasMore={hasMore}
              isLoading={isLoadingMore}
            />
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
          onDelete={handleDeleteImage}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal 
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;

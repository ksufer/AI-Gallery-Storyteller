import React, { useState, useMemo, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DetailModal from './components/DetailModal';
import SettingsModal from './components/SettingsModal';
import VirtualMasonryGallery from './components/VirtualMasonryGallery';
import BatchActionBar from './components/BatchActionBar';
import { GalleryImage, FilterState, PaginatedResponse } from './types';
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
  
  // Trigger for sidebar refresh
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
  
  // Batch operation state
  const [batchMode, setBatchMode] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());

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
      if (filter.type === 'favorite') {
        queryParams += `&favorite=true`;
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
        setImages(legacyData);
        setTotalImages(legacyData.length);
        setHasMore(false);
      }
    } catch (err) {
      console.error("Failed to load images:", err);
      setImages([]);
      setTotalImages(0);
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
      // Tag, folder, and favorite filters are handled by the API, so no need to filter again
      if (filter.type === 'tag' || filter.type === 'folder' || filter.type === 'favorite') return true;
      
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

  const handleToggleFavorite = async (id: string) => {
    // Find the image to get its current favorite status
    const image = images.find(img => img.id === id);
    if (!image) return;

    const newFavoriteStatus = !image.isFavorite;

    // Optimistic update
    setImages(prev => prev.map(img => img.id === id ? { ...img, isFavorite: newFavoriteStatus } : img));

    // Persist to backend
    try {
      const response = await fetch(`/api/images/${id}/favorite`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: newFavoriteStatus })
      });

      if (!response.ok) {
        // Revert on failure
        setImages(prev => prev.map(img => img.id === id ? { ...img, isFavorite: !newFavoriteStatus } : img));
        console.error("Failed to update favorite status");
      } else {
        // Trigger sidebar refresh to update favorite count
        setSidebarRefreshKey(prev => prev + 1);
      }
    } catch (err) {
      // Revert on error
      setImages(prev => prev.map(img => img.id === id ? { ...img, isFavorite: !newFavoriteStatus } : img));
      console.error("Failed to persist favorite:", err);
    }
  };

  const handleDeleteImage = (id: string) => {
    // Remove from local state
    setImages(prev => prev.filter(img => img.id !== id));
    setTotalImages(prev => prev - 1);
  };

  const handleTagsChanged = () => {
    // Trigger sidebar refresh when tags are added or removed
    setSidebarRefreshKey(prev => prev + 1);
  };

  // Batch operation handlers
  const toggleBatchMode = () => {
    setBatchMode(prev => !prev);
    setSelectedImageIds(new Set()); // Clear selection when toggling
  };

  const toggleImageSelection = (id: string) => {
    setSelectedImageIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedImageIds(new Set(filteredImages.map(img => img.id)));
  };

  const clearSelection = () => {
    setSelectedImageIds(new Set());
  };

  const handleBatchDelete = async (imageIds: string[]) => {
    try {
      const response = await fetch('/api/batch/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageIds })
      });

      const result = await response.json();
      
      if (result.success) {
        // Remove deleted images from local state
        setImages(prev => prev.filter(img => !imageIds.includes(img.id)));
        setTotalImages(prev => prev - result.succeeded);
        setSelectedImageIds(new Set());
        
        setUploadStatus({
          message: `成功删除 ${result.succeeded} 张图片${result.failed > 0 ? `, ${result.failed} 张失败` : ''}`,
          type: result.failed > 0 ? 'error' : 'success'
        });
      } else {
        setUploadStatus({
          message: result.error || '批量删除失败',
          type: 'error'
        });
      }
      
      setTimeout(() => setUploadStatus(null), 3000);
    } catch (error: any) {
      console.error('Batch delete error:', error);
      setUploadStatus({
        message: error.message || '批量删除失败',
        type: 'error'
      });
      setTimeout(() => setUploadStatus(null), 3000);
    }
  };

  const handleBatchFavorite = async (imageIds: string[], isFavorite: boolean) => {
    try {
      const response = await fetch('/api/batch/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageIds, isFavorite })
      });

      const result = await response.json();
      
      if (result.success) {
        // Update local state
        setImages(prev => prev.map(img => 
          imageIds.includes(img.id) ? { ...img, isFavorite } : img
        ));
        setSelectedImageIds(new Set());
        setSidebarRefreshKey(prev => prev + 1);
        
        setUploadStatus({
          message: `成功${isFavorite ? '收藏' : '取消收藏'} ${result.succeeded} 张图片${result.failed > 0 ? `, ${result.failed} 张失败` : ''}`,
          type: result.failed > 0 ? 'error' : 'success'
        });
      } else {
        setUploadStatus({
          message: result.error || '批量操作失败',
          type: 'error'
        });
      }
      
      setTimeout(() => setUploadStatus(null), 3000);
    } catch (error: any) {
      console.error('Batch favorite error:', error);
      setUploadStatus({
        message: error.message || '批量操作失败',
        type: 'error'
      });
      setTimeout(() => setUploadStatus(null), 3000);
    }
  };

  const handleBatchAddTag = async (imageIds: string[], tagName: string) => {
    try {
      const response = await fetch('/api/batch/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageIds, tagName })
      });

      const result = await response.json();
      
      if (result.success) {
        setSelectedImageIds(new Set());
        setSidebarRefreshKey(prev => prev + 1);
        
        setUploadStatus({
          message: `成功为 ${result.succeeded} 张图片添加标签${result.failed > 0 ? `, ${result.failed} 张失败` : ''}`,
          type: result.failed > 0 ? 'error' : 'success'
        });
      } else {
        setUploadStatus({
          message: result.error || '批量添加标签失败',
          type: 'error'
        });
      }
      
      setTimeout(() => setUploadStatus(null), 3000);
    } catch (error: any) {
      console.error('Batch add tag error:', error);
      setUploadStatus({
        message: error.message || '批量添加标签失败',
        type: 'error'
      });
      setTimeout(() => setUploadStatus(null), 3000);
    }
  };

  const handleBatchGenerateStories = async (imageIds: string[]) => {
    try {
      setUploadStatus({
        message: `正在为 ${imageIds.length} 张图片生成故事...`,
        type: 'success'
      });

      const response = await fetch('/api/batch/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageIds })
      });

      const result = await response.json();
      
      if (result.success) {
        // Refresh images to get updated stories
        await fetchImages(page, false);
        setSelectedImageIds(new Set());
        
        setUploadStatus({
          message: `成功生成 ${result.succeeded} 个故事${result.failed > 0 ? `, ${result.failed} 个失败` : ''}`,
          type: result.failed > 0 ? 'error' : 'success'
        });
      } else {
        setUploadStatus({
          message: result.error || '批量生成故事失败',
          type: 'error'
        });
      }
      
      setTimeout(() => setUploadStatus(null), 5000);
    } catch (error: any) {
      console.error('Batch generate stories error:', error);
      setUploadStatus({
        message: error.message || '批量生成故事失败',
        type: 'error'
      });
      setTimeout(() => setUploadStatus(null), 3000);
    }
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
        refreshKey={sidebarRefreshKey}
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
          <div className="fixed inset-0 md:left-64 z-50 bg-black/60 backdrop-blur-sm border-4 border-dashed border-cyan-500/50 flex items-center justify-center pointer-events-none transition-all duration-300">
            <div className="bg-black/80 backdrop-blur-xl p-10 rounded-3xl border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.2)] transform scale-110 transition-transform">
              <div className="flex flex-col items-center gap-6">
                <div className="p-4 rounded-full bg-cyan-500/10 animate-bounce">
                  <svg className="w-16 h-16 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-white mb-2 tracking-tight">释放以上传</p>
                  <p className="text-sm text-gray-400 font-medium">支持 PNG, JPG, WEBP 格式</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <header className="flex-none sticky top-0 z-30 bg-black/40 backdrop-blur-xl border-b border-white/5 px-8 py-5 flex justify-between items-center transition-colors duration-300">
          <div>
            <h2 className="text-2xl font-semibold text-white capitalize tracking-tight flex items-center gap-2">
              {filter.type === 'all' ? '全部图库' : 
               filter.type === 'favorite' ? '我的收藏' : 
               filter.type === 'folder' ? filter.value :
               filter.value}
            </h2>
            <p className="text-xs text-gray-400 mt-1 font-medium tracking-wide uppercase">共 {filteredImages.length} 张图片</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleBatchMode}
              className={`p-2.5 rounded-xl transition-all border ${
                batchMode
                  ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400'
                  : 'bg-white/5 hover:bg-white/10 border-transparent hover:border-white/10 text-gray-400 hover:text-white'
              }`}
              title={batchMode ? '退出批量模式' : '批量操作'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-transparent hover:border-white/10"
              title="设置"
            >
              <CogIcon className="w-5 h-5" />
            </button>
            {uploadStatus && (
              <div className={`text-xs px-4 py-2 rounded-xl border backdrop-blur-md animate-fade-in ${
                uploadStatus.type === 'success' 
                  ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                {uploadStatus.message}
              </div>
            )}
            <button
              onClick={handleFolderUploadClick}
              disabled={isUploading}
              className="px-5 py-2.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-purple-200 border border-purple-500/20 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium text-sm"
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
              className="px-5 py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-200 border border-cyan-500/20 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium text-sm shadow-[0_0_15px_rgba(6,182,212,0.1)] hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]"
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
              onImageClick={batchMode ? () => {} : setSelectedImageId}
              onLoadMore={loadMore}
              hasMore={hasMore}
              isLoading={isLoadingMore}
              batchMode={batchMode}
              selectedImageIds={selectedImageIds}
              onToggleSelect={toggleImageSelection}
            />
          )}
        </div>
      </main>

      {/* Batch Action Bar */}
      {batchMode && (
        <BatchActionBar
          selectedCount={selectedImageIds.size}
          totalCount={filteredImages.length}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          onDelete={handleBatchDelete}
          onFavorite={handleBatchFavorite}
          onAddTag={handleBatchAddTag}
          onGenerateStories={handleBatchGenerateStories}
          onExitBatchMode={toggleBatchMode}
          selectedImageIds={Array.from(selectedImageIds)}
        />
      )}

      {/* Detail Modal */}
      {selectedImage && (
        <DetailModal 
          image={selectedImage} 
          onClose={() => setSelectedImageId(null)} 
          onUpdateStory={handleUpdateStory}
          onToggleFavorite={handleToggleFavorite}
          onDelete={handleDeleteImage}
          onTagsChanged={handleTagsChanged}
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

import React, { useState, useEffect, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { GalleryImage } from '../types';
import ImageCard from './ImageCard';
import { SparklesIcon } from './Icons';

interface VirtualMasonryGalleryProps {
  images: GalleryImage[];
  onImageClick: (id: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  batchMode?: boolean;
  selectedImageIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

interface ColumnGroup {
  columnIndex: number;
  images: GalleryImage[];
}

const VirtualMasonryGallery: React.FC<VirtualMasonryGalleryProps> = ({
  images,
  onImageClick,
  onLoadMore,
  hasMore = false,
  isLoading = false,
  batchMode = false,
  selectedImageIds = new Set(),
  onToggleSelect
}) => {
  const [columns, setColumns] = useState(4);

  // Update column count based on window size
  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setColumns(1);
      } else if (width < 1024) {
        setColumns(2);
      } else if (width < 1280) {
        setColumns(3);
      } else {
        setColumns(4);
      }
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  // Organize images into columns for masonry layout
  const columnGroups = useMemo(() => {
    const groups: ColumnGroup[] = Array.from({ length: columns }, (_, i) => ({
      columnIndex: i,
      images: []
    }));

    // Distribute images across columns (simple round-robin)
    images.forEach((image, index) => {
      const columnIndex = index % columns;
      groups[columnIndex].images.push(image);
    });

    return groups;
  }, [images, columns]);

  // Flatten column groups into rows for Virtuoso
  // Each "row" contains all columns
  const virtualizedRows = useMemo(() => {
    if (columnGroups.length === 0) return [];
    
    // Find the maximum number of images in any column
    const maxRows = Math.max(...columnGroups.map(g => g.images.length));
    
    // Create rows where each row contains one image from each column (or null)
    const rows: (GalleryImage | null)[][] = [];
    for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
      const row: (GalleryImage | null)[] = columnGroups.map(
        group => group.images[rowIndex] || null
      );
      rows.push(row);
    }
    
    return rows;
  }, [columnGroups]);

  // Footer component for loading more
  const Footer = () => {
    if (!hasMore && !isLoading) return null;
    
    return (
      <div className="flex justify-center items-center py-8">
        {isLoading ? (
          <div className="flex items-center gap-2 text-cyan-400">
            <SparklesIcon className="w-5 h-5 animate-spin" />
            <span className="text-sm">加载中...</span>
          </div>
        ) : hasMore ? (
          <button
            onClick={onLoadMore}
            className="px-6 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg transition-colors"
          >
            加载更多
          </button>
        ) : null}
      </div>
    );
  };

  // Row renderer for Virtuoso
  const rowRenderer = (rowIndex: number) => {
    const row = virtualizedRows[rowIndex];
    if (!row) return null;

    return (
      <div 
        className="grid gap-6 px-6"
        style={{
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
        }}
      >
        {row.map((image, columnIndex) => (
          <div key={`${rowIndex}-${columnIndex}`}>
            {image ? (
              <ImageCard 
                image={image} 
                onClick={onImageClick}
                batchMode={batchMode}
                isSelected={selectedImageIds.has(image.id)}
                onToggleSelect={onToggleSelect}
              />
            ) : (
              // Empty placeholder to maintain grid structure
              <div />
            )}
          </div>
        ))}
      </div>
    );
  };

  // Handle end reached for infinite scrolling
  const handleEndReached = () => {
    if (hasMore && !isLoading && onLoadMore) {
      onLoadMore();
    }
  };

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-600 px-6">
        <SparklesIcon className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-lg mb-6">当前筛选下没有图片</p>
        <div className="max-w-md text-center space-y-2 text-sm">
          <p className="text-gray-500">💡 上传图片的多种方式：</p>
          <div className="grid grid-cols-1 gap-2 mt-4">
            <div className="flex items-center gap-2 text-gray-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span>拖拽图片到页面任意位置</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>复制图片后按 Ctrl+V 粘贴</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span>点击右上角按钮选择文件或文件夹</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <Virtuoso
        style={{ height: '100%' }}
        totalCount={virtualizedRows.length}
        itemContent={rowRenderer}
        endReached={handleEndReached}
        components={{
          Footer
        }}
        overscan={200}
      />
    </div>
  );
};

export default VirtualMasonryGallery;

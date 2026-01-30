import React from 'react';
import { GalleryImage } from '../types';
import { DocumentTextIcon, HeartIcon } from './Icons';

interface ImageCardProps {
  image: GalleryImage;
  onClick: (id: string) => void;
}

const ImageCard = React.memo(({ image, onClick }: ImageCardProps) => {
  const [imageLoaded, setImageLoaded] = React.useState(false);

  return (
    <div 
      onClick={() => onClick(image.id)}
      className="break-inside-avoid relative group cursor-pointer rounded-xl overflow-hidden bg-[#18181b] border border-white/5 hover:border-white/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-900/10 mb-6"
    >
      {/* Image */}
      <img 
        src={image.url} 
        alt={image.fileName} 
        className={`w-full h-auto object-cover transition-opacity duration-300 ${
          imageLoaded ? 'opacity-90 group-hover:opacity-100' : 'opacity-0'
        }`}
        loading="lazy"
        decoding="async"
        onLoad={() => setImageLoaded(true)}
      />
      
      {/* Loading skeleton */}
      {!imageLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 animate-pulse" />
      )}
      
      {/* Overlay Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{image.fileName}</p>
            <p className="text-[10px] text-gray-400">{image.metadata.type}</p>
          </div>
          {image.story && <DocumentTextIcon className="w-4 h-4 text-purple-400 ml-2 flex-shrink-0" />}
        </div>
      </div>

      {/* Status Indicators (Always Visible) */}
      <div className="absolute top-3 right-3 flex gap-2">
        {image.isFavorite && (
          <div className="bg-black/50 backdrop-blur rounded-full p-1.5">
            <HeartIcon className="w-3 h-3 text-red-500" solid />
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if image id or favorite status changes
  return prevProps.image.id === nextProps.image.id && 
         prevProps.image.isFavorite === nextProps.image.isFavorite &&
         prevProps.image.story === nextProps.image.story;
});

ImageCard.displayName = 'ImageCard';

export default ImageCard;

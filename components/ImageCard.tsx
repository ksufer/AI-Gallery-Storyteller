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
      className="break-inside-avoid relative group cursor-pointer rounded-2xl overflow-hidden bg-white/5 border border-white/5 hover:border-white/20 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] mb-6"
    >
      {/* Image */}
      <img 
        src={image.url} 
        alt={image.fileName} 
        className={`w-full h-auto object-cover transition-all duration-700 ${
          imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
        } group-hover:scale-105`}
        loading="lazy"
        decoding="async"
        onLoad={() => setImageLoaded(true)}
      />
      
      {/* Loading skeleton */}
      {!imageLoaded && (
        <div className="absolute inset-0 bg-white/5 animate-pulse" />
      )}
      
      {/* Overlay Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-5 translate-y-2 group-hover:translate-y-0">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate drop-shadow-md">{image.fileName}</p>
            <p className="text-[10px] text-gray-300 mt-0.5 font-medium tracking-wide uppercase opacity-80">{image.metadata.type}</p>
          </div>
          {image.story && (
             <div className="w-8 h-8 rounded-full bg-purple-500/20 backdrop-blur-md flex items-center justify-center border border-purple-500/30 ml-3">
               <DocumentTextIcon className="w-4 h-4 text-purple-200" />
             </div>
           )}
        </div>
      </div>

      {/* Status Indicators (Always Visible but styled better) */}
      <div className="absolute top-3 right-3 flex gap-2">
        {image.isFavorite && (
          <div className="bg-red-500/20 backdrop-blur-md rounded-full p-2 border border-red-500/30 shadow-lg">
            <HeartIcon className="w-3.5 h-3.5 text-red-400" solid />
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

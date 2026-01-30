export interface ImageSampler {
  seed?: string | number;
  steps?: string | number;
  cfg?: string | number;
  sampler_name?: string;
  scheduler?: string;
}

export interface ImageMetadata {
  type: 'ComfyUI' | 'SD WebUI' | 'Unknown';
  checkpoints: string[];
  loras: string[];
  prompts: string[];
  negative_prompts: string[];
  sampler: ImageSampler;
  image_size: string[];
}

export interface GalleryImage {
  id: string;
  url: string;
  fileName: string;
  metadata: ImageMetadata;
  story?: string;
  isFavorite: boolean;
  dateAdded: string;
}

export type FilterType = 'all' | 'checkpoint' | 'lora' | 'favorite' | 'tag' | 'folder';

export interface FilterState {
  type: FilterType;
  value?: string; // folder 类型时为日期字符串 (YYYY-MM-DD)
}

// Pagination types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ImageQueryParams {
  page?: number;
  limit?: number;
  type?: FilterType;
  favorite?: boolean;
  checkpoint?: string;
  lora?: string;
  tag?: string;
}
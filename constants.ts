import { GalleryImage } from './types';

// In a real app, this would come from the backend scanning logic
export const MOCK_IMAGES: GalleryImage[] = [
  {
    id: '1',
    url: 'https://picsum.photos/800/1200', // Portrait
    fileName: 'cyberpunk_city_001.png',
    isFavorite: true,
    dateAdded: '2023-10-27',
    story: "The neon rain never stopped falling in Sector 4. It washed away the grime, but never the sins.",
    metadata: {
      type: 'ComfyUI',
      checkpoints: ['Juggernaut XL_v9'],
      loras: ['NeonStyles_v1', 'CyberTech_v2'],
      prompts: ['cyberpunk city street', 'neon lights', 'rain', 'reflections', 'highly detailed', '8k', 'unreal engine 5 render'],
      negative_prompts: ['blurry', 'low quality', 'text', 'watermark'],
      sampler: {
        seed: 8475928347,
        steps: 30,
        cfg: 7.0,
        sampler_name: 'dpmpp_2m',
        scheduler: 'karras'
      },
      image_size: ['1024x1536']
    }
  },
  {
    id: '2',
    url: 'https://picsum.photos/1200/800', // Landscape
    fileName: 'fantasy_forest_042.png',
    isFavorite: false,
    dateAdded: '2023-10-26',
    metadata: {
      type: 'SD WebUI',
      checkpoints: ['DreamShaper_8'],
      loras: ['MagicalForest'],
      prompts: ['mystical forest clearing', 'glowing mushrooms', 'fairies', 'sunlight filtering through leaves', 'masterpiece'],
      negative_prompts: ['easynegative', 'bad hands', 'deformed'],
      sampler: {
        seed: 11223344,
        steps: 25,
        cfg: 6.5,
        sampler_name: 'Euler a',
      },
      image_size: ['1216x832']
    }
  },
  {
    id: '3',
    url: 'https://picsum.photos/1000/1000', // Square
    fileName: 'scifi_portrait_009.png',
    isFavorite: false,
    dateAdded: '2023-10-25',
    metadata: {
      type: 'ComfyUI',
      checkpoints: ['RealisticVision_v5'],
      loras: [],
      prompts: ['portrait of a female astronaut', 'intricate spacesuit', 'looking at camera', 'cinematic lighting', 'space background'],
      negative_prompts: ['helmet', 'mask', 'ugly'],
      sampler: {
        seed: 99887766,
        steps: 40,
        cfg: 5.0,
        sampler_name: 'dpmpp_sde',
        scheduler: 'exponential'
      },
      image_size: ['1024x1024']
    }
  },
  {
    id: '4',
    url: 'https://picsum.photos/800/1400', // Tall
    fileName: 'anime_character_002.png',
    isFavorite: true,
    dateAdded: '2023-10-28',
    metadata: {
      type: 'SD WebUI',
      checkpoints: ['AnythingV5'],
      loras: ['DetailedEyes'],
      prompts: ['1girl', 'solo', 'white hair', 'red eyes', 'kimono', 'cherry blossoms', 'digital art'],
      negative_prompts: ['nsfw', 'lowres', 'bad anatomy'],
      sampler: {
        seed: 123123123,
        steps: 20,
        cfg: 7.0,
        sampler_name: 'DPM++ 2M Karras',
      },
      image_size: ['800x1400']
    }
  }
];

export const SYSTEM_INSTRUCTION = `You are a creative storyteller for an AI Image Gallery. 
Your task is to generate a short, atmospheric, and immersive story (approx 100-150 words) based on the image prompts provided. 
Capture the mood, lighting, and subject matter described in the prompts. 
Do not mention technical terms like "CGI", "Render", "8k", or "Prompt". Write as if the scene is real.`;

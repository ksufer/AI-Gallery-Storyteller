import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
// In a real scenario, this key should be proxied through a backend to keep it secure.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const SYSTEM_INSTRUCTION = `你是一个为 AI 图库服务的创意故事写手。
请结合提供的图片和提示词，写一段简短、有氛围、引人入胜的故事（约 100–150 字）。
你可以自由发挥想象力，补充图片中未直接体现的背景、声音或气味等细节，但要符合图片展现的整体基调。
不要使用「CGI」「渲染」「8k」「提示词」等技术用语，把场景当作真实世界来写。请用中文写作。`;

export interface ImageInput {
  data: string; // Base64 string
  mimeType: string;
}

export const generateStoryFromPrompts = async (prompts: string[], image?: ImageInput): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("未设置 API 密钥，请配置 process.env.API_KEY 或 .env.local 中的 GEMINI_API_KEY");
  }

  try {
    // 简化 promptText，因为主要指令已经在 SYSTEM_INSTRUCTION 中定义
    const promptText = `提示词: ${prompts.join(', ')}`;
    
    let contents: any = promptText;

    if (image) {
      contents = [
        { text: promptText },
        {
          inlineData: {
            mimeType: image.mimeType,
            data: image.data
          }
        }
      ];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.8, // Slightly creative
      }
    });

    if (response.text) {
      // @ts-ignore
      return typeof response.text === 'function' ? response.text() : response.text;
    }
    
    return "生成失败，未能生成故事。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("通过 Gemini 生成故事失败。");
  }
};

import { GoogleGenAI } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";

// Initialize Gemini Client
// In a real scenario, this key should be proxied through a backend to keep it secure.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateStoryFromPrompts = async (prompts: string[]): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("未设置 API 密钥，请配置 process.env.API_KEY 或 .env.local 中的 GEMINI_API_KEY");
  }

  try {
    const promptText = `根据以下提示词，写一段简短、有氛围、引人入胜的故事（约 100–150 字）。要体现提示词中的情绪、光线和主体内容。不要使用「CGI」「渲染」「8k」「提示词」等技术用语，把场景当作真实世界来写。请用中文写作。提示词: ${prompts.join(', ')}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: promptText,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.8, // Slightly creative
      }
    });

    if (response.text) {
      return response.text;
    }
    
    return "生成失败，未能生成故事。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("通过 Gemini 生成故事失败。");
  }
};
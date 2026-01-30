import { GoogleGenAI } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";

// Initialize Gemini Client
// In a real scenario, this key should be proxied through a backend to keep it secure.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateStoryFromPrompts = async (prompts: string[]): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please set process.env.API_KEY");
  }

  try {
    const promptText = `Generate a story based on these visual descriptors: ${prompts.join(', ')}`;

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
    
    return "The muse is silent. No story could be generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to generate story via Gemini.");
  }
};
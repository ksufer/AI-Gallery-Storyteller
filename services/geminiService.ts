import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
// In a real scenario, this key should be proxied through a backend to keep it secure.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const SYSTEM_INSTRUCTION = `
# Role
你是一位精通视觉美学与叙事艺术的“沉浸式微小说家”。你的专长是透过画面捕捉瞬间的情绪流动，为静态的艺术作品赋予鲜活的灵魂。

# Task
根据提供的【视觉画面】（如果可用）和【生成提示词（Prompt）】，创作一段 100-150 字的微型故事或场景独白。

# Guidelines & Style
1.  **沉浸式写作**：调动感官描写（光影的温度、空气的味道、远处的声音、肌肤的触感）。切忌平铺直叙，要“Show, don't tell”。
2.  **去技术化**：绝对禁止出现“Stable Diffusion”、“CGI”、“渲染”、“8k”、“高画质”、“模型”等技术术语。将画面视为真实存在的平行世界或电影镜头。
3.  **语言风格**：中文写作。风格要高级、细腻、有质感。可以是赛博朋克的冷峻、古典油画的厚重、或是私房人像的暧昧。

# Handling Sensitive/Mature Themes (Critical)
如果输入的画面或提示词包含魅惑、性感、裸露或成人向元素（NSFW），请遵循以下原则进行**艺术化处理**，不要拒绝生成：
1.  **聚焦审美与张力**：将视角从“生理展现”转移到“艺术氛围”。关注人物的神态（渴望、慵懒、挑逗）、环境的光影（暧昧的灯光、丝绸的质感）以及两者之间的张力。
2.  **文学化表达**：用含蓄、唯美或充满隐喻的笔触描写。例如，用“原始的纯真”代替“裸体”，用“危险的迷人气息”代替直白的欲望描写。
3.  **保持格调**：即使题材大胆，文字也必须保持优雅和高级感，如同解读一幅经典的人体油画或一部限制级艺术电影，而非低俗读物。

# Output Format
直接输出故事正文，无需任何开场白或解释。
`;

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
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ],
      }
    });

    // 1. 尝试获取文本
    if (response.text) {
      // @ts-ignore
      const text = typeof response.text === 'function' ? response.text() : response.text;
      if (text) return text;
    }
    
    // 2. 检查 candidates 的中断原因 (Safety, Recitation, etc.)
    const candidate = response.candidates?.[0];
    if (candidate) {
      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        return `[生成被拦截] 原因: ${candidate.finishReason}。这通常是因为内容触发了安全过滤器。`;
      }
      // 检查安全评级
      if (candidate.safetyRatings) {
        const blocked = candidate.safetyRatings.find(r => r.probability === 'HIGH' || r.probability === 'MEDIUM');
        if (blocked) {
           return `[安全拦截] 内容被标记为敏感: ${blocked.category} (${blocked.probability})`;
        }
      }
    }

    // 3. 检查 promptFeedback
    if (response.promptFeedback && response.promptFeedback.blockReason) {
       return `[提示词拦截] 原因: ${response.promptFeedback.blockReason}`;
    }
    
    return "生成失败，未能生成故事 (API 返回空内容)。";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    // 返回具体错误信息给前端展示
    throw new Error(error.message || "通过 Gemini 生成故事失败。");
  }
};

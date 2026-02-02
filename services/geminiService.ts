import { GoogleGenAI } from "@google/genai";
import nodeFetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fs from 'fs';
import path from 'path';

// Patch global fetch for proxy support if HTTPS_PROXY is set
if (process.env.HTTPS_PROXY) {
    console.log(`Using proxy: ${process.env.HTTPS_PROXY}`);
    const agent = new HttpsProxyAgent(process.env.HTTPS_PROXY);
    
    // @ts-ignore
    global.fetch = (url, init) => {
        // @ts-ignore
        return nodeFetch(url, { 
            ...init, 
            agent,
            // 增加超时设置，防止 socket 挂死
            timeout: 30000 
        });
    };
}

// Initialize Gemini Client
// We use lazy initialization to allow the server to start even if API_KEY is missing.
let ai: GoogleGenAI | null = null;

const getApiKey = () => {
    return process.env.GEMINI_API_KEY || process.env.API_KEY;
};

const getAiClient = () => {
  if (!ai) {
    const apiKey = getApiKey();
    if (!apiKey) {
      // Should acturally be handled by the caller, but just in case
      throw new Error("未设置 API 密钥");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

// 禁词表 - 从外部配置文件加载
let FORBIDDEN_WORDS_MAP: Record<string, string> = {};

// 系统提示词 - 从外部配置文件加载
let SYSTEM_INSTRUCTION = '';

// 异步加载禁词表配置
const loadForbiddenWords = async (): Promise<void> => {
  try {
    const configPath = path.join(process.cwd(), 'config', 'forbidden-words.json');
    if (!fs.existsSync(configPath)) {
       console.warn('⚠ 禁词表文件不存在:', configPath);
       return;
    }
    const fileContent = fs.readFileSync(configPath, 'utf-8');
    FORBIDDEN_WORDS_MAP = JSON.parse(fileContent);
    console.log(`✓ 已加载禁词表: ${Object.keys(FORBIDDEN_WORDS_MAP).length} 个词汇`);
  } catch (error) {
    console.warn('⚠ 无法加载禁词表配置文件，将使用空的禁词表');
    console.warn(`错误详情: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// 加载系统提示词配置
const loadSystemPrompt = (): void => {
  try {
    const configPath = path.join(process.cwd(), 'config', 'system-prompt.json');
    const examplePath = path.join(process.cwd(), 'config', 'system-prompt.example.json');
    
    // 如果配置文件不存在，尝试从示例文件复制
    if (!fs.existsSync(configPath)) {
      console.log('⚠ 系统提示词文件不存在，尝试从示例文件创建...');
      
      if (fs.existsSync(examplePath)) {
        try {
          fs.copyFileSync(examplePath, configPath);
          console.log('✓ 已从示例文件创建 system-prompt.json');
        } catch (copyError) {
          console.warn('⚠ 无法复制示例文件:', copyError instanceof Error ? copyError.message : String(copyError));
        }
      }
      
      // 如果复制失败或示例文件不存在，使用默认提示词
      if (!fs.existsSync(configPath)) {
        console.warn('⚠ 使用默认提示词');
        SYSTEM_INSTRUCTION = '你是一位擅长视觉美学与叙事艺术的"沉浸式微小说家"。根据画面和提示词创作简短的故事。';
        return;
      }
    }
    
    const fileContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(fileContent);
    SYSTEM_INSTRUCTION = config.content || '';
    console.log(`✓ 已加载系统提示词 (${SYSTEM_INSTRUCTION.length} 字符)`);
  } catch (error) {
    console.warn('⚠ 无法加载系统提示词配置文件，将使用默认提示词');
    console.warn(`错误详情: ${error instanceof Error ? error.message : String(error)}`);
    SYSTEM_INSTRUCTION = '你是一位擅长视觉美学与叙事艺术的"沉浸式微小说家"。根据画面和提示词创作简短的故事。';
  }
};

// 在模块加载时立即加载配置
loadForbiddenWords();
loadSystemPrompt();

/**
 * 重新加载系统提示词（用于支持热更新）
 */
export const reloadSystemPrompt = (): boolean => {
  try {
    loadSystemPrompt();
    return true;
  } catch (error) {
    console.error('重新加载系统提示词失败:', error);
    return false;
  }
};

/**
 * 获取当前系统提示词
 */
export const getSystemPrompt = (): string => {
  return SYSTEM_INSTRUCTION;
};

export interface ImageInput {
  data: string; // Base64 string
  mimeType: string;
}

/**
 * 应用禁词表替换
 */
const applyForbiddenWordsFilter = (text: string): string => {
  let filtered = text;
  Object.entries(FORBIDDEN_WORDS_MAP).forEach(([forbidden, replacement]) => {
    // 使用全局替换，不区分大小写
    const regex = new RegExp(forbidden, 'gi');
    filtered = filtered.replace(regex, replacement);
  });
  return filtered;
};

export const generateStoryFromPrompts = async (prompts: string[], image?: ImageInput, additionalKeywords?: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("未设置 API 密钥，请配置 process.env.GEMINI_API_KEY 或 .env.local 中的 GEMINI_API_KEY");
  }

  try {
    // 过滤掉年龄相关的提示词，以避免触发安全过滤器
    // 支持中英文混合：16yo, 18 year old, 16岁, 十六岁等
    let safePrompts = prompts.map(p => {
        let cleaned = p;
        
        // 1. 英文格式：16yo, 18 year old, 20 years old
        cleaned = cleaned.replace(/\b\d+\s*(yo|year\s*old|years\s*old)\b/gi, '');
        
        // 2. 阿拉伯数字+中文"岁"：16岁, 18岁的, 一个16岁少女
        cleaned = cleaned.replace(/\d+\s*岁([的之])?/g, '');
        
        // 3. 中文数字+岁：十六岁, 一岁, 九十九岁, 十八岁的女孩
        cleaned = cleaned.replace(/(一|二|三|四|五|六|七|八|九|十)+岁([的之])?/g, '');
        
        // 4. 清理多余空格和标点
        cleaned = cleaned
            .replace(/\s+/g, ' ')                    // 多余空格
            .replace(/,\s*,/g, ',')                  // 连续逗号
            .replace(/^[,\s]+|[,\s]+$/g, '')        // 首尾标点
            .trim();
        
        return cleaned;
    });

    // 5. 应用禁词表替换
    safePrompts = safePrompts.map(p => applyForbiddenWordsFilter(p));

    // 简化 promptText，因为主要指令已经在 SYSTEM_INSTRUCTION 中定义
    let promptText = `提示词: ${safePrompts.join(', ')}`;
    
    // 添加用户指定的关键词
    if (additionalKeywords && additionalKeywords.trim()) {
        const safeKeywords = applyForbiddenWordsFilter(additionalKeywords.trim());
        promptText += `\n\n用户特别要求(必须重点体现): ${safeKeywords}`;
        console.log(`[Gemini Story] Added user keywords: ${safeKeywords}`);
    }

    console.log(`[Gemini Story] Final Prompt Text: ${promptText}`);

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

    const aiClient = getAiClient();
    const response = await aiClient.models.generateContent({
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
        ] as any[],
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

    // 3. 检查 promptFeedback - 特别处理 PROHIBITED_CONTENT
    if (response.promptFeedback && response.promptFeedback.blockReason) {
      const blockReason = response.promptFeedback.blockReason;
      
      // 如果是 PROHIBITED_CONTENT 且有图片，尝试降级策略：只用图片生成
      if (blockReason === 'PROHIBITED_CONTENT' && image) {
        console.log("=== 检测到 PROHIBITED_CONTENT，尝试降级策略（仅图片） ===");
        try {
          // 重新调用 API，只传图片，不传提示词
          const fallbackContents = [
            {
              inlineData: {
                mimeType: image.mimeType,
                data: image.data
              }
            }
          ];
          
          const fallbackResponse = await aiClient.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: fallbackContents,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              temperature: 0.8,
              safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
              ] as any[],
            }
          });
          
          if (fallbackResponse.text) {
            // @ts-ignore
            const fallbackText = typeof fallbackResponse.text === 'function' ? fallbackResponse.text() : fallbackResponse.text;
            if (fallbackText) {
              console.log("=== 降级策略成功 ===");
              return `${fallbackText}\n\n（提示词未通过）`;
            }
          }
        } catch (fallbackError) {
          console.error("降级策略失败:", fallbackError);
        }
      }
      
      return `[提示词拦截] 原因: ${blockReason}`;
    }
    
    return "生成失败，未能生成故事 (API 返回空内容)。";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    // 返回具体错误信息给前端展示
    throw new Error(error.message || "通过 Gemini 生成故事失败。");
  }
};

export const generateStoryStream = async function* (prompts: string[], image?: ImageInput, additionalKeywords?: string): AsyncGenerator<string, void, unknown> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("未设置 API 密钥");
  }

  try {
    // 1. Prepare Prompts (Same logic as non-stream version)
    let safePrompts = prompts.map(p => {
        let cleaned = p;
        cleaned = cleaned.replace(/\b\d+\s*(yo|year\s*old|years\s*old)\b/gi, '');
        cleaned = cleaned.replace(/\d+\s*岁([的之])?/g, '');
        cleaned = cleaned.replace(/(一|二|三|四|五|六|七|八|九|十)+岁([的之])?/g, '');
        cleaned = cleaned
            .replace(/\s+/g, ' ')
            .replace(/,\s*,/g, ',')
            .replace(/^[,\s]+|[,\s]+$/g, '')
            .trim();
        return cleaned;
    });

    safePrompts = safePrompts.map(p => applyForbiddenWordsFilter(p));

    let promptText = `提示词: ${safePrompts.join(', ')}`;
    
    if (additionalKeywords && additionalKeywords.trim()) {
        const safeKeywords = applyForbiddenWordsFilter(additionalKeywords.trim());
        promptText += `\n\n用户特别要求(必须重点体现): ${safeKeywords}`;
    }

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

    const aiClient = getAiClient();
    
    try {
        const result = await aiClient.models.generateContentStream({
            model: 'gemini-3-flash-preview',
            contents: contents,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                temperature: 0.8,
                safetySettings: [
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                ] as any[],
            }
        });

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
                yield chunkText;
            }
        }
    } catch (innerError: any) {
        // Handle Fallback for PROHIBITED_CONTENT
        // Note: For streaming, checking promptFeedback blockReason is tricky as it might be in the stream.
        // But if generateContentStream throws immediately, we can catch it.
        // Or if the first chunk contains block info.
        
        // Simply try fallback if error suggests blocking and we have an image
        if (image && (innerError.message?.includes('PROHIBITED_CONTENT') || innerError.message?.includes('safety'))) {
             console.log("=== [Stream] 检测到拦截，尝试降级策略（仅图片） ===");
             const fallbackContents = [
                {
                  inlineData: {
                    mimeType: image.mimeType,
                    data: image.data
                  }
                }
              ];
              
              const fallbackResult = await aiClient.models.generateContentStream({
                model: 'gemini-3-flash-preview',
                contents: fallbackContents,
                config: {
                  systemInstruction: SYSTEM_INSTRUCTION,
                  temperature: 0.8,
                  safetySettings: [
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                  ] as any[],
                }
              });

              for await (const chunk of fallbackResult.stream) {
                const chunkText = chunk.text();
                if (chunkText) {
                    yield chunkText;
                }
              }
              yield "\n\n（提示词未通过）";
        } else {
            throw innerError;
        }
    }

  } catch (error: any) {
    console.error("Gemini Stream API Error:", error);
    throw new Error(error.message || "通过 Gemini 生成故事失败。");
  }
};

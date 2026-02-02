import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

/**
 * OpenAI 兼容 API Service
 * 支持标准 OpenAI API 以及所有兼容的第三方服务
 * 包括: OpenRouter, DeepSeek, Moonshot, 通义千问, GLM, Ollama 等
 */

// Lazy initialization to allow server to start without API key
let client: OpenAI | null = null;

const getApiKey = () => {
  return process.env.OPENAI_API_KEY || process.env.API_KEY;
};

const getBaseUrl = () => {
  return process.env.OPENAI_BASE_URL;
};

const getClient = () => {
  if (!client) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("未设置 OpenAI API 密钥");
    }

    const config: any = { apiKey };
    
    // 如果设置了自定义 BASE_URL，则使用它（支持 OpenRouter 等第三方服务）
    const baseURL = getBaseUrl();
    if (baseURL) {
      config.baseURL = baseURL;
      console.log(`✓ 使用自定义 OpenAI 端点: ${baseURL}`);
    }

    client = new OpenAI(config);
  }
  return client;
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
       console.warn('⚠ [OpenAI] 禁词表文件不存在:', configPath);
       return;
    }
    const fileContent = fs.readFileSync(configPath, 'utf-8');
    FORBIDDEN_WORDS_MAP = JSON.parse(fileContent);
    console.log(`✓ [OpenAI] 已加载禁词表: ${Object.keys(FORBIDDEN_WORDS_MAP).length} 个词汇`);
  } catch (error) {
    console.warn('⚠ [OpenAI] 无法加载禁词表配置文件，将使用空的禁词表');
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
      console.log('⚠ [OpenAI] 系统提示词文件不存在，尝试从示例文件创建...');
      
      if (fs.existsSync(examplePath)) {
        try {
          fs.copyFileSync(examplePath, configPath);
          console.log('✓ [OpenAI] 已从示例文件创建 system-prompt.json');
        } catch (copyError) {
          console.warn('⚠ [OpenAI] 无法复制示例文件:', copyError instanceof Error ? copyError.message : String(copyError));
        }
      }
      
      // 如果复制失败或示例文件不存在，使用默认提示词
      if (!fs.existsSync(configPath)) {
        console.warn('⚠ [OpenAI] 使用默认提示词');
        SYSTEM_INSTRUCTION = '你是一位擅长视觉美学与叙事艺术的"沉浸式微小说家"。根据画面和提示词创作简短的故事。';
        return;
      }
    }
    
    const fileContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(fileContent);
    SYSTEM_INSTRUCTION = config.content || '';
    console.log(`✓ [OpenAI] 已加载系统提示词 (${SYSTEM_INSTRUCTION.length} 字符)`);
  } catch (error) {
    console.warn('⚠ [OpenAI] 无法加载系统提示词配置文件，将使用默认提示词');
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
    console.error('[OpenAI] 重新加载系统提示词失败:', error);
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
    const regex = new RegExp(forbidden, 'gi');
    filtered = filtered.replace(regex, replacement);
  });
  return filtered;
};

/**
 * 过滤年龄相关词汇
 */
const filterAgeWords = (text: string): string => {
  let cleaned = text;
  
  // 1. 英文格式：16yo, 18 year old, 20 years old
  cleaned = cleaned.replace(/\b\d+\s*(yo|year\s*old|years\s*old)\b/gi, '');
  
  // 2. 阿拉伯数字+中文"岁"：16岁, 18岁的, 一个16岁少女
  cleaned = cleaned.replace(/\d+\s*岁([的之])?/g, '');
  
  // 3. 中文数字+岁：十六岁, 一岁, 九十九岁, 十八岁的女孩
  cleaned = cleaned.replace(/(一|二|三|四|五|六|七|八|九|十)+岁([的之])?/g, '');
  
  // 4. 清理多余空格和标点
  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();
  
  return cleaned;
};

/**
 * 检查模型是否支持视觉分析
 */
const supportsVision = (): boolean => {
  const visionSupport = process.env.OPENAI_VISION_SUPPORT;
  
  // 如果明确设置了支持状态，使用配置值
  if (visionSupport !== undefined && visionSupport !== '') {
    return visionSupport.toLowerCase() === 'true';
  }
  
  // 否则根据模型名称自动判断
  const model = (process.env.OPENAI_MODEL || "gpt-4o").toLowerCase();
  
  // 已知支持视觉的模型列表
  const visionModels = [
    'gpt-4o',
    'gpt-4-turbo',
    'gpt-4-vision',
    'claude-3',
    'gemini',
    'llava',
    'qwen-vl',
    'glm-4v',
    'cogvlm'
  ];
  
  return visionModels.some(visionModel => model.includes(visionModel));
};

/**
 * 生成故事（支持 OpenAI 兼容 API）
 * @param prompts 提示词数组
 * @param image 可选的图片数据
 * @returns 生成的故事文本
 */
export const generateStoryFromPrompts = async (
  prompts: string[], 
  image?: ImageInput,
  additionalKeywords?: string
): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("未设置 API 密钥，请配置 process.env.OPENAI_API_KEY 或 .env.local 中的 OPENAI_API_KEY");
  }

  try {
    // 过滤年龄相关提示词
    let safePrompts = prompts.map(p => filterAgeWords(p));
    
    // 应用禁词表替换
    safePrompts = safePrompts.map(p => applyForbiddenWordsFilter(p));

    let promptText = `提示词: ${safePrompts.join(', ')}`;

    // 添加用户指定的关键词
    if (additionalKeywords && additionalKeywords.trim()) {
        const safeKeywords = applyForbiddenWordsFilter(additionalKeywords.trim());
        promptText += `\n\n用户特别要求(必须重点体现): ${safeKeywords}`;
        console.log(`[OpenAI Story] Added user keywords: ${safeKeywords}`);
    }

    console.log(`[OpenAI Story] Final Prompt Text: ${promptText}`);
    
    // 检查模型是否支持视觉
    const hasVisionSupport = supportsVision();
    const useImage = image && hasVisionSupport;
    
    // Debug Log
    console.log("=== OpenAI Request Debug ===");
    console.log("Base URL:", getBaseUrl() || "(使用默认 OpenAI 端点)");
    console.log("Model:", process.env.OPENAI_MODEL || "gpt-4o");
    console.log("Vision Support:", hasVisionSupport);
    console.log("Original Prompts:", prompts);
    console.log("Filtered Prompts:", safePrompts);
    console.log("Has Image:", !!image);
    console.log("Will Use Image:", useImage);
    console.log("============================");

    // 如果有图片但模型不支持视觉，给出警告
    if (image && !hasVisionSupport) {
      console.warn("⚠️  模型不支持视觉分析，将仅使用提示词生成故事");
      console.warn("提示：如需使用图片分析，请切换到支持视觉的模型（如 gpt-4o）");
    }

    const openai = getClient();
    
    // 构建消息内容
    const messages: any[] = [
      {
        role: "system",
        content: SYSTEM_INSTRUCTION
      }
    ];

    // 如果有图片且模型支持视觉，使用 Vision API 格式
    if (useImage) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: promptText },
          {
            type: "image_url",
            image_url: {
              url: `data:${image.mimeType};base64,${image.data}`,
              detail: "high" // 使用高质量分析
            }
          }
        ]
      });
    } else {
      // 纯文本模式
      messages.push({
        role: "user",
        content: promptText
      });
    }

    // 调用 OpenAI API
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o", // 默认使用 GPT-4o（支持视觉）
      messages,
      temperature: 0.8,
      max_tokens: 500,
      // OpenRouter 需要的额外参数（其他服务会忽略）
      // @ts-ignore
      transforms: ["middle-out"] // OpenRouter 优化
    });

    const text = response.choices[0]?.message?.content;
    
    if (!text) {
      throw new Error("API 返回空内容");
    }

    return text.trim();
  } catch (error: any) {
    console.error("OpenAI API Error:", error);
    
    // 检查是否是因为提示词被拦截（某些服务会返回特定错误）
    const isContentPolicyError = 
      error.message?.includes('content_policy') ||
      error.message?.includes('content_filter') ||
      error.message?.includes('safety') ||
      error.code === 'content_policy_violation';
    
    // 如果是内容策略错误且有图片，尝试降级策略：只用图片生成
    if (isContentPolicyError && image && supportsVision()) {
      console.log("=== 检测到内容策略错误，尝试降级策略（仅图片） ===");
      try {
        const openai = getClient();
        
        const fallbackMessages: any[] = [
          {
            role: "system",
            content: SYSTEM_INSTRUCTION
          },
          {
            role: "user",
            content: [
              { type: "text", text: "请根据图片内容创作一段 100-150 字的故事。" },
              {
                type: "image_url",
                image_url: {
                  url: `data:${image.mimeType};base64,${image.data}`,
                  detail: "high"
                }
              }
            ]
          }
        ];
        
        const fallbackResponse = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || "gpt-4o",
          messages: fallbackMessages,
          temperature: 0.8,
          max_tokens: 500,
          // @ts-ignore
          transforms: ["middle-out"]
        });
        
        const fallbackText = fallbackResponse.choices[0]?.message?.content;
        
        if (fallbackText) {
          console.log("=== 降级策略成功 ===");
          return `${fallbackText.trim()}\n\n（提示词未通过安全检查）`;
        }
      } catch (fallbackError) {
        console.error("降级策略失败:", fallbackError);
      }
    }
    
    // 提供更友好的错误信息
    if (error.status === 401) {
      throw new Error("API 密钥无效，请检查 OPENAI_API_KEY 配置");
    } else if (error.status === 429) {
      throw new Error("API 调用频率超限，请稍后再试");
    } else if (error.status === 500) {
      throw new Error("API 服务器错误，请稍后再试");
    } else if (isContentPolicyError) {
      throw new Error("内容包含敏感信息，已被安全策略拦截");
    }
    
    throw new Error(error.message || "通过 OpenAI 生成故事失败");
  }
};

export const generateStoryStream = async function* (
  prompts: string[], 
  image?: ImageInput,
  additionalKeywords?: string
): AsyncGenerator<string, void, unknown> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("未设置 API 密钥");
  }

  try {
    let safePrompts = prompts.map(p => filterAgeWords(p));
    safePrompts = safePrompts.map(p => applyForbiddenWordsFilter(p));

    let promptText = `提示词: ${safePrompts.join(', ')}`;

    if (additionalKeywords && additionalKeywords.trim()) {
        const safeKeywords = applyForbiddenWordsFilter(additionalKeywords.trim());
        promptText += `\n\n用户特别要求(必须重点体现): ${safeKeywords}`;
    }
    
    const hasVisionSupport = supportsVision();
    const useImage = image && hasVisionSupport;

    const openai = getClient();
    
    const messages: any[] = [
      {
        role: "system",
        content: SYSTEM_INSTRUCTION
      }
    ];

    if (useImage) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: promptText },
          {
            type: "image_url",
            image_url: {
              url: `data:${image.mimeType};base64,${image.data}`,
              detail: "high"
            }
          }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: promptText
      });
    }

    try {
        const stream = await openai.chat.completions.create({
          model: process.env.OPENAI_MODEL || "gpt-4o",
          messages,
          temperature: 0.8,
          max_tokens: 500,
          stream: true,
          // @ts-ignore
          transforms: ["middle-out"]
        });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                yield content;
            }
        }
    } catch (innerError: any) {
         // Fallback logic for content policy
        const isContentPolicyError = 
          innerError.message?.includes('content_policy') ||
          innerError.message?.includes('content_filter') ||
          innerError.message?.includes('safety') ||
          innerError.code === 'content_policy_violation';
        
        if (isContentPolicyError && image && supportsVision()) {
            console.log("=== [Stream] 检测到内容策略错误，尝试降级策略（仅图片） ===");
            const fallbackMessages: any[] = [
              {
                role: "system",
                content: SYSTEM_INSTRUCTION
              },
              {
                role: "user",
                content: [
                  { type: "text", text: "请根据图片内容创作一段 100-150 字的故事。" },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${image.mimeType};base64,${image.data}`,
                      detail: "high"
                    }
                  }
                ]
              }
            ];
            
            const fallbackStream = await openai.chat.completions.create({
              model: process.env.OPENAI_MODEL || "gpt-4o",
              messages: fallbackMessages,
              temperature: 0.8,
              max_tokens: 500,
              stream: true,
              // @ts-ignore
              transforms: ["middle-out"]
            });

            for await (const chunk of fallbackStream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    yield content;
                }
            }
            yield "\n\n（提示词未通过安全检查）";
        } else {
            throw innerError;
        }
    }

  } catch (error: any) {
    console.error("OpenAI Stream API Error:", error);
    throw new Error(error.message || "通过 OpenAI 生成故事失败");
  }
};

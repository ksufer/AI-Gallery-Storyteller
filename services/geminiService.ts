import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';
import { ProxyAgent } from 'undici';
import { 
  getAiConfig, 
  registerGeminiReinitCallback,
  type GeminiConfig 
} from './aiConfigService.js';

// 代理相关配置
let currentProxyUrl: string | undefined = undefined;
let originalFetch: typeof globalThis.fetch | null = null;

/**
 * 配置代理
 */
function setupProxy(proxyUrl?: string): void {
  // 如果代理 URL 没有变化，不需要重新配置
  if (proxyUrl === currentProxyUrl) {
    return;
  }
  
  // 恢复原始 fetch（如果之前被覆盖过）
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  } else {
    originalFetch = globalThis.fetch;
  }
  
  currentProxyUrl = proxyUrl;
  
  if (proxyUrl) {
    console.log(`[Gemini] 配置代理: ${proxyUrl}`);
    const proxyAgent = new ProxyAgent(proxyUrl);
    
    // @ts-ignore
    globalThis.fetch = (url: string | URL | Request, init?: RequestInit) => {
      return originalFetch!(url, {
        ...init,
        // @ts-ignore
        dispatcher: proxyAgent
      });
    };
  } else {
    console.log('[Gemini] 代理已禁用');
  }
}

// Gemini 客户端实例
let ai: GoogleGenAI | null = null;

// 当前使用的配置
let currentApiKey: string = '';
let currentModel: string = 'gemini-3-flash-preview';

/**
 * 获取 API Key（优先从 aiConfigService，然后从环境变量）
 */
const getApiKey = (): string => {
  const config = getAiConfig();
  return config.gemini.apiKey || process.env.GEMINI_API_KEY || process.env.API_KEY || '';
};

/**
 * 获取当前模型
 */
const getModel = (): string => {
  const config = getAiConfig();
  return config.gemini.model || currentModel;
};

/**
 * 获取或创建 Gemini 客户端
 */
const getAiClient = (): GoogleGenAI => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error("未设置 Gemini API 密钥");
  }
  
  // 如果 API Key 发生变化，重新创建客户端
  if (!ai || apiKey !== currentApiKey) {
    ai = new GoogleGenAI({ apiKey });
    currentApiKey = apiKey;
    console.log('[Gemini] 客户端已初始化');
  }
  
  return ai;
};

/**
 * 重新初始化 Gemini 服务
 * 用于支持热切换 API Key、模型和代理
 */
export function reinitialize(config: GeminiConfig, proxyUrl?: string): void {
  console.log('[Gemini] 正在重新初始化服务...');
  
  // 重新配置代理
  setupProxy(proxyUrl);
  
  // 更新模型配置
  currentModel = config.model || 'gemini-3-flash-preview';
  
  // 如果 API Key 发生变化，清除现有客户端
  if (config.apiKey && config.apiKey !== currentApiKey) {
    ai = null;
    currentApiKey = '';
  }
  
  // 重新加载系统提示词
  loadSystemPrompt();
  
  // 重新加载禁词表
  loadForbiddenWords();
  
  console.log(`[Gemini] 服务已重新初始化 (模型: ${currentModel})`);
}

// 注册重新初始化回调
registerGeminiReinitCallback(reinitialize);

// 禁词表 - 从外部配置文件加载
let FORBIDDEN_WORDS_MAP: Record<string, string> = {};

// 系统提示词 - 从外部配置文件加载
let SYSTEM_INSTRUCTION = '';

// 异步加载禁词表配置
const loadForbiddenWords = (): void => {
  try {
    const configPath = path.join(process.cwd(), 'config', 'forbidden-words.json');
    if (!fs.existsSync(configPath)) {
       console.warn('⚠ [Gemini] 禁词表文件不存在:', configPath);
       return;
    }
    const fileContent = fs.readFileSync(configPath, 'utf-8');
    FORBIDDEN_WORDS_MAP = JSON.parse(fileContent);
    console.log(`✓ [Gemini] 已加载禁词表: ${Object.keys(FORBIDDEN_WORDS_MAP).length} 个词汇`);
  } catch (error) {
    console.warn('⚠ [Gemini] 无法加载禁词表配置文件，将使用空的禁词表');
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
      console.log('⚠ [Gemini] 系统提示词文件不存在，尝试从示例文件创建...');
      
      if (fs.existsSync(examplePath)) {
        try {
          fs.copyFileSync(examplePath, configPath);
          console.log('✓ [Gemini] 已从示例文件创建 system-prompt.json');
        } catch (copyError) {
          console.warn('⚠ [Gemini] 无法复制示例文件:', copyError instanceof Error ? copyError.message : String(copyError));
        }
      }
      
      // 如果复制失败或示例文件不存在，使用默认提示词
      if (!fs.existsSync(configPath)) {
        console.warn('⚠ [Gemini] 使用默认提示词');
        SYSTEM_INSTRUCTION = '你是一位擅长视觉美学与叙事艺术的"沉浸式微小说家"。根据画面和提示词创作简短的故事。';
        return;
      }
    }
    
    const fileContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(fileContent);
    SYSTEM_INSTRUCTION = config.content || '';
    console.log(`✓ [Gemini] 已加载系统提示词 (${SYSTEM_INSTRUCTION.length} 字符)`);
  } catch (error) {
    console.warn('⚠ [Gemini] 无法加载系统提示词配置文件，将使用默认提示词');
    console.warn(`错误详情: ${error instanceof Error ? error.message : String(error)}`);
    SYSTEM_INSTRUCTION = '你是一位擅长视觉美学与叙事艺术的"沉浸式微小说家"。根据画面和提示词创作简短的故事。';
  }
};

// 初始化时配置代理和加载配置
const initializeService = (): void => {
  const config = getAiConfig();
  
  // 配置代理
  if (config.proxy.enabled && config.proxy.url) {
    setupProxy(config.proxy.url);
  }
  
  // 加载配置
  loadForbiddenWords();
  loadSystemPrompt();
};

// 在模块加载时立即初始化
initializeService();

/**
 * 重新加载系统提示词（用于支持热更新）
 */
export const reloadSystemPrompt = (): boolean => {
  try {
    loadSystemPrompt();
    return true;
  } catch (error) {
    console.error('[Gemini] 重新加载系统提示词失败:', error);
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

/**
 * 获取 Gemini 可用模型列表
 */
export async function listModels(apiKey?: string): Promise<Array<{ id: string; name: string; description?: string }>> {
  const key = apiKey || getApiKey();
  
  if (!key) {
    throw new Error("未设置 Gemini API 密钥");
  }
  
  try {
    const tempClient = new GoogleGenAI({ apiKey: key });
    const response = await tempClient.models.list();
    
    const models: Array<{ id: string; name: string; description?: string }> = [];
    
    // @ts-ignore - response 可能是异步迭代器
    for await (const model of response) {
      // 只返回支持生成内容的模型
      // @ts-ignore - supportedGenerationMethods 在运行时存在但类型定义可能不完整
      const supportedMethods = model.supportedGenerationMethods as string[] | undefined;
      if (model.name && (!supportedMethods || supportedMethods.includes('generateContent'))) {
        models.push({
          id: model.name.replace('models/', ''),
          name: model.displayName || model.name.replace('models/', ''),
          description: model.description
        });
      }
    }
    
    // 按名称排序，优先显示 Gemini 3 系列
    models.sort((a, b) => {
      if (a.id.includes('gemini-3') && !b.id.includes('gemini-3')) return -1;
      if (!a.id.includes('gemini-3') && b.id.includes('gemini-3')) return 1;
      return a.name.localeCompare(b.name);
    });
    
    return models;
  } catch (error: any) {
    console.error('[Gemini] 获取模型列表失败:', error);
    throw new Error(error.message || "获取 Gemini 模型列表失败");
  }
}

/**
 * 测试 Gemini API 连通性
 */
export async function testConnection(apiKey?: string): Promise<{ success: boolean; message: string; model?: string }> {
  const key = apiKey || getApiKey();
  
  if (!key) {
    return { success: false, message: "未设置 API 密钥" };
  }
  
  try {
    const tempClient = new GoogleGenAI({ apiKey: key });
    const model = getModel();
    
    // 尝试发送一个简单的请求
    const response = await tempClient.models.generateContent({
      model,
      contents: "Hello, respond with just 'OK' in one word.",
      config: {
        maxOutputTokens: 10
      }
    });
    
    if (response.text) {
      return { 
        success: true, 
        message: "连接成功",
        model 
      };
    } else {
      return { success: false, message: "API 返回空响应" };
    }
  } catch (error: any) {
    console.error('[Gemini] 连接测试失败:', error);
    
    // 解析错误信息
    let message = error.message || "连接失败";
    if (error.status === 401 || message.includes('401')) {
      message = "API 密钥无效";
    } else if (error.status === 403 || message.includes('403')) {
      message = "API 访问被拒绝，请检查密钥权限或代理设置";
    } else if (message.includes('fetch') || message.includes('network')) {
      message = "网络连接失败，请检查代理设置";
    }
    
    return { success: false, message };
  }
}

export const generateStoryFromPrompts = async (prompts: string[], image?: ImageInput, additionalKeywords?: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("未设置 API 密钥，请在设置中配置 Gemini API Key");
  }

  const model = getModel();

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

    console.log(`[Gemini Story] Model: ${model}, Prompt: ${promptText.substring(0, 100)}...`);

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
      model,
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
            model,
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

  const model = getModel();

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
        const stream = await aiClient.models.generateContentStream({
            model,
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

        for await (const chunk of stream) {
            const chunkText = chunk.text;
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
              
              const fallbackStream = await aiClient.models.generateContentStream({
                model,
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

              for await (const chunk of fallbackStream) {
                const chunkText = chunk.text;
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

/** 对话历史单条 */
export interface ChatHistoryItem {
  role: 'user' | 'model';
  text: string;
}

const CHAT_SYSTEM_INSTRUCTION = (story: string | undefined): string => {
  const storyBlock = story && story.trim()
    ? `以下是这幅画的背景故事：\n\n${story.trim()}`
    : '（没有预设故事，请仅根据画面自由发挥，想象你是画中的角色。）';
  return `你是这张画中的角色，用第一人称与用户对话。${storyBlock}

回复时请同时加上动作或场景描述。格式要求：说话内容放在引号中（如「」或""），动作、神态、场景放在小括号（）中。例如：「……你好。」（她微微侧过头，望向窗外的雨。）保持简短、有氛围，一两句话即可，不要脱离角色。`;
};

/**
 * 以「画中角色」身份与用户多轮对话（无状态：每次请求携带完整 history）
 * @param image 图片 base64 + mimeType
 * @param story 当前图片的故事文案，可为空（仅看图对话）
 * @param userMessage 用户本条消息
 * @param history 此前对话历史（user/model 交替），最多建议 20 条
 * @returns 角色回复文本
 */
export const chatAsCharacter = async (params: {
  image: ImageInput;
  story: string | undefined;
  userMessage: string;
  history: ChatHistoryItem[];
}): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("未设置 API 密钥，请在设置中配置 Gemini API Key");
  }

  const { image, story, userMessage, history } = params;
  const model = getModel();
  const filteredMessage = applyForbiddenWordsFilter(userMessage.trim());
  if (!filteredMessage) {
    throw new Error("消息内容为空");
  }

  const systemInstruction = CHAT_SYSTEM_INSTRUCTION(story);

  // 多轮 contents：首条 user 带图片；无 history 时合并为单条（图片+用户说），有 history 时追加交替 user/model，最后追加本条 user
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }> = [];

  if (history.length === 0) {
    // 无历史：单条 user（图片 + 用户首句），避免连续两条 user
    contents.push({
      role: 'user',
      parts: [
        { text: `（请根据这张画与设定，以画中角色身份与我对话。）\n\n用户说：${filteredMessage}` },
        { inlineData: { mimeType: image.mimeType, data: image.data } }
      ]
    });
  } else {
    // 第一条：用户上下文（图片 + 说明）
    contents.push({
      role: 'user',
      parts: [
        { text: '（请根据这张画与设定，以画中角色身份与我对话。以下是之前的对话。）' },
        { inlineData: { mimeType: image.mimeType, data: image.data } }
      ]
    });
    for (const item of history) {
      contents.push({ role: item.role, parts: [{ text: item.text }] });
    }
    contents.push({ role: 'user', parts: [{ text: filteredMessage }] });
  }

  try {
    const aiClient = getAiClient();
    const response = await aiClient.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 0 },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ] as any[],
      }
    });

    if (response.text) {
      const text = typeof response.text === 'function' ? (response.text as () => string)() : response.text;
      if (text && typeof text === 'string') return text;
    }

    const candidate = response.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      return `[回复被拦截] 原因: ${candidate.finishReason}`;
    }
    if (response.promptFeedback?.blockReason) {
      return `[提示被拦截] 原因: ${response.promptFeedback.blockReason}`;
    }

    return '（未能生成回复，请重试。）';
  } catch (error: any) {
    console.error("[Gemini Chat] Error:", error);
    throw new Error(error.message || "角色对话失败。");
  }
};

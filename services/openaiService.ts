import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import {
  getAiConfig,
  registerOpenAIReinitCallback,
  type OpenAIConfig
} from './aiConfigService.js';
import { buildChatSystemInstruction } from './prompts.js';
import { escapeRegex } from './regexUtils.js';

/**
 * OpenAI 兼容 API Service
 * 支持标准 OpenAI API 以及所有兼容的第三方服务
 * 包括: OpenRouter, DeepSeek, Moonshot, 通义千问, GLM, Ollama 等
 */

// OpenAI 客户端实例
let client: OpenAI | null = null;

// 当前使用的配置
let currentApiKey: string = '';
let currentBaseUrl: string = '';
let currentModel: string = 'gpt-4o';

/**
 * 获取 API Key（优先从 aiConfigService，然后从环境变量）
 */
const getApiKey = (): string => {
  const config = getAiConfig();
  return config.openai.apiKey || process.env.OPENAI_API_KEY || process.env.API_KEY || '';
};

/**
 * 获取 Base URL
 */
const getBaseUrl = (): string => {
  const config = getAiConfig();
  return config.openai.baseUrl || process.env.OPENAI_BASE_URL || '';
};

/**
 * 获取当前模型
 */
const getModel = (): string => {
  const config = getAiConfig();
  return config.openai.model || process.env.OPENAI_MODEL || currentModel;
};

/**
 * 获取或创建 OpenAI 客户端
 */
const getClient = (): OpenAI => {
  const apiKey = getApiKey();
  const baseURL = getBaseUrl();
  
  if (!apiKey) {
    throw new Error("未设置 OpenAI API 密钥");
  }

  // 如果配置发生变化，重新创建客户端
  if (!client || apiKey !== currentApiKey || baseURL !== currentBaseUrl) {
    const config: any = {
      apiKey,
      timeout: 600000, // 10分钟超时，本地模型生成较慢
      maxRetries: 0,
    };
    
    if (baseURL) {
      config.baseURL = baseURL;
      console.log(`[OpenAI] 使用自定义端点: ${baseURL}`);
    }

    client = new OpenAI(config);
    currentApiKey = apiKey;
    currentBaseUrl = baseURL;
    console.log('[OpenAI] 客户端已初始化');
  }
  
  return client;
};

/**
 * 重新初始化 OpenAI 服务
 * 用于支持热切换 API Key、Base URL 和模型
 */
export function reinitialize(config: OpenAIConfig): void {
  console.log('[OpenAI] 正在重新初始化服务...');
  
  // 更新模型配置
  currentModel = config.model || 'gpt-4o';
  
  // 如果配置发生变化，清除现有客户端
  if (config.apiKey !== currentApiKey || config.baseUrl !== currentBaseUrl) {
    client = null;
    currentApiKey = '';
    currentBaseUrl = '';
  }
  
  // 重新加载系统提示词
  loadSystemPrompt();
  
  // 重新加载禁词表
  loadForbiddenWords();
  
  console.log(`[OpenAI] 服务已重新初始化 (模型: ${currentModel}, Base URL: ${config.baseUrl || '默认'})`);
}

// 注册重新初始化回调
registerOpenAIReinitCallback(reinitialize);

// 禁词表 - 从外部配置文件加载
let FORBIDDEN_WORDS_MAP: Record<string, string> = {};

// 系统提示词 - 从外部配置文件加载
let SYSTEM_INSTRUCTION = '';

// 加载禁词表配置
const loadForbiddenWords = (): void => {
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
    const regex = new RegExp(escapeRegex(forbidden), 'gi');
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

  // 默认假设支持视觉（对 LM Studio / Ollama 等本地模型更友好）
  // 只有已知的纯文本模型才返回 false
  const model = getModel().toLowerCase();
  const textOnlyModels = [
    'deepseek-chat',
    'deepseek-reasoner',
    'gpt-3.5',
    'moonshot',
    'glm-4',
    'qwen-max',
    'qwen-plus',
  ];

  return !textOnlyModels.some(t => model.includes(t));
};

/**
 * 获取 OpenAI 兼容 API 的可用模型列表
 */
export async function listModels(apiKey?: string, baseUrl?: string): Promise<Array<{ id: string; name: string }>> {
  const key = apiKey || getApiKey();
  const url = baseUrl || getBaseUrl();
  
  if (!key) {
    throw new Error("未设置 OpenAI API 密钥");
  }
  
  try {
    const config: any = { apiKey: key };
    if (url) {
      config.baseURL = url;
    }
    
    const tempClient = new OpenAI(config);
    const response = await tempClient.models.list();
    
    const models: Array<{ id: string; name: string }> = [];
    
    for await (const model of response) {
      models.push({
        id: model.id,
        name: model.id
      });
    }
    
    // 按名称排序
    models.sort((a, b) => a.name.localeCompare(b.name));
    
    return models;
  } catch (error: any) {
    console.error('[OpenAI] 获取模型列表失败:', error);
    throw new Error(error.message || "获取模型列表失败");
  }
}

/**
 * 测试 OpenAI 兼容 API 连通性
 */
export async function testConnection(apiKey?: string, baseUrl?: string): Promise<{ success: boolean; message: string; model?: string }> {
  const key = apiKey || getApiKey();
  const url = baseUrl || getBaseUrl();
  
  if (!key) {
    return { success: false, message: "未设置 API 密钥" };
  }
  
  try {
    const config: any = { apiKey: key };
    if (url) {
      config.baseURL = url;
    }
    
    const tempClient = new OpenAI(config);
    const model = getModel();
    
    // 尝试发送一个简单的请求
    const response = await tempClient.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Hello, respond with just OK in one word.' }],
      max_tokens: 10
    });
    
    if (response.choices[0]?.message?.content) {
      return { 
        success: true, 
        message: "连接成功",
        model
      };
    } else {
      return { success: false, message: "API 返回空响应" };
    }
  } catch (error: any) {
    console.error('[OpenAI] 连接测试失败:', error);
    
    // 解析错误信息
    let message = error.message || "连接失败";
    if (error.status === 401) {
      message = "API 密钥无效";
    } else if (error.status === 403) {
      message = "API 访问被拒绝";
    } else if (error.status === 404) {
      message = "模型不存在或 API 端点错误";
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      message = "无法连接到 API 服务器，请检查 Base URL";
    }
    
    return { success: false, message };
  }
}

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
    throw new Error("未设置 API 密钥，请在设置中配置 OpenAI API Key");
  }

  const model = getModel();

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

    // 检查模型是否支持视觉
    const hasVisionSupport = supportsVision();
    const useImage = image && hasVisionSupport;
    
    // Debug Log
    console.log("=== OpenAI Request Debug ===");
    console.log("Base URL:", getBaseUrl() || "(使用默认 OpenAI 端点)");
    console.log("Model:", model);
    console.log("Vision Support:", hasVisionSupport);
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
      model,
      messages,
      temperature: 0.8,
      max_tokens: 4096,
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
          model: getModel(),
          messages: fallbackMessages,
          temperature: 0.8,
          max_tokens: 4096,
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
      throw new Error("API 密钥无效，请检查设置中的 API Key");
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

  const model = getModel();

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
          model,
          messages,
          temperature: 0.8,
          max_tokens: 4096,
          stream: true,
          transforms: ["middle-out"],
        } as any) as unknown as AsyncIterable<OpenAI.Chat.ChatCompletionChunk>;

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
              model: getModel(),
              messages: fallbackMessages,
              temperature: 0.8,
              max_tokens: 4096,
              stream: true,
              transforms: ["middle-out"],
            } as any) as unknown as AsyncIterable<OpenAI.Chat.ChatCompletionChunk>;

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

/** 对话历史单条（与 Gemini 一致：model 表示助手回复） */
export interface ChatHistoryItem {
  role: 'user' | 'model';
  text: string;
}
/**
 * 以「画中角色」身份与用户多轮对话（OpenAI 兼容 API，需支持视觉的模型）
 * @param image 图片 base64 + mimeType
 * @param story 当前图片的故事文案，可为空
 * @param userMessage 用户本条消息
 * @param history 此前对话历史（user/model 交替）
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
    throw new Error("未设置 API 密钥，请在设置中配置 OpenAI API Key");
  }

  const { image, story, userMessage, history } = params;
  const model = getModel();
  const filteredMessage = applyForbiddenWordsFilter(userMessage.trim());
  if (!filteredMessage) {
    throw new Error("消息内容为空");
  }

  const hasVisionSupport = supportsVision();
  if (!hasVisionSupport) {
    throw new Error("当前模型不支持视觉，画中人对话需使用支持视觉的模型（如 gpt-4o）");
  }

  const systemInstruction = buildChatSystemInstruction(story);
  const openai = getClient();

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string | Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }> }> = [
    { role: 'system', content: systemInstruction },
  ];

  if (history.length === 0) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: `（请根据这张画与设定，以画中角色身份与我对话。）\n\n用户说：${filteredMessage}` },
        { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}`, detail: 'high' } },
      ],
    });
  } else {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: '（请根据这张画与设定，以画中角色身份与我对话。以下是之前的对话。）' },
        { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}`, detail: 'high' } },
      ],
    });
    for (const item of history) {
      const role = item.role === 'model' ? 'assistant' : 'user';
      messages.push({ role, content: item.text });
    }
    messages.push({ role: 'user', content: filteredMessage });
  }

  try {
    const isReasoningModel = model.toLowerCase().includes('o1') || model.toLowerCase().includes('o3');
    const chatParams: any = {
      model,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    };
    if (isReasoningModel) {
      chatParams.reasoning_effort = 'low';
    }
    const response = await openai.chat.completions.create(chatParams);

    const choices = response?.choices;
    const first = Array.isArray(choices) ? choices[0] : undefined;
    const text = first?.message?.content;
    if (text != null && typeof text === 'string') {
      return text.trim();
    }
    return '（未能生成回复，请重试。）';
  } catch (error: any) {
    console.error("[OpenAI Chat] Error:", error);
    if (error?.status === 401) {
      throw new Error("API 密钥无效");
    }
    if (error?.status === 429) {
      throw new Error("调用频率超限，请稍后再试");
    }
    const msg = error?.message ?? "角色对话失败";
    throw new Error(typeof msg === 'string' ? msg : "角色对话失败");
  }
};

/**
 * AI 配置管理服务
 * 
 * 配置优先级: config/ai-settings.json > .env.local > 默认值
 * 支持运行时热切换 Provider、模型和代理配置
 */

import fs from 'fs';
import path from 'path';

// 配置接口定义
export interface GeminiConfig {
  apiKey: string;
  model: string;
}

export interface OpenAIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface ProxyConfig {
  enabled: boolean;
  url: string;
}

export interface AISettings {
  provider: 'gemini' | 'openai';
  gemini: GeminiConfig;
  openai: OpenAIConfig;
  proxy: ProxyConfig;
}

// 默认配置
const DEFAULT_SETTINGS: AISettings = {
  provider: 'gemini',
  gemini: {
    apiKey: '',
    model: 'gemini-3-flash-preview'
  },
  openai: {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o'
  },
  proxy: {
    enabled: false,
    url: ''
  }
};

// 配置文件路径
const CONFIG_DIR = path.resolve(process.cwd(), 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'ai-settings.json');

// 内存中的当前配置
let currentConfig: AISettings | null = null;

// 服务重新初始化回调
let geminiReinitCallback: ((config: GeminiConfig, proxyUrl?: string) => void) | null = null;
let openaiReinitCallback: ((config: OpenAIConfig) => void) | null = null;

/**
 * 从 .env.local 读取环境变量配置
 */
function loadEnvConfig(): Partial<AISettings> {
  const envConfig: Partial<AISettings> = {};
  
  // Provider
  const provider = process.env.AI_PROVIDER?.toLowerCase();
  if (provider === 'gemini' || provider === 'openai') {
    envConfig.provider = provider;
  }
  
  // Gemini
  const geminiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (geminiKey) {
    envConfig.gemini = {
      apiKey: geminiKey,
      model: 'gemini-3-flash-preview'
    };
  }
  
  // OpenAI
  const openaiKey = process.env.OPENAI_API_KEY || process.env.API_KEY;
  const openaiBaseUrl = process.env.OPENAI_BASE_URL;
  const openaiModel = process.env.OPENAI_MODEL;
  
  if (openaiKey || openaiBaseUrl || openaiModel) {
    envConfig.openai = {
      apiKey: openaiKey || '',
      baseUrl: openaiBaseUrl || 'https://api.openai.com/v1',
      model: openaiModel || 'gpt-4o'
    };
  }
  
  // Proxy
  const proxyUrl = process.env.HTTPS_PROXY;
  if (proxyUrl) {
    envConfig.proxy = {
      enabled: true,
      url: proxyUrl
    };
  }
  
  return envConfig;
}

/**
 * 从配置文件读取设置
 */
function loadFileConfig(): Partial<AISettings> | null {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return null;
    }
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn('⚠ 无法读取 ai-settings.json:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * 深度合并配置对象
 */
function mergeConfig(...configs: (Partial<AISettings> | null)[]): AISettings {
  const result = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as AISettings;
  
  for (const config of configs) {
    if (!config) continue;
    
    if (config.provider) {
      result.provider = config.provider;
    }
    
    if (config.gemini) {
      result.gemini = { ...result.gemini, ...config.gemini };
    }
    
    if (config.openai) {
      result.openai = { ...result.openai, ...config.openai };
    }
    
    if (config.proxy) {
      result.proxy = { ...result.proxy, ...config.proxy };
    }
  }
  
  return result;
}

/**
 * 加载 AI 配置
 * 优先级: ai-settings.json > .env.local > 默认值
 */
export function loadAiConfig(): AISettings {
  const envConfig = loadEnvConfig();
  const fileConfig = loadFileConfig();
  
  // 合并配置：默认值 <- .env.local <- ai-settings.json
  currentConfig = mergeConfig(envConfig, fileConfig);
  
  console.log(`✓ AI 配置已加载`);
  console.log(`  - Provider: ${currentConfig.provider}`);
  console.log(`  - Gemini Model: ${currentConfig.gemini.model}`);
  console.log(`  - OpenAI Model: ${currentConfig.openai.model}`);
  console.log(`  - Proxy: ${currentConfig.proxy.enabled ? currentConfig.proxy.url : '禁用'}`);
  
  return currentConfig;
}

/**
 * 获取当前 AI 配置
 */
export function getAiConfig(): AISettings {
  if (!currentConfig) {
    return loadAiConfig();
  }
  return currentConfig;
}

/**
 * 获取当前激活的 Provider
 */
export function getActiveProvider(): 'gemini' | 'openai' {
  return getAiConfig().provider;
}

/**
 * 获取当前激活的 Provider 配置
 */
export function getActiveProviderConfig(): GeminiConfig | OpenAIConfig {
  const config = getAiConfig();
  return config.provider === 'gemini' ? config.gemini : config.openai;
}

/**
 * 获取代理配置
 */
export function getProxyConfig(): ProxyConfig {
  return getAiConfig().proxy;
}

/**
 * 保存 AI 配置到文件
 */
export async function saveAiConfig(settings: AISettings): Promise<boolean> {
  try {
    // 确保配置目录存在
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    
    // 写入配置文件
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    
    // 更新内存中的配置
    currentConfig = settings;
    
    console.log('✓ AI 配置已保存到 ai-settings.json');
    
    // 触发服务重新初始化
    await reloadServices();
    
    return true;
  } catch (error) {
    console.error('✗ 保存 AI 配置失败:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * 重新加载所有 AI 服务
 */
export async function reloadServices(): Promise<void> {
  const config = getAiConfig();
  
  console.log('⟳ 正在重新加载 AI 服务...');
  
  // 重新初始化 Gemini 服务
  if (geminiReinitCallback) {
    const proxyUrl = config.proxy.enabled ? config.proxy.url : undefined;
    geminiReinitCallback(config.gemini, proxyUrl);
    console.log('  ✓ Gemini 服务已重新初始化');
  }
  
  // 重新初始化 OpenAI 服务
  if (openaiReinitCallback) {
    openaiReinitCallback(config.openai);
    console.log('  ✓ OpenAI 服务已重新初始化');
  }
  
  console.log('✓ AI 服务重新加载完成');
}

/**
 * 注册 Gemini 服务重新初始化回调
 */
export function registerGeminiReinitCallback(callback: (config: GeminiConfig, proxyUrl?: string) => void): void {
  geminiReinitCallback = callback;
}

/**
 * 注册 OpenAI 服务重新初始化回调
 */
export function registerOpenAIReinitCallback(callback: (config: OpenAIConfig) => void): void {
  openaiReinitCallback = callback;
}

/**
 * 获取脱敏的 API Key（用于前端显示）
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) {
    return apiKey ? '****' : '';
  }
  const prefix = apiKey.substring(0, 4);
  const suffix = apiKey.substring(apiKey.length - 4);
  return `${prefix}...${suffix}`;
}

/**
 * 获取用于前端显示的配置（API Key 脱敏）
 */
export function getAiConfigForClient(): {
  provider: 'gemini' | 'openai';
  gemini: { apiKey: string; maskedKey: string; model: string; hasKey: boolean };
  openai: { apiKey: string; maskedKey: string; baseUrl: string; model: string; hasKey: boolean };
  proxy: ProxyConfig;
} {
  const config = getAiConfig();
  
  return {
    provider: config.provider,
    gemini: {
      apiKey: '', // 不返回完整 API Key
      maskedKey: maskApiKey(config.gemini.apiKey),
      model: config.gemini.model,
      hasKey: !!config.gemini.apiKey
    },
    openai: {
      apiKey: '', // 不返回完整 API Key
      maskedKey: maskApiKey(config.openai.apiKey),
      baseUrl: config.openai.baseUrl,
      model: config.openai.model,
      hasKey: !!config.openai.apiKey
    },
    proxy: config.proxy
  };
}

/**
 * 更新部分配置（用于前端提交时合并）
 */
export function mergePartialConfig(partial: {
  provider?: 'gemini' | 'openai';
  gemini?: Partial<GeminiConfig>;
  openai?: Partial<OpenAIConfig>;
  proxy?: Partial<ProxyConfig>;
}): AISettings {
  const current = getAiConfig();
  
  return {
    provider: partial.provider ?? current.provider,
    gemini: {
      // 如果前端传了空字符串的 apiKey，保留原来的值
      apiKey: (partial.gemini?.apiKey !== undefined && partial.gemini.apiKey !== '') 
        ? partial.gemini.apiKey 
        : current.gemini.apiKey,
      model: partial.gemini?.model ?? current.gemini.model
    },
    openai: {
      apiKey: (partial.openai?.apiKey !== undefined && partial.openai.apiKey !== '') 
        ? partial.openai.apiKey 
        : current.openai.apiKey,
      baseUrl: partial.openai?.baseUrl ?? current.openai.baseUrl,
      model: partial.openai?.model ?? current.openai.model
    },
    proxy: {
      enabled: partial.proxy?.enabled ?? current.proxy.enabled,
      url: partial.proxy?.url ?? current.proxy.url
    }
  };
}

// 在模块加载时初始化配置
loadAiConfig();

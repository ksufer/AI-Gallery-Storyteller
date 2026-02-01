# AI Provider 配置指南

本文档详细说明如何配置和切换不同的 AI 服务提供商。

## 📋 目录

- [支持的 AI 服务](#支持的-ai-服务)
- [配置方法](#配置方法)
- [OpenRouter 快速开始](#openrouter-快速开始)
- [其他服务配置示例](#其他服务配置示例)
- [常见问题](#常见问题)

---

## 支持的 AI 服务

### 1. Google Gemini (默认)

**特点**：
- ✅ 完全免费（每天 1500 次请求）
- ✅ 视觉分析能力最强
- ✅ 原生支持中文
- ⚠️ 国内需要代理访问

**配置示例**：
```env
AI_PROVIDER=gemini
GEMINI_API_KEY=AIzaSyC...your_key_here
HTTPS_PROXY=http://127.0.0.1:7890  # 国内用户需要配置代理
```

**获取 API Key**：
1. 访问 [Google AI Studio](https://aistudio.google.com/app/apikey)
2. 登录 Google 账号
3. 点击 "Create API Key"
4. 复制密钥到 `.env.local`

---

### 2. OpenRouter (推荐国内用户)

**特点**：
- ✅ 一个 API Key 支持多个模型
- ✅ 国内可直接访问（无需代理）
- ✅ 提供免费模型
- ✅ 支持 GPT-4o, Claude, Gemini 等主流模型
- 💰 付费模型按使用量计费

**配置示例**：
```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-or-v1-xxxxx
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=google/gemini-2.0-flash-exp:free  # 使用免费模型
```

**获取 API Key**：
1. 访问 [OpenRouter](https://openrouter.ai/)
2. 注册并登录
3. 进入 [Keys 页面](https://openrouter.ai/keys)
4. 点击 "Create Key" 创建新密钥
5. 复制密钥到 `.env.local`

**可用模型列表**：
- `google/gemini-2.0-flash-exp:free` - 免费 Gemini（推荐）
- `openai/gpt-4o` - OpenAI GPT-4o（付费，$2.5/1M tokens）
- `anthropic/claude-3.5-sonnet` - Claude 3.5 Sonnet（付费，$3/1M tokens）
- `google/gemini-pro-1.5` - Gemini Pro（付费，$1.25/1M tokens）

完整列表：[OpenRouter Models](https://openrouter.ai/models)

---

### 3. DeepSeek

**特点**：
- ✅ 国内服务，无需代理
- ✅ 价格便宜（比 OpenAI 便宜 80%）
- ⚠️ 视觉分析能力较弱

**配置示例**：
```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxxxx
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat
```

**获取 API Key**：
1. 访问 [DeepSeek Platform](https://platform.deepseek.com/)
2. 注册并充值
3. 在 API Keys 页面创建密钥

---

### 4. Moonshot (月之暗面)

**特点**：
- ✅ 国内服务，无需代理
- ✅ 支持长上下文
- ⚠️ 视觉分析能力一般

**配置示例**：
```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxxxx
OPENAI_BASE_URL=https://api.moonshot.cn/v1
OPENAI_MODEL=moonshot-v1-8k
```

**获取 API Key**：
1. 访问 [Moonshot AI](https://platform.moonshot.cn/)
2. 注册并登录
3. 在控制台创建 API Key

---

### 5. 本地 Ollama (完全免费)

**特点**：
- ✅ 完全免费，本地运行
- ✅ 无需联网，保护隐私
- ✅ 无 API 调用限制
- ⚠️ 视觉分析能力较弱
- ⚠️ 需要较好的硬件配置

**安装步骤**：

1. **安装 Ollama**

   Windows:
   ```bash
   # 下载安装程序
   # https://ollama.ai/download
   ```

   macOS:
   ```bash
   brew install ollama
   ```

   Linux:
   ```bash
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

2. **下载支持视觉的模型**
   ```bash
   ollama pull llava
   ```

3. **配置 .env.local**
   ```env
   AI_PROVIDER=openai
   OPENAI_API_KEY=ollama  # 任意值即可
   OPENAI_BASE_URL=http://localhost:11434/v1
   OPENAI_MODEL=llava
   ```

4. **启动 Ollama**
   ```bash
   ollama serve
   ```

---

## 配置方法

### 1. 编辑 `.env.local` 文件

在项目根目录找到 `.env.local` 文件（如果不存在，从 `.env.local.example` 复制一份）：

```bash
# Windows
copy .env.local.example .env.local

# macOS/Linux
cp .env.local.example .env.local
```

### 2. 选择 AI Provider 并配置

根据上面的配置示例，编辑 `.env.local` 文件：

```env
# 方案 1: 使用 Gemini
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_key_here

# 方案 2: 使用 OpenRouter
# AI_PROVIDER=openai
# OPENAI_API_KEY=sk-or-v1-xxxxx
# OPENAI_BASE_URL=https://openrouter.ai/api/v1
# OPENAI_MODEL=google/gemini-2.0-flash-exp:free
```

### 3. 重启服务器

```bash
# 停止当前服务器 (Ctrl+C)
# 重新启动
npm run dev
```

---

## OpenRouter 快速开始

如果你是国内用户且没有代理，OpenRouter 是最佳选择：

### 步骤 1: 注册 OpenRouter

1. 访问 https://openrouter.ai/
2. 点击右上角 "Sign Up" 注册账号
3. 可使用 Google/GitHub 账号快速登录

### 步骤 2: 获取 API Key

1. 登录后点击右上角头像
2. 选择 "Keys"
3. 点击 "Create Key"
4. 给密钥命名（如 "AI Gallery"）
5. 复制生成的密钥（格式：`sk-or-v1-xxxxx`）

### 步骤 3: 配置项目

编辑 `.env.local`：

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-or-v1-xxxxx  # 替换为你的密钥
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=google/gemini-2.0-flash-exp:free
```

### 步骤 4: 测试

1. 重启服务器
2. 上传一张图片
3. 点击 "AI 生成故事"
4. 查看日志确认使用的是 OpenRouter

---

## 其他服务配置示例

### 阿里通义千问

```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxxxx
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen-vl-plus
```

### 智谱 GLM

```env
AI_PROVIDER=openai
OPENAI_API_KEY=xxxxx.xxxxx
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
OPENAI_MODEL=glm-4v
```

---

## 常见问题

### Q: 如何查看当前使用的 AI 服务？

A: 启动服务器后，在终端日志中会显示：
- Gemini: 显示 "Using proxy: ..." 或 Gemini 相关日志
- OpenAI: 显示 "Base URL: ..." 相关日志

也可以在生成故事时查看控制台输出的 Debug 信息。

### Q: OpenRouter 的免费模型有限制吗？

A: 是的，免费模型有以下限制：
- 速率限制：约 20 次/分钟
- 单次请求有 Token 限制
- 适合个人使用，企业用户建议使用付费模型

### Q: 如何切换模型？

A: 只需修改 `.env.local` 中的 `OPENAI_MODEL` 配置：

```env
# 使用免费 Gemini
OPENAI_MODEL=google/gemini-2.0-flash-exp:free

# 切换到 GPT-4o
OPENAI_MODEL=openai/gpt-4o

# 切换到 Claude
OPENAI_MODEL=anthropic/claude-3.5-sonnet
```

然后重启服务器。

### Q: Gemini API 返回 403 或连接失败

A: 国内用户需要配置代理：

```env
HTTPS_PROXY=http://127.0.0.1:7890
```

端口号根据你的代理工具设置（Clash 通常是 7890，v2ray 通常是 10809）。

### Q: OpenRouter 返回 401 Unauthorized

A: 检查以下几点：
1. API Key 是否正确复制（注意不要有多余空格）
2. API Key 是否已过期
3. 是否忘记在 OpenRouter 账户中激活 API 访问

### Q: 如何降低成本？

A: 建议方案：
1. **优先使用免费服务**：Gemini (有代理) 或 OpenRouter 免费模型
2. **按需生成**：只为需要的图片生成故事，而不是批量生成
3. **使用国内便宜服务**：DeepSeek 的价格比 OpenAI 便宜 80%
4. **本地部署**：使用 Ollama 完全免费，但需要较好的硬件

### Q: 哪个服务的故事质量最好？

A: 从实测效果来看：
1. **GPT-4o** - 质量最稳定，但价格最贵
2. **Gemini 2.0 Flash** - 性价比最高（免费），质量接近 GPT-4o
3. **Claude 3.5 Sonnet** - 文学性强，适合创意写作
4. **DeepSeek** - 性价比高，但中文理解略弱
5. **本地 Ollama** - 质量最弱，仅适合测试

---

## 更多帮助

- OpenRouter 文档：https://openrouter.ai/docs
- Gemini API 文档：https://ai.google.dev/docs
- 项目 Issues：https://github.com/yourusername/AI-Gallery-Storyteller/issues

如有问题，请在 GitHub 提交 Issue 或查看项目 README。

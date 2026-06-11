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

### 方法 1: 通过设置界面配置（推荐）

**优点**：图形化界面，支持热切换，无需重启服务器

1. 启动应用后，点击右上角的 **设置** 按钮（齿轮图标）
2. 选择 **"模型设置"** 标签页
3. 选择 AI 服务提供商（Gemini 或 OpenAI 兼容）
4. 输入对应的 **API Key**
5. 选择或输入要使用的 **模型**（点击"刷新列表"可自动获取可用模型）
6. 如需代理（国内访问 Gemini），勾选"启用代理"并填写代理地址
7. 点击 **"测试连接"** 验证配置是否正确
8. 点击 **"保存设置"**，配置立即生效

**配置保存位置**：`config/ai-settings.json`（已添加到 .gitignore，不会被提交）

---

### 方法 2: 编辑 `.env.local` 文件

适用于首次配置或自动化部署场景。

在项目根目录找到 `.env.local` 文件（如果不存在，从 `.env.local.example` 复制一份）：

```bash
# Windows
copy .env.local.example .env.local

# macOS/Linux
cp .env.local.example .env.local
```

编辑 `.env.local` 文件：

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

**配置优先级**：`config/ai-settings.json` > `.env.local` > 默认值

如果通过设置界面保存过配置，则 `.env.local` 中的配置会被覆盖。

---

### 配置生效说明

| 配置方式 | 是否需要重启 | 适用场景 |
|----------|-------------|---------|
| 设置界面 | 否，立即生效 | 日常使用、切换模型 |
| .env.local | 是，需要重启 | 首次部署、自动化配置 |
| ai-settings.json | 否，刷新页面生效 | 手动编辑高级配置 |

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

### Q: 我的模型不支持视觉分析怎么办？

A: 如果使用的是纯文本模型（如 GPT-3.5-turbo、DeepSeek Chat），系统会**自动检测**并仅使用提示词生成故事。

**自动检测规则**：
系统会根据模型名称自动判断是否支持视觉，已知支持视觉的模型关键词包括：
- `gpt-4o`, `gpt-4-turbo`, `gpt-4-vision`
- `claude-3`
- `gemini`
- `llava`
- `qwen-vl`
- `glm-4v`

**手动配置**（如果自动检测不准确）：
```env
# 明确指定模型不支持视觉
OPENAI_VISION_SUPPORT=false

# 或者明确指定模型支持视觉
OPENAI_VISION_SUPPORT=true
```

**控制台提示**：
如果上传了图片但模型不支持视觉，会看到警告：
```
⚠️  模型不支持视觉分析，将仅使用提示词生成故事
提示：如需使用图片分析，请切换到支持视觉的模型（如 gpt-4o）
```

### Q: 哪些模型支持视觉分析？

A: 常见支持视觉的模型：

**OpenRouter**：
- ✅ `openai/gpt-4o`
- ✅ `openai/gpt-4-turbo`
- ✅ `anthropic/claude-3-opus`
- ✅ `anthropic/claude-3-sonnet`
- ✅ `anthropic/claude-3-haiku`
- ✅ `google/gemini-pro-vision`
- ✅ `google/gemini-2.0-flash-exp:free` (免费)

**直接接入**：
- ✅ Google Gemini (所有版本)
- ✅ GPT-4o, GPT-4-turbo
- ✅ Claude 3 系列
- ✅ 通义千问 VL (qwen-vl-plus)
- ✅ 智谱 GLM-4V
- ✅ 本地 LLaVA (Ollama)

**不支持视觉**：
- ❌ GPT-3.5-turbo
- ❌ DeepSeek Chat
- ❌ Moonshot (月之暗面)
- ❌ 大部分纯文本模型

### Q: 提示词被拦截了怎么办？

A: 系统有**自动降级策略**：

1. **第一次尝试**：使用提示词 + 图片生成
2. **如果被拦截**：自动重试，仅使用图片生成（不带提示词）
3. **如果仍失败**：返回错误信息

**注意事项**：
- 降级策略**仅在模型支持视觉时有效**
- 如果使用纯文本模型且提示词被拦截，会直接返回错误
- 生成结果会标注 "（提示词未通过安全检查）"

**避免被拦截的方法**：
1. 使用"禁词替换表"功能预先替换敏感词
2. 切换到内容审查较宽松的服务（如 OpenRouter）
3. 手动修改提示词，移除敏感内容

### Q: OpenRouter 的免费模型有限制吗？

A: 是的，免费模型有以下限制：
- 速率限制：约 20 次/分钟
- 单次请求有 Token 限制
- 适合个人使用，企业用户建议使用付费模型

### Q: 如何切换模型？

A: **推荐方式**：通过设置界面切换（无需重启）

1. 点击右上角"设置"按钮
2. 在"模型设置"标签页选择要使用的模型
3. 点击"刷新列表"可自动获取可用模型
4. 点击"保存设置"，立即生效

**手动方式**：修改 `.env.local` 中的 `OPENAI_MODEL` 配置：

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

A: 国内用户需要配置代理。

**通过设置界面配置**（推荐）：
1. 打开"设置" → "模型设置"
2. 勾选"启用代理"
3. 填写代理地址，如 `http://127.0.0.1:7890`
4. 点击"测试连接"验证
5. 保存设置

**通过环境变量配置**：
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

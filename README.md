# AI Gallery & Storyteller

**AI Gallery & Storyteller** 是一个本地运行的 Web 应用程序，专为 AI 绘画爱好者设计。它不仅是一个智能画廊，能自动解析 ComfyUI 和 Stable Diffusion WebUI 生成的图片元数据，还内置了一位“沉浸式微小说家”——通过 Google Gemini 模型，根据画面内容和提示词为你创作专属的微型故事。

## ✨ 核心功能

*   **🎨 智能元数据解析**
    *   自动识别并提取 PNG 图片中的生成参数。
    *   **ComfyUI 支持**: 解析 Checkpoints, LoRAs, Sampler 设置, Prompts (Positive/Negative)。
    *   **SD WebUI 支持**: 解析完整的生成参数文本块。
*   **📖 沉浸式故事生成**
    *   内置 "Storyteller" Agent，基于 Google Gemini 视觉模型。
    *   根据画面和提示词，生成 100-150 字的沉浸式微小说。
    *   支持艺术化处理，将画面转化为富有文学质感的独白。
*   **📂 自动化文件管理**
    *   **上传归档**: 支持拖拽上传，自动按日期文件夹归档图片 (`uploads/YYYY-MM-DD/`)。
    *   **文件名清洗**: 自动处理冲突，生成安全的文件名。
    *   **数据库同步**: 启动时自动扫描 `uploads` 目录，同步图片信息到 SQLite 数据库。
*   **🔍 画廊与检索**
    *   瀑布流式图片展示。
    *   支持按标签（Tags）和提示词搜索（TODO）。

## 🛠️ 技术栈

*   **Frontend**: React 19, Vite, TypeScript
*   **Backend**: Node.js, Express
*   **Database**: SQLite (`better-sqlite3`)
*   **AI**: Google Gemini SDK (`@google/genai`)
*   **Styling**: Custom CSS / Tailwind (Pending)

## 🚀 快速开始

### 前置要求

*   Node.js (v18+)
*   Google Gemini API Key

### 安装与运行

1.  **克隆项目**
    ```bash
    git clone <repository_url>
    cd sdpics
    ```

2.  **安装依赖**
    ```bash
    npm install
    ```

3.  **配置环境变量**
    在项目根目录创建 `.env.local` 文件，并添加你的 Gemini API Key：
    ```env
    GEMINI_API_KEY=your_gemini_api_key_here
    # 可选: 修改端口
    # PORT=3000
    ```

4.  **配置禁词表（可选）**
    复制并编辑禁词替换表配置：
    ```bash
    cp config/forbidden-words.example.json config/forbidden-words.json
    ```
    编辑 `config/forbidden-words.json` 添加需要替换的敏感词。

5.  **启动开发服务器**
    这将同时启动 Express 后端和 Vite 前端（以中间件模式运行）：
    ```bash
    npm run dev
    ```
    访问: `http://localhost:3000`

### 生产环境构建

```bash
npm run build
npm start
```

## 📁 目录结构

```
sdpics/
├── components/      # React 组件 (Sidebar, DetailModal 等)
├── server/          # 后端逻辑
│   ├── index.ts     # Express 服务器入口
│   ├── db.ts        # SQLite 数据库操作
│   ├── metadata.ts  # 图片元数据解析逻辑
│   └── organizer.ts # 文件整理与同步服务
├── services/        # 前端服务
│   ├── geminiService.ts # Gemini API 调用与 Prompt 定义
│   └── imageParser.ts   # (前端) 图片解析逻辑
├── db/              # SQLite 数据库文件
├── uploads/         # 图片存储目录 (自动生成)
└── App.tsx          # 主应用入口
```

## 📝 许可证

[MIT](LICENSE)

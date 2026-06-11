# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
# 开发模式（启动 Express 服务端，内含 Vite HMR 中间件）
npm run dev

# 构建生产版本（Vite 打包前端到 dist/）
npm run build

# 生产模式运行（先 build 再 start）
npm start
```

- 开发和生产共用同一个 Express 服务端入口 `server/index.ts`，通过 `NODE_ENV` 切换 Vite 中间件 / 静态文件模式。
- 没有独立的测试框架，目前项目不含 test 目录。
- 配置文件位于 `config/` 目录，环境变量在 `.env.local`。

## 架构概览

这是一个**单体全栈应用**（非前后端分离）。Express 服务端同时承担 API + 前端开发服务器 + 生产静态文件服务三重职责。

### 请求流

```
浏览器 → Express (server/index.ts)
           ├── /api/*     → 业务 API（图片 CRUD、标签、故事生成、设置、同步）
           ├── /uploads/* → 静态图片文件
           ├── /config/*  → 静态配置文件
           └── /*         → Vite 中间件(dev) 或 dist/ 静态文件(prod)
```

### 关键层级

| 层 | 位置 | 职责 |
|---|---|---|
| API 路由 | `server/index.ts` | 所有 Express 路由、中间件、启动逻辑 |
| 数据库 | `server/db.ts` | better-sqlite3，预编译语句，schema 迁移 |
| 文件组织 | `server/organizer.ts` | 按修改日期将图片归档到 `uploads/YYYY-MM-DD/`，定期扫描同步 |
| 元数据解析 | `server/metadata.ts` | 从 PNG tEXt 块提取 ComfyUI JSON / SD WebUI parameters |
| 外部同步 | `server/syncService.ts` | 从外部目录同步图片，支持增量扫描、SSE 进度推送 |
| AI 配置 | `services/aiConfigService.ts` | **中心配置层**：ai-settings.json > .env.local > 默认值，支持热切换 |
| AI 服务 | `services/geminiService.ts`、`services/openaiService.ts` | 故事生成（含流式）、角色对话、模型列表、连通性测试 |
| 前端组件 | `components/` | React 组件，通过 `App.tsx` 组装 |

### 前端数据流

`App.tsx` 是唯一的状态持有者（无状态管理库），所有子组件通过 props 接收数据和回调：

- `Sidebar` — 标签列表、日期文件夹、收藏筛选，通过 `refreshKey` 机制触发刷新
- `VirtualMasonryGallery` — 基于 `react-virtuoso` 的虚拟瀑布流，无限滚动分页
- `DetailModal` — 图片详情、故事展示/编辑、标签管理、角色对话
- `SettingsModal` — 禁词表、标签屏蔽列表、AI 设置、系统提示词编辑
- `BatchActionBar` + `BatchConfirmModal` — 批量选择/删除/标签/收藏/生成故事
- `SyncModal` — 外部同步源管理界面

`App.tsx` 直接 fetch `/api/*` 接口，无独立 API 客户端层。

### 数据库 Schema

SQLite (`db/images.db`)，核心表：

- `images` — id (主键, `filename_mtime` 格式), file_path, date_added, meta_json, story, is_favorite
- `tags` + `image_tags` — 多对多，`image_tags.source` 区分 `'auto'`（从提示词提取）和 `'user'`（手动添加）
- `sync_sources` — 外部同步源配置（路径、日期范围、自动同步间隔）
- `sync_records` — 同步记录（file_hash 去重，status 追踪）
- `sync_tasks` — 同步任务执行状态

### AI 服务抽象

两个 AI Service（`geminiService.ts` / `openaiService.ts`）遵循相同的导出接口：

- `generateStoryFromPrompts(prompts, image?, keywords?)` — 非流式生成
- `generateStoryStream(prompts, image?, keywords?)` — AsyncGenerator 流式生成
- `chatAsCharacter({image, story, userMessage, history})` — 多轮角色对话
- `listModels(apiKey?)` / `testConnection(apiKey?)` — 模型探索和连通性测试
- `reloadSystemPrompt()` — 运行时热更新系统提示词

两者都通过 `aiConfigService.ts` 获取配置，`aiConfigService` 变更时触发各自的 `reinitialize` 回调。配置优先级：`config/ai-settings.json` > `.env.local` > 默认值。

### 内容过滤管道

故事生成前经过两层过滤（两个 service 实现一致）：

1. **年龄词汇过滤** — 正则移除中英文年龄表述（`16岁`、`18 year old` 等）
2. **禁词替换** — 从 `config/forbidden-words.json` 加载映射表，全局替换
3. **降级策略** — 提示词被 API 拦截时，自动仅用图片重试生成

标签提取时应用 `config/blocked-tags.json`（正则匹配，大小写不敏感），屏蔽 `masterpiece`、`best quality` 等无意义标签。

### 同步系统

支持从外部目录增量同步图片：
- `POST /api/sync/sources` 注册同步源，`POST /api/sync/start/:id` 触发
- 通过 file_hash 去重，避免重复复制
- 进度通过 SSE (`/api/sync/events/:id`) 实时推送
- 同步源路径不能是 uploads 目录的子目录（`validateSourcePath` 检查）

### 关键约定

- 新依赖用 ESM import，项目 `"type": "module"`
- TypeScript strict 模式未开启，`tsconfig.json` 中 `noEmit: true`（Vite 负责编译）
- Vite alias `@/*` → 项目根目录 `./*`
- 前端 API 调用直接在 `App.tsx` 中 fetch，无统一请求封装
- 所有 API 端点都在 `server/index.ts` 中内联定义，无独立路由文件
- 生产环境需先 `npm run build` 生成 `dist/`，再 `npm start`
- `.env.local` 不在 git 中，`config/*.json` 的 example 文件在 git 中

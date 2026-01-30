# 更新日志

所有重要的项目变更都将记录在此文件中。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [未发布]

### 计划中
- 批量操作功能（批量删除、批量标签、批量生成故事）
- 全文搜索故事内容
- 数据导出功能（ZIP、CSV、Markdown）
- 数据统计仪表板

---

## [1.2.0] - 2026-01-30

### 新增
- **虚拟滚动优化** - 使用 `react-virtuoso` 实现高性能图片展示
- **无限滚动** - 分页加载机制，默认每页 20 张图片
- **响应式瀑布流** - 自适应 1-4 列布局
- **图片懒加载** - 骨架屏动画和渐进式加载
- **拖拽上传** - 从文件管理器拖拽图片到页面任意位置
- **粘贴上传** - 复制图片后按 Ctrl+V 直接粘贴
- **文件夹上传** - 直接上传整个文件夹

### 改进
- **性能提升** - 首屏渲染时间从 2-3 秒降至 300ms（10倍提升）
- **内存优化** - DOM 节点减少 90%，内存占用降低 70%
- **滚动流畅度** - 保持 60fps 流畅滚动
- **组件优化** - 使用 React.memo 避免不必要的重渲染

### 文档
- 新增 [OPTIMIZATION_SUMMARY.md](docs/OPTIMIZATION_SUMMARY.md) - 性能优化详细说明
- 新增 [DRAG_DROP_UPLOAD.md](docs/DRAG_DROP_UPLOAD.md) - 拖拽上传功能文档

---

## [1.1.0] - 2026-01-29

### 新增
- **图片删除功能** - 删除图片同时删除物理文件和数据库记录
- **用户标签系统** - 手动添加和管理个性化标签
  - 添加标签到图片
  - 删除图片标签
  - 用户标签和自动标签分离显示
- **设置管理界面** - 可视化配置编辑器
  - 禁词替换表编辑（表格式布局）
  - 标签屏蔽列表编辑
  - 实时保存和验证
- **按日期浏览** - 按上传日期文件夹筛选图片
  - 自动扫描 `uploads/YYYY-MM-DD/` 文件夹
  - 显示每个日期的图片数量
  - 最新日期优先显示
- **故事编辑功能** - 支持手动编辑和保存 AI 生成的故事

### API 变更
- 新增 `DELETE /api/images/:id` - 删除图片
- 新增 `GET /api/images/:id/tags` - 获取图片标签
- 新增 `POST /api/images/:id/tags` - 添加标签到图片
- 新增 `DELETE /api/images/:id/tags/:tagName` - 删除图片标签
- 新增 `GET /api/folders` - 获取日期文件夹列表
- 新增 `GET /api/settings/forbidden-words` - 获取禁词表
- 新增 `PUT /api/settings/forbidden-words` - 更新禁词表
- 新增 `GET /api/settings/blocked-tags` - 获取屏蔽标签
- 新增 `PUT /api/settings/blocked-tags` - 更新屏蔽标签
- 新增 `POST /api/settings/blocked-tags/reload` - 重新加载屏蔽标签

### 数据库变更
- 添加 `image_tags.source` 字段 - 区分自动标签和用户标签
- 添加 `images.is_favorite` 字段 - 收藏状态

### 改进
- **侧边栏重构** - 删除模型和 LoRA 筛选，新增日期浏览
- **标签搜索** - 自动标签和用户标签分别支持模糊搜索
- **标签统计** - 实时显示每个标签的图片数量
- **配置管理** - 支持通过界面编辑配置文件

### 文档
- 新增 [IMPLEMENTATION_SUMMARY.md](docs/IMPLEMENTATION_SUMMARY.md) - 功能实施总结
- 新增 [config/README.md](config/README.md) - 配置文件说明

### 修复
- 修复删除图片后列表不更新的问题
- 修复标签重复显示的问题
- 修复文件名冲突处理

---

## [1.0.0] - 2026-01-28

### 新增
- **核心功能** - AI 画廊与故事生成器
  - 图片上传和管理
  - 元数据自动解析（ComfyUI 和 SD WebUI）
  - AI 故事生成（基于 Google Gemini）
  - 收藏功能
  - 标签系统（自动提取）
  
- **智能内容过滤**
  - 年龄词汇自动过滤
  - 禁词替换表支持
  - 标签屏蔽列表
  - 智能降级策略（提示词被拦截时自动尝试仅用图片生成）
  
- **元数据解析**
  - ComfyUI 格式：Checkpoints, LoRAs, Sampler, Prompts
  - SD WebUI 格式：完整的生成参数
  - 自动提取标签（从 Prompts）
  
- **文件管理**
  - 自动按修改日期归档到 `uploads/YYYY-MM-DD/`
  - 文件名冲突自动处理
  - 启动时自动同步数据库
  - 每 60 秒自动扫描新文件
  
- **浏览与筛选**
  - 按标签筛选
  - 按收藏筛选
  - 瀑布流式图片展示
  
- **数据库**
  - SQLite 本地存储
  - 自动创建和迁移
  - 图片、标签、关联表

### API 端点
- `GET /api/images` - 获取图片列表
- `PATCH /api/images/:id/story` - 更新图片故事
- `PATCH /api/images/:id/favorite` - 更新收藏状态
- `GET /api/tags` - 获取标签列表
- `POST /api/upload` - 上传图片

### 技术栈
- **前端**: React 19, Vite 6, TypeScript, Tailwind CSS
- **后端**: Node.js, Express 5, SQLite (better-sqlite3)
- **AI**: Google Gemini SDK (@google/genai)
- **文件处理**: Multer

### 文档
- 初始版本的 README.md
- 新增 [AGENTS.md](AGENTS.md) - AI Agent 规范定义
- 新增 [CONTENT_FILTERING.md](docs/CONTENT_FILTERING.md) - 内容过滤机制说明

---

## 版本说明

### 版本号规则

项目遵循语义化版本 `主版本号.次版本号.修订号`：

- **主版本号**：不兼容的 API 变更
- **次版本号**：向下兼容的功能新增
- **修订号**：向下兼容的问题修正

### 变更类型

- **新增** (Added) - 新功能
- **改进** (Changed) - 现有功能的变更
- **弃用** (Deprecated) - 即将移除的功能
- **移除** (Removed) - 已移除的功能
- **修复** (Fixed) - Bug 修复
- **安全** (Security) - 安全问题修复

---

## 贡献指南

在提交 Pull Request 时，请：

1. 在适当的版本部分添加变更说明
2. 使用正确的变更类型标签
3. 简洁清晰地描述变更内容
4. 如有破坏性变更，请特别标注

---

## 相关链接

- [项目主页](https://github.com/yourusername/AI-Gallery-Storyteller)
- [问题追踪](https://github.com/yourusername/AI-Gallery-Storyteller/issues)
- [发布页面](https://github.com/yourusername/AI-Gallery-Storyteller/releases)

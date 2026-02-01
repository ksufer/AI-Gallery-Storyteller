# 系统提示词动态配置功能说明

## 功能概述

现在你可以直接在前端界面修改系统提示词（System Prompt），无需重启服务器即可生效。

**首次使用**：服务启动时会自动从 `system-prompt.example.json` 创建 `system-prompt.json`，无需手动操作。

**Git 友好**：`system-prompt.json` 已添加到 `.gitignore`，你的个性化配置不会被 git 跟踪。

## 使用方法

### 方式一：通过设置界面（推荐）

1. 点击应用右上角的**"设置"**按钮（齿轮图标）
2. 切换到**"系统提示词"**标签页
3. 在文本框中编辑提示词内容
4. 点击**"保存设置"**按钮
5. 刷新页面（如果需要）
6. 下次生成故事时将使用新的提示词

### 方式二：手动编辑配置文件

1. 编辑 `config/system-prompt.json` 文件
2. 修改 `content` 字段的内容
3. 保存文件
4. 刷新浏览器页面
5. 新的提示词会自动重新加载

## 配置文件格式

```json
{
  "content": "你的系统提示词内容..."
}
```

## 注意事项

- ✅ **无需重启服务器**：修改后自动重新加载
- ✅ **即时生效**：保存后刷新页面即可
- ✅ **支持换行**：在编辑器中直接换行，保存时会自动转换为 `\n`
- ⚠️ **影响范围**：所有新生成的故事都会使用新的提示词
- ⚠️ **建议测试**：修改后建议先生成一张图的故事，确认效果

## 示例提示词

### 简洁风格
```
你是一位擅长视觉美学与叙事艺术的"沉浸式微小说家"。根据画面和提示词创作简短的故事。
```

### 详细风格（默认）
参见 `config/system-prompt.json` 中的完整示例。

## 技术实现

- 配置文件：`config/system-prompt.json`
- 后端服务：`services/geminiService.ts`
- API 端点：
  - `GET /api/settings/system-prompt` - 获取当前提示词
  - `PUT /api/settings/system-prompt` - 更新提示词
- 前端界面：`components/SettingsModal.tsx` 的"系统提示词"标签页

## 故障排查

### 提示词未生效
1. 确认已保存设置（界面提示"系统提示词已更新"）
2. 刷新浏览器页面
3. 检查浏览器控制台是否有错误信息

### 配置文件加载失败
- 检查 `config/system-prompt.json` 文件格式是否正确（必须是有效的 JSON）
- 查看服务器控制台输出，确认是否有加载错误信息
- 如果文件不存在，系统会使用默认提示词

### 启动时提示

**首次运行（自动创建配置文件）**：
```
⚠ 系统提示词文件不存在，尝试从示例文件创建...
✓ 已从示例文件创建 system-prompt.json
✓ 已加载系统提示词 (XXX 字符)
```

**正常启动（配置文件已存在）**：
```
✓ 已加载系统提示词 (XXX 字符)
```

**加载失败（使用默认提示词）**：
```
⚠ 无法加载系统提示词配置文件，将使用默认提示词
```

## 相关文件

- `config/system-prompt.json` - 当前使用的提示词（**不会被 git 跟踪**）
- `config/system-prompt.example.json` - 示例提示词模板（被 git 跟踪）
- `config/README.md` - 完整配置文档

## Git 管理

为了避免个性化配置被 git 跟踪，`system-prompt.json` 已添加到 `.gitignore`：

```gitignore
# Config files (keep examples)
config/forbidden-words.json
config/blocked-tags.json
config/system-prompt.json
```

只有 `.example.json` 示例文件会被 git 跟踪，确保：
- ✅ 新用户可以快速开始（自动从示例创建）
- ✅ 个性化配置不会被提交
- ✅ 多人协作时不会冲突

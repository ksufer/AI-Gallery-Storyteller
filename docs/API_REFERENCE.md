# API 参考文档

本文档详细说明了 AI Gallery & Storyteller 的所有 API 端点。

---

## 基础信息

- **Base URL**: `http://localhost:3000/api`
- **响应格式**: JSON
- **字符编码**: UTF-8

---

## 图片管理 API

### 1. 获取图片列表

获取图片列表，支持分页和多种筛选条件。

**端点**: `GET /api/images`

**查询参数**:

| 参数 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| `page` | number | 否 | 1 | 页码（从 1 开始） |
| `limit` | number | 否 | 20 | 每页数量 |
| `folder` | string | 否 | - | 按日期文件夹筛选（YYYY-MM-DD） |
| `tag` | string | 否 | - | 按标签筛选 |
| `favorite` | boolean | 否 | false | 是否只显示收藏 |

**响应格式**:

```json
{
  "data": [
    {
      "id": "image_001.png_1738233600000",
      "url": "/uploads/2026-01-30/image_001.png",
      "fileName": "image_001.png",
      "metadata": {
        "type": "ComfyUI",
        "checkpoints": ["Juggernaut XL_v9"],
        "loras": ["NeonStyles_v1"],
        "prompts": ["cyberpunk city", "neon lights"],
        "negative_prompts": ["blurry", "low quality"],
        "sampler": {
          "seed": 8475928347,
          "steps": 30,
          "cfg": 7.0,
          "sampler_name": "dpmpp_2m",
          "scheduler": "karras"
        },
        "image_size": ["1024x1536"]
      },
      "isFavorite": false,
      "dateAdded": "2026-01-30T12:00:00.000Z",
      "story": "可选的故事内容"
    }
  ],
  "total": 98,
  "page": 1,
  "limit": 20,
  "hasMore": true
}
```

**示例请求**:

```bash
# 获取第一页（20 张）
GET /api/images?page=1&limit=20

# 获取 2026-01-30 的图片
GET /api/images?folder=2026-01-30

# 获取包含 "cyberpunk" 标签的图片
GET /api/images?tag=cyberpunk

# 获取所有收藏的图片
GET /api/images?favorite=true
```

---

### 2. 删除图片

删除指定图片及其物理文件。

**端点**: `DELETE /api/images/:id`

**路径参数**:
- `id` (string): 图片 ID

**响应格式**:

**成功**:
```json
{
  "success": true,
  "message": "Image deleted successfully"
}
```

**失败**:
```json
{
  "success": false,
  "error": "Image not found"
}
```

**示例请求**:

```bash
DELETE /api/images/image_001.png_1738233600000
```

---

### 3. 更新图片故事

更新或保存图片的故事内容。

**端点**: `PATCH /api/images/:id/story`

**路径参数**:
- `id` (string): 图片 ID

**请求体**:

```json
{
  "story": "这是一段生成或编辑的故事..."
}
```

**响应格式**:

```json
{
  "success": true,
  "message": "Story updated"
}
```

**示例请求**:

```bash
PATCH /api/images/image_001.png_1738233600000/story
Content-Type: application/json

{
  "story": "夜幕降临，霓虹灯在雨中闪烁..."
}
```

---

### 4. 与画中人对话

以「画中角色」身份与用户多轮对话（支持 `AI_PROVIDER=gemini` 或 `openai`；OpenAI 需支持视觉的模型）。详见 [CHARACTER_CHAT.md](CHARACTER_CHAT.md)。

**端点**: `POST /api/images/:id/chat`

**路径参数**:
- `id` (string): 图片 ID

**请求体**:

```json
{
  "message": "用户本条消息（必填）",
  "history": [
    { "role": "user", "text": "..." },
    { "role": "model", "text": "..." }
  ]
}
```

- `message` (string, 必填): 用户本条消息。
- `history` (array, 可选): 此前对话历史，每项 `{ role: "user" | "model", text: string }`，最多建议 20 条。

**响应格式**:

```json
{
  "reply": "角色回复的文本"
}
```

---

### 5. 更新收藏状态

切换图片的收藏状态。

**端点**: `PATCH /api/images/:id/favorite`

**路径参数**:
- `id` (string): 图片 ID

**请求体**:

```json
{
  "isFavorite": true
}
```

**响应格式**:

```json
{
  "success": true,
  "message": "Favorite status updated",
  "isFavorite": true
}
```

**示例请求**:

```bash
# 添加到收藏
PATCH /api/images/image_001.png_1738233600000/favorite
Content-Type: application/json

{
  "isFavorite": true
}
```

---

## 标签管理 API

### 6. 获取标签列表

获取所有标签及其使用次数。

**端点**: `GET /api/tags`

**查询参数**:

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `q` | string | 否 | 搜索关键词（模糊匹配） |
| `source` | string | 否 | 标签来源：`auto` 或 `user` |

**响应格式**:

```json
[
  {
    "name": "cyberpunk",
    "count": 15
  },
  {
    "name": "portrait",
    "count": 23
  }
]
```

**示例请求**:

```bash
# 获取所有自动标签
GET /api/tags?source=auto

# 搜索包含 "cyber" 的标签
GET /api/tags?q=cyber

# 获取所有用户标签
GET /api/tags?source=user
```

---

### 7. 获取图片的标签

获取指定图片的所有标签。

**端点**: `GET /api/images/:id/tags`

**路径参数**:
- `id` (string): 图片 ID

**响应格式**:

```json
{
  "success": true,
  "tags": ["cyberpunk", "neon", "city", "用户自定义标签"]
}
```

---

### 8. 添加标签到图片

为图片添加用户自定义标签。

**端点**: `POST /api/images/:id/tags`

**路径参数**:
- `id` (string): 图片 ID

**请求体**:

```json
{
  "tagName": "我的标签"
}
```

**响应格式**:

```json
{
  "success": true,
  "tags": ["cyberpunk", "neon", "我的标签"]
}
```

**错误响应**:

```json
{
  "success": false,
  "error": "Tag name is required"
}
```

**验证规则**:
- 标签名不能为空
- 标签名长度不超过 50 个字符
- 图片必须存在

---

### 9. 从图片删除标签

删除图片的指定标签。

**端点**: `DELETE /api/images/:id/tags/:tagName`

**路径参数**:
- `id` (string): 图片 ID
- `tagName` (string): 标签名（URL 编码）

**响应格式**:

```json
{
  "success": true,
  "tags": ["cyberpunk", "neon"]
}
```

**示例请求**:

```bash
# 删除标签 "我的标签"
DELETE /api/images/image_001.png_1738233600000/tags/%E6%88%91%E7%9A%84%E6%A0%87%E7%AD%BE
```

---

## 文件夹管理 API

### 10. 获取日期文件夹列表

获取所有按日期归档的文件夹。

**端点**: `GET /api/folders`

**响应格式**:

```json
{
  "success": true,
  "folders": ["2026-01-30", "2026-01-29", "2026-01-28"],
  "counts": {
    "2026-01-30": 15,
    "2026-01-29": 23,
    "2026-01-28": 8
  }
}
```

**说明**:
- `folders` 按日期倒序排列（最新的在前）
- `counts` 包含每个文件夹的图片数量

---

## 上传 API

### 11. 上传图片

上传单个或多个图片文件。

**端点**: `POST /api/upload`

**Content-Type**: `multipart/form-data`

**表单字段**:

| 字段 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `files` | file[] | 是 | 图片文件（可多个） |
| `lastModified` | string[] | 否 | 文件修改时间戳（毫秒） |

**响应格式**:

```json
{
  "message": "Processed 3 file(s)",
  "files": [
    {
      "fileName": "image_001.png",
      "success": true
    },
    {
      "fileName": "image_002.png",
      "success": true
    },
    {
      "fileName": "corrupted.png",
      "success": false,
      "error": "Failed to parse metadata"
    }
  ]
}
```

**支持的文件格式**:
- PNG (.png)
- JPEG (.jpg, .jpeg)
- WebP (.webp)

**文件大小限制**: 500MB

**示例请求**:

```bash
# 使用 cURL 上传
curl -X POST http://localhost:3000/api/upload \
  -F "files=@image1.png" \
  -F "files=@image2.png" \
  -F "lastModified=1738233600000" \
  -F "lastModified=1738233700000"
```

---

## 设置管理 API

### 12. 获取禁词替换表

获取当前的禁词替换配置。

**端点**: `GET /api/settings/forbidden-words`

**响应格式**:

```json
{
  "success": true,
  "data": {
    "少女": "美女",
    "女孩": "女子",
    "学生": "年轻女子"
  }
}
```

---

### 13. 更新禁词替换表

更新禁词替换配置。

**端点**: `PUT /api/settings/forbidden-words`

**请求体**:

```json
{
  "少女": "美女",
  "女孩": "女子",
  "新词": "替换词"
}
```

**响应格式**:

```json
{
  "success": true,
  "message": "Settings updated successfully"
}
```

**验证规则**:
- 必须是对象格式（键值对）
- 所有键和值必须是字符串

---

### 14. 获取屏蔽标签列表

获取当前的标签屏蔽配置。

**端点**: `GET /api/settings/blocked-tags`

**响应格式**:

```json
{
  "success": true,
  "data": [
    "masterpiece",
    "best quality",
    "high quality"
  ]
}
```

---

### 15. 更新屏蔽标签列表

更新标签屏蔽配置。

**端点**: `PUT /api/settings/blocked-tags`

**请求体**:

```json
[
  "masterpiece",
  "best quality",
  "ultra-detailed",
  "新屏蔽标签"
]
```

**响应格式**:

```json
{
  "success": true,
  "message": "Blocked tags updated successfully",
  "reloaded": true
}
```

**说明**:
- 配置立即生效（自动重新加载到内存）
- 仅对新导入的图片有效
- 已存在的标签不会被自动删除

---

### 16. 重新加载屏蔽标签配置

手动重新加载标签屏蔽配置到内存。

**端点**: `POST /api/settings/blocked-tags/reload`

**响应格式**:

```json
{
  "success": true,
  "message": "Blocked tags reloaded successfully"
}
```

---

## 错误处理

所有 API 在发生错误时返回统一格式：

```json
{
  "success": false,
  "error": "错误描述信息"
}
```

### HTTP 状态码

| 状态码 | 含义 | 说明 |
|--------|------|------|
| 200 | OK | 请求成功 |
| 400 | Bad Request | 请求参数错误或验证失败 |
| 404 | Not Found | 资源不存在 |
| 500 | Internal Server Error | 服务器内部错误 |

### 常见错误码

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| `Image not found` | 图片不存在 | 检查图片 ID 是否正确 |
| `Tag name is required` | 标签名为空 | 提供有效的标签名 |
| `Tag name too long` | 标签名超过 50 字符 | 缩短标签名 |
| `Invalid format` | 请求格式错误 | 检查请求体格式 |
| `Failed to upload files` | 上传失败 | 检查文件格式和大小 |

---

## 分页机制

所有支持分页的 API 使用相同的机制：

**请求参数**:
- `page`: 页码（从 1 开始）
- `limit`: 每页数量（建议 10-50）

**响应结构**:
```json
{
  "data": [...],      // 当前页的数据
  "total": 100,       // 总数量
  "page": 1,          // 当前页码
  "limit": 20,        // 每页数量
  "hasMore": true     // 是否还有更多数据
}
```

**无限滚动实现**:
```javascript
let page = 1;
let hasMore = true;

async function loadMore() {
  if (!hasMore) return;
  
  const response = await fetch(`/api/images?page=${page}&limit=20`);
  const data = await response.json();
  
  // 追加数据到列表
  appendImages(data.data);
  
  // 更新状态
  page = data.page + 1;
  hasMore = data.hasMore;
}
```

---

## 使用示例

### JavaScript Fetch API

```javascript
// 获取图片列表
async function getImages(page = 1) {
  const response = await fetch(`/api/images?page=${page}&limit=20`);
  const data = await response.json();
  return data;
}

// 添加标签
async function addTag(imageId, tagName) {
  const response = await fetch(`/api/images/${imageId}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tagName })
  });
  return response.json();
}

// 上传图片
async function uploadImages(files) {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
    formData.append('lastModified', file.lastModified.toString());
  });
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });
  return response.json();
}
```

### Axios

```javascript
import axios from 'axios';

// 获取图片列表
const getImages = async (page = 1) => {
  const { data } = await axios.get('/api/images', {
    params: { page, limit: 20 }
  });
  return data;
};

// 删除图片
const deleteImage = async (imageId) => {
  const { data } = await axios.delete(`/api/images/${imageId}`);
  return data;
};

// 更新收藏状态
const toggleFavorite = async (imageId, isFavorite) => {
  const { data } = await axios.patch(
    `/api/images/${imageId}/favorite`,
    { isFavorite }
  );
  return data;
};
```

---

## 更新日志

### v1.2.0 (2026-01-30)
- ✅ 添加分页支持
- ✅ 添加标签管理 API
- ✅ 添加设置管理 API
- ✅ 添加文件夹列表 API

### v1.1.0 (2026-01-29)
- ✅ 添加图片删除 API
- ✅ 添加收藏功能 API
- ✅ 添加故事更新 API

### v1.0.0 (2026-01-28)
- ✅ 初始版本
- ✅ 基础图片查询和上传

---

## 相关文档

- [README.md](../README.md) - 项目概览
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - 故障排除
- [CONTENT_FILTERING.md](CONTENT_FILTERING.md) - 内容过滤机制

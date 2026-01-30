# 配置文件说明

本目录包含应用的配置文件。

## forbidden-words.json

禁词替换表配置文件，用于在生成故事前自动替换提示词中的敏感词汇。

### 文件格式

```json
{
  "需要替换的词": "替换后的词",
  "另一个词": "另一个替换"
}
```

### 使用方法

1. 如果 `forbidden-words.json` 不存在，将 `forbidden-words.example.json` 复制为 `forbidden-words.json`
2. 编辑 `forbidden-words.json`，添加您需要的词汇映射
3. 保存文件后重启服务器，配置会在应用启动时自动加载

### 示例

```json
{
  "裸露": "展现",
  "露出": "呈现",
  "乳沟": "轮廓",
  "侧乳": "侧影",
  "丁字裤": "内衣",
  "蕾丝": "精致",
  "掀起裙边": "裙摆飘动"
}
```

### 注意事项

- 替换是**不区分大小写**的
- 使用**全局替换**，会替换所有匹配项
- 按顺序执行替换（JSON 对象的顺序可能因实现而异）
- 如果文件加载失败，应用会使用空的禁词表（不影响正常功能）

### 调试

应用启动时，控制台会显示：
```
✓ 已加载禁词表: X 个词汇
```

如果加载失败，会显示警告：
```
⚠ 无法加载禁词表配置文件，将使用空的禁词表
```

### 动态更新

目前配置文件在应用启动时加载。如果修改了配置文件，需要：
1. 重启开发服务器（`npm run dev`）
2. 或重新加载前端页面

未来版本可能支持热重载配置。

---

## blocked-tags.json

标签屏蔽列表配置文件，用于在自动提取标签时过滤掉无意义的标签。

### 文件格式

```json
[
  "标签1",
  "标签2",
  "标签3"
]
```

### 使用方法

1. 如果 `blocked-tags.json` 不存在，将 `blocked-tags.example.json` 复制为 `blocked-tags.json`
2. 编辑 `blocked-tags.json`，添加您需要屏蔽的标签
3. 保存文件后重启服务器，配置会在应用启动时自动加载

### 示例

```json
[
  "masterpiece",
  "best quality",
  "high quality",
  "extremely detailed",
  "8k",
  "4k",
  "bokeh",
  "depth of field",
  "sharp focus",
  "cinematic lighting",
  "wide shot",
  "close-up",
  "looking at viewer"
]
```

### 用途

- 屏蔽无意义的图像质量词（masterpiece, best quality, high quality等）
- 屏蔽镜头相关词汇（wide shot, close-up, from above等）
- 屏蔽光照相关词汇（cinematic lighting, dramatic lighting等）
- 屏蔽画质相关词汇（8k, 4k, absurdres等）
- 屏蔽技术性描述词（detailed face, perfect anatomy等）

### 注意事项

- 匹配是**不区分大小写**的
- 仅影响**自动提取的标签**，不影响用户手动添加的标签
- 用户手动添加的标签会单独显示在"用户标签"区域
- 如果文件加载失败，应用不会屏蔽任何标签（所有标签都会显示）

### 调试

应用启动时，控制台会显示：
```
✓ Loaded X blocked tags
```

如果加载失败，会显示警告：
```
⚠ Could not load blocked-tags.json, using empty blocklist
```

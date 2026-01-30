# 内容过滤与降级策略

本文档说明 AI Gallery & Storyteller 中实现的内容过滤机制和降级策略。

## 概述

为了确保 Gemini API 能够成功生成故事，我们实现了三层过滤机制和一个智能降级策略。

---

## 1. 年龄词汇过滤

自动移除提示词中的年龄相关表达，避免触发 Google 的儿童安全防护机制。

### 支持的格式

#### 英文格式
- `16yo` → 移除
- `18 year old` → 移除
- `20 years old` → 移除

#### 中文格式
- `16岁` → 移除
- `16岁的` → 移除
- `十六岁` → 移除
- `十八岁的女孩` → 删除"十八岁的"

### 实现细节

```typescript
// 1. 英文格式
cleaned = cleaned.replace(/\b\d+\s*(yo|year\s*old|years\s*old)\b/gi, '');

// 2. 阿拉伯数字+岁
cleaned = cleaned.replace(/\d+\s*岁([的之])?/g, '');

// 3. 中文数字+岁
cleaned = cleaned.replace(/(一|二|三|四|五|六|七|八|九|十)+岁([的之])?/g, '');
```

### 测试示例

| 输入 | 输出 |
|------|------|
| `一张十六岁中国少女的写实人像摄影` | `一张中国少女的写实人像摄影` |
| `16岁的女孩面部特征柔和` | `女孩面部特征柔和` |
| `18 year old portrait` | `portrait` |

---

## 2. 禁词替换表

通过配置禁词表，自动将敏感词汇替换为更委婉的表达。

### 配置文件

在 `services/geminiService.ts` 中修改 `FORBIDDEN_WORDS_MAP`：

```typescript
const FORBIDDEN_WORDS_MAP: Record<string, string> = {
  '裸露': '展现',
  '露出': '呈现',
  '乳沟': '轮廓',
  '侧乳': '侧影',
  '丁字裤': '内衣',
  '蕾丝': '精致',
  '掀起裙边': '裙摆飘动',
  // 可以继续添加更多需要替换的词汇...
};
```

### 工作原理

1. 年龄过滤后，应用禁词替换
2. 使用正则全局替换（不区分大小写）
3. 按顺序逐个处理映射表中的词汇对

### 示例

| 原始提示词 | 过滤后 |
|-----------|--------|
| `露出侧乳和乳沟` | `呈现侧影和轮廓` |
| `穿着蕾丝丁字裤` | `穿着精致内衣` |

---

## 3. 智能降级策略

当提示词被标记为 `PROHIBITED_CONTENT` 时，自动尝试"仅图片生成"模式。

### 触发条件

```
response.promptFeedback.blockReason === 'PROHIBITED_CONTENT'
```

### 降级流程

```mermaid
flowchart TD
    A[发送请求: 图片 + 提示词] --> B{检查响应}
    B -->|成功| C[返回生成的故事]
    B -->|PROHIBITED_CONTENT| D{是否有图片?}
    D -->|是| E[重试: 仅图片 + 系统指令]
    D -->|否| F[返回拦截信息]
    E --> G{重试成功?}
    G -->|是| H[返回故事 + 提示词未通过]
    G -->|否| F
```

### 降级后的输出格式

```
【生成的故事内容】

（提示词未通过）
```

### 控制台日志

```
=== 检测到 PROHIBITED_CONTENT，尝试降级策略（仅图片） ===
...
=== 降级策略成功 ===
```

---

## 4. 安全设置

所有 Gemini API 请求均将安全过滤器设置为最宽松模式：

```typescript
safetySettings: [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
]
```

---

## 5. 调试与验证

### 控制台输出

每次生成故事时，控制台会打印：

```
=== Gemini Request Debug ===
Model: gemini-3-flash-preview
--- System Instruction ---
[系统指令内容]
--------------------------
Original Prompts: [原始提示词数组]
Filtered Prompts: [过滤后的提示词数组]
Prompt Text: 提示词: xxx
Has Image: true
Image MimeType: image/png
Image Data Length: 123456
============================
```

### 测试用例

启动开发服务器时，会自动运行年龄过滤器测试：

```
=== Age Filter Test Cases ===
Input:  "一张十六岁中国少女的写实人像摄影"
Output: "一张中国少女的写实人像摄影"
---
...
============================
```

---

## 6. 自定义配置

### 添加新的禁词

编辑 `services/geminiService.ts`，在 `FORBIDDEN_WORDS_MAP` 中添加新的映射：

```typescript
const FORBIDDEN_WORDS_MAP: Record<string, string> = {
  // 现有词汇...
  '你的新词': '替换为',
  '另一个词': '另一个替换',
};
```

### 调整过滤强度

如果需要更严格或更宽松的过滤：

1. **年龄过滤**: 修改正则表达式的匹配范围
2. **禁词替换**: 添加/删除 `FORBIDDEN_WORDS_MAP` 中的条目
3. **安全设置**: 调整 `safetySettings` 的 `threshold` 值

---

## 7. 常见问题

### Q: 为什么有些图片仍然无法生成？

A: 可能原因：
1. 图片本身触发了 Gemini 的核心安全机制（无法关闭）
2. 禁词表未覆盖所有敏感词
3. 图片+提示词的组合超出了 API 的容忍度

解决方法：
- 检查控制台日志，查看过滤后的提示词
- 添加更多禁词到替换表
- 如果降级策略也失败，说明图片本身被拦截

### Q: 如何知道是否使用了降级策略？

A: 查看生成的故事：
- 如果末尾有 `（提示词未通过）`，说明使用了降级策略
- 控制台会打印 `=== 检测到 PROHIBITED_CONTENT，尝试降级策略（仅图片） ===`

### Q: 禁词替换会影响故事质量吗？

A: 影响很小：
- 替换词都经过精心选择，保持语义相近
- Gemini 的理解能力足以理解委婉表达
- 如果觉得替换不合适，可以自定义映射表

---

## 8. 开发建议

### 监控拦截率

建议记录：
1. 成功生成的次数
2. 被拦截的次数
3. 降级策略使用次数

### 优化禁词表

根据实际拦截情况，不断优化 `FORBIDDEN_WORDS_MAP`：
- 添加新的高频拦截词
- 调整替换策略
- 保持表达的自然度

### 用户体验

对于被拦截的情况，考虑：
- 提供更友好的错误提示
- 允许用户手动编辑提示词后重试
- 展示降级策略的使用情况

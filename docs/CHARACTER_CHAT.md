# 与画中人对话

在已有 AI 故事的基础上，可与「画中角色」进行有限轮次、氛围向的对话。角色会以第一人称、结合当前图片与故事设定回复。

---

## 功能说明

- **入口**：在图片详情弹窗右侧，通过 Tab 切换「故事」与「对话」。选「对话」后即可输入想对画中人说的话。
- **上下文**：后端使用该图的**图片**与**故事**（若有）作为角色设定；无故事时，角色仅根据画面自由发挥。
- **历史**：对话历史仅保存在当前弹窗的组件状态中，关闭弹窗即清空；再次打开同一张图会开始全新对话。
- **限制**：支持 `AI_PROVIDER=gemini` 或 `AI_PROVIDER=openai`；使用 OpenAI 时需选用支持视觉的模型（如 gpt-4o）。对话历史由前端维护并随请求发送，服务端无状态。

---

## API 约定

### 与画中人对话

**端点**: `POST /api/images/:id/chat`

**路径参数**:
- `id` (string): 图片 ID

**请求体**:

| 字段 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `message` | string | 是 | 用户本条消息（非空） |
| `history` | array | 否 | 此前对话历史，每项 `{ role: 'user' \| 'model', text: string }`，最多建议 20 条 |

**响应格式**:

```json
{
  "reply": "角色回复的文本"
}
```

**错误**:
- `400`: `message` 缺失或为空
- `404`: 图片不存在
- `500`: 服务端或 AI 调用失败（含未配置密钥、OpenAI 模型不支持视觉等）

**示例请求**:

```bash
POST /api/images/image_001.png_1738233600000/chat
Content-Type: application/json

{
  "message": "你此刻在想什么？",
  "history": [
    { "role": "user", "text": "你好" },
    { "role": "model", "text": "……你好。雨还没停。" }
  ]
}
```

---

## 实现要点

- **服务层**：根据 `AI_PROVIDER` 调用 [geminiService.ts](../services/geminiService.ts) 或 [openaiService.ts](../services/openaiService.ts) 的 `chatAsCharacter`，系统指令注入「画中角色 + 故事」设定，多轮为图片 + 历史 + 新用户消息。
- **前端**：[components/DetailModal.tsx](../components/DetailModal.tsx) 中通过 `rightPanelTab` 切换「故事」与「对话」块，`chatMessages` 仅存于组件 state，发送时将 `message` 与 `history` 传给上述 API。

/**
 * Shared prompt templates for AI services.
 * Both geminiService and openaiService import from here.
 */

/** Build the system instruction for character-chat ("画中人对话"). */
export function buildChatSystemInstruction(story: string | undefined): string {
  const storyBlock = story && story.trim()
    ? `以下是这幅画的背景故事：\n\n${story.trim()}`
    : '（没有预设故事，请仅根据画面自由发挥，想象你是画中的角色。）';
  return `你是这张画中的角色，用第一人称与用户对话。${storyBlock}

回复时请同时加上动作或场景描述。格式要求：说话内容放在引号中（如「」或""），动作、神态、场景放在小括号（）中。例如：「……你好。」（她微微侧过头，望向窗外的雨。）保持简短、有氛围，一两句话即可，不要脱离角色。`;
}

/** Default system prompt fallback when no config file exists. */
export const DEFAULT_SYSTEM_PROMPT =
  '你是一位擅长视觉美学与叙事艺术的"沉浸式微小说家"。根据画面和提示词创作简短的故事。';

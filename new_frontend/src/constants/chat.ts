import { Model } from '@/types/chat';

export const MODELS: Model[] = [
  { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', contextLength: 8192, icon: '🤖' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI', contextLength: 128000, icon: '⚡' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI', contextLength: 16385, icon: '💬' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic', contextLength: 200000, icon: '🧠' },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic', contextLength: 200000, icon: '💎' },
] as const;

export const SUGGESTIONS = [
  '写一篇关于 AI 的文章',
  '解释量子计算',
  '帮我写一段 Python 代码',
  '翻译这段文字',
] as const;

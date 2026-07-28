// Canvas 中环绕的大模型节点。icon 指向 public/models 下的本地 SVG。
export interface ModelNode {
  id: string
  name: string
  icon: string
}

export const MODEL_NODES: ModelNode[] = [
  { id: 'claude', name: 'Claude', icon: '/models/claude-color.svg' },
  { id: 'openai', name: 'GPT', icon: '/models/openai.svg' },
  { id: 'gemini', name: 'Gemini', icon: '/models/gemini-color.svg' },
  { id: 'deepseek', name: 'DeepSeek', icon: '/models/deepseek-color.svg' },
  { id: 'qwen', name: 'Qwen', icon: '/models/qwen-color.svg' },
  { id: 'grok', name: 'Grok', icon: '/models/grok.svg' },
  { id: 'kimi', name: 'Kimi', icon: '/models/kimi-color.svg' },
  { id: 'zhipu', name: 'GLM', icon: '/models/zhipu-color.svg' },
  { id: 'doubao', name: '豆包', icon: '/models/doubao-color.svg' },
  { id: 'minimax', name: 'MiniMax', icon: '/models/minimax-color.svg' },
  { id: 'hunyuan', name: '混元', icon: '/models/hunyuan-color.svg' },
  { id: 'mistral', name: 'Mistral', icon: '/models/mistral-color.svg' },
]

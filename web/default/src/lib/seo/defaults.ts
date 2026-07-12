export function defaultSeoDescription(lang?: string): string {
  const l = (lang || '').toLowerCase()
  if (l.startsWith('zh')) {
    return '统一的 AI 模型网关与管理平台，支持 OpenAI / Claude / Gemini 兼容接口。'
  }
  return 'Unified AI API gateway and admin dashboard with OpenAI / Claude / Gemini compatible APIs.'
}

export function defaultSeoKeywords(lang?: string): string {
  const l = (lang || '').toLowerCase()
  if (l.startsWith('zh')) {
    return 'AI API,大模型网关,OpenAI兼容,Claude,Gemini,New API'
  }
  return 'AI API, LLM Gateway, OpenAI Compatible, Claude, Gemini, New API'
}

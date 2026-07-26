export function defaultSeoDescription(lang?: string): string {
  const l = (lang || '').toLowerCase()
  if (l.startsWith('zh')) {
    return '统一的 AI 模型网关与管理平台，支持 OpenAI / Claude / Gemini 兼容接口，集中管理多模型 API 密钥、渠道分发与用量计费。'
  }
  return 'Unified AI API gateway and admin dashboard with OpenAI / Claude / Gemini compatible APIs, multi-channel routing, key management and usage billing.'
}

export function defaultSeoKeywords(lang?: string): string {
  const l = (lang || '').toLowerCase()
  if (l.startsWith('zh')) {
    return 'AI API,大模型API,LLM网关,OpenAI兼容接口,Claude API,Gemini API,API聚合分发,模型管理,New API'
  }
  return 'AI API, LLM API Gateway, OpenAI Compatible API, Claude API, Gemini API, model aggregation, API distribution, New API'
}

export function defaultSeoTitleSuffix(lang?: string): string {
  const l = (lang || '').toLowerCase()
  if (l.startsWith('zh')) {
    return 'AI大模型API网关|OpenAI/Claude/Gemini兼容|统一接口管理与分发平台'
  }
  return 'AI LLM API Gateway | OpenAI Claude Gemini Compatible | Unified Model Hub'
}

/** Build final document title with optional long-tail suffix. */
export function buildDocumentTitle(input: {
  fullTitle?: string
  title?: string
  titleSuffix?: string
  lang?: string
}): string {
  const full = (input.fullTitle || '').trim()
  if (full) return full
  const name = (input.title || '').trim() || 'New API'
  const suffix =
    (input.titleSuffix || '').trim() || defaultSeoTitleSuffix(input.lang)
  if (!suffix) return name
  // Avoid double-appending if title already contains the suffix
  if (name.includes(suffix) || suffix.includes(name)) return name
  return `${name} - ${suffix}`
}

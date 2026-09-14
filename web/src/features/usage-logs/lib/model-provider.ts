/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
// Reference-price currencies follow this site's domestic/overseas pricing convention.
// Family recognition is not verification of a provider's official price.
export interface ModelProvider {
  referenceCurrency: 'CNY' | 'USD'
  icon: string
  label: string
}

// Fixed conversion for official-price comparisons; independent of wallet billing.
export const OFFICIAL_PRICE_USD_TO_CNY = 6.75

export function resolveModelProvider(
  modelName: string,
  vendorName?: string
): ModelProvider | null {
  return (
    resolveProviderIdentifier(modelName, false) ??
    (vendorName ? resolveProviderIdentifier(vendorName, true) : null)
  )
}

function resolveProviderIdentifier(
  identifier: string,
  includeVendorLabels: boolean
): ModelProvider | null {
  const model = identifier.toLowerCase()
  const hasAny = (keywords: string[]) =>
    keywords.some((keyword) => model.includes(keyword))
  const isVendor = (keywords: string[]) =>
    includeVendorLabels && hasAny(keywords)

  if (
    hasAny([
      'gpt-',
      'chatgpt-',
      'text-embedding-',
      'omni-moderation',
      'dall-e',
      'whisper',
      'tts-',
    ]) ||
    /\bo[134](?:-|$)/.test(model) ||
    isVendor(['openai'])
  ) {
    return { icon: 'OpenAI.Color', label: 'OpenAI', referenceCurrency: 'USD' }
  }
  if (hasAny(['claude-', 'anthropic']) || isVendor(['claude'])) {
    return { icon: 'Claude.Color', label: 'Claude', referenceCurrency: 'USD' }
  }
  if (hasAny(['gemini-', 'learnlm-']) || isVendor(['google'])) {
    return { icon: 'Gemini.Color', label: 'Gemini', referenceCurrency: 'USD' }
  }
  if (hasAny(['grok-', 'xai-']) || isVendor(['xai'])) {
    return { icon: 'Grok.Color', label: 'Grok', referenceCurrency: 'USD' }
  }
  if (hasAny(['deepseek-']) || isVendor(['deepseek'])) {
    return {
      icon: 'DeepSeek.Color',
      label: 'DeepSeek',
      referenceCurrency: 'CNY',
    }
  }
  if (hasAny(['qwen', 'qwq-']) || isVendor(['alibaba', 'tongyi'])) {
    return { icon: 'Qwen.Color', label: 'Qwen', referenceCurrency: 'CNY' }
  }
  if (hasAny(['doubao-', 'volcengine']) || isVendor(['doubao'])) {
    return { icon: 'Doubao.Color', label: 'Doubao', referenceCurrency: 'CNY' }
  }
  if (hasAny(['moonshot-', 'kimi-']) || isVendor(['moonshot'])) {
    return {
      icon: 'Moonshot.Color',
      label: 'Moonshot',
      referenceCurrency: 'CNY',
    }
  }
  if (hasAny(['minimax', 'abab'])) {
    return { icon: 'Minimax.Color', label: 'MiniMax', referenceCurrency: 'CNY' }
  }
  if (
    hasAny(['glm-', 'chatglm', 'cogview', 'cogvideo']) ||
    isVendor(['zhipu'])
  ) {
    return { icon: 'Zhipu.Color', label: 'Zhipu', referenceCurrency: 'CNY' }
  }
  if (hasAny(['mimo-']) || isVendor(['xiaomi'])) {
    return { icon: 'XiaomiMiMo', label: 'MiMo', referenceCurrency: 'CNY' }
  }
  if (hasAny(['ernie']) || isVendor(['baidu'])) {
    return { icon: 'Wenxin.Color', label: 'Baidu', referenceCurrency: 'CNY' }
  }
  if (hasAny(['spark']) || isVendor(['iflytek'])) {
    return { icon: 'Spark.Color', label: 'iFlyTek', referenceCurrency: 'CNY' }
  }
  if (hasAny(['hunyuan']) || isVendor(['tencent'])) {
    return { icon: 'Hunyuan.Color', label: 'Tencent', referenceCurrency: 'CNY' }
  }
  if (hasAny(['baichuan'])) {
    return {
      icon: 'Baichuan.Color',
      label: 'Baichuan',
      referenceCurrency: 'CNY',
    }
  }
  if (hasAny(['internlm'])) {
    return {
      icon: 'InternLM.Color',
      label: 'InternLM',
      referenceCurrency: 'CNY',
    }
  }
  if (hasAny(['step-']) || isVendor(['stepfun'])) {
    return { icon: 'Stepfun.Color', label: 'StepFun', referenceCurrency: 'CNY' }
  }
  if (hasAny(['yi-']) || isVendor(['lingyi'])) {
    return { icon: 'Yi.Color', label: 'Yi', referenceCurrency: 'CNY' }
  }
  if (hasAny(['mistral-', 'mixtral-']) || isVendor(['mistral'])) {
    return { icon: 'Mistral.Color', label: 'Mistral', referenceCurrency: 'USD' }
  }
  if (hasAny(['llama-', 'meta-']) || isVendor(['meta'])) {
    return { icon: 'Meta.Color', label: 'Meta', referenceCurrency: 'USD' }
  }
  if (hasAny(['command-', 'cohere-']) || isVendor(['cohere'])) {
    return { icon: 'Cohere.Color', label: 'Cohere', referenceCurrency: 'USD' }
  }

  return null
}

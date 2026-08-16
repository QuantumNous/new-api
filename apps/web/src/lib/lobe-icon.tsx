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
/**
 * LobeHub Icon Loader
 * Dynamically load and render icons from @lobehub/icons
 *
 * Supports:
 * - Basic: "OpenAI", "OpenAI.Color"
 * - Chained properties: "OpenAI.Avatar.type={'platform'}"
 * - Size parameter: getLobeIcon("OpenAI", 20)
 */
import Ai360 from '@lobehub/icons/es/Ai360'
import Anthropic from '@lobehub/icons/es/Anthropic'
import Azure from '@lobehub/icons/es/Azure'
import AzureAI from '@lobehub/icons/es/AzureAI'
import Claude from '@lobehub/icons/es/Claude'
import Cloudflare from '@lobehub/icons/es/Cloudflare'
import Cohere from '@lobehub/icons/es/Cohere'
import DeepSeek from '@lobehub/icons/es/DeepSeek'
import Doubao from '@lobehub/icons/es/Doubao'
import Gemini from '@lobehub/icons/es/Gemini'
import Google from '@lobehub/icons/es/Google'
import Hunyuan from '@lobehub/icons/es/Hunyuan'
import Jimeng from '@lobehub/icons/es/Jimeng'
import Jina from '@lobehub/icons/es/Jina'
import Kling from '@lobehub/icons/es/Kling'
import Midjourney from '@lobehub/icons/es/Midjourney'
import Minimax from '@lobehub/icons/es/Minimax'
import Mistral from '@lobehub/icons/es/Mistral'
import Moonshot from '@lobehub/icons/es/Moonshot'
import NewAPI from '@lobehub/icons/es/NewAPI'
import Ollama from '@lobehub/icons/es/Ollama'
import OpenAI from '@lobehub/icons/es/OpenAI'
import OpenRouter from '@lobehub/icons/es/OpenRouter'
import Perplexity from '@lobehub/icons/es/Perplexity'
import Qwen from '@lobehub/icons/es/Qwen'
import Replicate from '@lobehub/icons/es/Replicate'
import SiliconCloud from '@lobehub/icons/es/SiliconCloud'
import Spark from '@lobehub/icons/es/Spark'
import Suno from '@lobehub/icons/es/Suno'
import Vidu from '@lobehub/icons/es/Vidu'
import Wenxin from '@lobehub/icons/es/Wenxin'
import XAI from '@lobehub/icons/es/XAI'
import Yi from '@lobehub/icons/es/Yi'
import Zhipu from '@lobehub/icons/es/Zhipu'
import type React from 'react'


// Static icon map: replaces import * as LobeIcons from '@lobehub/icons'
// Each brand's default export is assigned by name for tree-shakeable static resolution.
const LOBE_ICONS: Record<string, Record<string, unknown> | React.ComponentType<Record<string, unknown>>> = {
  Ai360, Anthropic, Azure, AzureAI, Claude, Cloudflare, Cohere,
  DeepSeek, Doubao, Gemini, Google, Hunyuan, Jimeng, Jina, Kling,
  Midjourney, Minimax, Mistral, Moonshot, NewAPI, Ollama, OpenAI,
  OpenRouter, Perplexity, Qwen, Replicate, SiliconCloud, Spark, Suno,
  Vidu, Wenxin, XAI, Yi, Zhipu,
}

/**
 * Parse a property value from string to appropriate type
 * @param raw - Raw string value
 * @returns Parsed value (boolean, number, or string)
 */
function parseValue(raw: string | undefined | null): string | number | boolean {
  if (raw == null) return true

  let v = String(raw).trim()

  // Remove curly braces
  if (v.startsWith('{') && v.endsWith('}')) {
    v = v.slice(1, -1).trim()
  }

  // Remove quotes
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1)
  }

  // Boolean
  if (v === 'true') return true
  if (v === 'false') return false

  // Number
  if (/^-?\d+(?:\.\d+)?$/.test(v)) return Number(v)

  // Return as string
  return v
}

/**
 * Get LobeHub icon component by name
 * @param iconName - Icon name/description (e.g., "OpenAI", "OpenAI.Color", "Claude.Avatar")
 * @param size - Icon size (default: 20)
 * @returns Icon component or fallback
 *
 * @example
 * getLobeIcon("OpenAI", 24)
 * getLobeIcon("OpenAI.Color", 20)
 * getLobeIcon("Claude.Avatar.type={'platform'}", 32)
 */
export function getLobeIcon(
  iconName: string | undefined | null,
  size: number = 20
): React.ReactNode {
  if (!iconName || typeof iconName !== 'string') {
    return (
      <div
        className='bg-muted text-muted-foreground flex items-center justify-center rounded-full text-xs font-medium'
        style={{ width: size, height: size }}
      >
        ?
      </div>
    )
  }

  const trimmedName = iconName.trim()
  if (!trimmedName) {
    return (
      <div
        className='bg-muted text-muted-foreground flex items-center justify-center rounded-full text-xs font-medium'
        style={{ width: size, height: size }}
      >
        ?
      </div>
    )
  }

  const segments = trimmedName.split('.')
  const baseKey = segments[0]
  const BaseIcon = LOBE_ICONS[baseKey] as Record<string, unknown> | undefined

  let IconComponent: React.ComponentType<Record<string, unknown>> | undefined
  let propStartIndex: number

  if (BaseIcon && segments.length > 1 && BaseIcon[segments[1]]) {
    IconComponent = BaseIcon[segments[1]] as React.ComponentType<
      Record<string, unknown>
    >
    propStartIndex = 2
  } else {
    IconComponent = LOBE_ICONS[baseKey] as
      | React.ComponentType<Record<string, unknown>>
      | undefined
    propStartIndex = segments.length > 1 && /^[A-Z]/.test(segments[1]) ? 2 : 1
  }

  // Fallback if icon not found
  if (
    !IconComponent ||
    (typeof IconComponent !== 'function' && typeof IconComponent !== 'object')
  ) {
    const firstLetter = trimmedName.charAt(0).toUpperCase()
    return (
      <div
        className='bg-muted text-muted-foreground flex items-center justify-center rounded-full text-xs font-medium'
        style={{ width: size, height: size }}
      >
        {firstLetter}
      </div>
    )
  }

  // Parse chained properties (e.g., "type={'platform'}", "shape='square'")
  const props: Record<string, string | number | boolean> = {}

  for (let i = propStartIndex; i < segments.length; i++) {
    const seg = segments[i]
    if (!seg) continue

    const eqIdx = seg.indexOf('=')
    if (eqIdx === -1) {
      props[seg.trim()] = true
      continue
    }

    const key = seg.slice(0, eqIdx).trim()
    const valRaw = seg.slice(eqIdx + 1).trim()
    props[key] = parseValue(valRaw)
  }

  // Set size if not explicitly specified in the string
  if (props.size == null && size != null) {
    props.size = size
  }

  return <IconComponent {...props} />
}

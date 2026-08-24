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
 * Compute product-line catalog (user-facing).
 *
 * WHITELABEL: this catalog is deliberately provider-agnostic. It names the
 * model, the GPU class and a flatkey price — never the upstream marketplace,
 * host or engine that actually serves it. Strings marked as i18n keys are the
 * English source string; render them through `t(...)`.
 */

/** Public serverless endpoint every compute model is reached through. */
export const COMPUTE_API_BASE = 'https://router.flatkey.ai/v1'

export type ComputeCategory = 'llm' | 'image' | 'audio' | 'video' | 'custom'
type ComputeStatus = 'ready' | 'soon'

export interface ComputeModel {
  /** Model id sent as the `model` field — already whitelabel-branded. */
  id: string
  name: string
  category: ComputeCategory
  /** Emoji shown on the catalog card. */
  icon: string
  /** i18n key (English source). */
  descriptionKey: string
  /** Display price, e.g. `$0.20`. Illustrative until calibrated. */
  price: string
  /** i18n key for the price unit, e.g. `/1M tokens`. */
  priceUnitKey: string
  status: ComputeStatus
  recommended?: boolean
}

export const COMPUTE_CATEGORIES: { value: ComputeCategory | 'all'; labelKey: string; icon: string }[] =
  [
    { value: 'all', labelKey: 'All', icon: '' },
    { value: 'llm', labelKey: 'Chat LLM', icon: '💬' },
    { value: 'image', labelKey: 'Image', icon: '🎨' },
    { value: 'audio', labelKey: 'Audio', icon: '🎙️' },
    { value: 'video', labelKey: 'Video', icon: '🎬' },
  ]

export const COMPUTE_MODELS: ComputeModel[] = [
  {
    id: 'flatkey-compute-fast',
    name: 'flatkey-compute-fast',
    category: 'llm',
    icon: '💬',
    descriptionKey:
      '7B-class open chat model. Sub-second responses for support, summarisation and batch jobs.',
    price: '$0.20',
    priceUnitKey: '/1M tokens',
    status: 'ready',
    recommended: true,
  },
  {
    id: 'flatkey-compute-pro',
    name: 'flatkey-compute-pro',
    category: 'llm',
    icon: '💬',
    descriptionKey:
      '32B-class reasoning model. Stronger code and multi-step reasoning for agents and analysis.',
    price: '$0.80',
    priceUnitKey: '/1M tokens',
    status: 'soon',
  },
  {
    id: 'flux-image',
    name: 'flux-image',
    category: 'image',
    icon: '🎨',
    descriptionKey:
      'High-quality text-to-image. ~3s per 1024² render for product shots, posters and thumbnails.',
    price: '$0.02',
    priceUnitKey: '/image',
    status: 'soon',
  },
  {
    id: 'whisper-turbo',
    name: 'whisper-turbo',
    category: 'audio',
    icon: '🎙️',
    descriptionKey:
      'Speech-to-text in 99 languages, 8× faster than real time. Podcasts, meetings, subtitles.',
    price: '$0.006',
    priceUnitKey: '/minute',
    status: 'soon',
  },
  {
    id: 'video-gen',
    name: 'video-gen',
    category: 'video',
    icon: '🎬',
    descriptionKey:
      'Image-to-video and text-to-video. 5s clips for ads, shorts and B-roll.',
    price: '$0.15',
    priceUnitKey: '/second',
    status: 'soon',
  },
]

export interface GpuOption {
  id: string
  /** GPU chip class — a spec, not a vendor. */
  name: string
  vram: string
  /** i18n key describing what this GPU is good for. */
  goodForKey: string
  throughput: string
  context: string
  /** i18n key or literal value for cold start. */
  coldStartKey: string
  /** Per-token price for the serverless model on this GPU. Illustrative. */
  price: string
  priceUnitKey: string
  availability: 'high' | 'low'
  recommended?: boolean
}

export const GPU_OPTIONS: GpuOption[] = [
  {
    id: 'rtx4090',
    name: 'RTX 4090',
    vram: '24 GB',
    goodForKey: 'Good for 7B chat, support and batch',
    throughput: '~60 tok/s',
    context: '32K',
    coldStartKey: '~15s',
    price: '$0.20',
    priceUnitKey: '/1M tokens',
    availability: 'high',
    recommended: true,
  },
  {
    id: 'rtx5090',
    name: 'RTX 5090',
    vram: '32 GB',
    goodForKey: 'Good for longer context and faster output',
    throughput: '~110 tok/s',
    context: '128K',
    coldStartKey: '~10s',
    price: '$0.28',
    priceUnitKey: '/1M tokens',
    availability: 'high',
  },
  {
    id: 'h100',
    name: 'H100 SXM',
    vram: '80 GB',
    goodForKey: 'Good for high-concurrency production, always-on',
    throughput: '~240 tok/s',
    context: '128K',
    coldStartKey: 'Always-on',
    price: '$0.55',
    priceUnitKey: '/1M tokens',
    availability: 'low',
  },
]

// GPU instance rental now uses live upstream offers (see features/compute-deploy/api.ts:
// getComputeOffers). The former static preview list was removed with the real
// GpuInstances implementation.

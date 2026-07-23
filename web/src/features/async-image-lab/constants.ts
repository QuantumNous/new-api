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
import type { StatusBadgeProps } from '@/components/status-badge'

import type {
  AsyncExecutionStatus,
  AsyncImageFormValues,
  AsyncImageModel,
} from './types'

interface AsyncModelConfig {
  label: string
  description: string
  sizeLabel: string
  sizes: readonly string[]
  qualities: readonly string[]
  defaultSize: string
  defaultQuality: string
}

export const ASYNC_MODEL_CONFIGS: Record<AsyncImageModel, AsyncModelConfig> = {
  'gemini-3.1-flash-image-preview': {
    label: 'Gemini 3.1 Flash',
    description: 'Fast preview generation',
    sizeLabel: 'Aspect ratio',
    sizes: ['1:1', '16:9', '9:16'],
    qualities: ['1K', '2K', '4K'],
    defaultSize: '1:1',
    defaultQuality: '1K',
  },
  'gemini-3-pro-image-preview': {
    label: 'Gemini 3 Pro',
    description: 'Higher-detail preview generation',
    sizeLabel: 'Aspect ratio',
    sizes: ['1:1', '16:9', '9:16'],
    qualities: ['1K', '2K', '4K'],
    defaultSize: '1:1',
    defaultQuality: '1K',
  },
  'gpt-image-2': {
    label: 'GPT Image 2',
    description: 'OpenAI-compatible image generation',
    sizeLabel: 'Image size',
    sizes: ['1024x1024', '1536x1024', '1024x1536'],
    qualities: ['low', 'medium', 'high'],
    defaultSize: '1024x1024',
    defaultQuality: 'low',
  },
  'gpt-image-2-vip': {
    label: 'GPT Image 2 VIP',
    description: 'GRS AI high-resolution generation',
    sizeLabel: 'Image size',
    sizes: ['1024x1024'],
    qualities: ['standard'],
    defaultSize: '1024x1024',
    defaultQuality: 'standard',
  },
  'nano-banana-pro': {
    label: 'Nano Banana Pro',
    description: 'High-detail GRS AI generation',
    sizeLabel: 'Aspect ratio',
    sizes: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    qualities: ['1K', '2K', '4K'],
    defaultSize: '1:1',
    defaultQuality: '1K',
  },
  'nano-banana-2-lite': {
    label: 'Nano Banana 2 Lite',
    description: 'Cost-efficient GRS AI generation',
    sizeLabel: 'Aspect ratio',
    sizes: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    qualities: ['auto'],
    defaultSize: '1:1',
    defaultQuality: 'auto',
  },
  'nano-banana-2': {
    label: 'Nano Banana 2',
    description: 'Balanced GRS AI generation',
    sizeLabel: 'Aspect ratio',
    sizes: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    qualities: ['1K', '2K', '4K'],
    defaultSize: '1:1',
    defaultQuality: '1K',
  },
  'nano-banana-fast': {
    label: 'Nano Banana Fast',
    description: 'Fast GRS AI generation',
    sizeLabel: 'Aspect ratio',
    sizes: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    qualities: ['auto'],
    defaultSize: '1:1',
    defaultQuality: 'auto',
  },
}

export const ASYNC_IMAGE_DEFAULT_VALUES: AsyncImageFormValues = {
  model: 'gpt-image-2',
  tokenId: '',
  prompt: '',
  size: ASYNC_MODEL_CONFIGS['gpt-image-2'].defaultSize,
  quality: ASYNC_MODEL_CONFIGS['gpt-image-2'].defaultQuality,
}

export const TERMINAL_ASYNC_STATUSES = new Set<AsyncExecutionStatus>([
  'success',
  'failure',
  'uncertain',
  'cancelled',
])

export const ASYNC_STATUS_CONFIG: Record<
  AsyncExecutionStatus,
  { label: string; variant: StatusBadgeProps['variant'] }
> = {
  queued: { label: 'Queued', variant: 'neutral' },
  running: { label: 'Running', variant: 'info' },
  success: { label: 'Success', variant: 'success' },
  failure: { label: 'Failed', variant: 'danger' },
  uncertain: { label: 'Uncertain', variant: 'warning' },
  cancelled: { label: 'Cancelled', variant: 'neutral' },
}

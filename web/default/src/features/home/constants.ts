/**
 * Home page constants — AIKanHub video gen focus
 */
import { type TFunction } from 'i18next'

export const MAIN_BASE_CLASSES = 'bg-background text-foreground w-full'

// Models we actually have / plan to have
export const VIDEO_MODELS = [
  { id: 'seedance-2-0', label: 'Seedance 2.0', status: 'available' },
  { id: 'seedance-2-0-fast', label: 'Seedance 2.0 fast', status: 'available' },
  { id: 'pixverse-v5-5', label: 'Pixverse v5.5', status: 'planned' },
  { id: 'happyhorse', label: 'HappyHorse', status: 'planned' },
] as const

// Capability pills shown in the gateway card
export const GATEWAY_FEATURES = [
  '文生视频',
  '图生视频',
  '首尾帧控制',
  '多模态参考',
  '有声视频',
  '异步任务',
  '透明计费',
  'OpenAI 风格鉴权',
] as const

export function getGatewayFeatures(t: TFunction) {
  return GATEWAY_FEATURES.map((feature) => t(feature))
}

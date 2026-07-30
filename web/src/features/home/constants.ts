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
 * Home page constants
 * All hardcoded data for home page sections
 */
import type { TFunction } from 'i18next'

// Layout - Main base classes
export const MAIN_BASE_CLASSES = 'bg-background text-foreground w-full'

// Hero section - AI Applications (Left side)
export const AI_APPLICATIONS = [
  'LobeHub.Color',
  'Dify.Color',
  'OpenWebUI',
  'Cline',
] as const

// Hero section - AI Models (Right side)
export const AI_MODELS = [
  'Qwen.Color',
  'DeepSeek.Color',
  'Doubao.Color',
  'OpenAI',
  'Claude.Color',
  'Gemini.Color',
] as const

// Hero section - Gateway Features
export const GATEWAY_FEATURES = [
  'OpenAI-Compatible API',
  'Model Routing',
  'API Key Management',
  'Channel Management',
  'Usage Monitoring',
  'Quota Controls',
  'Role-Based Access',
  'Self-Hosted Deployment',
] as const

// Stats section - Capability labels (avoid unverified instance-wide counts)
export const DEFAULT_STATS = [
  {
    value: '01',
    suffix: '',
    description: '统一接入入口',
  },
  {
    value: '24/7',
    suffix: '',
    description: '自托管控制台',
  },
  {
    value: 'API',
    suffix: '',
    description: '兼容 OpenAI 协议',
  },
  {
    value: 'N',
    suffix: '',
    description: '按配置扩展渠道',
  },
] as const

// Features section - ReX API capabilities
export const DEFAULT_FEATURES = [
  {
    title: '统一接入',
    description: '通过兼容 OpenAI 的接口连接已配置的模型和上游渠道。',
    iconName: 'Zap',
  },
  {
    title: '密钥可控',
    description: '集中创建、轮换和撤销应用访问密钥，减少凭据散落。',
    iconName: 'Shield',
  },
  {
    title: '路由清晰',
    description: '按模型、渠道和权限组织请求路由，配置由实例管理员掌控。',
    iconName: 'Globe',
  },
  {
    title: '开发友好',
    description: '保留常见 AI 客户端需要的请求格式和流式响应方式。',
    iconName: 'Code',
  },
  {
    title: '运行可见',
    description: '在控制台查看请求、用量、配额以及模型调用表现。',
    iconName: 'Gauge',
  },
  {
    title: '计费可查',
    description: '根据实例中的模型和渠道配置查看价格与消耗记录。',
    iconName: 'DollarSign',
  },
  {
    title: '团队协作',
    description: '使用用户、角色和权限控制不同成员的操作范围。',
    iconName: 'Users',
  },
  {
    title: '自主部署',
    description: '将网关、数据和配套服务部署在你控制的环境中。',
    iconName: 'HeartHandshake',
  },
] as const

export function getGatewayFeatures(t: TFunction) {
  return GATEWAY_FEATURES.map((feature) => t(feature))
}

export function getDefaultStats(t: TFunction) {
  return DEFAULT_STATS.map((stat) => ({
    ...stat,
    description: stat.description ? t(stat.description) : undefined,
  }))
}

export function getDefaultFeatures(t: TFunction) {
  return DEFAULT_FEATURES.map((feature) => ({
    ...feature,
    title: t(feature.title),
    description: t(feature.description),
  }))
}

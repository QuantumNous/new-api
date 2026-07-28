/* ==================== chat ==================== */

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: number
  role: ChatRole
  content: string
  createdAt: number
}

export interface ChatConversation {
  id: string
  title: string
  updatedAt: number
  pinned?: boolean
  preview: string
  messages: ChatMessage[]
}

/** Suggested model quick-picks shown under the composer (mirrors design 图1). */
export interface LabModelPick {
  id: string
  name: string
  vendor: string
  badge?: string
}

/** Starter prompt cards on the chat landing (design 图1 "为你推荐"). */
export interface LabStarter {
  id: string
  title: string
  desc: string
  icon: 'spark' | 'doc' | 'chart' | 'code' | 'globe' | 'image'
}

/* ==================== studio (image + video) ==================== */

export type StudioKind = 'image' | 'video'

export interface StudioWork {
  id: number
  kind: StudioKind
  prompt: string
  model: string
  ratio: string
  cover: string
  width: number // intrinsic tile ratio driver for masonry
  height: number
  duration?: number // seconds, video only
}

/** Quick-tool shortcuts on the studio page (design 图10 second row). */
export interface StudioTool {
  id: string
  labelKey: string
  icon: string // lucide 24x24 path
}

/* ==================== assets ==================== */

export type AssetKind = 'doc' | 'image' | 'video' | 'code' | 'sheet'

export type AssetSource = 'chat' | 'studio' | 'upload'

export interface AssetItem {
  id: number
  name: string
  kind: AssetKind
  source: AssetSource
  size: number // bytes
  cover?: string // media only
  updatedAt: number
}

/* ==================== notes ==================== */

export interface NoteItem {
  id: string
  title: string
  excerpt: string
  tags: string[]
  updatedAt: number
}

/* ==================== plugins ==================== */

export type PluginTab = 'plugins' | 'mcp' | 'skills' | 'market'

export type PluginCategory = 'featured' | 'productivity' | 'ai' | 'data'

export interface PluginItem {
  id: string
  name: string
  desc: string
  /** lucide 24x24 path for fallback icon when no cover color */
  icon: string
  /** Deterministic seed color pair for the icon tile */
  color: string
  enabled: boolean
  installed: boolean
}

export interface McpServer {
  id: string
  name: string
  desc: string
  connected: boolean
  enabled: boolean
}

export interface SkillItem {
  id: string
  name: string
  desc: string
  icon: string
  color: string
  active: boolean
}

export interface MarketPlugin {
  id: string
  name: string
  desc: string
  icon: string
  color: string
  category: PluginCategory
  installs: number
}

export type CommunityCategory =
  'illustration' | 'poster' | 'photo' | '3d' | 'video'

export interface CommunityWork {
  id: number
  title: string
  author: string
  category: CommunityCategory
  cover: string
  width: number
  height: number
  likes: number
  featured?: boolean
}

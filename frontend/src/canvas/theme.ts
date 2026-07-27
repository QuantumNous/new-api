import { normalizeOpaqueColor } from '@/utils/cssColor'

/**
 * Palette used by the canvas scene. Light keeps its protected Desert Ledger
 * values. Night resolves its structural colours from the same semantic CSS
 * tokens as the DOM; vendor overrides remain explicit brand-colour exceptions.
 */
export type CanvasThemeName = 'light' | 'dark'

export interface CanvasTheme {
  name: CanvasThemeName
  backgroundTop: string
  backgroundBottom: string
  mapLand: string
  mapHighlight: string
  mapOcean: string
  mapLabel: string
  mapFlow: string
  mapRipple: string
  mapGlyph: string
  mapGlyphAccent: string
  mapCursorGlow: string
  mapCursorRing: string
  modelFallback: string
  modelColorOverrides: Readonly<Record<string, string>>
  charRain: string
  charRainLead: string
  nodeSurface: string
  nodeLabelSurface: string
  nodeLabelText: string
  userAccent: string
  userCore: string
  hubHalo: string
  hubSurface: string
  hubOrbitPrimary: string
  hubOrbitSecondary: string
  hubOrbitCore: string
  hubRing: string
  hubLabel: string
  channelStroke: string
  channelGlow: string
  channelPacket: string
  channelCore: string
  responsePacket: string
  packetCore: string
  accent: string
  glowComposite: GlobalCompositeOperation
}

const CANVAS_THEMES: Record<CanvasThemeName, CanvasTheme> = {
  // One Night：炭蓝深灰为底，画布色盘同步 One Night 令牌体系。
  // 薄荷绿点缀（--glow #8EC8AA）：用户/响应包=薄荷回程、枢纽副轨金绿交替、
  // 字符雨首字符薄荷、涟漪=绿金波光；哑蓝为信号/地图主调。
  dark: {
    name: 'dark',
    backgroundTop: '#181b24',
    backgroundBottom: '#262a34',
    mapLand: '#6a8cb8',
    mapHighlight: '#e2bc55',
    mapOcean: '#1a2236',
    mapLabel: '#98a4c0',
    mapFlow: '#6db897',
    mapRipple: '#8ec8aa',
    mapGlyph: '#a8c4e8',
    mapGlyphAccent: '#e2bc55',
    mapCursorGlow: '#e2bc55',
    mapCursorRing: '#efd27e',
    modelFallback: '#6a8cb8',
    modelColorOverrides: {},
    charRain: '#364f72',
    charRainLead: '#8ec8aa',
    nodeSurface: '#2e3240',
    nodeLabelSurface: '#181b24',
    nodeLabelText: '#dee3f0',
    userAccent: '#8ec8aa',
    userCore: '#b8e8d0',
    hubHalo: '#364f72',
    hubSurface: '#181b24',
    hubOrbitPrimary: '#e2bc55',
    hubOrbitSecondary: '#8ec8aa',
    hubOrbitCore: '#f5e49c',
    hubRing: '#e2bc55',
    hubLabel: '#dee3f0',
    channelStroke: '#e2bc55',
    channelGlow: '#e2bc55',
    channelPacket: '#f5e49c',
    channelCore: '#fffae8',
    responsePacket: '#8ec8aa',
    packetCore: '#ffffff',
    accent: '#e2bc55',
    glowComposite: 'lighter',
  },
  // Desert Ledger：暖米白纸面为底，点阵=橄榄墨点，航线/数据包=焦糖批注。
  // 草甸绿点缀（田园航拍：草甸中绿/树篱深绿/麦茬金）：用户=田间人影、
  // 响应包=牧绿回程、枢纽副轨焦糖绿交替、字符雨首字符新绿、涟漪=草浪、流尾=青绿水痕。
  light: {
    name: 'light',
    backgroundTop: '#F6F3EB',
    backgroundBottom: '#ECE6D4',
    mapLand: '#74765A',
    mapHighlight: '#D8984C',
    mapOcean: '#C2BCA6',
    mapLabel: '#827E66',
    mapFlow: '#6FA894',
    mapRipple: '#7FA463',
    mapGlyph: '#5C5E45',
    mapGlyphAccent: '#A87643',
    mapCursorGlow: '#D8984C',
    mapCursorRing: '#C08B57',
    modelFallback: '#A98C4E',
    modelColorOverrides: {
      claude: '#C2620A',
      openai: '#0F7A5C',
      gemini: '#2F6BD8',
      deepseek: '#3D57D6',
      qwen: '#7547D1',
      grok: '#5B6470',
      kimi: '#0E7C8C',
      zhipu: '#2F49CC',
      doubao: '#2E66C8',
      minimax: '#C4454B',
      hunyuan: '#0E8496',
      mistral: '#9A6700',
    },
    charRain: '#B2B598',
    charRainLead: '#5F7D47',
    nodeSurface: '#FFFDF8',
    nodeLabelSurface: '#F6F3EB',
    nodeLabelText: '#38372B',
    userAccent: '#7FA463',
    userCore: '#5F7D47',
    hubHalo: '#E4C276',
    hubSurface: '#FFFDF8',
    hubOrbitPrimary: '#D8984C',
    hubOrbitSecondary: '#7FA463',
    hubOrbitCore: '#A87643',
    hubRing: '#C08B57',
    hubLabel: '#38372B',
    channelStroke: '#A87643',
    channelGlow: '#D8984C',
    channelPacket: '#C08B57',
    channelCore: '#38372B',
    responsePacket: '#5F7D47',
    packetCore: '#38372B',
    accent: '#D8984C',
    glowComposite: 'source-over',
  },
}

function resolveNightToken(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  return normalizeOpaqueColor(value, fallback)
}

export function getCanvasTheme(name: CanvasThemeName): CanvasTheme {
  const fallback = CANVAS_THEMES[name]
  if (name === 'light') return fallback

  return {
    ...fallback,
    backgroundTop: resolveNightToken(
      '--surface-container-lowest',
      fallback.backgroundTop
    ),
    backgroundBottom: resolveNightToken(
      '--page-background',
      fallback.backgroundBottom
    ),
    mapLand: resolveNightToken('--signal', fallback.mapLand),
    mapHighlight: resolveNightToken('--accent', fallback.mapHighlight),
    mapOcean: resolveNightToken('--signal-deep', fallback.mapOcean),
    mapLabel: resolveNightToken('--text-secondary', fallback.mapLabel),
    mapFlow: resolveNightToken('--glow-strong', fallback.mapFlow),
    mapRipple: resolveNightToken('--glow', fallback.mapRipple),
    mapGlyph: resolveNightToken('--signal-bright', fallback.mapGlyph),
    mapGlyphAccent: resolveNightToken('--accent', fallback.mapGlyphAccent),
    mapCursorGlow: resolveNightToken('--accent', fallback.mapCursorGlow),
    mapCursorRing: resolveNightToken('--focus-ring', fallback.mapCursorRing),
    modelFallback: resolveNightToken('--signal', fallback.modelFallback),
    charRain: resolveNightToken('--signal-strong', fallback.charRain),
    charRainLead: resolveNightToken('--glow', fallback.charRainLead),
    nodeSurface: resolveNightToken('--surface-container', fallback.nodeSurface),
    nodeLabelSurface: resolveNightToken(
      '--surface-container-lowest',
      fallback.nodeLabelSurface
    ),
    nodeLabelText: resolveNightToken('--text-primary', fallback.nodeLabelText),
    userAccent: resolveNightToken('--glow', fallback.userAccent),
    userCore: resolveNightToken('--glow-bright', fallback.userCore),
    hubHalo: resolveNightToken('--signal-strong', fallback.hubHalo),
    hubSurface: resolveNightToken(
      '--surface-container-lowest',
      fallback.hubSurface
    ),
    hubOrbitPrimary: resolveNightToken('--accent', fallback.hubOrbitPrimary),
    hubOrbitSecondary: resolveNightToken('--glow', fallback.hubOrbitSecondary),
    hubOrbitCore: resolveNightToken('--accent-hover', fallback.hubOrbitCore),
    hubRing: resolveNightToken('--accent', fallback.hubRing),
    hubLabel: resolveNightToken('--text-primary', fallback.hubLabel),
    channelStroke: resolveNightToken('--accent', fallback.channelStroke),
    channelGlow: resolveNightToken('--accent', fallback.channelGlow),
    channelPacket: resolveNightToken('--accent-hover', fallback.channelPacket),
    channelCore: resolveNightToken('--text-primary', fallback.channelCore),
    responsePacket: resolveNightToken('--glow', fallback.responsePacket),
    packetCore: resolveNightToken('--on-colored', fallback.packetCore),
    accent: resolveNightToken('--accent', fallback.accent),
  }
}

export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  if (value.length !== 6) return hex
  return `rgba(${parseInt(value.slice(0, 2), 16)},${parseInt(value.slice(2, 4), 16)},${parseInt(value.slice(4, 6), 16)},${alpha})`
}

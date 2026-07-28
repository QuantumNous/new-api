// 首屏「已适配工具」跑马灯。icon 指向 public/integrations 下的本地图标（SVG/PNG）。
// 工具集对齐 ergouapi.com「已适配工具」清单。高亮/未高亮由 IntegrationChip 用 CSS 滤镜切换（同一图标文件）。
export interface Integration {
  id: string
  name: string
  icon: string
}

export const INTEGRATIONS: Integration[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    icon: '/integrations/claude-code.svg',
  },
  { id: 'codex', name: 'Codex', icon: '/integrations/codex.svg' },
  {
    id: 'hermes-agent',
    name: 'Hermes Agent',
    icon: '/integrations/hermes-agent.svg',
  },
  { id: 'trae', name: 'Trae', icon: '/integrations/trae-color.svg' },
  { id: 'cc-switch', name: 'CC Switch', icon: '/integrations/cc-switch.png' },
  {
    id: 'claude-code-router',
    name: 'Claude Code Router',
    icon: '/integrations/claude-code-router.png',
  },
  { id: 'cc-gui', name: 'CC GUI', icon: '/integrations/cc-gui.png' },
  { id: 'cline', name: 'Cline', icon: '/integrations/cline.png' },
  { id: 'continue', name: 'Continue', icon: '/integrations/continue.png' },
  { id: 'roo-code', name: 'Roo Code', icon: '/integrations/roo-code.png' },
  { id: 'kilo-code', name: 'Kilo Code', icon: '/integrations/kilo-code.png' },
  { id: 'aider', name: 'Aider', icon: '/integrations/aider.png' },
]

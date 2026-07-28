// 模型 → 公司总部经纬度。用于把大模型 Logo 钉在平面世界地图对应国家上。
// 同城多模型由 MapScene 做扇形散开，offset 供个别手动微调（像素）。
export interface ModelGeo {
  id: string // 对应 data/models.ts 的 id
  company: string
  city: string
  lat: number
  lon: number
  offset?: { dx: number; dy: number }
}

export const MODEL_GEO: ModelGeo[] = [
  {
    id: 'claude',
    company: 'Anthropic',
    city: '旧金山',
    lat: 37.8,
    lon: -122.4,
  },
  { id: 'openai', company: 'OpenAI', city: '旧金山', lat: 37.8, lon: -122.4 },
  { id: 'gemini', company: 'Google', city: '山景城', lat: 37.4, lon: -122.1 },
  { id: 'grok', company: 'xAI', city: '帕洛阿托', lat: 37.4, lon: -122.1 },
  { id: 'mistral', company: 'Mistral AI', city: '巴黎', lat: 48.9, lon: 2.4 },
  { id: 'deepseek', company: '深度求索', city: '杭州', lat: 30.3, lon: 120.2 },
  { id: 'qwen', company: '阿里', city: '杭州', lat: 30.3, lon: 120.2 },
  { id: 'kimi', company: '月之暗面', city: '北京', lat: 39.9, lon: 116.4 },
  { id: 'zhipu', company: '智谱', city: '北京', lat: 39.9, lon: 116.4 },
  { id: 'doubao', company: '字节跳动', city: '北京', lat: 39.9, lon: 116.4 },
  { id: 'minimax', company: 'MiniMax', city: '上海', lat: 31.2, lon: 121.5 },
  { id: 'hunyuan', company: '腾讯', city: '深圳', lat: 22.5, lon: 114.1 },
]

// 全球人群请求源坐标（散布各大洲，代表"各行各业的用户"）。
export const SOURCE_GEO: { lat: number; lon: number }[] = [
  { lat: 40, lon: -100 }, // 北美中部
  { lat: 34, lon: -84 }, // 美东南
  { lat: 19, lon: -99 }, // 墨西哥城
  { lat: -15, lon: -47 }, // 巴西
  { lat: -34, lon: -58 }, // 布宜诺斯艾利斯
  { lat: 51, lon: 10 }, // 中欧
  { lat: 40, lon: -3 }, // 西班牙
  { lat: 9, lon: 8 }, // 西非
  { lat: -26, lon: 28 }, // 南非
  { lat: 28, lon: 77 }, // 印度北
  { lat: 35, lon: 51 }, // 中东
  { lat: 37, lon: 127 }, // 韩国
  { lat: 1, lon: 104 }, // 新加坡
  { lat: -33, lon: 151 }, // 悉尼
]

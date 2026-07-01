/**
 * 首页模型价格对比配置
 * 您可以在这里自定义显示的模型、价格和公告信息
 */

export interface ModelPricingConfig {
  name: string
  officialInput?: number
  officialOutput?: number
  cacheHit?: string
}

export interface ImageModelPricingTypeConfig {
  type: string
  multiplier: number
  aliases?: string[]
}

export interface ImageModelPricingConfig {
  name: string
  types: ImageModelPricingTypeConfig[]
}

/**
 * 货币单位配置
 * currency: 'USD' | 'CNY' - 美元或人民币
 * symbol: 显示符号，如 '$' 或 '¥'
 */
export const pricingCurrencyConfig = {
  // 货币类型：'USD' 或 'CNY'
  currency: 'USD' as 'USD' | 'CNY',
  // 显示符号
  symbol: '¥',
}

/**
 * 表头标题配置
 * 可自定义各列的显示标题
 */
export const pricingHeaderConfig = {
  model: '模型',
  input: '输入(1M)',
  output: '输出(1M)',
  official: '官方输入/输出(1M)',
  discount: '折扣',
  cacheHit: '缓存命中',
}

export const imagePricingHeaderConfig = {
  model: '模型名称',
  type: '图像类型',
  price: '价格',
}

/**
 * 配置首页需要展示的模型及其官方价格
 * - name: 模型名称
 * - officialInput: 官方输入价格（按 1M token, 单位 USD）
 * - officialOutput: 官方输出价格（按 1M token, 单位 USD）
 * - cacheHit: 缓存命中展示文本
 */
export const modelPricingConfig: ModelPricingConfig[] = [
  {
    name: 'claude-fable-5',
    officialInput: 70,
    officialOutput: 350,
    cacheHit: '>93%',
  },
  {
    name: 'claude-opus-4-8',
    officialInput: 35,
    officialOutput: 175,
    cacheHit: '>93%',
  },
  {
    name: 'claude-opus-4-7',
    officialInput: 35,
    officialOutput: 175,
    cacheHit: '>93%',
  },
  {
    name: 'claude-opus-4-6',
    officialInput: 35,
    officialOutput: 175,
    cacheHit: '>93%',
  },
  {
    name: 'claude-sonnet-5',
    officialInput: 21,
    officialOutput: 105,
    cacheHit: '>93%',
  },
  {
    name: 'claude-sonnet-4-6',
    officialInput: 21,
    officialOutput: 105,
    cacheHit: '>93%',
  },
  {
    name: 'claude-haiku-4-5',
    officialInput: 7,
    officialOutput: 35,
    cacheHit: '>93%',
  },
  {
    name: 'gpt-5.5',
    officialInput: 35,
    officialOutput: 210,
    cacheHit: '>93%',
  },
  {
    name: 'gpt-5.4',
    officialInput: 17.5,
    officialOutput: 105,
    cacheHit: '>93%',
  },
  {
    name: 'gpt-5.3-codex',
    officialInput: 12.25,
    officialOutput: 98,
    cacheHit: '>93%',
  },
]

export const imageModelPricingConfig: ImageModelPricingConfig[] = [
  {
    name: 'gpt-image-2',
    types: [
      {
        type: '1K',
        multiplier: 1,
        aliases: ['gpt-image-2-1k', 'gpt-image-2-1K'],
      },
      {
        type: '2K',
        multiplier: 4,
        aliases: ['gpt-image-2-2k', 'gpt-image-2-2K'],
      },
      {
        type: '4K',
        multiplier: 16,
        aliases: ['gpt-image-2-4k', 'gpt-image-2-4K'],
      },
    ],
  },
]

/**
 * 公告文字配置
 * 您可以自定义价格对比下方的公告内容
 * 支持 HTML 标签（如 <a> 链接）
 */
export const pricingNoticeConfig = {
  // 公告文字内容
  text: '新用户可以0.1元购买1元试用套餐，7天有效，累计消费满500可开发票',
  linkText: '',
  linkUrl: '',
  // 是否显示公告
  enabled: true,
}

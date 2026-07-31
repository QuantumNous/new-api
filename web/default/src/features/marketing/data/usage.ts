export interface UsageItem {
  term: string
  detail: string
}

export interface UsageContent {
  title: string
  description: string
  intro: string
  items: UsageItem[]
  billingNote: string
}

export const usage: Record<'en' | 'zh', UsageContent> = {
  en: {
    title: 'Usage & Billing | OriginFlow',
    description:
      'Understand quota, balance, tokens, and how image/video generation is billed differently from text.',
    intro:
      'OriginFlow bills by actual usage. Here is a plain-language guide to the terms you will see in the console so there are no surprises.',
    items: [
      {
        term: 'Balance',
        detail:
          'The prepaid credits in your account. Requests are deducted from your balance in real time; when it reaches zero, requests stop until you top up.',
      },
      {
        term: 'Quota',
        detail:
          'A cap on how much you can spend or how many requests you can make in a period. Set by you (or your admin) to control cost.',
      },
      {
        term: 'Tokens (text)',
        detail:
          'Text models bill per token — roughly 4 characters per token for English. You are charged for both the prompt (input) and the completion (output) tokens.',
      },
      {
        term: 'Image generation',
        detail:
          'Billed per image, by resolution and model — not by token. A 1024×1024 image costs more than a 512×512 one, regardless of prompt length.',
      },
      {
        term: 'Video / audio',
        detail:
          'Billed by duration (seconds) and model, independently of text tokens. Longer or higher-fidelity output costs more.',
      },
      {
        term: 'Cached tokens',
        detail:
          'When you reuse a long prompt prefix, the cached portion is billed at a lower rate. Reusing system prompts reduces cost.',
      },
    ],
    billingNote:
      'Exact prices follow your console configuration and the selected plan (pay-as-you-go, subscription, or custom enterprise quote). We do not publish model-specific availability or uptime guarantees that we have not verified.',
  },
  zh: {
    title: '用量与计费 | 元点流商 OriginFlow',
    description: '理解额度、余额、Token，以及图片/视频生成与文本不同的计费方式。',
    intro:
      'OriginFlow 按实际用量计费。下面用通俗语言解释你在控制台会看到的术语，避免预期之外的账单。',
    items: [
      {
        term: '余额（Balance）',
        detail: '账户内的预付费额度。请求实时从余额中扣减；余额归零后请求会暂停，直到你充值。',
      },
      {
        term: '额度（Quota）',
        detail: '一段时间内可消费金额或请求次数的上限。由你（或管理员）设置，用于成本控制。',
      },
      {
        term: 'Token（文本）',
        detail:
          '文本模型按 Token 计费——英文约每 4 个字符 1 个 Token。输入（prompt）与输出（completion）均计费。',
      },
      {
        term: '图片生成',
        detail: '按张计费，取决于分辨率与模型，而非 Token。1024×1024 比 512×512 更贵，与提示词长度无关。',
      },
      {
        term: '视频 / 音频',
        detail: '按时长（秒）与模型计费，独立于文本 Token。更长或更高保真的输出更贵。',
      },
      {
        term: '缓存 Token',
        detail: '复用较长提示词前缀时，缓存部分按更低费率计费。复用系统提示词可降低成本。',
      },
    ],
    billingNote:
      '具体价格以控制台配置及所选套餐（按量、订阅或企业定制报价）为准。对于未经核实的模型可用性、可用率等，我们不做承诺。',
  },
}

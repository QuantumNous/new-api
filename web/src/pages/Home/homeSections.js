export const trustMetrics = [
  { key: 'availability', textKey: 'SLA 99.9% \u53ef\u7528\u627f\u8bfa' },
  { key: 'throughput', textKey: '\u767e\u4e07\u4ebf\u7ea7\u8c03\u7528\u89c4\u6a21' },
  { key: 'builders', textKey: '30W+ \u4ea7\u54c1\u4eba\u4fe1\u4efb' },
  { key: 'invoice', textKey: '\u589e\u503c\u7a0e\u4e13\u7528\u53d1\u7968' },
  { key: 'compliance', textKey: '\u516c\u5b89\u5907\u6848\u5b9e\u540d\u8ba4\u8bc1' },
];

export const trustQuoteKey =
  '\u300c\u6211\u4eec\u76f8\u4fe1\uff0c\u900f\u660e\u662f\u6700\u597d\u7684\u8425\u9500\u300d';

export const promiseItems = [
  {
    key: 'real-models',
    icon: 'shield-check',
    titleKey: '\u6a21\u578b\u771f\u5b9e',
    descKey:
      '\u4e0d\u5077\u6881\u6362\u67f1\u3002\u6240\u6709\u7ebf\u8def\u90fd\u7ecf\u8fc7\u771f\u5b9e\u6027\u68c0\u6d4b\uff0c\u4e00\u65e6\u53d1\u73b0\u9020\u5047\u7acb\u5373\u4e0b\u67b6\u3002',
  },
  {
    key: 'transparent-pricing',
    icon: 'coins',
    titleKey: '\u6536\u8d39\u900f\u660e',
    descKey:
      '\u5bf9\u6807\u5b98\u65b9\u4ef7\u683c\uff0c\u660e\u793a\u51e0\u6298\u3002\u4e00\u773c\u770b\u61c2\uff0c\u4e0d\u7ed9\u4f60\u7b97\u590d\u6742\u7684\u590d\u5408\u500d\u7387\u3002',
  },
  {
    key: 'privacy',
    icon: 'lock',
    titleKey: '\u9690\u79c1\u5b89\u5168',
    descKey:
      '\u8c03\u7528\u6570\u636e\u4e0d\u7559\u5b58\u3001\u4e0d\u53c2\u4e0e\u8bad\u7ec3\u3002\u4f01\u4e1a\u5ba2\u6237\u53ef\u7b7e\u7f72 NDA \u4fdd\u5bc6\u534f\u8bae\u3002',
  },
  {
    key: 'redundancy',
    icon: 'zap',
    titleKey: '\u5197\u4f59\u4fdd\u969c',
    descKey:
      '\u4e0a\u767e\u5bb6\u4f9b\u5e94\u5546\u5197\u4f59\u8986\u76d6\uff0c\u52a8\u6001\u8def\u7531\uff1b\u6bcf\u4e2a\u6a21\u578b\u4fdd\u7559 20+ \u6761\u7ebf\u8def\u3002',
  },
  {
    key: 'invoice-support',
    icon: 'receipt',
    titleKey: '\u652f\u6301\u5f00\u7968',
    descKey:
      '\u589e\u503c\u7a0e\u7535\u5b50\u4e13\u7968/\u666e\u7968\u5747\u53ef\uff0c\u652f\u6301\u4f01\u4e1a\u5bf9\u516c\u8f6c\u8d26\uff0c\u5408\u89c4\u65e0\u5fe7\u3002',
  },
  {
    key: 'enterprise-ready',
    icon: 'building',
    titleKey: '\u4f01\u4e1a\u8fd0\u8425',
    descKey:
      '\u7531\u771f\u5b9e\u6ce8\u518c\u7684\u4e2d\u56fd\u516c\u53f8\u8fd0\u8425\uff0c\u80fd\u7b7e\u5408\u540c\u3001\u5f00\u53d1\u7968\u3001\u63d0\u4f9b SLA\u3002',
  },
];

export const defaultHeroModelCards = [
  {
    vendor: 'Anthropic',
    model: 'Claude Sonnet 4.6',
    descKey: '\u65b0\u4e00\u4ee3\u4e3b\u6d41\u4ee3\u7801\u4e0e\u63a8\u7406\u6a21\u578b',
  },
  {
    vendor: 'OpenAI',
    model: 'GPT-5.4',
    descKey: '\u5f53\u524d\u4e3b\u6d41\u65d7\u8230\u6a21\u578b',
  },
  {
    vendor: 'Google',
    model: 'Gemini 3.1 Pro',
    descKey: '\u65b0\u4e00\u4ee3\u957f\u4e0a\u4e0b\u6587\u4e3b\u6d41\u6a21\u578b',
  },
];

export const modelGroups = [
  {
    key: 'claude',
    title: 'Claude',
    vendor: 'Anthropic',
    models: ['Claude 3.5 Sonnet', 'Claude 3 Opus', 'Claude 3 Haiku'],
  },
  {
    key: 'gpt',
    title: 'GPT',
    vendor: 'OpenAI',
    models: ['GPT-4o', 'GPT-4 Turbo', 'GPT-4.1'],
  },
  {
    key: 'gemini',
    title: 'Gemini',
    vendor: 'Google',
    models: ['Gemini 1.5 Pro', 'Gemini 1.5 Flash', 'Gemini 2.0 Flash'],
  },
];

export const shouldRenderDefaultHomePage = ({
  homePageContentLoaded,
  homePageContent,
}) => homePageContentLoaded && homePageContent === '';

export const trustMetrics = [
  { key: 'availability', textKey: '99.9% \u53ef\u7528\u627f\u8bfa' },
  { key: 'throughput', textKey: '\u767e\u4e07\u4ebf\u7ea7\u8c03\u7528\u89c4\u6a21' },
  { key: 'builders', textKey: '30W+ \u7528\u6237\u4fe1\u4efb' },
  { key: 'invoice', textKey: '\u589e\u503c\u7a0e\u4e13\u7528\u53d1\u7968' },
  { key: 'compliance', textKey: 'ICP\u5907\u6848 / EDI\u8bb8\u53ef' },
];

export const trustQuoteKey =
  '\u300c\u6211\u4eec\u76f8\u4fe1\uff0c\u900f\u660e\u662f\u6700\u597d\u7684\u8425\u9500\u300d';

export const promiseItems = [
  {
    key: 'real-models',
    icon: 'shield-check',
    titleKey: '\u6a21\u578b\u771f\u5b9e',
    descKey:
      '\u5e73\u53f0\u6301\u7eed\u6838\u5bf9\u7ebf\u8def\u662f\u5426\u5bf9\u5e94\u6807\u79f0\u6a21\u578b\uff0c\u53d1\u73b0\u5f02\u5e38\u540e\u53ca\u65f6\u590d\u6838\u3001\u8c03\u6574\u6216\u4e0b\u7ebf\u3002',
  },
  {
    key: 'transparent-pricing',
    icon: 'coins',
    titleKey: '\u6536\u8d39\u900f\u660e',
    descKey:
      '\u53c2\u8003\u516c\u5f00\u4ef7\u683c\uff0c\u6298\u6263\u6e05\u6670\u5c55\u793a\u3002\u4e00\u773c\u770b\u61c2\uff0c\u4e0d\u7ed9\u4f60\u7b97\u590d\u6742\u7684\u590d\u5408\u500d\u7387\u3002',
  },
  {
    key: 'privacy',
    icon: 'lock',
    titleKey: '\u9690\u79c1\u5b89\u5168',
    descKey:
      '\u8c03\u7528\u5185\u5bb9\u4e0d\u7528\u4e8e\u6a21\u578b\u8bad\u7ec3\uff1b\u5fc5\u8981\u65e5\u5fd7\u4ec5\u7528\u4e8e\u8ba1\u8d39\u3001\u6392\u969c\u3001\u98ce\u63a7\u4e0e\u5408\u89c4\u7559\u5b58\u3002\u4f01\u4e1a\u5ba2\u6237\u53ef\u7b7e\u7f72\u4fdd\u5bc6\u534f\u8bae\u3002',
  },
  {
    key: 'redundancy',
    icon: 'zap',
    titleKey: '\u5197\u4f59\u4fdd\u969c',
    descKey:
      '\u91c7\u7528\u591a\u4f9b\u5e94\u5546\u3001\u591a\u7ebf\u8def\u5197\u4f59\u8986\u76d6\uff0c\u5e76\u7ed3\u5408\u5065\u5eb7\u68c0\u6d4b\u81ea\u52a8\u5207\u6362\u53ef\u7528\u7ebf\u8def\u3002',
  },
  {
    key: 'invoice-support',
    icon: 'receipt',
    titleKey: '\u652f\u6301\u5f00\u7968',
    descKey:
      '\u589e\u503c\u7a0e\u7535\u5b50\u4e13\u7968/\u666e\u7968\u5747\u53ef\uff0c\u652f\u6301\u4f01\u4e1a\u5bf9\u516c\u8f6c\u8d26\uff0c\u5e76\u914d\u5957\u5408\u540c\u4e0e\u53d1\u7968\u6d41\u7a0b\uff0c\u91c7\u8d2d\u5ba1\u6279\u548c\u8d22\u52a1\u5165\u8d26\u66f4\u6e05\u6670\u3002',
  },
  {
    key: 'enterprise-ready',
    icon: 'building',
    titleKey: '\u4f01\u4e1a\u8fd0\u8425',
    descKey:
      '\u7531\u4f9d\u6cd5\u6ce8\u518c\u7684\u56fd\u5185\u4f01\u4e1a\u8fd0\u8425\uff0c\u652f\u6301\u5408\u540c\u7b7e\u7f72\u3001\u53d1\u7968\u5f00\u5177\u4e0e\u4f01\u4e1a\u670d\u52a1\u652f\u6301\u3002',
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

export const getDefaultHomePageLocaleAdjustments = (language) => {
  const isEnglish =
    typeof language === 'string' && language.toLowerCase().startsWith('en');

  return {
    trustMetricsContainerClass: isEnglish
      ? 'mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-4 px-6 opacity-60 md:justify-between lg:flex-nowrap'
      : 'mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-8 px-6 opacity-60 md:justify-between',
    trustMetricClass: isEnglish
      ? 'text-base font-black tracking-tight text-gray-900 whitespace-nowrap lg:text-base'
      : 'text-lg font-black tracking-tight text-gray-900',
    floatingCardClass: isEnglish
      ? 'absolute -right-6 -top-12 bg-white text-indigo-600 font-black px-6 py-4 rounded-[20px] shadow-xl z-30 border border-indigo-50'
      : 'absolute -right-6 -top-6 bg-white text-indigo-600 font-black px-6 py-4 rounded-[20px] shadow-xl z-30 border border-indigo-50',
  };
};

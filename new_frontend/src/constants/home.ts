import {
  Globe,
  Shield,
  TrendingUp,
  Users,
  Clock,
  Key,
} from 'lucide-react';

export const ENDPOINTS = [
  '/v1/chat/completions',
  '/v1/responses',
  '/v1/messages',
  '/v1beta/models',
  '/v1/embeddings',
  '/v1/rerank',
  '/v1/images/generations',
  '/v1/audio/speech',
] as const;

export const FEATURES = [
  {
    icon: Globe,
    title: 'One API for Any Model',
    description: '通过单一统一接口访问所有主要模型，OpenAI SDK 开箱即用',
  },
  {
    icon: Shield,
    title: 'Higher Availability',
    description: '通过分布式基础设施提供可靠的 AI 模型，当一个提供商宕机时自动回退到其他提供商',
  },
  {
    icon: TrendingUp,
    title: 'Price and Performance',
    description: '在不牺牲速度的情况下控制成本，在边缘运行以最小化用户与推理之间的延迟',
  },
  {
    icon: Users,
    title: 'Custom Data Policies',
    description: '通过细粒度的数据策略保护组织，确保提示词只发送到您信任的模型和提供商',
  },
] as const;

export const PRICING = [
  {
    name: '免费版',
    price: '¥0',
    features: [
      '25+ 免费模型',
      '4 个免费提供商',
      '聊天和 API 访问',
      '社区支持',
    ],
  },
  {
    name: '按需付费',
    price: '5.5%',
    period: '平台费',
    features: [
      '300+ 模型',
      '60+ 提供商',
      '自动路由',
      '邮件支持',
      '无最低消费',
    ],
    popular: true,
  },
  {
    name: '企业版',
    price: '联系我们',
    features: [
      '300+ 模型',
      '60+ 提供商',
      'SSO/SAML',
      '支持 SLA',
      '批量折扣',
    ],
  },
] as const;

export const STATS = [
  { icon: Users, value: '10K+', label: '活跃用户' },
  { icon: TrendingUp, value: '1M+', label: '每日请求' },
  { icon: Clock, value: '99.9%', label: '正常运行时间' },
  { icon: Globe, value: '30+', label: '支持服务商' },
] as const;

export const FAQS = [
  {
    question: '如何开始使用？',
    answer: '注册账号后，在控制台创建 API 密钥，然后使用 OpenAI 兼容的接口即可开始调用。',
  },
  {
    question: '支持哪些模型？',
    answer: '支持 GPT-4、Claude、Gemini、Llama 等主流模型，以及 30+ 服务商提供的数百个模型。',
  },
  {
    question: '如何计费？',
    answer: '按实际使用量计费，支持预付费和后付费模式，提供详细的使用统计和账单。',
  },
  {
    question: '是否支持私有部署？',
    answer: '企业版支持私有部署，提供完整的部署方案和技术支持。',
  },
] as const;

export const TESTIMONIALS = [
  {
    name: '张三',
    role: 'AI 工程师',
    company: '某科技公司',
    content: '这个平台大大简化了我们的 AI API 管理工作，统一的接口让开发效率提升了 50%。',
    rating: 5,
  },
  {
    name: '李四',
    role: '技术总监',
    company: '某互联网公司',
    content: '99.9% 的正常运行时间非常可靠，价格也比直接使用官方 API 优惠很多。',
    rating: 5,
  },
  {
    name: '王五',
    role: '独立开发者',
    company: '个人开发者',
    content: '文档清晰，接入简单，客服响应也很快，强烈推荐！',
    rating: 5,
  },
] as const;

export const STEPS = [
  {
    step: 1,
    title: '注册账号',
    description: '创建账号开始使用，稍后可以为团队设置组织。',
    icon: Users,
  },
  {
    step: 2,
    title: '购买额度',
    description: '额度可用于任何模型或提供商。',
    icon: TrendingUp,
  },
  {
    step: 3,
    title: '获取 API 密钥',
    description: '创建 API 密钥并开始请求，完全兼容 OpenAI。',
    icon: Key,
  },
] as const;

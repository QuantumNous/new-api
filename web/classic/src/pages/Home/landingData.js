/*
Copyright (C) 2025 QuantumNous

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

export const announcement = {
  label: '接入提示',
  text: '使用统一 Base URL 和令牌，将多类 AI 能力接入到现有应用。',
  actionText: '查看接入文档',
};

export const navItems = [
  { label: '模型能力', href: '#landing-models' },
  { label: 'API 场景', href: '#landing-scenarios' },
  { label: '为什么选择', href: '#landing-why' },
  { label: '集成步骤', href: '#landing-steps' },
  { label: 'FAQ', href: '#landing-faq' },
];

export const heroMetrics = [
  { label: '接入方式', value: 'OpenAI 兼容' },
  { label: 'Base URL', value: '统一配置' },
  { label: '调用凭证', value: '统一令牌' },
  { label: '管理入口', value: '控制台' },
];

export const featuredModelCards = [
  {
    title: '文本与对话',
    provider: '多供应商模型',
    description: '适合聊天助手、内容生成、知识问答和业务流程自动化。',
    tags: ['Chat', 'Reasoning', 'JSON'],
    status: '统一调用格式',
  },
  {
    title: '图像生成',
    provider: '图像能力入口',
    description: '用于创意草图、营销素材、商品图和视觉原型等场景。',
    tags: ['Image', 'Prompt', 'Creative'],
    status: '按站点配置展示',
  },
  {
    title: '视频生成',
    provider: '任务型能力入口',
    description: '可面向短视频、动态分镜和内容生产流程做统一接入。',
    tags: ['Video', 'Task', 'Async'],
    status: '适合扩展接入',
  },
  {
    title: '代码辅助',
    provider: '编码模型入口',
    description: '支持把代码补全、解释、生成和重构能力接入开发工具。',
    tags: ['Code', 'Agent', 'Tooling'],
    status: '兼容应用集成',
  },
];

export const modelFamilyCards = [
  {
    title: '文本模型',
    description: '用于对话、摘要、翻译、结构化输出和通用生成。',
    tags: ['对话助手', '知识问答', '内容生成'],
  },
  {
    title: '图像模型',
    description: '用于图像生成、风格化素材和视觉内容工作流。',
    tags: ['创意素材', '商品图', '原型设计'],
  },
  {
    title: '视频模型',
    description: '用于视频生成、动态内容和异步任务型生产流程。',
    tags: ['短视频', '分镜', '动态海报'],
  },
  {
    title: '编码模型',
    description: '用于代码生成、解释、修复和开发者工具接入。',
    tags: ['代码助手', '脚本生成', '自动化'],
  },
  {
    title: '音频/音乐模型',
    description: '用于语音、音频和音乐类能力的统一入口展示。',
    tags: ['语音', '音乐', '音频任务'],
  },
];

export const apiScenarioCards = [
  {
    title: 'AI 对话 API',
    description: '为应用添加聊天、客服、知识问答和业务助手能力。',
    accent: 'from-blue-500/20 to-cyan-500/10',
  },
  {
    title: '图像生成 API',
    description: '把图像生成能力嵌入营销、设计和内容生产系统。',
    accent: 'from-fuchsia-500/20 to-pink-500/10',
  },
  {
    title: '视频生成 API',
    description: '统一管理任务型视频生成入口，适配更多内容流程。',
    accent: 'from-amber-500/20 to-orange-500/10',
  },
  {
    title: '代码辅助 API',
    description: '为内部工具、IDE 插件或自动化平台接入编码能力。',
    accent: 'from-emerald-500/20 to-teal-500/10',
  },
  {
    title: '企业网关',
    description: '集中管理模型、令牌、渠道和调用记录，降低接入复杂度。',
    accent: 'from-violet-500/20 to-indigo-500/10',
  },
  {
    title: '自动化工作流',
    description: '适合把模型能力接入脚本、任务队列和业务流转系统。',
    accent: 'from-slate-500/20 to-zinc-500/10',
  },
];

export const trustCards = [
  {
    title: '统一接入',
    description: '通过统一 Base URL 和令牌接入多类模型能力，减少重复适配。',
  },
  {
    title: '控制台管理',
    description: '在控制台中管理令牌、余额、请求记录和常用配置。',
  },
  {
    title: '多渠道配置',
    description: '适合按站点需要配置不同模型、渠道和访问策略。',
  },
  {
    title: '用量可查看',
    description: '通过请求日志和用量信息辅助排查调用与成本问题。',
  },
];

export const integrationSteps = [
  {
    title: '注册 / 登录',
    description: '创建账号或登录现有账号，进入统一控制台。',
  },
  {
    title: '创建令牌',
    description: '在令牌页面创建 API Key，并按需设置可用模型。',
  },
  {
    title: '配置 Base URL',
    description: '将应用中的模型服务地址替换为本站提供的 Base URL。',
  },
  {
    title: '发起兼容请求',
    description: '按 OpenAI 兼容格式发起调用，并在日志中查看结果。',
  },
];

export const faqItems = [
  {
    question: '如何计费？',
    answer:
      '具体计费规则由站点后台配置决定。首页仅展示接入方式，实际价格请以控制台或价格页为准。',
  },
  {
    question: '是否支持多模型？',
    answer:
      '适合统一接入多类模型能力。具体可用模型取决于管理员配置的渠道、模型和访问权限。',
  },
  {
    question: '如何获取 API Key？',
    answer:
      '登录后进入控制台的令牌页面创建 API Key，并按需复制到你的应用配置中。',
  },
  {
    question: '如何配置 Base URL？',
    answer:
      '首页会展示当前站点的 Base URL。将应用中的兼容接口地址替换为该地址即可开始适配。',
  },
  {
    question: '接口失败怎么办？',
    answer:
      '可以先检查令牌权限、模型名称、余额和请求格式，再通过控制台请求日志定位问题。',
  },
  {
    question: '是否适合生产接入？',
    answer:
      '适合做统一中转和管理入口。生产使用前建议结合自身业务进行权限、额度、日志和监控配置。',
  },
];

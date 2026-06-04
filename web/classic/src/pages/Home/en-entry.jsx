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
import React, { useContext, useEffect, useState } from 'react';
import { Card, Typography, Table, Tabs } from '@douyinfe/semi-ui';
import {
  Shield,
  Zap,
  BarChart3,
  Globe,
  Sparkles,
  Cpu,
  Layers,
  ArrowRight,
  Check,
  ChevronDown,
  Code2,
  Terminal,
  Workflow,
  Globe2,
  Zap as ZapIcon,
  MessageSquare,
  Image as ImageIcon,
  Video,
} from 'lucide-react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { StatusContext } from '../../context/Status';
import './index.css';
import {
  Moonshot,
  OpenAI,
  XAI,
  Zhipu,
  Volcengine,
  Cohere,
  Claude,
  Gemini,
  Suno,
  Minimax,
  Wenxin,
  Spark,
  Qingyan,
  DeepSeek,
  Qwen,
  Midjourney,
  Grok,
  AzureAI,
  Hunyuan,
  Xinference,
} from '@lobehub/icons';

const { Text } = Typography;

const HomePage = () => {
  const { t, i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const navigate = useNavigate();
  const scrollY = useMotionValue(0);
  const [activeTab, setActiveTab] = useState('image');
  const heroY = useTransform(scrollY, [0, 800], [0, 200]);
  const heroOpacity = useTransform(scrollY, [0, 600], [1, 0]);
  const isChinese = i18n.language.startsWith('zh');
  const docsLink = statusState?.status?.docs_link || '';

  useEffect(() => {
    const scrollContainer = document.getElementById('app-scroll-shell');
    const syncScroll = () => {
      const containerY = scrollContainer?.scrollTop || 0;
      const viewportY = window.scrollY || window.pageYOffset || 0;
      scrollY.set(Math.max(containerY, viewportY));
    };

    syncScroll();

    scrollContainer?.addEventListener('scroll', syncScroll, { passive: true });
    window.addEventListener('scroll', syncScroll, { passive: true });

    return () => {
      scrollContainer?.removeEventListener('scroll', syncScroll);
      window.removeEventListener('scroll', syncScroll);
    };
  }, [scrollY]);

  const isLoggedIn = () => !!localStorage.getItem('user');

  const handleConsoleEntry = () => {
    navigate(isLoggedIn() ? '/console' : '/login');
  };

  const handleTopupEntry = () => {
    navigate(isLoggedIn() ? '/console/topup' : '/login');
  };

  const handleDocsOpen = () => {
    if (docsLink) {
      window.open(docsLink, '_blank', 'noopener,noreferrer');
    }
  };

  const handleContactSales = () => {
    window.location.href = 'mailto:support@z-up.com';
  };

  const stats = [
    {
      value: '99.9%',
      label: t('可用性 SLA'),
      icon: Shield,
      color: 'from-emerald-400 to-emerald-600',
      bgColor: 'bg-emerald-100',
    },
    {
      value: '<100ms',
      label: t('平均延迟'),
      icon: Zap,
      color: 'from-amber-400 to-amber-600',
      bgColor: 'bg-amber-100',
    },
    {
      value: '50+',
      label: t('AI 模型'),
      icon: Cpu,
      color: 'from-violet-400 to-violet-600',
      bgColor: 'bg-violet-100',
    },
    {
      value: '5min',
      label: t('迁移时间'),
      icon: Globe,
      color: 'from-rose-400 to-rose-600',
      bgColor: 'bg-rose-100',
    },
  ];

  const features = [
    {
      title: t('智能路由'),
      description: t('自动负载均衡与故障转移，确保高可用，延迟最低化'),
      icon: Workflow,
      gradient: 'from-amber-500 to-orange-500',
    },
    {
      title: t('安全可靠'),
      description: t('Cloudflare WAF 防护，API Key 加密，多层安全机制'),
      icon: Shield,
      gradient: 'from-emerald-500 to-teal-500',
    },
    {
      title: t('实时监控'),
      description: t('Prometheus 指标收集，Grafana 可视化，告警即时通知'),
      icon: BarChart3,
      gradient: 'from-violet-500 to-purple-500',
    },
    {
      title: t('全球加速'),
      description: t('Cloudflare CDN 全球节点，就近接入，极速响应'),
      icon: Globe2,
      gradient: 'from-rose-500 to-pink-500',
    },
  ];

  const providers = [
    {
      name: 'GPT-5',
      category: 'OpenAI',
      icon: MessageSquare,
      color: 'from-green-400 to-emerald-500',
      desc: t('最强对话模型'),
    },
    {
      name: 'Claude 4.5',
      category: 'Anthropic',
      icon: Sparkles,
      color: 'from-orange-400 to-amber-500',
      desc: t('超长上下文'),
    },
    {
      name: 'Gemini 2.5',
      category: 'Google',
      icon: Cpu,
      color: 'from-blue-400 to-indigo-500',
      desc: t('多模态王者'),
    },
    {
      name: 'Sora 2',
      category: 'OpenAI',
      icon: Video,
      color: 'from-pink-400 to-rose-500',
      desc: t('视频生成'),
    },
    {
      name: 'VEO 3',
      category: 'Google',
      icon: Video,
      color: 'from-cyan-400 to-blue-500',
      desc: t('高清视频'),
    },
    {
      name: 'DALL-E 3',
      category: 'OpenAI',
      icon: ImageIcon,
      color: 'from-purple-400 to-violet-500',
      desc: t('图像生成'),
    },
    {
      name: 'Stable Diffusion',
      category: 'Stability',
      icon: ImageIcon,
      color: 'from-indigo-400 to-purple-500',
      desc: t('开源绘图'),
    },
    {
      name: 'Midjourney',
      category: 'Midjourney',
      icon: ImageIcon,
      color: 'from-fuchsia-400 to-pink-500',
      desc: t('艺术创作'),
    },
  ];

  const faqs = [
    {
      question: t('如何从 OpenAI 迁移到 Z-UP?'),
      answer: t(
        '只需将 Base URL 改为 https://api.z-up.app/v1，保留现有 OpenAI SDK 代码，5 分钟即可完成迁移。',
      ),
    },
    {
      question: t('Z-UP 支持哪些 AI 模型?'),
      answer: t(
        '支持 GPT-5、Claude Sonnet 4.5、Gemini 2.5、Sora2、VEO3 等 50+ 模型，一个 API 统一接入。',
      ),
    },
    {
      question: t('SLA 和价格如何?'),
      answer: t(
        '99.9% SLA 保障，智能路由与自动故障转移。按 Token 计费，无订阅费，比官方更实惠，企业享批量折扣。',
      ),
    },
    {
      question: t('如何保证数据安全?'),
      answer: t(
        '采用端到端加密，数据不存储，请求日志 7 天自动清除，符合 GDPR 和 SOC2 标准。',
      ),
    },
    {
      question: t('支持哪些编程语言?'),
      answer: t(
        '支持 Python、Node.js/TypeScript、Go、Java、Ruby、PHP 等所有主流语言，以及任何 HTTP client。',
      ),
    },
    {
      question: t('支持图像和视频生成吗?'),
      answer: t(
        '支持 DALL-E 3、Midjourney、Stable Diffusion 等图像生成，以及 Sora、VEO 等视频生成模型。',
      ),
    },
  ];

  const codeExample = `from openai import OpenAI

client = OpenAI(
    base_url="https://api.z-up.app/v1",
    api_key="your-api-key"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)`;

  const plans = [
    {
      id: 'free',
      name: t('免费版'),
      description: t('适合个人尝试和学习'),
      price: '$0',
      period: t('永久免费'),
      features: [
        t('每月 $1 免费额度'),
        t('支持所有开放模型'),
        t('OpenAI 兼容 API'),
        t('基础技术支持'),
        t('社区文档访问'),
      ],
      cta: t('免费开始'),
      popular: false,
    },
    {
      id: 'pro',
      name: t('专业版'),
      description: t('适合开发者和小团队'),
      price: t('按量付费'),
      period: t('充值即用'),
      features: [
        t('无月费，按实际使用计费'),
        t('所有模型无限制'),
        t('高优先级请求队列'),
        t('更低的模型倍率'),
        t('邮件技术支持'),
        t('详细使用分析'),
      ],
      cta: t('立即充值'),
      popular: true,
    },
    {
      id: 'enterprise',
      name: t('企业版'),
      description: t('适合大规模商业应用'),
      price: t('定制'),
      period: t('联系我们'),
      features: [
        t('专属客户经理'),
        t('自定义 SLA 保障'),
        t('专用高可用通道'),
        t('私有化部署支持'),
        t('API 优先访问权'),
        t('发票与合同支持'),
      ],
      cta: t('联系销售'),
      popular: false,
    },
  ];

  const imageModels = [
    { model: 'gpt-4o-image', price: '$0.006', unit: t('每张图片') },
    {
      model: 'gemini-2.5-flash-image-preview',
      price: '$0.015',
      unit: t('每张图片'),
    },
    {
      model: 'gemini-3.1-flash-image-preview',
      price: '$0.015',
      unit: t('每张图片'),
    },
    { model: 'doubao-seedance-4-0', price: '$0.0175', unit: t('每张图片') },
    { model: 'doubao-seedance-4-5', price: '$0.0325', unit: t('每张图片') },
    {
      model: 'gemini-3-pro-image-preview',
      price: '$0.12',
      unit: t('每张图片'),
    },
  ];

  const videoModels = [
    { model: 'sora-2', price: '$0.1', unit: t('每个视频') },
    { model: 'sora-2-vip', price: '$0.1', unit: t('每个视频') },
    { model: 'veo3.1-fast', price: '$0.1', unit: t('每个视频') },
    { model: 'veo3.1-quality', price: '$0.8', unit: t('每个视频') },
    { model: 'MiniMax-Hailuo-02', price: '$0.8', unit: t('每个视频') },
    {
      model: 'doubao-seedance-1-0-pro-quality',
      price: '$0.8',
      unit: t('每个视频'),
    },
    {
      model: 'doubao-seedance-1-0-pro-fast',
      price: '$0.9',
      unit: t('每个视频'),
    },
    { model: 'wan2.6', price: '$0.9', unit: t('每个视频') },
    { model: 'sora-2-pro', price: '$1', unit: t('每个视频') },
  ];

  const priceFeatures = [
    {
      title: t('99.9% 高可用'),
      description: t('智能路由与自动故障转移，确保您的业务永不中断'),
      icon: Shield,
      color: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
    },
    {
      title: t('全球加速'),
      description: t('Cloudflare 全球 CDN 节点，就近接入，极速响应'),
      icon: Zap,
      color: 'bg-amber-100',
      iconColor: 'text-amber-600',
    },
    {
      title: t('实时监控'),
      description: t('详细的使用统计和成本分析，帮您优化支出'),
      icon: BarChart3,
      color: 'bg-violet-100',
      iconColor: 'text-violet-600',
    },
  ];

  const columns = [
    {
      title: t('模型'),
      dataIndex: 'model',
      render: (text) => <code className='text-sm text-slate-700'>{text}</code>,
    },
    {
      title: t('价格'),
      dataIndex: 'price',
      render: (text) => (
        <span className='font-semibold text-black'>{text}</span>
      ),
    },
    {
      title: '',
      dataIndex: 'unit',
      render: (text) => <span className='text-sm text-slate-500'>{text}</span>,
    },
  ];

  const handlePlanAction = (planId) => {
    switch (planId) {
      case 'free':
        handleConsoleEntry();
        break;
      case 'pro':
        handleTopupEntry();
        break;
      case 'enterprise':
        handleContactSales();
        break;
      default:
        break;
    }
  };

  return (
    <div className='home-page min-h-screen overflow-x-hidden'>
      {/* Hero Section */}
      <section className='home-hero relative min-h-screen overflow-hidden'>
        {/* Grid Pattern */}
        <div className='home-hero-grid absolute inset-0' />
        <div className='home-hero-orb home-hero-orb-primary' />
        <div className='home-hero-orb home-hero-orb-secondary' />
        <div className='home-hero-orb home-hero-orb-tertiary' />
        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className='relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-20 sm:px-6 lg:px-8'
        >
          <div className='home-shell mx-auto max-w-6xl text-center'>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className='mb-8'
            >
              <span className='home-badge inline-flex items-center gap-2 px-4 py-2 text-sm font-medium'>
                <Sparkles className='h-4 w-4 text-amber-500' />
                {t('支持 GPT-5、Claude 4.5、Gemini 2.5')}
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className='home-hero-title mb-6 text-6xl font-bold leading-tight tracking-tight sm:text-7xl lg:text-8xl'
            >
              <h1
                className={`text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-semi-color-text-0 leading-tight ${isChinese ? 'tracking-wide md:tracking-wider' : ''}`}
              >
                <>
                  {t('统一的')}
                  <br />
                  <span className='shine-text'>{t('大模型接口网关')}</span>
                </>
              </h1>
              <span className='home-hero-title-secondary text-4xl font-light sm:text-5xl lg:text-6xl'>
                {t('接入全球顶尖模型')}
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className='home-hero-kicker mx-auto mb-4 max-w-2xl text-xl'
            >
              GPT-5 · Claude · Gemini · Sora · VEO
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className='home-hero-description mx-auto mb-10 max-w-2xl text-lg'
            >
              {t(
                '只需修改 Base URL，即可接入 50+ AI 模型。无需改代码，5 分钟完成迁移。',
              )}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className='home-hero-actions mb-16 flex flex-wrap items-center justify-center gap-4'
            >
              <button
                type='button'
                onClick={handleConsoleEntry}
                className='home-button home-button-primary group relative overflow-hidden px-8 py-4 text-base font-semibold'
              >
                <span className='relative z-10 flex items-center gap-2'>
                  {t('进入控制台')}
                  <ArrowRight className='h-4 w-4 transition-transform group-hover:translate-x-1' />
                </span>
              </button>
              <button
                type='button'
                onClick={handleDocsOpen}
                className='home-button home-button-secondary group px-8 py-4 text-base font-semibold'
              >
                <span className='flex items-center gap-2'>
                  {t('查看文档')}
                  <ArrowRight className='h-4 w-4 transition-transform group-hover:translate-x-1' />
                </span>
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className='home-stats-grid grid grid-cols-2 gap-6 sm:grid-cols-4'
              style={{ display: 'none' }}
            >
              {stats.map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.6 + index * 0.1 }}
                  whileHover={{ scale: 1.05, y: -5 }}
                  className='home-stat-card group relative overflow-hidden p-6 transition-all duration-300'
                >
                  <div className='home-stat-icon-wrap mb-3 inline-flex rounded-xl p-3'>
                    <stat.icon className='h-6 w-6 text-[#0052ff]' />
                  </div>
                  <div className='home-stat-value text-3xl font-bold'>
                    {stat.value}
                  </div>
                  <div className='home-stat-label text-sm'>{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Providers Section */}
      <section className='home-section home-section-soft relative overflow-hidden px-4 py-24 sm:px-6 lg:px-8'>
        <div className='home-shell mx-auto max-w-7xl'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className='home-section-head mb-16 text-center'
          >
            <span className='home-badge mb-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium'>
              <Layers className='h-4 w-4' />
              {t('支持的模型')}
            </span>
            <h2 className='home-section-title mb-4 text-4xl font-bold sm:text-5xl'>
              {t('一个 API，接入所有大模型')}
            </h2>
            <p className='home-section-description mx-auto max-w-2xl text-lg'>
              {t(
                '无需管理多个 API Key，统一接口调用 GPT、Claude、Gemini 等 50+ 模型',
              )}
            </p>
          </motion.div>

          {/* LLM Providers Logo Cloud */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className='home-provider-cloud mb-16'
          >
            {/* 框架兼容性图标 */}
            <div className='mt-12 md:mt-16 lg:mt-20 w-full'>
              <div className='flex items-center mb-6 md:mb-8 justify-center'>
                <Text className='home-provider-cloud-title text-lg font-light md:text-xl lg:text-2xl'>
                  {t('支持众多的大模型供应商')}
                </Text>
              </div>
              <div className='home-provider-cloud-grid mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3 px-4 sm:gap-4 md:gap-6 lg:gap-8'>
                <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center'>
                  <Moonshot size={40} />
                </div>
                <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center'>
                  <OpenAI size={40} />
                </div>
                <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center'>
                  <XAI size={40} />
                </div>
                <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center'>
                  <Zhipu.Color size={40} />
                </div>
                <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center'>
                  <Volcengine.Color size={40} />
                </div>
                <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center'>
                  <Cohere.Color size={40} />
                </div>
                <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center'>
                  <Claude.Color size={40} />
                </div>
                <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center'>
                  <Gemini.Color size={40} />
                </div>
                <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center'>
                  <Suno size={40} />
                </div>
                <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center'>
                  <Minimax.Color size={40} />
                </div>
                <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center'>
                  <Wenxin.Color size={40} />
                </div>
                <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center'>
                  <Spark.Color size={40} />
                </div>
                <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center'>
                  <Qingyan.Color size={40} />
                </div>
                <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center'>
                  <DeepSeek.Color size={40} />
                </div>
                <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center'>
                  <Qwen.Color size={40} />
                </div>
                <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center'>
                  <Midjourney size={40} />
                </div>
                <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center'>
                  <Grok size={40} />
                </div>
                <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center'>
                  <AzureAI.Color size={40} />
                </div>
                <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center'>
                  <Hunyuan.Color size={40} />
                </div>
                <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center'>
                  <Xinference.Color size={40} />
                </div>
                <div className='w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center'>
                  <Typography.Text className='!text-lg sm:!text-xl md:!text-2xl lg:!text-3xl font-bold'>
                    30+
                  </Typography.Text>
                </div>
              </div>
            </div>
          </motion.div>

          <div
            className='grid gap-6 sm:grid-cols-2 lg:grid-cols-4'
            style={{ display: 'none' }}
          >
            {providers.map((provider, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className='home-provider-card group relative overflow-hidden p-6 transition-all duration-300'
              >
                <div className='home-provider-icon mb-4 inline-flex rounded-xl p-3 shadow-lg transition-transform duration-300 group-hover:scale-110'>
                  <provider.icon className='h-6 w-6' />
                </div>
                <h3 className='home-provider-name mb-1 text-lg font-semibold'>
                  {provider.name}
                </h3>
                <p className='home-provider-category mb-2 text-sm font-medium'>
                  {provider.category}
                </p>
                <p className='home-provider-desc text-sm'>{provider.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className='home-section home-section-dark relative overflow-hidden px-4 py-24 sm:px-6 lg:px-8'>
        <div className='home-shell mx-auto max-w-7xl'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className='home-section-head mb-16 text-center'
          >
            <span className='home-badge home-badge-dark mb-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium'>
              <ZapIcon className='h-4 w-4' />
              {t('核心特性')}
            </span>
            <h2 className='home-section-title home-section-title-dark mb-4 text-4xl font-bold sm:text-5xl'>
              {t('企业级基础设施')}
            </h2>
            <p className='home-section-description home-section-description-dark mx-auto max-w-2xl text-lg'>
              {t('为高可用、高性能的 AI 应用打造')}
            </p>
          </motion.div>

          <div className='home-feature-grid grid gap-8 sm:grid-cols-2 lg:grid-cols-4'>
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -10 }}
                className='group relative'
              >
                <div className='home-feature-card relative overflow-hidden p-8 transition-all duration-300'>
                  <div className='home-feature-icon mb-6 inline-flex rounded-2xl p-4 text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3'>
                    <feature.icon className='h-8 w-8' />
                  </div>
                  <h3 className='home-feature-title mb-3 text-xl font-bold'>
                    {feature.title}
                  </h3>
                  <p className='home-feature-description leading-relaxed'>
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Code Integration Section */}
      <section className='home-section relative overflow-hidden px-4 py-24 sm:px-6 lg:px-8'>
        <div className='home-shell mx-auto max-w-6xl'>
          <div className='grid items-center gap-12 lg:grid-cols-2'>
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <span className='home-badge mb-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium'>
                <Code2 className='h-4 w-4' />
                {t('极简集成')}
              </span>
              <h2 className='home-section-title mb-6 text-4xl font-bold'>
                {t('一行代码即可迁移')}
              </h2>
              <p className='home-section-description mb-8 text-lg'>
                {t(
                  '完全兼容 OpenAI SDK，只需修改 base_url，无需改动任何业务代码。',
                )}
              </p>
              <ul className='home-language-list space-y-4'>
                {[
                  'Python',
                  'Node.js/TypeScript',
                  'Go',
                  'Java',
                  'Ruby',
                  'PHP',
                ].map((lang, i) => (
                  <motion.li
                    key={lang}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    className='home-language-item flex items-center gap-3'
                  >
                    <div className='home-language-check flex h-6 w-6 items-center justify-center rounded-full'>
                      <Check className='h-4 w-4' />
                    </div>
                    {lang}
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className='relative'
            >
              <Card className='home-code-card relative overflow-hidden p-0'>
                <div className='home-code-head flex items-center gap-2 px-4 py-3'>
                  <div className='flex gap-2'>
                    <div className='home-code-dot h-3 w-3 rounded-full bg-red-500' />
                    <div className='home-code-dot h-3 w-3 rounded-full bg-yellow-500' />
                    <div className='home-code-dot h-3 w-3 rounded-full bg-green-500' />
                  </div>
                  <span className='home-code-filename ml-2 text-sm'>
                    example.py
                  </span>
                </div>
                <div className='home-code-body p-6'>
                  <pre className='overflow-x-auto text-sm leading-relaxed'>
                    <code className='language-python'>
                      {codeExample.split('\n').map((line, i) => (
                        <div key={i} className='table-row'>
                          <span className='home-code-line-number table-cell select-none pr-4 text-right'>
                            {i + 1}
                          </span>
                          <span className='home-code-line table-cell'>
                            {line.includes('base_url') ? (
                              <>
                                {line.split('https://api.z-up.app/v1')[0]}
                                <span className='home-code-accent'>
                                  https://api.z-up.app/v1
                                </span>
                                {line.split('https://api.z-up.app/v1')[1]}
                              </>
                            ) : line.includes('import') ||
                              line.includes('from') ? (
                              <span className='home-code-keyword'>{line}</span>
                            ) : line.includes('client') ||
                              line.includes('response') ? (
                              <span className='home-code-variable'>{line}</span>
                            ) : (
                              line
                            )}
                          </span>
                        </div>
                      ))}
                    </code>
                  </pre>
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      <section
        className='home-section home-section-pricing relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 lg:px-8'
        style={{ display: 'none' }}
      >
        <div className='home-shell mx-auto max-w-6xl'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className='home-section-head mb-16 text-center'
          >
            <span className='home-badge mb-6 inline-flex items-center rounded-full px-3 py-1 text-sm font-medium'>
              {t('透明定价，按量付费')}
            </span>
            <h1 className='home-section-title mb-4 text-4xl font-bold sm:text-5xl'>
              {t('简单透明的')}
              <br />
              {t('API 定价')}
            </h1>
            <p className='home-section-description mx-auto max-w-2xl'>
              {t(
                '无隐藏费用，无月度订阅。按实际使用量付费，与官方价格持平或更低。',
              )}
            </p>
          </motion.div>

          <div className='home-pricing-grid grid gap-6 lg:grid-cols-3'>
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className='home-plan-wrap relative h-full'>
                  {plan.popular && (
                    <div className='absolute -top-3 left-1/2 z-20 -translate-x-1/2'>
                      <span className='home-plan-popular inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold text-white shadow-md'>
                        {t('最受欢迎')}
                      </span>
                    </div>
                  )}
                  <Card
                    className={`home-plan-card h-full p-6 ${
                      plan.popular ? 'is-popular pt-8' : ''
                    }`}
                  >
                    <div className='mb-4'>
                      <h3 className='home-plan-title text-xl font-semibold'>
                        {plan.name}
                      </h3>
                      <p className='home-plan-copy text-sm'>
                        {plan.description}
                      </p>
                    </div>
                    <div className='mb-6'>
                      <span className='home-plan-price text-4xl font-bold'>
                        {plan.price}
                      </span>
                      <span className='home-plan-period text-sm'>
                        {' '}
                        / {plan.period}
                      </span>
                    </div>
                    <ul className='home-plan-features mb-6 space-y-3'>
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className='home-plan-feature flex items-start gap-2 text-sm'
                        >
                          <span className='home-plan-feature-mark mt-0.5'>
                            ✓
                          </span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <button
                      type='button'
                      onClick={() => handlePlanAction(plan.id)}
                      className={`home-plan-button w-full py-3 text-base font-medium transition-all duration-200 ${
                        plan.popular ? 'is-primary' : 'is-secondary'
                      }`}
                    >
                      {plan.cta} →
                    </button>
                  </Card>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section
        className='home-section home-section-soft relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8'
        style={{ display: 'none' }}
      >
        <div className='home-shell mx-auto max-w-4xl'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className='home-section-head mb-12 text-center'
          >
            <span className='home-badge mb-4 inline-flex items-center rounded-full px-3 py-1 text-sm font-medium'>
              {t('价格概览')}
            </span>
            <h2 className='home-section-title mb-4 text-3xl font-bold'>
              {t('模型价格一览')}
            </h2>
            <p className='home-section-description'>
              {t('以下价格为参考价格，实际价格可能因用户组和促销活动有所不同')}
            </p>
          </motion.div>

          <Card className='home-pricing-table-card'>
            <Tabs
              type='button'
              activeKey={activeTab}
              onChange={setActiveTab}
              className='home-pricing-tabs mb-6'
            >
              <Tabs.TabPane tab={t('图像生成')} itemKey='image'>
                <Table
                  dataSource={imageModels}
                  columns={columns}
                  pagination={false}
                  className='home-pricing-table border-0'
                />
              </Tabs.TabPane>
              <Tabs.TabPane tab={t('视频生成')} itemKey='video'>
                <Table
                  dataSource={videoModels}
                  columns={columns}
                  pagination={false}
                  className='home-pricing-table border-0'
                />
              </Tabs.TabPane>
            </Tabs>
          </Card>

          <p className='home-pricing-note mt-6 text-center text-sm'>
            {t('* 价格可能随官方调整而变化，以实际计费为准')}
          </p>
        </div>
      </section>

      <section className='home-section relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8'>
        <div className='home-shell mx-auto max-w-6xl'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className='home-section-head mb-12 text-center'
          >
            <h2 className='home-section-title text-3xl font-bold'>
              {t('为什么选择 Z-UP')}
            </h2>
          </motion.div>

          <div className='home-why-grid grid gap-6 sm:grid-cols-3'>
            {priceFeatures.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className='home-why-card h-full p-6 text-center transition-shadow'>
                  <div className='mb-4 flex items-center justify-center'>
                    <div className='home-why-icon flex h-14 w-14 items-center justify-center rounded-full'>
                      <feature.icon className='h-7 w-7 text-[#0052ff]' />
                    </div>
                  </div>
                  <h3 className='home-why-title mb-2 text-lg font-semibold'>
                    {feature.title}
                  </h3>
                  <p className='home-why-copy text-sm'>{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section
        className='home-section home-section-soft relative overflow-hidden px-4 py-24 sm:px-6 lg:px-8'
        style={{ display: 'none' }}
      >
        <div className='home-shell mx-auto max-w-4xl'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className='home-section-head mb-16 text-center'
          >
            <span className='home-badge mb-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium'>
              <MessageSquare className='h-4 w-4' />
              {t('常见问题')}
            </span>
            <h2 className='home-section-title text-4xl font-bold'>
              {t('还有疑问？')}
            </h2>
          </motion.div>

          <div className='space-y-4'>
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
              >
                <details className='home-faq-item group transition-all duration-300'>
                  <summary className='home-faq-summary flex cursor-pointer items-center justify-between p-6 text-left'>
                    <span className='home-faq-question text-lg font-semibold'>
                      {faq.question}
                    </span>
                    <span className='home-faq-chevron ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 group-hover:bg-black/10 group-open:rotate-180'>
                      <ChevronDown className='h-5 w-5' />
                    </span>
                  </summary>
                  <div className='home-faq-answer-wrap px-6 pb-6'>
                    <p className='home-faq-answer pt-4 leading-relaxed'>
                      {faq.answer}
                    </p>
                  </div>
                </details>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className='home-section home-section-cta relative overflow-hidden px-4 py-24 sm:px-6 lg:px-8'>
        <div className='home-shell relative mx-auto max-w-4xl text-center'>
          <div className='home-cta-panel' />
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className='home-cta-content relative z-10'
          >
            <h2 className='home-cta-title mb-6 text-5xl font-bold'>
              {t('准备好开始了吗？')}
            </h2>
            <p className='home-cta-description mb-10 text-xl'>
              {t('免费注册后，选择模型、创建密钥，即可快速开始 AI 开发')}
            </p>
            <div className='flex flex-wrap items-center justify-center gap-4'>
              <button
                type='button'
                onClick={handleConsoleEntry}
                className='home-button home-button-primary group px-8 py-4 text-base font-semibold'
              >
                <span className='flex items-center gap-2'>
                  {t('免费开始')}
                  <ArrowRight className='h-4 w-4 transition-transform group-hover:translate-x-1' />
                </span>
              </button>
              <button
                type='button'
                onClick={handleDocsOpen}
                className='home-button home-button-secondary group px-8 py-4 text-base font-semibold'
              >
                <span className='flex items-center gap-2'>
                  <Terminal className='h-4 w-4' />
                  {t('查看文档')}
                </span>
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;

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

import React, { useState } from 'react';
import {
  ArrowUp,
  Check,
  ChevronDown,
  Clock,
  Copy,
  History,
  Image as ImageIcon,
  Layers,
  Loader2,
  MessageSquare,
  Plus,
  Sparkles,
  Video,
} from 'lucide-react';

const apiKey = ''; // API key is injected by environment

const tabs = [
  { id: 'chat', label: '对话', icon: MessageSquare },
  { id: 'image', label: '图片', icon: ImageIcon },
  { id: 'video', label: '视频', icon: Video, badge: '新' },
];

const ratios = ['自动', '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
const imageResolutions = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '3K', label: '3K' },
];
const durations = ['10 秒', '15 秒', '20 秒', '25 秒'];

const GPTIcon = ({ size = 24, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
    className={className}
  >
    <path
      d='M22.2819 9.8211a5.9847 5.9847 0 0 0-.5153-4.9066 6.0462 6.0462 0 0 0-3.9471-3.1358 6.0417 6.0417 0 0 0-5.1923 1.0689 6.0222 6.0222 0 0 0-4.385-1.9231 6.0464 6.0464 0 0 0-5.4604 3.4456 6.0536 6.0536 0 0 0-.8101 4.8906 6.0538 6.0538 0 0 0 3.1467 3.9573 6.0585 6.0585 0 0 0-1.065 5.2124 6.0545 6.0545 0 0 0 1.9292 4.3941 6.0513 6.0513 0 0 0 4.0011 1.6379 6.0106 6.0106 0 0 0 4.3389-1.8964 6.0562 6.0562 0 0 0 5.4628-3.4481 6.0519 6.0519 0 0 0 .8175-4.9088 6.0483 6.0483 0 0 0-3.1463-3.9429 6.0548 6.0548 0 0 0 1.0254-4.8882Zm-10.2819 11.1042a3.4298 3.4298 0 0 1-2.4357-1.006 3.4416 3.4416 0 0 1-.7185-1.5533l.1162-.0667 4.9883-2.8786a.3326.3326 0 0 0 .166-.2871v-7.0702l2.013 1.1621v5.9233a.3347.3347 0 0 0 .1661.2875l5.1326 2.9614a3.4351 3.4351 0 0 1-2.045 1.745 3.4082 3.4082 0 0 1-7.384-.2875Zm-8.4777-3.3403a3.4223 3.4223 0 0 1 .1865-2.6322 3.4405 3.4405 0 0 1 1.4875-1.5049l.1169.0678 4.9846 2.8846a.333.333 0 0 0 .3309 0l6.1227-3.5341-2.013-1.1621-5.1314 2.9646a.3332.3332 0 0 0-.1665.2875v-5.9208a3.4483 3.4483 0 0 1 .545-1.874 3.405 3.405 0 0 1 4.503-1.3171l.1158.0662-4.985 2.8792a.3326.3326 0 0 0-.166.2871v7.0702l-2.013-1.1621v-5.9233a.3347.3347 0 0 0-.1661-.2875l-5.1326-2.9614a3.4373 3.4373 0 0 1-1.8173-2.1832 3.4035 3.4035 0 0 1 2.0306-4.474Zm1.8763-12.429a3.4243 3.4243 0 0 1 2.6235-.191 3.4389 3.4389 0 0 1 1.5052 1.4883l-.1165.0673-4.9846 2.8846a.333.333 0 0 0 0 .3309l6.1226 3.5341 2.013-1.1621-2.9609-5.1312a.3332.3332 0 0 0-.2875-.1665h-5.9209a3.4482 3.4482 0 0 1-1.874-.545 3.405 3.405 0 0 1-1.3171-4.503l.0662-.1158 2.8792 4.985a.3326.3326 0 0 0 .2871.166h7.0702l-1.1621 2.013h-5.9233a.3347.3347 0 0 0-.2875.1661l-2.9614 5.1326a3.4373 3.4373 0 0 1-2.1832 1.8173 3.4035 3.4035 0 0 1-4.474-2.0306Zm15.101 0a3.4223 3.4223 0 0 1 .1865 2.6322 3.4405 3.4405 0 0 1-1.4875 1.5049l-.1169-.0678-4.9846-2.8846a.333.333 0 0 0-.3309 0l-6.1227 3.5341 2.013 1.1621 5.1314-2.9646a.3332.3332 0 0 0 .1665-.2875v5.9208a3.4483 3.4483 0 0 1-.545 1.874 3.405 3.405 0 0 1-4.503 1.3171l-.1158-.0662 4.985-2.8792a.3326.3326 0 0 0 .166-.2871v-7.0702l2.013 1.1621v5.9233a.3347.3347 0 0 0 .1661.2875l5.1326 2.9614a3.4373 3.4373 0 0 1 1.8173 2.1832 3.4035 3.4035 0 0 1-2.0306 4.474Zm-1.8763 12.429a3.4243 3.4243 0 0 1-2.6235.191 3.4389 3.4389 0 0 1-1.5052-1.4883l.1165-.0673 4.9846-2.8846a.333.333 0 0 0 0-.3309l-6.1226-3.5341-2.013 1.1621 2.9609 5.1312a.3332.3332 0 0 0 .2875.1665h5.9209a3.4482 3.4482 0 0 1 1.874.545 3.405 3.405 0 0 1 1.3171 4.503l-.0662.1158-2.8792-4.985a.3326.3326 0 0 0-.2871-.166h-7.0702l1.1621-2.013h5.9233a.3347.3347 0 0 0 .2875-.1661l2.9614-5.1326a3.4373 3.4373 0 0 1 2.1832-1.8173 3.4035 3.4035 0 0 1 4.474 2.0306Z'
      fill='currentColor'
    />
  </svg>
);

const GrokIcon = ({ size = 24, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.5'
    strokeLinecap='round'
    strokeLinejoin='round'
    className={className}
  >
    <circle cx='12' cy='12' r='9' />
    <line x1='6' y1='18' x2='18' y2='6' />
    <circle cx='18' cy='6' r='2.5' fill='currentColor' />
  </svg>
);

const FeaturePill = ({ children, tone = 'light' }) => (
  <span
    className={`rounded-full px-3 py-1 text-[11px] font-medium tracking-[0.18em] ${
      tone === 'dark'
        ? 'border border-cyan-300/[0.14] bg-cyan-300/[0.08] text-cyan-50'
        : 'border border-white/[0.10] bg-white/[0.06] text-slate-200'
    }`}
  >
    {children}
  </span>
);

const StageMetric = ({ value, label }) => (
  <div className='min-w-[108px] rounded-[22px] border border-white/10 bg-white/[0.08] px-4 py-3 backdrop-blur'>
    <div className='text-lg font-semibold tracking-tight text-white'>{value}</div>
    <div className='mt-1 text-[10px] uppercase tracking-[0.22em] text-slate-400'>{label}</div>
  </div>
);

const FloatingPrompt = ({ children, className = '' }) => (
  <div
    className={`rounded-2xl border border-white/[0.12] bg-white/[0.08] px-4 py-3 text-sm text-slate-200 shadow-[0_20px_60px_rgba(3,7,18,0.28)] backdrop-blur ${className}`}
  >
    {children}
  </div>
);

const DropButton = ({ icon, label, open, onClick, children }) => (
  <div className='relative'>
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-all ${
        open
          ? 'border-cyan-300/[0.22] bg-cyan-300/[0.12] text-cyan-100 shadow-[0_10px_30px_rgba(34,211,238,0.12)]'
          : 'border-white/[0.10] bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]'
      }`}
    >
      {icon}
      {label}
      <ChevronDown
        size={12}
        className={`text-slate-400 transition-transform ${open ? 'rotate-180 text-cyan-100' : ''}`}
      />
    </button>
    {children}
  </div>
);

const modeCopy = {
  chat: {
    eyebrow: '对话工作台',
    title: '让复杂需求在更安静、更清晰的空间里成形',
    desc: '以对话为入口，把代码、策略、内容和灵感组织成真正可推进的流程。少一点仪表盘噪音，多一点创作势能。',
    chips: ['深度推理', '代码协作', '长文本创作'],
    badge: '对话模式',
    detail: '适合产品讨论、代码生成、信息整合、方案推演和创意写作。',
    primaryMetric: '4.8s',
    primaryLabel: '平均响应',
    secondaryMetric: '128K',
    secondaryLabel: '上下文',
  },
  image: {
    eyebrow: '视觉工坊',
    title: '把一句提示词，推成一张真正有设计感的画面',
    desc: '围绕光线、材质、构图与排版来组织输出，不再只是“生成一张图”，而是更接近可展示的视觉提案。',
    chips: ['构图控制', '材质质感', '高精输出'],
    badge: '图片模式',
    detail: '适合海报、封面、品牌主视觉、编辑感画面和概念提案。',
    primaryMetric: '3 档',
    primaryLabel: '输出规格',
    secondaryMetric: '11:9',
    secondaryLabel: '比例范围',
  },
  video: {
    eyebrow: '动态实验室',
    title: '让镜头语言不只是动起来，而是真正有节奏',
    desc: '围绕时长、景别、机位、镜头运动与场景推进来生成短视频内容，让描述先长成镜头，再长成片段。',
    chips: ['镜头节奏', '多比例输出', '短片氛围'],
    badge: '视频模式',
    detail: '适合广告预演、产品演示、社媒短片和分镜草案。',
    primaryMetric: '25s',
    primaryLabel: '最长时长',
    secondaryMetric: '16:9',
    secondaryLabel: '主舞台比例',
  },
};

const chatModels = [
  {
    id: 'chat1',
    name: 'GPT-5.4',
    desc: '面向复杂专业工作的前沿模型，适合深度推理、写作、方案整理和开发协作。',
    icon: <GPTIcon size={28} className='text-cyan-100' />,
  },
];

const imageModels = [
  {
    id: 1,
    name: 'Nano Banana Pro',
    desc: '偏高质感的视觉模型，更适合商业海报、版式画面和完整视觉提案。',
    icon: <span className='text-xl'>NB</span>,
  },
  {
    id: 2,
    name: 'Nano Banana 2',
    desc: '更轻盈的图片模型，适合快速探索想法和高频迭代。',
    icon: <span className='text-xl'>N2</span>,
  },
];

const videoModels = [
  {
    id: 'v1',
    name: 'grok-video-3-plus',
    desc: '强调镜头语言、画面张力与多比例输出，适合更具导演感的视频生成。',
    icon: <GrokIcon size={28} className='text-cyan-100' />,
  },
];

const fetchWithRetry = async (url, options, maxRetries = 5) => {
  let retries = 0;
  const delays = [1000, 2000, 4000, 8000, 16000];

  while (retries < maxRetries) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      if (retries === maxRetries - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delays[retries]));
      retries += 1;
    }
  }

  return null;
};
export default function CreativeCenter() {
  const [activeTab, setActiveTab] = useState('chat');
  const [activeModel, setActiveModel] = useState('chat1');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isQuantityOpen, setIsQuantityOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isRatioOpen, setIsRatioOpen] = useState(false);
  const [ratio, setRatio] = useState('自动');
  const [isResolutionOpen, setIsResolutionOpen] = useState(false);
  const [resolution, setResolution] = useState('2K');
  const [isDurationOpen, setIsDurationOpen] = useState(false);
  const [duration, setDuration] = useState('10 秒');

  const displayModels =
    activeTab === 'chat'
      ? chatModels
      : activeTab === 'video'
        ? videoModels
        : imageModels;

  const currentCopy = modeCopy[activeTab];

  const closeAllMenus = () => {
    setIsQuantityOpen(false);
    setIsRatioOpen(false);
    setIsResolutionOpen(false);
    setIsDurationOpen(false);
  };

  const switchTab = (tabId, modelId) => {
    setActiveTab(tabId);
    setActiveModel(modelId);
    closeAllMenus();
  };

  const handleSubmit = async () => {
    if (!prompt.trim() || isGenerating) {
      return;
    }

    if (activeTab === 'image') {
      setIsGenerating(true);
      setGeneratedImage(null);

      try {
        const response = await fetchWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instances: { prompt },
              parameters: { sampleCount: 1 },
            }),
          },
        );

        if (response?.predictions?.[0]?.bytesBase64Encoded) {
          setGeneratedImage(`data:image/png;base64,${response.predictions[0].bytesBase64Encoded}`);
        }
      } catch (error) {
        console.error('Generate error', error);
      } finally {
        setIsGenerating(false);
      }

      return;
    }

    console.log('Creative center prompt submitted:', prompt);
    setPrompt('');
  };

  const renderStagePanel = () => {
    if (activeTab === 'chat') {
      return (
        <div className='relative flex h-full min-h-[420px] flex-col justify-between rounded-[32px] bg-[linear-gradient(180deg,#0a1324_0%,#101e36_52%,#0d172a_100%)] p-7 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'>
          <div className='flex items-center justify-between'>
            <div>
              <div className='text-[11px] uppercase tracking-[0.26em] text-cyan-200/[0.70]'>实时会话</div>
              <div className='mt-2 text-2xl font-semibold tracking-tight'>思路在这里被整理成方向</div>
            </div>
            <div className='flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.06]'>
              <GPTIcon size={38} className='text-cyan-100' />
            </div>
          </div>

          <div className='relative mt-10 flex-1 rounded-[28px] border border-white/[0.08] bg-white/[0.06] p-6'>
            <div className='absolute left-10 top-8 h-24 w-24 rounded-full bg-cyan-300/[0.16] blur-2xl' />
            <div className='absolute bottom-8 right-10 h-32 w-32 rounded-full bg-blue-400/[0.16] blur-3xl' />
            <FloatingPrompt className='absolute left-6 top-6 w-[220px] drift-card'>
              为新模型写一段发布说明，语气专业，但不要太硬。
            </FloatingPrompt>
            <FloatingPrompt className='absolute right-6 top-20 w-[212px] drift-card-delay'>
              把支付流程拆成 controller 和 service 两层。
            </FloatingPrompt>
            <FloatingPrompt className='absolute bottom-8 left-1/2 w-[260px] -translate-x-1/2'>
              把复杂问题变成结构化推进，而不是一长段回答。
            </FloatingPrompt>
            <div className='flex h-full items-center justify-center'>
              <div className='relative flex h-56 w-56 items-center justify-center rounded-full border border-white/10 bg-[radial-gradient(circle,rgba(34,211,238,0.2),rgba(10,19,36,0.2)_58%,transparent_70%)]'>
                <div className='absolute h-72 w-72 rounded-full border border-white/[0.08] orbit-spin' />
                <div className='absolute h-44 w-44 rounded-full border border-cyan-300/15' />
                <GPTIcon size={92} className='text-white drop-shadow-[0_18px_32px_rgba(34,211,238,0.22)]' />
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'video') {
      return (
        <div className='relative flex min-h-[420px] flex-col justify-between rounded-[32px] bg-[linear-gradient(160deg,#091223_0%,#10203f_48%,#142949_100%)] p-7 text-white'>
          <div className='flex items-center justify-between'>
            <div>
              <div className='text-[11px] uppercase tracking-[0.26em] text-cyan-200/[0.70]'>动态预演</div>
              <div className='mt-2 text-2xl font-semibold tracking-tight'>每一段描述，都会先长成一个镜头</div>
            </div>
            <div className='flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.06]'>
              <GrokIcon size={36} className='text-cyan-100' />
            </div>
          </div>

          <div className='relative mt-8 overflow-hidden rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,#040814_0%,#0b1326_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'>
            <div className='absolute left-6 top-6 rounded-full border border-white/[0.12] bg-white/[0.08] px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-200'>
              机位 A
            </div>
            <div className='absolute right-6 top-6 rounded-full border border-cyan-300/[0.18] bg-cyan-300/[0.08] px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-100'>
              准备生成
            </div>
            <div className='aspect-[16/10] overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_30%_35%,rgba(56,189,248,0.24),transparent_28%),linear-gradient(145deg,#091223_0%,#121f35_42%,#30456c_100%)]'>
              <div className='flex h-full items-end justify-between p-6'>
                <div className='max-w-[220px] rounded-[22px] border border-white/10 bg-black/[0.24] px-4 py-3 text-left backdrop-blur'>
                  <div className='text-xs uppercase tracking-[0.24em] text-cyan-100/70'>镜头备注</div>
                  <div className='mt-2 text-sm leading-6 text-slate-100'>雨夜街头，镜头从玻璃反射切入，缓慢推向主角。</div>
                </div>
                <div className='space-y-3'>
                  <div className='h-10 w-28 rounded-full border border-white/10 bg-white/10 pulse-glow' />
                  <div className='h-10 w-36 rounded-full border border-white/10 bg-white/10' />
                  <div className='h-10 w-24 rounded-full border border-white/10 bg-white/10' />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (isGenerating) {
      return (
        <div className='flex h-full min-h-[380px] flex-col items-center justify-center rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(10,18,33,0.92),rgba(17,28,46,0.84))] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'>
          <div className='flex h-20 w-20 items-center justify-center rounded-full bg-[linear-gradient(135deg,#22d3ee,#3b82f6)] shadow-[0_18px_50px_rgba(59,130,246,0.28)]'>
            <Loader2 className='h-10 w-10 animate-spin text-white' />
          </div>
          <div className='mt-6 text-[11px] uppercase tracking-[0.28em] text-cyan-200'>正在生成</div>
          <div className='mt-3 text-2xl font-semibold tracking-tight text-white'>正在搭建你的画面语言</div>
          <p className='mt-3 max-w-[340px] text-sm leading-7 text-slate-300'>
            系统正在组织构图、材质和光线，请稍候片刻。
          </p>
        </div>
      );
    }

    if (generatedImage) {
      return (
        <div className='group relative min-h-[380px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(9,16,29,0.92),rgba(17,26,42,0.88))] p-3 shadow-[0_26px_80px_rgba(2,6,23,0.34)]'>
          <img src={generatedImage} alt='生成结果' className='h-full min-h-[354px] w-full rounded-[22px] object-contain' />
          <div className='absolute inset-3 flex items-end justify-between rounded-[22px] bg-[linear-gradient(180deg,transparent,rgba(15,23,42,0.42))] p-5 opacity-0 transition-opacity group-hover:opacity-100'>
            <div>
              <div className='text-[11px] uppercase tracking-[0.24em] text-white/80'>结果预览</div>
              <div className='mt-2 text-lg font-semibold text-white'>本次生成结果</div>
            </div>
            <button className='rounded-full bg-cyan-300 px-5 py-2 text-sm font-semibold text-slate-950 transition-transform hover:-translate-y-0.5 active:scale-95'>
              下载原图
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className='relative min-h-[380px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(10,18,33,0.92),rgba(15,25,41,0.86))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'>
        <div className='absolute right-10 top-10 h-28 w-28 rounded-full bg-cyan-300/[0.18] blur-3xl' />
        <div className='absolute left-8 top-14 h-24 w-24 rounded-full bg-blue-400/[0.16] blur-3xl' />
        <div className='grid h-full gap-4 md:grid-cols-[0.82fr_1.18fr]'>
          <div className='flex flex-col justify-between rounded-[26px] border border-white/[0.08] bg-[linear-gradient(180deg,#0d1524_0%,#111c2f_100%)] p-5 text-white'>
            <div>
              <div className='text-[11px] uppercase tracking-[0.26em] text-cyan-200/[0.70]'>视觉看板</div>
              <div className='mt-3 text-2xl font-semibold tracking-tight'>从提示词到视觉定调</div>
              <p className='mt-4 text-sm leading-7 text-slate-300'>
                更关注海报感、排版、材质与品牌氛围，不只是生成图片，而是在组织一张完整画面。
              </p>
            </div>
            <div className='flex flex-wrap gap-2'>
              <FeaturePill>编辑感</FeaturePill>
              <FeaturePill>材质层次</FeaturePill>
              <FeaturePill>海报氛围</FeaturePill>
            </div>
          </div>
          <div className='grid gap-4'>
            <div className='relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-[linear-gradient(145deg,#18263c_0%,#21314c_52%,#2f4767_100%)] p-5'>
              <div className='absolute right-4 top-4 rounded-full border border-white/[0.08] bg-white/[0.08] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-300'>
                主画面
              </div>
              <div className='mt-20 max-w-[280px] text-3xl font-semibold leading-tight tracking-tight text-white'>
                把一句灵感，长成一张真正有气氛的海报。
              </div>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div className='rounded-[24px] border border-white/[0.08] bg-white/[0.06] p-4'>
                <div className='text-[11px] uppercase tracking-[0.24em] text-slate-400'>材质</div>
                <div className='mt-3 text-sm leading-6 text-slate-300'>纸张颗粒、玻璃反射、柔和光晕与层次阴影。</div>
              </div>
              <div className='rounded-[24px] border border-white/[0.08] bg-white/[0.06] p-4'>
                <div className='text-[11px] uppercase tracking-[0.24em] text-slate-400'>氛围</div>
                <div className='mt-3 text-sm leading-6 text-slate-300'>更接近品牌提案，而不是普通的生成素材。</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  return (
    <div className='w-full overflow-hidden bg-[#070d18] pt-16 text-white'>
      <div className='flex h-[calc(100vh-64px)] w-full overflow-hidden'>
        <aside className='relative flex w-[308px] shrink-0 flex-col overflow-hidden border-r border-white/[0.08] bg-[#07111f]'>
          <div className='pointer-events-none absolute inset-0'>
            <div className='absolute inset-x-0 top-0 h-52 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_68%)]' />
            <div className='absolute bottom-0 left-0 h-60 w-60 rounded-full bg-cyan-500/[0.08] blur-3xl' />
            <div className='absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:30px_30px] opacity-40' />
          </div>

          <div className='relative z-10 px-6 pb-5 pt-7'>
            <div className='flex items-center gap-3'>
              <div className='flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/[0.10] bg-white/[0.06] shadow-[0_18px_50px_rgba(8,145,178,0.16)] backdrop-blur'>
                <Sparkles size={20} className='text-cyan-200' />
              </div>
              <div className='min-w-0'>
                <div className='text-[18px] font-semibold tracking-tight text-white'>LinkSky 创作中心</div>
                <div className='mt-1 text-xs tracking-[0.26em] text-slate-400'>CREATIVE OPERATING DECK</div>
              </div>
            </div>
            <p className='mt-5 max-w-[240px] text-sm leading-6 text-slate-400'>
              为对话、视觉和视频生成准备的一体化创作工作台。
            </p>
          </div>

          <div className='relative z-10 px-5'>
            <div className='rounded-[28px] border border-white/[0.08] bg-white/[0.04] p-2 backdrop-blur'>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() =>
                      switchTab(tab.id, tab.id === 'chat' ? 'chat1' : tab.id === 'video' ? 'v1' : 1)
                    }
                    className={`group relative flex w-full items-center gap-3 rounded-[22px] px-4 py-3.5 text-left transition-all ${
                      active
                        ? 'border border-cyan-300/[0.18] bg-cyan-300/[0.10] text-white shadow-[0_18px_45px_rgba(8,145,178,0.14)]'
                        : 'text-slate-300 hover:bg-white/[0.07] hover:text-white'
                    }`}
                  >
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all ${
                        active ? 'bg-slate-950/80 text-cyan-200' : 'bg-white/[0.08] text-slate-300'
                      }`}
                    >
                      <Icon size={20} strokeWidth={1.8} />
                    </div>
                    <div className='flex-1'>
                      <div className='text-sm font-semibold tracking-wide'>{tab.label}</div>
                      <div className={`mt-1 text-[11px] ${active ? 'text-slate-500' : 'text-slate-500 group-hover:text-slate-400'}`}>
                        {tab.id === 'chat' ? '推理与协作' : tab.id === 'image' ? '视觉与版式' : '镜头与节奏'}
                      </div>
                    </div>
                    {tab.badge && (
                      <span
                        className={`rounded-full px-2 py-1 text-[9px] font-bold tracking-[0.2em] ${
                          active ? 'bg-slate-950/80 text-cyan-200' : 'bg-cyan-400/[0.14] text-cyan-100'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className='relative z-10 px-6 pb-3 pt-7 text-[11px] uppercase tracking-[0.24em] text-slate-500'>
            模型列表
          </div>

          <div className='custom-scrollbar relative z-10 flex-1 space-y-3 overflow-y-auto px-5 pb-5'>
            {displayModels.map((model) => {
              const active = activeModel === model.id;
              return (
                <button
                  key={model.id}
                  onClick={() => setActiveModel(model.id)}
                  className={`w-full rounded-[24px] border p-4 text-left transition-all ${
                    active
                      ? 'border-cyan-300/[0.18] bg-[linear-gradient(135deg,rgba(34,211,238,0.14),rgba(255,255,255,0.06))] shadow-[0_22px_60px_rgba(6,182,212,0.12)]'
                      : 'border-white/[0.08] bg-white/5 hover:border-white/[0.14] hover:bg-white/[0.07]'
                  }`}
                >
                  <div className='flex items-start gap-3'>
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] ${active ? 'bg-slate-950/80 text-white' : 'bg-white/[0.08] text-slate-200'}`}>
                      {model.icon}
                    </div>
                    <div className='min-w-0'>
                      <div className='text-sm font-semibold tracking-wide text-white'>{model.name}</div>
                      <p className='mt-1 text-xs leading-5 text-slate-400'>{model.desc}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className='relative z-10 border-t border-white/[0.08] bg-white/[0.04] p-5'>
            <div className='rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04))] p-4 backdrop-blur'>
              <div className='flex items-center justify-between'>
                <div className='text-[11px] uppercase tracking-[0.22em] text-slate-500'>创作者席位</div>
                <span className='rounded-full border border-cyan-300/[0.18] bg-cyan-300/[0.08] px-2 py-1 text-[10px] tracking-[0.18em] text-cyan-100'>
                  在线
                </span>
              </div>
              <div className='mt-4 flex items-center justify-between gap-3'>
                <div className='flex items-center gap-3'>
                  <div className='relative'>
                    <div className='flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.12] bg-white/10 text-sm font-semibold text-white'>
                      L
                    </div>
                    <div className='absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#07111f] bg-cyan-300' />
                  </div>
                  <div>
                    <div className='text-sm font-semibold text-white'>创作者席位</div>
                    <div className='mt-1 text-xs text-slate-400'>今日灵感值 84</div>
                  </div>
                </div>
                <button className='rounded-full bg-gradient-to-r from-cyan-300 to-blue-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-[0_16px_40px_rgba(14,165,233,0.28)] transition-transform hover:-translate-y-0.5 active:scale-95'>
                  充值
                </button>
              </div>
            </div>
          </div>
        </aside>

        <main className='relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,#08111f_0%,#0c1729_42%,#101b2d_100%)]'>
          <div className='pointer-events-none absolute inset-0'>
            <div className='absolute left-[10%] top-[6%] h-72 w-72 rounded-full bg-cyan-400/[0.12] blur-3xl float-slow' />
            <div className='absolute right-[8%] top-[14%] h-64 w-64 rounded-full bg-blue-400/[0.10] blur-3xl float-delay' />
            <div className='absolute bottom-[18%] right-[18%] h-72 w-72 rounded-full bg-slate-300/[0.06] blur-3xl' />
            <div className='absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:44px_44px] opacity-30' />
          </div>

          {activeTab === 'chat' && (
            <div className='absolute left-8 top-6 z-20 flex items-center gap-2'>
              <button className='group flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-xs text-slate-200 backdrop-blur transition-all hover:bg-white/12'>
                <History size={15} className='text-slate-300' />
                历史记录
                <ChevronDown size={14} className='opacity-60 transition-transform group-hover:translate-y-0.5' />
              </button>
              <button className='flex items-center gap-1.5 rounded-full bg-cyan-300 px-4 py-2 text-xs font-semibold text-slate-950 shadow-[0_14px_40px_rgba(34,211,238,0.18)] transition-transform hover:-translate-y-0.5 active:scale-95'>
                <Plus size={16} strokeWidth={3} />
                新建会话
              </button>
            </div>
          )}

          <div className='custom-scrollbar relative z-10 flex flex-1 overflow-y-auto px-6 pb-36 pt-10 xl:px-10'>
            <div className='mx-auto flex w-full max-w-7xl flex-col gap-8'>
              <section className='grid gap-6 xl:grid-cols-[1.05fr_0.95fr]'>
                <div className='relative overflow-hidden rounded-[40px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(9,16,29,0.88),rgba(13,22,37,0.94))] p-8 shadow-[0_34px_120px_rgba(2,6,23,0.28)] xl:p-10'>
                  <div className='absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_38%),radial-gradient(circle_at_80%_20%,rgba(96,165,250,0.08),transparent_30%)]' />
                  <div className='relative'>
                    <div className='flex flex-wrap items-center gap-3'>
                      <FeaturePill tone='dark'>{currentCopy.eyebrow}</FeaturePill>
                      <span className='rounded-full border border-white/10 bg-white/[0.07] px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-300'>
                        {currentCopy.badge}
                      </span>
                    </div>
                    <div className='mt-8 max-w-[560px]'>
                      <h1 className='text-4xl font-semibold leading-[1.12] tracking-tight text-white xl:text-[54px]'>
                        {currentCopy.title}
                      </h1>
                      <p className='mt-5 max-w-[520px] text-base leading-8 text-slate-300'>{currentCopy.desc}</p>
                    </div>
                    <div className='mt-8 flex flex-wrap gap-2'>
                      {currentCopy.chips.map((chip) => (
                        <FeaturePill key={chip} tone='dark'>
                          {chip}
                        </FeaturePill>
                      ))}
                    </div>
                    <div className='mt-10 flex flex-wrap gap-3'>
                      <StageMetric value={currentCopy.primaryMetric} label={currentCopy.primaryLabel} />
                      <StageMetric value={currentCopy.secondaryMetric} label={currentCopy.secondaryLabel} />
                    </div>
                    <p className='mt-8 max-w-[480px] text-sm leading-7 text-slate-400'>{currentCopy.detail}</p>
                  </div>
                </div>

                <div className='relative overflow-hidden rounded-[40px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(13,22,37,0.78),rgba(16,27,45,0.68))] p-5 shadow-[0_34px_120px_rgba(2,6,23,0.24)] backdrop-blur xl:p-6'>
                  <div className='absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.08),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.08),transparent_38%)]' />
                  {renderStagePanel()}
                </div>
              </section>
            </div>
          </div>

          <div className='absolute bottom-6 left-1/2 z-20 w-full max-w-5xl -translate-x-1/2 px-6'>
            <div className='absolute -inset-x-10 -top-10 h-24 bg-[radial-gradient(circle,rgba(34,211,238,0.18),transparent_72%)] blur-3xl' />
            <div className='relative rounded-[34px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(8,15,28,0.88),rgba(12,20,34,0.82))] p-4 shadow-[0_30px_120px_rgba(2,6,23,0.30)] backdrop-blur-xl'>
              <div className='flex flex-wrap items-center justify-between gap-3 px-2'>
                <div className='flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400'>
                  <Sparkles size={14} className='text-cyan-500' />
                  提示词编辑器
                </div>
                <div className='rounded-full border border-white/[0.08] bg-white/[0.06] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300'>
                  {activeTab === 'chat' ? '对话模式' : activeTab === 'video' ? '视频模式' : '图片模式'}
                </div>
              </div>

              <div className='mt-3 flex gap-4 px-2'>
                {activeTab !== 'chat' && (
                  <button className='group flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-[22px] border border-dashed border-white/[0.12] bg-white/[0.05] text-slate-400 transition-all hover:border-cyan-300/[0.24] hover:bg-cyan-300/[0.08] hover:text-cyan-100'>
                    <Plus size={20} className='mb-1' />
                    <span className='text-[10px]'>{activeTab === 'video' ? '首帧' : '参考图'}</span>
                  </button>
                )}

                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder={
                    activeTab === 'chat'
                      ? '描述你的需求，或直接贴代码、文案、方案目标...'
                      : activeTab === 'video'
                        ? '描述镜头、动作、场景氛围与节奏，例如：雨夜街头，慢推镜头，电影感冷蓝色调...'
                        : '描述想生成的画面内容、风格、光线和构图，例如：高级感海报，柔和逆光，杂志版式...'
                  }
                  className='h-20 flex-1 resize-none bg-transparent py-2 text-[15px] leading-7 text-slate-100 outline-none placeholder:text-slate-500'
                />
              </div>

              <div className='mt-3 flex flex-wrap items-center justify-between gap-3 px-1'>
                <div className='flex flex-wrap gap-2'>
                  {activeTab !== 'chat' && (
                    <>
                      <DropButton
                        icon={<Layers size={12} />}
                        label={`${quantity} 张`}
                        open={isQuantityOpen}
                        onClick={() => {
                          setIsQuantityOpen(!isQuantityOpen);
                          setIsRatioOpen(false);
                          setIsResolutionOpen(false);
                          setIsDurationOpen(false);
                        }}
                      >
                        {isQuantityOpen && (
                          <div className='absolute bottom-full left-0 z-50 mb-3 flex w-[200px] flex-col rounded-[24px] border border-white/[0.08] bg-[#0d1524] py-2 shadow-2xl'>
                            <div className='border-b border-white/[0.06] px-4 py-2 text-xs font-semibold text-slate-100'>输出数量</div>
                            {[1, 3, 5, 10].map((num) => (
                              <button
                                key={num}
                                onClick={() => {
                                  setQuantity(num);
                                  setIsQuantityOpen(false);
                                }}
                                className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                                  quantity === num ? 'bg-cyan-300/[0.10] font-medium text-cyan-100' : 'text-slate-300 hover:bg-white/[0.06]'
                                }`}
                              >
                                <span>{num} 张</span>
                                {quantity === num && <Check size={14} />}
                              </button>
                            ))}
                            <div className='fixed inset-0 -z-10' onClick={() => setIsQuantityOpen(false)} />
                          </div>
                        )}
                      </DropButton>

                      <DropButton
                        icon={<Copy size={12} />}
                        label={ratio}
                        open={isRatioOpen}
                        onClick={() => {
                          setIsRatioOpen(!isRatioOpen);
                          setIsQuantityOpen(false);
                          setIsResolutionOpen(false);
                          setIsDurationOpen(false);
                        }}
                      >
                        {isRatioOpen && (
                          <div className='custom-scrollbar absolute bottom-full left-0 z-50 mb-3 flex max-h-64 w-[168px] flex-col overflow-y-auto rounded-[24px] border border-white/[0.08] bg-[#0d1524] py-2 shadow-2xl'>
                            {ratios.map((option) => (
                              <button
                                key={option}
                                onClick={() => {
                                  setRatio(option);
                                  setIsRatioOpen(false);
                                }}
                                className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                                  ratio === option ? 'bg-cyan-300/[0.10] font-medium text-cyan-100' : 'text-slate-300 hover:bg-white/[0.06]'
                                }`}
                              >
                                <span>{option}</span>
                                {ratio === option && <Check size={14} />}
                              </button>
                            ))}
                            <div className='fixed inset-0 -z-10' onClick={() => setIsRatioOpen(false)} />
                          </div>
                        )}
                      </DropButton>

                      {activeTab === 'video' ? (
                        <DropButton
                          icon={<Clock size={12} />}
                          label={duration}
                          open={isDurationOpen}
                          onClick={() => {
                            setIsDurationOpen(!isDurationOpen);
                            setIsQuantityOpen(false);
                            setIsRatioOpen(false);
                            setIsResolutionOpen(false);
                          }}
                        >
                          {isDurationOpen && (
                            <div className='absolute bottom-full left-0 z-50 mb-3 flex w-[132px] flex-col rounded-[24px] border border-white/[0.08] bg-[#0d1524] py-2 shadow-2xl'>
                              {durations.map((option) => (
                                <button
                                  key={option}
                                  onClick={() => {
                                    setDuration(option);
                                    setIsDurationOpen(false);
                                  }}
                                  className={`px-4 py-2.5 text-left text-sm ${
                                    duration === option ? 'bg-cyan-300/[0.10] font-medium text-cyan-100' : 'text-slate-300 hover:bg-white/[0.06]'
                                  }`}
                                >
                                  {option}
                                </button>
                              ))}
                              <div className='fixed inset-0 -z-10' onClick={() => setIsDurationOpen(false)} />
                            </div>
                          )}
                        </DropButton>
                      ) : (
                        <DropButton
                          icon={null}
                          label={resolution}
                          open={isResolutionOpen}
                          onClick={() => {
                            setIsResolutionOpen(!isResolutionOpen);
                            setIsQuantityOpen(false);
                            setIsRatioOpen(false);
                            setIsDurationOpen(false);
                          }}
                        >
                          {isResolutionOpen && (
                            <div className='absolute bottom-full left-0 z-50 mb-3 flex w-[128px] flex-col rounded-[24px] border border-white/[0.08] bg-[#0d1524] py-2 shadow-2xl'>
                              {imageResolutions.map((option) => (
                                <button
                                  key={option.value}
                                  onClick={() => {
                                    setResolution(option.value);
                                    setIsResolutionOpen(false);
                                  }}
                                  className={`px-4 py-2.5 text-left text-sm ${
                                    resolution === option.value ? 'bg-cyan-300/[0.10] font-medium text-cyan-100' : 'text-slate-300 hover:bg-white/[0.06]'
                                  }`}
                                >
                                  {option.label}
                                </button>
                              ))}
                              <div className='fixed inset-0 -z-10' onClick={() => setIsResolutionOpen(false)} />
                            </div>
                          )}
                        </DropButton>
                      )}
                    </>
                  )}
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={isGenerating || !prompt.trim()}
                  className='flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#22d3ee,#2563eb)] text-white shadow-[0_18px_50px_rgba(37,99,235,0.22)] transition-all hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none'
                >
                  {isGenerating ? <Loader2 size={20} className='animate-spin' /> : <ArrowUp size={22} strokeWidth={3} />}
                </button>
              </div>
            </div>
          </div>

          <style
            dangerouslySetInnerHTML={{
              __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.5); border-radius: 999px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(100, 116, 139, 0.8); }
                .float-slow { animation: floatSlow 10s ease-in-out infinite; }
                .float-delay { animation: floatSlow 12s ease-in-out infinite 1.2s; }
                .drift-card { animation: driftCard 8s ease-in-out infinite; }
                .drift-card-delay { animation: driftCard 9.5s ease-in-out infinite 1.3s; }
                .orbit-spin { animation: orbitSpin 18s linear infinite; }
                .pulse-glow { animation: pulseGlow 3.8s ease-in-out infinite; }
                @keyframes floatSlow {
                  0%, 100% { transform: translate3d(0, 0, 0); }
                  50% { transform: translate3d(0, 18px, 0); }
                }
                @keyframes driftCard {
                  0%, 100% { transform: translate3d(0, 0, 0); }
                  50% { transform: translate3d(0, -8px, 0); }
                }
                @keyframes orbitSpin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
                @keyframes pulseGlow {
                  0%, 100% { opacity: 0.42; transform: scale(1); }
                  50% { opacity: 0.9; transform: scale(1.04); }
                }
              `,
            }}
          />
        </main>
      </div>
    </div>
  );
}



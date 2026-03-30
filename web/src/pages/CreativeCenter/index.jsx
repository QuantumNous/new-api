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

import React, { useMemo, useState } from 'react';
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
  Video,
} from 'lucide-react';

const TABS = {
  chat: '聊天',
  image: '图片',
  video: '视频',
};

const chatModels = [
  {
    id: 'chat1',
    name: 'GPT-5.4',
    desc: 'GPT-5.4是OpenAI用于复杂专业工作的前沿模型，具备强大的深度推理...',
    activeBg:
      'bg-blue-50 border-l-[3px] border-l-blue-600 rounded-r-xl rounded-l-sm',
  },
];

const imageModels = [
  {
    id: 1,
    name: 'Nano Banana Pro',
    desc: '谷歌2025年最新视觉增强模型，拥有极其惊艳的文字排版能力...',
    icon: '🍌',
    activeBg:
      'bg-blue-50 border-l-[3px] border-l-blue-600 rounded-r-xl rounded-l-sm',
  },
  {
    id: 2,
    name: 'Nano Banana 2',
    desc: '谷歌推出的视觉模型基础版，针对日常应用场景优化...',
    icon: '🌙',
    activeBg:
      'bg-blue-50 border-l-[3px] border-l-blue-600 rounded-r-xl rounded-l-sm',
  },
];

const videoModels = [
  {
    id: 'v1',
    name: 'grok-video-3-plus',
    desc: 'Grok 推出的 Plus 级视频生成模型，支持多种时长与比例...',
    activeBg:
      'bg-blue-50 border-l-[3px] border-l-blue-600 rounded-r-xl rounded-l-sm',
  },
];

const imageResolutions = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '3K', label: '3K' },
];

const durations = ['10秒', '15秒', '20秒', '25秒'];
const ratios = [
  '自动',
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
  '21:9',
];

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
      d='M22.2819 9.8211a5.9847 5.9847 0 0 0-.5153-4.9066 6.0462 6.0462 0 0 0-3.9471-3.1358 6.0417 6.0417 0 0 0-5.1923 1.0689 6.0222 6.0222 0 0 0-4.385-1.9231 6.0464 6.0464 0 0 0-5.4604 3.4456 6.0536 6.0536 0 0 0-.8101 4.8906 6.0538 6.0538 0 0 0 3.1467 3.9573 6.0585 6.0585 0 0 0-1.065 5.2124 6.0545 6.0545 0 0 0 1.9292 4.3941 6.0513 6.0513 0 0 0 4.0011 1.6379 6.0106 6.0106 0 0 0 4.3389-1.8964 6.0562 6.0562 0 0 0 5.4628-3.4481 6.0519 6.0519 0 0 0 .8175-4.9088 6.0483 6.0483 0 0 0-3.1463-3.9429 6.0548 6.0548 0 0 0 1.0254-4.8882Zm-10.2819 11.1042a3.4298 3.4298 0 0 1-2.4357-1.006 3.4416 3.4416 0 0 1-.7185-1.5533l.1162-.0667 4.9883-2.8786a.3326.3326 0 0 0 .166-.2871v-7.0702l2.013 1.1621v5.9233a.3347.3347 0 0 0 .1661.2875l5.1326 2.9614a3.4351 3.4351 0 0 1-2.045 1.745 3.4082 3.4082 0 0 1-7.384-.2875Zm-8.4777-3.3403a3.4223 3.4223 0 0 1 .1865-2.6322 3.4405 3.4405 0 0 1 1.4875-1.5049l.1169.0678 4.9846 2.8846a.333.333 0 0 0 .3309 0l6.1227-3.5341-2.013-1.1621-5.1314 2.9646a.3332.3332 0 0 0-.1665.2875v-5.9208a3.4483 3.4483 0 0 1 .545-1.874 3.405 3.405 0 0 1 4.503-1.3171l.1158.0662-4.985 2.8792a.3326.3326 0 0 0-.166.2871v7.0702l-2.013-1.1621v-5.9233a.3347.3347 0 0 0-.1661-.2875l-5.1326-2.9614a3.4373 3.4373 0 0 1-1.8173-2.1832 3.4035 3.4035 0 0 1 2.0306-4.474Zm1.8763-12.429a3.4243 3.4243 0 0 1 2.6235-.191 3.4389 3.4389 0 0 1 1.5052 1.4883l-.1165.0673-4.9846 2.8846a.333.333 0 0 0 0 .3309l6.1226 3.5341 2.013-1.1621-2.9609-5.1312a.3332.3332 0 0 0-.2875-.1665h-5.9209a3.4482 3.4482 0 0 1-1.874-.545 3.405 3.405 0 0 1-1.3171-4.503l.0662-.1158 2.8792 4.985a.3326.3326 0 0 0 .2871.166h7.0702l-1.1621 2.013h-5.9233a.3347.3347 0 0 0-.2875.1661l-2.9614 5.1326a3.4373 3.4373 0 0 1-2.1832 1.8173 3.4035 3.4035 0 0 1-4.474-2.0306Zm15.101 0a3.4223 3.4223 0 0 1 .1865 2.6322 3.4405 3.4405 0 0 1-1.4875 1.5049l-.1169-.0678-4.9846-2.8846a.333.333 0 0 0-.3309 0l-6.1227 3.5341 2.013 1.1621 5.1314-2.9646a.3332.3332 0 0 0 .1665-.2875v5.9208a3.4483 3.4483 0 0 1-.545 1.874 3.405 3.405 0 0 1-4.503 1.3171l-.1158-.0662 4.985-2.8792a.3326.3326 0 0 0 .166-.2871v-7.0702l2.013 1.1621v5.9233a.3347.3347 0 0 0 .1661.2875l5.1326 2.9614a3.4373 3.4373 0 0 1 1.8173 2.1832 3.4035 3.4035 0 0 1-2.0306 4.474Zm-1.8763 12.429a3.4243 3.4243 0 0 1-2.6235.191 3.4389 3.4389 0 0 1-1.5052-1.4883l.1165-.0673 4.9846-2.8846a.333.333 0 0 0 0-.3309l-6.1226-3.5341-2.013 1.1621 2.9609 5.1312a.3332.3332 0 0 0 .2875.1665h5.9209a3.4482 3.4482 0 0 1 1.874.545 3.405 3.405 0 0 1 1.3171 4.503l-.0662.1158-2.8792-4.985a.3326.3326 0 0 0-.2871-.166h-7.0702l1.1621-2.013h-5.9233a.3347.3347 0 0 0 .2875-.1661l2.9614-5.1326a3.4373 3.4373 0 0 1 2.1832-1.8173 3.4035 3.4035 0 0 1 4.474 2.0306Z'
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

const createDemoImage = (prompt) => {
  const safePrompt = (prompt || '创作灵感').slice(0, 48).replace(/[<>&]/g, '');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="768" viewBox="0 0 1280 768">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#eff6ff"/>
          <stop offset="45%" stop-color="#dbeafe"/>
          <stop offset="100%" stop-color="#e2e8f0"/>
        </linearGradient>
        <linearGradient id="card" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#2563eb"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <rect width="1280" height="768" fill="url(#bg)"/>
      <circle cx="220" cy="180" r="120" fill="#93c5fd" opacity="0.35"/>
      <circle cx="1040" cy="620" r="180" fill="#bfdbfe" opacity="0.35"/>
      <rect x="110" y="96" width="1060" height="576" rx="36" fill="white" opacity="0.9"/>
      <rect x="170" y="156" width="420" height="456" rx="28" fill="url(#card)"/>
      <text x="220" y="248" fill="white" font-size="52" font-family="Arial, sans-serif" font-weight="700">LinkSky</text>
      <text x="220" y="314" fill="#dbeafe" font-size="28" font-family="Arial, sans-serif">创作中心 Demo Render</text>
      <text x="660" y="246" fill="#0f172a" font-size="48" font-family="Arial, sans-serif" font-weight="700">灵感预览</text>
      <text x="660" y="320" fill="#334155" font-size="30" font-family="Arial, sans-serif">${safePrompt}</text>
      <text x="660" y="390" fill="#64748b" font-size="24" font-family="Arial, sans-serif">上传文件中的页面内容已接入当前站点</text>
      <text x="660" y="430" fill="#64748b" font-size="24" font-family="Arial, sans-serif">这里展示的是站内演示图像生成效果</text>
      <rect x="660" y="500" width="210" height="56" rx="28" fill="#2563eb"/>
      <text x="710" y="537" fill="white" font-size="24" font-family="Arial, sans-serif">继续创作</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const MenuButton = ({ open, children, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
      open
        ? 'border-blue-200 bg-blue-100 text-blue-700'
        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
    }`}
  >
    {children}
  </button>
);

export default function CreativeCenter() {
  const [activeTab, setActiveTab] = useState(TABS.chat);
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
  const [duration, setDuration] = useState('10秒');

  const displayModels = useMemo(() => {
    if (activeTab === TABS.chat) {
      return chatModels.map((model) => ({
        ...model,
        icon: <GPTIcon size={28} className='text-blue-600' />,
      }));
    }
    if (activeTab === TABS.video) {
      return videoModels.map((model) => ({
        ...model,
        icon: <GrokIcon size={28} className='text-blue-600' />,
      }));
    }
    return imageModels;
  }, [activeTab]);

  const handleSubmit = async () => {
    if (!prompt.trim() || isGenerating) {
      return;
    }
    if (activeTab === TABS.image) {
      setIsGenerating(true);
      setGeneratedImage(null);
      await new Promise((resolve) => setTimeout(resolve, 900));
      setGeneratedImage(createDemoImage(prompt));
      setIsGenerating(false);
      return;
    }
    setPrompt('');
  };

  const switchTab = (tab, modelId) => {
    setActiveTab(tab);
    setActiveModel(modelId);
    setIsQuantityOpen(false);
    setIsRatioOpen(false);
    setIsResolutionOpen(false);
    setIsDurationOpen(false);
  };

  return (
    <div className='w-full bg-slate-50 pt-16'>
      <div className='flex min-h-[calc(100vh-64px)] flex-col overflow-hidden bg-slate-50 text-slate-800 xl:flex-row'>
        <div className='w-full shrink-0 border-b border-slate-200 bg-white xl:w-[280px] xl:border-b-0 xl:border-r'>
          <div className='flex items-center gap-3.5 px-5 py-6 sm:px-6 sm:py-7'>
            <img
              src='https://picui.ogmua.cn/s1/2026/03/26/69c4ddb5db12d.webp'
              alt='Logo'
              className='h-9 w-9 shrink-0 rounded-xl object-cover shadow-sm'
            />
            <h1 className='text-[17px] font-bold tracking-tight text-slate-900'>
              LinkSky 创作中心
            </h1>
          </div>

          <div className='flex justify-center gap-10 border-b border-slate-100 px-4 py-4'>
            <div
              onClick={() => switchTab(TABS.chat, 'chat1')}
              className={`flex cursor-pointer flex-col items-center gap-1.5 transition-colors ${
                activeTab === TABS.chat
                  ? 'text-blue-600'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <MessageSquare size={24} strokeWidth={1.5} />
              <span className='text-[13px] font-medium tracking-wide'>聊天</span>
            </div>
            <div
              onClick={() => switchTab(TABS.image, 1)}
              className={`flex cursor-pointer flex-col items-center gap-1.5 transition-colors ${
                activeTab === TABS.image
                  ? 'text-blue-600'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <ImageIcon size={24} strokeWidth={1.5} />
              <span className='text-[13px] font-medium tracking-wide'>图片</span>
            </div>
            <div
              onClick={() => switchTab(TABS.video, 'v1')}
              className={`relative flex cursor-pointer flex-col items-center gap-1.5 transition-colors ${
                activeTab === TABS.video
                  ? 'text-blue-600'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Video size={24} strokeWidth={1.5} />
              <span className='text-[13px] font-medium tracking-wide'>视频</span>
              <span className='absolute -right-5 -top-1.5 rounded-md bg-orange-500 px-1.5 py-[1px] text-[9px] font-bold text-white shadow-sm'>
                HOT
              </span>
            </div>
          </div>

          <div className='custom-scrollbar flex max-h-[320px] flex-col gap-2 overflow-y-auto px-3 py-3 xl:max-h-none xl:flex-1'>
            {displayModels.map((model) => (
              <div
                key={model.id}
                onClick={() => setActiveModel(model.id)}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-all duration-200 ${
                  activeModel === model.id
                    ? model.activeBg || 'border-blue-200 bg-blue-50 shadow-sm'
                    : 'border-transparent bg-transparent hover:bg-slate-50'
                }`}
              >
                <div
                  className={`mt-1 flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                    activeModel === model.id ? 'bg-blue-100' : 'bg-slate-100'
                  }`}
                >
                  {typeof model.icon === 'string' ? (
                    <span className='text-2xl'>{model.icon}</span>
                  ) : (
                    model.icon
                  )}
                </div>
                <div className='min-w-0 flex-1'>
                  <div className='mb-1 flex items-center justify-between'>
                    <span
                      className={`truncate pr-2 text-sm font-bold ${
                        activeModel === model.id
                          ? 'text-blue-900'
                          : 'text-slate-700'
                      }`}
                    >
                      {model.name}
                    </span>
                  </div>
                  <p className='line-clamp-2 text-[11px] leading-tight text-slate-500'>
                    {model.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className='border-t border-slate-100 bg-white p-4'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                <div className='relative'>
                  <div className='flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-blue-100 bg-blue-50'>
                    <span className='text-xl'>👩‍🦰</span>
                  </div>
                  <div className='absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500' />
                </div>
                <div>
                  <div className='flex items-center gap-1 text-sm font-medium text-slate-900'>
                    听雨的作家
                    <span className='rounded bg-slate-100 px-1 text-[9px] text-slate-500'>
                      Lv.1
                    </span>
                  </div>
                  <div className='mt-0.5 text-[10px] text-slate-400'>在线</div>
                </div>
              </div>
              <button className='rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95'>
                <span className='font-medium'>充值</span>
              </button>
            </div>
          </div>
        </div>

        <div className='relative flex min-h-[60vh] flex-1 flex-col bg-slate-50/50'>
          {activeTab === TABS.chat && (
            <div className='absolute left-4 top-4 z-20 flex items-center gap-2 sm:left-6'>
              <button className='group flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm transition-all hover:bg-slate-50'>
                <History size={16} className='text-slate-500' />
                历史
                <ChevronDown
                  size={14}
                  className='opacity-50 transition-transform group-hover:translate-y-0.5'
                />
              </button>
              <button className='flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-blue-700 active:scale-95'>
                <Plus size={16} strokeWidth={3} /> 新建对话
              </button>
            </div>
          )}

          <div className='custom-scrollbar flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-8 pt-20 sm:px-8 lg:px-10 xl:pb-32'>
            {activeTab === TABS.chat ? (
              <div className='flex max-w-2xl flex-col items-center text-center'>
                <div className='mb-10 text-blue-600 opacity-90'>
                  <GPTIcon size={100} className='drop-shadow-lg' />
                </div>
                <div className='rounded-3xl border border-slate-200 bg-white p-8 shadow-sm backdrop-blur-md'>
                  <p className='text-base font-light leading-relaxed text-slate-600'>
                    GPT-5.4是OpenAI用于复杂专业工作的前沿模型，具备强大的深度推理、多模态理解和工具调用能力，
                    <br />
                    适用于高难度分析、代码开发与创意写作。
                  </p>
                </div>
              </div>
            ) : activeTab === TABS.video ? (
              <div className='flex flex-col items-center text-center'>
                <div className='relative mb-8 text-blue-600'>
                  <GrokIcon size={90} className='drop-shadow-lg' />
                </div>
                <div className='max-w-[600px] rounded-3xl border border-slate-200 bg-white p-8 shadow-sm backdrop-blur-md'>
                  <p className='text-base font-light leading-relaxed text-slate-600'>
                    Grok 推出的 Plus 级视频生成模型，支持多种时长，覆盖 16:9、9:16、
                    <br />
                    3:2、2:3、1:1 全比例，适合社交媒体和创意短片场景。
                  </p>
                </div>
              </div>
            ) : (
              <div className='flex flex-col items-center text-center'>
                {isGenerating ? (
                  <div className='flex flex-col items-center gap-4'>
                    <Loader2 className='h-12 w-12 animate-spin text-blue-500' />
                    <p className='animate-pulse text-sm font-medium tracking-widest text-blue-600'>
                      调用 Imagen 4.0 生成中...
                    </p>
                  </div>
                ) : generatedImage ? (
                  <div className='group relative max-h-[70vh] max-w-4xl overflow-hidden rounded-3xl border border-slate-200 shadow-xl'>
                    <img
                      src={generatedImage}
                      alt='Generated'
                      className='h-full w-full bg-white object-contain'
                    />
                    <div className='absolute inset-0 flex items-center justify-center bg-slate-900/10 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100'>
                      <button className='rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-xl transition-all hover:bg-blue-700 active:scale-95'>
                        下载高清大图
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className='relative mb-8'>
                      <div className='absolute inset-0 scale-150 rounded-full bg-blue-400 opacity-10 blur-3xl' />
                      <span className='relative z-10 text-[85px] drop-shadow-md'>🍌</span>
                    </div>
                    <div className='rounded-3xl border border-slate-200 bg-white p-8 shadow-sm backdrop-blur-md'>
                      <p className='text-base font-light leading-relaxed text-slate-600'>
                        谷歌2025年最新视觉增强模型，拥有极其惊艳的文字排版能力，
                        <br />
                        擅长生成绚烂摄影、幽默风格与复杂视觉设计。
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className='mt-auto w-full max-w-4xl self-center px-4 pb-4 sm:px-6 xl:absolute xl:bottom-6 xl:left-1/2 xl:-translate-x-1/2'>
            <div className='relative flex flex-col rounded-[2rem] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/50 transition-all focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-500/5'>
              <div className='flex gap-4 px-2'>
                {activeTab !== TABS.chat && (
                  <button className='group flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 transition-colors hover:bg-slate-100'>
                    <Plus size={20} className='mb-1' />
                    <span className='text-[10px]'>
                      {activeTab === TABS.video ? '首帧' : '参考图'}
                    </span>
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
                    activeTab === TABS.chat
                      ? '描述你的需求或粘贴代码...'
                      : activeTab === TABS.video
                        ? '描述视频动作、场景及氛围...'
                        : '描述你想生成的图片内容...'
                  }
                  className='h-16 flex-1 resize-none bg-transparent py-2 text-[15px] leading-relaxed text-slate-800 outline-none placeholder:text-slate-400'
                />
              </div>

              <div className='mt-3 flex items-center justify-between px-1'>
                <div className='flex flex-wrap gap-2'>
                  {activeTab !== TABS.chat && (
                    <>
                      <div className='relative'>
                        <MenuButton
                          open={isQuantityOpen}
                          onClick={() => setIsQuantityOpen((open) => !open)}
                        >
                          <Layers size={12} /> {quantity}条
                          <span className='ml-1 text-[10px] text-slate-400'>
                            {isQuantityOpen ? '▲' : '▼'}
                          </span>
                        </MenuButton>
                        {isQuantityOpen && (
                          <div className='absolute bottom-full left-0 z-50 mb-3 flex w-[200px] flex-col rounded-2xl border border-slate-200 bg-white py-2 shadow-xl'>
                            <div className='mb-1 border-b border-slate-50 px-4 py-2'>
                              <div className='text-xs font-bold text-slate-900'>
                                数量选择
                              </div>
                            </div>
                            {[1, 3, 5, 10].map((num) => (
                              <button
                                key={num}
                                onClick={() => {
                                  setQuantity(num);
                                  setIsQuantityOpen(false);
                                }}
                                className={`flex items-center justify-between px-4 py-2 text-sm ${
                                  quantity === num
                                    ? 'bg-blue-50 font-medium text-blue-600'
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <span>{num}条</span>
                                {quantity === num && <Check size={14} />}
                              </button>
                            ))}
                            <div
                              className='fixed inset-0 -z-10'
                              onClick={() => setIsQuantityOpen(false)}
                            />
                          </div>
                        )}
                      </div>

                      <div className='relative'>
                        <MenuButton
                          open={isRatioOpen}
                          onClick={() => setIsRatioOpen((open) => !open)}
                        >
                          <Copy size={12} /> {ratio}
                          <span className='ml-1 text-[10px] text-slate-400'>
                            ▼
                          </span>
                        </MenuButton>
                        {isRatioOpen && (
                          <div className='custom-scrollbar absolute bottom-full left-0 z-50 mb-3 flex max-h-60 w-[160px] flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white py-2 shadow-xl'>
                            {ratios.map((option) => (
                              <button
                                key={option}
                                onClick={() => {
                                  setRatio(option);
                                  setIsRatioOpen(false);
                                }}
                                className={`flex items-center justify-between px-4 py-2 text-sm ${
                                  ratio === option
                                    ? 'bg-blue-50 font-medium text-blue-600'
                                    : 'text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <span>{option}</span>
                              </button>
                            ))}
                            <div
                              className='fixed inset-0 -z-10'
                              onClick={() => setIsRatioOpen(false)}
                            />
                          </div>
                        )}
                      </div>

                      {activeTab === TABS.video ? (
                        <div className='relative'>
                          <MenuButton
                            open={isDurationOpen}
                            onClick={() => setIsDurationOpen((open) => !open)}
                          >
                            <Clock size={12} /> {duration}
                            <span className='ml-1 text-[10px] text-slate-400'>
                              ▼
                            </span>
                          </MenuButton>
                          {isDurationOpen && (
                            <div className='absolute bottom-full left-0 z-50 mb-3 flex w-[120px] flex-col rounded-2xl border border-slate-200 bg-white py-2 shadow-xl'>
                              {durations.map((option) => (
                                <button
                                  key={option}
                                  onClick={() => {
                                    setDuration(option);
                                    setIsDurationOpen(false);
                                  }}
                                  className={`px-4 py-2 text-sm ${
                                    duration === option
                                      ? 'bg-blue-50 font-medium text-blue-600'
                                      : 'text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  {option}
                                </button>
                              ))}
                              <div
                                className='fixed inset-0 -z-10'
                                onClick={() => setIsDurationOpen(false)}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className='relative'>
                          <MenuButton
                            open={isResolutionOpen}
                            onClick={() =>
                              setIsResolutionOpen((open) => !open)
                            }
                          >
                            {resolution}
                            <span className='ml-1 text-[10px] text-slate-400'>
                              ▼
                            </span>
                          </MenuButton>
                          {isResolutionOpen && (
                            <div className='absolute bottom-full left-0 z-50 mb-3 flex w-[120px] flex-col rounded-2xl border border-slate-200 bg-white py-2 shadow-xl'>
                              {imageResolutions.map((option) => (
                                <button
                                  key={option.value}
                                  onClick={() => {
                                    setResolution(option.value);
                                    setIsResolutionOpen(false);
                                  }}
                                  className={`px-4 py-2 text-sm ${
                                    resolution === option.value
                                      ? 'bg-blue-50 font-medium text-blue-600'
                                      : 'text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  {option.label}
                                </button>
                              ))}
                              <div
                                className='fixed inset-0 -z-10'
                                onClick={() => setIsResolutionOpen(false)}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={isGenerating || !prompt.trim()}
                  className='ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none'
                >
                  {isGenerating ? (
                    <Loader2 size={22} className='animate-spin' />
                  ) : (
                    <ArrowUp size={24} strokeWidth={3} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <style
          dangerouslySetInnerHTML={{
            __html: `
              .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
              .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
              .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `,
          }}
        />
      </div>
    </div>
  );
}

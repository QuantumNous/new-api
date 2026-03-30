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

import React, { useMemo, useRef, useState } from 'react';
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

const apiKey = ''; // API key is injected by environment

const tabs = [
  { id: 'chat', label: '对话', icon: MessageSquare },
  { id: 'image', label: '图片', icon: ImageIcon },
  { id: 'video', label: '视频', icon: Video, badge: 'HOT' },
];

const ratios = ['自动', '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
const imageResolutions = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '3K', label: '3K' },
];
const durations = ['10秒', '15秒', '20秒', '25秒'];

const chatPromptSuggestions = [
  '帮我基于这段内容提炼 3 个关键观点，并给出可执行的行动清单：',
  '我需要一段用于产品页的文案（标题/卖点/CTA），语气偏专业但不枯燥：',
  '把下面这段话改写成更有说服力的版本，并给出 2 个不同风格的替代方案：',
];

const imagePromptSuggestions = [
  '以“现代科技风”为主题：浅色背景、冷色主调、极简版式，生成一张可用于官网首屏的主视觉，画面留出标题留白。',
  '海报主视觉提案：人物居中、柔光氛围、细腻质感、干净背景，包含清晰的轮廓与高级配色。',
  '电商详情页参考图：产品居中偏上构图，背景虚化，主色为蓝紫渐变，整体干净高级。',
];

const videoPromptSuggestions = [
  '镜头语言明确的 20 秒短片：从中景推进到特写，光线由冷转暖，节奏平稳，营造“未来感”的品牌氛围。',
  '广告预演：3 段镜头（开场/转场/收尾），强调产品质感与材质细节，整体使用柔和运动与留白字幕位。',
  '概念稿风格：低饱和电影质感，轻微胶片颗粒，镜头缓慢横移，情绪克制但具有张力。',
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
      d='M22.2819 9.8211a5.9847 5.9847 0 0 0-.5153-4.9066 6.0462 6.0462 0 0 0-3.9471-3.1358 6.0417 6.0417 0 0 0-5.1923 1.0689 6.0222 6.0222 0 0 0-4.385-1.9231 6.0464 6.0464 0 0 0-5.4604 3.4456 6.0536 6.0536 0 0 0-.8101 4.8906 6.0538 6.0538 0 0 0 3.1467 3.9573 6.0585 6.0585 0 0 0-1.065 5.2124 6.0545 6.0545 0 0 0 1.9292 4.3941 6.0513 6.0513 0 0 0 4.0011 1.6379 6.0106 6.0106 0 0 0 4.3389-1.8964 6.0562 6.0562 0 0 0 5.4628-3.4481 6.0519 6.0519 0 0 0 .8175-4.9088 6.0483 6.0483 0 0 0-3.1463-3.9429 6.0548 6.0548 0 0 0 1.0254-4.8882Zm-10.2819 11.1042a3.4298 3.4298 0 0 1-2.4357-1.006 3.4416 3.4416 0 0 1-.7185-1.5533l.1162-.0667 4.9883-2.8786a.3326.3326 0 0 0 .166-.2871v-7.0702l2.013 1.1621v5.9233a.3347.3347 0 0 0 .1661.2875l5.1326 2.9614a3.4351 3.4351 0 0 1-2.045 1.745 3.4082 3.4082 0 0 1-7.384-.2875Zm-8.4777-3.3403a3.4223 3.4223 0 0 1 .1865-2.6322 3.4405 3.4405 0 0 1 1.4875-1.5049l.1169.0678 4.9846 2.8846a.333.333 0 0 0 .3309 0l6.1227-3.5341-2.013-1.1621-5.1314 2.9646a.3332.3332 0 0 0-.1665.2875v-5.9208a3.4483 3.4483 0 0 1 .545-1.874 3.405 3.405 0 0 1 4.503-1.3171l.1158.0662-4.985 2.8792a.3326.3326 0 0 0-.166.2871v7.0702l-2.013-1.1621v-5.9233a.3347.3347 0 0 0-.1661-.2875l-5.1326-2.9614a3.4373 3.4373 0 0 1-1.8173-2.1832 3.4035 3.4035 0 0 1 2.0306-4.474Zm1.8763-12.429a3.4243 3.4243 0 0 1 2.6235-.191 3.4389 3.4389 0 0 1 1.5052 1.4883l-.1165.0673-4.9846 2.8846a.333.333 0 0 0 0 .3309l6.1226 3.5341 2.013-1.1621-2.9609-5.1312a.3332.3332 0 0 0-.2875-.1665h-5.9209a3.4482 3.4482 0 0 1-1.874-.545 3.405 3.405 0 0 1-1.3171-4.503l.0662-.1158 2.8792 4.985a.3326.3326 0 0 0 .2871.166h7.0702l-1.1621 2.013h-5.9233a.3347.3347 0 0 0-.2875.1661l-2.9614 5.1326a3.4373 3.4373 0 0 1-2.1832 1.8173 3.4035 3.4035 0 0 1-4.474-2.0306Zm15.101 0a3.4223 3.4223 0 0 1 .1865 2.6322 3.4405 3.4405 0 0 1-1.4875 1.5049l-.1169-.0678-4.9846-2.8846a.333.333 0 0 0-.3309 0l-6.1227 3.5341 2.013 1.1621 5.1314-2.9646a.3332.3332 0 0 0 .1665-.2875v5.9208a3.4483 3.4483 0 0 1-.545 1.874 3.405 3.405 0 0 1-4.503 1.3171l-.1158-.0662 4.985-2.8792a.3326.3326 0 0 0 .166-.2871v-7.0702l2.013 1.1621v5.9233a.3347.3347 0 0 0 .1661.2875l5.1326 2.9614a3.4373 3.4373 0 0 1 1.8173 2.1832 3.4035 3.4035 0 0 1-2.0306 4.474Zm-1.8763 12.429a3.4243 3.4243 0 0 1-2.6235.191 3.4389 3.4389 0 0 1-1.5052-1.4883l.1165-.0673 4.9846-2.8846a.333.333 0 0 0 0-.3309l-6.1226-3.5341-2.013 1.1621 2.9609 5.1312a.3332.3332 0 0 0 .2875-.1665h5.9209a3.4482 3.4482 0 0 1 1.874-.545 3.405 3.405 0 0 1 1.3171 4.503l-.0662-.1158-2.8792-4.985a.3326.3326 0 0 0-.2871-.166h-7.0702l1.1621-2.013h-5.9233a.3347.3347 0 0 0 .2875-.1661l2.9614-5.1326a3.4373 3.4373 0 0 1 2.1832-1.8173 3.4035 3.4035 0 0 1 4.474 2.0306Z'
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

const DropButton = ({ icon, label, open, onClick, children }) => (
  <div className='relative'>
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
        open
          ? 'border-blue-200 bg-blue-50 text-blue-700'
          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
      }`}
    >
      {icon}
      {label}
      <ChevronDown size={12} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {children}
  </div>
);

const chatModels = [
  {
    id: 'chat1',
    name: 'GPT-5.4',
    desc: '适合复杂推理、代码协作、长文生成与结构化分析。',
    icon: <GPTIcon size={28} className='text-blue-600' />,
  },
];

const imageModels = [
  {
    id: 1,
    name: 'Nano Banana Pro',
    desc: '偏商业视觉与版式表达，适合海报、封面和主视觉提案。',
    icon: <span className='text-lg font-semibold text-blue-600'>NB</span>,
  },
  {
    id: 2,
    name: 'Nano Banana 2',
    desc: '更轻量的探索模型，适合快速出图与创意迭代。',
    icon: <span className='text-lg font-semibold text-blue-600'>N2</span>,
  },
];

const videoModels = [
  {
    id: 'v1',
    name: 'grok-video-3-plus',
    desc: '适合镜头语言明确的短片、广告预演和动态概念稿。',
    icon: <GrokIcon size={28} className='text-blue-600' />,
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

export default function App() {
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
  const [duration, setDuration] = useState('10秒');

  const displayModels =
    activeTab === 'chat' ? chatModels : activeTab === 'video' ? videoModels : imageModels;

  const textareaRef = useRef(null);

  const currentModel = useMemo(() => {
    return displayModels.find((m) => m.id === activeModel);
  }, [activeModel, displayModels]);

  const promptSuggestions = useMemo(() => {
    if (activeTab === 'chat') return chatPromptSuggestions;
    if (activeTab === 'video') return videoPromptSuggestions;
    return imagePromptSuggestions;
  }, [activeTab]);

  const closeAllMenus = () => {
    setIsQuantityOpen(false);
    setIsRatioOpen(false);
    setIsResolutionOpen(false);
    setIsDurationOpen(false);
  };

  const switchTab = (tabId, modelId) => {
    setActiveTab(tabId);
    setActiveModel(modelId);
    setGeneratedImage(null);
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

  const renderWorkspace = () => {
    // 正在生成状态
    if (isGenerating) {
      return (
        <div className='relative w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-lg'>
          <div
            aria-hidden
            className='absolute inset-0 opacity-40'
            style={{
              backgroundImage:
                'radial-gradient(600px 120px at 20% 0%, rgba(59,130,246,0.20), transparent 55%), radial-gradient(520px 160px at 90% 20%, rgba(99,102,241,0.18), transparent 60%)',
            }}
          />
          <div className='relative flex flex-col items-center gap-4'>
            <div className='flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-600/10 text-blue-700'>
              <Loader2 className='h-8 w-8 animate-spin' />
            </div>
            <p className='text-sm font-semibold text-blue-700'>正在生成高质量图片</p>
            <p className='text-xs text-slate-500'>可能需要十几秒，请保持页面开启</p>
          </div>
        </div>
      );
    }

    // 已生成图片状态 (仅在图片 Tab 且有结果时显示)
    if (activeTab === 'image' && generatedImage) {
      return (
        <div className='group relative max-h-[70vh] max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl'>
          <img
            src={generatedImage}
            alt='生成结果'
            className='h-full w-full object-contain bg-white'
          />

          <div className='absolute inset-0 flex items-center justify-center bg-slate-900/10 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100'>
            <button className='rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-xl transition-all hover:bg-blue-700 active:scale-95'>
              下载高清原图
            </button>
          </div>

          <div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/50 via-slate-900/20 to-transparent px-5 pb-4 pt-8'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <div className='min-w-0'>
                <div className='truncate text-sm font-bold text-white'>生成结果</div>
                <div className='mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/80'>
                  <span>{quantity}张</span>
                  <span className='opacity-80'>{ratio}</span>
                  <span className='opacity-80'>{resolution}</span>
                </div>
              </div>
              <div className='flex items-center gap-2'>
                <span className='inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] text-white/90'>
                  <ImageIcon size={12} />
                  已就绪
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const title =
      activeTab === 'chat' ? '从一句话开始创作' : activeTab === 'video' ? '为你的镜头编排' : '把灵感变成画面';
    const subtitle =
      activeTab === 'chat'
        ? '选择模型后，直接输入需求。你也可以点击下面的示例快速填充。'
        : activeTab === 'video'
          ? '描述镜头语言、节奏与氛围。现在先把创意敲出来，下一步再生成。'
          : '补全风格、光线、构图和材质信息，系统会按你的参数进行生成。';

    const modelLine = currentModel?.name ? `当前模型：${currentModel.name}` : '当前模型：未选择';
    const parameterLine =
      activeTab === 'chat'
        ? '对话模式'
        : activeTab === 'video'
          ? `时长：${duration}`
          : `参数：${quantity}张 · ${ratio} · ${resolution}`;

    return (
      <div className='flex w-full max-w-4xl flex-col items-center gap-6 px-2'>
        <div className='relative w-full overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 shadow-lg'>
          <div
            aria-hidden
            className='absolute inset-0 opacity-50'
            style={{
              backgroundImage:
                'radial-gradient(680px 220px at 18% 10%, rgba(59,130,246,0.18), transparent 55%), radial-gradient(540px 180px at 88% 20%, rgba(99,102,241,0.14), transparent 60%)',
            }}
          />

          <div className='relative flex flex-col gap-3'>
            <div className='flex flex-wrap items-center gap-3'>
              <span className='inline-flex h-10 items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-2 text-sm font-semibold text-blue-700'>
                {activeTab === 'chat' ? <MessageSquare size={18} /> : null}
                {activeTab === 'image' ? <ImageIcon size={18} /> : null}
                {activeTab === 'video' ? <Video size={18} /> : null}
                {title}
              </span>
              <span className='inline-flex rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600'>
                {modelLine}
              </span>
            </div>

            <p className='text-sm leading-relaxed text-slate-600'>{subtitle}</p>

            <div className='mt-2 flex flex-wrap gap-2'>
              {promptSuggestions.map((text, idx) => (
                <button
                  type='button'
                  key={`${activeTab}-suggestion-${idx}`}
                  onClick={() => {
                    setPrompt(text);
                    textareaRef.current?.focus();
                  }}
                  className='rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99]'
                >
                  {text.length > 18 ? `${text.slice(0, 18)}...` : text}
                </button>
              ))}
            </div>

            <div className='mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500'>
              <span className='inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 ring-1 ring-slate-200'>
                <Layers size={14} className='text-slate-500' />
                {parameterLine}
              </span>
              {activeTab === 'image' ? (
                <span className='inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 ring-1 ring-slate-200'>
                  <Clock size={14} className='text-slate-500' />
                  通常需要稍等
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className='relative w-full overflow-hidden bg-slate-50 pt-16 text-slate-800'>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 opacity-70'
        style={{
          backgroundImage:
            'radial-gradient(900px 300px at 20% 0%, rgba(59,130,246,0.12), transparent 60%), radial-gradient(800px 320px at 90% 10%, rgba(99,102,241,0.10), transparent 55%)',
        }}
      />
      <div className='relative flex h-[calc(100vh-64px)] w-full overflow-hidden font-sans'>
        <aside className='flex w-[280px] shrink-0 flex-col border-r border-slate-200 bg-white'>
          <div className='flex items-center px-6 py-7'>
            <div>
              <h1 className='text-[18px] font-semibold tracking-tight text-slate-900'>创作中心</h1>
              <p className='mt-0.5 text-[12px] text-slate-500'>把想法快速变成可用内容</p>
            </div>
          </div>

          <div className='mb-2 flex justify-center gap-12 border-b border-slate-100 py-4'>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  type='button'
                  key={tab.id}
                  onClick={() =>
                    switchTab(tab.id, tab.id === 'chat' ? 'chat1' : tab.id === 'video' ? 'v1' : 1)
                  }
                  aria-pressed={active}
                  className={`relative flex cursor-pointer flex-col items-center gap-1.5 transition-colors ${
                    active ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Icon size={24} strokeWidth={1.5} />
                  <span className='text-[13px] font-medium tracking-wide'>{tab.label}</span>
                  {tab.badge && (
                    <span className='absolute -right-5 -top-1.5 rounded-md bg-orange-500 px-1.5 py-[1px] text-[9px] font-bold text-white shadow-sm'>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className='custom-scrollbar mt-2 flex-1 space-y-2 overflow-y-auto px-3 py-3'>
            {displayModels.map((model) => {
              const active = activeModel === model.id;
              return (
                <button
                  key={model.id}
                  onClick={() => setActiveModel(model.id)}
                  className={`flex w-full gap-3 rounded-xl border p-3 text-left transition-all duration-200 ${
                    active
                      ? 'rounded-l-sm rounded-r-xl border-l-[3px] border-l-blue-600 border-blue-200 bg-blue-50 shadow-sm'
                      : 'border-transparent bg-transparent hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`mt-1 flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                      active ? 'bg-blue-100' : 'bg-slate-100'
                    }`}
                  >
                    {model.icon}
                  </div>
                  <div className='min-w-0 flex-1'>
                    <div className={`mb-1 truncate pr-2 text-sm font-bold ${active ? 'text-blue-900' : 'text-slate-700'}`}>
                      {model.name}
                    </div>
                    <p className='text-[11px] leading-tight text-slate-500'>{model.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className='border-t border-slate-100 bg-white p-4'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                <div className='relative'>
                  <div className='flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50'>
                    <span className='text-[13px] font-bold text-blue-700'>NP</span>
                  </div>
                  <div className='absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500' />
                </div>
                <div>
                  <div className='flex items-center gap-1 text-sm font-medium text-slate-900'>
                    创作者席位
                    <span className='rounded bg-slate-100 px-1 text-[9px] text-slate-500'>Lv.1</span>
                  </div>
                  <div className='mt-0.5 text-[10px] text-slate-400'>在线</div>
                </div>
              </div>
              <button className='flex items-center gap-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110 active:scale-95'>
                <span className='font-medium'>充值</span>
              </button>
            </div>
          </div>
        </aside>

        <main className='relative flex min-w-0 flex-1 flex-col bg-slate-50/50'>
          {activeTab === 'chat' && (
            <div className='absolute left-6 top-4 z-20 flex items-center gap-2'>
              <button className='group flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm transition-all hover:bg-slate-50'>
                <History size={16} className='text-slate-500' />
                历史
                <ChevronDown size={14} className='opacity-50 transition-transform group-hover:translate-y-0.5' />
              </button>
              <button className='flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-blue-700 active:scale-95'>
                <Plus size={16} strokeWidth={3} />
                新对话
              </button>
            </div>
          )}

          <div className='custom-scrollbar flex flex-1 items-center justify-center overflow-y-auto px-10 pb-32 pt-10'>
            {renderWorkspace()}
          </div>

          <div className='absolute bottom-6 left-1/2 z-10 flex w-full max-w-4xl -translate-x-1/2 flex-col gap-2 px-6'>
            <div className='relative flex flex-col rounded-[2rem] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/50 transition-all focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-500/5'>
              <div className='flex gap-4 px-2'>
                {activeTab !== 'chat' && (
                  <button className='group flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 transition-colors hover:bg-slate-100'>
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
                  ref={textareaRef}
                  aria-label='输入内容'
                  placeholder={
                    activeTab === 'chat'
                      ? '描述你的需求，或直接粘贴代码、文案、方案目标...'
                      : activeTab === 'video'
                        ? '描述视频动作、场景、镜头语言与氛围节奏...'
                        : '描述你想生成的图片内容、风格、光线和构图...'
                  }
                  className='h-16 flex-1 resize-none bg-transparent py-2 text-[15px] leading-relaxed text-slate-800 outline-none placeholder:text-slate-400'
                />
              </div>

              <div className='mt-3 flex items-center justify-between gap-3 px-1'>
                <div className='flex flex-wrap items-center gap-2'>
                  {activeTab !== 'chat' && (
                    <>
                      <div className='mr-1 inline-flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200'>
                        <Layers size={12} className='text-slate-500' />
                        参数
                      </div>
                      <DropButton
                        icon={<Layers size={12} />}
                        label={`${quantity}张`}
                        open={isQuantityOpen}
                        onClick={() => {
                          setIsQuantityOpen(!isQuantityOpen);
                          setIsRatioOpen(false);
                          setIsResolutionOpen(false);
                          setIsDurationOpen(false);
                        }}
                      >
                        {isQuantityOpen && (
                          <div className='absolute bottom-full left-0 z-50 mb-3 flex w-[200px] flex-col rounded-2xl border border-slate-200 bg-white py-2 shadow-xl'>
                            <div className='mb-1 border-b border-slate-50 px-4 py-2'>
                              <div className='text-xs font-bold text-slate-900'>数量选择</div>
                            </div>
                            {[1, 3, 5, 10].map((num) => (
                              <button
                                key={num}
                                onClick={() => {
                                  setQuantity(num);
                                  setIsQuantityOpen(false);
                                }}
                                className={`flex items-center justify-between px-4 py-2 text-sm ${
                                  quantity === num ? 'bg-blue-50 font-medium text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <span>{num}张</span>
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
                          <div className='custom-scrollbar absolute bottom-full left-0 z-50 mb-3 flex max-h-60 w-[160px] flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white py-2 shadow-xl'>
                            {ratios.map((option) => (
                              <button
                                key={option}
                                onClick={() => {
                                  setRatio(option);
                                  setIsRatioOpen(false);
                                }}
                                className={`flex items-center justify-between px-4 py-2 text-sm ${
                                  ratio === option ? 'bg-blue-50 font-medium text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <span>{option}</span>
                                {ratio === option && <Check size={14} />}
                              </button>
                            ))}
                            <div className='fixed inset-0 z-40' onClick={() => setIsRatioOpen(false)} />
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
                            <div className='absolute bottom-full left-0 z-50 mb-3 flex w-[120px] flex-col rounded-2xl border border-slate-200 bg-white py-2 shadow-xl'>
                              {durations.map((option) => (
                                <button
                                  key={option}
                                  onClick={() => {
                                    setDuration(option);
                                    setIsDurationOpen(false);
                                  }}
                                  className={`px-4 py-2 text-left text-sm ${
                                    duration === option ? 'bg-blue-50 font-medium text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  {option}
                                </button>
                              ))}
                              <div className='fixed inset-0 z-40' onClick={() => setIsDurationOpen(false)} />
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
                            <div className='absolute bottom-full left-0 z-50 mb-3 flex w-[120px] flex-col rounded-2xl border border-slate-200 bg-white py-2 shadow-xl'>
                              {imageResolutions.map((option) => (
                                <button
                                  key={option.value}
                                  onClick={() => {
                                    setResolution(option.value);
                                    setIsResolutionOpen(false);
                                  }}
                                  className={`px-4 py-2 text-left text-sm ${
                                    resolution === option.value ? 'bg-blue-50 font-medium text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                                  }`}
                                >
                                  {option.label}
                                </button>
                              ))}
                              <div className='fixed inset-0 z-40' onClick={() => setIsResolutionOpen(false)} />
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
                  className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg transition-all hover:brightness-110 active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none'
                >
                  {isGenerating ? <Loader2 size={22} className='animate-spin' /> : <ArrowUp size={24} strokeWidth={3} />}
                </button>
              </div>

              <div className='mt-2 px-2 text-right text-[11px] text-slate-400'>
                Enter 发送 · Shift + Enter 换行
              </div>
            </div>
          </div>
        </main>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
          `,
        }}
      />
    </div>
  );
}

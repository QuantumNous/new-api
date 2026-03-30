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
  Plus,
  ArrowUp,
  Image as ImageIcon,
  MessageSquare,
  Video,
  Loader2,
  Layers,
  Check,
  Copy,
  Clock,
  History,
  ChevronDown,
} from 'lucide-react';

const apiKey = ''; // 环境变量会自动注入 API Key

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

export default function CreativeCenter() {
  const [activeTab, setActiveTab] = useState('聊天');
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

  const imageResolutions = [
    { value: '1K', label: '1K' },
    { value: '2K', label: '2K' },
    { value: '3K', label: '3K' },
  ];

  const durations = ['10秒', '15秒', '20秒', '25秒'];

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
        retries++;
      }
    }
  };

  const handleSubmit = async () => {
    if (!prompt.trim() || isGenerating) {
      return;
    }
    if (activeTab === '图片') {
      setIsGenerating(true);
      setGeneratedImage(null);
      try {
        const response = await fetchWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instances: { prompt: prompt },
              parameters: { sampleCount: 1 },
            }),
          },
        );
        if (response.predictions && response.predictions[0]) {
          setGeneratedImage(
            `data:image/png;base64,${response.predictions[0].bytesBase64Encoded}`,
          );
        }
      } catch (error) {
        console.error('Generate error', error);
      } finally {
        setIsGenerating(false);
      }
    } else {
      console.log('Chat prompt submitted:', prompt);
      setPrompt('');
    }
  };

  const chatModels = [
    {
      id: 'chat1',
      name: 'GPT-5.4',
      desc: 'GPT-5.4是OpenAI用于复杂专业工作的前沿模型，具备强大的深度推理...',
      icon: <GPTIcon size={28} className='text-blue-600' />,
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
      icon: <GrokIcon size={28} className='text-blue-600' />,
      activeBg:
        'bg-blue-50 border-l-[3px] border-l-blue-600 rounded-r-xl rounded-l-sm',
    },
  ];

  const displayModels =
    activeTab === '聊天'
      ? chatModels
      : activeTab === '视频'
        ? videoModels
        : imageModels;

  return (
    <div className='w-full bg-slate-50 pt-16'>
      <div className='flex h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-50 font-sans text-slate-800'>
        <div className='flex w-[280px] shrink-0 flex-col border-r border-slate-200 bg-white'>
          <div className='flex items-center gap-3.5 px-6 py-7'>
            <img
              src='https://picui.ogmua.cn/s1/2026/03/26/69c4ddb5db12d.webp'
              alt='Logo'
              className='h-9 w-9 shrink-0 rounded-xl object-cover shadow-sm'
            />
            <h1 className='text-[17px] font-bold tracking-tight text-slate-900'>
              LinkSky 创作中心
            </h1>
          </div>

          <div className='mb-2 flex justify-center gap-12 border-b border-slate-100 py-4'>
            <div
              onClick={() => {
                setActiveTab('聊天');
                setActiveModel('chat1');
              }}
              className={`flex cursor-pointer flex-col items-center gap-1.5 transition-colors ${
                activeTab === '聊天'
                  ? 'text-blue-600'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <MessageSquare size={24} strokeWidth={1.5} />
              <span className='text-[13px] font-medium tracking-wide'>聊天</span>
            </div>
            <div
              onClick={() => {
                setActiveTab('图片');
                setActiveModel(1);
              }}
              className={`flex cursor-pointer flex-col items-center gap-1.5 transition-colors ${
                activeTab === '图片'
                  ? 'text-blue-600'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <ImageIcon size={24} strokeWidth={1.5} />
              <span className='text-[13px] font-medium tracking-wide'>图片</span>
            </div>
            <div
              onClick={() => {
                setActiveTab('视频');
                setActiveModel('v1');
              }}
              className={`relative flex cursor-pointer flex-col items-center gap-1.5 transition-colors ${
                activeTab === '视频'
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

          <div className='custom-scrollbar mt-2 flex-1 space-y-2 overflow-y-auto px-3 py-3'>
            {displayModels.map((model) => (
              <div
                key={model.id}
                onClick={() => setActiveModel(model.id)}
                className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-all duration-200 ${
                  activeModel === model.id
                    ? model.activeBg || 'bg-blue-50 border-blue-200 shadow-sm'
                    : 'border-transparent bg-transparent hover:bg-slate-50'
                }`}
              >
                <div
                  className={`mt-1 flex h-10 w-10 items-center justify-center rounded-xl transition-colors opacity-100 ${
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
                    {model.tag && (
                      <span className='shrink-0 rounded border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-600'>
                        {model.tag}
                      </span>
                    )}
                  </div>
                  <p className='line-clamp-2 text-[11px] leading-tight text-slate-500'>
                    {model.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className='flex flex-col gap-4 border-t border-slate-100 bg-white p-4'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                <div className='relative'>
                  <div className='flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-blue-100 bg-blue-50'>
                    <span className='text-xl'>👩‍🦰</span>
                  </div>
                  <div className='absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500'></div>
                </div>
                <div>
                  <div className='flex items-center gap-1 text-sm font-medium text-slate-900'>
                    听雨的作家
                    <span className='bg-slate-100 px-1 text-[9px] text-slate-500'>
                      Lv.1
                    </span>
                  </div>
                  <div className='mt-0.5 flex items-center gap-1 text-[10px] text-slate-400'>
                    在线
                  </div>
                </div>
              </div>
              <button className='flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95'>
                <span className='font-medium'>充值</span>
              </button>
            </div>
          </div>
        </div>

        <div className='relative flex flex-1 flex-col bg-slate-50/50'>
          {activeTab === '聊天' && (
            <div className='absolute left-6 top-4 z-20 flex items-center gap-2'>
              <button className='group flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 transition-all shadow-sm hover:bg-slate-50'>
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

          <div className='custom-scrollbar flex flex-1 flex-col items-center justify-center overflow-y-auto px-10 pb-32'>
            {activeTab === '聊天' ? (
              <div className='flex max-w-2xl flex-col items-center text-center'>
                <div className='mb-10 text-blue-600 opacity-90'>
                  <GPTIcon size={100} className='drop-shadow-lg' />
                </div>
                <div className='rounded-3xl border border-slate-200 bg-white p-8 shadow-sm backdrop-blur-md'>
                  <p className='text-base font-light leading-relaxed text-slate-600'>
                    GPT-5.4是OpenAI用于复杂专业工作的前沿模型，具备强大的深度推理、多模态理解和工
                    <br />
                    具调用能力，适用于高难度分析、代码开发与创意写作。
                  </p>
                </div>
              </div>
            ) : activeTab === '视频' ? (
              <div className='flex flex-col items-center text-center'>
                <div className='relative mb-8 text-blue-600'>
                  <GrokIcon size={90} className='drop-shadow-lg' />
                </div>
                <div className='rounded-3xl border border-slate-200 bg-white p-8 shadow-sm backdrop-blur-md'>
                  <p className='max-w-[600px] text-base font-light leading-relaxed text-slate-600'>
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
                        ✨ 下载高清大图
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className='relative mb-8'>
                      <div className='absolute inset-0 scale-150 rounded-full bg-blue-400 opacity-10 blur-3xl'></div>
                      <span className='relative z-10 text-[85px] drop-shadow-md'>
                        🍌
                      </span>
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

          <div className='absolute bottom-6 left-1/2 z-10 flex w-full max-w-4xl -translate-x-1/2 flex-col gap-2 px-6'>
            <div className='relative flex flex-col rounded-[2rem] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/50 transition-all focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-500/5'>
              <div className='flex gap-4 px-2'>
                {activeTab !== '聊天' && (
                  <button className='group flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 transition-colors hover:bg-slate-100'>
                    <Plus size={20} className='mb-1' />
                    <span className='text-[10px]'>
                      {activeTab === '视频' ? '首帧' : '参考图'}
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
                    activeTab === '聊天'
                      ? '描述你的需求或粘贴代码...'
                      : activeTab === '视频'
                        ? '描述视频动作、场景及氛围...'
                        : '描述你想生成的图片内容...'
                  }
                  className='h-16 flex-1 resize-none bg-transparent py-2 text-[15px] leading-relaxed text-slate-800 outline-none placeholder:text-slate-400'
                ></textarea>
              </div>

              <div className='mt-3 flex items-center justify-between px-1'>
                <div className='flex flex-wrap gap-2'>
                  {activeTab !== '聊天' && (
                    <>
                      <div className='relative'>
                        <button
                          onClick={() => setIsQuantityOpen(!isQuantityOpen)}
                          className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition-all ${
                            isQuantityOpen
                              ? 'border-blue-200 bg-blue-100 text-blue-700'
                              : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <Layers size={12} /> {quantity}条
                          <span className='ml-1 text-[10px] text-slate-400'>
                            {isQuantityOpen ? '▲' : '▼'}
                          </span>
                        </button>
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
                            ></div>
                          </div>
                        )}
                      </div>
                      <div className='relative'>
                        <button
                          onClick={() => setIsRatioOpen(!isRatioOpen)}
                          className='flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-all hover:bg-slate-100'
                        >
                          <Copy size={12} /> {ratio}
                          <span className='ml-1 text-[10px] text-slate-400'>
                            ▼
                          </span>
                        </button>
                        {isRatioOpen && (
                          <div className='custom-scrollbar absolute bottom-full left-0 z-50 mb-3 flex max-h-60 w-[160px] flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white py-2 shadow-xl'>
                            {[
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
                            ].map((option) => (
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
                            ></div>
                          </div>
                        )}
                      </div>
                      {activeTab === '视频' ? (
                        <div className='relative'>
                          <button
                            onClick={() => setIsDurationOpen(!isDurationOpen)}
                            className='flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-all hover:bg-slate-100'
                          >
                            <Clock size={12} /> {duration}
                            <span className='ml-1 text-[10px] text-slate-400'>
                              ▼
                            </span>
                          </button>
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
                              ></div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className='relative'>
                          <button
                            onClick={() =>
                              setIsResolutionOpen(!isResolutionOpen)
                            }
                            className='flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-all hover:bg-slate-100'
                          >
                            {resolution}
                            <span className='ml-1 text-[10px] text-slate-400'>
                              ▼
                            </span>
                          </button>
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
                              ></div>
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
              .custom-scrollbar::-webkit-scrollbar { width: 4px; }
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

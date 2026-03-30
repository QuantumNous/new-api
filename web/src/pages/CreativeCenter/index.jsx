import React, { useMemo, useRef, useState, useEffect } from 'react';
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
  Download,
  Trash2,
  User,
  Sparkles,
  Send,
  X
} from 'lucide-react';
import { API } from '../../helpers';

const apiKey = ''; 

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

const GPTIcon = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' className={className}>
    <path d='M22.2819 9.8211a5.9847 5.9847 0 0 0-.5153-4.9066 6.0462 6.0462 0 0 0-3.9471-3.1358 6.0417 6.0417 0 0 0-5.1923 1.0689 6.0222 6.0222 0 0 0-4.385-1.9231 6.0464 6.0464 0 0 0-5.4604 3.4456 6.0536 6.0536 0 0 0-.8101 4.8906 6.0538 6.0538 0 0 0 3.1467 3.9573 6.0585 6.0585 0 0 0-1.065 5.2124 6.0545 6.0545 0 0 0 1.9292 4.3941 6.0513 6.0513 0 0 0 4.0011 1.6379 6.0106 6.0106 0 0 0 4.3389-1.8964 6.0562 6.0562 0 0 0 5.4628-3.4481 6.0519 6.0519 0 0 0 .8175-4.9088 6.0483 6.0483 0 0 0-3.1463-3.9429 6.0548 6.0548 0 0 0 1.0254-4.8882Z' fill='currentColor' />
  </svg>
);

const GrokIcon = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' className={className}>
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
        open ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
      }`}
    >
      {icon}
      {label}
      <ChevronDown size={12} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {children}
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [activeModel, setActiveModel] = useState('chat1');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [currentImage, setCurrentImage] = useState(null);
  const [openMenu, setOpenMenu] = useState(null); 
  const [params, setParams] = useState({
    quantity: 1,
    ratio: '1:1',
    resolution: '2K',
    duration: '10秒'
  });

  const textareaRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isGenerating]);
  const fallbackModels = useMemo(
    () => ({
      chat: [
        {
          id: 'chat1',
          name: 'Gemini 2.5 Flash',
          desc: '新一代极速模型，适合深度对话、创意写作与逻辑分析。',
          icon: <GPTIcon size={24} className='text-blue-600' />,
        },
      ],
      image: [
        {
          id: 'img1',
          name: 'Imagen 4.0 Pro',
          desc: '顶尖图像生成模型，支持极高的细节表现力与材质还原。',
          icon: <span className='font-bold text-blue-600'>IM</span>,
        },
      ],
      video: [
        {
          id: 'v1',
          name: 'Video Gen 3',
          desc: '动态视觉概念模型，支持生成流畅的高清短片素材。',
          icon: <GrokIcon size={24} className='text-blue-600' />,
        },
      ],
    }),
    [],
  );

  const [syncedModels, setSyncedModels] = useState({
    chat: [],
    image: [],
    video: [],
  });

  useEffect(() => {
    let mounted = true;

    const tabTagMap = {
      chat: ['文本', '对话', '聊天'],
      image: ['图片'],
      video: ['视频'],
    };

    const createModelCard = (model, tabKey) => {
      const iconMap = {
        chat: <GPTIcon size={24} className='text-blue-600' />,
        image: <span className='font-bold text-blue-600'>IM</span>,
        video: <GrokIcon size={24} className='text-blue-600' />,
      };

      const tags = String(model?.tags || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      return {
        id: model?.id || `${tabKey}-${model?.model_name || model?.name || Date.now()}`,
        name: model?.model_name || model?.name || '未命名模型',
        desc:
          model?.description ||
          (tags.length > 0 ? `标签：${tags.join('、')}` : '来自模型管理'),
        icon: iconMap[tabKey],
      };
    };

    const loadManagedModels = async () => {
      try {
        const res = await API.get('/api/models/?p=1&page_size=1000');
        const { success, data } = res.data || {};
        if (!success) return;

        const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        const nextModels = { chat: [], image: [], video: [] };

        items.forEach((item) => {
          if (item?.status !== undefined && Number(item.status) !== 1) return;

          const tags = String(item?.tags || '')
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean);

          Object.entries(tabTagMap).forEach(([tabKey, aliases]) => {
            if (aliases.some((alias) => tags.includes(alias))) {
              nextModels[tabKey].push(createModelCard(item, tabKey));
            }
          });
        });

        if (mounted) {
          setSyncedModels(nextModels);
        }
      } catch (error) {
        console.error('Failed to sync creative center models:', error);
      }
    };

    loadManagedModels();

    return () => {
      mounted = false;
    };
  }, []);

  const modelPools = useMemo(
    () => ({
      chat: syncedModels.chat.length > 0 ? syncedModels.chat : fallbackModels.chat,
      image: syncedModels.image.length > 0 ? syncedModels.image : fallbackModels.image,
      video: syncedModels.video.length > 0 ? syncedModels.video : fallbackModels.video,
    }),
    [fallbackModels, syncedModels],
  );

  const currentDisplayModels = modelPools[activeTab] || [];

  useEffect(() => {
    if (!currentDisplayModels.some((model) => model.id === activeModel)) {
      setActiveModel(currentDisplayModels[0]?.id || '');
    }
  }, [activeModel, currentDisplayModels]);

  const fetchGemini = async (userPrompt) => {
    const maxRetries = 5;
    const delays = [1000, 2000, 4000, 8000, 16000];
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: "你是一个专业的中文 AI 创作助手。你的回复应当充满创意、逻辑清晰且简洁有力。" }] }
          }),
        });
        if (!response.ok) throw new Error('API Request Failed');
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "收到，但我现在无法生成有效的回复。";
      } catch (e) {
        if (i === maxRetries - 1) return "服务目前负载过高，请稍后再试。";
        await new Promise(r => setTimeout(r, delays[i]));
      }
    }
  };

  const fetchImagen = async (imgPrompt) => {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: { prompt: imgPrompt },
          parameters: { sampleCount: 1 },
        }),
      });
      const data = await response.json();
      return data.predictions?.[0]?.bytesBase64Encoded ? `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}` : null;
    } catch (e) {
      console.error('Image Generation Error:', e);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!prompt.trim() || isGenerating) return;
    const currentPrompt = prompt;
    setPrompt('');
    setIsGenerating(true);

    if (activeTab === 'chat') {
      const userMsg = { role: 'user', content: currentPrompt, id: Date.now() };
      setChatMessages(prev => [...prev, userMsg]);
      const aiResponse = await fetchGemini(currentPrompt);
      setChatMessages(prev => [...prev, { role: 'assistant', content: aiResponse, id: Date.now() + 1 }]);
    } else if (activeTab === 'image') {
      setCurrentImage(null);
      const b64 = await fetchImagen(currentPrompt);
      if (b64) setCurrentImage(b64);
    } else if (activeTab === 'video') {
      await new Promise(r => setTimeout(r, 4000));
    }
    setIsGenerating(false);
  };

  return (
    <div className='flex h-screen w-full bg-slate-50 text-slate-800 font-sans overflow-hidden'>
      <aside className='flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white'>
        <div className='p-6'>
          <div className='flex items-center gap-2'>
            <div className='h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200'>
              <Sparkles size={20} />
            </div>
            <h1 className='text-xl font-black tracking-tight text-slate-900'>创作中心</h1>
          </div>
          <p className='mt-1.5 text-xs font-medium text-slate-400'>释放你的灵感与创意</p>
        </div>

        <nav className='flex justify-around border-b border-slate-100 pb-4 px-2'>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setOpenMenu(null);
                }}
                className={`relative flex flex-col items-center gap-1.5 transition-all ${active ? 'text-blue-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <div className={`p-2.5 rounded-2xl transition-colors ${active ? 'bg-blue-50' : 'bg-transparent'}`}>
                  <Icon size={22} strokeWidth={2.5} />
                </div>
                <span className='text-[12px] font-bold'>{tab.label}</span>
                {tab.badge && <span className='absolute -right-2 -top-1 rounded-full bg-orange-500 px-1.5 py-0.5 text-[8px] font-bold text-white shadow-sm'>{tab.badge}</span>}
              </button>
            );
          })}
        </nav>

        <div className='flex-1 overflow-y-auto px-4 py-6 space-y-4 custom-scrollbar'>
          <div className='text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-2'>核心创作模型</div>
          {currentDisplayModels.map((model) => (
            <button
              key={model.id}
              onClick={() => setActiveModel(model.id)}
              className={`w-full group flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                activeModel === model.id ? 'border-blue-200 bg-blue-50 shadow-sm' : 'border-transparent hover:bg-slate-50'
              }`}
            >
              <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${activeModel === model.id ? 'bg-white shadow-sm text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                {model.icon}
              </div>
              <div className='min-w-0'>
                <div className={`text-sm font-bold truncate ${activeModel === model.id ? 'text-blue-900' : 'text-slate-700'}`}>{model.name}</div>
                <p className='mt-1 text-[11px] leading-relaxed text-slate-500 line-clamp-2'>{model.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <main className='relative flex flex-1 flex-col overflow-hidden bg-white/40 backdrop-blur-md'>
        {activeTab === 'chat' && (
          <div className='flex flex-1 flex-col overflow-hidden'>
            <div ref={scrollRef} className='flex-1 overflow-y-auto px-8 py-10 space-y-6 custom-scrollbar'>
              {chatMessages.length === 0 && !isGenerating && (
                <div className='flex flex-col items-center justify-center h-full opacity-30 grayscale pointer-events-none'>
                  <MessageSquare size={80} className='text-blue-500 mb-4' />
                  <p className='text-sm font-black tracking-[0.2em]'>等待第一个灵感闪现</p>
                </div>
              )}
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-[1.5rem] px-5 py-3.5 shadow-sm transition-all ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-none shadow-blue-100' 
                      : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
                  }`}>
                    <p className='text-[15px] leading-relaxed whitespace-pre-wrap'>{msg.content}</p>
                  </div>
                </div>
              ))}
              {isGenerating && (
                <div className='flex justify-start animate-pulse'>
                  <div className='bg-white border border-slate-100 rounded-[1.5rem] rounded-tl-none px-5 py-3.5 flex gap-3 items-center text-slate-400 shadow-sm'>
                    <Loader2 size={18} className='animate-spin text-blue-500' />
                    <span className='text-xs font-bold tracking-widest uppercase'>正在深度思考...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab !== 'chat' && (
          <div className='flex-1 flex flex-col items-center justify-center p-10 relative'>
            {activeTab === 'image' && currentImage ? (
              <div className='group relative max-w-2xl w-full aspect-square bg-white rounded-[2.5rem] overflow-hidden border border-slate-200 shadow-2xl transition-all hover:scale-[1.01]'>
                <img src={currentImage} alt="Generated Art" className='w-full h-full object-cover' />
                <div className='absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-[2px]'>
                  <button className='p-4 bg-white rounded-full text-blue-600 hover:scale-110 transition-transform shadow-xl'><Download size={24} /></button>
                  <button className='p-4 bg-white rounded-full text-red-500 hover:scale-110 transition-transform shadow-xl' onClick={() => setCurrentImage(null)}><Trash2 size={24} /></button>
                </div>
              </div>
            ) : (
              <div className='text-center p-16 bg-white/60 rounded-[4rem] border-2 border-slate-200 border-dashed text-slate-400 max-w-lg'>
                <div className='bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6'>
                  {activeTab === 'image' ? <ImageIcon size={40} className='opacity-20' /> : <Video size={40} className='opacity-20' />}
                </div>
                <h3 className='text-xl font-black text-slate-700'>{activeTab === 'image' ? '视觉创意工坊' : '视频动力实验室'}</h3>
                <p className='text-sm mt-3 leading-relaxed'>在下方输入描述词，我们将为你实时渲染高精度的视觉素材。</p>
              </div>
            )}
            
            {isGenerating && (
              <div className='absolute inset-0 z-50 bg-white/80 backdrop-blur-xl flex flex-col items-center justify-center text-center p-10'>
                <div className='relative mb-8'>
                  <div className='h-32 w-32 rounded-[2.5rem] bg-blue-600/5 flex items-center justify-center border border-blue-100'>
                    <Loader2 size={56} className='animate-spin text-blue-600' />
                  </div>
                </div>
                <p className='text-2xl font-black text-blue-900 tracking-tight'>正在调配创意像素</p>
                <p className='text-slate-500 mt-2 font-medium'>这通常需要 10-15 秒的时间来完成渲染</p>
              </div>
            )}
          </div>
        )}

        <div className='p-8 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent'>
          <div className='mx-auto max-w-4xl'>
            <div className='relative flex flex-col rounded-[2.5rem] bg-white p-5 shadow-2xl shadow-blue-900/5 ring-1 ring-slate-200/80 focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-400 transition-all'>
              <div className='flex items-end gap-4 px-2'>
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmit())}
                  placeholder={activeTab === 'chat' ? "发送消息..." : "描述你想要的画面..."}
                  className='max-h-60 min-h-[60px] flex-1 resize-none bg-transparent py-3 text-[16px] font-medium leading-relaxed text-slate-800 outline-none placeholder:text-slate-300'
                />
                <button
                  onClick={handleSubmit}
                  disabled={isGenerating || !prompt.trim()}
                  className='flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl shadow-blue-200 transition-all hover:bg-blue-700 hover:scale-110 active:scale-95 disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none'
                >
                  {isGenerating ? <Loader2 size={28} className='animate-spin' /> : <ArrowUp size={32} strokeWidth={3} />}
                </button>
              </div>

              {activeTab !== 'chat' && (
                <div className='mt-5 flex items-center gap-3 border-t border-slate-50 pt-5 px-2'>
                   <DropButton label={`${params.quantity}张`} open={openMenu === 'qty'} onClick={() => setOpenMenu(openMenu === 'qty' ? null : 'qty')} icon={<Layers size={14} />} />
                   <DropButton label={params.ratio} open={openMenu === 'ratio'} onClick={() => setOpenMenu(openMenu === 'ratio' ? null : 'ratio')} icon={<Copy size={14} />} />
                   <div className='ml-auto text-[10px] text-slate-400 font-bold tracking-widest uppercase'>Enter 发送</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; }
      `}} />
    </div>
  );
}




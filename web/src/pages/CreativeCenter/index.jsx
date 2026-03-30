import React, { useContext, useMemo, useRef, useState, useEffect } from 'react';
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
import {
  API,
  buildApiPayload,
  getUserIdFromLocalStorage,
  processGroupsData,
  processThinkTags,
  showWarning,
} from '../../helpers';
import { API_ENDPOINTS } from '../../constants/playground.constants';
import { UserContext } from '../../context/User';

const tabs = [
  { id: 'chat', label: '对话', icon: MessageSquare },
  { id: 'image', label: '图片', icon: ImageIcon },
  { id: 'video', label: '视频', icon: Video, badge: 'HOT' },
];

const GROK_IMAGINE_IMAGE_MODELS = new Set([
  'grok-imagine-1.0',
  'grok-imagine-1.0-fast',
  'grok-imagine-1.0-edit',
]);
const ADOBE_IMAGE_MODELS = new Set([
  'nano-banana',
  'nano-banana-4k',
  'nano-banana2',
  'nano-banana2-4k',
  'nano-banana-pro',
  'nano-banana-pro-4k',
]);
const ADOBE_VIDEO_MODELS = new Set([
  'sora2',
  'sora2-pro',
  'veo31',
  'veo31-ref',
  'veo31-fast',
]);

const GROK_IMAGE_SIZE_OPTIONS = [
  { label: '1024x1024', value: '1024x1024' },
  { label: '1792x1024', value: '1792x1024' },
  { label: '1024x1792', value: '1024x1792' },
  { label: '1280x720', value: '1280x720' },
  { label: '720x1280', value: '720x1280' },
];
const ADOBE_IMAGE_ASPECT_RATIO_OPTIONS = [
  { label: 'Auto', value: 'auto' },
  { label: '1:1', value: '1:1' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
];
const ADOBE_AUTO_IMAGE_SIZE_OPTIONS = [
  { label: '1024x1024', value: '1024x1024' },
  { label: '1792x1024', value: '1792x1024' },
  { label: '1024x1792', value: '1024x1792' },
  { label: '2048x1536', value: '2048x1536' },
  { label: '1536x2048', value: '1536x2048' },
];
const ADOBE_OUTPUT_RESOLUTION_OPTIONS = [
  { label: '1K', value: '1K' },
  { label: '2K', value: '2K' },
];
const GENERIC_VIDEO_SIZE_OPTIONS = [
  { label: '1280x720', value: '1280x720' },
  { label: '720x1280', value: '720x1280' },
  { label: '1792x1024', value: '1792x1024' },
  { label: '1024x1792', value: '1024x1792' },
  { label: '1024x1024', value: '1024x1024' },
];
const GENERIC_VIDEO_SECONDS_OPTIONS = [6, 8, 10, 12, 15, 20, 25, 30].map(
  (value) => ({ label: `${value}s`, value: String(value) }),
);
const GENERIC_VIDEO_QUALITY_OPTIONS = [
  { label: '480p', value: '480p' },
  { label: '720p', value: '720p' },
];
const GROK_VIDEO_PRESET_OPTIONS = [
  { label: 'Normal', value: 'normal' },
  { label: 'Fun', value: 'fun' },
  { label: 'Spicy', value: 'spicy' },
  { label: 'Custom', value: 'custom' },
];
const ADOBE_VIDEO_DURATION_OPTIONS = {
  sora: [4, 8, 12].map((value) => ({ label: `${value}s`, value: String(value) })),
  veo: [4, 6, 8].map((value) => ({ label: `${value}s`, value: String(value) })),
};
const ADOBE_VIDEO_ASPECT_RATIO_OPTIONS = [
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
];
const ADOBE_VIDEO_RESOLUTION_OPTIONS = [
  { label: '1080p', value: '1080p' },
  { label: '720p', value: '720p' },
];
const ADOBE_REFERENCE_MODE_OPTIONS = [
  { label: 'Frame', value: 'frame' },
  { label: 'Image', value: 'image' },
];
const PARAMETER_TOGGLES_DISABLED = {
  temperature: false,
  top_p: false,
  max_tokens: false,
  frequency_penalty: false,
  presence_penalty: false,
  seed: false,
};

const normalizeGrokImageSize = (size) => {
  if (size === '1536x1024') {
    return '1792x1024';
  }
  if (size === '1024x1536') {
    return '1024x1792';
  }
  return size;
};

const getOptionLabel = (options, value) =>
  options.find((option) => option.value === value)?.label || value;

const extractVideoUrlFromMessage = (content) => {
  if (typeof content !== 'string') {
    return '';
  }

  const htmlMatch = content.match(/<video[^>]+src=['"]([^'"]+)['"]/i);
  if (htmlMatch?.[1]) {
    return htmlMatch[1];
  }

  const markdownMatch = content.match(/\((https?:\/\/[^)\s]+)\)/i);
  if (markdownMatch?.[1]) {
    return markdownMatch[1];
  }

  const plainUrlMatch = content.match(/https?:\/\/[^\s'"]+/i);
  return plainUrlMatch?.[0] || '';
};

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

const DropSelectButton = ({
  menuKey,
  icon,
  label,
  value,
  options,
  openMenu,
  setOpenMenu,
  onSelect,
  widthClass = 'w-40',
}) => (
  <DropButton
    icon={icon}
    label={label}
    open={openMenu === menuKey}
    onClick={() => setOpenMenu(openMenu === menuKey ? null : menuKey)}
  >
    {openMenu === menuKey && (
      <div
        className={`absolute bottom-12 left-0 z-20 ${widthClass} rounded-2xl border border-slate-200 bg-white p-2 shadow-xl`}
      >
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => {
              onSelect(option.value);
              setOpenMenu(null);
            }}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition ${
              value === option.value
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>{option.label}</span>
            {value === option.value ? <Check size={14} /> : null}
          </button>
        ))}
      </div>
    )}
  </DropButton>
);

export default function App() {
  const [userState] = useContext(UserContext);
  const [activeTab, setActiveTab] = useState('chat');
  const [activeModel, setActiveModel] = useState('chat1');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [currentImage, setCurrentImage] = useState(null);
  const [videoTask, setVideoTask] = useState(null);
  const [activeGroup, setActiveGroup] = useState('');
  const [openMenu, setOpenMenu] = useState(null);
  const [params, setParams] = useState({
    imageSize: '1024x1024',
    aspectRatio: 'auto',
    autoImageSize: '1024x1024',
    outputResolution: '2K',
    videoSize: '1280x720',
    videoSeconds: '10',
    videoQuality: '480p',
    videoPreset: 'normal',
    videoDuration: '4',
    videoResolution: '1080p',
    referenceMode: 'frame',
  });

  const textareaRef = useRef(null);
  const scrollRef = useRef(null);
  const isLoggedIn = Boolean(userState?.user);

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
          name: 'GPT-4o',
          desc: '通用旗舰模型，适合对话问答、写作整理与多场景创作。',
          icon: <GPTIcon size={24} className='text-blue-600' />,
        },
      ],
      image: [
        {
          id: 'img1',
          name: 'FLUX',
          desc: '高质量图片生成模型，适合海报、插画与视觉概念创作。',
          icon: <span className='font-bold text-blue-600'>IM</span>,
        },
      ],
      video: [
        {
          id: 'v1',
          name: 'grok-video-3-plus',
          desc: '视频生成模型，适合生成短片分镜、动态概念与创意演示。',
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

    const inferTabsFromModelName = (modelName) => {
      const normalizedName = String(modelName || '').toLowerCase();
      const videoKeywords = [
        'video',
        'veo',
        'sora',
        'kling',
        'runway',
        'pixverse',
        'hailuo',
        'wanx',
        'mov',
      ];
      const imageKeywords = [
        'image',
        'img',
        'imagen',
        'imagine',
        'flux',
        'stable-diffusion',
        'sdxl',
        'midjourney',
        'mj',
        'banana',
      ];

      if (videoKeywords.some((keyword) => normalizedName.includes(keyword))) {
        return ['video'];
      }

      if (imageKeywords.some((keyword) => normalizedName.includes(keyword))) {
        return ['image'];
      }

      return ['chat'];
    };

    const resolveTabsForModel = (modelName, model) => {
      const tags = String(model?.tags || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      const endpointTypes = Array.isArray(model?.supported_endpoint_types)
        ? model.supported_endpoint_types
        : [];
      const normalizedEndpoints = endpointTypes.map((type) =>
        String(type || '').toLowerCase(),
      );

      const matchedTabs = Object.entries(tabTagMap)
        .filter(([, aliases]) => aliases.some((alias) => tags.includes(alias)))
        .map(([tabKey]) => tabKey);

      if (matchedTabs.length > 0) {
        return matchedTabs;
      }

      if (normalizedEndpoints.some((endpoint) => endpoint.includes('video'))) {
        return ['video'];
      }

      if (
        normalizedEndpoints.some(
          (endpoint) =>
            endpoint.includes('image') || endpoint.includes('images'),
        )
      ) {
        return ['image'];
      }

      return inferTabsFromModelName(modelName);
    };

    const createModelCard = (model, tabKey, modelName) => {
      const iconMap = {
        chat: <GPTIcon size={24} className='text-blue-600' />,
        image: <span className='font-bold text-blue-600'>IM</span>,
        video: <GrokIcon size={24} className='text-blue-600' />,
      };

      const tags = String(model?.tags || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      const resolvedModelName = model?.model_name || model?.name || modelName || '未命名模型';

      return {
        id: `${tabKey}:${resolvedModelName}`,
        value: resolvedModelName,
        name: resolvedModelName,
        desc:
          model?.description ||
          (tags.length > 0 ? `标签：${tags.join('、')}` : '来自模型管理'),
        icon: iconMap[tabKey],
      };
    };

    const loadManagedModels = async () => {
      try {
        const [pricingResult, userModelsResult, userGroupsResult] =
          await Promise.allSettled([
            API.get('/api/pricing', { skipErrorHandler: true }),
            isLoggedIn
              ? API.get(API_ENDPOINTS.USER_MODELS, { skipErrorHandler: true })
              : Promise.resolve({ data: { success: false, data: [] } }),
            isLoggedIn
              ? API.get(API_ENDPOINTS.USER_GROUPS, { skipErrorHandler: true })
              : Promise.resolve({ data: { success: false, data: {} } }),
          ]);

        const pricingModels =
          pricingResult.status === 'fulfilled' && pricingResult.value?.data?.success
            ? (Array.isArray(pricingResult.value.data.data)
                ? pricingResult.value.data.data
                : [])
            : [];

        const userModels =
          userModelsResult.status === 'fulfilled' && userModelsResult.value?.data?.success
            ? (Array.isArray(userModelsResult.value.data.data)
                ? userModelsResult.value.data.data
                : [])
            : [];

        const pricingModelMap = new Map();
        pricingModels.forEach((item) => {
          const modelName = item?.model_name || item?.name;
          if (modelName) {
            pricingModelMap.set(modelName, item);
          }
        });

        const visibleModelNames =
          isLoggedIn && userModels.length > 0
            ? userModels
            : pricingModels
                .map((item) => item?.model_name || item?.name || '')
                .filter(Boolean);

        const nextModels = { chat: [], image: [], video: [] };
        visibleModelNames.forEach((modelName) => {
          const pricingModel = pricingModelMap.get(modelName);
          const tabsForModel = resolveTabsForModel(modelName, pricingModel);

          tabsForModel.forEach((tabKey) => {
            nextModels[tabKey].push(
              createModelCard(
                pricingModel || { model_name: modelName },
                tabKey,
                modelName,
              ),
            );
          });
        });

        const dedupedModels = Object.fromEntries(
          Object.entries(nextModels).map(([tabKey, list]) => [
            tabKey,
            list.filter(
              (model, index, array) =>
                array.findIndex((item) => item.value === model.value) === index,
            ),
          ]),
        );

        let resolvedGroup = '';
        const localUserGroup = (() => {
          try {
            return JSON.parse(localStorage.getItem('user') || '{}')?.group || '';
          } catch {
            return '';
          }
        })();

        if (
          isLoggedIn &&
          userGroupsResult.status === 'fulfilled' &&
          userGroupsResult.value?.data?.success
        ) {
          const groupOptions = processGroupsData(
            userGroupsResult.value.data.data || {},
            localUserGroup,
          );
          resolvedGroup =
            groupOptions.find((group) => group.value === localUserGroup)?.value ||
            groupOptions[0]?.value ||
            localUserGroup;
        } else {
          resolvedGroup = localUserGroup;
        }

        if (mounted) {
          setSyncedModels(dedupedModels);
          setActiveGroup(resolvedGroup);
        }
      } catch (error) {
        console.error('Failed to sync creative center models:', error);
      }
    };

    loadManagedModels();

    return () => {
      mounted = false;
    };
  }, [isLoggedIn]);

  const modelPools = useMemo(
    () => ({
      chat: syncedModels.chat.length > 0 ? syncedModels.chat : fallbackModels.chat,
      image: syncedModels.image.length > 0 ? syncedModels.image : fallbackModels.image,
      video: syncedModels.video.length > 0 ? syncedModels.video : fallbackModels.video,
    }),
    [fallbackModels, syncedModels],
  );

  const currentDisplayModels = modelPools[activeTab] || [];
  const selectedModel =
    currentDisplayModels.find((model) => model.id === activeModel) ||
    currentDisplayModels[0] ||
    null;
  const currentModelName = selectedModel?.value || selectedModel?.name || '';
  const isGrokImagineImageModel =
    GROK_IMAGINE_IMAGE_MODELS.has(currentModelName);
  const isAdobeImageModel = ADOBE_IMAGE_MODELS.has(currentModelName);
  const isAdobeImage4KModel =
    typeof currentModelName === 'string' && currentModelName.endsWith('-4k');
  const isAdobeVideoModel = ADOBE_VIDEO_MODELS.has(currentModelName);
  const isAdobeSoraModel =
    currentModelName === 'sora2' || currentModelName === 'sora2-pro';
  const isAdobeVeoModel =
    currentModelName === 'veo31' ||
    currentModelName === 'veo31-ref' ||
    currentModelName === 'veo31-fast';
  const isVideoModel =
    typeof currentModelName === 'string' && currentModelName.includes('video');
  const isGrokImagineVideoModel = currentModelName === 'grok-imagine-1.0-video';

  useEffect(() => {
    if (!currentDisplayModels.some((model) => model.id === activeModel)) {
      setActiveModel(currentDisplayModels[0]?.id || '');
    }
  }, [activeModel, currentDisplayModels]);

  useEffect(() => {
    setParams((prev) => {
      const next = { ...prev };

      if (
        isGrokImagineImageModel &&
        !GROK_IMAGE_SIZE_OPTIONS.some((option) => option.value === next.imageSize)
      ) {
        next.imageSize = '1024x1024';
      }

      if (isAdobeImageModel) {
        if (
          !ADOBE_IMAGE_ASPECT_RATIO_OPTIONS.some(
            (option) => option.value === next.aspectRatio,
          )
        ) {
          next.aspectRatio = 'auto';
        }
        if (
          !ADOBE_AUTO_IMAGE_SIZE_OPTIONS.some(
            (option) => option.value === next.autoImageSize,
          )
        ) {
          next.autoImageSize = '1024x1024';
        }
        if (isAdobeImage4KModel) {
          next.outputResolution = '4K';
        } else if (
          !ADOBE_OUTPUT_RESOLUTION_OPTIONS.some(
            (option) => option.value === next.outputResolution,
          )
        ) {
          next.outputResolution = '2K';
        }
      }

      if (isVideoModel && !isAdobeVideoModel) {
        if (
          !GENERIC_VIDEO_SIZE_OPTIONS.some(
            (option) => option.value === next.videoSize,
          )
        ) {
          next.videoSize = '1280x720';
        }
        if (
          !GENERIC_VIDEO_SECONDS_OPTIONS.some(
            (option) => option.value === next.videoSeconds,
          )
        ) {
          next.videoSeconds = '10';
        }
        if (
          !GENERIC_VIDEO_QUALITY_OPTIONS.some(
            (option) => option.value === next.videoQuality,
          )
        ) {
          next.videoQuality = '480p';
        }
        if (
          !GROK_VIDEO_PRESET_OPTIONS.some(
            (option) => option.value === next.videoPreset,
          )
        ) {
          next.videoPreset = 'normal';
        }
      }

      if (isAdobeVideoModel) {
        const durationOptions = isAdobeSoraModel
          ? ADOBE_VIDEO_DURATION_OPTIONS.sora
          : ADOBE_VIDEO_DURATION_OPTIONS.veo;
        if (
          !durationOptions.some((option) => option.value === next.videoDuration)
        ) {
          next.videoDuration = durationOptions[0]?.value || '4';
        }
        if (
          !ADOBE_VIDEO_ASPECT_RATIO_OPTIONS.some(
            (option) => option.value === next.aspectRatio,
          )
        ) {
          next.aspectRatio = '16:9';
        }
        if (
          isAdobeVeoModel &&
          !ADOBE_VIDEO_RESOLUTION_OPTIONS.some(
            (option) => option.value === next.videoResolution,
          )
        ) {
          next.videoResolution = '1080p';
        }
        if (
          currentModelName === 'veo31' &&
          !ADOBE_REFERENCE_MODE_OPTIONS.some(
            (option) => option.value === next.referenceMode,
          )
        ) {
          next.referenceMode = 'frame';
        }
      }

      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });
  }, [
    currentModelName,
    isAdobeImage4KModel,
    isAdobeImageModel,
    isAdobeSoraModel,
    isAdobeVeoModel,
    isAdobeVideoModel,
    isGrokImagineImageModel,
    isVideoModel,
  ]);

  const createCreativeInputs = () => ({
    model: currentModelName,
    group: activeGroup,
    stream: false,
    imageSize: normalizeGrokImageSize(params.imageSize),
    aspectRatio: params.aspectRatio,
    autoImageSize: params.autoImageSize,
    outputResolution: isAdobeImage4KModel ? '4K' : params.outputResolution,
    videoSize: params.videoSize,
    videoSeconds: params.videoSeconds,
    videoQuality: params.videoQuality,
    videoPreset: params.videoPreset,
    videoDuration: params.videoDuration,
    videoResolution: params.videoResolution,
    referenceMode: params.referenceMode,
  });

  const createBasePayload = (currentPrompt) => {
    return buildApiPayload(
      [{ role: 'user', content: currentPrompt }],
      '',
      createCreativeInputs(),
      PARAMETER_TOGGLES_DISABLED,
    );
  };

  const postCreativeRequest = async (endpoint, payload) => {
    const response = await API.post(endpoint, payload, {
      headers: {
        'New-API-User': getUserIdFromLocalStorage(),
      },
    });
    return response.data;
  };

  const handleSubmit = async () => {
    if (!prompt.trim() || isGenerating) return;
    if (!isLoggedIn) {
      showWarning('\u8bf7\u5148\u767b\u5f55\u540e\u518d\u4f7f\u7528\u521b\u4f5c\u4e2d\u5fc3');
      window.setTimeout(() => {
        window.location.href = '/login';
      }, 250);
      return;
    }
    const currentPrompt = prompt;
    setPrompt('');
    setIsGenerating(true);

    if (activeTab === 'chat') {
      const userMsg = { role: 'user', content: currentPrompt, id: Date.now() };
      setChatMessages(prev => [...prev, userMsg]);
      try {
        const payload = createBasePayload(currentPrompt);
        const data = await postCreativeRequest(API_ENDPOINTS.CHAT_COMPLETIONS, payload);
        const choice = data?.choices?.[0];
        const processed = processThinkTags(
          choice?.message?.content || '',
          choice?.message?.reasoning_content || choice?.message?.reasoning || '',
        );
        const content =
          [processed.reasoningContent, processed.content].filter(Boolean).join('\n\n') ||
          '模型已返回响应，但未解析到可展示内容。';
        setChatMessages(prev => [
          ...prev,
          { role: 'assistant', content, id: Date.now() + 1 },
        ]);
      } catch (error) {
        console.error('Creative center chat error:', error);
        setChatMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `请求失败：${error.message || '请稍后再试。'}`,
            id: Date.now() + 1,
          },
        ]);
      }
    } else if (activeTab === 'image') {
      setCurrentImage(null);
      try {
        const basePayload = createBasePayload(currentPrompt);
        const payload = {
          model: currentModelName,
          group: activeGroup,
          prompt: currentPrompt,
          n: 1,
          response_format: 'url',
        };
        if (basePayload.size) {
          payload.size = basePayload.size;
        }
        if (basePayload.aspect_ratio) {
          payload.aspect_ratio = basePayload.aspect_ratio;
        }
        if (basePayload.output_resolution) {
          payload.output_resolution = basePayload.output_resolution;
        }
        const data = await postCreativeRequest(API_ENDPOINTS.IMAGE_GENERATIONS, payload);
        const imageUrl =
          data?.data?.find?.((item) => typeof item?.url === 'string' && item.url.trim())?.url ||
          '';
        if (imageUrl) {
          setCurrentImage(imageUrl);
        }
      } catch (error) {
        console.error('Creative center image error:', error);
      }
    } else if (activeTab === 'video') {
      setVideoTask(null);
      try {
        const basePayload = createBasePayload(currentPrompt);
        let data;

        if (isAdobeVideoModel) {
          data = await postCreativeRequest(
            API_ENDPOINTS.CHAT_COMPLETIONS,
            basePayload,
          );
          const content = data?.choices?.[0]?.message?.content || '';
          const videoUrl = extractVideoUrlFromMessage(content);
          setVideoTask({
            id: data?.id || '',
            status: videoUrl ? 'completed' : 'submitted',
            url: videoUrl,
            content,
          });
          setIsGenerating(false);
          return;
        }

        const payload = {
          model: currentModelName,
          group: activeGroup,
          prompt: currentPrompt,
        };
        [
          'size',
          'seconds',
          'quality',
          'preset',
          'resolution_name',
          'video_config',
          'duration',
          'aspect_ratio',
          'resolution',
          'reference_mode',
        ].forEach((key) => {
          if (basePayload[key] !== undefined) {
            payload[key] = basePayload[key];
          }
        });
        data = await postCreativeRequest(API_ENDPOINTS.VIDEO_GENERATIONS, payload);
        setVideoTask({
          id: data?.task_id || data?.id || '',
          status: data?.status || 'submitted',
          url: data?.url || data?.video_url || data?.result_url || '',
          content: '',
        });
      } catch (error) {
        console.error('Creative center video error:', error);
      }
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
                <div className='flex h-full items-center justify-center'>
                  <div className='max-w-xl rounded-[2.5rem] border border-slate-200 bg-white/80 px-10 py-12 text-center shadow-[0_20px_80px_rgba(59,130,246,0.08)] backdrop-blur-sm'>
                    <div className='mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-blue-600 shadow-sm'>
                      {selectedModel?.icon || <MessageSquare size={36} />}
                    </div>
                    <div className='text-xs font-bold uppercase tracking-[0.24em] text-slate-400'>
                      当前模型
                    </div>
                    <h3 className='mt-4 text-3xl font-black tracking-tight text-slate-900'>
                      {selectedModel?.name || '对话模型'}
                    </h3>
                    <p className='mt-4 text-sm leading-8 text-slate-500'>
                      {selectedModel?.desc || '这里会显示当前对话模型的介绍，帮助你在开始前快速了解它适合做什么。'}
                    </p>
                  </div>
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
            ) : activeTab === 'video' && videoTask ? (
              <div className='w-full max-w-2xl rounded-[2.5rem] border border-slate-200 bg-white/90 p-10 text-left shadow-2xl shadow-blue-900/5'>
                <div className='flex items-center gap-4'>
                  <div className='flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600'>
                    <Video size={28} />
                  </div>
                  <div>
                    <div className='text-xs font-bold uppercase tracking-[0.22em] text-slate-400'>
                      视频任务已提交
                    </div>
                    <h3 className='mt-2 text-2xl font-black tracking-tight text-slate-900'>
                      {selectedModel?.name || '视频模型'}
                    </h3>
                  </div>
                </div>

                <div className='mt-8 grid gap-4 rounded-[2rem] bg-slate-50 p-6 text-sm text-slate-600 sm:grid-cols-2'>
                  <div>
                    <div className='text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400'>
                      任务 ID
                    </div>
                    <div className='mt-2 break-all font-semibold text-slate-800'>
                      {videoTask.id || '暂未返回'}
                    </div>
                  </div>
                  <div>
                    <div className='text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400'>
                      当前状态
                    </div>
                    <div className='mt-2 font-semibold text-blue-700'>
                      {videoTask.status || 'submitted'}
                    </div>
                  </div>
                </div>

                <p className='mt-6 text-sm leading-7 text-slate-500'>
                  视频生成通常比图片更久。如果模型返回了结果链接，会在下方展示；否则你可以结合任务 ID 到任务日志继续查看进度。
                </p>

                {videoTask.url ? (
                  <div className='mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950'>
                    <video controls className='h-full w-full' src={videoTask.url} />
                  </div>
                ) : videoTask.content ? (
                  <div className='mt-6 rounded-[2rem] border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-7 text-slate-600'>
                    {videoTask.content}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className='max-w-xl rounded-[2.5rem] border border-slate-200 bg-white/80 px-10 py-12 text-center shadow-[0_20px_80px_rgba(59,130,246,0.08)] backdrop-blur-sm'>
                <div className='mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-blue-600 shadow-sm'>
                  {selectedModel?.icon || (activeTab === 'image' ? <ImageIcon size={36} /> : <Video size={36} />)}
                </div>
                <div className='text-xs font-bold uppercase tracking-[0.24em] text-slate-400'>
                  当前模型
                </div>
                <h3 className='mt-4 text-3xl font-black tracking-tight text-slate-900'>
                  {selectedModel?.name || (activeTab === 'image' ? '图片模型' : '视频模型')}
                </h3>
                <p className='mt-4 text-sm leading-8 text-slate-500'>
                  {selectedModel?.desc || '这里会显示当前模型的介绍，帮助你在开始创作前快速了解它更擅长生成什么内容。'}
                </p>
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
                  placeholder={!isLoggedIn ? "登录后即可开始对话、图片或视频创作..." : activeTab === 'chat' ? "发送消息..." : "描述你想要的画面..."}
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

              {!isLoggedIn && (
                <div className='mt-4 flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-700'>
                  <div className='font-medium'>
                    {'\u5f53\u524d\u4ec5\u5f00\u653e\u6d4f\u89c8\uff0c\u53d1\u9001\u5185\u5bb9\u524d\u9700\u8981\u5148\u767b\u5f55\u8d26\u53f7\u3002'}
                  </div>
                  <button
                    onClick={() => {
                      window.location.href = '/login';
                    }}
                    className='shrink-0 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-blue-700 shadow-sm transition hover:bg-blue-100'
                  >
                    {'\u53bb\u767b\u5f55'}
                  </button>
                </div>
              )}
              {activeTab !== 'chat' && (
                <div className='mt-5 flex flex-wrap items-center gap-3 border-t border-slate-50 pt-5 px-2'>
                  {activeTab === 'image' && isGrokImagineImageModel && (
                    <DropSelectButton
                      menuKey='imageSize'
                      icon={<Copy size={14} />}
                      label={`尺寸 ${params.imageSize}`}
                      value={params.imageSize}
                      options={GROK_IMAGE_SIZE_OPTIONS}
                      openMenu={openMenu}
                      setOpenMenu={setOpenMenu}
                      onSelect={(value) =>
                        setParams((prev) => ({ ...prev, imageSize: value }))
                      }
                    />
                  )}

                  {activeTab === 'image' && isAdobeImageModel && (
                    <>
                      <DropSelectButton
                        menuKey='aspectRatio'
                        icon={<Copy size={14} />}
                        label={`比例 ${getOptionLabel(
                          ADOBE_IMAGE_ASPECT_RATIO_OPTIONS,
                          params.aspectRatio,
                        )}`}
                        value={params.aspectRatio}
                        options={ADOBE_IMAGE_ASPECT_RATIO_OPTIONS}
                        openMenu={openMenu}
                        setOpenMenu={setOpenMenu}
                        onSelect={(value) =>
                          setParams((prev) => ({ ...prev, aspectRatio: value }))
                        }
                      />

                      {params.aspectRatio === 'auto' && (
                        <DropSelectButton
                          menuKey='autoImageSize'
                          icon={<ImageIcon size={14} />}
                          label={`尺寸 ${params.autoImageSize}`}
                          value={params.autoImageSize}
                          options={ADOBE_AUTO_IMAGE_SIZE_OPTIONS}
                          openMenu={openMenu}
                          setOpenMenu={setOpenMenu}
                          onSelect={(value) =>
                            setParams((prev) => ({ ...prev, autoImageSize: value }))
                          }
                        />
                      )}

                      {isAdobeImage4KModel ? (
                        <div className='rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600'>
                          分辨率 4K
                        </div>
                      ) : (
                        <DropSelectButton
                          menuKey='outputResolution'
                          icon={<ImageIcon size={14} />}
                          label={`分辨率 ${params.outputResolution}`}
                          value={params.outputResolution}
                          options={ADOBE_OUTPUT_RESOLUTION_OPTIONS}
                          openMenu={openMenu}
                          setOpenMenu={setOpenMenu}
                          onSelect={(value) =>
                            setParams((prev) => ({
                              ...prev,
                              outputResolution: value,
                            }))
                          }
                          widthClass='w-32'
                        />
                      )}
                    </>
                  )}

                  {activeTab === 'video' && isVideoModel && !isAdobeVideoModel && (
                    <>
                      <DropSelectButton
                        menuKey='videoSize'
                        icon={<Copy size={14} />}
                        label={`尺寸 ${params.videoSize}`}
                        value={params.videoSize}
                        options={GENERIC_VIDEO_SIZE_OPTIONS}
                        openMenu={openMenu}
                        setOpenMenu={setOpenMenu}
                        onSelect={(value) =>
                          setParams((prev) => ({ ...prev, videoSize: value }))
                        }
                      />

                      <DropSelectButton
                        menuKey='videoSeconds'
                        icon={<Clock size={14} />}
                        label={`时长 ${getOptionLabel(
                          GENERIC_VIDEO_SECONDS_OPTIONS,
                          params.videoSeconds,
                        )}`}
                        value={params.videoSeconds}
                        options={GENERIC_VIDEO_SECONDS_OPTIONS}
                        openMenu={openMenu}
                        setOpenMenu={setOpenMenu}
                        onSelect={(value) =>
                          setParams((prev) => ({ ...prev, videoSeconds: value }))
                        }
                        widthClass='w-32'
                      />

                      <DropSelectButton
                        menuKey='videoQuality'
                        icon={<Video size={14} />}
                        label={`分辨率 ${params.videoQuality}`}
                        value={params.videoQuality}
                        options={GENERIC_VIDEO_QUALITY_OPTIONS}
                        openMenu={openMenu}
                        setOpenMenu={setOpenMenu}
                        onSelect={(value) =>
                          setParams((prev) => ({ ...prev, videoQuality: value }))
                        }
                        widthClass='w-32'
                      />

                      {isGrokImagineVideoModel && (
                        <DropSelectButton
                          menuKey='videoPreset'
                          icon={<Layers size={14} />}
                          label={`预设 ${getOptionLabel(
                            GROK_VIDEO_PRESET_OPTIONS,
                            params.videoPreset,
                          )}`}
                          value={params.videoPreset}
                          options={GROK_VIDEO_PRESET_OPTIONS}
                          openMenu={openMenu}
                          setOpenMenu={setOpenMenu}
                          onSelect={(value) =>
                            setParams((prev) => ({ ...prev, videoPreset: value }))
                          }
                          widthClass='w-36'
                        />
                      )}
                    </>
                  )}

                  {activeTab === 'video' && isAdobeVideoModel && (
                    <>
                      <DropSelectButton
                        menuKey='videoDuration'
                        icon={<Clock size={14} />}
                        label={`时长 ${getOptionLabel(
                          isAdobeSoraModel
                            ? ADOBE_VIDEO_DURATION_OPTIONS.sora
                            : ADOBE_VIDEO_DURATION_OPTIONS.veo,
                          params.videoDuration,
                        )}`}
                        value={params.videoDuration}
                        options={
                          isAdobeSoraModel
                            ? ADOBE_VIDEO_DURATION_OPTIONS.sora
                            : ADOBE_VIDEO_DURATION_OPTIONS.veo
                        }
                        openMenu={openMenu}
                        setOpenMenu={setOpenMenu}
                        onSelect={(value) =>
                          setParams((prev) => ({ ...prev, videoDuration: value }))
                        }
                        widthClass='w-32'
                      />

                      <DropSelectButton
                        menuKey='videoAspectRatio'
                        icon={<Copy size={14} />}
                        label={`比例 ${params.aspectRatio}`}
                        value={params.aspectRatio}
                        options={ADOBE_VIDEO_ASPECT_RATIO_OPTIONS}
                        openMenu={openMenu}
                        setOpenMenu={setOpenMenu}
                        onSelect={(value) =>
                          setParams((prev) => ({ ...prev, aspectRatio: value }))
                        }
                        widthClass='w-32'
                      />

                      {isAdobeVeoModel && (
                        <DropSelectButton
                          menuKey='adobeVideoResolution'
                          icon={<Video size={14} />}
                          label={`分辨率 ${params.videoResolution}`}
                          value={params.videoResolution}
                          options={ADOBE_VIDEO_RESOLUTION_OPTIONS}
                          openMenu={openMenu}
                          setOpenMenu={setOpenMenu}
                          onSelect={(value) =>
                            setParams((prev) => ({
                              ...prev,
                              videoResolution: value,
                            }))
                          }
                          widthClass='w-32'
                        />
                      )}

                      {currentModelName === 'veo31' && (
                        <DropSelectButton
                          menuKey='referenceMode'
                          icon={<Layers size={14} />}
                          label={`参考 ${getOptionLabel(
                            ADOBE_REFERENCE_MODE_OPTIONS,
                            params.referenceMode,
                          )}`}
                          value={params.referenceMode}
                          options={ADOBE_REFERENCE_MODE_OPTIONS}
                          openMenu={openMenu}
                          setOpenMenu={setOpenMenu}
                          onSelect={(value) =>
                            setParams((prev) => ({ ...prev, referenceMode: value }))
                          }
                          widthClass='w-36'
                        />
                      )}
                    </>
                  )}

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






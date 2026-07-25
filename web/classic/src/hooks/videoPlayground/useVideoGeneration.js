import {
  useState,
  useEffect,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import { StatusContext } from '../../context/Status';
import { UserContext } from '../../context/User';
import {
  persistWithMedia,
  hydrateConversationsFromStorage,
  stripUnresolvedMediaRefs,
  isMediaRef,
} from '../../helpers/playgroundMediaStorage';
import { urlToDataUrl } from '../../utils/playgroundMedia';
import {
  API,
  showError,
  processGroupsData,
  processModelsData,
  getUserModelsCached,
  cachedGet,
} from '../../helpers';
import {
  VIDEO_API_ENDPOINTS,
  VIDEO_PAGE_CAPABILITY,
  VIDEO_I2V_CAPABILITY,
  VIDEO_FLF2V_CAPABILITY,
  VIDEO_S2V_CAPABILITY,
  VIDEO_SR_CAPABILITY,
  VIDEO_VACE_CAPABILITY,
  VIDEO_DUB_CAPABILITY,
  VIDEO_CAPABILITY_LEGACY_ALIASES,
  VIDEO_DEFAULT_ASPECT_RATIO,
  aspectRatioToShape,
  getAspectRatiosForVideoModel,
  VIDEO_STATUS,
  VIDEO_HISTORY_LIMIT,
  VIDEO_CONV_TURN_LIMIT,
  VIDEO_INTERPOLATION_TARGET_FPS,
  VIDEO_POLL_INTERVAL_MS,
  VIDEO_POLL_MAX_TIMES,
  parseVideoModelConfig,
  getSizesForVideoModel,
  getDurationsForVideoModel,
  getMaxInputMBForModel,
  resolveVideoStrategy,
  normalizeVideoSize,
  normalizeVideoStatus,
  parseProgress,
  buildVideoContentUrl,
} from '../../constants/videoPlayground.constants';

// 文生视频 / 图生视频 / 首尾帧 / 数字人 / 视频超分 / 视频编辑共用本 hook,按 mode
// 区分能力过滤、需要哪些输入(帧图 / 音频 / 视频 / 蒙版 / 参考图)。
const CONV_STORAGE_KEY_BASE = 'video_playground_conversations';
const VIDEO_MODES = {
  // text2video 显式下发 t2v(不再靠模型名推断):Bernini 同名模型横跨 t2v 与
  // v2v/rv2v/r2v,inferTaskType 按名恒判 v2v,故这里必须显式;对其它 t2v 模型无影响。
  text2video: { capability: VIDEO_PAGE_CAPABILITY, suffix: '', taskType: 't2v' },
  // 图生视频(2026-07 改判 Bernini r2v):参考图(1~3 张)生成视频,显式 task_type=r2v
  // (Bernini 模型名推断恒 v2v,必须显式)。旧 wan i2v 的「首帧生视频」迁到关键帧模式。
  image2video: { capability: VIDEO_I2V_CAPABILITY, suffix: '_i2v', taskType: 'r2v' },
  // 关键帧(原「首尾帧」,wan2.2 i2v):仅首帧→i2v、首+尾帧→flf2v,提交时按输入派生
  // task_type 显式下发(模型名推断分不出两者),故不设静态 taskType。
  flf2v: { capability: VIDEO_FLF2V_CAPABILITY, suffix: '_flf2v' },
  // 门面 task_type：s2v(音频生视频)/ sr(视频超分)。
  s2v: { capability: VIDEO_S2V_CAPABILITY, suffix: '_s2v', taskType: 's2v' },
  sr: { capability: VIDEO_SR_CAPABILITY, suffix: '_sr', taskType: 'sr' },
  // 视频配乐(LTX-2.3 首发):源视频复用 sr 的 sourceVideo 输入,提示词可选(描述想要
  // 的声音:音效/环境音/BGM/台词),输出=原画面 + AI 音轨的 mp4。task_type 显式 v2a。
  dub: { capability: VIDEO_DUB_CAPABILITY, suffix: '_dub', taskType: 'v2a' },
  // 「视频编辑」mode 键沿用 vace(避免动 localStorage 历史键 / 示例 key),但现驱动 Bernini:
  // 必须 ≥1 源视频,task_type 提交时按输入分流 v2v/rv2v/mv2v(2视频),ads2v 由示例
  // 显式带 taskType(见 isVACE 提交块);仅参考图的 r2v 已迁到「图生视频」模式。
  vace: {
    capability: VIDEO_VACE_CAPABILITY,
    suffix: '_vace',
  },
};
// vace 参考图最多张数(与门面 _MAX_INPUT_IMAGES 对齐);图生视频(r2v)产品档 3 张
// (与 adaptor maxR2VRefImages 对齐)。
const MAX_REF_IMAGES = 5;
const MAX_R2V_REF_IMAGES = 3;
const modeMeta = (mode) => VIDEO_MODES[mode] || VIDEO_MODES.text2video;
const storageKeyFor = (mode) =>
  `${CONV_STORAGE_KEY_BASE}${modeMeta(mode).suffix}`;

const loadConversations = (storageKey) => {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

// 视频体验区的媒体字段 schema(哪些字段是 base64 媒体):
//   续问要发后端的(hydrate 回 data:):帧图/人物图 images、vace 参考图 refImages(数组);
//     s2v 音频 audioData、sr 源视频 sourceVideo、vace 源视频 srcVideo(单值);
//   仅展示的(hydrate 成 objectURL):消息级 images。
// 媒体以 Blob 存 IndexedDB,localStorage 只留短引用,刷新后可恢复、可续问、可回看。
const VIDEO_MEDIA_SCHEMA = {
  convArrayFields: ['images', 'refImages'],
  convStringFields: ['audioData', 'sourceVideo', 'srcVideo', 'srcVideo2'],
  msgArrayFields: ['images'],
  // 生成的视频结果(原为 /v1/videos/{id}/content 实时下载):抓 Blob 缓存进 IDB,刷新后
  // 直接读、后端按保留天数清理后仍可回看。
  msgMediaFields: ['videoUrl'],
  markNotPersisted: false,
};

const persistConversations = (storageKey, list) => {
  persistWithMedia(storageKey, list, {
    ...VIDEO_MEDIA_SCHEMA,
    limit: VIDEO_HISTORY_LIMIT,
  });
};

let idSeq = 0;
const genId = () => `vid-${Date.now()}-${idSeq++}`;

// completed 视频的 videoUrl 可由 taskId 重建(/v1/videos/{taskId}/content,后端每次代理/签名)。
// 初始加载 strip 会把 idb 引用剥成 '',若在 hydrate 未完成的窗口发生一次 persist,空值会覆盖
// localStorage 里的引用而永久丢失 → 渲染兜底成「生成中 100%」。这里对「已完成、有 taskId、
// videoUrl 为空」的消息用 taskId 重建直连 URL:内存里始终非空,persist 落的是可重建的直连
// URL(isDirectUrl 原样保留),localStorage 自愈;已损坏的历史数据加载即恢复。identity 保持:
// 无改动的 conv/message 原样返回,不破坏 hydrate 的引用比对。
const ensureVideoUrls = (list) => {
  if (!Array.isArray(list)) return list;
  return list.map((conv) => {
    let changed = false;
    const messages = (conv.messages || []).map((m) => {
      if (
        m.role === 'assistant' &&
        m.status === VIDEO_STATUS.COMPLETED &&
        m.taskId &&
        !m.videoUrl
      ) {
        changed = true;
        return { ...m, videoUrl: buildVideoContentUrl(m.taskId) };
      }
      return m;
    });
    return changed ? { ...conv, messages } : conv;
  });
};

// 兼容 OpenAI 错误({error:{message}})与任务错误({code,message,data})两种形态
const extractApiErrMsg = (error, fallback) => {
  const d = error?.response?.data || {};
  return d.error?.message || d.message || error?.message || fallback;
};

export const useVideoGeneration = ({ mode = 'text2video' } = {}) => {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const [userState] = useContext(UserContext);

  const isI2V = mode === 'image2video';
  const isFLF2V = mode === 'flf2v';
  const isS2V = mode === 's2v';
  const isSR = mode === 'sr';
  const isVACE = mode === 'vace';
  const isDub = mode === 'dub';
  // 需要上传一张「主图」的模式:关键帧首帧、s2v 人物图(都复用 inputs.firstFrame)。
  // 图生视频(Bernini r2v)改用参考图 refImages,不再走 firstFrame。
  const needsImage = isFLF2V || isS2V;
  // 输出跟随上传输入的模式(非文生视频):不展示/不下发尺寸与宽高比。
  const followsInput = mode !== 'text2video';
  const taskType = modeMeta(mode).taskType; // s2v/sr 显式下发;vace(Bernini)按输入分流(见 isVACE 提交块),其余靠模型名推断
  const pageCapability = modeMeta(mode).capability;
  const storageKey = storageKeyFor(mode);

  const [inputs, setInputs] = useState({
    group: '',
    model: '',
    size: '',
    seconds: '',
    seed: '', // 随机种子;'' 表示随机(不下发)
    negativePrompt: '', // 负向提示词;默认留空,非空才随 metadata 下发
    aspectRatio: '', // 宽高比;仅当该模型在后台配了宽高比才由 effect 选中默认值并下发
    firstFrame: '', // i2v/flf2v 首帧 / s2v 人物图(base64 data-url)
    lastFrame: '', // flf2v 尾帧
    audioData: '', // s2v 驱动音频(base64 data-url)
    sourceVideo: '', // sr 源视频(base64 data-url)
    srRatio: 2, // sr 超分倍率(请求级,门面透传 metadata.sr_ratio)
    interpolation: false, // 插帧开关(默认关):开启才透传 metadata.target_fps,超分/配乐不适用
    srcVideo: '', // 视频编辑(Bernini)源视频(base64 data-url)
    srcVideo2: '', // 视频编辑(Bernini)第二源视频(mv2v/ads2v 双视频,可选)
    refImages: [], // 视频编辑 rv2v / 图生视频 r2v 参考图(base64 data-url 数组)
  });
  const [groups, setGroups] = useState([]);
  const [models, setModels] = useState([]);
  // 来自 /api/pricing：model -> enable_groups[]（用于分组过滤）
  const [modelGroupsMap, setModelGroupsMap] = useState(new Map());

  // 初值:同步剥掉未 hydrate 的 idb-media: 引用(避免首帧断图/裸引用误发后端);
  // 保留初始 conv 对象引用,mount 后 hydrate 完成再按引用逐条合并(不整体覆盖)。
  const initialConvsRef = useRef(null);
  const [conversations, setConversations] = useState(() => {
    const raw = loadConversations(storageKey);
    // strip 后立刻用 taskId 重建 completed 视频的空 videoUrl,再存进 initialConvsRef——
    // 保证 initialSet 与 state 引用一致(hydrate 的引用比对不被破坏)。
    const stripped = ensureVideoUrls(
      stripUnresolvedMediaRefs(raw, VIDEO_MEDIA_SCHEMA),
    );
    initialConvsRef.current = { raw, stripped };
    return stripped;
  });
  const [currentConvId, setCurrentConvId] = useState(null);
  const [generating, setGenerating] = useState(false);

  const messages = useMemo(() => {
    const conv = conversations.find((c) => c.id === currentConvId);
    return conv ? conv.messages : [];
  }, [conversations, currentConvId]);

  const locked = currentConvId !== null;

  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const groupRef = useRef(inputs.group);
  groupRef.current = inputs.group;
  // 当前进行中的轮询：{ convId, msgId, taskId, timer, canceled }
  const activePollRef = useRef(null);

  // mount 后从 IDB 还原媒体,按初始对象引用逐条合并——只替换"挂载至今未被任何 setState
  // 换过引用"的 conv(hydrate 期间用户新建/正在生成被 patch 的会话原样保留)。不整体覆盖。
  useEffect(() => {
    let canceled = false; // 兜 StrictMode dev 双挂载
    const init = initialConvsRef.current;
    if (!init || !(init.raw || []).length) return;
    (async () => {
      const hydrated = await hydrateConversationsFromStorage(
        init.raw,
        VIDEO_MEDIA_SCHEMA,
      );
      if (canceled) return;
      const hydratedById = new Map(hydrated.map((c) => [c.id, c]));
      const initialSet = new Set(init.stripped);
      // conv 级媒体字段(续问要复用):即使会话已被 resume-poll patch 过(换了引用),
      // 也要把这些字段从 hydrated 版本补回去,否则重载后进行中的任务完成后续问会误报
      // "媒体失效"(IDB 里其实还在)。
      const mediaFields = [
        ...VIDEO_MEDIA_SCHEMA.convArrayFields,
        ...VIDEO_MEDIA_SCHEMA.convStringFields,
      ];
      setConversations((prev) =>
        // hydrated 版本若 IDB blob 缺失,videoUrl 会是 '';外面再兜一层 taskId 重建,
        // 避免 completed 消息被还原成空 URL 而渲染成「生成中」。
        ensureVideoUrls(
          prev.map((c) => {
            const h = hydratedById.get(c.id);
            if (!h) return c;
            // 挂载至今未被换过引用 → 整条用 hydrated(含还原的媒体 + 原消息)。
            if (initialSet.has(c)) return h;
            // 已被 patch(如 resume-poll):只把 conv 级媒体字段还原到实时会话上,
            // 保留其实时消息/状态。
            const merged = { ...c };
            mediaFields.forEach((f) => {
              merged[f] = h[f];
            });
            return merged;
          }),
        ),
      );
    })();
    return () => {
      canceled = true;
    };
    // 挂载一次:storageKey 在本组件生命周期内固定(切 tab 整体重挂载)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = useCallback((key, value) => {
    if (lockedRef.current) return;
    setInputs((prev) => ({ ...prev, [key]: value }));
  }, []);

  // 一键示例:标量参数(params)+ 文件(files:字段→素材 URL)一次性写入 inputs。
  // 文件 URL fetch→base64 data-url(与手动上传同形态);数组字段(refImages)逐个转。锁定时忽略。
  const applyExample = useCallback(
    async (ex) => {
      if (lockedRef.current || !ex || typeof ex !== 'object') return;
      try {
        // 载入示例 = 干净状态:先清空所有媒体输入字段,再套用本示例声明的。否则切换
        // 示例时上一组残留——尤其视频编辑 v2v/rv2v/r2v 字段组不同,残留的 srcVideo 会让
        // 「仅参考图」的 r2v 被自动分流误判为 rv2v。
        const patch = {
          firstFrame: '',
          lastFrame: '',
          audioData: '',
          sourceVideo: '',
          srcVideo: '',
          srcVideo2: '',
          refImages: [],
          taskType: '',
          ...(ex.params || {}),
        };
        const entries = await Promise.all(
          Object.entries(ex.files || {}).map(async ([field, url]) => [
            field,
            Array.isArray(url)
              ? await Promise.all(url.map(urlToDataUrl))
              : await urlToDataUrl(url),
          ]),
        );
        entries.forEach(([field, value]) => {
          patch[field] = value;
        });
        if (lockedRef.current) return;
        setInputs((prev) => ({ ...prev, ...patch }));
      } catch (e) {
        showError(t('加载示例素材失败,请重试'));
      }
    },
    [t],
  );

  const videoConfig = useMemo(
    () => parseVideoModelConfig(statusState?.status?.VideoModelConfig),
    [statusState?.status?.VideoModelConfig],
  );

  const availableSizes = useMemo(
    () => getSizesForVideoModel(videoConfig, inputs.model),
    [videoConfig, inputs.model],
  );
  const availableDurations = useMemo(
    () => getDurationsForVideoModel(videoConfig, inputs.model),
    [videoConfig, inputs.model],
  );
  const availableAspectRatios = useMemo(
    () => getAspectRatiosForVideoModel(videoConfig, inputs.model),
    [videoConfig, inputs.model],
  );
  // 输入文件大小上限(MB;0=不限)。i2v/flf2v/s2v/sr/vace 上传帧图/音频/视频的护栏。
  const maxInputMB = useMemo(
    () => getMaxInputMBForModel(videoConfig, inputs.model),
    [videoConfig, inputs.model],
  );

  // 视频模型集合 = 管理员在「视频模型配置」里声明、且能力含「文生视频」的模型。
  // 只认运营设置里的能力声明，不再按后端端点类型识别。
  const videoModelSet = useMemo(() => {
    // 兼容旧能力标签:重命名前用旧标签(音频驱动/视频转视频/参考生视频)配过的模型仍能
    // 匹配到对应新 Tab,不会从体验区消失。
    const legacy = VIDEO_CAPABILITY_LEGACY_ALIASES[pageCapability];
    const set = new Set();
    Object.entries(videoConfig.models || {}).forEach(([model, cfg]) => {
      const caps = Array.isArray(cfg?.capabilities) ? cfg.capabilities : [];
      if (caps.includes(pageCapability) || (legacy && caps.includes(legacy))) {
        set.add(model);
      }
    });
    return set;
  }, [videoConfig]);

  const videoGroups = useMemo(() => {
    const set = new Set();
    videoModelSet.forEach((model) => {
      (modelGroupsMap.get(model) || []).forEach((g) => set.add(g));
    });
    return set;
  }, [videoModelSet, modelGroupsMap]);

  // size 合法性（锁定时不动）
  useEffect(() => {
    if (locked) return;
    if (!availableSizes.length) {
      // 未配尺寸的模型（如图生视频/首尾帧或未配置的文生视频）清空残留，避免误发旧 size
      if (inputs.size !== '') setInputs((prev) => ({ ...prev, size: '' }));
      return;
    }
    if (!availableSizes.includes(inputs.size)) {
      setInputs((prev) => ({ ...prev, size: availableSizes[0] }));
    }
  }, [availableSizes, inputs.size, locked]);

  // seconds 合法性
  useEffect(() => {
    if (locked) return;
    if (
      availableDurations.length &&
      !availableDurations.includes(inputs.seconds)
    ) {
      setInputs((prev) => ({ ...prev, seconds: availableDurations[0] }));
    }
  }, [availableDurations, inputs.seconds, locked]);

  // 宽高比合法性(锁定时不动):该模型配了宽高比 → 当前值非法则选默认(优先 16:9,否则首项);
  // 未配置 → 清空(不展示、不下发)。纯 opt-in,不给不支持的模型强塞。
  useEffect(() => {
    if (locked) return;
    if (availableAspectRatios.length === 0) {
      if (inputs.aspectRatio !== '') {
        setInputs((prev) => ({ ...prev, aspectRatio: '' }));
      }
      return;
    }
    if (!availableAspectRatios.includes(inputs.aspectRatio)) {
      const next = availableAspectRatios.includes(VIDEO_DEFAULT_ASPECT_RATIO)
        ? VIDEO_DEFAULT_ASPECT_RATIO
        : availableAspectRatios[0];
      setInputs((prev) => ({ ...prev, aspectRatio: next }));
    }
  }, [availableAspectRatios, inputs.aspectRatio, locked]);

  const loadPricing = useCallback(async () => {
    try {
      const payload = await cachedGet(VIDEO_API_ENDPOINTS.PRICING, {
        config: { skipErrorHandler: true },
      });
      const { success, data } = payload || {};
      if (!success || !Array.isArray(data)) return;
      const groupsMap = new Map();
      data.forEach((item) => {
        if (!item || !item.model_name) return;
        groupsMap.set(item.model_name, item.enable_groups || []);
      });
      setModelGroupsMap(groupsMap);
    } catch (e) {
      // 留空：分组不再按 enable_groups 收窄（模型仍按能力声明过滤）
    }
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const { success, data } = await cachedGet(
        VIDEO_API_ENDPOINTS.USER_GROUPS,
      );
      if (!success) return;
      const userGroup =
        userState?.user?.group ||
        JSON.parse(localStorage.getItem('user') || '{}')?.group;
      let groupOptions = processGroupsData(data, userGroup);
      const allowAllGroups = videoGroups.has('all');
      if (videoGroups.size > 0 && !allowAllGroups) {
        groupOptions = groupOptions.filter(
          (g) => videoGroups.has(g.value) || g.value === 'auto',
        );
      }
      setGroups(groupOptions);
      setInputs((prev) => {
        if (lockedRef.current) return prev;
        const has = groupOptions.some((g) => g.value === prev.group);
        return has ? prev : { ...prev, group: groupOptions[0]?.value || '' };
      });
    } catch (e) {
      showError(t('加载分组失败'));
    }
  }, [userState, videoGroups, t]);

  const loadModels = useCallback(async () => {
    const requestedGroup = inputs.group;
    try {
      const { success, data } = await getUserModelsCached(requestedGroup);
      if (!success) return;
      // 分组在等待响应期间已切换(初始 '' → 用户分组 → 按视频模型过滤后的分组会连续
      // 变化数次):过期响应直接丢弃,否则旧分组的空结果会最后到达并覆盖正确的模型列表。
      if (requestedGroup !== groupRef.current) return;
      let list = Array.isArray(data) ? data : [];
      list = list.filter((m) => videoModelSet.has(m));
      const { modelOptions, selectedModel } = processModelsData(
        list,
        inputs.model,
      );
      setModels(modelOptions);
      setInputs((prev) => {
        if (lockedRef.current) return prev;
        return prev.model === selectedModel
          ? prev
          : { ...prev, model: selectedModel || '' };
      });
    } catch (e) {
      showError(t('加载模型失败'));
    }
  }, [inputs.group, inputs.model, videoModelSet, t]);

  useEffect(() => {
    if (userState?.user) loadPricing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userState?.user]);
  useEffect(() => {
    if (userState?.user) loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userState?.user, videoGroups]);
  useEffect(() => {
    if (userState?.user) loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userState?.user, inputs.group, videoModelSet]);

  // 挂载后为最近一个仍在进行中的任务恢复轮询（刷新/重进页面不丢进度）
  useEffect(() => {
    if (!userState?.user || activePollRef.current) return;
    let best = null; // { convId, msgId, taskId, ts }
    conversationsRef.current.forEach((conv) => {
      (conv.messages || []).forEach((m) => {
        if (
          m.role === 'assistant' &&
          m.taskId &&
          (m.status === VIDEO_STATUS.QUEUED ||
            m.status === VIDEO_STATUS.IN_PROGRESS)
        ) {
          const ts = Number(String(m.id).split('-')[1]) || 0;
          if (!best || ts > best.ts) {
            best = { convId: conv.id, msgId: m.id, taskId: m.taskId, ts };
          }
        }
      });
    });
    if (best) resumePoll(best.convId, best.msgId, best.taskId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userState?.user]);

  const patchConvMessage = useCallback((convId, msgId, patch) => {
    setConversations((prev) => {
      const next = prev.map((c) =>
        c.id === convId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === msgId ? { ...m, ...patch } : m,
              ),
            }
          : c,
      );
      persistConversations(storageKey, next);
      return next;
    });
  }, []);

  const turnsUsed = useMemo(
    () => messages.filter((m) => m.role === 'user').length,
    [messages],
  );
  const turnLimitReached = turnsUsed >= VIDEO_CONV_TURN_LIMIT;

  const finishPoll = useCallback(() => {
    if (activePollRef.current?.timer) clearTimeout(activePollRef.current.timer);
    activePollRef.current = null;
    setGenerating(false);
  }, []);

  const pollOnce = useCallback(
    async (convId, msgId, taskId, count) => {
      const active = activePollRef.current;
      if (!active || active.canceled || active.taskId !== taskId) return;
      try {
        const res = await API.get(
          `${VIDEO_API_ENDPOINTS.VIDEO_FETCH}/${encodeURIComponent(taskId)}`,
          { skipErrorHandler: true },
        );
        const data = res.data || {};
        // 兼容 OpenAIVideo（顶层）与通用 TaskResponse（data.data）两种形态
        const inner = data.data || {};
        const status = normalizeVideoStatus(data.status || inner.status);
        const progress = parseProgress(
          data.progress != null ? data.progress : inner.progress,
        );

        if (status === VIDEO_STATUS.COMPLETED) {
          patchConvMessage(convId, msgId, {
            status: VIDEO_STATUS.COMPLETED,
            progress: 100,
            videoUrl: buildVideoContentUrl(taskId),
          });
          finishPoll();
          return;
        }
        if (status === VIDEO_STATUS.FAILED) {
          const msg =
            data.error?.message ||
            inner.error?.message ||
            inner.fail_reason ||
            data.fail_reason ||
            t('视频生成失败');
          patchConvMessage(convId, msgId, {
            status: VIDEO_STATUS.FAILED,
            error: msg,
          });
          showError(msg);
          finishPoll();
          return;
        }
        // queued / in_progress
        patchConvMessage(convId, msgId, {
          status: status || VIDEO_STATUS.IN_PROGRESS,
          ...(progress !== undefined ? { progress } : {}),
        });
        if (count >= VIDEO_POLL_MAX_TIMES) {
          // 客户端轮询超时：不判失败，保留可恢复状态，仅标记以便展示「继续获取」；
          // 任务可能仍在后端进行/已完成，用原 taskId 续查即可，无需重新提交。
          patchConvMessage(convId, msgId, { pollTimedOut: true });
          finishPoll();
          return;
        }
      } catch (e) {
        // 轮询瞬时错误：继续重试直至超时
        if (count >= VIDEO_POLL_MAX_TIMES) {
          patchConvMessage(convId, msgId, { pollTimedOut: true });
          finishPoll();
          return;
        }
      }
      const cur = activePollRef.current;
      if (!cur || cur.canceled || cur.taskId !== taskId) return;
      cur.timer = setTimeout(
        () => pollOnce(convId, msgId, taskId, count + 1),
        VIDEO_POLL_INTERVAL_MS,
      );
    },
    [patchConvMessage, finishPoll, t],
  );

  // 为某个仍在进行中的任务（重新）启动轮询：刷新页面或切走再回来时用，
  // 避免进度冻结在最后一次写入的值。已在轮询同一任务则跳过。
  const resumePoll = useCallback(
    (convId, msgId, taskId) => {
      if (!taskId) return;
      const active = activePollRef.current;
      if (active && active.taskId === taskId && !active.canceled) return;
      if (active?.timer) clearTimeout(active.timer);
      // 重新轮询即回到「生成中」，清掉超时标记
      patchConvMessage(convId, msgId, { pollTimedOut: false });
      activePollRef.current = {
        convId,
        msgId,
        taskId,
        timer: null,
        canceled: false,
      };
      setGenerating(true);
      activePollRef.current.timer = setTimeout(
        () => pollOnce(convId, msgId, taskId, 1),
        VIDEO_POLL_INTERVAL_MS,
      );
    },
    [pollOnce, patchConvMessage],
  );

  // 超时任务「继续获取」：用原 taskId 续查当前会话中的该消息（方案 A：直接顶掉当前轮询槽）
  const refetch = useCallback(
    (msgId, taskId) => {
      if (currentConvId == null || !taskId) return;
      resumePoll(currentConvId, msgId, taskId);
    },
    [currentConvId, resumePoll],
  );

  const generate = useCallback(
    async (prompt) => {
      // 视频超分无提示词框(输出完全由源视频决定),允许空提示词提交;视频配乐提示词
      // 可选(空提示词=让模型按画面自由配环境音);其余模式必填。
      const text = (prompt || '').trim();
      if ((!text && !isSR && !isDub) || generating) return;

      // 关键帧:images=[首帧(,尾帧)];s2v:images=[人物图]。
      // 后续追问沿用对话首条锁定的帧图 / 媒体输入。
      let convImages = [];
      // 新增能力的媒体输入(base64),与帧图一起锁进对话、随对话复用、落盘前剥离。
      let media = {
        audioData: '',
        sourceVideo: '',
        srRatio: 2,
        srcVideo: '',
        srcVideo2: '',
        refImages: [],
      };
      let convId = currentConvId;
      let params;
      if (convId == null) {
        if (!inputs.model) {
          showError(t('请先选择一个视频模型'));
          return;
        }
        if (needsImage) {
          const first = (inputs.firstFrame || '').trim();
          if (!first) {
            showError(isS2V ? t('请先上传人物图') : t('请先上传首帧图片'));
            return;
          }
          if (isFLF2V) {
            // 关键帧:尾帧可选 —— 仅首帧走 i2v,首+尾帧走 flf2v(提交时派生)。
            const last = (inputs.lastFrame || '').trim();
            convImages = last ? [first, last] : [first];
          } else {
            convImages = [first];
          }
        }
        // 数字人:必填驱动音频;超分:必填源视频;图生视频:必填参考图;
        // 视频编辑:必填至少 1 个源视频(仅参考图的 r2v 已迁到图生视频)。
        if (isS2V && !(inputs.audioData || '').trim()) {
          showError(t('数字人需要上传驱动音频'));
          return;
        }
        if (isSR && !(inputs.sourceVideo || '').trim()) {
          showError(t('视频超分需要上传源视频'));
          return;
        }
        if (isDub && !(inputs.sourceVideo || '').trim()) {
          showError(t('视频配乐需要上传待配乐视频'));
          return;
        }
        if (isI2V && !(inputs.refImages || []).filter(Boolean).length) {
          showError(t('图生视频需要上传 1~3 张参考图'));
          return;
        }
        if (isVACE && !(inputs.srcVideo || '').trim()) {
          showError(t('视频编辑需要上传源视频(至少 1 个)'));
          return;
        }
        media = {
          audioData: (inputs.audioData || '').trim(),
          sourceVideo: (inputs.sourceVideo || '').trim(),
          srRatio: inputs.srRatio,
          srcVideo: (inputs.srcVideo || '').trim(),
          srcVideo2: (inputs.srcVideo2 || '').trim(),
          refImages: (inputs.refImages || []).filter(Boolean),
        };
        convId = genId();
        params = {
          group: inputs.group,
          model: inputs.model,
          size: normalizeVideoSize(inputs.size),
          seconds: inputs.seconds,
          seed: inputs.seed,
          negativePrompt: inputs.negativePrompt,
          aspectRatio: inputs.aspectRatio,
          images: convImages,
          // ads2v 等无法自动分流的玩法由示例 params.taskType 显式带入(落在 inputs 上)。
          taskTypeOverride: (inputs.taskType || '').trim(),
          ...media,
        };
      } else {
        const conv = conversationsRef.current.find((c) => c.id === convId);
        const used = conv
          ? conv.messages.filter((m) => m.role === 'user').length
          : 0;
        if (used >= VIDEO_CONV_TURN_LIMIT) {
          showError(
            t('本轮对话生成次数已达上限（{{count}} 次），请开启新对话', {
              count: VIDEO_CONV_TURN_LIMIT,
            }),
          );
          return;
        }
        params = conv
          ? {
              group: conv.group,
              model: conv.model,
              size: conv.size,
              seconds: conv.seconds,
              seed: conv.seed,
              negativePrompt: conv.negativePrompt,
              aspectRatio: conv.aspectRatio,
              images: conv.images || [],
              audioData: conv.audioData || '',
              sourceVideo: conv.sourceVideo || '',
              srRatio: conv.srRatio != null ? conv.srRatio : 2,
              srcVideo: conv.srcVideo || '',
              srcVideo2: conv.srcVideo2 || '',
              refImages: conv.refImages || [],
              taskTypeOverride: conv.taskTypeOverride || '',
            }
          : {
              group: inputs.group,
              model: inputs.model,
              size: normalizeVideoSize(inputs.size),
              seconds: inputs.seconds,
              seed: inputs.seed,
              negativePrompt: inputs.negativePrompt,
              aspectRatio: inputs.aspectRatio,
              images: convImages,
              ...media,
            };
      }

      // 防御(§2 硬规则):hydrate 已保证无 idb-media: 残留,这里再过滤一遍双保险——
      // 裸引用绝不能作为媒体参数发后端。同时剥掉 hydrate miss 留下的空值。
      const cleanMedia = (v) => (isMediaRef(v) ? '' : v);
      const cleanArr = (arr) => (arr || []).filter((s) => s && !isMediaRef(s));

      // i2v/flf2v/s2v 续问:帧图/人物图取自锁定的对话;刷新后媒体 miss(Blob 被清/IDB 不可用)
      // 时缺失,提示重开对话重新上传。
      if (needsImage) {
        params.images = cleanArr(params.images);
        const need = 1; // 关键帧尾帧可选:首帧在即可续问(尾帧缺失时按 i2v 派生)。
        if (params.images.length < need) {
          showError(t('帧图已失效,请开启新对话并重新上传'));
          return;
        }
      }
      params.audioData = cleanMedia(params.audioData);
      params.sourceVideo = cleanMedia(params.sourceVideo);
      params.srcVideo = cleanMedia(params.srcVideo);
      params.srcVideo2 = cleanMedia(params.srcVideo2);
      params.refImages = cleanArr(params.refImages);
      if (isS2V && !(params.audioData || '').trim()) {
        showError(t('驱动音频已失效,请开启新对话并重新上传'));
        return;
      }
      if ((isSR || isDub) && !(params.sourceVideo || '').trim()) {
        showError(t('源视频已失效,请开启新对话并重新上传'));
        return;
      }
      if (isVACE && !(params.srcVideo || '').trim()) {
        showError(t('源视频已失效,请开启新对话并重新上传'));
        return;
      }
      if (isI2V && !(params.refImages || []).length) {
        showError(t('参考图已失效,请开启新对话并重新上传'));
        return;
      }

      const reqId = genId();
      const now = new Date().toISOString();
      // 超分无提示词/配乐提示词可选:空提示词时会话气泡/历史标题用固定文案占位。
      const displayText = text || t(isDub ? '视频配乐' : '视频超分');
      const userMsg = {
        id: `${reqId}-u`,
        role: 'user',
        content: displayText,
        images: needsImage ? params.images || [] : undefined,
      };
      const asstId = `${reqId}-a`;
      const asstMsg = {
        id: asstId,
        role: 'assistant',
        status: VIDEO_STATUS.QUEUED,
        model: params.model,
        size: params.size,
        seconds: params.seconds,
        prompt: text,
        progress: 0,
        taskId: null,
        videoUrl: null,
      };

      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === convId);
        let next;
        if (idx === -1) {
          next = [
            {
              id: convId,
              group: params.group,
              model: params.model,
              size: params.size,
              seconds: params.seconds,
              seed: params.seed,
              negativePrompt: params.negativePrompt,
              aspectRatio: params.aspectRatio,
              images: params.images || [],
              // 新增能力媒体输入(base64):锁进对话供续问复用,落盘前 stripFramesForPersist 剥离。
              audioData: params.audioData || '',
              sourceVideo: params.sourceVideo || '',
              srRatio: params.srRatio != null ? params.srRatio : 2,
              srcVideo: params.srcVideo || '',
              srcVideo2: params.srcVideo2 || '',
              refImages: params.refImages || [],
              taskTypeOverride: params.taskTypeOverride || '',
              title: displayText,
              createdAt: now,
              updatedAt: now,
              messages: [userMsg, asstMsg],
            },
            ...prev,
          ];
        } else {
          const conv = {
            ...prev[idx],
            updatedAt: now,
            messages: [...prev[idx].messages, userMsg, asstMsg],
          };
          next = [conv, ...prev.filter((_, i) => i !== idx)];
        }
        next = next.slice(0, VIDEO_HISTORY_LIMIT);
        persistConversations(storageKey, next);
        return next;
      });
      if (currentConvId == null) setCurrentConvId(convId);
      setGenerating(true);

      try {
        // 按模型类别只发对应的时长字段：sora→seconds(字符串)，minimax→duration(整数秒)
        const strategy = resolveVideoStrategy(params.model);
        const body = {
          model: params.model,
          group: params.group,
          prompt: text,
        };
        // task_type:数字人/超分/编辑显式下发(门面据此路由),其余靠模型名推断,不发。
        if (taskType) {
          body.metadata = { ...(body.metadata || {}), task_type: taskType };
        }
        // 关键帧(wan2.2 i2v):仅首帧 → i2v,首+尾帧 → flf2v。模型名推断分不出
        // 两者(同一 i2v 实例),必须显式下发。
        if (isFLF2V) {
          body.metadata = {
            ...(body.metadata || {}),
            task_type: (params.images || []).length >= 2 ? 'flf2v' : 'i2v',
          };
        }
        // 尺寸/分辨率仅文生视频、且该值仍在当前模型允许集内才下发（对齐宽高比的闸门，
        // 避免切到未配尺寸的模型时把残留旧值误发）；其余模式输出跟随上传输入，不发 size。
        const videoSizeVal = normalizeVideoSize(params.size);
        if (!followsInput && availableSizes.includes(videoSizeVal)) {
          body.size = videoSizeVal;
        }
        // 超分/配乐输出时长跟随源视频,不发时长字段(配置面板也不展示时长框)。
        if (!isSR && !isDub) {
          if (strategy.durationField === 'seconds') {
            body.seconds = params.seconds;
          } else {
            body.duration = parseInt(params.seconds, 10) || undefined;
          }
        }
        // 随机种子 / 负向提示词:塞进 metadata(gpustackplus task adaptor 整体透传 metadata
        // 给引擎;TaskSubmitReq.Metadata 只从请求的 metadata 对象取,故不能放顶层)。
        // seed 留空则引擎随机;negative_prompt 非空才发。
        if (params.seed !== '' && params.seed != null) {
          body.metadata = {
            ...(body.metadata || {}),
            seed: Number(params.seed),
          };
        }
        if (params.negativePrompt && params.negativePrompt.trim()) {
          body.metadata = {
            ...(body.metadata || {}),
            negative_prompt: params.negativePrompt.trim(),
          };
        }
        // 插帧(默认关):按提交时的开关状态透传 target_fps(引擎 RIFE 帧率翻倍)。
        // 超分/配乐不适用(SR 引擎侧明确不插帧)。
        if (inputs.interpolation && !isSR && !isDub) {
          body.metadata = {
            ...(body.metadata || {}),
            target_fps: VIDEO_INTERPOLATION_TARGET_FPS,
          };
        }
        // 宽高比 → target_shape:[h,w]。纯 opt-in:仅 t2v、且该值仍在当前模型的允许集内才下发
        // (续问历史会话时 conv.aspectRatio 可能是后台已改/删的旧值,校验一遍避免绕过白名单)。
        // wan 视频引擎按 target_shape 出分辨率;i2v/flf2v 跟随输入图故不发。
        if (
          !followsInput &&
          params.aspectRatio &&
          availableAspectRatios.includes(params.aspectRatio)
        ) {
          const shape = aspectRatioToShape(params.aspectRatio);
          if (shape) {
            body.metadata = { ...(body.metadata || {}), target_shape: shape };
          }
        }
        // i2v/flf2v/s2v:带主图。后端 gpustackplus:images[0]=首帧/人物图,flf2v 时 images[1]=尾帧。
        if (needsImage && (params.images || []).length > 0) {
          body.images = params.images;
        }
        // 图生视频(Bernini r2v):参考图(1~3)→ metadata.src_ref_images,
        // 门面物化后引擎按参考图组合主体/服装/道具/场景生成视频。
        if (isI2V && (params.refImages || []).length > 0) {
          body.metadata = {
            ...(body.metadata || {}),
            src_ref_images: params.refImages,
          };
        }
        // 数字人:驱动音频 → metadata.audio(门面物化到 audio_path 喂 InfiniteTalk)。
        if (isS2V && (params.audioData || '').trim()) {
          body.metadata = { ...(body.metadata || {}), audio: params.audioData };
        }
        // 视频超分:源视频 → metadata.video;倍率 → metadata.sr_ratio(门面透传,引擎按 config 封顶)。
        if (isSR) {
          if ((params.sourceVideo || '').trim()) {
            body.metadata = {
              ...(body.metadata || {}),
              video: params.sourceVideo,
            };
          }
          const ratio = Number(params.srRatio);
          if (Number.isFinite(ratio) && ratio > 0) {
            body.metadata = { ...(body.metadata || {}), sr_ratio: ratio };
          }
        }
        // 视频配乐:源视频 → metadata.video(门面物化到 video_path 喂 LTX-2.3);
        // task_type=v2a 已在上方显式下发;无倍率/时长等额外标量。
        if (isDub && (params.sourceVideo || '').trim()) {
          body.metadata = {
            ...(body.metadata || {}),
            video: params.sourceVideo,
          };
        }
        // 视频编辑(Bernini):必有 ≥1 源视频,按输入自动分流 task_type ——
        // 1 视频无参考图=v2v、1 视频+参考图=rv2v、2 视频=mv2v(多源编辑)。
        // ads2v(广告植入)与 mv2v 输入相同,自动分流分不出,由示例 params.taskType
        // (taskTypeOverride)显式指定。仅参考图的 r2v 已迁到「图生视频」模式。
        if (isVACE) {
          const md = { ...(body.metadata || {}) };
          const v1 = (params.srcVideo || '').trim();
          const v2 = (params.srcVideo2 || '').trim();
          const hasRefs = (params.refImages || []).length > 0;
          md.src_video = v2 ? [v1, v2] : v1;
          if (hasRefs && !v2) md.src_ref_images = params.refImages;
          const override = (params.taskTypeOverride || '').trim();
          // override(ads2v)只在真双视频时生效:删掉第二视频后回落自动分流,
          // 避免残留 override 让 1 视频提交被后端「需要恰好 2 个视频」拒掉。
          md.task_type = v2
            ? override || 'mv2v'
            : hasRefs
              ? 'rv2v'
              : 'v2v';
          body.metadata = md;
        }
        const res = await API.post(
          VIDEO_API_ENDPOINTS.VIDEO_GENERATIONS,
          body,
          {
            skipErrorHandler: true,
          },
        );
        const data = res.data || {};
        // 兼容两种响应形态：OpenAIVideo（顶层 id/status）与通用 TaskResponse（data.task_id）
        const inner = data.data || {};
        const taskId = data.id || data.task_id || inner.task_id || inner.id;
        if (!taskId) throw new Error(t('提交视频任务失败'));
        const status = normalizeVideoStatus(data.status || inner.status);
        const progress =
          parseProgress(
            data.progress != null ? data.progress : inner.progress,
          ) || 0;
        // 提交即失败：直接标记，不启动轮询
        if (status === VIDEO_STATUS.FAILED) {
          const msg =
            data.error?.message ||
            inner.error?.message ||
            inner.fail_reason ||
            data.fail_reason ||
            t('视频生成失败');
          patchConvMessage(convId, asstId, {
            status: VIDEO_STATUS.FAILED,
            error: msg,
          });
          showError(msg);
          setGenerating(false);
          return;
        }
        patchConvMessage(convId, asstId, { taskId, status, progress });
        activePollRef.current = {
          convId,
          msgId: asstId,
          taskId,
          timer: null,
          canceled: false,
        };
        activePollRef.current.timer = setTimeout(
          () => pollOnce(convId, asstId, taskId, 1),
          VIDEO_POLL_INTERVAL_MS,
        );
      } catch (error) {
        const msg = extractApiErrMsg(error, t('视频生成失败'));
        patchConvMessage(convId, asstId, {
          status: VIDEO_STATUS.FAILED,
          error: msg,
        });
        showError(msg);
        setGenerating(false);
      }
    },
    [
      currentConvId,
      inputs,
      generating,
      patchConvMessage,
      pollOnce,
      storageKey,
      needsImage,
      followsInput,
      isFLF2V,
      isS2V,
      isSR,
      isVACE,
      isDub,
      taskType,
      availableSizes,
      availableAspectRatios,
      t,
    ],
  );

  const regenerate = useCallback((prompt) => generate(prompt), [generate]);

  const newConversation = useCallback(() => {
    setCurrentConvId(null);
  }, []);

  const clearHistory = useCallback(() => {
    // 清空历史时若有进行中的轮询，一并停止，避免 generating 卡住导致发送按钮一直禁用
    if (activePollRef.current) activePollRef.current.canceled = true;
    finishPoll();
    setConversations([]);
    persistConversations(storageKey, []);
    setCurrentConvId(null);
  }, [finishPoll]);

  const deleteHistoryItem = useCallback(
    (id) => {
      // 删除的正是正在轮询的会话时，停止其轮询并复位 generating
      const active = activePollRef.current;
      if (active && active.convId === id) {
        active.canceled = true;
        finishPoll();
      }
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        persistConversations(storageKey, next);
        return next;
      });
      setCurrentConvId((cur) => (cur === id ? null : cur));
    },
    [finishPoll],
  );

  const openHistoryItem = useCallback(
    (conv) => {
      setCurrentConvId(conv.id);
      setInputs((prev) => ({
        ...prev,
        group: conv.group != null ? conv.group : prev.group,
        model: conv.model != null ? conv.model : prev.model,
        size: conv.size != null ? conv.size : prev.size,
        seconds: conv.seconds != null ? conv.seconds : prev.seconds,
        seed: conv.seed != null ? conv.seed : prev.seed,
        negativePrompt:
          conv.negativePrompt != null
            ? conv.negativePrompt
            : prev.negativePrompt,
        aspectRatio:
          conv.aspectRatio != null ? conv.aspectRatio : prev.aspectRatio,
        srRatio: conv.srRatio != null ? conv.srRatio : prev.srRatio,
        // 打开历史:恢复该会话上传过的输入媒体(已从 IDB hydrate),供只读查看/播放。
        // 帧图存为 images 数组(i2v/s2v 首帧=images[0];flf2v 首帧/尾帧=images[0/1])。
        // 锁定态下 ConfigPanel 的上传控件 disabled → 只展示预览/播放器,不能删改/重传。
        firstFrame: (conv.images || [])[0] || '',
        lastFrame: (conv.images || [])[1] || '',
        audioData: conv.audioData || '',
        sourceVideo: conv.sourceVideo || '',
        srcVideo: conv.srcVideo || '',
        srcVideo2: conv.srcVideo2 || '',
        refImages: conv.refImages || [],
      }));
      // 若该会话最后一个任务仍在进行中，恢复轮询
      const assts = (conv.messages || []).filter((m) => m.role === 'assistant');
      const last = assts[assts.length - 1];
      if (
        last?.taskId &&
        (last.status === VIDEO_STATUS.QUEUED ||
          last.status === VIDEO_STATUS.IN_PROGRESS)
      ) {
        resumePoll(conv.id, last.id, last.taskId);
      }
    },
    [resumePoll],
  );

  // 卸载时清理轮询
  useEffect(() => {
    return () => {
      if (activePollRef.current?.timer)
        clearTimeout(activePollRef.current.timer);
      activePollRef.current = null;
    };
  }, []);

  // 必填输入缺失时发送置灰(新对话/未锁定):避免只填提示词就点发送(点了才报错且 Semi
  // 会清空已输入的提示词)。关键帧需首帧(尾帧可选);图生视频需参考图;s2v 需主图+音频;
  // sr/dub 需源视频;vace 需 ≥1 源视频。
  const missingRequiredImage =
    !locked &&
    ((needsImage && (inputs.firstFrame || '').trim() === '') ||
      (isI2V && !(inputs.refImages || []).filter(Boolean).length) ||
      (isS2V && (inputs.audioData || '').trim() === '') ||
      ((isSR || isDub) && (inputs.sourceVideo || '').trim() === '') ||
      (isVACE && (inputs.srcVideo || '').trim() === ''));

  return {
    isI2V,
    isFLF2V,
    isS2V,
    isSR,
    isVACE,
    isDub,
    needsImage,
    followsInput,
    maxRefImages: isI2V ? MAX_R2V_REF_IMAGES : MAX_REF_IMAGES,
    maxInputMB,
    inputs,
    handleInputChange,
    applyExample,
    groups,
    models,
    availableSizes,
    availableDurations,
    availableAspectRatios,
    messages,
    conversations,
    generating,
    locked,
    turnLimitReached,
    missingRequiredImage,
    generate,
    regenerate,
    refetch,
    newConversation,
    clearHistory,
    deleteHistoryItem,
    openHistoryItem,
  };
};

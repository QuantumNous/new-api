// 视频模型相关常量

export const VIDEO_API_ENDPOINTS = {
  VIDEO_GENERATIONS: '/pg/videos', // POST 提交任务
  VIDEO_FETCH: '/pg/videos', // GET /pg/videos/:id 轮询
  VIDEO_CONTENT: '/v1/videos', // GET /v1/videos/:id/content 取内容（会话鉴权）
  USER_MODELS: '/api/user/models',
  USER_GROUPS: '/api/user/self/groups',
  PRICING: '/api/pricing',
};

// 视频模型能力枚举（中文即值，也是体验区标签页名）。业内常用完整集。
// 新增能力时同步维护后端 constant/model_capability.go 的 VideoCapabilities。
export const VIDEO_CAPABILITIES = [
  '文生视频',
  '图生视频',
  '首尾帧',
  '参考生视频',
  '音频驱动',
  '视频转视频',
];

// 视频默认负向提示词(Wan 官方推荐):抑制过曝/静止/畸形等常见劣化,默认预填。
export const VIDEO_DEFAULT_NEGATIVE_PROMPT =
  '色调艳丽,过曝,静态,细节模糊不清,字幕,风格,作品,画作,画面,静止,整体发灰,最差质量,低质量,JPEG压缩残留,丑陋的,残缺的,多余的手指,画得不好的手部,画得不好的脸部,畸形的,毁容的,形态畸形的肢体,手指融合,静止不动的画面,杂乱的背景,三条腿,背景人很多,倒着走';

// 当前视频体验区页面代表的能力（= 标签页名）
export const VIDEO_PAGE_CAPABILITY = '文生视频';
// 图生视频 / 首尾帧能力标签,与文生视频共用体验区,通过 mode 区分
export const VIDEO_I2V_CAPABILITY = '图生视频';
export const VIDEO_FLF2V_CAPABILITY = '首尾帧';

// 视频模型「策略类别」：不同类上游对尺寸/时长参数的要求不同。
// - sora 类（真·OpenAI Sora）：像素尺寸（后端 relay_utils 校验器要求 720x1280 等）+ seconds 字段；
// - minimax 类（MiniMax / MiniMax-compat）：分辨率档位（720P）+ duration 字段。
// durationField 决定提交时把时长写进哪个字段（只发该字段，避免多发被严格上游拒绝）。
export const VIDEO_MODEL_STRATEGIES = {
  sora: {
    sizes: ['720x1280', '1280x720'],
    durations: ['4', '8', '12'],
    durationField: 'seconds',
  },
  minimax: {
    sizes: ['720P', '1080P'],
    durations: ['5'],
    durationField: 'duration',
  },
};

// 按模型名归类；未识别的一律按 minimax-compat（当前默认部署）。
// 新增某类模型时，只需在这里补匹配规则。
export const resolveVideoStrategy = (model) => {
  const m = String(model || '').toLowerCase();
  if (m.startsWith('sora')) return VIDEO_MODEL_STRATEGIES.sora;
  return VIDEO_MODEL_STRATEGIES.minimax;
};

// 兼容旧引用：通用兜底 = minimax 类（管理端「默认尺寸/时长」留空时的展示用）。
export const FALLBACK_VIDEO_SIZES = VIDEO_MODEL_STRATEGIES.minimax.sizes;
export const FALLBACK_VIDEO_DURATIONS =
  VIDEO_MODEL_STRATEGIES.minimax.durations;

export const VIDEO_HISTORY_STORAGE_KEY = 'video_playground_conversations';
export const VIDEO_HISTORY_LIMIT = 10; // 对话段数上限
export const VIDEO_CONV_TURN_LIMIT = 10; // 单段对话生成次数上限

// 轮询参数
export const VIDEO_POLL_INTERVAL_MS = 4000;
export const VIDEO_POLL_MAX_TIMES = 90; // 约 6 分钟后超时

// 任务状态（与后端 dto/openai_video.go 对齐 + 前端补充）
export const VIDEO_STATUS = {
  QUEUED: 'queued',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELED: 'canceled',
};

// 内容地址：/v1/videos/:id/content
export const buildVideoContentUrl = (id) =>
  `${VIDEO_API_ENDPOINTS.VIDEO_CONTENT}/${encodeURIComponent(id)}/content`;

// 尺寸规范化：乘号/星号统一为 x，去空格。
// 分辨率档位（如 720p）统一为大写 P（上游如 MiniMax 区分大小写）；
// 像素尺寸（如 1280x720）保持小写 x。
export const normalizeVideoSize = (s) => {
  const v = String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[×✕╳*]/g, 'x');
  return /^\d+p$/.test(v) ? v.toUpperCase() : v;
};

// 通用列表规范化（时长/能力）：去空格、去空、去重（解析与设置页保存共用，避免两条路径分叉）
export const normalizeList = (list) =>
  Array.isArray(list)
    ? Array.from(new Set(list.map((x) => String(x).trim()).filter(Boolean)))
    : [];

// 尺寸列表规范化（解析与设置页保存共用）
export const normalizeSizeList = (list) =>
  Array.isArray(list)
    ? Array.from(new Set(list.map(normalizeVideoSize).filter(Boolean)))
    : [];

// 解析 status 中的 VideoModelConfig（字符串或对象）
// 形如 { default: { sizes:[], durations:[] }, models: { name: { sizes:[], durations:[] } } }
export const parseVideoModelConfig = (raw) => {
  // 未配置时默认留空，交由 getSizes/DurationsForVideoModel 按模型类别兜底
  const empty = { default: { sizes: [], durations: [] }, models: {} };
  if (!raw) return empty;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const def = parsed.default || {};
    const models = {};
    if (parsed.models && typeof parsed.models === 'object') {
      Object.entries(parsed.models).forEach(([name, cfg]) => {
        models[name] = {
          sizes: normalizeSizeList(cfg?.sizes),
          durations: normalizeList(cfg?.durations),
          capabilities: normalizeList(cfg?.capabilities),
        };
      });
    }
    return {
      default: {
        sizes: normalizeSizeList(def.sizes),
        durations: normalizeList(def.durations),
      },
      models,
    };
  } catch (e) {
    return empty;
  }
};

// 尺寸优先级：按模型配置 → 管理端全局默认 → 按模型类别兜底（sora 像素 / minimax 720P）
export const getSizesForVideoModel = (config, model) => {
  const m = config?.models?.[model];
  if (m && Array.isArray(m.sizes) && m.sizes.length > 0) return m.sizes;
  if (config?.default?.sizes?.length) return config.default.sizes;
  return resolveVideoStrategy(model).sizes;
};

// 兼容多种状态取值：OpenAIVideo(queued/in_progress/completed/failed)
// 与内部任务状态(QUEUED/IN_PROGRESS/SUCCESS/FAILURE 等)、各供应商状态。
export const normalizeVideoStatus = (raw) => {
  const s = String(raw || '')
    .toLowerCase()
    .trim();
  if (['completed', 'success', 'succeeded', 'finished'].includes(s))
    return VIDEO_STATUS.COMPLETED;
  if (['failed', 'failure', 'error', 'fail'].includes(s))
    return VIDEO_STATUS.FAILED;
  if (['canceled', 'cancelled', 'cancel'].includes(s))
    return VIDEO_STATUS.CANCELED;
  if (['in_progress', 'processing', 'running', 'generating'].includes(s))
    return VIDEO_STATUS.IN_PROGRESS;
  if (
    [
      'queued',
      'submitted',
      'not_start',
      'preparing',
      'queueing',
      'pending',
      '',
    ].includes(s)
  )
    return VIDEO_STATUS.QUEUED;
  // 未知的非终态：按生成中处理，避免卡在排队
  return VIDEO_STATUS.IN_PROGRESS;
};

// progress 可能是数字或 "50%" 字符串
export const parseProgress = (raw) => {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const n = parseInt(raw.replace('%', ''), 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

// 时长优先级：按模型配置 → 管理端全局默认 → 按模型类别兜底（sora seconds / minimax duration）
export const getDurationsForVideoModel = (config, model) => {
  const m = config?.models?.[model];
  if (m && Array.isArray(m.durations) && m.durations.length > 0)
    return m.durations;
  if (config?.default?.durations?.length) return config.default.durations;
  return resolveVideoStrategy(model).durations;
};

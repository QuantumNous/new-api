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
  '关键帧',
  '数字人',
  '视频超分',
  '视频编辑',
  // 视频配乐(task_type=v2a):原画面逐帧不动 + AI 音轨,LTX-2.3 首发,可挂多模型。
  // 2026-07 从音乐词表迁入(AudioX 视频生音下线);体验区入口在「语音模型」页。
  '视频配乐',
];

// 提示词预设:点击对应按钮清空输入框并填入该提示词(体验区快速试玩,仅文生视频展示)。
export const VIDEO_PROMPT_PRESETS = [
  '中景，一位穿米色针织衫的年轻女性坐在临窗的咖啡馆座位上，桌上的咖啡冒着热气。她轻轻搅动咖啡，抬头微笑，窗外阳光透过百叶窗在她脸上投下条纹光影。镜头缓慢左移，晨光，柔光，暖色调，低对比度，浅景深，生活方式广告质感。',
  '特写，一块厚切和牛牛排在铸铁锅中煎烤，金黄色的黄油在肉块边缘融化冒泡。油脂滋滋作响，厨师用勺子将热黄油缓缓淋在牛排表面。固定镜头微距，暖色调，侧光突出油脂光泽，浅景深，高端美食广告质感。',
  '低角度仰拍，一位穿着发光机能外套的女性站在未来都市的雨夜街头，身后是层层叠叠的全息广告牌和飞行器航线。她转身走入霓虹小巷，外套光纹随步伐流动。镜头跟随移动，荧光加霓虹混合光源，紫红色调，高对比度，赛博朋克风格。',
  '三维卡通动画，皮克斯动画电影质感。中景，一台方头方脑的黄色小机器人，履带底盘，两只大大的双筒望远镜式眼睛，在洒满阳光的花园里。它伸出机械手轻轻碰了碰一朵向日葵，被弹回的花瓣吓得后退，眼睛惊讶地放大，随后歪头发出好奇的姿态。镜头低角度缓慢环绕，清晨柔光，暖色调，金属漆面反射细腻，全局光照，三维渲染，皮克斯风格。',
];

// ── 一键示例(带预置文件/参数,按 mode)──────────────────────────────────
// 结构同音频/音乐:{ label, prompt, params?, files? }。i2v/flf2v/s2v/vace/sr 预置官方示例
// 素材(见 public/playground-samples/);text2video 纯文本。ChatArea 兼容纯字符串。
// mode 键与 VideoModel 的 tab itemKey 一致:text2video/image2video/flf2v/s2v/sr/vace。
export const VIDEO_EXAMPLES = {
  text2video: VIDEO_PROMPT_PRESETS,
  // 图生视频(Bernini r2v):参考图(1~3 张)生成视频 —— 参考图定义主体/服装/道具/
  // 场景等元素,由提示词组合成片(非首帧约束;首帧约束在「关键帧」模式)。
  image2video: [
    {
      label: '图生视频(参考图)',
      prompt:
        '以参考图中的少女与灵蛇为主体,生成一段电影质感短片:少女立于雾气缭绕的竹林中,灵蛇盘绕身侧缓缓游动,光斑浮动,镜头缓缓环绕拍摄。',
      files: {
        refImages: [
          '/playground-samples/images/vace-ref-girl.png',
          '/playground-samples/images/vace-ref-snake.png',
        ],
      },
    },
  ],
  // 关键帧(wan2.2 i2v):仅首帧 → i2v;首帧+尾帧 → flf2v(提交时按输入派生)。
  flf2v: [
    {
      label: '仅首帧(i2v)',
      prompt:
        '画面中的人物微微转头并露出微笑,发丝随微风轻轻飘动,背景虚化的光斑缓慢晃动,镜头缓缓向前推进。',
      files: { firstFrame: '/playground-samples/images/wan-i2v-first.jpg' },
    },
    {
      label: '首帧+尾帧(flf2v)',
      prompt:
        '镜头从首帧场景平滑过渡到尾帧,运动连贯自然,光影随时间流畅变化,电影级插帧质感。',
      files: {
        firstFrame: '/playground-samples/images/wan-flf2v-first.png',
        lastFrame: '/playground-samples/images/wan-flf2v-last.png',
      },
    },
  ],
  s2v: [
    {
      label: '数字人',
      prompt:
        'A woman is passionately singing into a professional microphone in a recording studio.',
      files: {
        firstFrame: '/playground-samples/images/infinitetalk-person.png',
        audioData: '/playground-samples/audio/infinitetalk-driving.wav',
      },
    },
  ],
  sr: [
    {
      label: '超分示例视频',
      prompt: '',
      files: { sourceVideo: '/playground-samples/video/seedvr2-lowres.mp4' },
    },
  ],
  // 视频编辑(Bernini):至少上传 1 个源视频,玩法由输入组合自动分流——
  //   1 视频 → v2v(纯提示词编辑)、1 视频+参考图 → rv2v、2 视频 → mv2v(多源编辑)。
  //   ads2v(广告植入)与 mv2v 输入相同(引擎侧 system prompt/guidance 不同),自动
  //   分流分不出,只能由示例的 params.taskType 显式指定。仅参考图的 r2v 已迁到
  //   「图生视频」模式,本模式必须有视频。
  vace: [
    {
      label: '视频编辑(纯提示词 · v2v)',
      prompt:
        '保持人物动作与镜头运动不变,将整段画面转为中国水墨丹青风格:背景大面积留白,笔触淡雅,墨色随动作晕染流动,层次分明。',
      files: {
        srcVideo: '/playground-samples/video/vace-source.mp4',
      },
    },
    {
      label: '参考图视频编辑(rv2v)',
      prompt:
        '参考图中人物的相貌与服饰,替换源视频里的主体,保持原有动作、光影与镜头运动一致,细节自然融合。',
      files: {
        srcVideo: '/playground-samples/video/vace-source.mp4',
        refImages: ['/playground-samples/images/vace-ref-girl.png'],
      },
    },
    {
      label: '双视频编辑(mv2v)',
      prompt:
        '把第二个视频的画面风格与色调迁移到第一个视频上,保持第一个视频的主体动作与镜头运动不变,过渡自然。',
      files: {
        srcVideo: '/playground-samples/video/vace-source.mp4',
        srcVideo2: '/playground-samples/video/seedvr2-lowres.mp4',
      },
    },
    {
      label: '广告植入(ads2v)',
      prompt:
        '把第二个视频的内容自然植入到第一个视频画面中的屏幕/展示位上,透视、光影与遮挡关系正确,融合无痕。',
      params: { taskType: 'ads2v' },
      files: {
        srcVideo: '/playground-samples/video/vace-source.mp4',
        srcVideo2: '/playground-samples/video/seedvr2-lowres.mp4',
      },
    },
  ],
};

export const videoExamplesForMode = (mode) => VIDEO_EXAMPLES[mode] || [];

// 视频宽高比(文生视频):可在运营后台按模型配置允许集,未配置默认全集。
export const VIDEO_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4'];
// 默认选中的宽高比(minimax 无宽高比可参考;取 16:9 = wan 引擎默认 1280×720)。
export const VIDEO_DEFAULT_ASPECT_RATIO = '16:9';
// 宽高比 → 引擎 target_shape:[height,width](720p 级,均为 16 的倍数)。
// wan t2v runner 的 get_latent_shape_with_target_hw 优先采用 target_shape,不认识 aspect_ratio。
export const VIDEO_ASPECT_RATIO_TO_SHAPE = {
  '16:9': [720, 1280],
  '9:16': [1280, 720],
  '1:1': [960, 960],
  '4:3': [768, 1024],
  '3:4': [1024, 768],
};

// 宽高比 → target_shape:[height,width]。预设 5 种走上表(手调过的固定值);其它自定义 "W:H"
// (后台 allowCreate 可能录入,如 2:1)按 ~720p 面积等比算,并对齐到 16 的倍数,避免被静默丢弃。
export const aspectRatioToShape = (ratio) => {
  if (VIDEO_ASPECT_RATIO_TO_SHAPE[ratio])
    return VIDEO_ASPECT_RATIO_TO_SHAPE[ratio];
  const m = /^\s*(\d+)\s*:\s*(\d+)\s*$/.exec(String(ratio || ''));
  if (!m) return null;
  const w = parseInt(m[1], 10);
  const h = parseInt(m[2], 10);
  if (w <= 0 || h <= 0) return null;
  const scale = Math.sqrt((1280 * 720) / (w * h));
  const round16 = (x) => Math.max(16, Math.round((x * scale) / 16) * 16);
  return [round16(h), round16(w)]; // [height, width]
};

// 当前视频体验区页面代表的能力（= 标签页名）
export const VIDEO_PAGE_CAPABILITY = '文生视频';
// 图生视频 / 首尾帧 / 数字人 / 视频超分 / 视频编辑能力标签,与文生视频共用体验区,
// 通过 mode 区分。门面 task_type 对应:s2v→数字人(音频驱动人像说话,行业通称)、
// sr→视频超分、vace→视频编辑。
export const VIDEO_I2V_CAPABILITY = '图生视频';
// 2026-07「首尾帧」改名「关键帧」:wan2.2 i2v,仅首帧(i2v)或首+尾帧(flf2v)都可,
// task_type 提交时按输入派生。旧标签走 LEGACY_ALIASES 兼容。
export const VIDEO_FLF2V_CAPABILITY = '关键帧';
export const VIDEO_S2V_CAPABILITY = '数字人';
export const VIDEO_SR_CAPABILITY = '视频超分';
export const VIDEO_VACE_CAPABILITY = '视频编辑';
// 视频配乐(dub → 门面 task_type=v2a):上传视频 + 声音描述,产物=配好音的视频。
export const VIDEO_DUB_CAPABILITY = '视频配乐';

// 能力标签重命名的向后兼容:重命名前已在「视频模型配置」里用旧标签配过的模型,仍能匹配
// 到新 Tab(否则那些模型会从体验区消失,直到手动改配置)。key=新标签,value=旧标签。
export const VIDEO_CAPABILITY_LEGACY_ALIASES = {
  [VIDEO_S2V_CAPABILITY]: '音频驱动',
  [VIDEO_SR_CAPABILITY]: '视频转视频',
  [VIDEO_VACE_CAPABILITY]: '参考生视频',
  [VIDEO_FLF2V_CAPABILITY]: '首尾帧',
};

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
// 插帧(RIFE 帧率翻倍):开启时随 metadata 透传 target_fps 给引擎(gpustack 门面
// 对该字段免验证直通)。LightX2V 生成默认 16fps;Bernini RIFE v1 仅支持 16→32。
// 统一按 32 下发;超分(sr)引擎侧不插帧,不适用。
export const VIDEO_INTERPOLATION_TARGET_FPS = 32;

// 1080P 两段流水线（前端编排）：选中 1080P 档位时 stage1 先按低档位生成，
// 完成后自动提交 sr 任务（metadata.video 用 task:<id> 引用 stage1 产物）。
// 480P(854x480) → 1080P 需要 2.25 倍超分。
export const VIDEO_PIPELINE_SR_RATIO = 2.25;
export const isPipelineTargetSize = (s) => /1080/i.test(s || '');

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
// maxInputMB:输入文件大小上限(MB)。适用于吃用户上传的模式(i2v/flf2v 帧图、s2v 人物图/
// 驱动音频、sr 源视频、视频编辑 源视频/参考图);0/未配=不限。生成侧 sizes/durations/
// aspectRatios 对这些输入驱动能力无意义(见 followsInput),maxInputMB 才是它们的护栏。
const toInputMB = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export const parseVideoModelConfig = (raw) => {
  // 未配置时默认留空，交由 getSizes/DurationsForVideoModel 按模型类别兜底
  const empty = {
    default: { sizes: [], durations: [], aspectRatios: [], maxInputMB: null },
    models: {},
  };
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
          aspectRatios: normalizeList(cfg?.aspectRatios),
          capabilities: normalizeList(cfg?.capabilities),
          maxInputMB: toInputMB(cfg?.maxInputMB),
        };
      });
    }
    return {
      default: {
        sizes: normalizeSizeList(def.sizes),
        durations: normalizeList(def.durations),
        aspectRatios: normalizeList(def.aspectRatios),
        maxInputMB: toInputMB(def.maxInputMB),
      },
      models,
    };
  } catch (e) {
    return empty;
  }
};

// 输入文件大小上限(MB):按模型配置 → 全局默认 → 0(不限)。
export const getMaxInputMBForModel = (config, model) => {
  const m = config?.models?.[model];
  if (m && m.maxInputMB != null) return m.maxInputMB;
  if (config?.default?.maxInputMB != null) return config.default.maxInputMB;
  return 0;
};

// 尺寸/分辨率:纯 opt-in——按模型配置 → 管理端全局默认 → 空(未配置则不展示、不下发)。
// 与宽高比一致:留空即"不支持选择",避免给未配置的模型误显尺寸选择器。
export const getSizesForVideoModel = (config, model) => {
  const m = config?.models?.[model];
  if (m && Array.isArray(m.sizes) && m.sizes.length > 0) return m.sizes;
  if (config?.default?.sizes?.length) return config.default.sizes;
  return [];
};

// 宽高比:纯 opt-in——按模型配置 → 管理端全局默认 → 空(未配置则不展示、不下发)。
// 不做全集兜底,避免给 minimax 等不支持宽高比的模型误显选择器。
export const getAspectRatiosForVideoModel = (config, model) => {
  const m = config?.models?.[model];
  if (m && Array.isArray(m.aspectRatios) && m.aspectRatios.length > 0)
    return m.aspectRatios;
  if (config?.default?.aspectRatios?.length) return config.default.aspectRatios;
  return [];
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

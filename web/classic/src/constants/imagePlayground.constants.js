// 图片模型相关常量

// 提示词预设:点击对应按钮清空输入框并填入该提示词(体验区快速试玩,仅文生图展示)。
export const IMAGE_PROMPT_PRESETS = [
  '远景镜头，在壮丽的雪山背景下，两个小小的人影站在远处山顶，背对着镜头，静静地观赏着日落的美景。夕阳的余晖洒在雪山上，呈现出一片金黄色的光辉，与蔚蓝的天空形成鲜明对比。两人仿佛被这壮观的自然景象所吸引，整个画面充满了宁静与和谐。',
  '长焦镜头下，一只猎豹在郁郁葱葱的森林中站立，面对镜头，背景被巧妙地虚化，猎豹的面部成为画面的绝对焦点。阳光透过树叶的缝隙，洒在猎豹身上，形成斑驳的光影效果，增强了视觉冲击力。',
  '18岁的中国女孩，古代服饰，圆脸，看着镜头，民族优雅的服装，商业摄影，室外，电影级光照，半身特写，精致的淡妆，锐利的边缘。',
  '电影感健身宣传活动，超大哑铃斜放如同标志性道具，穿红色运动装和白色短裤的女性模特坐在哑铃一侧，一条腿弯曲，一条伸直，极简黑色工作室，反光地面，背后用大号字体写着醒目的“STRENGTH”，光线锐利，构图超级干净，奢华运动美学。',
];

export const IMAGE_API_ENDPOINTS = {
  IMAGE_GENERATIONS: '/pg/images/generations',
  IMAGE_EDITS: '/pg/images/edits',
  IMAGE_PROXY: '/pg/images/proxy',
  USER_MODELS: '/api/user/models',
  USER_GROUPS: '/api/user/self/groups',
  PRICING: '/api/pricing',
};

// 图片模型能力枚举（中文即值，也是体验区标签页名）。业内常用完整集。
// 新增能力时同步维护后端 constant/model_capability.go 的 ImageCapabilities。
export const IMAGE_CAPABILITIES = [
  '文生图',
  '图生图',
  '图像编辑',
  '局部重绘',
  '扩图',
  '高清放大',
];

// 当前图片体验区页面代表的能力（= 标签页名）
export const IMAGE_PAGE_CAPABILITY = '文生图';
// 图生图（i2i）能力标签，与文生图共用体验区,通过 mode 区分
export const IMAGE_I2I_CAPABILITY = '图生图';
// 图生图最多上传底图数。前端限 3 张(≤ 后端 gpustackplus maxEditImages / 门面
// _MAX_INPUT_IMAGES=5,前端更严不会被门面拒),控制单次请求体大小与体验。
export const IMAGE_MAX_EDIT_IMAGES = 3;

// 当管理员未配置时的全局兜底：用最兼容的精确像素（dall-e/gpt-image 等只认像素的模型也能过）。
// "默认用宽高比"应通过运营配置的 default 六种比例实现，而非这里的全局兜底。
export const FALLBACK_IMAGE_SIZES = [
  '1024x1024',
  '1024x1792',
  '1792x1024',
  '512x512',
];

// 质量档（bot_task）：只有 HunyuanImage-3.0 带自回归（AR）阶段——开启后模型先思考并
// 改写提示词再去噪，短提示词下出图更贴合描述，代价是耗时显著增加（后端实测约 2.8 倍）。
// 其余图片模型（z-image、qwen-image-edit 等）引擎侧没有这条通路，传了也不生效。
// 子串匹配（大小写不敏感）与后端 GPUSTACKPLUS_SLOW_IMAGE_MODELS 的默认值保持一致。
//
// ⚠️ 仅用于 UI 提示，不用于拦截下发：渠道模型映射可以把任意模型名指向 HunyuanImage-3.0，
// 前端看不到映射结果，按名字硬拦会把这类模型的质量档一并掐掉。开关开了就照发，
// 由引擎决定认不认（其 ImageTaskRequest 是 extra="allow"，不认也只是忽略）。
export const IMAGE_QUALITY_MODE_MODELS = ['hunyuan-image-3', 'hunyuanimage-3'];

// 开启质量档时下发的 bot_task：官方默认档（CoT 思考 → 改写提示词 → 生图）。
// 关闭时不下发该字段，引擎缺省 bot_task=None 即快速档。
export const IMAGE_QUALITY_BOT_TASK = 'think_recaption';

export const supportsImageQualityMode = (model) => {
  const name = String(model || '').toLowerCase();
  return IMAGE_QUALITY_MODE_MODELS.some((s) => name.includes(s));
};

// localStorage key：图片生成历史
export const IMAGE_HISTORY_STORAGE_KEY = 'image_playground_history';

// 对话（历史）数量上限
export const IMAGE_HISTORY_LIMIT = 10;

// 单段对话内最多生成次数
export const IMAGE_CONV_TURN_LIMIT = 10;

export const IMAGE_GEN_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
};

// 规范化尺寸字符串：统一用小写字母 x 作分隔，去空格，
// 把乘号 ×/✕/╳、星号 * 都替换成 x（上游校验会拒绝 '×'）
export const normalizeImageSize = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[×✕╳*]/g, 'x');

// 尺寸列表规范化（解析与设置页保存共用，避免两条路径分叉）
export const normalizeSizeList = (list) =>
  Array.isArray(list)
    ? Array.from(new Set(list.map(normalizeImageSize).filter(Boolean)))
    : [];

// 能力列表规范化：去空格、去空、去重（不改大小写，中文原样；解析与保存共用）
export const normalizeCapabilityList = (list) =>
  Array.isArray(list)
    ? Array.from(new Set(list.map((x) => String(x).trim()).filter(Boolean)))
    : [];

// 解析管理员配置的「按模型尺寸」，返回指定模型的可选尺寸列表
// config 形如 { default: [...], models: { modelName: { sizes:[], capabilities:[] } } }
export const getSizesForModel = (config, model) => {
  const fallback = FALLBACK_IMAGE_SIZES;
  if (!config || typeof config !== 'object') return fallback;
  const entry = config.models && config.models[model];
  // 兼容旧形态（entry 为尺寸数组）与新形态（{ sizes, capabilities }）
  const modelSizes = Array.isArray(entry) ? entry : entry?.sizes;
  if (Array.isArray(modelSizes) && modelSizes.length > 0) return modelSizes;
  if (Array.isArray(config.default) && config.default.length > 0) {
    return config.default;
  }
  return fallback;
};

// 解析 status 中的 ImageModelSizeConfig（字符串或对象）
// models[name] 统一产出 { sizes:[], capabilities:[] }；兼容旧形态（值为尺寸数组）
export const parseImageSizeConfig = (raw) => {
  if (!raw) return { default: FALLBACK_IMAGE_SIZES, models: {} };
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const defaults = normalizeSizeList(parsed.default);
    const models = {};
    if (parsed.models && typeof parsed.models === 'object') {
      Object.entries(parsed.models).forEach(([model, cfg]) => {
        if (Array.isArray(cfg)) {
          // 旧形态：值为尺寸数组，无能力声明
          models[model] = { sizes: normalizeSizeList(cfg), capabilities: [] };
        } else {
          models[model] = {
            sizes: normalizeSizeList(cfg?.sizes),
            capabilities: normalizeCapabilityList(cfg?.capabilities),
          };
        }
      });
    }
    return {
      default: defaults.length > 0 ? defaults : FALLBACK_IMAGE_SIZES,
      models,
    };
  } catch (e) {
    return { default: FALLBACK_IMAGE_SIZES, models: {} };
  }
};

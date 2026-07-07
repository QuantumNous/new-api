// 图片模型相关常量

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
// 图生图最多上传底图数（与后端 gpustackplus maxEditImages / 门面 _MAX_INPUT_IMAGES 对齐）
export const IMAGE_MAX_EDIT_IMAGES = 5;

// 当管理员未配置时使用的兜底尺寸
export const FALLBACK_IMAGE_SIZES = [
  '1024x1024',
  '1024x1792',
  '1792x1024',
  '512x512',
];

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

// 图片模型相关常量

export const IMAGE_API_ENDPOINTS = {
  IMAGE_GENERATIONS: '/pg/images/generations',
  IMAGE_PROXY: '/pg/images/proxy',
  USER_MODELS: '/api/user/models',
  USER_GROUPS: '/api/user/self/groups',
  PRICING: '/api/pricing',
};

// 支持图片生成的端点类型标识（来自 /api/pricing 的 supported_endpoint_types）
export const IMAGE_ENDPOINT_TYPE = 'image-generation';

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
export const IMAGE_HISTORY_LIMIT = 20;

// 单段对话内最多生成次数
export const IMAGE_CONV_TURN_LIMIT = 20;

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

const normalizeSizeList = (list) =>
  Array.isArray(list)
    ? Array.from(new Set(list.map(normalizeImageSize).filter(Boolean)))
    : [];

// 解析管理员配置的「按模型尺寸」，返回指定模型的可选尺寸列表
// config 形如 { default: [...], models: { modelName: [...] } }
export const getSizesForModel = (config, model) => {
  const fallback = FALLBACK_IMAGE_SIZES;
  if (!config || typeof config !== 'object') return fallback;
  const modelSizes = config.models && config.models[model];
  if (Array.isArray(modelSizes) && modelSizes.length > 0) return modelSizes;
  if (Array.isArray(config.default) && config.default.length > 0) {
    return config.default;
  }
  return fallback;
};

// 解析 status 中的 ImageModelSizeConfig（字符串或对象）
export const parseImageSizeConfig = (raw) => {
  if (!raw) return { default: FALLBACK_IMAGE_SIZES, models: {} };
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const defaults = normalizeSizeList(parsed.default);
    const models = {};
    if (parsed.models && typeof parsed.models === 'object') {
      Object.entries(parsed.models).forEach(([model, sizes]) => {
        models[model] = normalizeSizeList(sizes);
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

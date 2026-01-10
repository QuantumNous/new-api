// 应用常量

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'New API';
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

// 用户角色
export const USER_ROLES = {
  USER: 1,
  ADMIN: 10,
  ROOT: 100,
} as const;

export const USER_ROLE_LABELS = {
  [USER_ROLES.USER]: '普通用户',
  [USER_ROLES.ADMIN]: '管理员',
  [USER_ROLES.ROOT]: '超级管理员',
} as const;

// 用户状态
export const USER_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
  PENDING: 3,
} as const;

export const USER_STATUS_LABELS = {
  [USER_STATUS.ENABLED]: '启用',
  [USER_STATUS.DISABLED]: '禁用',
  [USER_STATUS.PENDING]: '待审核',
} as const;

// 渠道类型
export const CHANNEL_TYPES = {
  OPENAI: 1,
  ANTHROPIC: 2,
  GOOGLE: 3,
  AZURE: 4,
  AWS: 5,
  COHERE: 6,
  HUGGINGFACE: 7,
  CUSTOM: 100,
} as const;

export const CHANNEL_TYPE_LABELS = {
  [CHANNEL_TYPES.OPENAI]: 'OpenAI',
  [CHANNEL_TYPES.ANTHROPIC]: 'Anthropic',
  [CHANNEL_TYPES.GOOGLE]: 'Google',
  [CHANNEL_TYPES.AZURE]: 'Azure',
  [CHANNEL_TYPES.AWS]: 'AWS',
  [CHANNEL_TYPES.COHERE]: 'Cohere',
  [CHANNEL_TYPES.HUGGINGFACE]: 'HuggingFace',
  [CHANNEL_TYPES.CUSTOM]: '自定义',
} as const;

// 渠道状态
export const CHANNEL_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
  AUTO_DISABLED: 3,
} as const;

export const CHANNEL_STATUS_LABELS = {
  [CHANNEL_STATUS.ENABLED]: '启用',
  [CHANNEL_STATUS.DISABLED]: '禁用',
  [CHANNEL_STATUS.AUTO_DISABLED]: '自动禁用',
} as const;

// 令牌状态
export const TOKEN_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
  EXPIRED: 3,
  EXHAUSTED: 4,
} as const;

export const TOKEN_STATUS_LABELS = {
  [TOKEN_STATUS.ENABLED]: '启用',
  [TOKEN_STATUS.DISABLED]: '禁用',
  [TOKEN_STATUS.EXPIRED]: '已过期',
  [TOKEN_STATUS.EXHAUSTED]: '额度耗尽',
} as const;

// 分页配置
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
} as const;

// 日期格式
export const DATE_FORMAT = 'YYYY-MM-DD';
export const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
export const TIME_FORMAT = 'HH:mm:ss';

// 本地存储键
export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER: 'user',
  THEME: 'theme',
  LANGUAGE: 'language',
} as const;

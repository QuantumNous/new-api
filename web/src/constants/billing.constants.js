/**
 * Single source of truth for billing expression variables.
 *
 * Every expression variable (p, c, cr, cc, ...) is defined here once.
 * All frontend consumers — editor, estimator, log display, model detail —
 * derive their data structures from this registry.
 *
 * To add a new variable:
 *   1. Add an entry here
 *   2. Backend: add to TokenParams, compileEnvPrototype, runProgram env, BuildTieredTokenParams
 */

export const BILLING_VARS = [
  { key: 'p', field: 'inputPrice', tierField: 'input_unit_cost', label: '输入价格', shortLabel: '输入', side: 'input', isBase: true },
  { key: 'c', field: 'outputPrice', tierField: 'output_unit_cost', label: '补全价格', shortLabel: '补全', side: 'output', isBase: true },
  { key: 'cr', field: 'cacheReadPrice', tierField: 'cache_read_unit_cost', label: '缓存读取价格', shortLabel: '缓存读', side: 'input', group: 'cache' },
  { key: 'cc', field: 'cacheCreatePrice', tierField: 'cache_create_unit_cost', label: '缓存创建价格', shortLabel: '缓存创建', side: 'input', group: 'cache' },
  { key: 'cc1h', field: 'cacheCreate1hPrice', tierField: 'cache_create_1h_unit_cost', label: '1h缓存创建价格', shortLabel: '1h缓存创建', side: 'input', group: 'cache' },
  { key: 'img', field: 'imagePrice', tierField: 'image_unit_cost', label: '图片输入价格', shortLabel: '图片输入', side: 'input', group: 'media' },
  { key: 'img_o', field: 'imageOutputPrice', tierField: 'image_output_unit_cost', label: '图片输出价格', shortLabel: '图片输出', side: 'output', group: 'media' },
  { key: 'ai', field: 'audioInputPrice', tierField: 'audio_input_unit_cost', label: '音频输入价格', shortLabel: '音频输入', side: 'input', group: 'media' },
  { key: 'ao', field: 'audioOutputPrice', tierField: 'audio_output_unit_cost', label: '音频补全价格', shortLabel: '音频输出', side: 'output', group: 'media' },
];

export const BILLING_VAR_KEYS = BILLING_VARS.map((v) => v.key);

export const BILLING_EXTRA_VARS = BILLING_VARS.filter((v) => !v.isBase);

export const BILLING_VAR_KEY_TO_FIELD = Object.fromEntries(
  BILLING_VARS.map((v) => [v.key, v.field]),
);

export const BILLING_VAR_FIELD_TO_LABEL = Object.fromEntries(
  BILLING_VARS.map((v) => [v.field, v.label]),
);

export const BILLING_VAR_FIELD_TO_SHORT_LABEL = Object.fromEntries(
  BILLING_VARS.map((v) => [v.field, v.shortLabel]),
);

export const BILLING_CACHE_VAR_MAP = BILLING_EXTRA_VARS.map((v) => ({
  field: v.tierField,
  exprVar: v.key,
}));

export const BILLING_VAR_REGEX = new RegExp(
  `\\b(${BILLING_VAR_KEYS.join('|')})\\s*\\*\\s*([\\d.eE+-]+)`,
  'g',
);

/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  Col,
  Collapse,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { IconDelete, IconPlus } from '@douyinfe/semi-icons';
import { copy, showError, showSuccess, verifyJSON } from '../../../../helpers';
import {
  CLAUDE_CLI_HEADER_PASSTHROUGH_TEMPLATE,
  CODEX_CLI_HEADER_PASSTHROUGH_TEMPLATE,
} from '../../../../constants/channel-affinity-template.constants';

const { Text } = Typography;

const OPERATION_MODE_OPTIONS = [
  { label: '设置字段', value: 'set' },
  { label: '删除字段', value: 'delete' },
  { label: '追加到末尾', value: 'append' },
  { label: '追加到开头', value: 'prepend' },
  { label: '复制字段', value: 'copy' },
  { label: '移动字段', value: 'move' },
  { label: '字符串替换', value: 'replace' },
  { label: '正则替换', value: 'regex_replace' },
  { label: '裁剪前缀', value: 'trim_prefix' },
  { label: '裁剪后缀', value: 'trim_suffix' },
  { label: '确保前缀', value: 'ensure_prefix' },
  { label: '确保后缀', value: 'ensure_suffix' },
  { label: '去掉空白', value: 'trim_space' },
  { label: '转小写', value: 'to_lower' },
  { label: '转大写', value: 'to_upper' },
  { label: '返回自定义错误', value: 'return_error' },
  { label: '清理对象项', value: 'prune_objects' },
  { label: '请求头透传', value: 'pass_headers' },
  { label: '字段同步', value: 'sync_fields' },
  { label: '设置请求头', value: 'set_header' },
  { label: '删除请求头', value: 'delete_header' },
  { label: '复制请求头', value: 'copy_header' },
  { label: '移动请求头', value: 'move_header' },
];

const OPERATION_MODE_VALUES = new Set(
  OPERATION_MODE_OPTIONS.map((item) => item.value),
);

const CONDITION_MODE_OPTIONS = [
  { label: '完全匹配', value: 'full' },
  { label: '前缀匹配', value: 'prefix' },
  { label: '后缀匹配', value: 'suffix' },
  { label: '包含', value: 'contains' },
  { label: '大于', value: 'gt' },
  { label: '大于等于', value: 'gte' },
  { label: '小于', value: 'lt' },
  { label: '小于等于', value: 'lte' },
];

const CONDITION_MODE_VALUES = new Set(
  CONDITION_MODE_OPTIONS.map((item) => item.value),
);

const MODE_META = {
  delete: { path: true },
  set: { path: true, value: true, keepOrigin: true },
  append: { path: true, value: true, keepOrigin: true },
  prepend: { path: true, value: true, keepOrigin: true },
  copy: { from: true, to: true },
  move: { from: true, to: true },
  replace: { path: true, from: true, to: false },
  regex_replace: { path: true, from: true, to: false },
  trim_prefix: { path: true, value: true },
  trim_suffix: { path: true, value: true },
  ensure_prefix: { path: true, value: true },
  ensure_suffix: { path: true, value: true },
  trim_space: { path: true },
  to_lower: { path: true },
  to_upper: { path: true },
  return_error: { value: true },
  prune_objects: { pathOptional: true, value: true },
  pass_headers: { value: true, keepOrigin: true },
  sync_fields: { from: true, to: true },
  set_header: { path: true, value: true, keepOrigin: true },
  delete_header: { path: true },
  copy_header: { from: true, to: true, keepOrigin: true, pathAlias: true },
  move_header: { from: true, to: true, keepOrigin: true, pathAlias: true },
};

const VALUE_REQUIRED_MODES = new Set([
  'trim_prefix',
  'trim_suffix',
  'ensure_prefix',
  'ensure_suffix',
  'set_header',
  'return_error',
  'prune_objects',
  'pass_headers',
]);

const FROM_REQUIRED_MODES = new Set([
  'copy',
  'move',
  'replace',
  'regex_replace',
  'copy_header',
  'move_header',
  'sync_fields',
]);

const TO_REQUIRED_MODES = new Set([
  'copy',
  'move',
  'copy_header',
  'move_header',
  'sync_fields',
]);

const MODE_DESCRIPTIONS = {
  set: '把值写入目标字段',
  delete: '删除目标字段',
  append: '把值追加到数组 / 字符串 / 对象末尾',
  prepend: '把值追加到数组 / 字符串 / 对象开头',
  copy: '把来源字段复制到目标字段',
  move: '把来源字段移动到目标字段',
  replace: '在目标字段里做字符串替换',
  regex_replace: '在目标字段里做正则替换',
  trim_prefix: '去掉字符串前缀',
  trim_suffix: '去掉字符串后缀',
  ensure_prefix: '确保字符串有指定前缀',
  ensure_suffix: '确保字符串有指定后缀',
  trim_space: '去掉字符串头尾空白',
  to_lower: '把字符串转成小写',
  to_upper: '把字符串转成大写',
  return_error: '立即返回自定义错误',
  prune_objects: '按条件清理对象中的子项',
  pass_headers: '把指定请求头透传到上游请求',
  sync_fields: '在一个字段有值、另一个缺失时自动补齐',
  set_header: '设置运行期请求头（支持整值覆盖，或用 JSON 映射按逗号 token 替换/删除）',
  delete_header: '删除运行期请求头',
  copy_header: '复制请求头',
  move_header: '移动请求头',
};

const getModePathLabel = (mode) => {
  if (mode === 'set_header' || mode === 'delete_header') {
    return '请求头名称';
  }
  if (mode === 'prune_objects') {
    return '目标路径（可选）';
  }
  return '目标字段路径';
};

const getModePathPlaceholder = (mode) => {
  if (mode === 'set_header') return 'Authorization';
  if (mode === 'delete_header') return 'X-Debug-Mode';
  if (mode === 'prune_objects') return 'messages';
  return 'temperature';
};

const getModeFromLabel = (mode) => {
  if (mode === 'replace') return '匹配文本';
  if (mode === 'regex_replace') return '正则表达式';
  if (mode === 'copy_header' || mode === 'move_header') return '来源请求头';
  return '来源字段';
};

const getModeFromPlaceholder = (mode) => {
  if (mode === 'replace') return 'openai/';
  if (mode === 'regex_replace') return '^gpt-';
  if (mode === 'copy_header' || mode === 'move_header') return 'Authorization';
  return 'model';
};

const getModeToLabel = (mode) => {
  if (mode === 'replace' || mode === 'regex_replace') return '替换为';
  if (mode === 'copy_header' || mode === 'move_header') return '目标请求头';
  return '目标字段';
};

const getModeToPlaceholder = (mode) => {
  if (mode === 'replace') return '（可留空）';
  if (mode === 'regex_replace') return 'openai/gpt-';
  if (mode === 'copy_header' || mode === 'move_header') return 'X-Upstream-Auth';
  return 'original_model';
};

const getModeValueLabel = (mode) => {
  if (mode === 'set_header') return '请求头值（支持字符串或 JSON 映射）';
  if (mode === 'pass_headers') return '透传请求头（支持逗号分隔或 JSON 数组）';
  if (
    mode === 'trim_prefix' ||
    mode === 'trim_suffix' ||
    mode === 'ensure_prefix' ||
    mode === 'ensure_suffix'
  ) {
    return '前后缀文本';
  }
  if (mode === 'prune_objects') {
    return '清理规则（字符串或 JSON 对象）';
  }
  return '值（支持 JSON 或普通文本）';
};

const getModeValuePlaceholder = (mode) => {
  if (mode === 'set_header') {
    return [
      'String example:',
      'Bearer sk-xxx',
      '',
      'JSON map example:',
      '{"advanced-tool-use-2025-11-20": null, "computer-use-2025-01-24": "computer-use-2025-01-24"}',
      '',
      'JSON map wildcard:',
      '{"*": null, "computer-use-2025-11-24": "computer-use-2025-11-24"}',
    ].join('\n');
  }
  if (mode === 'pass_headers') return 'Authorization, X-Request-Id';
  if (
    mode === 'trim_prefix' ||
    mode === 'trim_suffix' ||
    mode === 'ensure_prefix' ||
    mode === 'ensure_suffix'
  ) {
    return 'openai/';
  }
  if (mode === 'prune_objects') {
    return '{"type":"redacted_thinking"}';
  }
  return '0.7';
};

const getModeValueHelp = (mode) => {
  if (mode !== 'set_header') return '';
  return '字符串：整条请求头直接覆盖。JSON 映射：按逗号分隔 token 逐项处理，null 表示删除，string/array 表示替换，* 表示兜底规则。';
};

const SYNC_TARGET_TYPE_OPTIONS = [
  { label: '请求体字段', value: 'json' },
  { label: '请求头字段', value: 'header' },
];

const LEGACY_TEMPLATE = {
  temperature: 0,
  max_tokens: 1000,
};

const OPERATION_TEMPLATE = {
  operations: [
    {
      path: 'temperature',
      mode: 'set',
      value: 0.7,
      conditions: [
        {
          path: 'model',
          mode: 'prefix',
          value: 'openai/',
        },
      ],
      logic: 'AND',
    },
  ],
};

const HEADER_PASSTHROUGH_TEMPLATE = {
  operations: [
    {
      mode: 'pass_headers',
      value: ['Authorization'],
      keep_origin: true,
    },
  ],
};

const GEMINI_IMAGE_4K_TEMPLATE = {
  operations: [
    {
      mode: 'set',
      path: 'generationConfig.imageConfig.imageSize',
      value: '4K',
      conditions: [
        {
          path: 'original_model',
          mode: 'contains',
          value: 'gemini-3-pro-image-preview',
        },
      ],
      logic: 'AND',
    },
  ],
};

const AWS_BEDROCK_ANTHROPIC_BETA_OVERRIDE_TEMPLATE = {
  operations: [
    {
      mode: 'set_header',
      path: 'anthropic-beta',
      value: {
        'advanced-tool-use-2025-11-20': 'tool-search-tool-2025-10-19',
        bash_20241022: null,
        bash_20250124: null,
        'code-execution-2025-08-25': null,
        'compact-2026-01-12': 'compact-2026-01-12',
        'computer-use-2025-01-24': 'computer-use-2025-01-24',
        'computer-use-2025-11-24': 'computer-use-2025-11-24',
        'context-1m-2025-08-07': 'context-1m-2025-08-07',
        'context-management-2025-06-27': 'context-management-2025-06-27',
        'effort-2025-11-24': null,
        'fast-mode-2026-02-01': null,
        'files-api-2025-04-14': null,
        'fine-grained-tool-streaming-2025-05-14': null,
        'interleaved-thinking-2025-05-14': 'interleaved-thinking-2025-05-14',
        'mcp-client-2025-11-20': null,
        'mcp-client-2025-04-04': null,
        'mcp-servers-2025-12-04': null,
        'output-128k-2025-02-19': null,
        'structured-output-2024-03-01': null,
        'prompt-caching-scope-2026-01-05': null,
        'skills-2025-10-02': null,
        'structured-outputs-2025-11-13': null,
        text_editor_20241022: null,
        text_editor_20250124: null,
        'token-efficient-tools-2025-02-19': null,
        'tool-search-tool-2025-10-19': 'tool-search-tool-2025-10-19',
        'web-fetch-2025-09-10': null,
        'web-search-2025-03-05': null,
      },
    },
  ],
};

const TEMPLATE_GROUP_OPTIONS = [
  { label: '基础模板', value: 'basic' },
  { label: '场景模板', value: 'scenario' },
];

const TEMPLATE_PRESET_CONFIG = {
  operations_default: {
    group: 'basic',
    label: '新格式模板（规则集）',
    kind: 'operations',
    payload: OPERATION_TEMPLATE,
  },
  legacy_default: {
    group: 'basic',
    label: '旧格式模板（JSON 对象）',
    kind: 'legacy',
    payload: LEGACY_TEMPLATE,
  },
  pass_headers_auth: {
    group: 'scenario',
    label: '请求头透传（Authorization）',
    kind: 'operations',
    payload: HEADER_PASSTHROUGH_TEMPLATE,
  },
  gemini_image_4k: {
    group: 'scenario',
    label: 'Gemini 图片 4K',
    kind: 'operations',
    payload: GEMINI_IMAGE_4K_TEMPLATE,
  },
  claude_cli_headers_passthrough: {
    group: 'scenario',
    label: 'Claude CLI 请求头透传',
    kind: 'operations',
    payload: CLAUDE_CLI_HEADER_PASSTHROUGH_TEMPLATE,
  },
  codex_cli_headers_passthrough: {
    group: 'scenario',
    label: 'Codex CLI 请求头透传',
    kind: 'operations',
    payload: CODEX_CLI_HEADER_PASSTHROUGH_TEMPLATE,
  },
  aws_bedrock_anthropic_beta_override: {
    group: 'scenario',
    label: 'AWS Bedrock anthropic-beta覆盖',
    kind: 'operations',
    payload: AWS_BEDROCK_ANTHROPIC_BETA_OVERRIDE_TEMPLATE,
  },
};

const FIELD_GUIDE_TARGET_OPTIONS = [
  { label: '填入目标路径', value: 'path' },
  { label: '填入来源字段', value: 'from' },
  { label: '填入目标字段', value: 'to' },
];

const BUILTIN_FIELD_SECTIONS = [
  {
    title: '常用请求字段',
    fields: [
      {
        key: 'model',
        label: '模型名称',
        tip: '支持多级模型名，例如 openai/gpt-4o-mini',
      },
      { key: 'temperature', label: '采样温度', tip: '控制输出随机性' },
      { key: 'max_tokens', label: '最大输出 Token', tip: '控制输出长度上限' },
      { key: 'messages.-1.content', label: '最后一条消息内容', tip: '常用于重写用户输入' },
    ],
  },
  {
    title: '上下文字段',
    fields: [
      { key: 'retry.is_retry', label: '是否重试', tip: 'true 表示重试请求' },
      { key: 'last_error.code', label: '上次错误码', tip: '配合重试策略使用' },
      {
        key: 'metadata.conversation_id',
        label: '会话 ID',
        tip: '可用于路由或缓存命中',
      },
    ],
  },
  {
    title: '请求头映射字段',
    fields: [
      {
        key: 'header_override_normalized.authorization',
        label: '标准化 Authorization',
        tip: '统一小写后可稳定匹配',
      },
      {
        key: 'header_override_normalized.x_debug_mode',
        label: '标准化 X-Debug-Mode',
        tip: '适合灰度 / 调试开关判断',
      },
    ],
  },
];

const OPERATION_MODE_LABEL_MAP = OPERATION_MODE_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

let localIdSeed = 0;
const nextLocalId = () => `param_override_${Date.now()}_${localIdSeed++}`;

const toValueText = (value) => {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
};

const parseLooseValue = (valueText) => {
  const raw = String(valueText ?? '');
  if (raw.trim() === '') return '';
  try {
    return JSON.parse(raw);
  } catch (error) {
    return raw;
  }
};

const parsePassHeaderNames = (rawValue) => {
  if (Array.isArray(rawValue)) {
    return rawValue
      .map((item) => String(item ?? '').trim())
      .filter(Boolean);
  }
  if (rawValue && typeof rawValue === 'object') {
    if (Array.isArray(rawValue.headers)) {
      return rawValue.headers
        .map((item) => String(item ?? '').trim())
        .filter(Boolean);
    }
    if (rawValue.header !== undefined) {
      const single = String(rawValue.header ?? '').trim();
      return single ? [single] : [];
    }
    return [];
  }
  if (typeof rawValue === 'string') {
    return rawValue
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const parseReturnErrorDraft = (valueText) => {
  const defaults = {
    message: '',
    statusCode: 400,
    code: '',
    type: '',
    skipRetry: true,
    simpleMode: true,
  };

  const raw = String(valueText ?? '').trim();
  if (!raw) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const statusRaw =
        parsed.status_code !== undefined ? parsed.status_code : parsed.status;
      const statusValue = Number(statusRaw);
      return {
        ...defaults,
        message: String(parsed.message || parsed.msg || '').trim(),
        statusCode:
          Number.isInteger(statusValue) &&
          statusValue >= 100 &&
          statusValue <= 599
            ? statusValue
            : 400,
        code: String(parsed.code || '').trim(),
        type: String(parsed.type || '').trim(),
        skipRetry: parsed.skip_retry !== false,
        simpleMode: false,
      };
    }
  } catch (error) {
    // treat as plain text message
  }

  return {
    ...defaults,
    message: raw,
    simpleMode: true,
  };
};

const buildReturnErrorValueText = (draft = {}) => {
  const message = String(draft.message || '').trim();
  if (draft.simpleMode) {
    return message;
  }

  const statusCode = Number(draft.statusCode);
  const payload = {
    message,
    status_code:
      Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599
        ? statusCode
        : 400,
  };
  const code = String(draft.code || '').trim();
  const type = String(draft.type || '').trim();
  if (code) payload.code = code;
  if (type) payload.type = type;
  if (draft.skipRetry === false) {
    payload.skip_retry = false;
  }
  return JSON.stringify(payload);
};

const normalizePruneRule = (rule = {}) => ({
  id: nextLocalId(),
  path: typeof rule.path === 'string' ? rule.path : '',
  mode: CONDITION_MODE_VALUES.has(rule.mode) ? rule.mode : 'full',
  value_text: toValueText(rule.value),
  invert: rule.invert === true,
  pass_missing_key: rule.pass_missing_key === true,
});

const parsePruneObjectsDraft = (valueText) => {
  const defaults = {
    simpleMode: true,
    typeText: '',
    logic: 'AND',
    recursive: true,
    rules: [],
  };

  const raw = String(valueText ?? '').trim();
  if (!raw) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'string') {
      return {
        ...defaults,
        simpleMode: true,
        typeText: parsed.trim(),
      };
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const rules = [];
      if (parsed.where && typeof parsed.where === 'object' && !Array.isArray(parsed.where)) {
        Object.entries(parsed.where).forEach(([path, value]) => {
          rules.push(
            normalizePruneRule({
              path,
              mode: 'full',
              value,
            }),
          );
        });
      }
      if (Array.isArray(parsed.conditions)) {
        parsed.conditions.forEach((item) => {
          if (item && typeof item === 'object') {
            rules.push(normalizePruneRule(item));
          }
        });
      } else if (
        parsed.conditions &&
        typeof parsed.conditions === 'object' &&
        !Array.isArray(parsed.conditions)
      ) {
        Object.entries(parsed.conditions).forEach(([path, value]) => {
          rules.push(
            normalizePruneRule({
              path,
              mode: 'full',
              value,
            }),
          );
        });
      }

      const typeText =
        parsed.type === undefined ? '' : String(parsed.type).trim();
      const logic =
        String(parsed.logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND';
      const recursive = parsed.recursive !== false;
      const hasAdvancedFields =
        parsed.logic !== undefined ||
        parsed.recursive !== undefined ||
        parsed.where !== undefined ||
        parsed.conditions !== undefined;

      return {
        ...defaults,
        simpleMode: !hasAdvancedFields,
        typeText,
        logic,
        recursive,
        rules,
      };
    }
    return {
      ...defaults,
      simpleMode: true,
      typeText: String(parsed ?? '').trim(),
    };
  } catch (error) {
    return {
      ...defaults,
      simpleMode: true,
      typeText: raw,
    };
  }
};

const buildPruneObjectsValueText = (draft = {}) => {
  const typeText = String(draft.typeText || '').trim();
  if (draft.simpleMode) {
    return typeText;
  }

  const payload = {};
  if (typeText) {
    payload.type = typeText;
  }
  if (String(draft.logic || 'AND').toUpperCase() === 'OR') {
    payload.logic = 'OR';
  }
  if (draft.recursive === false) {
    payload.recursive = false;
  }

  const conditions = (draft.rules || [])
    .filter((rule) => String(rule.path || '').trim())
    .map((rule) => {
      const conditionPayload = {
        path: String(rule.path || '').trim(),
        mode: CONDITION_MODE_VALUES.has(rule.mode) ? rule.mode : 'full',
      };
      const valueRaw = String(rule.value_text || '').trim();
      if (valueRaw !== '') {
        conditionPayload.value = parseLooseValue(valueRaw);
      }
      if (rule.invert) {
        conditionPayload.invert = true;
      }
      if (rule.pass_missing_key) {
        conditionPayload.pass_missing_key = true;
      }
      return conditionPayload;
    });

  if (conditions.length > 0) {
    payload.conditions = conditions;
  }

  if (!payload.type && !payload.conditions) {
    return JSON.stringify({ logic: 'AND' });
  }
  return JSON.stringify(payload);
};

const parseSyncTargetSpec = (spec) => {
  const raw = String(spec ?? '').trim();
  if (!raw) return { type: 'json', key: '' };
  const idx = raw.indexOf(':');
  if (idx < 0) return { type: 'json', key: raw };
  const prefix = raw.slice(0, idx).trim().toLowerCase();
  const key = raw.slice(idx + 1).trim();
  if (prefix === 'header') {
    return { type: 'header', key };
  }
  return { type: 'json', key };
};

const buildSyncTargetSpec = (type, key) => {
  const normalizedType = type === 'header' ? 'header' : 'json';
  const normalizedKey = String(key ?? '').trim();
  if (!normalizedKey) return '';
  return `${normalizedType}:${normalizedKey}`;
};

const normalizeCondition = (condition = {}) => ({
  id: nextLocalId(),
  path: typeof condition.path === 'string' ? condition.path : '',
  mode: CONDITION_MODE_VALUES.has(condition.mode) ? condition.mode : 'full',
  value_text: toValueText(condition.value),
  invert: condition.invert === true,
  pass_missing_key: condition.pass_missing_key === true,
});

const createDefaultCondition = () => normalizeCondition({});

const normalizeOperation = (operation = {}) => ({
  id: nextLocalId(),
  path: typeof operation.path === 'string' ? operation.path : '',
  mode: OPERATION_MODE_VALUES.has(operation.mode) ? operation.mode : 'set',
  value_text: toValueText(operation.value),
  keep_origin: operation.keep_origin === true,
  from: typeof operation.from === 'string' ? operation.from : '',
  to: typeof operation.to === 'string' ? operation.to : '',
  logic: String(operation.logic || 'OR').toUpperCase() === 'AND' ? 'AND' : 'OR',
  conditions: Array.isArray(operation.conditions)
    ? operation.conditions.map(normalizeCondition)
    : [],
});

const createDefaultOperation = () => normalizeOperation({ mode: 'set' });

const getOperationSummary = (operation = {}, index = 0) => {
  const mode = operation.mode || 'set';
  const modeLabel = OPERATION_MODE_LABEL_MAP[mode] || mode;
  if (mode === 'sync_fields') {
    const from = String(operation.from || '').trim();
    const to = String(operation.to || '').trim();
    return `${index + 1}. ${modeLabel} · ${from || to || '-'}`;
  }
  const path = String(operation.path || '').trim();
  const from = String(operation.from || '').trim();
  const to = String(operation.to || '').trim();
  return `${index + 1}. ${modeLabel} · ${path || from || to || '-'}`;
};

const getOperationModeTagColor = (mode = 'set') => {
  if (mode.includes('header')) return 'cyan';
  if (mode.includes('replace') || mode.includes('trim')) return 'violet';
  if (mode.includes('copy') || mode.includes('move')) return 'blue';
  if (mode.includes('error') || mode.includes('prune')) return 'red';
  if (mode.includes('sync')) return 'green';
  return 'grey';
};

const parseInitialState = (rawValue) => {
  const text = typeof rawValue === 'string' ? rawValue : '';
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      editMode: 'visual',
      visualMode: 'operations',
      legacyValue: '',
      operations: [createDefaultOperation()],
      jsonText: '',
      jsonError: '',
    };
  }

  if (!verifyJSON(trimmed)) {
    return {
      editMode: 'json',
      visualMode: 'operations',
      legacyValue: '',
      operations: [createDefaultOperation()],
      jsonText: text,
      jsonError: 'JSON 格式不正确',
    };
  }

  const parsed = JSON.parse(trimmed);
  const pretty = JSON.stringify(parsed, null, 2);

  if (
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    Array.isArray(parsed.operations)
  ) {
    return {
      editMode: 'visual',
      visualMode: 'operations',
      legacyValue: '',
      operations:
        parsed.operations.length > 0
          ? parsed.operations.map(normalizeOperation)
          : [createDefaultOperation()],
      jsonText: pretty,
      jsonError: '',
    };
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return {
      editMode: 'visual',
      visualMode: 'legacy',
      legacyValue: pretty,
      operations: [createDefaultOperation()],
      jsonText: pretty,
      jsonError: '',
    };
  }

  return {
    editMode: 'json',
    visualMode: 'operations',
    legacyValue: '',
    operations: [createDefaultOperation()],
    jsonText: pretty,
    jsonError: '',
  };
};

const isOperationBlank = (operation) => {
  const hasCondition = (operation.conditions || []).some(
    (condition) =>
      condition.path.trim() ||
      String(condition.value_text ?? '').trim() ||
      condition.mode !== 'full' ||
      condition.invert ||
      condition.pass_missing_key,
  );
  return (
    operation.mode === 'set' &&
    !operation.path.trim() &&
    !operation.from.trim() &&
    !operation.to.trim() &&
    String(operation.value_text ?? '').trim() === '' &&
    !operation.keep_origin &&
    !hasCondition
  );
};

const buildConditionPayload = (condition) => {
  const path = condition.path.trim();
  if (!path) return null;
  const payload = {
    path,
    mode: condition.mode || 'full',
    value: parseLooseValue(condition.value_text),
  };
  if (condition.invert) payload.invert = true;
  if (condition.pass_missing_key) payload.pass_missing_key = true;
  return payload;
};

const validateOperations = (operations, t) => {
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    const mode = op.mode || 'set';
    const meta = MODE_META[mode] || MODE_META.set;
    const line = i + 1;
    const pathValue = op.path.trim();
    const fromValue = op.from.trim();
    const toValue = op.to.trim();

    if (meta.path && !pathValue) {
      return t('第 {{line}} 条操作缺少目标路径', { line });
    }
    if (FROM_REQUIRED_MODES.has(mode) && !fromValue) {
      if (!(meta.pathAlias && pathValue)) {
        return t('第 {{line}} 条操作缺少来源字段', { line });
      }
    }
    if (TO_REQUIRED_MODES.has(mode) && !toValue) {
      if (!(meta.pathAlias && pathValue)) {
        return t('第 {{line}} 条操作缺少目标字段', { line });
      }
    }
    if (meta.from && !fromValue) {
      return t('第 {{line}} 条操作缺少来源字段', { line });
    }
    if (meta.to && !toValue) {
      return t('第 {{line}} 条操作缺少目标字段', { line });
    }
    if (
      VALUE_REQUIRED_MODES.has(mode) &&
      String(op.value_text ?? '').trim() === ''
    ) {
      return t('第 {{line}} 条操作缺少值', { line });
    }
    if (mode === 'return_error') {
      const raw = String(op.value_text ?? '').trim();
      if (!raw) {
        return t('第 {{line}} 条操作缺少值', { line });
      }
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          if (!String(parsed.message || '').trim()) {
            return t('第 {{line}} 条 return_error 需要 message 字段', { line });
          }
        }
      } catch (error) {
        // plain string value is allowed
      }
    }

    if (mode === 'prune_objects') {
      const raw = String(op.value_text ?? '').trim();
      if (!raw) {
        return t('第 {{line}} 条 prune_objects 缺少条件', { line });
      }
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const hasType =
            parsed.type !== undefined &&
            String(parsed.type).trim() !== '';
          const hasWhere =
            parsed.where &&
            typeof parsed.where === 'object' &&
            !Array.isArray(parsed.where) &&
            Object.keys(parsed.where).length > 0;
          const hasConditionsArray =
            Array.isArray(parsed.conditions) && parsed.conditions.length > 0;
          const hasConditionsObject =
            parsed.conditions &&
            typeof parsed.conditions === 'object' &&
            !Array.isArray(parsed.conditions) &&
            Object.keys(parsed.conditions).length > 0;
          if (!hasType && !hasWhere && !hasConditionsArray && !hasConditionsObject) {
            return t('第 {{line}} 条 prune_objects 需要至少一个匹配条件', {
              line,
            });
          }
        }
      } catch (error) {
        // non-JSON string is treated as type string
      }
    }

    if (mode === 'pass_headers') {
      const raw = String(op.value_text ?? '').trim();
      if (!raw) {
        return t('第 {{line}} 条请求头透传缺少请求头名称', { line });
      }
      const parsed = parseLooseValue(raw);
      const headers = parsePassHeaderNames(parsed);
      if (headers.length === 0) {
        return t('第 {{line}} 条请求头透传格式无效', { line });
      }
    }
  }
  return '';
};

const ParamOverrideEditorModal = ({ visible, value, onSave, onCancel }) => {
  const { t } = useTranslation();

  const [editMode, setEditMode] = useState('visual');
  const [visualMode, setVisualMode] = useState('operations');
  const [legacyValue, setLegacyValue] = useState('');
  const [operations, setOperations] = useState([createDefaultOperation()]);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [operationSearch, setOperationSearch] = useState('');
  const [selectedOperationId, setSelectedOperationId] = useState('');
  const [expandedConditionMap, setExpandedConditionMap] = useState({});
  const [templateGroupKey, setTemplateGroupKey] = useState('basic');
  const [templatePresetKey, setTemplatePresetKey] = useState('operations_default');
  const [fieldGuideVisible, setFieldGuideVisible] = useState(false);
  const [fieldGuideTarget, setFieldGuideTarget] = useState('path');
  const [fieldGuideKeyword, setFieldGuideKeyword] = useState('');

  useEffect(() => {
    if (!visible) return;
    const nextState = parseInitialState(value);
    setEditMode(nextState.editMode);
    setVisualMode(nextState.visualMode);
    setLegacyValue(nextState.legacyValue);
    setOperations(nextState.operations);
    setJsonText(nextState.jsonText);
    setJsonError(nextState.jsonError);
    setOperationSearch('');
    setSelectedOperationId(nextState.operations[0]?.id || '');
    setExpandedConditionMap({});
    if (nextState.visualMode === 'legacy') {
      setTemplateGroupKey('basic');
      setTemplatePresetKey('legacy_default');
    } else {
      setTemplateGroupKey('basic');
      setTemplatePresetKey('operations_default');
    }
    setFieldGuideVisible(false);
    setFieldGuideTarget('path');
    setFieldGuideKeyword('');
  }, [visible, value]);

  useEffect(() => {
    if (operations.length === 0) {
      setSelectedOperationId('');
      return;
    }
    if (!operations.some((item) => item.id === selectedOperationId)) {
      setSelectedOperationId(operations[0].id);
    }
  }, [operations, selectedOperationId]);

  const templatePresetOptions = useMemo(
    () =>
      Object.entries(TEMPLATE_PRESET_CONFIG)
        .filter(([, config]) => config.group === templateGroupKey)
        .map(([value, config]) => ({
          value,
          label: config.label,
        })),
    [templateGroupKey],
  );

  useEffect(() => {
    if (templatePresetOptions.length === 0) return;
    const exists = templatePresetOptions.some(
      (item) => item.value === templatePresetKey,
    );
    if (!exists) {
      setTemplatePresetKey(templatePresetOptions[0].value);
    }
  }, [templatePresetKey, templatePresetOptions]);

  const operationCount = useMemo(
    () => operations.filter((item) => !isOperationBlank(item)).length,
    [operations],
  );

  const filteredOperations = useMemo(() => {
    const keyword = operationSearch.trim().toLowerCase();
    if (!keyword) return operations;
    return operations.filter((operation) => {
      const searchableText = [
        operation.mode,
        operation.path,
        operation.from,
        operation.to,
        operation.value_text,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchableText.includes(keyword);
    });
  }, [operationSearch, operations]);

  const selectedOperation = useMemo(
    () => operations.find((operation) => operation.id === selectedOperationId),
    [operations, selectedOperationId],
  );

  const selectedOperationIndex = useMemo(
    () =>
      operations.findIndex((operation) => operation.id === selectedOperationId),
    [operations, selectedOperationId],
  );

  const returnErrorDraft = useMemo(() => {
    if (!selectedOperation || (selectedOperation.mode || '') !== 'return_error') {
      return null;
    }
    return parseReturnErrorDraft(selectedOperation.value_text);
  }, [selectedOperation]);

  const pruneObjectsDraft = useMemo(() => {
    if (!selectedOperation || (selectedOperation.mode || '') !== 'prune_objects') {
      return null;
    }
    return parsePruneObjectsDraft(selectedOperation.value_text);
  }, [selectedOperation]);

  const topOperationModes = useMemo(() => {
    const counts = operations.reduce((acc, operation) => {
      const mode = operation.mode || 'set';
      acc[mode] = (acc[mode] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [operations]);

  const buildOperationsJson = useCallback(
    (sourceOperations, options = {}) => {
      const { validate = true } = options;
      const filteredOps = sourceOperations.filter((item) => !isOperationBlank(item));
      if (filteredOps.length === 0) return '';

      if (validate) {
        const message = validateOperations(filteredOps, t);
        if (message) {
          throw new Error(message);
        }
      }

      const payloadOps = filteredOps.map((operation) => {
        const mode = operation.mode || 'set';
        const meta = MODE_META[mode] || MODE_META.set;
        const pathValue = operation.path.trim();
        const fromValue = operation.from.trim();
        const toValue = operation.to.trim();
        const payload = { mode };
        if (meta.path) {
          payload.path = pathValue;
        }
        if (meta.pathOptional && pathValue) {
          payload.path = pathValue;
        }
        if (meta.value) {
          payload.value = parseLooseValue(operation.value_text);
        }
        if (meta.keepOrigin && operation.keep_origin) {
          payload.keep_origin = true;
        }
        if (meta.from) {
          payload.from = fromValue;
        }
        if (!meta.to && operation.to.trim()) {
          payload.to = toValue;
        }
        if (meta.to) {
          payload.to = toValue;
        }
        if (meta.pathAlias) {
          if (!payload.from && pathValue) {
            payload.from = pathValue;
          }
          if (!payload.to && pathValue) {
            payload.to = pathValue;
          }
        }

        const conditions = (operation.conditions || [])
          .map(buildConditionPayload)
          .filter(Boolean);

        if (conditions.length > 0) {
          payload.conditions = conditions;
          payload.logic = operation.logic === 'AND' ? 'AND' : 'OR';
        }

        return payload;
      });

      return JSON.stringify({ operations: payloadOps }, null, 2);
    },
    [t],
  );

  const buildVisualJson = useCallback(() => {
    if (visualMode === 'legacy') {
      const trimmed = legacyValue.trim();
      if (!trimmed) return '';
      if (!verifyJSON(trimmed)) {
        throw new Error(t('参数覆盖必须是合法的 JSON 格式！'));
      }
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(t('旧格式必须是 JSON 对象'));
      }
      return JSON.stringify(parsed, null, 2);
    }
    return buildOperationsJson(operations, { validate: true });
  }, [buildOperationsJson, legacyValue, operations, t, visualMode]);

  const switchToJsonMode = () => {
    if (editMode === 'json') return;
    try {
      setJsonText(buildVisualJson());
      setJsonError('');
    } catch (error) {
      showError(error.message);
      if (visualMode === 'legacy') {
        setJsonText(legacyValue);
      } else {
        setJsonText(buildOperationsJson(operations, { validate: false }));
      }
      setJsonError(error.message || t('参数配置有误'));
    }
    setEditMode('json');
  };

  const switchToVisualMode = () => {
    if (editMode === 'visual') return;
    const trimmed = jsonText.trim();
    if (!trimmed) {
      const fallback = createDefaultOperation();
      setVisualMode('operations');
      setOperations([fallback]);
      setSelectedOperationId(fallback.id);
      setLegacyValue('');
      setJsonError('');
      setEditMode('visual');
      return;
    }
    if (!verifyJSON(trimmed)) {
      showError(t('参数覆盖必须是合法的 JSON 格式！'));
      return;
    }
    const parsed = JSON.parse(trimmed);
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      Array.isArray(parsed.operations)
    ) {
      const nextOperations =
        parsed.operations.length > 0
          ? parsed.operations.map(normalizeOperation)
          : [createDefaultOperation()];
      setVisualMode('operations');
      setOperations(nextOperations);
      setSelectedOperationId(nextOperations[0]?.id || '');
      setLegacyValue('');
      setJsonError('');
      setEditMode('visual');
      setTemplateGroupKey('basic');
      setTemplatePresetKey('operations_default');
      return;
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const fallback = createDefaultOperation();
      setVisualMode('legacy');
      setLegacyValue(JSON.stringify(parsed, null, 2));
      setOperations([fallback]);
      setSelectedOperationId(fallback.id);
      setJsonError('');
      setEditMode('visual');
      setTemplateGroupKey('basic');
      setTemplatePresetKey('legacy_default');
      return;
    }
    showError(t('参数覆盖必须是合法的 JSON 对象'));
  };

  const fillLegacyTemplate = (legacyPayload) => {
    const text = JSON.stringify(legacyPayload, null, 2);
    const fallback = createDefaultOperation();
    setVisualMode('legacy');
    setLegacyValue(text);
    setOperations([fallback]);
    setSelectedOperationId(fallback.id);
    setExpandedConditionMap({});
    setJsonText(text);
    setJsonError('');
    setEditMode('visual');
  };

  const fillOperationsTemplate = (operationsPayload) => {
    const nextOperations = (operationsPayload || []).map(normalizeOperation);
    const finalOperations =
      nextOperations.length > 0 ? nextOperations : [createDefaultOperation()];
    setVisualMode('operations');
    setOperations(finalOperations);
    setSelectedOperationId(finalOperations[0]?.id || '');
    setExpandedConditionMap({});
    setJsonText(JSON.stringify({ operations: operationsPayload || [] }, null, 2));
    setJsonError('');
    setEditMode('visual');
  };

  const appendLegacyTemplate = (legacyPayload) => {
    let parsedCurrent = {};
    if (visualMode === 'legacy') {
      const trimmed = legacyValue.trim();
      if (trimmed) {
        if (!verifyJSON(trimmed)) {
          showError(t('当前旧格式 JSON 不合法，无法追加模板'));
          return;
        }
        const parsed = JSON.parse(trimmed);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          showError(t('当前旧格式不是 JSON 对象，无法追加模板'));
          return;
        }
        parsedCurrent = parsed;
      }
    }

    const merged = {
      ...(legacyPayload || {}),
      ...parsedCurrent,
    };
    const text = JSON.stringify(merged, null, 2);
    const fallback = createDefaultOperation();
    setVisualMode('legacy');
    setLegacyValue(text);
    setOperations([fallback]);
    setSelectedOperationId(fallback.id);
    setExpandedConditionMap({});
    setJsonText(text);
    setJsonError('');
    setEditMode('visual');
  };

  const appendOperationsTemplate = (operationsPayload) => {
    const appended = (operationsPayload || []).map(normalizeOperation);
    const existing =
      visualMode === 'operations'
        ? operations.filter((item) => !isOperationBlank(item))
        : [];
    const nextOperations = [...existing, ...appended];
    setVisualMode('operations');
    setOperations(nextOperations.length > 0 ? nextOperations : appended);
    setSelectedOperationId(nextOperations[0]?.id || appended[0]?.id || '');
    setExpandedConditionMap({});
    setLegacyValue('');
    setJsonError('');
    setEditMode('visual');
    setJsonText('');
  };

  const clearValue = () => {
    const fallback = createDefaultOperation();
    setVisualMode('operations');
    setLegacyValue('');
    setOperations([fallback]);
    setSelectedOperationId(fallback.id);
    setExpandedConditionMap({});
    setJsonText('');
    setJsonError('');
    setTemplateGroupKey('basic');
    setTemplatePresetKey('operations_default');
  };

  const getSelectedTemplatePreset = () =>
    TEMPLATE_PRESET_CONFIG[templatePresetKey] ||
    TEMPLATE_PRESET_CONFIG.operations_default;

  const fillTemplateFromLibrary = () => {
    const preset = getSelectedTemplatePreset();
    if (preset.kind === 'legacy') {
      fillLegacyTemplate(preset.payload || {});
      return;
    }
    fillOperationsTemplate(preset.payload?.operations || []);
  };

  const appendTemplateFromLibrary = () => {
    const preset = getSelectedTemplatePreset();
    if (preset.kind === 'legacy') {
      appendLegacyTemplate(preset.payload || {});
      return;
    }
    appendOperationsTemplate(preset.payload?.operations || []);
  };

  const resetEditorState = () => {
    clearValue();
    setEditMode('visual');
  };

  const applyBuiltinField = (fieldKey, target = 'path') => {
    if (!selectedOperation) {
      showError(t('请先选择一条规则'));
      return;
    }
    const mode = selectedOperation.mode || 'set';
    const meta = MODE_META[mode] || MODE_META.set;
    if (target === 'path' && (meta.path || meta.pathOptional || meta.pathAlias)) {
      updateOperation(selectedOperation.id, { path: fieldKey });
      return;
    }
    if (target === 'from' && (meta.from || meta.pathAlias || mode === 'sync_fields')) {
      updateOperation(selectedOperation.id, {
        from: mode === 'sync_fields' ? buildSyncTargetSpec('json', fieldKey) : fieldKey,
      });
      return;
    }
    if (target === 'to' && (meta.to || mode === 'sync_fields')) {
      updateOperation(selectedOperation.id, {
        to: mode === 'sync_fields' ? buildSyncTargetSpec('json', fieldKey) : fieldKey,
      });
      return;
    }
    showError(t('当前规则不支持写入到该位置'));
  };

  const openFieldGuide = (target = 'path') => {
    setFieldGuideTarget(target);
    setFieldGuideVisible(true);
  };

  const copyBuiltinField = async (fieldKey) => {
    const ok = await copy(fieldKey);
    if (ok) {
      showSuccess(t('已复制字段：{{name}}', { name: fieldKey }));
    } else {
      showError(t('复制失败'));
    }
  };

  const filteredFieldGuideSections = useMemo(() => {
    const keyword = fieldGuideKeyword.trim().toLowerCase();
    if (!keyword) {
      return BUILTIN_FIELD_SECTIONS;
    }
    return BUILTIN_FIELD_SECTIONS.map((section) => ({
      ...section,
      fields: section.fields.filter((field) =>
        [field.key, field.label, field.tip]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(keyword),
      ),
    })).filter((section) => section.fields.length > 0);
  }, [fieldGuideKeyword]);

  const fieldGuideActionLabel = useMemo(() => {
    if (fieldGuideTarget === 'from') return t('填入来源');
    if (fieldGuideTarget === 'to') return t('填入目标');
    return t('填入路径');
  }, [fieldGuideTarget, t]);

  const fieldGuideFieldCount = useMemo(
    () =>
      filteredFieldGuideSections.reduce(
        (total, section) => total + section.fields.length,
        0,
      ),
    [filteredFieldGuideSections],
  );

  const updateOperation = (operationId, patch) => {
    setOperations((prev) =>
      prev.map((item) =>
        item.id === operationId ? { ...item, ...patch } : item,
      ),
    );
  };

  const formatSelectedOperationValueAsJson = useCallback(() => {
    if (!selectedOperation) return;
    const raw = String(selectedOperation.value_text || '').trim();
    if (!raw) return;
    if (!verifyJSON(raw)) {
      showError(t('当前值不是合法 JSON，无法格式化'));
      return;
    }
    try {
      updateOperation(selectedOperation.id, {
        value_text: JSON.stringify(JSON.parse(raw), null, 2),
      });
      showSuccess(t('JSON 已格式化'));
    } catch (error) {
      showError(t('当前值不是合法 JSON，无法格式化'));
    }
  }, [selectedOperation, t, updateOperation]);

  const updateReturnErrorDraft = (operationId, draftPatch = {}) => {
    const current = operations.find((item) => item.id === operationId);
    if (!current) return;
    const draft = parseReturnErrorDraft(current.value_text);
    const nextDraft = { ...draft, ...draftPatch };
    updateOperation(operationId, {
      value_text: buildReturnErrorValueText(nextDraft),
    });
  };

  const updatePruneObjectsDraft = (operationId, updater) => {
    const current = operations.find((item) => item.id === operationId);
    if (!current) return;
    const draft = parsePruneObjectsDraft(current.value_text);
    const nextDraft =
      typeof updater === 'function'
        ? updater(draft)
        : { ...draft, ...(updater || {}) };
    updateOperation(operationId, {
      value_text: buildPruneObjectsValueText(nextDraft),
    });
  };

  const addPruneRule = (operationId) => {
    updatePruneObjectsDraft(operationId, (draft) => ({
      ...draft,
      simpleMode: false,
      rules: [...(draft.rules || []), normalizePruneRule({})],
    }));
  };

  const updatePruneRule = (operationId, ruleId, patch) => {
    updatePruneObjectsDraft(operationId, (draft) => ({
      ...draft,
      rules: (draft.rules || []).map((rule) =>
        rule.id === ruleId ? { ...rule, ...patch } : rule,
      ),
    }));
  };

  const removePruneRule = (operationId, ruleId) => {
    updatePruneObjectsDraft(operationId, (draft) => ({
      ...draft,
      rules: (draft.rules || []).filter((rule) => rule.id !== ruleId),
    }));
  };

  const addOperation = () => {
    const created = createDefaultOperation();
    setOperations((prev) => [...prev, created]);
    setSelectedOperationId(created.id);
  };

  const duplicateOperation = (operationId) => {
    let insertedId = '';
    setOperations((prev) => {
      const index = prev.findIndex((item) => item.id === operationId);
      if (index < 0) return prev;
      const source = prev[index];
      const cloned = normalizeOperation({
        path: source.path,
        mode: source.mode,
        value: parseLooseValue(source.value_text),
        keep_origin: source.keep_origin,
        from: source.from,
        to: source.to,
        logic: source.logic,
        conditions: (source.conditions || []).map((condition) => ({
          path: condition.path,
          mode: condition.mode,
          value: parseLooseValue(condition.value_text),
          invert: condition.invert,
          pass_missing_key: condition.pass_missing_key,
        })),
      });
      insertedId = cloned.id;
      const next = [...prev];
      next.splice(index + 1, 0, cloned);
      return next;
    });
    if (insertedId) {
      setSelectedOperationId(insertedId);
    }
  };

  const removeOperation = (operationId) => {
    setOperations((prev) => {
      if (prev.length <= 1) return [createDefaultOperation()];
      return prev.filter((item) => item.id !== operationId);
    });
    setExpandedConditionMap((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, operationId)) {
        return prev;
      }
      const next = { ...prev };
      delete next[operationId];
      return next;
    });
  };

  const addCondition = (operationId) => {
    const createdCondition = createDefaultCondition();
    setOperations((prev) =>
      prev.map((operation) =>
        operation.id === operationId
          ? {
              ...operation,
              conditions: [...(operation.conditions || []), createdCondition],
            }
          : operation,
      ),
    );
    setExpandedConditionMap((prev) => ({
      ...prev,
      [operationId]: [...(prev[operationId] || []), createdCondition.id],
    }));
  };

  const updateCondition = (operationId, conditionId, patch) => {
    setOperations((prev) =>
      prev.map((operation) => {
        if (operation.id !== operationId) return operation;
        return {
          ...operation,
          conditions: (operation.conditions || []).map((condition) =>
            condition.id === conditionId
              ? { ...condition, ...patch }
              : condition,
          ),
        };
      }),
    );
  };

  const removeCondition = (operationId, conditionId) => {
    setOperations((prev) =>
      prev.map((operation) => {
        if (operation.id !== operationId) return operation;
        return {
          ...operation,
          conditions: (operation.conditions || []).filter(
            (condition) => condition.id !== conditionId,
          ),
        };
      }),
    );
    setExpandedConditionMap((prev) => ({
      ...prev,
      [operationId]: (prev[operationId] || []).filter(
        (id) => id !== conditionId,
      ),
    }));
  };

  const selectedConditionKeys = useMemo(
    () => expandedConditionMap[selectedOperationId] || [],
    [expandedConditionMap, selectedOperationId],
  );

  const handleConditionCollapseChange = useCallback(
    (operationId, activeKeys) => {
      const keys = (
        Array.isArray(activeKeys) ? activeKeys : [activeKeys]
      ).filter(Boolean);
      setExpandedConditionMap((prev) => ({
        ...prev,
        [operationId]: keys,
      }));
    },
    [],
  );

  const expandAllSelectedConditions = useCallback(() => {
    if (!selectedOperationId || !selectedOperation) return;
    setExpandedConditionMap((prev) => ({
      ...prev,
      [selectedOperationId]: (selectedOperation.conditions || []).map(
        (condition) => condition.id,
      ),
    }));
  }, [selectedOperation, selectedOperationId]);

  const collapseAllSelectedConditions = useCallback(() => {
    if (!selectedOperationId) return;
    setExpandedConditionMap((prev) => ({
      ...prev,
      [selectedOperationId]: [],
    }));
  }, [selectedOperationId]);

  const handleJsonChange = (nextValue) => {
    setJsonText(nextValue);
    const trimmed = String(nextValue || '').trim();
    if (!trimmed) {
      setJsonError('');
      return;
    }
    if (!verifyJSON(trimmed)) {
      setJsonError(t('JSON格式错误'));
      return;
    }
    setJsonError('');
  };

  const formatJson = () => {
    const trimmed = jsonText.trim();
    if (!trimmed) return;
    if (!verifyJSON(trimmed)) {
      showError(t('参数覆盖必须是合法的 JSON 格式！'));
      return;
    }
    setJsonText(JSON.stringify(JSON.parse(trimmed), null, 2));
    setJsonError('');
  };

  const visualValidationError = useMemo(() => {
    if (editMode !== 'visual') {
      return '';
    }
    try {
      buildVisualJson();
      return '';
    } catch (error) {
      return error?.message || t('参数配置有误');
    }
  }, [buildVisualJson, editMode, t]);

  const handleSave = () => {
    try {
      let result = '';
      if (editMode === 'json') {
        const trimmed = jsonText.trim();
        if (!trimmed) {
          result = '';
        } else {
          if (!verifyJSON(trimmed)) {
            throw new Error(t('参数覆盖必须是合法的 JSON 格式！'));
          }
          result = JSON.stringify(JSON.parse(trimmed), null, 2);
        }
      } else {
        result = buildVisualJson();
      }
      onSave?.(result);
    } catch (error) {
      showError(error.message);
    }
  };

  return (
    <>
      <Modal
      title={t('参数覆盖')}
      visible={visible}
      width={1120}
      bodyStyle={{ maxHeight: '76vh', overflowY: 'auto', paddingTop: 10 }}
      onCancel={onCancel}
      onOk={handleSave}
      okText={t('保存')}
      cancelText={t('取消')}
    >
      <Space vertical align='start' spacing={14} style={{ width: '100%' }}>
        <Card
          className='!rounded-xl !border-0 w-full'
          bodyStyle={{
            padding: 12,
            background: 'var(--semi-color-fill-0)',
          }}
        >
          <div className='flex items-start justify-between gap-3'>
            <Space wrap spacing={8}>
              <Tag color='grey'>{t('编辑方式')}</Tag>
              <Button
                type={editMode === 'visual' ? 'primary' : 'tertiary'}
                onClick={switchToVisualMode}
              >
                {t('可视化')}
              </Button>
              <Button
                type={editMode === 'json' ? 'primary' : 'tertiary'}
                onClick={switchToJsonMode}
              >
                {t('JSON 文本')}
              </Button>
              <Tag color='grey'>{t('模板')}</Tag>
              <Select
                value={templateGroupKey}
                optionList={TEMPLATE_GROUP_OPTIONS}
                onChange={(nextValue) =>
                  setTemplateGroupKey(nextValue || 'basic')
                }
                style={{ width: 120 }}
              />
              <Select
                value={templatePresetKey}
                optionList={templatePresetOptions}
                onChange={(nextValue) =>
                  setTemplatePresetKey(nextValue || 'operations_default')
                }
                style={{ width: 260 }}
              />
              <Button onClick={fillTemplateFromLibrary}>{t('填充模板')}</Button>
              <Button type='tertiary' onClick={appendTemplateFromLibrary}>
                {t('追加模板')}
              </Button>
              <Button type='tertiary' onClick={resetEditorState}>
                {t('重置')}
              </Button>
            </Space>
            <Text
              type='tertiary'
              size='small'
              className='cursor-pointer select-none mt-1 whitespace-nowrap'
              onClick={() => openFieldGuide('path')}
            >
              {t('字段速查')}
            </Text>
          </div>
        </Card>

        {editMode === 'visual' ? (
          <div style={{ width: '100%' }}>
            {visualMode === 'legacy' ? (
              <Card
                className='!rounded-2xl !border-0'
                bodyStyle={{
                  padding: 14,
                  background: 'var(--semi-color-fill-0)',
                }}
              >
                <Text className='mb-2 block'>{t('旧格式（JSON 对象）')}</Text>
                <TextArea
                  value={legacyValue}
                  autosize={{ minRows: 10, maxRows: 20 }}
                  placeholder={JSON.stringify(LEGACY_TEMPLATE, null, 2)}
                  onChange={(nextValue) => setLegacyValue(nextValue)}
                  showClear
                />
                <Text type='tertiary' size='small' className='mt-2 block'>
                  {t('这里直接编辑 JSON 对象。适合简单覆盖参数的场景。')}
                </Text>
              </Card>
            ) : (
              <div>
                <div className='flex items-center justify-between mb-3'>
                  <Space>
                    <Text>{t('新格式（规则 + 条件）')}</Text>
                    <Tag color='cyan'>{`${t('规则')}: ${operationCount}`}</Tag>
                  </Space>
                  <Button icon={<IconPlus />} onClick={addOperation}>
                    {t('新增规则')}
                  </Button>
                </div>

                <Row gutter={12}>
                  <Col xs={24} md={8}>
                    <Card
                      className='!rounded-2xl !border-0 h-full'
                      bodyStyle={{
                        padding: 12,
                        background: 'var(--semi-color-fill-0)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        minHeight: 520,
                      }}
                    >
                      <div className='flex items-center justify-between'>
                        <Text strong>{t('规则导航')}</Text>
                        <Tag color='grey'>{`${operationCount}/${operations.length}`}</Tag>
                      </div>

                      {topOperationModes.length > 0 ? (
                        <Space wrap spacing={6}>
                          {topOperationModes.map(([mode, count]) => (
                            <Tag
                              key={`mode_stat_${mode}`}
                              size='small'
                              color={getOperationModeTagColor(mode)}
                            >
                              {`${OPERATION_MODE_LABEL_MAP[mode] || mode} · ${count}`}
                            </Tag>
                          ))}
                        </Space>
                      ) : null}

                      <Input
                        value={operationSearch}
                        placeholder={t('搜索规则（类型 / 路径 / 来源 / 目标）')}
                        onChange={(nextValue) =>
                          setOperationSearch(nextValue || '')
                        }
                        showClear
                      />

                      <div
                        className='overflow-auto'
                        style={{ flex: 1, minHeight: 320, paddingRight: 2 }}
                      >
                        {filteredOperations.length === 0 ? (
                          <Text type='tertiary' size='small'>
                            {t('没有匹配的规则')}
                          </Text>
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 8,
                              width: '100%',
                            }}
                          >
                            {filteredOperations.map((operation) => {
                              const index = operations.findIndex(
                                (item) => item.id === operation.id,
                              );
                              const isActive =
                                operation.id === selectedOperationId;
                              return (
                                <div
                                  key={operation.id}
                                  role='button'
                                  tabIndex={0}
                                  onClick={() =>
                                    setSelectedOperationId(operation.id)
                                  }
                                  onKeyDown={(event) => {
                                    if (
                                      event.key === 'Enter' ||
                                      event.key === ' '
                                    ) {
                                      event.preventDefault();
                                      setSelectedOperationId(operation.id);
                                    }
                                  }}
                                  className='w-full rounded-xl px-3 py-3 cursor-pointer transition-colors'
                                  style={{
                                    background: isActive
                                      ? 'var(--semi-color-primary-light-default)'
                                      : 'var(--semi-color-bg-2)',
                                    border: isActive
                                      ? '1px solid var(--semi-color-primary)'
                                      : '1px solid var(--semi-color-border)',
                                  }}
                                >
                                  <div className='flex items-start justify-between gap-2'>
                                    <div>
                                      <Text strong>{`#${index + 1}`}</Text>
                                      <Text
                                        type='tertiary'
                                        size='small'
                                        className='block mt-1'
                                      >
                                        {getOperationSummary(operation, index)}
                                      </Text>
                                    </div>
                                    <Tag size='small' color='grey'>
                                      {(operation.conditions || []).length}
                                    </Tag>
                                  </div>
                                  <Space spacing={6} style={{ marginTop: 8 }}>
                                    <Tag
                                      size='small'
                                      color={getOperationModeTagColor(
                                        operation.mode || 'set',
                                      )}
                                    >
                                      {OPERATION_MODE_LABEL_MAP[
                                        operation.mode || 'set'
                                      ] ||
                                        operation.mode ||
                                        'set'}
                                    </Tag>
                                    <Text type='tertiary' size='small'>
                                      {t('条件数')}
                                    </Text>
                                  </Space>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </Card>
                  </Col>
                  <Col xs={24} md={16}>
                    {selectedOperation ? (
                      (() => {
                        const mode = selectedOperation.mode || 'set';
                        const meta = MODE_META[mode] || MODE_META.set;
                        const conditions = selectedOperation.conditions || [];
                        const syncFromTarget =
                          mode === 'sync_fields'
                            ? parseSyncTargetSpec(selectedOperation.from)
                            : null;
                        const syncToTarget =
                          mode === 'sync_fields'
                            ? parseSyncTargetSpec(selectedOperation.to)
                            : null;
                        return (
                          <Card
                            className='!rounded-2xl !border-0'
                            bodyStyle={{
                              padding: 14,
                              background: 'var(--semi-color-fill-0)',
                            }}
                          >
                            <div className='flex items-center justify-between mb-3'>
                              <Space>
                                <Tag color='blue'>{`#${selectedOperationIndex + 1}`}</Tag>
                                <Text strong>
                                  {getOperationSummary(
                                    selectedOperation,
                                    selectedOperationIndex,
                                  )}
                                </Text>
                              </Space>
                              <Space>
                                <Button
                                  size='small'
                                  type='tertiary'
                                  onClick={() =>
                                    duplicateOperation(selectedOperation.id)
                                  }
                                >
                                  {t('复制')}
                                </Button>
                                <Button
                                  size='small'
                                  type='danger'
                                  theme='borderless'
                                  icon={<IconDelete />}
                                  onClick={() =>
                                    removeOperation(selectedOperation.id)
                                  }
                                />
                              </Space>
                            </div>

                            <Row gutter={12}>
                              <Col xs={24} md={8}>
                                <Text type='tertiary' size='small'>
                                  {t('操作类型')}
                                </Text>
                                <Select
                                  value={mode}
                                  optionList={OPERATION_MODE_OPTIONS}
                                  onChange={(nextMode) =>
                                    updateOperation(selectedOperation.id, {
                                      mode: nextMode,
                                    })
                                  }
                                  style={{ width: '100%' }}
                                />
                              </Col>
                              {meta.path || meta.pathOptional ? (
                                <Col xs={24} md={16}>
                                  <Text type='tertiary' size='small'>
                                    {meta.pathOptional
                                      ? t('目标路径（可选）')
                                      : t(getModePathLabel(mode))}
                                  </Text>
                                  <Input
                                    value={selectedOperation.path}
                                    placeholder={getModePathPlaceholder(mode)}
                                    onChange={(nextValue) =>
                                      updateOperation(selectedOperation.id, {
                                        path: nextValue,
                                      })
                                    }
                                  />
                                </Col>
                              ) : null}
                            </Row>

                            <Text
                              type='tertiary'
                              size='small'
                              className='mt-1 block'
                            >
                              {MODE_DESCRIPTIONS[mode] || ''}
                            </Text>

                            {meta.value ? (
                              mode === 'return_error' && returnErrorDraft ? (
                                <div
                                  className='mt-2 rounded-xl p-3'
                                  style={{
                                    background: 'var(--semi-color-bg-1)',
                                    border: '1px solid var(--semi-color-border)',
                                  }}
                                >
                                  <div className='flex items-center justify-between mb-2'>
                                    <Text strong>{t('自定义错误响应')}</Text>
                                    <Space spacing={6} align='center'>
                                      <Text type='tertiary' size='small'>
                                        {t('模式')}
                                      </Text>
                                      <Button
                                        size='small'
                                        type={
                                          returnErrorDraft.simpleMode
                                            ? 'primary'
                                            : 'tertiary'
                                        }
                                        onClick={() =>
                                          updateReturnErrorDraft(
                                            selectedOperation.id,
                                            { simpleMode: true },
                                          )
                                        }
                                      >
                                        {t('简洁')}
                                      </Button>
                                      <Button
                                        size='small'
                                        type={
                                          returnErrorDraft.simpleMode
                                            ? 'tertiary'
                                            : 'primary'
                                        }
                                        onClick={() =>
                                          updateReturnErrorDraft(
                                            selectedOperation.id,
                                            { simpleMode: false },
                                          )
                                        }
                                      >
                                        {t('高级')}
                                      </Button>
                                    </Space>
                                  </div>

                                  <Text type='tertiary' size='small'>
                                    {t('错误消息（必填）')}
                                  </Text>
                                  <TextArea
                                    value={returnErrorDraft.message}
                                    autosize={{ minRows: 2, maxRows: 4 }}
                                    placeholder={t('例如：该请求不满足准入策略')}
                                    onChange={(nextValue) =>
                                      updateReturnErrorDraft(
                                        selectedOperation.id,
                                        { message: nextValue },
                                      )
                                    }
                                  />

                                  {returnErrorDraft.simpleMode ? (
                                    <Text
                                      type='tertiary'
                                      size='small'
                                      className='mt-2 block'
                                    >
                                      {t(
                                        '简洁模式仅返回 message；状态码和错误类型将使用系统默认值。',
                                      )}
                                    </Text>
                                  ) : (
                                    <>
                                      <Row gutter={12} style={{ marginTop: 10 }}>
                                        <Col xs={24} md={8}>
                                          <Text type='tertiary' size='small'>
                                            {t('状态码')}
                                          </Text>
                                          <Input
                                            value={String(
                                              returnErrorDraft.statusCode ?? '',
                                            )}
                                            placeholder='400'
                                            onChange={(nextValue) =>
                                              updateReturnErrorDraft(
                                                selectedOperation.id,
                                                {
                                                  statusCode:
                                                    parseInt(nextValue, 10) ||
                                                    400,
                                                },
                                              )
                                            }
                                          />
                                        </Col>
                                        <Col xs={24} md={8}>
                                          <Text type='tertiary' size='small'>
                                            {t('错误代码（可选）')}
                                          </Text>
                                          <Input
                                            value={returnErrorDraft.code}
                                            placeholder='forced_bad_request'
                                            onChange={(nextValue) =>
                                              updateReturnErrorDraft(
                                                selectedOperation.id,
                                                { code: nextValue },
                                              )
                                            }
                                          />
                                        </Col>
                                        <Col xs={24} md={8}>
                                          <Text type='tertiary' size='small'>
                                            {t('错误类型（可选）')}
                                          </Text>
                                          <Input
                                            value={returnErrorDraft.type}
                                            placeholder='invalid_request_error'
                                            onChange={(nextValue) =>
                                              updateReturnErrorDraft(
                                                selectedOperation.id,
                                                { type: nextValue },
                                              )
                                            }
                                          />
                                        </Col>
                                      </Row>
                                      <div className='mt-2 flex items-center gap-2'>
                                        <Text type='tertiary' size='small'>
                                          {t('重试建议')}
                                        </Text>
                                        <Button
                                          size='small'
                                          type={
                                            returnErrorDraft.skipRetry
                                              ? 'primary'
                                              : 'tertiary'
                                          }
                                          onClick={() =>
                                            updateReturnErrorDraft(
                                              selectedOperation.id,
                                              { skipRetry: true },
                                            )
                                          }
                                        >
                                          {t('停止重试')}
                                        </Button>
                                        <Button
                                          size='small'
                                          type={
                                            returnErrorDraft.skipRetry
                                              ? 'tertiary'
                                              : 'primary'
                                          }
                                          onClick={() =>
                                            updateReturnErrorDraft(
                                              selectedOperation.id,
                                              { skipRetry: false },
                                            )
                                          }
                                        >
                                          {t('允许重试')}
                                        </Button>
                                      </div>
                                      <Space wrap style={{ marginTop: 8 }}>
                                        <Tag
                                          size='small'
                                          color='grey'
                                          className='cursor-pointer'
                                          onClick={() =>
                                            updateReturnErrorDraft(
                                              selectedOperation.id,
                                              {
                                                statusCode: 400,
                                                code: 'invalid_request',
                                                type: 'invalid_request_error',
                                              },
                                            )
                                          }
                                        >
                                          {t('参数错误')}
                                        </Tag>
                                        <Tag
                                          size='small'
                                          color='grey'
                                          className='cursor-pointer'
                                          onClick={() =>
                                            updateReturnErrorDraft(
                                              selectedOperation.id,
                                              {
                                                statusCode: 401,
                                                code: 'unauthorized',
                                                type: 'authentication_error',
                                              },
                                            )
                                          }
                                        >
                                          {t('未授权')}
                                        </Tag>
                                        <Tag
                                          size='small'
                                          color='grey'
                                          className='cursor-pointer'
                                          onClick={() =>
                                            updateReturnErrorDraft(
                                              selectedOperation.id,
                                              {
                                                statusCode: 429,
                                                code: 'rate_limited',
                                                type: 'rate_limit_error',
                                              },
                                            )
                                          }
                                        >
                                          {t('限流')}
                                        </Tag>
                                      </Space>
                                    </>
                                  )}
                                </div>
                              ) : mode === 'prune_objects' && pruneObjectsDraft ? (
                                <div
                                  className='mt-2 rounded-xl p-3'
                                  style={{
                                    background: 'var(--semi-color-bg-1)',
                                    border: '1px solid var(--semi-color-border)',
                                  }}
                                >
                                  <div className='flex items-center justify-between mb-2'>
                                    <Text strong>{t('对象清理规则')}</Text>
                                    <Space spacing={6} align='center'>
                                      <Text type='tertiary' size='small'>
                                        {t('模式')}
                                      </Text>
                                      <Button
                                        size='small'
                                        type={
                                          pruneObjectsDraft.simpleMode
                                            ? 'primary'
                                            : 'tertiary'
                                        }
                                        onClick={() =>
                                          updatePruneObjectsDraft(
                                            selectedOperation.id,
                                            { simpleMode: true },
                                          )
                                        }
                                      >
                                        {t('简洁')}
                                      </Button>
                                      <Button
                                        size='small'
                                        type={
                                          pruneObjectsDraft.simpleMode
                                            ? 'tertiary'
                                            : 'primary'
                                        }
                                        onClick={() =>
                                          updatePruneObjectsDraft(
                                            selectedOperation.id,
                                            { simpleMode: false },
                                          )
                                        }
                                      >
                                        {t('高级')}
                                      </Button>
                                    </Space>
                                  </div>

                                  <Text type='tertiary' size='small'>
                                    {t('类型（常用）')}
                                  </Text>
                                  <Input
                                    value={pruneObjectsDraft.typeText}
                                    placeholder='redacted_thinking'
                                    onChange={(nextValue) =>
                                      updatePruneObjectsDraft(
                                        selectedOperation.id,
                                        { typeText: nextValue },
                                      )
                                    }
                                  />

                                  {pruneObjectsDraft.simpleMode ? (
                                    <Text
                                      type='tertiary'
                                      size='small'
                                      className='mt-2 block'
                                    >
                                      {t(
                                        '简洁模式：按 type 全量清理对象，例如 redacted_thinking。',
                                      )}
                                    </Text>
                                  ) : (
                                    <>
                                      <Row gutter={12} style={{ marginTop: 10 }}>
                                        <Col xs={24} md={12}>
                                          <Text type='tertiary' size='small'>
                                            {t('逻辑')}
                                          </Text>
                                          <Select
                                            value={pruneObjectsDraft.logic}
                                            optionList={[
                                              { label: t('全部满足（AND）'), value: 'AND' },
                                              { label: t('任一满足（OR）'), value: 'OR' },
                                            ]}
                                            style={{ width: '100%' }}
                                            onChange={(nextValue) =>
                                              updatePruneObjectsDraft(
                                                selectedOperation.id,
                                                { logic: nextValue || 'AND' },
                                              )
                                            }
                                          />
                                        </Col>
                                        <Col xs={24} md={12}>
                                          <Text type='tertiary' size='small'>
                                            {t('递归策略')}
                                          </Text>
                                          <Space spacing={6} style={{ marginTop: 2 }}>
                                            <Button
                                              size='small'
                                              type={
                                                pruneObjectsDraft.recursive
                                                  ? 'primary'
                                                  : 'tertiary'
                                              }
                                              onClick={() =>
                                                updatePruneObjectsDraft(
                                                  selectedOperation.id,
                                                  { recursive: true },
                                                )
                                              }
                                            >
                                              {t('递归')}
                                            </Button>
                                            <Button
                                              size='small'
                                              type={
                                                pruneObjectsDraft.recursive
                                                  ? 'tertiary'
                                                  : 'primary'
                                              }
                                              onClick={() =>
                                                updatePruneObjectsDraft(
                                                  selectedOperation.id,
                                                  { recursive: false },
                                                )
                                              }
                                            >
                                              {t('仅当前层')}
                                            </Button>
                                          </Space>
                                        </Col>
                                      </Row>

                                      <div
                                        className='mt-2 rounded-lg p-2'
                                        style={{
                                          background: 'var(--semi-color-fill-0)',
                                        }}
                                      >
                                        <div className='flex items-center justify-between mb-2'>
                                          <Text strong>
                                            {t('附加条件')}
                                          </Text>
                                          <Button
                                            size='small'
                                            icon={<IconPlus />}
                                            onClick={() =>
                                              addPruneRule(selectedOperation.id)
                                            }
                                          >
                                            {t('新增条件')}
                                          </Button>
                                        </div>
                                        {(pruneObjectsDraft.rules || []).length === 0 ? (
                                          <Text type='tertiary' size='small'>
                                            {t(
                                              '未添加附加条件时，仅使用上方 type 进行清理。',
                                            )}
                                          </Text>
                                        ) : (
                                          <div className='flex flex-col gap-2'>
                                            {(pruneObjectsDraft.rules || []).map(
                                              (rule, ruleIndex) => (
                                                <div
                                                  key={rule.id}
                                                  className='rounded-lg p-2'
                                                  style={{
                                                    border:
                                                      '1px solid var(--semi-color-border)',
                                                    background:
                                                      'var(--semi-color-bg-0)',
                                                  }}
                                                >
                                                  <div className='flex items-center justify-between mb-2'>
                                                    <Tag size='small'>
                                                      {`R${ruleIndex + 1}`}
                                                    </Tag>
                                                    <Button
                                                      size='small'
                                                      type='danger'
                                                      theme='borderless'
                                                      icon={<IconDelete />}
                                                      onClick={() =>
                                                        removePruneRule(
                                                          selectedOperation.id,
                                                          rule.id,
                                                        )
                                                      }
                                                    >
                                                      {t('删除条件')}
                                                    </Button>
                                                  </div>
                                                  <Row gutter={8}>
                                                    <Col xs={24} md={9}>
                                                      <Text
                                                        type='tertiary'
                                                        size='small'
                                                      >
                                                        {t('字段路径')}
                                                      </Text>
                                                      <Input
                                                        value={rule.path}
                                                        placeholder='type'
                                                        onChange={(nextValue) =>
                                                          updatePruneRule(
                                                            selectedOperation.id,
                                                            rule.id,
                                                            { path: nextValue },
                                                          )
                                                        }
                                                      />
                                                    </Col>
                                                    <Col xs={24} md={7}>
                                                      <Text
                                                        type='tertiary'
                                                        size='small'
                                                      >
                                                        {t('匹配方式')}
                                                      </Text>
                                                      <Select
                                                        value={rule.mode}
                                                        optionList={
                                                          CONDITION_MODE_OPTIONS
                                                        }
                                                        style={{ width: '100%' }}
                                                        onChange={(nextValue) =>
                                                          updatePruneRule(
                                                            selectedOperation.id,
                                                            rule.id,
                                                            { mode: nextValue },
                                                          )
                                                        }
                                                      />
                                                    </Col>
                                                    <Col xs={24} md={8}>
                                                      <Text
                                                        type='tertiary'
                                                        size='small'
                                                      >
                                                        {t('匹配值（可选）')}
                                                      </Text>
                                                      <Input
                                                        value={rule.value_text}
                                                        placeholder='redacted_thinking'
                                                        onChange={(nextValue) =>
                                                          updatePruneRule(
                                                            selectedOperation.id,
                                                            rule.id,
                                                            {
                                                              value_text:
                                                                nextValue,
                                                            },
                                                          )
                                                        }
                                                      />
                                                    </Col>
                                                  </Row>
                                                  <Space
                                                    wrap
                                                    spacing={8}
                                                    style={{ marginTop: 8 }}
                                                  >
                                                    <Button
                                                      size='small'
                                                      type={
                                                        rule.invert
                                                          ? 'primary'
                                                          : 'tertiary'
                                                      }
                                                      onClick={() =>
                                                        updatePruneRule(
                                                          selectedOperation.id,
                                                          rule.id,
                                                          {
                                                            invert:
                                                              !rule.invert,
                                                          },
                                                        )
                                                      }
                                                    >
                                                      {t('条件取反')}
                                                    </Button>
                                                    <Button
                                                      size='small'
                                                      type={
                                                        rule.pass_missing_key
                                                          ? 'primary'
                                                          : 'tertiary'
                                                      }
                                                      onClick={() =>
                                                        updatePruneRule(
                                                          selectedOperation.id,
                                                          rule.id,
                                                          {
                                                            pass_missing_key:
                                                              !rule.pass_missing_key,
                                                          },
                                                        )
                                                      }
                                                    >
                                                      {t('字段缺失视为命中')}
                                                    </Button>
                                                  </Space>
                                                </div>
                                              ),
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div className='mt-2'>
                                  <div className='flex items-center justify-between gap-2'>
                                    <Text type='tertiary' size='small'>
                                      {t(getModeValueLabel(mode))}
                                    </Text>
                                    {mode === 'set_header' ? (
                                      <Button
                                        size='small'
                                        type='tertiary'
                                        onClick={formatSelectedOperationValueAsJson}
                                      >
                                        {t('格式化 JSON')}
                                      </Button>
                                    ) : null}
                                  </div>
                                  <TextArea
                                    value={selectedOperation.value_text}
                                    autosize={{ minRows: 1, maxRows: 4 }}
                                    placeholder={getModeValuePlaceholder(mode)}
                                    onChange={(nextValue) =>
                                      updateOperation(selectedOperation.id, {
                                        value_text: nextValue,
                                      })
                                    }
                                  />
                                  {getModeValueHelp(mode) ? (
                                    <Text type='tertiary' size='small'>
                                      {t(getModeValueHelp(mode))}
                                    </Text>
                                  ) : null}
                                </div>
                              )
                            ) : null}

                            {meta.keepOrigin ? (
                              <div className='mt-2 flex items-center gap-2'>
                                <Switch
                                  checked={Boolean(
                                    selectedOperation.keep_origin,
                                  )}
                                  checkedText={t('开')}
                                  uncheckedText={t('关')}
                                  onChange={(nextValue) =>
                                    updateOperation(selectedOperation.id, {
                                      keep_origin: nextValue,
                                    })
                                  }
                                />
                                <Text
                                  type='tertiary'
                                  size='small'
                                  className='leading-6'
                                >
                                  {t('保留原值（目标已有值时不覆盖）')}
                                </Text>
                              </div>
                            ) : null}

                            {mode === 'sync_fields' ? (
                              <div className='mt-2'>
                                <Text type='tertiary' size='small'>
                                  {t('同步端点')}
                                </Text>
                                <Row gutter={12} style={{ marginTop: 6 }}>
                                  <Col xs={24} md={12}>
                                    <Text type='tertiary' size='small'>
                                      {t('来源端点')}
                                    </Text>
                                    <div className='flex gap-2'>
                                      <Select
                                        value={syncFromTarget?.type || 'json'}
                                        optionList={SYNC_TARGET_TYPE_OPTIONS}
                                        style={{ width: 120 }}
                                        onChange={(nextType) =>
                                          updateOperation(
                                            selectedOperation.id,
                                            {
                                              from: buildSyncTargetSpec(
                                                nextType,
                                                syncFromTarget?.key || '',
                                              ),
                                            },
                                          )
                                        }
                                      />
                                      <Input
                                        value={syncFromTarget?.key || ''}
                                        placeholder='session_id'
                                        onChange={(nextKey) =>
                                          updateOperation(
                                            selectedOperation.id,
                                            {
                                              from: buildSyncTargetSpec(
                                                syncFromTarget?.type || 'json',
                                                nextKey,
                                              ),
                                            },
                                          )
                                        }
                                      />
                                    </div>
                                  </Col>
                                  <Col xs={24} md={12}>
                                    <Text type='tertiary' size='small'>
                                      {t('目标端点')}
                                    </Text>
                                    <div className='flex gap-2'>
                                      <Select
                                        value={syncToTarget?.type || 'json'}
                                        optionList={SYNC_TARGET_TYPE_OPTIONS}
                                        style={{ width: 120 }}
                                        onChange={(nextType) =>
                                          updateOperation(
                                            selectedOperation.id,
                                            {
                                              to: buildSyncTargetSpec(
                                                nextType,
                                                syncToTarget?.key || '',
                                              ),
                                            },
                                          )
                                        }
                                      />
                                      <Input
                                        value={syncToTarget?.key || ''}
                                        placeholder='prompt_cache_key'
                                        onChange={(nextKey) =>
                                          updateOperation(
                                            selectedOperation.id,
                                            {
                                              to: buildSyncTargetSpec(
                                                syncToTarget?.type || 'json',
                                                nextKey,
                                              ),
                                            },
                                          )
                                        }
                                      />
                                    </div>
                                  </Col>
                                </Row>
                                <Space wrap style={{ marginTop: 8 }}>
                                  <Tag
                                    size='small'
                                    color='cyan'
                                    className='cursor-pointer'
                                    onClick={() =>
                                      updateOperation(selectedOperation.id, {
                                        from: 'header:session_id',
                                        to: 'json:prompt_cache_key',
                                      })
                                    }
                                  >
                                    {
                                      'header:session_id -> json:prompt_cache_key'
                                    }
                                  </Tag>
                                  <Tag
                                    size='small'
                                    color='cyan'
                                    className='cursor-pointer'
                                    onClick={() =>
                                      updateOperation(selectedOperation.id, {
                                        from: 'json:prompt_cache_key',
                                        to: 'header:session_id',
                                      })
                                    }
                                  >
                                    {
                                      'json:prompt_cache_key -> header:session_id'
                                    }
                                  </Tag>
                                </Space>
                              </div>
                            ) : meta.from || meta.to === false || meta.to ? (
                              <Row gutter={12} style={{ marginTop: 8 }}>
                                {meta.from || meta.to === false ? (
                                  <Col xs={24} md={12}>
                                    <Text type='tertiary' size='small'>
                                      {t(getModeFromLabel(mode))}
                                    </Text>
                                    <Input
                                      value={selectedOperation.from}
                                      placeholder={getModeFromPlaceholder(mode)}
                                      onChange={(nextValue) =>
                                        updateOperation(selectedOperation.id, {
                                          from: nextValue,
                                        })
                                      }
                                    />
                                  </Col>
                                ) : null}
                                {meta.to || meta.to === false ? (
                                  <Col xs={24} md={12}>
                                    <Text type='tertiary' size='small'>
                                      {t(getModeToLabel(mode))}
                                    </Text>
                                    <Input
                                      value={selectedOperation.to}
                                      placeholder={getModeToPlaceholder(mode)}
                                      onChange={(nextValue) =>
                                        updateOperation(selectedOperation.id, {
                                          to: nextValue,
                                        })
                                      }
                                    />
                                  </Col>
                                ) : null}
                              </Row>
                            ) : null}

                            <div
                              className='mt-3 rounded-xl p-3'
                              style={{
                                background: 'rgba(127, 127, 127, 0.08)',
                              }}
                            >
                              <div className='flex items-center justify-between mb-2'>
                                <Space align='center'>
                                  <Text>{t('条件规则')}</Text>
                                  <Select
                                    value={selectedOperation.logic || 'OR'}
                                    optionList={[
                                      { label: t('满足任一条件（OR）'), value: 'OR' },
                                      { label: t('必须全部满足（AND）'), value: 'AND' },
                                    ]}
                                    size='small'
                                    style={{ width: 180 }}
                                    onChange={(nextValue) =>
                                      updateOperation(selectedOperation.id, {
                                        logic: nextValue,
                                      })
                                    }
                                  />
                                </Space>
                                <Space spacing={6}>
                                  <Button
                                    size='small'
                                    type='tertiary'
                                    onClick={expandAllSelectedConditions}
                                  >
                                    {t('全部展开')}
                                  </Button>
                                  <Button
                                    size='small'
                                    type='tertiary'
                                    onClick={collapseAllSelectedConditions}
                                  >
                                    {t('全部收起')}
                                  </Button>
                                  <Button
                                    icon={<IconPlus />}
                                    size='small'
                                    onClick={() =>
                                      addCondition(selectedOperation.id)
                                    }
                                  >
                                    {t('新增条件')}
                                  </Button>
                                </Space>
                              </div>

                              {conditions.length === 0 ? (
                                <Text type='tertiary' size='small'>
                                  {t('没有条件时，默认总是执行该操作。')}
                                </Text>
                              ) : (
                                <Collapse
                                  keepDOM
                                  activeKey={selectedConditionKeys}
                                  onChange={(activeKeys) =>
                                    handleConditionCollapseChange(
                                      selectedOperation.id,
                                      activeKeys,
                                    )
                                  }
                                >
                                  {conditions.map(
                                    (condition, conditionIndex) => (
                                      <Collapse.Panel
                                        key={condition.id}
                                        itemKey={condition.id}
                                        header={
                                          <Space spacing={8}>
                                            <Tag size='small'>
                                              {`C${conditionIndex + 1}`}
                                            </Tag>
                                            <Text type='tertiary' size='small'>
                                              {condition.path ||
                                                t('未设置路径')}
                                            </Text>
                                          </Space>
                                        }
                                      >
                                        <div>
                                          <div className='flex items-center justify-between mb-2'>
                                            <Text type='tertiary' size='small'>
                                              {t('条件项设置')}
                                            </Text>
                                            <Button
                                              theme='borderless'
                                              type='danger'
                                              icon={<IconDelete />}
                                              size='small'
                                              onClick={() =>
                                                removeCondition(
                                                  selectedOperation.id,
                                                  condition.id,
                                                )
                                              }
                                            >
                                              {t('删除条件')}
                                            </Button>
                                          </div>
                                          <Row gutter={12}>
                                            <Col xs={24} md={10}>
                                              <Text
                                                type='tertiary'
                                                size='small'
                                              >
                                                {t('字段路径')}
                                              </Text>
                                              <Input
                                                value={condition.path}
                                                placeholder='model'
                                                onChange={(nextValue) =>
                                                  updateCondition(
                                                    selectedOperation.id,
                                                    condition.id,
                                                    { path: nextValue },
                                                  )
                                                }
                                              />
                                            </Col>
                                            <Col xs={24} md={8}>
                                              <Text
                                                type='tertiary'
                                                size='small'
                                              >
                                                {t('匹配方式')}
                                              </Text>
                                              <Select
                                                value={condition.mode}
                                                optionList={
                                                  CONDITION_MODE_OPTIONS
                                                }
                                                onChange={(nextValue) =>
                                                  updateCondition(
                                                    selectedOperation.id,
                                                    condition.id,
                                                    { mode: nextValue },
                                                  )
                                                }
                                                style={{ width: '100%' }}
                                              />
                                            </Col>
                                            <Col xs={24} md={6}>
                                              <Text
                                                type='tertiary'
                                                size='small'
                                              >
                                                {t('匹配值')}
                                              </Text>
                                              <Input
                                                value={condition.value_text}
                                                placeholder='gpt'
                                                onChange={(nextValue) =>
                                                  updateCondition(
                                                    selectedOperation.id,
                                                    condition.id,
                                                    { value_text: nextValue },
                                                  )
                                                }
                                              />
                                            </Col>
                                          </Row>
                                          <div className='mt-2 flex flex-wrap gap-3'>
                                            <div className='flex items-center gap-2'>
                                              <Text type='tertiary' size='small'>
                                                {t('条件取反')}
                                              </Text>
                                              <Switch
                                                checked={Boolean(
                                                  condition.invert,
                                                )}
                                                checkedText={t('开')}
                                                uncheckedText={t('关')}
                                                onChange={(nextValue) =>
                                                  updateCondition(
                                                    selectedOperation.id,
                                                    condition.id,
                                                    { invert: nextValue },
                                                  )
                                                }
                                              />
                                            </div>
                                            <div className='flex items-center gap-2'>
                                              <Text type='tertiary' size='small'>
                                                {t('字段缺失视为命中')}
                                              </Text>
                                              <Switch
                                                checked={Boolean(
                                                  condition.pass_missing_key,
                                                )}
                                                checkedText={t('开')}
                                                uncheckedText={t('关')}
                                                onChange={(nextValue) =>
                                                  updateCondition(
                                                    selectedOperation.id,
                                                    condition.id,
                                                    {
                                                      pass_missing_key: nextValue,
                                                    },
                                                  )
                                                }
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      </Collapse.Panel>
                                    ),
                                  )}
                                </Collapse>
                              )}
                            </div>
                          </Card>
                        );
                      })()
                    ) : (
                      <Card
                        className='!rounded-2xl !border-0'
                        bodyStyle={{
                          padding: 14,
                          background: 'var(--semi-color-fill-0)',
                        }}
                      >
                        <Text type='tertiary'>
                          {t('请选择一条规则进行编辑。')}
                        </Text>
                      </Card>
                    )}

                    {visualValidationError ? (
                      <Card
                        className='!rounded-2xl !border-0 mt-3'
                        bodyStyle={{
                          padding: 12,
                          background: 'var(--semi-color-fill-0)',
                        }}
                      >
                        <Space>
                          <Tag color='red'>{t('暂存错误')}</Tag>
                          <Text type='danger'>{visualValidationError}</Text>
                        </Space>
                      </Card>
                    ) : null}
                  </Col>
                </Row>
              </div>
            )}
          </div>
        ) : (
          <div style={{ width: '100%' }}>
            <Space style={{ marginBottom: 8 }} wrap>
              <Button onClick={formatJson}>{t('格式化')}</Button>
              <Tag color='grey'>{t('高级文本编辑')}</Tag>
            </Space>
            <TextArea
              value={jsonText}
              autosize={{ minRows: 18, maxRows: 28 }}
              onChange={(nextValue) => handleJsonChange(nextValue ?? '')}
              placeholder={JSON.stringify(OPERATION_TEMPLATE, null, 2)}
              showClear
            />
            <Text type='tertiary' size='small' className='mt-2 block'>
              {t('直接编辑 JSON 文本，保存时会校验格式。')}
            </Text>
            {jsonError ? (
              <Text className='text-red-500 text-xs mt-2'>{jsonError}</Text>
            ) : null}
          </div>
        )}
      </Space>
      </Modal>

      <Modal
        title={null}
        visible={fieldGuideVisible}
        width={860}
        footer={null}
        onCancel={() => setFieldGuideVisible(false)}
        bodyStyle={{
          maxHeight: '72vh',
          overflowY: 'auto',
          padding: 16,
          background: 'var(--semi-color-bg-0)',
        }}
      >
        <Space vertical spacing={12} style={{ width: '100%' }}>
          <div className='flex items-start justify-between gap-3'>
            <div>
              <Text strong style={{ fontSize: 22, lineHeight: '30px' }}>
                {t('字段速查')}
              </Text>
              <Text
                type='tertiary'
                size='small'
                className='block mt-1'
                style={{ maxWidth: 560 }}
              >
                {t(
                  '先搜索，再一键复制字段名或填入当前规则。字段名为系统内部路径，可直接用于路径 / 来源 / 目标。',
                )}
              </Text>
            </div>
            <Tag color='blue'>{`${fieldGuideFieldCount} ${t('个字段')}`}</Tag>
          </div>

          <Card
            className='!rounded-xl !border-0'
            bodyStyle={{
              padding: 12,
              background: 'var(--semi-color-fill-0)',
            }}
          >
            <div className='flex items-center gap-2'>
              <Input
                value={fieldGuideKeyword}
                onChange={(nextValue) => setFieldGuideKeyword(nextValue || '')}
                placeholder={t('搜索字段名 / 中文说明')}
                showClear
                style={{ flex: 1 }}
              />
              <Select
                value={fieldGuideTarget}
                optionList={FIELD_GUIDE_TARGET_OPTIONS}
                onChange={(nextValue) =>
                  setFieldGuideTarget(nextValue || 'path')
                }
                style={{ width: 170 }}
              />
            </div>
          </Card>

          {filteredFieldGuideSections.length === 0 ? (
            <Card
              className='!rounded-xl !border-0'
              bodyStyle={{
                padding: 20,
                background: 'var(--semi-color-fill-0)',
              }}
            >
              <Text type='tertiary'>{t('没有匹配的字段')}</Text>
            </Card>
          ) : (
            <div className='flex flex-col gap-2'>
              {filteredFieldGuideSections.map((section) => (
                <Card
                  key={section.title}
                  className='!rounded-xl !border-0'
                  bodyStyle={{
                    padding: 14,
                    background: 'var(--semi-color-fill-0)',
                  }}
                >
                  <div className='flex items-center justify-between mb-1'>
                    <Text strong style={{ fontSize: 18 }}>
                      {section.title}
                    </Text>
                    <Tag color='grey'>{`${section.fields.length} ${t('项')}`}</Tag>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      marginTop: 6,
                    }}
                  >
                    {section.fields.map((field, index) => (
                      <div
                        key={field.key}
                        className='flex items-start justify-between gap-3'
                        style={{
                          paddingTop: 10,
                          paddingBottom: 10,
                          borderTop:
                            index === 0
                              ? 'none'
                              : '1px solid var(--semi-color-border)',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text strong>{field.label}</Text>
                          <Text
                            type='secondary'
                            size='small'
                            className='block mt-1 font-mono'
                            style={{
                              background: 'var(--semi-color-bg-1)',
                              border: '1px solid var(--semi-color-border)',
                              borderRadius: 8,
                              padding: '4px 8px',
                              width: 'fit-content',
                            }}
                          >
                            {field.key}
                          </Text>
                          <Text
                            type='tertiary'
                            size='small'
                            className='block mt-1'
                            style={{ lineHeight: '18px' }}
                          >
                            {field.tip}
                          </Text>
                        </div>
                        <Space spacing={6} align='center'>
                          <Button
                            size='small'
                            type='tertiary'
                            onClick={() => copyBuiltinField(field.key)}
                          >
                            {t('复制')}
                          </Button>
                          <Button
                            size='small'
                            onClick={() =>
                              applyBuiltinField(field.key, fieldGuideTarget)
                            }
                          >
                            {fieldGuideActionLabel}
                          </Button>
                        </Space>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Space>
      </Modal>
    </>
  );
};

export default ParamOverrideEditorModal;

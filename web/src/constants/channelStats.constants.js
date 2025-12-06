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

// ========== 时间粒度选项 ==========
export const TIME_GRANULARITY_OPTIONS = [
  { key: 'hour', label: '小时', value: 'hour' },
  { key: 'day', label: '天', value: 'day' },
  { key: 'week', label: '周', value: 'week' },
];

// ========== 时间范围预设 ==========
export const TIME_RANGE_PRESETS = {
  TODAY: 'today',
  LAST_7_DAYS: 'last_7_days',
  LAST_30_DAYS: 'last_30_days',
  CUSTOM: 'custom',
};

// ========== 指标类型 ==========
export const METRIC_TYPES = {
  RESPONSE_TIME: 'response_time',
  SUCCESS_RATE: 'success_rate',
  CALL_COUNT: 'call_count',
  QUOTA: 'quota',
  TOKENS: 'tokens',
};

// ========== 统计类型 ==========
export const STATS_TYPES = {
  PERFORMANCE: 'performance',
  USAGE: 'usage',
  HEALTH: 'health',
  REALTIME: 'realtime',
  ERRORS: 'errors',
};

// ========== 自动刷新间隔（毫秒） ==========
export const AUTO_REFRESH_INTERVALS = [
  { key: 'off', label: '关闭', value: 0 },
  { key: '30s', label: '30秒', value: 30000 },
  { key: '1m', label: '1分钟', value: 60000 },
  { key: '5m', label: '5分钟', value: 300000 },
];

// ========== 健康度评分等级 ==========
export const HEALTH_SCORE_LEVELS = {
  EXCELLENT: { min: 90, max: 100, label: '优秀', color: '#52c41a' },
  GOOD: { min: 75, max: 90, label: '良好', color: '#1890ff' },
  FAIR: { min: 60, max: 75, label: '一般', color: '#faad14' },
  POOR: { min: 0, max: 60, label: '较差', color: '#f5222d' },
};

// ========== 响应时间等级（秒） ==========
export const RESPONSE_TIME_LEVELS = {
  FAST: { max: 1, label: '快速', color: '#52c41a' },
  NORMAL: { min: 1, max: 3, label: '正常', color: '#1890ff' },
  SLOW: { min: 3, max: 10, label: '较慢', color: '#faad14' },
  VERY_SLOW: { min: 10, label: '很慢', color: '#f5222d' },
};

// ========== 图表颜色主题 ==========
export const CHART_COLORS = [
  '#1890ff', // 蓝色
  '#52c41a', // 绿色
  '#faad14', // 橙色
  '#f5222d', // 红色
  '#722ed1', // 紫色
  '#13c2c2', // 青色
  '#eb2f96', // 品红
  '#fa8c16', // 橙红
  '#a0d911', // 黄绿
  '#2f54eb', // 深蓝
];

// ========== 图表默认配置 ==========
export const CHART_CONFIG = { mode: 'desktop-browser' };

// ========== 卡片配置 ==========
export const CARD_PROPS = {
  bordered: false,
  bodyStyle: { padding: '20px' },
  headerStyle: {
    borderBottom: '1px solid var(--semi-color-border)',
  },
};

// ========== 表格配置 ==========
export const TABLE_CONFIG = {
  PAGE_SIZE: 10,
  SIZE_OPTIONS: [10, 20, 50, 100],
};

// ========== 导出格式 ==========
export const EXPORT_FORMATS = {
  CSV: 'csv',
  JSON: 'json',
};

// ========== 渠道状态映射 ==========
export const CHANNEL_STATUS_MAP = {
  1: { label: '已启用', color: 'green' },
  2: { label: '已禁用', color: 'grey' },
  3: { label: '自动禁用', color: 'red' },
};

// ========== 错误类型映射 ==========
export const ERROR_TYPE_MAP = {
  'rate_limit': '速率限制',
  'quota_exceeded': '额度超限',
  'invalid_api_key': '无效密钥',
  'model_not_found': '模型不存在',
  'timeout': '请求超时',
  'server_error': '服务器错误',
  'network_error': '网络错误',
  'unknown': '未知错误',
};

// ========== 图表Tab配置 ==========
export const CHART_TABS = {
  PERFORMANCE: 'performance',
  USAGE_TREND: 'usage_trend',
  CALL_DISTRIBUTION: 'call_distribution',
  ERROR_ANALYSIS: 'error_analysis',
  HEALTH_SCORE: 'health_score',
  COMPARISON: 'comparison',
};


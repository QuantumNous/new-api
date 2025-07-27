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

// ========== UI 配置常量 ==========
export const CHART_CONFIG = { mode: 'desktop-browser' };

export const CARD_PROPS = {
  shadows: 'always',
  bordered: false,
  headerLine: true
};

export const FORM_FIELD_PROPS = {
  className: "w-full mb-2 !rounded-lg",
  size: 'large'
};

export const ICON_BUTTON_CLASS = "text-white hover:bg-opacity-80 !rounded-full";
export const FLEX_CENTER_GAP2 = "flex items-center gap-2";

export const ILLUSTRATION_SIZE = { width: 96, height: 96 };

// ========== 时间相关常量 ==========
export const TIME_OPTIONS = [
  { label: '小时', value: 'hour' },
  { label: '天', value: 'day' },
  { label: '周', value: 'week' },
];

export const DEFAULT_TIME_INTERVALS = {
  hour: { seconds: 3600, minutes: 60 },
  day: { seconds: 86400, minutes: 1440 },
  week: { seconds: 604800, minutes: 10080 }
};

// ========== 默认时间设置 ==========
export const DEFAULT_TIME_RANGE = {
  HOUR: 'hour',
  DAY: 'day',
  WEEK: 'week'
};

// ========== 图表默认配置 ==========
export const DEFAULT_CHART_SPECS = {
  PIE: {
    type: 'pie',
    outerRadius: 0.8,
    innerRadius: 0.5,
    padAngle: 0.6,
    valueField: 'value',
    categoryField: 'type',
    pie: {
      style: {
        cornerRadius: 10,
      },
      state: {
        hover: {
          outerRadius: 0.85,
          stroke: '#000',
          lineWidth: 1,
        },
        selected: {
          outerRadius: 0.85,
          stroke: '#000',
          lineWidth: 1,
        },
      },
    },
    legends: {
      visible: true,
      orient: 'left',
    },
    label: {
      visible: true,
    },
  },

  BAR: {
    type: 'bar',
    stack: true,
    legends: {
      visible: true,
      selectMode: 'single',
    },
    bar: {
      state: {
        hover: {
          stroke: '#000',
          lineWidth: 1,
        },
      },
    },
  },

  LINE: {
    type: 'line',
    legends: {
      visible: true,
      selectMode: 'single',
    },
  }
};

// ========== 公告图例数据 ==========
export const ANNOUNCEMENT_LEGEND_DATA = [
  { color: 'grey', label: '默认', type: 'default' },
  { color: 'blue', label: '进行中', type: 'ongoing' },
  { color: 'green', label: '成功', type: 'success' },
  { color: 'orange', label: '警告', type: 'warning' },
  { color: 'red', label: '异常', type: 'error' }
];

// ========== Uptime 状态映射 ==========
export const UPTIME_STATUS_MAP = {
  1: { color: '#10b981', label: '正常', text: '可用率' },   // UP
  0: { color: '#ef4444', label: '异常', text: '有异常' },   // DOWN
  2: { color: '#f59e0b', label: '高延迟', text: '高延迟' }, // PENDING
  3: { color: '#3b82f6', label: '维护中', text: '维护中' }   // MAINTENANCE
};

// ========== 本地存储键名 ==========
export const STORAGE_KEYS = {
  DATA_EXPORT_DEFAULT_TIME: 'data_export_default_time',
  MJ_NOTIFY_ENABLED: 'mj_notify_enabled'
};

// ========== 默认值 ==========
export const DEFAULTS = {
  PAGE_SIZE: 20,
  CHART_HEIGHT: 96,
  MODEL_TABLE_PAGE_SIZE: 10,
  MAX_TREND_POINTS: 7
}; 
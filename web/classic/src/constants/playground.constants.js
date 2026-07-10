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

export const MESSAGE_STATUS = {
  LOADING: 'loading',
  INCOMPLETE: 'incomplete',
  COMPLETE: 'complete',
  ERROR: 'error',
};

export const MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
};

// 默认消息示例 - 使用函数生成以支持 i18n
export const getDefaultMessages = (t) => [
  {
    role: MESSAGE_ROLES.USER,
    id: '2',
    createAt: 1715676751919,
    content: t('默认用户消息'),
  },
  {
    role: MESSAGE_ROLES.ASSISTANT,
    id: '3',
    createAt: 1715676751919,
    content: t('默认助手消息'),
    reasoningContent: '',
    isReasoningExpanded: false,
  },
];

// 保留旧的导出以保持向后兼容
export const DEFAULT_MESSAGES = [
  {
    role: MESSAGE_ROLES.USER,
    id: '2',
    createAt: 1715676751919,
    content: 'Hello',
  },
  {
    role: MESSAGE_ROLES.ASSISTANT,
    id: '3',
    createAt: 1715676751919,
    content: 'Hello! How can I help you today?',
    reasoningContent: '',
    isReasoningExpanded: false,
  },
];

// ========== UI 相关常量 ==========
export const DEBUG_TABS = {
  PREVIEW: 'preview',
  REQUEST: 'request',
  RESPONSE: 'response',
};

// ========== API 相关常量 ==========
export const API_ENDPOINTS = {
  CHAT_COMPLETIONS: '/pg/chat/completions',
  IMAGE_GENERATIONS: '/pg/images/generations',
  IMAGE_EDITS: '/pg/images/edits',
  VIDEO_GENERATIONS: '/pg/video/generations',
  VIDEO_GENERATION_TASK: '/pg/video/generations',
  VIDEO_CONTENT: '/v1/videos',
  PLAYGROUND_CONVERSATIONS: '/api/playground/conversations',
  PRICING: '/api/pricing',
  USER_MODELS: '/api/user/models',
  USER_GROUPS: '/api/user/self/groups',
};

export const SEEDANCE_VIDEO_MODELS = [
  'doubao-seedance-1-0-pro-250528',
  'doubao-seedance-1-0-lite-t2v',
  'doubao-seedance-1-0-lite-i2v',
  'doubao-seedance-1-5-pro-251215',
  'doubao-seedance-2-0-260128',
  'doubao-seedance-2-0-fast-260128',
];

// ========== 配置默认值 ==========
export const DEFAULT_CONFIG = {
  inputs: {
    model: '',
    imageModel: '',
    videoModel: '',
    group: '',
    temperature: 0.7,
    top_p: 1,
    max_tokens: 4096,
    frequency_penalty: 0,
    presence_penalty: 0,
    seed: null,
    stream: true,
    imageEnabled: false,
    imageUrls: [''],
    imageCount: 1,
    imageSize: '1024x1024',
    imageQuality: 'auto',
    videoDuration: 5,
    videoRatio: '16:9',
    videoResolution: '720p',
    outputFormat: 'png',
  },
  parameterEnabled: {
    temperature: true,
    top_p: true,
    max_tokens: false,
    frequency_penalty: true,
    presence_penalty: true,
    seed: false,
  },
  systemPrompt: '',
  showDebugPanel: false,
  customRequestMode: false,
  customRequestBody: '',
  playgroundMode: 'chat',
};

// ========== 正则表达式 ==========
export const THINK_TAG_REGEX = /<think>([\s\S]*?)<\/think>/g;

// ========== 错误消息 ==========
export const ERROR_MESSAGES = {
  NO_TEXT_CONTENT: '此消息没有可复制的文本内容',
  INVALID_MESSAGE_TYPE: '无法复制此类型的消息内容',
  COPY_FAILED: '复制失败，请手动选择文本复制',
  COPY_HTTPS_REQUIRED: '复制功能需要 HTTPS 环境，请手动复制',
  BROWSER_NOT_SUPPORTED: '浏览器不支持复制功能，请手动复制',
  JSON_PARSE_ERROR: '自定义请求体格式错误，请检查JSON格式',
  API_REQUEST_ERROR: '请求发生错误',
  NETWORK_ERROR: '网络连接失败或服务器无响应',
};

export const PLAYGROUND_I18N_KEYS = {
  NEW_CONVERSATION: '新对话',
  PREVIEW_SAMPLE_MESSAGE: '示例消息',
  IMAGE_GENERATION_PENDING_TITLE: '图片仍在生成中',
  IMAGE_GENERATION_PENDING_MESSAGE:
    '图片仍在生成中，切换对话、新建对话、切换模式或离开页面都不会停止后端任务，仍可能继续消耗额度。请等待生成完成后再操作。',
  IMAGE_GENERATION_LEAVE_CONFIRM: '仍要离开',
  IMAGE_GENERATION_STAY: '留在当前页',
  IMAGE_GENERATION_STOP_NOTICE:
    '已尝试停止当前图片请求。若后端已将任务提交给上游，仍不能保证上游一定停止计费。',
  IMAGE_GENERATION_ABORTED:
    '图片请求已在前端停止。若上游任务已创建，仍可能继续执行。',
};

// ========== 存储键名 ==========
export const STORAGE_KEYS = {
  CONFIG: 'playground_config',
  MESSAGES: 'playground_messages',
  CONVERSATIONS: 'playground_conversations',
  ACTIVE_CONVERSATION: 'playground_active_conversation',
};

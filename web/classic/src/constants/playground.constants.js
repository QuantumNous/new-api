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
  HEADERS: 'headers',
  REQUEST: 'request',
  RESPONSE: 'response',
};

// ========== API 相关常量 ==========
export const API_ENDPOINTS = {
  CHAT_COMPLETIONS: '/pg/chat/completions',
  USER_MODELS: '/api/user/models',
  USER_GROUPS: '/api/user/self/groups',
  PRICING: '/api/pricing',
};

// ========== 非 chat 端点的 curl 模板 ==========
// 判定规则参见 helpers/playground.js#isPlaygroundSupported：
// 模型的 supported_endpoint_types 命中此 map 任一 key → 操练场拦截，弹框提示走 API；
// 全部不命中 / 列表为空 / 拉不到 pricing → 放行（fail-open）。
// 一个模型挂多个非 chat 端点时按 priority 选第一个展示 curl。
export const PLAYGROUND_UNSUPPORTED_ENDPOINTS = {
  'openai-video': {
    // model 名含 I2V 视为图生视频，curl 模板内多塞一个 metadata.first_frame_image 示例，
    // 让用户一眼就知道首帧图片是必填项。paratera 适配器走 metadata 反序列化映射到上游同名字段。
    label: '视频生成',
    path: '/v1/videos',
    priority: 1,
    buildBody: (model, prompt) => {
      const isI2V = /I2V/i.test(model || '');
      const body = {
        model,
        prompt: prompt || (isI2V ? '镜头缓慢推进' : '你的提示词'),
        duration: 6,
        size: '1280x720',
      };
      if (isI2V) {
        body.metadata = {
          first_frame_image: 'https://your-image-url.jpg',
        };
      }
      return body;
    },
  },
  'image-generation': {
    label: '图像生成',
    path: '/v1/images/generations',
    priority: 2,
    buildBody: (model, prompt) => ({
      model,
      prompt: prompt || '你的提示词',
      size: '1024x1024',
      n: 1,
    }),
  },
  embeddings: {
    label: '嵌入向量',
    path: '/v1/embeddings',
    priority: 3,
    buildBody: (model, prompt) => ({
      model,
      input: prompt || '你的文本',
    }),
  },
  'jina-rerank': {
    label: '重排序',
    path: '/v1/rerank',
    priority: 4,
    buildBody: (model, prompt) => ({
      model,
      query: prompt || '你的查询',
      documents: ['文档 1', '文档 2'],
    }),
  },
};

// ========== 配置默认值 ==========
export const DEFAULT_CONFIG = {
  inputs: {
    model: 'gpt-4o',
    group: '',
    temperature: 0.7,
    top_p: 1,
    max_tokens: 4096,
    frequency_penalty: 0,
    presence_penalty: 0,
    seed: null,
    stream: true,
    imageEnabled: false,
    imageUrls: [],
  },
  parameterEnabled: {
    temperature: false,
    top_p: false,
    max_tokens: false,
    frequency_penalty: false,
    presence_penalty: false,
    seed: false,
  },
  systemPrompt: '',
  showDebugPanel: false,
  customRequestMode: false,
  customRequestBody: '',
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

// ========== 存储键名 ==========
export const STORAGE_KEYS = {
  CONFIG: 'playground_config',
  MESSAGES: 'playground_messages',
};

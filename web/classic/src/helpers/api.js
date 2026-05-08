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

import {
  getUserIdFromLocalStorage,
  showError,
  formatMessageForAPI,
  isValidMessage,
  getLastUserMessage,
} from './utils';
import axios from 'axios';
import {
  MESSAGE_ROLES,
  PLAYGROUND_ENDPOINTS,
} from '../constants/playground.constants';

export let API = axios.create({
  baseURL: import.meta.env.VITE_REACT_APP_SERVER_URL
    ? import.meta.env.VITE_REACT_APP_SERVER_URL
    : '',
  headers: {
    'New-API-User': getUserIdFromLocalStorage(),
    'Cache-Control': 'no-store',
  },
});


function redirectToOAuthUrl(url, options = {}) {
  const { openInNewTab = false } = options;
  const targetUrl = typeof url === 'string' ? url : url.toString();

  if (openInNewTab) {
    window.open(targetUrl, '_blank');
    return;
  }

  window.location.assign(targetUrl);
}


function patchAPIInstance(instance) {
  const originalGet = instance.get.bind(instance);
  const inFlightGetRequests = new Map();

  const genKey = (url, config = {}) => {
    const params = config.params ? JSON.stringify(config.params) : '{}';
    return `${url}?${params}`;
  };

  instance.get = (url, config = {}) => {
    if (config?.disableDuplicate) {
      return originalGet(url, config);
    }

    const key = genKey(url, config);
    if (inFlightGetRequests.has(key)) {
      return inFlightGetRequests.get(key);
    }

    const reqPromise = originalGet(url, config).finally(() => {
      inFlightGetRequests.delete(key);
    });

    inFlightGetRequests.set(key, reqPromise);
    return reqPromise;
  };
}

patchAPIInstance(API);

export function updateAPI() {
  API = axios.create({
    baseURL: import.meta.env.VITE_REACT_APP_SERVER_URL
      ? import.meta.env.VITE_REACT_APP_SERVER_URL
      : '',
    headers: {
      'New-API-User': getUserIdFromLocalStorage(),
      'Cache-Control': 'no-store',
    },
  });

  patchAPIInstance(API);
}

API.interceptors.response.use(
  (response) => response,
  (error) => {
    // 如果请求配置中显式要求跳过全局错误处理，则不弹出默认错误提示
    if (error.config && error.config.skipErrorHandler) {
      return Promise.reject(error);
    }
    showError(error);
    return Promise.reject(error);
  },
);

// playground

export const inferPlaygroundEndpoint = (model = '') => {
  const normalized = String(model).toLowerCase();

  if (
    normalized.includes('gpt-image') ||
    normalized.includes('dall-e') ||
    normalized.includes('imagen-') ||
    normalized.includes('flux-') ||
    normalized.includes('flux.1-')
  ) {
    return PLAYGROUND_ENDPOINTS.IMAGE_GENERATIONS;
  }

  if (
    normalized.includes('claude') ||
    normalized.includes('haiku') ||
    normalized.includes('sonnet') ||
    normalized.includes('opus')
  ) {
    return PLAYGROUND_ENDPOINTS.CLAUDE_MESSAGES;
  }

  if (
    normalized.startsWith('gpt-') ||
    normalized.startsWith('chatgpt') ||
    /^o\d/.test(normalized)
  ) {
    return PLAYGROUND_ENDPOINTS.RESPONSES;
  }

  return PLAYGROUND_ENDPOINTS.CHAT_COMPLETIONS;
};

export const getPlaygroundEndpointLabel = (endpoint) => {
  switch (endpoint) {
    case PLAYGROUND_ENDPOINTS.RESPONSES:
      return 'Responses (/v1/responses)';
    case PLAYGROUND_ENDPOINTS.CLAUDE_MESSAGES:
      return 'Claude Messages (/v1/messages)';
    case PLAYGROUND_ENDPOINTS.IMAGE_GENERATIONS:
      return 'Images (/v1/images/generations)';
    default:
      return 'Chat Completions (/v1/chat/completions)';
  }
};

export const getPlaygroundEndpointDescription = (endpoint) => {
  switch (endpoint) {
    case PLAYGROUND_ENDPOINTS.RESPONSES:
      return 'GPT text models, including Responses image_generation_call results.';
    case PLAYGROUND_ENDPOINTS.CLAUDE_MESSAGES:
      return 'Claude Haiku, Sonnet, and Opus models.';
    case PLAYGROUND_ENDPOINTS.IMAGE_GENERATIONS:
      return 'Dedicated image models such as gpt-image and dall-e.';
    default:
      return 'Legacy OpenAI-compatible chat completion models.';
  }
};

export const getPlaygroundEndpointUrl = (endpoint) => {
  switch (endpoint) {
    case PLAYGROUND_ENDPOINTS.RESPONSES:
      return '/pg/responses';
    case PLAYGROUND_ENDPOINTS.CLAUDE_MESSAGES:
      return '/pg/messages';
    case PLAYGROUND_ENDPOINTS.IMAGE_GENERATIONS:
      return '/pg/images/generations';
    default:
      return '/pg/chat/completions';
  }
};

const extractTextFromMessageContent = (content) => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (!part || typeof part !== 'object') return '';
      if (part.type === 'text' && typeof part.text === 'string') {
        return part.text;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
};

const getProcessedMessages = (messages) =>
  messages.filter(isValidMessage).map(formatMessageForAPI).filter(Boolean);

const getLastUserPrompt = (messages) => {
  const lastUserMessage = getLastUserMessage(messages);
  return lastUserMessage ? extractTextFromMessageContent(lastUserMessage.content) : '';
};

const applyCommonTextParameters = (payload, inputs, parameterEnabled, maxTokenKey) => {
  if (parameterEnabled.temperature) payload.temperature = inputs.temperature;
  if (parameterEnabled.top_p) payload.top_p = inputs.top_p;
  if (parameterEnabled.max_tokens) {
    payload[maxTokenKey] =
      maxTokenKey === 'max_output_tokens'
        ? inputs.max_output_tokens
        : inputs.max_tokens;
  }
};

const buildChatCompletionPayload = (messages, systemPrompt, inputs, parameterEnabled) => {
  const processedMessages = getProcessedMessages(messages);

  if (systemPrompt && systemPrompt.trim()) {
    processedMessages.unshift({
      role: MESSAGE_ROLES.SYSTEM,
      content: systemPrompt.trim(),
    });
  }

  const payload = {
    model: inputs.model,
    group: inputs.group,
    messages: processedMessages,
    stream: inputs.stream,
  };

  const parameterMappings = {
    temperature: 'temperature',
    top_p: 'top_p',
    max_tokens: 'max_tokens',
    frequency_penalty: 'frequency_penalty',
    presence_penalty: 'presence_penalty',
    seed: 'seed',
  };

  Object.entries(parameterMappings).forEach(([key, param]) => {
    const enabled = parameterEnabled[key];
    const value = inputs[param];
    const hasValue = value !== undefined && value !== null;

    if (!enabled) return;

    if (param === 'max_tokens') {
      if (typeof value === 'number') payload[param] = value;
      return;
    }

    if (hasValue) payload[param] = value;
  });

  return payload;
};

const buildResponsesPayload = (messages, systemPrompt, inputs, parameterEnabled) => {
  const processedMessages = getProcessedMessages(messages);
  const systemMessages = processedMessages.filter((m) => m.role === MESSAGE_ROLES.SYSTEM);
  const input = processedMessages.filter((m) => m.role !== MESSAGE_ROLES.SYSTEM);
  const payload = {
    model: inputs.model,
    group: inputs.group,
    input,
    stream: inputs.stream,
  };

  const instructionParts = [];
  if (systemPrompt && systemPrompt.trim()) {
    instructionParts.push(systemPrompt.trim());
  }
  instructionParts.push(
    ...systemMessages
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .filter(Boolean),
  );
  if (instructionParts.length > 0) {
    payload.instructions = instructionParts.join('\n\n');
  }

  applyCommonTextParameters(payload, inputs, parameterEnabled, 'max_output_tokens');
  return payload;
};

const buildClaudeMessagesPayload = (messages, systemPrompt, inputs, parameterEnabled) => {
  const processedMessages = getProcessedMessages(messages);
  const systemMessages = processedMessages.filter((m) => m.role === MESSAGE_ROLES.SYSTEM);
  const payload = {
    model: inputs.model,
    group: inputs.group,
    messages: processedMessages.filter((m) => m.role !== MESSAGE_ROLES.SYSTEM),
    stream: inputs.stream,
    max_tokens: inputs.max_tokens,
  };

  const systemParts = [];
  if (systemPrompt && systemPrompt.trim()) {
    systemParts.push(systemPrompt.trim());
  }
  systemParts.push(
    ...systemMessages
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .filter(Boolean),
  );
  if (systemParts.length > 0) {
    payload.system = systemParts.join('\n\n');
  }

  applyCommonTextParameters(payload, inputs, parameterEnabled, 'max_tokens');
  payload.max_tokens = inputs.max_tokens;
  return payload;
};

const buildImageGenerationPayload = (messages, inputs) => ({
  model: inputs.model,
  group: inputs.group,
  prompt: getLastUserPrompt(messages),
  n: inputs.image_n,
  size: inputs.image_size,
  quality: inputs.image_quality,
  response_format: inputs.image_response_format,
});

// 构建API请求负载
export const buildApiPayload = (
  messages,
  systemPrompt,
  inputs,
  parameterEnabled,
  endpoint = inferPlaygroundEndpoint(inputs.model),
) => {
  switch (endpoint) {
    case PLAYGROUND_ENDPOINTS.RESPONSES:
      return buildResponsesPayload(messages, systemPrompt, inputs, parameterEnabled);
    case PLAYGROUND_ENDPOINTS.CLAUDE_MESSAGES:
      return buildClaudeMessagesPayload(messages, systemPrompt, inputs, parameterEnabled);
    case PLAYGROUND_ENDPOINTS.IMAGE_GENERATIONS:
      return buildImageGenerationPayload(messages, inputs);
    default:
      return buildChatCompletionPayload(messages, systemPrompt, inputs, parameterEnabled);
  }
};

// 处理API错误响应
export const handleApiError = (error, response = null) => {
  const errorInfo = {
    error: error.message || '未知错误',
    timestamp: new Date().toISOString(),
    stack: error.stack,
  };

  if (response) {
    errorInfo.status = response.status;
    errorInfo.statusText = response.statusText;
  }

  if (error.message.includes('HTTP error')) {
    errorInfo.details = '服务器返回了错误状态码';
  } else if (error.message.includes('Failed to fetch')) {
    errorInfo.details = '网络连接失败或服务器无响应';
  }

  return errorInfo;
};

// 处理模型数据
export const processModelsData = (data, currentModel) => {
  const modelOptions = data.map((model) => ({
    label: model,
    value: model,
  }));

  const hasCurrentModel = modelOptions.some(
    (option) => option.value === currentModel,
  );
  const selectedModel =
    hasCurrentModel && modelOptions.length > 0
      ? currentModel
      : modelOptions[0]?.value;

  return { modelOptions, selectedModel };
};

// 处理分组数据
export const processGroupsData = (data, userGroup) => {
  let groupOptions = Object.entries(data).map(([group, info]) => ({
    label:
      info.desc.length > 20 ? info.desc.substring(0, 20) + '...' : info.desc,
    value: group,
    ratio: info.ratio,
    fullLabel: info.desc,
  }));

  if (groupOptions.length === 0) {
    groupOptions = [
      {
        label: '用户分组',
        value: '',
        ratio: 1,
      },
    ];
  } else if (userGroup) {
    const userGroupIndex = groupOptions.findIndex((g) => g.value === userGroup);
    if (userGroupIndex > -1) {
      const userGroupOption = groupOptions.splice(userGroupIndex, 1)[0];
      groupOptions.unshift(userGroupOption);
    }
  }

  return groupOptions;
};

// 原来components中的utils.js

export async function getOAuthState() {
  let path = '/api/oauth/state';
  let affCode = localStorage.getItem('aff');
  if (affCode && affCode.length > 0) {
    path += `?aff=${affCode}`;
  }
  const res = await API.get(path);
  const { success, message, data } = res.data;
  if (success) {
    return data;
  } else {
    showError(message);
    return '';
  }
}

async function prepareOAuthState(options = {}) {
  const { shouldLogout = false } = options;
  if (shouldLogout) {
    try {
      await API.get('/api/user/logout', { skipErrorHandler: true });
    } catch (err) {}
    localStorage.removeItem('user');
    updateAPI();
  }
  return await getOAuthState();
}

export async function onDiscordOAuthClicked(client_id, options = {}) {
  const state = await prepareOAuthState(options);
  if (!state) return;
  const redirect_uri = `${window.location.origin}/oauth/discord`;
  const response_type = 'code';
  const scope = 'identify+openid';
  redirectToOAuthUrl(
    `https://discord.com/oauth2/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}&response_type=${response_type}&scope=${scope}&state=${state}`,
  );
}

export async function onOIDCClicked(
  auth_url,
  client_id,
  openInNewTab = false,
  options = {},
) {
  const state = await prepareOAuthState(options);
  if (!state) return;
  const url = new URL(auth_url);
  url.searchParams.set('client_id', client_id);
  url.searchParams.set('redirect_uri', `${window.location.origin}/oauth/oidc`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('state', state);
  redirectToOAuthUrl(url, { openInNewTab });
}

export async function onGitHubOAuthClicked(github_client_id, options = {}) {
  const state = await prepareOAuthState(options);
  if (!state) return;
  redirectToOAuthUrl(
    `https://github.com/login/oauth/authorize?client_id=${github_client_id}&state=${state}&scope=user:email`,
  );
}

export async function onLinuxDOOAuthClicked(
  linuxdo_client_id,
  options = { shouldLogout: false },
) {
  const state = await prepareOAuthState(options);
  if (!state) return;
  redirectToOAuthUrl(
    `https://connect.linux.do/oauth2/authorize?response_type=code&client_id=${linuxdo_client_id}&state=${state}`,
  );
}

/**
 * Initiate custom OAuth login
 * @param {Object} provider - Custom OAuth provider config from status API
 * @param {string} provider.slug - Provider slug (used for callback URL)
 * @param {string} provider.client_id - OAuth client ID
 * @param {string} provider.authorization_endpoint - Authorization URL
 * @param {string} provider.scopes - OAuth scopes (space-separated)
 * @param {Object} options - Options
 * @param {boolean} options.shouldLogout - Whether to logout first
 */
export async function onCustomOAuthClicked(provider, options = {}) {
  const state = await prepareOAuthState(options);
  if (!state) return;

  try {
    const redirect_uri = `${window.location.origin}/oauth/${provider.slug}`;

    // Check if authorization_endpoint is a full URL or relative path
    let authUrl;
    if (
      provider.authorization_endpoint.startsWith('http://') ||
      provider.authorization_endpoint.startsWith('https://')
    ) {
      authUrl = new URL(provider.authorization_endpoint);
    } else {
      // Relative path - this is a configuration error, show error message
      console.error(
        'Custom OAuth authorization_endpoint must be a full URL:',
        provider.authorization_endpoint,
      );
      showError(
        'OAuth 配置错误：授权端点必须是完整的 URL（以 http:// 或 https:// 开头）',
      );
      return;
    }

    authUrl.searchParams.set('client_id', provider.client_id);
    authUrl.searchParams.set('redirect_uri', redirect_uri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set(
      'scope',
      provider.scopes || 'openid profile email',
    );
    authUrl.searchParams.set('state', state);

    redirectToOAuthUrl(authUrl);
  } catch (error) {
    console.error('Failed to initiate custom OAuth:', error);
    showError('OAuth 登录失败：' + (error.message || '未知错误'));
  }
}

let channelModels = undefined;
export async function loadChannelModels() {
  const res = await API.get('/api/models');
  const { success, data } = res.data;
  if (!success) {
    return;
  }
  channelModels = data;
  localStorage.setItem('channel_models', JSON.stringify(data));
}

export function getChannelModels(type) {
  if (channelModels !== undefined && type in channelModels) {
    if (!channelModels[type]) {
      return [];
    }
    return channelModels[type];
  }
  let models = localStorage.getItem('channel_models');
  if (!models) {
    return [];
  }
  channelModels = JSON.parse(models);
  if (type in channelModels) {
    return channelModels[type];
  }
  return [];
}

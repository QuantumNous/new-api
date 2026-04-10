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
} from './utils';
import axios from 'axios';
import { MESSAGE_ROLES } from '../constants/playground.constants';

export let API = axios.create({
  baseURL: import.meta.env.VITE_REACT_APP_SERVER_URL
    ? import.meta.env.VITE_REACT_APP_SERVER_URL
    : '',
  headers: {
    'New-API-User': getUserIdFromLocalStorage(),
    'Cache-Control': 'no-store',
  },
});

const GET_STALE_CACHE_PREFIX = 'new-api:get-stale-cache';
const GET_STALE_CACHE_TTL_MS = 10 * 60 * 1000;

function buildGetRequestKey(url, config = {}) {
  const scopedUserId =
    String(getUserIdFromLocalStorage() || 'guest').trim() || 'guest';
  const customKey =
    typeof config?.staleCacheKey === 'string' ? config.staleCacheKey.trim() : '';
  if (customKey) {
    return `${scopedUserId}:${customKey}`;
  }

  const params = config.params
    ? JSON.stringify(
        Object.keys(config.params)
          .sort()
          .reduce((acc, key) => {
            acc[key] = config.params[key];
            return acc;
          }, {}),
      )
    : '{}';
  return `${scopedUserId}:${url}?${params}`;
}

function getGetStaleCacheStorageKey(url, config = {}) {
  return `${GET_STALE_CACHE_PREFIX}:${buildGetRequestKey(url, config)}`;
}

function readStaleGetCache(url, config = {}) {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(
      getGetStaleCacheStorageKey(url, config),
    );
    if (!rawValue) {
      return null;
    }
    const cachedValue = JSON.parse(rawValue);
    if (
      !cachedValue ||
      typeof cachedValue !== 'object' ||
      Date.now() - Number(cachedValue.cachedAt || 0) > GET_STALE_CACHE_TTL_MS
    ) {
      window.sessionStorage.removeItem(getGetStaleCacheStorageKey(url, config));
      return null;
    }
    return cachedValue;
  } catch (error) {
    return null;
  }
}

function writeStaleGetCache(url, config = {}, data) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(
      getGetStaleCacheStorageKey(url, config),
      JSON.stringify({
        cachedAt: Date.now(),
        data,
      }),
    );
  } catch (error) {
    // Ignore session cache write failures.
  }
}

function shouldCacheGetResponse(response) {
  const method = String(response?.config?.method || 'get').toLowerCase();
  return method === 'get' && response?.config?.disableStaleCache !== true;
}

function tryResolveStaleGetResponse(error) {
  const method = String(error?.config?.method || 'get').toLowerCase();
  if (
    method !== 'get' ||
    error?.config?.disableStaleCache === true ||
    error?.response?.status !== 429
  ) {
    return null;
  }

  const cachedValue = readStaleGetCache(error.config.url, error.config);
  if (!cachedValue) {
    return null;
  }

  return {
    ...error.response,
    status: 200,
    statusText: 'OK',
    data: cachedValue.data,
    config: error.config,
    request: error.request,
    __fromStaleCache: true,
  };
}


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

function attachAPIInterceptors(instance) {
  instance.interceptors.response.use(
    (response) => {
      if (shouldCacheGetResponse(response)) {
        writeStaleGetCache(response.config.url, response.config, response.data);
      }
      return response;
    },
    (error) => {
      const staleResponse = tryResolveStaleGetResponse(error);
      if (staleResponse) {
        return Promise.resolve(staleResponse);
      }
      return Promise.reject(error);
    },
  );
}

function attachGlobalErrorInterceptor(instance) {
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.config && error.config.skipErrorHandler) {
        return Promise.reject(error);
      }
      const responseData = error?.response?.data;
      const backendMessage =
        (typeof responseData?.error?.message === 'string' &&
          responseData.error.message.trim()) ||
        (typeof responseData?.message === 'string' &&
          responseData.message.trim()) ||
        (typeof responseData === 'string' && responseData.trim()) ||
        '';
      showError(backendMessage || error);
      return Promise.reject(error);
    },
  );
}

patchAPIInstance(API);
attachAPIInterceptors(API);

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
  attachAPIInterceptors(API);
  attachGlobalErrorInterceptor(API);
}

API.interceptors.response.use(
  (response) => response,
  (error) => {
    // 如果请求配置中显式要求跳过全局错误处理，则不弹出默认错误提示
    if (error.config && error.config.skipErrorHandler) {
      return Promise.reject(error);
    }
    const responseData = error?.response?.data;
    const backendMessage =
      (typeof responseData?.error?.message === 'string' &&
        responseData.error.message.trim()) ||
      (typeof responseData?.message === 'string' &&
        responseData.message.trim()) ||
      (typeof responseData === 'string' && responseData.trim()) ||
      '';
    showError(backendMessage || error);
    return Promise.reject(error);
  },
);

// playground

// 构建API请求负载
export const buildApiPayload = (
  messages,
  systemPrompt,
  inputs,
  parameterEnabled,
) => {
  const normalizeGrokImageSize = (size) => {
    if (size === '1536x1024') {
      return '1792x1024';
    }
    if (size === '1024x1536') {
      return '1024x1792';
    }
    return size;
  };
  const grokImagineImageModels = new Set([
    'grok-imagine-1.0',
    'grok-imagine-1.0-fast',
  ]);
  const grokImagineImageEditModels = new Set(['grok-imagine-1.0-edit']);
  const adobeImageModels = new Set([
    'nano-banana',
    'nano-banana2',
    'nano-banana-pro',
  ]);
  const adobeVideoModels = new Set([
    'sora2',
    'sora2-pro',
    'veo31',
    'veo31-ref',
    'veo31-fast',
  ]);
  const processedMessages = messages
    .filter(isValidMessage)
    .map(formatMessageForAPI)
    .filter(Boolean);

  // 如果有系统提示，插入到消息开头
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

  // 添加启用的参数
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

    if (enabled && hasValue) {
      payload[param] = value;
    }
  });

  const isVideoModel =
    typeof inputs.model === 'string' && inputs.model.includes('video');
  const isGrokImagineImageModel =
    grokImagineImageModels.has(inputs.model) ||
    grokImagineImageEditModels.has(inputs.model);
  const isGrokImagineImageEditModel = grokImagineImageEditModels.has(inputs.model);
  const isGrokImagineVideoModel = inputs.model === 'grok-imagine-1.0-video';
  const isAdobeImageModel = adobeImageModels.has(inputs.model);
  const isAdobeVideoModel = adobeVideoModels.has(inputs.model);
  const isAdobeVeoModel =
    inputs.model === 'veo31' ||
    inputs.model === 'veo31-ref' ||
    inputs.model === 'veo31-fast';
  const adobeAspectRatioRaw =
    inputs.aspectRatio || (isAdobeVideoModel ? '16:9' : '1:1');
  const adobeAspectRatio =
    adobeAspectRatioRaw === 'auto' ? '' : adobeAspectRatioRaw;
  const normalizedSeed =
    payload.seed !== undefined && payload.seed !== null
      ? Number(payload.seed)
      : null;
  if (isGrokImagineImageModel) {
    payload.stream = false;
    if (!isGrokImagineImageEditModel && inputs.imageSize) {
      payload.size = normalizeGrokImageSize(inputs.imageSize);
    }
  }
  if (isAdobeImageModel) {
    if (adobeAspectRatio) {
      payload.aspect_ratio = adobeAspectRatio;
    } else if (inputs.autoImageSize) {
      payload.size = inputs.autoImageSize;
    }
    if (inputs.outputResolution) {
      payload.output_resolution = inputs.outputResolution;
    } else {
      payload.output_resolution = '2K';
    }
    if (Number.isFinite(normalizedSeed)) {
      payload.seeds = [Math.trunc(normalizedSeed)];
    }
    payload.extra_body = {
      ...(payload.extra_body || {}),
      google: {
        ...((payload.extra_body && payload.extra_body.google) || {}),
        image_config: {
          ...(((payload.extra_body && payload.extra_body.google) || {})
            .image_config || {}),
          ...(adobeAspectRatio ? { aspect_ratio: adobeAspectRatio } : {}),
          ...(payload.output_resolution
            ? { image_size: payload.output_resolution }
            : {}),
        },
      },
    };
  }
  if (isVideoModel) {
    payload.stream = false;
    if (inputs.videoSize) {
      payload.size = inputs.videoSize;
    }
    if (inputs.videoSeconds) {
      payload.seconds = String(inputs.videoSeconds);
    }
    if (inputs.videoQuality) {
      const resolutionName =
        inputs.videoQuality === 'high'
          ? '720p'
          : inputs.videoQuality === 'standard'
            ? '480p'
            : inputs.videoQuality;
      payload.quality =
        resolutionName === '720p'
          ? 'high'
          : resolutionName === '480p'
            ? 'standard'
            : resolutionName;
      if (isGrokImagineVideoModel && resolutionName) {
        payload.resolution_name = resolutionName;
      }
    }
    if (isGrokImagineVideoModel && inputs.videoPreset) {
      payload.preset = inputs.videoPreset;
    }
    if (isGrokImagineVideoModel && (payload.resolution_name || payload.preset)) {
      payload.video_config = {
        ...(payload.resolution_name
          ? { resolution_name: payload.resolution_name }
          : {}),
        ...(payload.preset ? { preset: payload.preset } : {}),
      };
    }
  }
  if (isAdobeVideoModel) {
    const forcedDuration = inputs.model === 'veo31-ref' ? 8 : Number(inputs.videoDuration || 4);
    const forcedAspectRatio = inputs.model === 'veo31-ref' ? '16:9' : adobeAspectRatio;
    payload.duration = forcedDuration;
    payload.aspect_ratio = forcedAspectRatio;
    if (Number.isFinite(normalizedSeed)) {
      payload.seeds = [Math.trunc(normalizedSeed)];
    }
    if (isAdobeVeoModel) {
      payload.resolution = inputs.videoResolution || '1080p';
    }
    if (inputs.model === 'veo31-ref') {
      payload.reference_mode = 'image';
    } else if (inputs.model === 'veo31' && inputs.referenceMode) {
      payload.reference_mode = inputs.referenceMode;
    }
  }

  return payload;
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

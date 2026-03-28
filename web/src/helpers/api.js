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
import i18n from '../i18n/i18n';
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

function redirectToOAuthUrl(url, options = {}) {
  const { openInNewTab = false } = options;
  const targetUrl = typeof url === 'string' ? url : url.toString();

  if (openInNewTab) {
    window.open(targetUrl, '_blank');
    return;
  }

  window.location.assign(targetUrl);
}

function getCustomProviderKind(provider) {
  return provider?.kind || 'oauth_code';
}

async function getCurrentUserFromSession() {
  const res = await API.get('/api/user/self', { skipErrorHandler: true });
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.message || i18n.t('获取当前登录态失败'));
  }
  return res.data.data;
}

function isTicketAcquireMode(mode) {
  return mode === 'ticket_exchange' || mode === 'ticket_validate';
}

function supportsCustomProviderBrowserLogin(provider) {
  if (provider?.browser_login_supported !== undefined) {
    return Boolean(provider.browser_login_supported);
  }
  const providerKind = getCustomProviderKind(provider);
  if (providerKind === 'trusted_header') {
    return true;
  }
  if (providerKind === 'jwt_direct') {
    if (isTicketAcquireMode(provider?.jwt_acquire_mode || 'direct_token')) {
      return Boolean(provider?.authorization_endpoint);
    }
    if ((provider?.jwt_identity_mode || 'claims') === 'userinfo') {
      return false;
    }
    return Boolean(
      provider?.authorization_endpoint &&
        provider?.client_id &&
        provider?.jwt_source !== 'body',
    );
  }
  return Boolean(provider?.authorization_endpoint && provider?.client_id);
}

function ensureAbsoluteOAuthURL(url) {
  if (typeof url !== 'string' || url.trim() === '') {
    throw new Error(i18n.t('缺少授权端点 URL'));
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error(
      i18n.t('授权端点必须是完整的 URL（以 http:// 或 https:// 开头）'),
    );
  }
  return new URL(url);
}

function buildCustomJWTAuthorizationUrl(provider, state) {
  const authUrl = ensureAbsoluteOAuthURL(provider.authorization_endpoint);
  const acquireMode = provider.jwt_acquire_mode || 'direct_token';
  const callbackUrl = new URL(
    `/oauth/${provider.slug}`,
    window.location.origin,
  );

  if (isTicketAcquireMode(acquireMode)) {
    callbackUrl.searchParams.set('state', state);
    authUrl.searchParams.set(
      provider.authorization_service_field || 'service',
      callbackUrl.toString(),
    );
    return authUrl;
  }

  const jwtSource = provider.jwt_source || 'query';

  if (jwtSource === 'body') {
    throw new Error(
      i18n.t('当前浏览器登录暂不支持 form_post 模式，请改用 query 或 fragment'),
    );
  }
  if (!provider.client_id) {
    throw new Error(i18n.t('JWT 登录缺少 Client ID 配置'));
  }

  authUrl.searchParams.set('client_id', provider.client_id);
  authUrl.searchParams.set('redirect_uri', callbackUrl.toString());
  authUrl.searchParams.set('scope', provider.scopes || 'openid profile email');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('nonce', state);
  authUrl.searchParams.set('response_type', 'id_token');
  authUrl.searchParams.set(
    'response_mode',
    jwtSource === 'fragment' ? 'fragment' : 'query',
  );

  return authUrl;
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

// 构建API请求负载
export const buildApiPayload = (
  messages,
  systemPrompt,
  inputs,
  parameterEnabled,
) => {
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

    if (!enabled) {
      return;
    }

    if (param === 'max_tokens') {
      if (typeof value === 'number') {
        payload[param] = value;
      }
      return;
    }

    if (hasValue) {
      payload[param] = value;
    }
  });

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
  const normalizedModels = Array.isArray(data) ? data : [];
  const modelOptions = normalizedModels.map((model) => ({
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
  const normalizedGroups =
    data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  let groupOptions = Object.entries(normalizedGroups).map(([group, info]) => {
    const description = info?.desc || group;
    return {
      label:
        description.length > 20
          ? description.substring(0, 20) + '...'
          : description,
      value: group,
      ratio: info?.ratio ?? 1,
      fullLabel: description,
    };
  });

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
  if (!supportsCustomProviderBrowserLogin(provider)) {
    throw new Error(i18n.t('当前身份提供商当前配置暂不支持浏览器登录/绑定'));
  }

  try {
    const providerKind = getCustomProviderKind(provider);
    if (providerKind === 'trusted_header') {
      const state = await prepareOAuthState(options);
      if (!state) return;
      const res = await API.post(
        `/api/auth/external/${provider.slug}/header/login`,
        { state },
        { skipErrorHandler: true },
      );
      if (!res.data.success) {
        throw new Error(res.data.message || i18n.t('未知错误'));
      }
      if (res.data.data?.action === 'bind') {
        try {
          const user = await getCurrentUserFromSession();
          return {
            action: 'bind',
            user,
          };
        } catch (error) {
          console.error('Failed to refresh trusted header bind session user:', error);
          throw new Error(
            error?.response?.data?.message ||
              error?.message ||
              i18n.t('获取当前登录态失败'),
          );
        }
      }
      return {
        action: 'login',
        user: res.data.data,
      };
    }

    const state = await prepareOAuthState(options);
    if (!state) return;
    const authUrl =
      providerKind === 'jwt_direct'
        ? buildCustomJWTAuthorizationUrl(provider, state)
        : ensureAbsoluteOAuthURL(provider.authorization_endpoint);

    if (providerKind !== 'jwt_direct') {
      authUrl.searchParams.set('client_id', provider.client_id);
      authUrl.searchParams.set(
        'redirect_uri',
        `${window.location.origin}/oauth/${provider.slug}`,
      );
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set(
        'scope',
        provider.scopes || 'openid profile email',
      );
      authUrl.searchParams.set('state', state);
    }

    redirectToOAuthUrl(authUrl);
    return undefined;
  } catch (error) {
    console.error('Failed to initiate custom OAuth:', error);
    throw new Error(
      error?.response?.data?.message || error?.message || i18n.t('未知错误'),
    );
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

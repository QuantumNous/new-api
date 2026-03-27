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

import React, { useEffect, useState } from 'react';
import {
  Button,
  Form,
  Row,
  Col,
  Typography,
  Modal,
  Banner,
  Card,
  Collapse,
  Switch,
  Table,
  Tag,
  Popconfirm,
  Space,
} from '@douyinfe/semi-ui';
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconRefresh,
} from '@douyinfe/semi-icons';
import {
  API,
  showError,
  showSuccess,
  getOAuthProviderIcon,
} from '../../helpers';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

// Preset templates for common OAuth providers
const OAUTH_PRESETS = {
  'github-enterprise': {
    name: 'GitHub Enterprise',
    authorization_endpoint: '/login/oauth/authorize',
    token_endpoint: '/login/oauth/access_token',
    user_info_endpoint: '/api/v3/user',
    scopes: 'user:email',
    user_id_field: 'id',
    username_field: 'login',
    display_name_field: 'name',
    email_field: 'email',
  },
  gitlab: {
    name: 'GitLab',
    authorization_endpoint: '/oauth/authorize',
    token_endpoint: '/oauth/token',
    user_info_endpoint: '/api/v4/user',
    scopes: 'openid profile email',
    user_id_field: 'id',
    username_field: 'username',
    display_name_field: 'name',
    email_field: 'email',
  },
  gitea: {
    name: 'Gitea',
    authorization_endpoint: '/login/oauth/authorize',
    token_endpoint: '/login/oauth/access_token',
    user_info_endpoint: '/api/v1/user',
    scopes: 'openid profile email',
    user_id_field: 'id',
    username_field: 'login',
    display_name_field: 'full_name',
    email_field: 'email',
  },
  nextcloud: {
    name: 'Nextcloud',
    authorization_endpoint: '/apps/oauth2/authorize',
    token_endpoint: '/apps/oauth2/api/v1/token',
    user_info_endpoint: '/ocs/v2.php/cloud/user?format=json',
    scopes: 'openid profile email',
    user_id_field: 'ocs.data.id',
    username_field: 'ocs.data.id',
    display_name_field: 'ocs.data.displayname',
    email_field: 'ocs.data.email',
  },
  keycloak: {
    name: 'Keycloak',
    authorization_endpoint: '/realms/{realm}/protocol/openid-connect/auth',
    token_endpoint: '/realms/{realm}/protocol/openid-connect/token',
    user_info_endpoint: '/realms/{realm}/protocol/openid-connect/userinfo',
    scopes: 'openid profile email',
    user_id_field: 'sub',
    username_field: 'preferred_username',
    display_name_field: 'name',
    email_field: 'email',
  },
  authentik: {
    name: 'Authentik',
    authorization_endpoint: '/application/o/authorize/',
    token_endpoint: '/application/o/token/',
    user_info_endpoint: '/application/o/userinfo/',
    scopes: 'openid profile email',
    user_id_field: 'sub',
    username_field: 'preferred_username',
    display_name_field: 'name',
    email_field: 'email',
  },
  ory: {
    name: 'ORY Hydra',
    authorization_endpoint: '/oauth2/auth',
    token_endpoint: '/oauth2/token',
    user_info_endpoint: '/userinfo',
    scopes: 'openid profile email',
    user_id_field: 'sub',
    username_field: 'preferred_username',
    display_name_field: 'name',
    email_field: 'email',
  },
};

const OAUTH_PRESET_ICONS = {
  'github-enterprise': 'github',
  gitlab: 'gitlab',
  gitea: 'gitea',
  nextcloud: 'nextcloud',
  keycloak: 'keycloak',
  authentik: 'authentik',
  ory: 'openid',
};

const getPresetIcon = (preset) => OAUTH_PRESET_ICONS[preset] || '';

const PRESET_RESET_VALUES = {
  name: '',
  slug: '',
  icon: '',
  authorization_endpoint: '',
  token_endpoint: '',
  user_info_endpoint: '',
  scopes: '',
  user_id_field: '',
  username_field: '',
  display_name_field: '',
  email_field: '',
  well_known: '',
  auth_style: 0,
  access_policy: '',
  access_denied_message: '',
};

const CUSTOM_OAUTH_KIND_OPTIONS = [
  { value: 'oauth_code', label: 'OAuth 2.0 / OIDC 授权码模式' },
  { value: 'jwt_direct', label: 'JWT 直连登录' },
  { value: 'trusted_header', label: '可信 Header SSO' },
];

const JWT_SOURCE_OPTIONS = [
  { value: 'query', label: '查询参数' },
  { value: 'fragment', label: 'URL 片段' },
  { value: 'body', label: '请求体（仅 API）' },
];

const JWT_ACQUIRE_MODE_OPTIONS = [
  { value: 'direct_token', label: '直接回调 JWT' },
  { value: 'ticket_exchange', label: '票据换取 JWT' },
  { value: 'ticket_validate', label: '票据校验（CAS serviceValidate）' },
];

const JWT_IDENTITY_MODE_OPTIONS = [
  { value: 'claims', label: '本地验签并解析 JWT Claims' },
  { value: 'userinfo', label: '通过用户信息端点解析身份' },
];

const TICKET_EXCHANGE_METHOD_OPTIONS = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
];

const TICKET_EXCHANGE_PAYLOAD_MODE_OPTIONS = [
  { value: 'query', label: '查询字符串' },
  { value: 'form', label: '表单 URL 编码' },
  { value: 'json', label: 'JSON 请求体' },
  { value: 'multipart', label: 'Multipart 表单' },
];

const JWT_MAPPING_MODE_OPTIONS = [
  { value: 'explicit_only', label: '仅显式映射' },
  { value: 'mapping_first', label: '映射优先，其次透传' },
];

const DISCOVERY_FIELD_LABELS = {
  authorization_endpoint: '授权端点',
  token_endpoint: '令牌端点',
  user_info_endpoint: '用户信息端点',
  scopes: '作用域',
  user_id_field: '用户 ID 字段',
  username_field: '用户名字段',
  display_name_field: '显示名称字段',
  email_field: '邮箱字段',
};

const REQUIRED_FIELD_LABELS = {
  name: '显示名称',
  slug: 'Slug',
  client_id: '客户端 ID',
  client_secret: '客户端密钥',
  authorization_endpoint: '授权端点',
  token_endpoint: '令牌端点',
  user_info_endpoint: '用户信息端点',
  issuer: '发行者',
  trusted_proxy_cidrs: '可信代理 CIDR JSON',
  external_id_header: '外部身份 Header',
};

const ACCESS_POLICY_TEMPLATES = {
  level_active: `{
  "logic": "and",
  "conditions": [
    {"field": "trust_level", "op": "gte", "value": 2},
    {"field": "active", "op": "eq", "value": true}
  ]
}`,
  org_or_role: `{
  "logic": "or",
  "conditions": [
    {"field": "org", "op": "eq", "value": "core"},
    {"field": "roles", "op": "contains", "value": "admin"}
  ]
}`,
};

const ACCESS_DENIED_TEMPLATES = {
  level_hint:
    '需要等级 {{required}}，你当前等级 {{current}}（字段：{{field}}）',
  org_hint:
    '仅限指定组织或角色访问。组织={{current.org}}，角色={{current.roles}}',
};

const TICKET_VALIDATE_SUGGESTED_FIELDS = {
  user_id_field: 'authenticationSuccess.user',
  username_field: 'authenticationSuccess.attributes.loginid',
  display_name_field: 'authenticationSuccess.attributes.userName',
  email_field: 'authenticationSuccess.attributes.mailbox',
};

const CustomOAuthSetting = ({ serverAddress }) => {
  const { t } = useTranslation();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [selectedPreset, setSelectedPreset] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryInfo, setDiscoveryInfo] = useState(null);
  const [advancedActiveKeys, setAdvancedActiveKeys] = useState([]);
  const [clientSecretDirty, setClientSecretDirty] = useState(false);
  const [clearClientSecret, setClearClientSecret] = useState(false);
  const formApiRef = React.useRef(null);
  const customOAuthKindOptions = CUSTOM_OAUTH_KIND_OPTIONS.map((option) => ({
    ...option,
    label: t(option.label),
  }));
  const jwtSourceOptions = JWT_SOURCE_OPTIONS.map((option) => ({
    ...option,
    label: t(option.label),
  }));
  const jwtAcquireModeOptions = JWT_ACQUIRE_MODE_OPTIONS.map((option) => ({
    ...option,
    label: t(option.label),
  }));
  const jwtIdentityModeOptions = JWT_IDENTITY_MODE_OPTIONS.map((option) => ({
    ...option,
    label: t(option.label),
  }));
  const ticketExchangeMethodOptions = TICKET_EXCHANGE_METHOD_OPTIONS.map(
    (option) => ({
      ...option,
      label: t(option.label),
    }),
  );
  const ticketExchangePayloadModeOptions =
    TICKET_EXCHANGE_PAYLOAD_MODE_OPTIONS.map((option) => ({
      ...option,
      label: t(option.label),
    }));
  const jwtMappingModeOptions = JWT_MAPPING_MODE_OPTIONS.map((option) => ({
    ...option,
    label: t(option.label),
  }));
  const discoveryFieldLabels = Object.fromEntries(
    Object.entries(DISCOVERY_FIELD_LABELS).map(([field, label]) => [
      field,
      t(label),
    ]),
  );
  const currentProviderKind = formValues.kind || 'oauth_code';
  const isJWTDirect = currentProviderKind === 'jwt_direct';
  const isTrustedHeader = currentProviderKind === 'trusted_header';
  const isOAuthCode = currentProviderKind === 'oauth_code';
  const usesMappedRoleGroup = isJWTDirect || isTrustedHeader;
  const currentJWTIdentityMode = formValues.jwt_identity_mode || 'claims';
  const currentJWTAcquireMode = formValues.jwt_acquire_mode || 'direct_token';
  const isJWTTicketExchange =
    isJWTDirect && currentJWTAcquireMode === 'ticket_exchange';
  const isJWTTicketValidateMode =
    isJWTDirect && currentJWTAcquireMode === 'ticket_validate';
  const isJWTTicketBasedMode = isJWTTicketExchange || isJWTTicketValidateMode;
  const isJWTUserInfoMode =
    isJWTDirect && currentJWTIdentityMode === 'userinfo';

  const mergeFormValues = (newValues) => {
    setFormValues((prev) => ({ ...prev, ...newValues }));
    if (!formApiRef.current) return;
    Object.entries(newValues).forEach(([key, value]) => {
      formApiRef.current.setValue(key, value);
    });
  };

  const getLatestFormValues = () => {
    const values = formApiRef.current?.getValues?.();
    return values && typeof values === 'object' ? values : formValues;
  };

  const applyTicketValidateSuggestions = (values = {}) => {
    const nextValues = {};
    Object.entries(TICKET_VALIDATE_SUGGESTED_FIELDS).forEach(
      ([field, suggestedValue]) => {
        const currentValue = (values[field] ?? formValues[field] ?? '').trim();
        if (
          !currentValue ||
          ['sub', 'preferred_username', 'name', 'email'].includes(currentValue)
        ) {
          nextValues[field] = suggestedValue;
        }
      },
    );
    return nextValues;
  };

  const normalizeBaseUrl = (url) => (url || '').trim().replace(/\/+$/, '');

  const inferBaseUrlFromProvider = (provider) => {
    const endpoint =
      provider?.authorization_endpoint || provider?.token_endpoint;
    if (!endpoint) return '';
    try {
      const url = new URL(endpoint);
      return `${url.protocol}//${url.host}`;
    } catch (error) {
      return '';
    }
  };

  const resetDiscoveryState = () => {
    setDiscoveryInfo(null);
  };

  const closeModal = () => {
    setModalVisible(false);
    resetDiscoveryState();
    setAdvancedActiveKeys([]);
    setClientSecretDirty(false);
    setClearClientSecret(false);
  };

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/custom-oauth-provider/');
      if (res.data.success) {
        setProviders(res.data.data || []);
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('获取自定义 OAuth 提供商列表失败'));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleAdd = () => {
    setEditingProvider(null);
    setFormValues({
      kind: 'oauth_code',
      enabled: false,
      icon: '',
      scopes: 'openid profile email',
      jwt_source: 'query',
      jwt_identity_mode: 'claims',
      jwt_acquire_mode: 'direct_token',
      jwt_header: 'Authorization',
      authorization_service_field: 'service',
      ticket_exchange_method: 'GET',
      ticket_exchange_payload_mode: 'query',
      ticket_exchange_ticket_field: 'ticket',
      ticket_exchange_token_field: '',
      ticket_exchange_service_field: '',
      ticket_exchange_extra_params: '',
      ticket_exchange_headers: '',
      trusted_proxy_cidrs: '',
      external_id_header: '',
      username_header: '',
      display_name_header: '',
      email_header: '',
      group_header: '',
      role_header: '',
      user_id_field: 'sub',
      username_field: 'preferred_username',
      display_name_field: 'name',
      email_field: 'email',
      auto_register: false,
      auto_merge_by_email: false,
      sync_username_on_login: false,
      sync_display_name_on_login: false,
      sync_email_on_login: false,
      sync_group_on_login: false,
      sync_role_on_login: false,
      group_mapping_mode: 'explicit_only',
      role_mapping_mode: 'explicit_only',
      auth_style: 0,
      access_policy: '',
      access_denied_message: '',
    });
    setSelectedPreset('');
    setBaseUrl('');
    resetDiscoveryState();
    setAdvancedActiveKeys([]);
    setClientSecretDirty(false);
    setClearClientSecret(false);
    setModalVisible(true);
  };

  const handleEdit = (provider) => {
    setEditingProvider(provider);
    setFormValues({
      ...provider,
      kind: provider.kind || 'oauth_code',
      jwt_source: provider.jwt_source || 'query',
      jwt_header: provider.jwt_header || 'Authorization',
      jwt_identity_mode: provider.jwt_identity_mode || 'claims',
      jwt_acquire_mode: provider.jwt_acquire_mode || 'direct_token',
      authorization_service_field:
        provider.authorization_service_field || 'service',
      ticket_exchange_method: provider.ticket_exchange_method || 'GET',
      ticket_exchange_payload_mode:
        provider.ticket_exchange_payload_mode || 'query',
      ticket_exchange_ticket_field:
        provider.ticket_exchange_ticket_field || 'ticket',
      ticket_exchange_token_field: provider.ticket_exchange_token_field || '',
      ticket_exchange_service_field:
        provider.ticket_exchange_service_field || '',
      ticket_exchange_extra_params: provider.ticket_exchange_extra_params || '',
      ticket_exchange_headers: provider.ticket_exchange_headers || '',
      trusted_proxy_cidrs: provider.trusted_proxy_cidrs || '',
      external_id_header: provider.external_id_header || '',
      username_header: provider.username_header || '',
      display_name_header: provider.display_name_header || '',
      email_header: provider.email_header || '',
      group_header: provider.group_header || '',
      role_header: provider.role_header || '',
      sync_username_on_login: !!provider.sync_username_on_login,
      sync_display_name_on_login: !!provider.sync_display_name_on_login,
      sync_email_on_login: !!provider.sync_email_on_login,
      sync_group_on_login: !!provider.sync_group_on_login,
      sync_role_on_login: !!provider.sync_role_on_login,
      group_mapping_mode: provider.group_mapping_mode || 'explicit_only',
      role_mapping_mode: provider.role_mapping_mode || 'explicit_only',
    });
    setSelectedPreset(OAUTH_PRESETS[provider.slug] ? provider.slug : '');
    setBaseUrl(inferBaseUrlFromProvider(provider));
    resetDiscoveryState();
    setAdvancedActiveKeys([]);
    setClientSecretDirty(false);
    setClearClientSecret(false);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      const res = await API.delete(`/api/custom-oauth-provider/${id}`);
      if (res.data.success) {
        showSuccess(t('删除成功'));
        fetchProviders();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('删除失败'));
    }
  };

  const handleSubmit = async () => {
    const currentValues = getLatestFormValues();
    const providerKind = currentValues.kind || 'oauth_code';

    const requiredFields = ['name', 'slug'];
    if (providerKind === 'oauth_code') {
      requiredFields.push(
        'client_id',
        'authorization_endpoint',
        'token_endpoint',
        'user_info_endpoint',
      );

      if (!editingProvider) {
        requiredFields.push('client_secret');
      }
    } else if (providerKind === 'jwt_direct') {
      const acquireMode = currentValues.jwt_acquire_mode || 'direct_token';
      const identityMode = currentValues.jwt_identity_mode || 'claims';
      if (acquireMode === 'ticket_validate' && identityMode !== 'claims') {
        showError(t('Ticket Validation 模式仅支持 claims 身份解析方式'));
        return;
      }
      if (identityMode === 'userinfo') {
        requiredFields.push('user_info_endpoint');
      } else if (acquireMode !== 'ticket_validate') {
        requiredFields.push('issuer');
        if (!currentValues.jwks_url && !currentValues.public_key) {
          showError(t('JWT 直连至少需要配置 JWKS URL 或公钥'));
          return;
        }
      }
      if (
        ['ticket_exchange', 'ticket_validate'].includes(acquireMode) &&
        !currentValues.ticket_exchange_url
      ) {
        showError(t('票据处理模式必须填写 Ticket Processing URL'));
        return;
      }
      if (
        ['ticket_exchange', 'ticket_validate'].includes(acquireMode) &&
        currentValues.ticket_exchange_url &&
        !currentValues.ticket_exchange_url.startsWith('http://') &&
        !currentValues.ticket_exchange_url.startsWith('https://')
      ) {
        showError(t('票据处理模式必须填写有效的 Ticket Processing URL'));
        return;
      }
    } else {
      requiredFields.push('trusted_proxy_cidrs', 'external_id_header');
    }

    for (const field of requiredFields) {
      if (!currentValues[field]) {
        const fieldLabel = REQUIRED_FIELD_LABELS[field] || field;
        showError(
          t('请填写 {{fieldLabel}}', {
            fieldLabel: t(fieldLabel),
          }),
        );
        return;
      }
    }

    const endpointFields =
      providerKind === 'oauth_code'
        ? ['authorization_endpoint', 'token_endpoint', 'user_info_endpoint']
        : providerKind === 'jwt_direct'
          ? [
              'authorization_endpoint',
              ...(currentValues.jwt_identity_mode === 'userinfo'
                ? ['user_info_endpoint']
                : currentValues.jwt_acquire_mode === 'ticket_validate'
                  ? []
                  : ['issuer', 'jwks_url']),
            ]
          : [];
    for (const field of endpointFields) {
      const value = currentValues[field];
      if (
        value &&
        !value.startsWith('http://') &&
        !value.startsWith('https://')
      ) {
        // Check if user selected a preset but forgot to fill issuer URL
        if (providerKind === 'oauth_code' && selectedPreset && !baseUrl) {
          showError(t('请先填写发行者 URL，以自动生成完整的端点 URL'));
        } else {
          showError(
            t('端点 URL 必须是完整地址（以 http:// 或 https:// 开头）'),
          );
        }
        return;
      }
    }

    try {
      const payload = { ...currentValues, enabled: !!currentValues.enabled };
      delete payload.preset;
      delete payload.base_url;
      if (editingProvider) {
        if (clearClientSecret) {
          payload.client_secret = '';
        } else if (!clientSecretDirty || payload.client_secret === '') {
          delete payload.client_secret;
        }
      }
      if (editingProvider) {
        const hiddenJWTSecretFields = [
          'ticket_exchange_extra_params',
          'ticket_exchange_headers',
        ];
        hiddenJWTSecretFields.forEach((field) => {
          if (editingProvider[field] === undefined && payload[field] === '') {
            delete payload[field];
          }
        });
      }
      if (providerKind !== 'jwt_direct') {
        delete payload.jwt_identity_mode;
        delete payload.jwt_acquire_mode;
        delete payload.jwt_source;
        delete payload.jwt_header;
        delete payload.issuer;
        delete payload.audience;
        delete payload.jwks_url;
        delete payload.public_key;
        delete payload.authorization_service_field;
        delete payload.ticket_exchange_url;
        delete payload.ticket_exchange_method;
        delete payload.ticket_exchange_payload_mode;
        delete payload.ticket_exchange_ticket_field;
        delete payload.ticket_exchange_token_field;
        delete payload.ticket_exchange_service_field;
        delete payload.ticket_exchange_extra_params;
        delete payload.ticket_exchange_headers;
        delete payload.user_id_field;
        delete payload.username_field;
        delete payload.display_name_field;
        delete payload.email_field;
      }
      if (providerKind !== 'trusted_header') {
        delete payload.trusted_proxy_cidrs;
        delete payload.external_id_header;
        delete payload.username_header;
        delete payload.display_name_header;
        delete payload.email_header;
        delete payload.group_header;
        delete payload.role_header;
      }
      if (!usesMappedRoleGroup) {
        delete payload.group_field;
        delete payload.role_field;
        delete payload.group_mapping;
        delete payload.role_mapping;
        delete payload.group_mapping_mode;
        delete payload.role_mapping_mode;
        delete payload.sync_username_on_login;
        delete payload.sync_display_name_on_login;
        delete payload.sync_email_on_login;
        delete payload.sync_group_on_login;
        delete payload.sync_role_on_login;
        delete payload.auto_register;
        delete payload.auto_merge_by_email;
      }
      if (providerKind === 'trusted_header') {
        delete payload.auth_style;
        delete payload.access_policy;
        delete payload.access_denied_message;
      }

      if (providerKind !== 'jwt_direct') {
        delete payload.authorization_service_field;
      }

      let res;
      if (editingProvider) {
        res = await API.put(
          `/api/custom-oauth-provider/${editingProvider.id}`,
          payload,
        );
      } else {
        res = await API.post('/api/custom-oauth-provider/', payload);
      }

      if (res.data.success) {
        showSuccess(editingProvider ? t('更新成功') : t('创建成功'));
        closeModal();
        fetchProviders();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(
        error?.response?.data?.message ||
          (editingProvider ? t('更新失败') : t('创建失败')),
      );
    }
  };

  const issuerRules =
    isJWTUserInfoMode || isJWTTicketValidateMode
      ? []
      : [{ required: true, message: t('请输入发行者') }];

  const handleFetchFromDiscovery = async () => {
    const cleanBaseUrl = normalizeBaseUrl(baseUrl);
    const configuredWellKnown = (formValues.well_known || '').trim();
    const wellKnownUrl =
      configuredWellKnown ||
      (cleanBaseUrl ? `${cleanBaseUrl}/.well-known/openid-configuration` : '');

    if (!wellKnownUrl) {
      showError(t('请先填写 Discovery URL 或发行者 URL'));
      return;
    }

    setDiscoveryLoading(true);
    try {
      const res = await API.post('/api/custom-oauth-provider/discovery', {
        well_known_url: configuredWellKnown || '',
        issuer_url: cleanBaseUrl || '',
      });
      if (!res.data.success) {
        throw new Error(res.data.message || t('未知错误'));
      }
      const data = res.data.data?.discovery || {};
      const resolvedWellKnown = res.data.data?.well_known_url || wellKnownUrl;

      const discoveredValues = {
        well_known: resolvedWellKnown,
      };
      const autoFilledFields = [];
      if (data.authorization_endpoint) {
        discoveredValues.authorization_endpoint = data.authorization_endpoint;
        autoFilledFields.push('authorization_endpoint');
      }
      if (data.token_endpoint) {
        discoveredValues.token_endpoint = data.token_endpoint;
        autoFilledFields.push('token_endpoint');
      }
      if (data.userinfo_endpoint) {
        discoveredValues.user_info_endpoint = data.userinfo_endpoint;
        autoFilledFields.push('user_info_endpoint');
      }

      const scopesSupported = Array.isArray(data.scopes_supported)
        ? data.scopes_supported
        : [];
      if (scopesSupported.length > 0 && !formValues.scopes) {
        const preferredScopes = ['openid', 'profile', 'email'].filter((scope) =>
          scopesSupported.includes(scope),
        );
        discoveredValues.scopes =
          preferredScopes.length > 0
            ? preferredScopes.join(' ')
            : scopesSupported.slice(0, 5).join(' ');
        autoFilledFields.push('scopes');
      }

      const claimsSupported = Array.isArray(data.claims_supported)
        ? data.claims_supported
        : [];
      const claimMap = {
        user_id_field: 'sub',
        username_field: 'preferred_username',
        display_name_field: 'name',
        email_field: 'email',
      };
      Object.entries(claimMap).forEach(([field, claim]) => {
        if (!formValues[field] && claimsSupported.includes(claim)) {
          discoveredValues[field] = claim;
          autoFilledFields.push(field);
        }
      });

      const hasCoreEndpoint =
        discoveredValues.authorization_endpoint ||
        discoveredValues.token_endpoint ||
        discoveredValues.user_info_endpoint;
      if (!hasCoreEndpoint) {
        showError(t('未在 Discovery 响应中找到可用的 OAuth 端点'));
        return;
      }

      mergeFormValues(discoveredValues);
      setDiscoveryInfo({
        wellKnown: wellKnownUrl,
        autoFilledFields,
        scopesSupported: scopesSupported.slice(0, 12),
        claimsSupported: claimsSupported.slice(0, 12),
      });
      showSuccess(t('已从 Discovery 自动填充配置'));
    } catch (error) {
      showError(
        t('获取 Discovery 配置失败：') + (error?.message || t('未知错误')),
      );
    } finally {
      setDiscoveryLoading(false);
    }
  };

  const handlePresetChange = (preset) => {
    setSelectedPreset(preset);
    resetDiscoveryState();
    const cleanUrl = normalizeBaseUrl(baseUrl);
    if (!preset || !OAUTH_PRESETS[preset]) {
      mergeFormValues(PRESET_RESET_VALUES);
      return;
    }

    const presetConfig = OAUTH_PRESETS[preset];
    const newValues = {
      ...PRESET_RESET_VALUES,
      name: presetConfig.name,
      slug: preset,
      icon: getPresetIcon(preset),
      scopes: presetConfig.scopes,
      user_id_field: presetConfig.user_id_field,
      username_field: presetConfig.username_field,
      display_name_field: presetConfig.display_name_field,
      email_field: presetConfig.email_field,
      auth_style: presetConfig.auth_style ?? 0,
    };
    if (cleanUrl) {
      newValues.authorization_endpoint =
        cleanUrl + presetConfig.authorization_endpoint;
      newValues.token_endpoint = cleanUrl + presetConfig.token_endpoint;
      newValues.user_info_endpoint = cleanUrl + presetConfig.user_info_endpoint;
    }
    mergeFormValues(newValues);
  };

  const handleBaseUrlChange = (url) => {
    setBaseUrl(url);
    if (url && selectedPreset && OAUTH_PRESETS[selectedPreset]) {
      const presetConfig = OAUTH_PRESETS[selectedPreset];
      const cleanUrl = normalizeBaseUrl(url);
      const newValues = {
        authorization_endpoint: cleanUrl + presetConfig.authorization_endpoint,
        token_endpoint: cleanUrl + presetConfig.token_endpoint,
        user_info_endpoint: cleanUrl + presetConfig.user_info_endpoint,
      };
      mergeFormValues(newValues);
    }
  };

  const applyAccessPolicyTemplate = (templateKey) => {
    const template = ACCESS_POLICY_TEMPLATES[templateKey];
    if (!template) return;
    mergeFormValues({ access_policy: template });
    showSuccess(t('已填充策略模板'));
  };

  const applyDeniedTemplate = (templateKey) => {
    const template = ACCESS_DENIED_TEMPLATES[templateKey];
    if (!template) return;
    mergeFormValues({ access_denied_message: template });
    showSuccess(t('已填充提示模板'));
  };

  const columns = [
    {
      title: t('图标'),
      dataIndex: 'icon',
      key: 'icon',
      width: 80,
      render: (icon) => getOAuthProviderIcon(icon || '', 18),
    },
    {
      title: t('名称'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('类型'),
      dataIndex: 'kind',
      key: 'kind',
      render: (kind) => (
        <Tag
          color={
            kind === 'jwt_direct'
              ? 'blue'
              : kind === 'trusted_header'
                ? 'orange'
                : 'cyan'
          }
        >
          {kind === 'jwt_direct'
            ? t('JWT 直连')
            : kind === 'trusted_header'
              ? t('可信 Header')
              : t('OAuth 授权码')}
        </Tag>
      ),
    },
    {
      title: t('标识符 (Slug)'),
      dataIndex: 'slug',
      key: 'slug',
      render: (slug) => <Tag>{slug}</Tag>,
    },
    {
      title: t('状态'),
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled) => (
        <Tag color={enabled ? 'green' : 'grey'}>
          {enabled ? t('已启用') : t('已禁用')}
        </Tag>
      ),
    },
    {
      title: t('客户端 ID'),
      dataIndex: 'client_id',
      key: 'client_id',
      render: (id) => {
        if (!id) return '-';
        return id.length > 20 ? `${id.substring(0, 20)}...` : id;
      },
    },
    {
      title: t('操作'),
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            icon={<IconEdit />}
            size='small'
            onClick={() => handleEdit(record)}
          >
            {t('编辑')}
          </Button>
          <Popconfirm
            title={t('确定要删除此 OAuth 提供商吗？')}
            onConfirm={() => handleDelete(record.id)}
          >
            <Button icon={<IconDelete />} size='small' type='danger'>
              {t('删除')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const discoveryAutoFilledLabels = (discoveryInfo?.autoFilledFields || [])
    .map((field) => discoveryFieldLabels[field] || field)
    .join(', ');

  return (
    <Card>
      <Form.Section text={t('自定义 OAuth 提供商')}>
        <Banner
          type='info'
          description={
            <>
              {t(
                '配置自定义外部身份提供商，支持 OAuth Code Flow 和 JWT Direct 两种接入模式',
              )}
              <br />
              {t('浏览器回调 URL')}: {serverAddress || t('网站地址')}/oauth/
              {'{slug}'}
              <br />
              {t('说明')}:{' '}
              {t(
                'JWT Direct 支持 direct_token、ticket_exchange、ticket_validate 三种获取模式，并支持 claims 或 userinfo 两类身份解析方式',
              )}
            </>
          }
          style={{ marginBottom: 20 }}
        />

        <Button
          icon={<IconPlus />}
          theme='solid'
          onClick={handleAdd}
          style={{ marginBottom: 16 }}
        >
          {t('添加身份提供商')}
        </Button>

        <Table
          columns={columns}
          dataSource={providers}
          loading={loading}
          rowKey='id'
          pagination={false}
          empty={t('暂无自定义 OAuth 提供商')}
        />

        <Modal
          title={editingProvider ? t('编辑身份提供商') : t('添加身份提供商')}
          visible={modalVisible}
          onCancel={closeModal}
          width={860}
          centered
          bodyStyle={{ maxHeight: '72vh', overflowY: 'auto', paddingRight: 6 }}
          footer={
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <Space spacing={8} align='center'>
                <Text type='secondary'>{t('启用供应商')}</Text>
                <Switch
                  checked={!!formValues.enabled}
                  size='large'
                  onChange={(checked) =>
                    mergeFormValues({ enabled: !!checked })
                  }
                  id='components-settings-customoauthsetting-switch-1'
                />
                <Tag color={formValues.enabled ? 'green' : 'grey'}>
                  {formValues.enabled ? t('已启用') : t('已禁用')}
                </Tag>
              </Space>
              <Button onClick={closeModal}>{t('取消')}</Button>
              <Button type='primary' onClick={handleSubmit}>
                {t('保存')}
              </Button>
            </div>
          }
        >
          <Form
            initValues={formValues}
            onValueChange={() => {
              setFormValues((prev) => ({ ...prev, ...getLatestFormValues() }));
            }}
            getFormApi={(api) => (formApiRef.current = api)}
          >
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              {t('配置')}
            </Text>
            <Text
              type='secondary'
              style={{ display: 'block', marginBottom: 8 }}
            >
              {isJWTTicketExchange
                ? t(
                    '浏览器回调页先接收 ticket，后端再向票据交换接口换取 JWT，并继续复用现有验签、映射、建号和绑定链路',
                  )
                : isJWTTicketValidateMode
                  ? t(
                      '浏览器回调页先接收 ticket，后端再向票据校验接口取回身份声明，直接复用现有字段映射、建号和绑定链路',
                    )
                  : isJWTUserInfoMode
                    ? t(
                        'JWT Direct 使用前端回调页接收 token，再由后端调用用户信息接口验证 token 并提取身份',
                      )
                    : isJWTDirect
                      ? t(
                          'JWT Direct 使用前端回调页接收 JWT，再由后端完成验签、建号、绑定与登录',
                        )
                      : isTrustedHeader
                        ? t(
                            '可信 Header SSO 仅信任来自指定代理网段的请求，并从代理注入的 Header 中提取身份、映射权限并建立本地会话',
                          )
                        : t(
                            '先填写配置，再自动填充 OAuth 端点，能显著减少手工输入',
                          )}
            </Text>
            {isOAuthCode && discoveryInfo && (
              <Banner
                type='success'
                closeIcon={null}
                style={{ marginBottom: 12 }}
                description={
                  <div>
                    <div>
                      {t('已从 Discovery 获取配置，可继续手动修改所有字段。')}
                    </div>
                    {discoveryAutoFilledLabels ? (
                      <div>
                        {t('自动填充字段')}: {discoveryAutoFilledLabels}
                      </div>
                    ) : null}
                    {discoveryInfo.scopesSupported?.length ? (
                      <div>
                        {t('Discovery 建议 scopes')}:{' '}
                        {discoveryInfo.scopesSupported.join(', ')}
                      </div>
                    ) : null}
                    {discoveryInfo.claimsSupported?.length ? (
                      <div>
                        {t('Discovery 建议 claims')}:{' '}
                        {discoveryInfo.claimsSupported.join(', ')}
                      </div>
                    ) : null}
                  </div>
                }
              />
            )}

            <Row gutter={16}>
              <Col span={8}>
                <Form.Select
                  field='kind'
                  label={t('接入类型')}
                  value={currentProviderKind}
                  optionList={customOAuthKindOptions}
                  onChange={(value) => {
                    mergeFormValues({
                      kind: value,
                      jwt_identity_mode:
                        value === 'jwt_direct'
                          ? formValues.jwt_identity_mode || 'claims'
                          : formValues.jwt_identity_mode,
                      jwt_acquire_mode:
                        value === 'jwt_direct'
                          ? formValues.jwt_acquire_mode || 'direct_token'
                          : formValues.jwt_acquire_mode,
                      jwt_source:
                        value === 'jwt_direct'
                          ? formValues.jwt_source || 'query'
                          : formValues.jwt_source,
                    });
                    if (value !== 'oauth_code') {
                      setSelectedPreset('');
                      setBaseUrl('');
                      resetDiscoveryState();
                    }
                  }}
                />
              </Col>
            </Row>

            {isOAuthCode && (
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Select
                    field='preset'
                    label={t('预设模板')}
                    placeholder={t('选择预设模板（可选）')}
                    value={selectedPreset}
                    onChange={handlePresetChange}
                    optionList={[
                      { value: '', label: t('自定义') },
                      ...Object.entries(OAUTH_PRESETS).map(([key, config]) => ({
                        value: key,
                        label: config.name,
                      })),
                    ]}
                  />
                </Col>
                <Col span={10}>
                  <Form.Input
                    field='base_url'
                    label={t('发行者 URL（Issuer URL）')}
                    placeholder={t('例如：https://gitea.example.com')}
                    value={baseUrl}
                    onChange={handleBaseUrlChange}
                    extraText={
                      selectedPreset
                        ? t('填写后会自动拼接预设端点')
                        : t('可选：用于自动生成端点或 Discovery URL')
                    }
                  />
                </Col>
                <Col span={6}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      height: '100%',
                    }}
                  >
                    <Button
                      icon={<IconRefresh />}
                      onClick={handleFetchFromDiscovery}
                      loading={discoveryLoading}
                      block
                    >
                      {t('获取 Discovery 配置')}
                    </Button>
                  </div>
                </Col>
              </Row>
            )}
            {isOAuthCode && (
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Input
                    field='well_known'
                    label={t('发现文档地址（Discovery URL，可选）')}
                    placeholder={t(
                      '例如：https://example.com/.well-known/openid-configuration',
                    )}
                    extraText={t(
                      '可留空；留空时会尝试使用 Issuer URL + /.well-known/openid-configuration',
                    )}
                  />
                </Col>
              </Row>
            )}

            <Row gutter={16}>
              <Col span={12}>
                <Form.Input
                  field='name'
                  label={t('显示名称')}
                  placeholder={t('例如：GitHub Enterprise')}
                  rules={[{ required: true, message: t('请输入显示名称') }]}
                />
              </Col>
              <Col span={12}>
                <Form.Input
                  field='slug'
                  label={t('标识符 (Slug)')}
                  placeholder={t('例如：github-enterprise')}
                  extraText={t('URL 标识，只能包含小写字母、数字和连字符')}
                  rules={[{ required: true, message: t('请输入 Slug') }]}
                />
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={18}>
                <Form.Input
                  field='icon'
                  label={t('图标')}
                  placeholder={t(
                    '例如：github / si:google / https://example.com/logo.png / 🐱',
                  )}
                  extraText={
                    <span>
                      {t(
                        '图标使用 react-icons（Simple Icons）或 URL/emoji，例如：github、gitlab、si:google',
                      )}
                    </span>
                  }
                  showClear
                />
              </Col>
              <Col span={6} style={{ display: 'flex', alignItems: 'flex-end' }}>
                <div
                  style={{
                    width: '100%',
                    minHeight: 74,
                    border: '1px solid var(--semi-color-border)',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 24,
                    background: 'var(--semi-color-fill-0)',
                  }}
                >
                  {getOAuthProviderIcon(formValues.icon || '', 24)}
                </div>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Input
                  field='client_id'
                  label={t('客户端 ID')}
                  placeholder={
                    isJWTDirect
                      ? isJWTTicketExchange
                        ? t('可选：仅部分 JWT 登录方式需要客户端 ID')
                        : t('可选：JWT 前端跳转使用的客户端 ID')
                      : isTrustedHeader
                        ? t('可信 Header 模式不需要客户端 ID')
                        : t('OAuth 客户端 ID')
                  }
                  rules={
                    !isOAuthCode
                      ? []
                      : [{ required: true, message: t('请输入客户端 ID') }]
                  }
                />
              </Col>
              {isOAuthCode && (
                <Col span={12}>
                  <Form.Input
                    field='client_secret'
                    label={t('客户端密钥')}
                    type='password'
                    disabled={clearClientSecret}
                    placeholder={
                      editingProvider
                        ? t('留空则保持原有密钥')
                        : t('OAuth 客户端密钥')
                    }
                    onChange={(value) => {
                      setClientSecretDirty(true);
                      if (value) {
                        setClearClientSecret(false);
                      }
                    }}
                    rules={
                      editingProvider
                        ? []
                        : [
                            {
                              required: true,
                              message: t('请输入客户端密钥'),
                            },
                          ]
                    }
                  />
                  {editingProvider && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: -12,
                        marginBottom: 12,
                      }}
                    >
                      <Switch
                        checked={clearClientSecret}
                        onChange={(checked) => {
                          setClearClientSecret(checked);
                          if (checked) {
                            setClientSecretDirty(true);
                            mergeFormValues({ client_secret: '' });
                            return;
                          }
                          setClientSecretDirty(false);
                          mergeFormValues({ client_secret: '' });
                        }}
                      />
                      <Text type='secondary'>
                        {t('清空已保存的客户端密钥')}
                      </Text>
                    </div>
                  )}
                </Col>
              )}
            </Row>

            <Text strong style={{ display: 'block', margin: '16px 0 8px' }}>
              {isJWTDirect
                ? t('JWT 入口与验签')
                : isTrustedHeader
                  ? t('可信代理与身份头')
                  : t('OAuth 端点')}
            </Text>

            {!isTrustedHeader && (
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Input
                    field='authorization_endpoint'
                    label={
                      isJWTDirect ? t('登录入口 URL（可选）') : t('授权端点')
                    }
                    placeholder={
                      !isJWTDirect &&
                      selectedPreset &&
                      OAUTH_PRESETS[selectedPreset]
                        ? t('填写发行者 URL 后自动生成：') +
                          OAUTH_PRESETS[selectedPreset].authorization_endpoint
                        : isJWTDirect
                          ? 'https://issuer.example.com/oauth2/authorize'
                          : 'https://example.com/oauth/authorize'
                    }
                    extraText={
                      isJWTDirect
                        ? t(
                            '浏览器登录可选；若为空，则该提供商仅能通过后端 JWT 登录接口使用',
                          )
                        : ''
                    }
                    rules={
                      isJWTDirect
                        ? []
                        : [
                            {
                              required: true,
                              message: t('请输入授权端点'),
                            },
                          ]
                    }
                  />
                </Col>
              </Row>
            )}

            {isOAuthCode && (
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Input
                    field='token_endpoint'
                    label={t('令牌端点')}
                    placeholder={
                      selectedPreset && OAUTH_PRESETS[selectedPreset]
                        ? t('自动生成：') +
                          OAUTH_PRESETS[selectedPreset].token_endpoint
                        : 'https://example.com/oauth/token'
                    }
                    rules={[{ required: true, message: t('请输入令牌端点') }]}
                  />
                </Col>
                <Col span={12}>
                  <Form.Input
                    field='user_info_endpoint'
                    label={t('用户信息端点')}
                    placeholder={
                      selectedPreset && OAUTH_PRESETS[selectedPreset]
                        ? t('自动生成：') +
                          OAUTH_PRESETS[selectedPreset].user_info_endpoint
                        : 'https://example.com/api/user'
                    }
                    rules={[
                      {
                        required: true,
                        message: t('请输入用户信息端点'),
                      },
                    ]}
                  />
                </Col>
              </Row>
            )}

            {!isTrustedHeader && (
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Input
                    field='scopes'
                    label={t('Scopes（可选）')}
                    placeholder='openid profile email'
                    extraText={
                      !isJWTDirect && discoveryInfo?.scopesSupported?.length
                        ? t('Discovery 建议 scopes：') +
                          discoveryInfo.scopesSupported.join(', ')
                        : isJWTDirect
                          ? t(
                              'JWT Direct 浏览器跳转默认使用 openid profile email',
                            )
                          : t('可手动填写，多个 scope 用空格分隔')
                    }
                  />
                </Col>
                {isJWTDirect && !isJWTTicketBasedMode && (
                  <Col span={12}>
                    <Form.Select
                      field='jwt_source'
                      label={t('JWT 回传位置')}
                      optionList={jwtSourceOptions}
                      extraText={t(
                        'query / fragment 支持浏览器登录；body 仅供后端接口直连',
                      )}
                    />
                  </Col>
                )}
              </Row>
            )}

            {isJWTDirect && (
              <>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Select
                      field='jwt_identity_mode'
                      label={t('身份解析方式')}
                      optionList={
                        isJWTTicketValidateMode
                          ? jwtIdentityModeOptions.filter(
                              (option) => option.value === 'claims',
                            )
                          : jwtIdentityModeOptions
                      }
                      onChange={(value) => {
                        if (
                          currentJWTAcquireMode === 'ticket_validate' &&
                          value !== 'claims'
                        ) {
                          showError(
                            t(
                              'Ticket Validation 模式仅支持 claims 身份解析方式',
                            ),
                          );
                          mergeFormValues({ jwt_identity_mode: 'claims' });
                          return;
                        }
                        mergeFormValues({ jwt_identity_mode: value });
                      }}
                      extraText={
                        isJWTUserInfoMode
                          ? t(
                              '当前模式下，后端会带 token 调用 User Info Endpoint，以响应 JSON 作为身份字段来源',
                            )
                          : t(
                              '当前模式下，后端会直接验证 JWT 签名并从 claims 中提取身份',
                            )
                      }
                    />
                  </Col>
                  <Col span={12}>
                    <Form.Select
                      field='jwt_acquire_mode'
                      label={t('JWT 获取模式')}
                      optionList={jwtAcquireModeOptions}
                      onChange={(value) => {
                        const nextValues = {
                          jwt_acquire_mode: value,
                          authorization_service_field:
                            formValues.authorization_service_field || 'service',
                          ticket_exchange_method:
                            formValues.ticket_exchange_method || 'GET',
                          ticket_exchange_payload_mode:
                            formValues.ticket_exchange_payload_mode || 'query',
                          ticket_exchange_ticket_field:
                            formValues.ticket_exchange_ticket_field || 'ticket',
                        };
                        if (value === 'ticket_validate') {
                          nextValues.jwt_identity_mode = 'claims';
                          Object.assign(
                            nextValues,
                            applyTicketValidateSuggestions(
                              getLatestFormValues(),
                            ),
                          );
                        }
                        mergeFormValues({
                          ...nextValues,
                        });
                      }}
                      extraText={
                        isJWTTicketExchange
                          ? t(
                              '当前模式下，浏览器回调接收 ticket，后端再调用票据交换接口换取 JWT',
                            )
                          : isJWTTicketValidateMode
                            ? t(
                                '当前模式下，浏览器回调接收 ticket，后端再调用票据校验接口，并直接从响应中提取身份字段',
                              )
                            : t(
                                '当前模式下，浏览器回调页直接接收 JWT 并提交给后端验签',
                              )
                      }
                    />
                  </Col>
                  {isJWTTicketBasedMode && (
                    <Col span={12}>
                      <Form.Input
                        field='authorization_service_field'
                        label={t('授权入口回调参数名')}
                        placeholder='service'
                        extraText={t(
                          '浏览器跳转到认证入口时，回调地址会写入该参数，默认 service',
                        )}
                      />
                    </Col>
                  )}
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Input
                      field='issuer'
                      label={t('发行者')}
                      placeholder='https://issuer.example.com'
                      rules={issuerRules}
                      extraText={
                        isJWTTicketValidateMode
                          ? t('ticket_validate 模式下可留空，不参与本地验签')
                          : ''
                      }
                    />
                  </Col>
                  <Col span={12}>
                    <Form.Input
                      field='audience'
                      label={t('Audience（可选）')}
                      placeholder='new-api'
                    />
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Input
                      field='jwks_url'
                      label={t('JWKS URL（可选）')}
                      placeholder='https://issuer.example.com/.well-known/jwks.json'
                      extraText={
                        isJWTUserInfoMode
                          ? t('userinfo 模式下可留空')
                          : isJWTTicketValidateMode
                            ? t('ticket_validate 模式下可留空，不参与本地验签')
                            : ''
                      }
                    />
                  </Col>
                  <Col span={12}>
                    <Form.Input
                      field='jwt_header'
                      label={t('令牌请求头')}
                      placeholder={
                        isJWTUserInfoMode ? 'x-access-token' : 'Authorization'
                      }
                      extraText={t(
                        'userinfo 模式会用这个 Header 携带 token 请求用户信息接口；若为 Authorization，将自动添加 Bearer 前缀',
                      )}
                    />
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Input
                      field='user_info_endpoint'
                      label={
                        isJWTUserInfoMode
                          ? t('用户信息端点')
                          : t('用户信息端点（可选）')
                      }
                      placeholder='https://example.com/api/userinfo'
                      extraText={
                        isJWTUserInfoMode
                          ? t(
                              '后端会用配置的 Token Header 调用该接口，并把返回 JSON 作为身份字段来源',
                            )
                          : isJWTTicketValidateMode
                            ? t('ticket_validate 模式下不使用该字段，可留空')
                            : t(
                                'claims 模式下通常不需要填写；userinfo 模式下必填',
                              )
                      }
                      rules={
                        isJWTUserInfoMode
                          ? [
                              {
                                required: true,
                                message: t('请输入用户信息端点'),
                              },
                            ]
                          : []
                      }
                    />
                  </Col>
                </Row>

                {isJWTTicketBasedMode && (
                  <>
                    <Text
                      strong
                      style={{ display: 'block', margin: '16px 0 8px' }}
                    >
                      {t('票据处理配置')}
                    </Text>
                    <Text
                      type='secondary'
                      style={{ display: 'block', marginBottom: 8 }}
                    >
                      {isJWTTicketExchange
                        ? t(
                            '配置后端如何把浏览器回调得到的 ticket 换成 JWT。支持 query、form、json、multipart 四种请求方式，以及可选额外参数与请求头',
                          )
                        : t(
                            '配置后端如何把浏览器回调得到的 ticket 发送给校验接口。支持标准 CAS serviceValidate / p3/serviceValidate，也支持直接返回身份 JSON 的校验服务',
                          )}
                    </Text>

                    <Row gutter={16}>
                      <Col span={24}>
                        <Form.Input
                          field='ticket_exchange_url'
                          label={
                            isJWTTicketValidateMode
                              ? t('票据校验 URL')
                              : t('票据交换 URL')
                          }
                          placeholder={
                            isJWTTicketValidateMode
                              ? 'https://cas.example.com/serviceValidate'
                              : 'https://example.com/api/auth/exchange'
                          }
                          extraText={
                            isJWTTicketValidateMode
                              ? t(
                                  '后端将向该地址发起票据校验请求，支持 XML/JSON 响应，并会自动抽取常见 CAS 身份字段',
                                )
                              : t(
                                  '后端将向该地址发起换票请求，要求返回 JWT 或包含 JWT 的 JSON',
                                )
                          }
                        />
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Select
                          field='ticket_exchange_method'
                          label={t('交换请求方法')}
                          optionList={ticketExchangeMethodOptions}
                        />
                      </Col>
                      <Col span={8}>
                        <Form.Select
                          field='ticket_exchange_payload_mode'
                          label={t('交换参数位置')}
                          optionList={ticketExchangePayloadModeOptions}
                        />
                      </Col>
                      <Col span={8}>
                        <Form.Input
                          field='ticket_exchange_ticket_field'
                          label={t('票据字段名')}
                          placeholder='ticket'
                          extraText={t('例如 ticket、st')}
                        />
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      {isJWTTicketExchange && (
                        <Col span={12}>
                          <Form.Input
                            field='ticket_exchange_token_field'
                            label={t('响应中 JWT 字段路径（可选）')}
                            placeholder='data.token'
                            extraText={t(
                              '支持 gjson 路径；留空时会自动尝试 token、access_token、data.token 等常见字段',
                            )}
                          />
                        </Col>
                      )}
                      <Col span={12}>
                        <Form.Input
                          field='ticket_exchange_service_field'
                          label={t('交换接口回调地址字段名（可选）')}
                          placeholder='service'
                          extraText={t(
                            '如果票据处理接口也需要回调地址，可填写字段名，后端会自动注入当前回调 URL',
                          )}
                        />
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.TextArea
                          field='ticket_exchange_extra_params'
                          value={formValues.ticket_exchange_extra_params || ''}
                          onChange={(value) =>
                            mergeFormValues({
                              ticket_exchange_extra_params: value,
                            })
                          }
                          label={t('额外参数 JSON（可选）')}
                          rows={4}
                          placeholder={`{
  "appId": "new-api",
  "channel": "web"
}`}
                          extraText={t(
                            '仅支持 JSON 对象。值中可使用占位符：{ticket} {callback_url} {provider_slug} {state}',
                          )}
                        />
                      </Col>
                      <Col span={12}>
                        <Form.TextArea
                          field='ticket_exchange_headers'
                          value={formValues.ticket_exchange_headers || ''}
                          onChange={(value) =>
                            mergeFormValues({ ticket_exchange_headers: value })
                          }
                          label={t('请求头 JSON（可选）')}
                          rows={4}
                          placeholder={`{
  "X-Provider": "{provider_slug}",
  "X-State": "{state}"
}`}
                          extraText={t(
                            '仅支持 JSON 对象。值中同样支持占位符：{ticket} {callback_url} {provider_slug} {state}',
                          )}
                        />
                      </Col>
                    </Row>
                  </>
                )}

                <Row gutter={16}>
                  <Col span={24}>
                    <Form.TextArea
                      field='public_key'
                      value={formValues.public_key || ''}
                      onChange={(value) =>
                        mergeFormValues({ public_key: value })
                      }
                      label={t('公钥 PEM（可选）')}
                      rows={6}
                      placeholder={`-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtest
-----END PUBLIC KEY-----`}
                      extraText={t(
                        'JWKS URL 与 Public Key 至少配置一项；都配置时优先使用 Public Key',
                      )}
                      showClear
                    />
                  </Col>
                </Row>
              </>
            )}

            {isTrustedHeader && (
              <>
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.TextArea
                      field='trusted_proxy_cidrs'
                      value={formValues.trusted_proxy_cidrs || ''}
                      onChange={(value) =>
                        mergeFormValues({ trusted_proxy_cidrs: value })
                      }
                      label={t('可信代理 CIDR JSON')}
                      rows={4}
                      placeholder={`[
  "10.0.0.0/8",
  "127.0.0.1/32"
]`}
                      extraText={t(
                        '仅信任这些代理来源注入的 Header。支持 CIDR 或单个 IP，格式为 JSON 数组',
                      )}
                    />
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Input
                      field='external_id_header'
                      label={t('外部身份 Header')}
                      placeholder='X-Auth-User-Id'
                      rules={[
                        { required: true, message: t('请输入外部身份 Header') },
                      ]}
                    />
                  </Col>
                  <Col span={12}>
                    <Form.Input
                      field='username_header'
                      label={t('用户名 Header（可选）')}
                      placeholder='X-Auth-Username'
                    />
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Input
                      field='display_name_header'
                      label={t('显示名称 Header（可选）')}
                      placeholder='X-Auth-Display-Name'
                    />
                  </Col>
                  <Col span={12}>
                    <Form.Input
                      field='email_header'
                      label={t('邮箱 Header（可选）')}
                      placeholder='X-Auth-Email'
                    />
                  </Col>
                </Row>
              </>
            )}

            <Text strong style={{ display: 'block', margin: '16px 0 8px' }}>
              {t('字段映射')}
            </Text>
            <Text
              type='secondary'
              style={{ display: 'block', marginBottom: 8 }}
            >
              {isJWTDirect
                ? t('配置如何从 JWT claims 中提取用户数据，支持 gjson 路径语法')
                : isTrustedHeader
                  ? t(
                      '可信 Header 模式直接读取代理注入的 Header，不使用 JSON 路径字段映射',
                    )
                  : t(
                      '配置如何从用户信息 API 响应中提取用户数据，支持 JSONPath 语法',
                    )}
            </Text>

            {!isTrustedHeader && (
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Input
                    field='user_id_field'
                    label={t('用户 ID 字段（可选）')}
                    placeholder={t('例如：sub、id、data.user.id')}
                    extraText={t('用于唯一标识用户的字段路径')}
                  />
                </Col>
                <Col span={12}>
                  <Form.Input
                    field='username_field'
                    label={t('用户名字段（可选）')}
                    placeholder={t('例如：preferred_username、login')}
                  />
                </Col>
              </Row>
            )}

            {!isTrustedHeader && (
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Input
                    field='display_name_field'
                    label={t('显示名称字段（可选）')}
                    placeholder={t('例如：name、full_name')}
                  />
                </Col>
                <Col span={12}>
                  <Form.Input
                    field='email_field'
                    label={t('邮箱字段（可选）')}
                    placeholder={t('例如：email')}
                  />
                </Col>
              </Row>
            )}

            {usesMappedRoleGroup && (
              <>
                <Text strong style={{ display: 'block', margin: '16px 0 8px' }}>
                  {t('权限映射')}
                </Text>
                <Text
                  type='secondary'
                  style={{ display: 'block', marginBottom: 8 }}
                >
                  {t(
                    'group 只会命中系统现有分组；role 仅允许同步到 common 或 admin；guest 和 root 会被拒绝',
                  )}
                </Text>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Input
                      field={isTrustedHeader ? 'group_header' : 'group_field'}
                      label={t('分组字段（可选）')}
                      placeholder={
                        isTrustedHeader
                          ? 'X-Auth-Group'
                          : t('例如：groups、realm_access.roles')
                      }
                    />
                  </Col>
                  <Col span={12}>
                    <Form.Input
                      field={isTrustedHeader ? 'role_header' : 'role_field'}
                      label={t('角色字段（可选）')}
                      placeholder={
                        isTrustedHeader
                          ? 'X-Auth-Role'
                          : t('例如：roles、permissions')
                      }
                    />
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Select
                      field='group_mapping_mode'
                      label={t('分组映射模式')}
                      optionList={jwtMappingModeOptions}
                      extraText={t(
                        '默认仅允许命中显式映射；切到 mapping first 后才会接受现有分组直通',
                      )}
                    />
                  </Col>
                  <Col span={12}>
                    <Form.Select
                      field='role_mapping_mode'
                      label={t('角色映射模式')}
                      optionList={jwtMappingModeOptions}
                      extraText={t(
                        '默认仅允许命中显式映射；切到 mapping first 后才会接受 common/admin 直通',
                      )}
                    />
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.TextArea
                      field='group_mapping'
                      value={formValues.group_mapping || ''}
                      onChange={(value) =>
                        mergeFormValues({ group_mapping: value })
                      }
                      label={t('分组映射 JSON（可选）')}
                      rows={4}
                      placeholder={`{
  "engineering": "vip",
  "support": "default"
}`}
                    />
                  </Col>
                  <Col span={12}>
                    <Form.TextArea
                      field='role_mapping'
                      value={formValues.role_mapping || ''}
                      onChange={(value) =>
                        mergeFormValues({ role_mapping: value })
                      }
                      label={t('角色映射 JSON（可选）')}
                      rows={4}
                      placeholder={`{
  "platform-admin": "admin",
  "member": "user"
}`}
                    />
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Switch
                      field='sync_username_on_login'
                      label={t('登录时同步用户名')}
                    />
                  </Col>
                  <Col span={8}>
                    <Form.Switch
                      field='sync_display_name_on_login'
                      label={t('登录时同步显示名称')}
                    />
                  </Col>
                  <Col span={8}>
                    <Form.Switch
                      field='sync_email_on_login'
                      label={t('登录时同步邮箱')}
                    />
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Switch
                      field='sync_group_on_login'
                      label={t('登录时同步分组')}
                    />
                  </Col>
                  <Col span={12}>
                    <Form.Switch
                      field='sync_role_on_login'
                      label={t('登录时同步角色')}
                    />
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Switch
                      field='auto_register'
                      label={t('允许自动注册')}
                    />
                  </Col>
                  <Col span={12}>
                    <Form.Switch
                      field='auto_merge_by_email'
                      label={t('允许按邮箱自动合并')}
                    />
                  </Col>
                </Row>
              </>
            )}

            {!isTrustedHeader && (
              <Collapse
                keepDOM
                activeKey={advancedActiveKeys}
                style={{ marginTop: 16 }}
                onChange={(activeKey) => {
                  const keys = Array.isArray(activeKey)
                    ? activeKey
                    : [activeKey];
                  setAdvancedActiveKeys(keys.filter(Boolean));
                }}
              >
                <Collapse.Panel header={t('高级选项')} itemKey='advanced'>
                  {isOAuthCode && (
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Select
                          field='auth_style'
                          label={t('认证方式')}
                          optionList={[
                            { value: 0, label: t('自动检测') },
                            { value: 1, label: t('POST 参数') },
                            { value: 2, label: t('Basic Auth 头') },
                          ]}
                        />
                      </Col>
                    </Row>
                  )}

                  <Text
                    strong
                    style={{ display: 'block', margin: '16px 0 8px' }}
                  >
                    {t('准入策略')}
                  </Text>
                  <Text
                    type='secondary'
                    style={{ display: 'block', marginBottom: 8 }}
                  >
                    {t(
                      '可选：基于用户信息 JSON 做组合条件准入，条件不满足时返回自定义提示',
                    )}
                  </Text>
                  <Row gutter={16}>
                    <Col span={24}>
                      <Form.TextArea
                        field='access_policy'
                        value={formValues.access_policy || ''}
                        onChange={(value) =>
                          mergeFormValues({ access_policy: value })
                        }
                        label={t('准入策略 JSON（可选）')}
                        rows={6}
                        placeholder={`{
  "logic": "and",
  "conditions": [
    {"field": "trust_level", "op": "gte", "value": 2},
    {"field": "active", "op": "eq", "value": true}
  ]
}`}
                        extraText={
                          isJWTDirect
                            ? t(
                                '支持基于 JWT claims 做 and/or 组合准入；操作符支持 eq/ne/gt/gte/lt/lte/in/not_in/contains/exists',
                              )
                            : t(
                                '支持逻辑 and/or 与嵌套 groups；操作符支持 eq/ne/gt/gte/lt/lte/in/not_in/contains/exists',
                              )
                        }
                        showClear
                      />
                      <Space spacing={8} style={{ marginTop: 8 }}>
                        <Button
                          size='small'
                          theme='light'
                          onClick={() =>
                            applyAccessPolicyTemplate('level_active')
                          }
                        >
                          {t('填充模板：等级+激活')}
                        </Button>
                        <Button
                          size='small'
                          theme='light'
                          onClick={() =>
                            applyAccessPolicyTemplate('org_or_role')
                          }
                        >
                          {t('填充模板：组织或角色')}
                        </Button>
                      </Space>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={24}>
                      <Form.Input
                        field='access_denied_message'
                        value={formValues.access_denied_message || ''}
                        onChange={(value) =>
                          mergeFormValues({ access_denied_message: value })
                        }
                        label={t('拒绝提示模板（可选）')}
                        placeholder={t(
                          '例如：需要等级 {{required}}，你当前等级 {{current}}',
                        )}
                        extraText={t(
                          '可用变量：{{provider}} {{field}} {{op}} {{required}} {{current}} 以及 {{current.path}}',
                        )}
                        showClear
                      />
                      <Space spacing={8} style={{ marginTop: 8 }}>
                        <Button
                          size='small'
                          theme='light'
                          onClick={() => applyDeniedTemplate('level_hint')}
                        >
                          {t('填充模板：等级提示')}
                        </Button>
                        <Button
                          size='small'
                          theme='light'
                          onClick={() => applyDeniedTemplate('org_hint')}
                        >
                          {t('填充模板：组织提示')}
                        </Button>
                      </Space>
                    </Col>
                  </Row>
                </Collapse.Panel>
              </Collapse>
            )}
          </Form>
        </Modal>
      </Form.Section>
    </Card>
  );
};

export default CustomOAuthSetting;

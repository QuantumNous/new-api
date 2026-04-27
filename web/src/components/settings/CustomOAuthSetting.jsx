/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  Spinner,
  Switch,
  useOverlayState,
} from '@heroui/react';
import {
  CheckCircle2,
  ChevronDown,
  Edit3,
  Info,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  API,
  showError,
  showSuccess,
  getOAuthProviderIcon,
} from '../../helpers';
import ConfirmDialog from '../common/ui/ConfirmDialog';

// ----------------------------- helpers -----------------------------

const inputClass =
  'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:opacity-50';

const textareaClass =
  'w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none transition focus:border-primary';

function FieldLabel({ children, required }) {
  return (
    <label className='block text-sm font-medium text-foreground'>
      {children}
      {required ? <span className='ml-0.5 text-danger'>*</span> : null}
    </label>
  );
}

function FieldHint({ children }) {
  if (!children) return null;
  return <div className='mt-1.5 text-xs text-muted'>{children}</div>;
}

function StatusChip({ tone = 'grey', children }) {
  const TONE = {
    green: 'bg-success/15 text-success',
    grey: 'bg-surface-secondary text-muted',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
        TONE[tone] || TONE.grey
      }`}
    >
      {children}
    </span>
  );
}

function InfoBanner({ tone = 'info', icon, children }) {
  const cls =
    tone === 'success'
      ? 'border-success/30 bg-success/5'
      : 'border-primary/20 bg-primary/5';
  const fallbackIcon =
    tone === 'success' ? (
      <CheckCircle2 size={16} className='text-success' />
    ) : (
      <Info size={16} className='text-primary' />
    );
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border ${cls} px-3 py-2 text-sm text-foreground`}
    >
      <span className='mt-0.5 shrink-0'>{icon || fallbackIcon}</span>
      <div className='flex-1 break-words'>{children}</div>
    </div>
  );
}

// ----------------------------- constants -----------------------------

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

const DISCOVERY_FIELD_LABELS = {
  authorization_endpoint: 'Authorization Endpoint',
  token_endpoint: 'Token Endpoint',
  user_info_endpoint: 'User Info Endpoint',
  scopes: 'Scopes',
  user_id_field: 'User ID Field',
  username_field: 'Username Field',
  display_name_field: 'Display Name Field',
  email_field: 'Email Field',
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
  level_hint: '需要等级 {{required}}，你当前等级 {{current}}（字段：{{field}}）',
  org_hint: '仅限指定组织或角色访问。组织={{current.org}}，角色={{current.roles}}',
};

// ----------------------------- main -----------------------------

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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const modalState = useOverlayState({
    isOpen: modalVisible,
    onOpenChange: (isOpen) => {
      if (!isOpen) closeModal();
    },
  });

  const mergeFormValues = (newValues) => {
    setFormValues((prev) => ({ ...prev, ...newValues }));
  };

  const setField = (field) => (value) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
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

  const resetDiscoveryState = () => setDiscoveryInfo(null);

  function closeModal() {
    setModalVisible(false);
    resetDiscoveryState();
    setAdvancedOpen(false);
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = () => {
    setEditingProvider(null);
    setFormValues({
      enabled: false,
      icon: '',
      scopes: 'openid profile email',
      user_id_field: 'sub',
      username_field: 'preferred_username',
      display_name_field: 'name',
      email_field: 'email',
      auth_style: 0,
      access_policy: '',
      access_denied_message: '',
    });
    setSelectedPreset('');
    setBaseUrl('');
    resetDiscoveryState();
    setAdvancedOpen(false);
    setModalVisible(true);
  };

  const handleEdit = (provider) => {
    setEditingProvider(provider);
    setFormValues({ ...provider });
    setSelectedPreset(OAUTH_PRESETS[provider.slug] ? provider.slug : '');
    setBaseUrl(inferBaseUrlFromProvider(provider));
    resetDiscoveryState();
    setAdvancedOpen(false);
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
    const currentValues = { ...formValues };

    const requiredFields = [
      'name',
      'slug',
      'client_id',
      'authorization_endpoint',
      'token_endpoint',
      'user_info_endpoint',
    ];
    if (!editingProvider) requiredFields.push('client_secret');

    for (const field of requiredFields) {
      if (!currentValues[field]) {
        showError(t(`请填写 ${field}`));
        return;
      }
    }

    const endpointFields = [
      'authorization_endpoint',
      'token_endpoint',
      'user_info_endpoint',
    ];
    for (const field of endpointFields) {
      const value = currentValues[field];
      if (
        value &&
        !value.startsWith('http://') &&
        !value.startsWith('https://')
      ) {
        if (selectedPreset && !baseUrl) {
          showError(t('请先填写 Issuer URL，以自动生成完整的端点 URL'));
        } else {
          showError(t('端点 URL 必须是完整地址（以 http:// 或 https:// 开头）'));
        }
        return;
      }
    }

    try {
      const payload = { ...currentValues, enabled: !!currentValues.enabled };
      delete payload.preset;
      delete payload.base_url;

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

  const handleFetchFromDiscovery = async () => {
    const cleanBaseUrl = normalizeBaseUrl(baseUrl);
    const configuredWellKnown = (formValues.well_known || '').trim();
    const wellKnownUrl =
      configuredWellKnown ||
      (cleanBaseUrl ? `${cleanBaseUrl}/.well-known/openid-configuration` : '');

    if (!wellKnownUrl) {
      showError(t('请先填写 Discovery URL 或 Issuer URL'));
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

      const discoveredValues = { well_known: resolvedWellKnown };
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
        const preferredScopes = ['openid', 'profile', 'email'].filter(
          (scope) => scopesSupported.includes(scope),
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
      newValues.user_info_endpoint =
        cleanUrl + presetConfig.user_info_endpoint;
    }
    mergeFormValues(newValues);
  };

  const handleBaseUrlChange = (url) => {
    setBaseUrl(url);
    if (url && selectedPreset && OAUTH_PRESETS[selectedPreset]) {
      const presetConfig = OAUTH_PRESETS[selectedPreset];
      const cleanUrl = normalizeBaseUrl(url);
      mergeFormValues({
        authorization_endpoint:
          cleanUrl + presetConfig.authorization_endpoint,
        token_endpoint: cleanUrl + presetConfig.token_endpoint,
        user_info_endpoint: cleanUrl + presetConfig.user_info_endpoint,
      });
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

  const discoveryAutoFilledLabels = (discoveryInfo?.autoFilledFields || [])
    .map((field) => DISCOVERY_FIELD_LABELS[field] || field)
    .join(', ');

  // ----------------------------- render -----------------------------

  return (
    <Card>
      <Card.Content className='space-y-4 p-5'>
        <div className='border-b border-border pb-2 text-base font-semibold text-foreground'>
          {t('自定义 OAuth 提供商')}
        </div>

        <InfoBanner>
          {t(
            '配置自定义 OAuth 提供商，支持 GitHub Enterprise、GitLab、Gitea、Nextcloud、Keycloak、ORY 等兼容 OAuth 2.0 协议的身份提供商',
          )}
          <br />
          {t('回调 URL 格式')}: {serverAddress || t('网站地址')}/oauth/
          {'{slug}'}
        </InfoBanner>

        <div>
          <Button
            color='primary'
            startContent={<Plus size={14} />}
            onPress={handleAdd}
          >
            {t('添加 OAuth 提供商')}
          </Button>
        </div>

        {/* 提供商列表 */}
        <div className='relative overflow-x-auto rounded-xl border border-border'>
          {loading && (
            <div className='absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]'>
              <Spinner color='primary' />
            </div>
          )}
          <table className='w-full text-sm'>
            <thead className='bg-surface-secondary text-xs uppercase tracking-wide text-muted'>
              <tr>
                <th className='w-[80px] px-3 py-2 text-left font-medium'>
                  {t('图标')}
                </th>
                <th className='px-3 py-2 text-left font-medium'>
                  {t('名称')}
                </th>
                <th className='px-3 py-2 text-left font-medium'>Slug</th>
                <th className='px-3 py-2 text-left font-medium'>
                  {t('状态')}
                </th>
                <th className='px-3 py-2 text-left font-medium'>
                  {t('Client ID')}
                </th>
                <th className='w-[180px] px-3 py-2 text-left font-medium'>
                  {t('操作')}
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-border'>
              {providers.length === 0 && !loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className='px-4 py-8 text-center text-sm text-muted'
                  >
                    {t('暂无自定义 OAuth 提供商')}
                  </td>
                </tr>
              ) : (
                providers.map((record) => (
                  <tr
                    key={record.id}
                    className='bg-background hover:bg-surface-secondary/60'
                  >
                    <td className='px-3 py-3 align-middle'>
                      {getOAuthProviderIcon(record.icon || '', 18)}
                    </td>
                    <td className='px-3 py-3 align-middle text-foreground'>
                      {record.name}
                    </td>
                    <td className='px-3 py-3 align-middle'>
                      <StatusChip>{record.slug}</StatusChip>
                    </td>
                    <td className='px-3 py-3 align-middle'>
                      <StatusChip tone={record.enabled ? 'green' : 'grey'}>
                        {record.enabled ? t('已启用') : t('已禁用')}
                      </StatusChip>
                    </td>
                    <td className='px-3 py-3 align-middle text-foreground'>
                      {record.client_id
                        ? record.client_id.length > 20
                          ? `${record.client_id.substring(0, 20)}...`
                          : record.client_id
                        : '-'}
                    </td>
                    <td className='px-3 py-3 align-middle'>
                      <div className='flex flex-wrap gap-2'>
                        <Button
                          size='sm'
                          variant='tertiary'
                          startContent={<Edit3 size={14} />}
                          onPress={() => handleEdit(record)}
                        >
                          {t('编辑')}
                        </Button>
                        <Button
                          size='sm'
                          variant='danger-soft'
                          startContent={<Trash2 size={14} />}
                          onPress={() => setDeleteTarget(record)}
                        >
                          {t('删除')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card.Content>

      {/* Add / Edit modal */}
      <Modal state={modalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer
            size='4xl'
            placement='center'
            className='max-w-[95vw]'
          >
            <ModalDialog className='bg-background/95 backdrop-blur'>
              <ModalHeader className='border-b border-border'>
                <span>
                  {editingProvider
                    ? t('编辑 OAuth 提供商')
                    : t('添加 OAuth 提供商')}
                </span>
              </ModalHeader>
              <ModalBody className='max-h-[72vh] space-y-4 overflow-y-auto px-6 py-5'>
                <div className='text-sm font-semibold text-foreground'>
                  {t('Configuration')}
                </div>
                <div className='text-xs text-muted'>
                  {t(
                    '先填写配置，再自动填充 OAuth 端点，能显著减少手工输入',
                  )}
                </div>

                {discoveryInfo && (
                  <InfoBanner tone='success'>
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
                        {t('Discovery scopes')}:{' '}
                        {discoveryInfo.scopesSupported.join(', ')}
                      </div>
                    ) : null}
                    {discoveryInfo.claimsSupported?.length ? (
                      <div>
                        {t('Discovery claims')}:{' '}
                        {discoveryInfo.claimsSupported.join(', ')}
                      </div>
                    ) : null}
                  </InfoBanner>
                )}

                {/* 预设 / Issuer / Discovery */}
                <div className='grid grid-cols-1 gap-4 md:grid-cols-12'>
                  <div className='space-y-2 md:col-span-4'>
                    <FieldLabel>{t('预设模板')}</FieldLabel>
                    <select
                      value={selectedPreset}
                      onChange={(event) =>
                        handlePresetChange(event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value=''>{t('自定义')}</option>
                      {Object.entries(OAUTH_PRESETS).map(([key, config]) => (
                        <option key={key} value={key}>
                          {config.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className='space-y-2 md:col-span-5'>
                    <FieldLabel>
                      {t('发行者 URL（Issuer URL）')}
                    </FieldLabel>
                    <input
                      type='text'
                      value={baseUrl}
                      onChange={(event) =>
                        handleBaseUrlChange(event.target.value)
                      }
                      placeholder={t('例如：https://gitea.example.com')}
                      className={inputClass}
                    />
                    <FieldHint>
                      {selectedPreset
                        ? t('填写后会自动拼接预设端点')
                        : t('可选：用于自动生成端点或 Discovery URL')}
                    </FieldHint>
                  </div>
                  <div className='flex items-end md:col-span-3'>
                    <Button
                      variant='tertiary'
                      startContent={<RefreshCw size={14} />}
                      isPending={discoveryLoading}
                      onPress={handleFetchFromDiscovery}
                      className='w-full'
                    >
                      {t('获取 Discovery 配置')}
                    </Button>
                  </div>
                </div>

                <div className='space-y-2'>
                  <FieldLabel>
                    {t('发现文档地址（Discovery URL，可选）')}
                  </FieldLabel>
                  <input
                    type='text'
                    value={formValues.well_known || ''}
                    onChange={(event) =>
                      setField('well_known')(event.target.value)
                    }
                    placeholder={t(
                      '例如：https://example.com/.well-known/openid-configuration',
                    )}
                    className={inputClass}
                  />
                  <FieldHint>
                    {t(
                      '可留空；留空时会尝试使用 Issuer URL + /.well-known/openid-configuration',
                    )}
                  </FieldHint>
                </div>

                {/* 名称 + Slug */}
                <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                  <div className='space-y-2'>
                    <FieldLabel required>{t('显示名称')}</FieldLabel>
                    <input
                      type='text'
                      value={formValues.name || ''}
                      onChange={(event) =>
                        setField('name')(event.target.value)
                      }
                      placeholder={t('例如：GitHub Enterprise')}
                      className={inputClass}
                    />
                  </div>
                  <div className='space-y-2'>
                    <FieldLabel required>Slug</FieldLabel>
                    <input
                      type='text'
                      value={formValues.slug || ''}
                      onChange={(event) =>
                        setField('slug')(event.target.value)
                      }
                      placeholder={t('例如：github-enterprise')}
                      className={inputClass}
                    />
                    <FieldHint>
                      {t('URL 标识，只能包含小写字母、数字和连字符')}
                    </FieldHint>
                  </div>
                </div>

                {/* 图标 + 预览 */}
                <div className='grid grid-cols-1 gap-4 md:grid-cols-12'>
                  <div className='space-y-2 md:col-span-9'>
                    <FieldLabel>{t('图标')}</FieldLabel>
                    <input
                      type='text'
                      value={formValues.icon || ''}
                      onChange={(event) =>
                        setField('icon')(event.target.value)
                      }
                      placeholder={t(
                        '例如：github / si:google / https://example.com/logo.png / 🐱',
                      )}
                      className={inputClass}
                    />
                    <FieldHint>
                      {t(
                        '图标使用 react-icons（Simple Icons）或 URL/emoji，例如：github、gitlab、si:google',
                      )}
                    </FieldHint>
                  </div>
                  <div className='flex items-end md:col-span-3'>
                    <div className='flex h-[74px] w-full items-center justify-center rounded-lg border border-border bg-surface-secondary'>
                      {getOAuthProviderIcon(formValues.icon || '', 24)}
                    </div>
                  </div>
                </div>

                {/* Client ID + Secret */}
                <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                  <div className='space-y-2'>
                    <FieldLabel required>Client ID</FieldLabel>
                    <input
                      type='text'
                      value={formValues.client_id || ''}
                      onChange={(event) =>
                        setField('client_id')(event.target.value)
                      }
                      placeholder={t('OAuth Client ID')}
                      className={inputClass}
                    />
                  </div>
                  <div className='space-y-2'>
                    <FieldLabel required={!editingProvider}>
                      Client Secret
                    </FieldLabel>
                    <input
                      type='password'
                      value={formValues.client_secret || ''}
                      onChange={(event) =>
                        setField('client_secret')(event.target.value)
                      }
                      placeholder={
                        editingProvider
                          ? t('留空则保持原有密钥')
                          : t('OAuth Client Secret')
                      }
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Endpoints */}
                <div className='text-sm font-semibold text-foreground'>
                  {t('OAuth 端点')}
                </div>
                <div className='space-y-2'>
                  <FieldLabel required>
                    {t('Authorization Endpoint')}
                  </FieldLabel>
                  <input
                    type='text'
                    value={formValues.authorization_endpoint || ''}
                    onChange={(event) =>
                      setField('authorization_endpoint')(event.target.value)
                    }
                    placeholder={
                      selectedPreset && OAUTH_PRESETS[selectedPreset]
                        ? t('填写 Issuer URL 后自动生成：') +
                          OAUTH_PRESETS[selectedPreset].authorization_endpoint
                        : 'https://example.com/oauth/authorize'
                    }
                    className={inputClass}
                  />
                </div>

                <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                  <div className='space-y-2'>
                    <FieldLabel required>{t('Token Endpoint')}</FieldLabel>
                    <input
                      type='text'
                      value={formValues.token_endpoint || ''}
                      onChange={(event) =>
                        setField('token_endpoint')(event.target.value)
                      }
                      placeholder={
                        selectedPreset && OAUTH_PRESETS[selectedPreset]
                          ? t('自动生成：') +
                            OAUTH_PRESETS[selectedPreset].token_endpoint
                          : 'https://example.com/oauth/token'
                      }
                      className={inputClass}
                    />
                  </div>
                  <div className='space-y-2'>
                    <FieldLabel required>
                      {t('User Info Endpoint')}
                    </FieldLabel>
                    <input
                      type='text'
                      value={formValues.user_info_endpoint || ''}
                      onChange={(event) =>
                        setField('user_info_endpoint')(event.target.value)
                      }
                      placeholder={
                        selectedPreset && OAUTH_PRESETS[selectedPreset]
                          ? t('自动生成：') +
                            OAUTH_PRESETS[selectedPreset].user_info_endpoint
                          : 'https://example.com/api/user'
                      }
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                  <div className='space-y-2'>
                    <FieldLabel>{t('Scopes（可选）')}</FieldLabel>
                    <input
                      type='text'
                      value={formValues.scopes || ''}
                      onChange={(event) =>
                        setField('scopes')(event.target.value)
                      }
                      placeholder='openid profile email'
                      className={inputClass}
                    />
                    <FieldHint>
                      {discoveryInfo?.scopesSupported?.length
                        ? t('Discovery 建议 scopes：') +
                          discoveryInfo.scopesSupported.join(', ')
                        : t('可手动填写，多个 scope 用空格分隔')}
                    </FieldHint>
                  </div>
                </div>

                {/* 字段映射 */}
                <div className='text-sm font-semibold text-foreground'>
                  {t('字段映射')}
                </div>
                <div className='text-xs text-muted'>
                  {t(
                    '配置如何从用户信息 API 响应中提取用户数据，支持 JSONPath 语法',
                  )}
                </div>
                <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                  <div className='space-y-2'>
                    <FieldLabel>{t('用户 ID 字段（可选）')}</FieldLabel>
                    <input
                      type='text'
                      value={formValues.user_id_field || ''}
                      onChange={(event) =>
                        setField('user_id_field')(event.target.value)
                      }
                      placeholder={t('例如：sub、id、data.user.id')}
                      className={inputClass}
                    />
                    <FieldHint>{t('用于唯一标识用户的字段路径')}</FieldHint>
                  </div>
                  <div className='space-y-2'>
                    <FieldLabel>{t('用户名字段（可选）')}</FieldLabel>
                    <input
                      type='text'
                      value={formValues.username_field || ''}
                      onChange={(event) =>
                        setField('username_field')(event.target.value)
                      }
                      placeholder={t('例如：preferred_username、login')}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                  <div className='space-y-2'>
                    <FieldLabel>{t('显示名称字段（可选）')}</FieldLabel>
                    <input
                      type='text'
                      value={formValues.display_name_field || ''}
                      onChange={(event) =>
                        setField('display_name_field')(event.target.value)
                      }
                      placeholder={t('例如：name、full_name')}
                      className={inputClass}
                    />
                  </div>
                  <div className='space-y-2'>
                    <FieldLabel>{t('邮箱字段（可选）')}</FieldLabel>
                    <input
                      type='text'
                      value={formValues.email_field || ''}
                      onChange={(event) =>
                        setField('email_field')(event.target.value)
                      }
                      placeholder={t('例如：email')}
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* 高级选项 (collapsible) */}
                <details
                  className='group rounded-xl border border-border bg-background'
                  open={advancedOpen}
                  onToggle={(event) =>
                    setAdvancedOpen(event.currentTarget.open)
                  }
                >
                  <summary className='flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-foreground'>
                    <span>{t('高级选项')}</span>
                    <ChevronDown
                      size={16}
                      className='text-muted transition-transform group-open:rotate-180'
                    />
                  </summary>
                  <div className='space-y-4 border-t border-border px-3 py-3'>
                    <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                      <div className='space-y-2'>
                        <FieldLabel>{t('认证方式')}</FieldLabel>
                        <select
                          value={formValues.auth_style ?? 0}
                          onChange={(event) =>
                            setField('auth_style')(Number(event.target.value))
                          }
                          className={inputClass}
                        >
                          <option value={0}>{t('自动检测')}</option>
                          <option value={1}>{t('POST 参数')}</option>
                          <option value={2}>{t('Basic Auth 头')}</option>
                        </select>
                      </div>
                    </div>

                    <div className='text-sm font-semibold text-foreground'>
                      {t('准入策略')}
                    </div>
                    <div className='text-xs text-muted'>
                      {t(
                        '可选：基于用户信息 JSON 做组合条件准入，条件不满足时返回自定义提示',
                      )}
                    </div>
                    <div className='space-y-2'>
                      <FieldLabel>{t('准入策略 JSON（可选）')}</FieldLabel>
                      <textarea
                        rows={6}
                        value={formValues.access_policy || ''}
                        onChange={(event) =>
                          setField('access_policy')(event.target.value)
                        }
                        placeholder={`{
  "logic": "and",
  "conditions": [
    {"field": "trust_level", "op": "gte", "value": 2},
    {"field": "active", "op": "eq", "value": true}
  ]
}`}
                        className={textareaClass}
                      />
                      <FieldHint>
                        {t(
                          '支持逻辑 and/or 与嵌套 groups；操作符支持 eq/ne/gt/gte/lt/lte/in/not_in/contains/exists',
                        )}
                      </FieldHint>
                      <div className='mt-2 flex flex-wrap gap-2'>
                        <Button
                          size='sm'
                          variant='tertiary'
                          onPress={() =>
                            applyAccessPolicyTemplate('level_active')
                          }
                        >
                          {t('填充模板：等级+激活')}
                        </Button>
                        <Button
                          size='sm'
                          variant='tertiary'
                          onPress={() =>
                            applyAccessPolicyTemplate('org_or_role')
                          }
                        >
                          {t('填充模板：组织或角色')}
                        </Button>
                      </div>
                    </div>

                    <div className='space-y-2'>
                      <FieldLabel>{t('拒绝提示模板（可选）')}</FieldLabel>
                      <input
                        type='text'
                        value={formValues.access_denied_message || ''}
                        onChange={(event) =>
                          setField('access_denied_message')(
                            event.target.value,
                          )
                        }
                        placeholder={t(
                          '例如：需要等级 {{required}}，你当前等级 {{current}}',
                        )}
                        className={inputClass}
                      />
                      <FieldHint>
                        {t(
                          '可用变量：{{provider}} {{field}} {{op}} {{required}} {{current}} 以及 {{current.path}}',
                        )}
                      </FieldHint>
                      <div className='mt-2 flex flex-wrap gap-2'>
                        <Button
                          size='sm'
                          variant='tertiary'
                          onPress={() => applyDeniedTemplate('level_hint')}
                        >
                          {t('填充模板：等级提示')}
                        </Button>
                        <Button
                          size='sm'
                          variant='tertiary'
                          onPress={() => applyDeniedTemplate('org_hint')}
                        >
                          {t('填充模板：组织提示')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </details>
              </ModalBody>
              <ModalFooter className='flex flex-wrap items-center justify-end gap-3 border-t border-border'>
                <div className='flex items-center gap-2'>
                  <span className='text-sm text-muted'>
                    {t('启用供应商')}
                  </span>
                  <Switch
                    isSelected={!!formValues.enabled}
                    onValueChange={(checked) =>
                      mergeFormValues({ enabled: !!checked })
                    }
                    size='md'
                    aria-label={t('启用供应商')}
                  >
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                  <StatusChip tone={formValues.enabled ? 'green' : 'grey'}>
                    {formValues.enabled ? t('已启用') : t('已禁用')}
                  </StatusChip>
                </div>
                <Button variant='tertiary' onPress={closeModal}>
                  {t('取消')}
                </Button>
                <Button color='primary' onPress={handleSubmit}>
                  {t('保存')}
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        visible={!!deleteTarget}
        title={t('确定要删除此 OAuth 提供商吗？')}
        cancelText={t('取消')}
        confirmText={t('确认')}
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          const target = deleteTarget;
          setDeleteTarget(null);
          if (target?.id) await handleDelete(target.id);
        }}
      >
        {deleteTarget?.name
          ? t('删除后无法恢复，确定要删除「{{name}}」吗？', {
              name: deleteTarget.name,
            })
          : t('删除后无法恢复')}
      </ConfirmDialog>
    </Card>
  );
};

export default CustomOAuthSetting;

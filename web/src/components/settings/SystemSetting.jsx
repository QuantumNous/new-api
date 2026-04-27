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

import React, { useEffect, useRef, useState } from 'react';
import { Button, Card, ListBox, Spinner } from '@heroui/react';
import { CellSelect } from '@heroui-pro/react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { ChevronsUpDown, X } from 'lucide-react';
import {
  API,
  removeTrailingSlash,
  showError,
  showSuccess,
  toBoolean,
} from '../../helpers';
import CustomOAuthSetting from './CustomOAuthSetting';
import ConfirmDialog from '../common/ui/ConfirmDialog';

// ----------------------------- helpers -----------------------------

const inputClass =
  'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:opacity-50';

function FieldLabel({ children }) {
  if (!children) return null;
  return (
    <label className='block text-sm font-medium text-foreground'>
      {children}
    </label>
  );
}

function FieldHint({ children }) {
  if (!children) return null;
  return <div className='mt-1.5 text-xs text-muted'>{children}</div>;
}

function SectionHeader({ title }) {
  if (!title) return null;
  return (
    <div className='border-b border-border pb-2 text-base font-semibold text-foreground'>
      {title}
    </div>
  );
}

function InfoBanner({ children }) {
  return (
    <div className='flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground'>
      <span>{children}</span>
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled,
  onKeyDown,
}) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={(event) => onChange?.(event.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      className={inputClass}
    />
  );
}

function Field({ label, hint, required, children }) {
  return (
    <div className='space-y-2'>
      <FieldLabel>
        {label}
        {required ? <span className='ml-0.5 text-danger'>*</span> : null}
      </FieldLabel>
      {children}
      <FieldHint>{hint}</FieldHint>
    </div>
  );
}

function CheckboxRow({ label, hint, value, onChange }) {
  return (
    <div className='flex items-start gap-2'>
      <input
        type='checkbox'
        checked={!!value}
        onChange={(event) => onChange?.(event.target.checked)}
        className='mt-0.5 h-4 w-4 shrink-0 accent-primary'
      />
      <div className='flex-1'>
        <div className='text-sm text-foreground'>{label}</div>
        {hint ? <div className='mt-1 text-xs text-muted'>{hint}</div> : null}
      </div>
    </div>
  );
}

// Tag input: replaces Semi `<TagInput value onChange placeholder>`. Commits
// on Enter / `,` / blur. Supports value-as-array of strings.
function TagInput({ value = [], onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const tags = Array.isArray(value) ? value : [];

  const commit = (raw) => {
    const next = String(raw || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (next.length === 0) return;
    const merged = [...new Set([...tags, ...next])];
    onChange?.(merged);
    setDraft('');
  };

  const removeAt = (idx) => {
    onChange?.(tags.filter((_, i) => i !== idx));
  };

  return (
    <div className='flex min-h-[40px] flex-wrap items-center gap-1.5 rounded-xl border border-border bg-background px-2 py-1.5 text-sm focus-within:border-primary'>
      {tags.map((tag, idx) => (
        <span
          key={`${tag}-${idx}`}
          className='inline-flex items-center gap-1 rounded-full bg-surface-secondary px-2 py-0.5 text-xs'
        >
          <span>{tag}</span>
          <button
            type='button'
            onClick={() => removeAt(idx)}
            aria-label='remove'
            className='text-muted hover:text-foreground'
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        type='text'
        value={draft}
        onChange={(event) => {
          const v = event.target.value;
          if (v.endsWith(',')) commit(v.slice(0, -1));
          else setDraft(v);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit(draft);
          } else if (event.key === 'Backspace' && draft === '' && tags.length > 0) {
            removeAt(tags.length - 1);
          }
        }}
        onBlur={() => {
          if (draft.trim()) commit(draft);
        }}
        placeholder={tags.length === 0 ? placeholder : ''}
        className='flex-1 min-w-[120px] bg-transparent text-foreground outline-none placeholder:text-muted'
      />
    </div>
  );
}

// Segmented (radio-button) control. Replaces Semi `<Radio.Group type='button'>`.
function Segmented({ value, options, onChange }) {
  return (
    <div className='inline-flex overflow-hidden rounded-xl border border-border'>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type='button'
            onClick={() => onChange?.(option.value)}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-foreground text-background'
                : 'bg-background text-muted hover:bg-surface-secondary'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ----------------------------- main -----------------------------

const SystemSetting = () => {
  const { t } = useTranslation();
  const [inputs, setInputs] = useState({
    PasswordLoginEnabled: '',
    PasswordRegisterEnabled: '',
    EmailVerificationEnabled: '',
    GitHubOAuthEnabled: '',
    GitHubClientId: '',
    GitHubClientSecret: '',
    'discord.enabled': '',
    'discord.client_id': '',
    'discord.client_secret': '',
    'oidc.enabled': '',
    'oidc.client_id': '',
    'oidc.client_secret': '',
    'oidc.well_known': '',
    'oidc.authorization_endpoint': '',
    'oidc.token_endpoint': '',
    'oidc.user_info_endpoint': '',
    Notice: '',
    SMTPServer: '',
    SMTPPort: '',
    SMTPAccount: '',
    SMTPFrom: '',
    SMTPToken: '',
    WorkerUrl: '',
    WorkerValidKey: '',
    WorkerAllowHttpImageRequestEnabled: '',
    Footer: '',
    WeChatAuthEnabled: '',
    WeChatServerAddress: '',
    WeChatServerToken: '',
    WeChatAccountQRCodeImageURL: '',
    TurnstileCheckEnabled: '',
    TurnstileSiteKey: '',
    TurnstileSecretKey: '',
    RegisterEnabled: '',
    'passkey.enabled': '',
    'passkey.rp_display_name': '',
    'passkey.rp_id': '',
    'passkey.origins': '',
    'passkey.allow_insecure_origin': '',
    'passkey.user_verification': 'preferred',
    'passkey.attachment_preference': '',
    EmailDomainRestrictionEnabled: '',
    EmailAliasRestrictionEnabled: '',
    SMTPSSLEnabled: '',
    SMTPForceAuthLogin: '',
    EmailDomainWhitelist: [],
    TelegramOAuthEnabled: '',
    TelegramBotToken: '',
    TelegramBotName: '',
    LinuxDOOAuthEnabled: '',
    LinuxDOClientId: '',
    LinuxDOClientSecret: '',
    LinuxDOMinimumTrustLevel: '',
    ServerAddress: '',
    'fetch_setting.enable_ssrf_protection': true,
    'fetch_setting.allow_private_ip': '',
    'fetch_setting.domain_filter_mode': false,
    'fetch_setting.ip_filter_mode': false,
    'fetch_setting.domain_list': [],
    'fetch_setting.ip_list': [],
    'fetch_setting.allowed_ports': [],
    'fetch_setting.apply_ip_filter_for_domain': true,
  });

  const [originInputs, setOriginInputs] = useState({});
  const [loading, setLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [emailDomainWhitelist, setEmailDomainWhitelist] = useState([]);
  const [showPasswordLoginConfirm, setShowPasswordLoginConfirm] =
    useState(false);
  const [emailToAdd, setEmailToAdd] = useState('');
  const [domainFilterMode, setDomainFilterMode] = useState(true);
  const [ipFilterMode, setIpFilterMode] = useState(true);
  const [domainList, setDomainList] = useState([]);
  const [ipList, setIpList] = useState([]);
  const [allowedPorts, setAllowedPorts] = useState([]);
  // Tracks the previous PasswordLoginEnabled value so that cancelling the
  // confirmation modal can revert the checkbox visually.
  const previousPasswordLoginRef = useRef(null);

  const setField = (key) => (value) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const getOptions = async () => {
    setLoading(true);
    const res = await API.get('/api/option/');
    const { success, message, data } = res.data;
    if (success) {
      const newInputs = {};
      data.forEach((item) => {
        switch (item.key) {
          case 'TopupGroupRatio':
            item.value = JSON.stringify(JSON.parse(item.value), null, 2);
            break;
          case 'EmailDomainWhitelist':
            setEmailDomainWhitelist(item.value ? item.value.split(',') : []);
            break;
          case 'fetch_setting.allow_private_ip':
          case 'fetch_setting.enable_ssrf_protection':
          case 'fetch_setting.domain_filter_mode':
          case 'fetch_setting.ip_filter_mode':
          case 'fetch_setting.apply_ip_filter_for_domain':
            item.value = toBoolean(item.value);
            break;
          case 'fetch_setting.domain_list':
            try {
              const domains = item.value ? JSON.parse(item.value) : [];
              setDomainList(Array.isArray(domains) ? domains : []);
            } catch (e) {
              setDomainList([]);
            }
            break;
          case 'fetch_setting.ip_list':
            try {
              const ips = item.value ? JSON.parse(item.value) : [];
              setIpList(Array.isArray(ips) ? ips : []);
            } catch (e) {
              setIpList([]);
            }
            break;
          case 'fetch_setting.allowed_ports':
            try {
              const ports = item.value ? JSON.parse(item.value) : [];
              setAllowedPorts(Array.isArray(ports) ? ports : []);
            } catch (e) {
              setAllowedPorts(['80', '443', '8080', '8443']);
            }
            break;
          case 'PasswordLoginEnabled':
          case 'PasswordRegisterEnabled':
          case 'EmailVerificationEnabled':
          case 'GitHubOAuthEnabled':
          case 'WeChatAuthEnabled':
          case 'TelegramOAuthEnabled':
          case 'RegisterEnabled':
          case 'TurnstileCheckEnabled':
          case 'EmailDomainRestrictionEnabled':
          case 'EmailAliasRestrictionEnabled':
          case 'SMTPSSLEnabled':
          case 'SMTPForceAuthLogin':
          case 'LinuxDOOAuthEnabled':
          case 'discord.enabled':
          case 'oidc.enabled':
          case 'passkey.enabled':
          case 'passkey.allow_insecure_origin':
          case 'WorkerAllowHttpImageRequestEnabled':
            item.value = toBoolean(item.value);
            break;
          case 'passkey.origins':
            item.value = item.value || '';
            break;
          case 'passkey.rp_display_name':
          case 'passkey.rp_id':
          case 'passkey.attachment_preference':
            item.value = item.value || '';
            break;
          case 'passkey.user_verification':
            item.value = item.value || 'preferred';
            break;
          case 'Price':
          case 'MinTopUp':
            item.value = parseFloat(item.value);
            break;
          default:
            break;
        }
        newInputs[item.key] = item.value;
      });
      setInputs((prev) => ({ ...prev, ...newInputs }));
      setOriginInputs(newInputs);
      if (typeof newInputs['fetch_setting.domain_filter_mode'] !== 'undefined') {
        setDomainFilterMode(!!newInputs['fetch_setting.domain_filter_mode']);
      }
      if (typeof newInputs['fetch_setting.ip_filter_mode'] !== 'undefined') {
        setIpFilterMode(!!newInputs['fetch_setting.ip_filter_mode']);
      }
      setIsLoaded(true);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  useEffect(() => {
    getOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateOptions = async (options) => {
    setLoading(true);
    try {
      const checkboxOptions = options.filter((opt) =>
        opt.key.toLowerCase().endsWith('enabled'),
      );
      const otherOptions = options.filter(
        (opt) => !opt.key.toLowerCase().endsWith('enabled'),
      );

      for (const opt of checkboxOptions) {
        const res = await API.put('/api/option/', {
          key: opt.key,
          value: opt.value.toString(),
        });
        if (!res.data.success) {
          showError(res.data.message);
          return;
        }
      }

      if (otherOptions.length > 0) {
        const requestQueue = otherOptions.map((opt) =>
          API.put('/api/option/', {
            key: opt.key,
            value:
              typeof opt.value === 'boolean' ? opt.value.toString() : opt.value,
          }),
        );
        const results = await Promise.all(requestQueue);
        const errorResults = results.filter((res) => !res.data.success);
        errorResults.forEach((res) => showError(res.data.message));
      }

      showSuccess(t('更新成功'));
      setInputs((prev) => {
        const next = { ...prev };
        options.forEach((opt) => {
          next[opt.key] = opt.value;
        });
        return next;
      });
    } catch (error) {
      showError(t('更新失败'));
    }
    setLoading(false);
  };

  // ---------- Submit handlers ----------
  const submitWorker = async () => {
    const workerUrl = removeTrailingSlash(inputs.WorkerUrl);
    const options = [
      { key: 'WorkerUrl', value: workerUrl },
      {
        key: 'WorkerAllowHttpImageRequestEnabled',
        value: inputs.WorkerAllowHttpImageRequestEnabled ? 'true' : 'false',
      },
    ];
    if (inputs.WorkerValidKey !== '' || workerUrl === '') {
      options.push({ key: 'WorkerValidKey', value: inputs.WorkerValidKey });
    }
    await updateOptions(options);
  };

  const submitServerAddress = async () => {
    const serverAddress = removeTrailingSlash(inputs.ServerAddress);
    await updateOptions([{ key: 'ServerAddress', value: serverAddress }]);
  };

  const submitSMTP = async () => {
    const options = [];
    if (originInputs['SMTPServer'] !== inputs.SMTPServer)
      options.push({ key: 'SMTPServer', value: inputs.SMTPServer });
    if (originInputs['SMTPAccount'] !== inputs.SMTPAccount)
      options.push({ key: 'SMTPAccount', value: inputs.SMTPAccount });
    if (originInputs['SMTPFrom'] !== inputs.SMTPFrom)
      options.push({ key: 'SMTPFrom', value: inputs.SMTPFrom });
    if (
      originInputs['SMTPPort'] !== inputs.SMTPPort &&
      inputs.SMTPPort !== ''
    )
      options.push({ key: 'SMTPPort', value: inputs.SMTPPort });
    if (
      originInputs['SMTPToken'] !== inputs.SMTPToken &&
      inputs.SMTPToken !== ''
    )
      options.push({ key: 'SMTPToken', value: inputs.SMTPToken });
    if (options.length > 0) await updateOptions(options);
  };

  const submitEmailDomainWhitelist = async () => {
    if (Array.isArray(emailDomainWhitelist)) {
      await updateOptions([
        {
          key: 'EmailDomainWhitelist',
          value: emailDomainWhitelist.join(','),
        },
      ]);
    } else {
      showError(t('邮箱域名白名单格式不正确'));
    }
  };

  const submitSSRF = async () => {
    const options = [];
    options.push({
      key: 'fetch_setting.domain_filter_mode',
      value: domainFilterMode,
    });
    if (Array.isArray(domainList)) {
      options.push({
        key: 'fetch_setting.domain_list',
        value: JSON.stringify(domainList),
      });
    }
    options.push({
      key: 'fetch_setting.ip_filter_mode',
      value: ipFilterMode,
    });
    if (Array.isArray(ipList)) {
      options.push({
        key: 'fetch_setting.ip_list',
        value: JSON.stringify(ipList),
      });
    }
    if (Array.isArray(allowedPorts)) {
      options.push({
        key: 'fetch_setting.allowed_ports',
        value: JSON.stringify(allowedPorts),
      });
    }
    if (options.length > 0) await updateOptions(options);
  };

  const handleAddEmail = () => {
    if (emailToAdd && emailToAdd.trim() !== '') {
      const domain = emailToAdd.trim();
      const domainRegex =
        /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      if (!domainRegex.test(domain)) {
        showError(t('邮箱域名格式不正确，请输入有效的域名，如 gmail.com'));
        return;
      }
      if (emailDomainWhitelist.includes(domain)) {
        showError(t('该域名已存在于白名单中'));
        return;
      }
      setEmailDomainWhitelist([...emailDomainWhitelist, domain]);
      setEmailToAdd('');
      showSuccess(t('已添加到白名单'));
    }
  };

  const submitWeChat = async () => {
    const options = [];
    if (originInputs['WeChatServerAddress'] !== inputs.WeChatServerAddress) {
      options.push({
        key: 'WeChatServerAddress',
        value: removeTrailingSlash(inputs.WeChatServerAddress),
      });
    }
    if (
      originInputs['WeChatAccountQRCodeImageURL'] !==
      inputs.WeChatAccountQRCodeImageURL
    ) {
      options.push({
        key: 'WeChatAccountQRCodeImageURL',
        value: inputs.WeChatAccountQRCodeImageURL,
      });
    }
    if (
      originInputs['WeChatServerToken'] !== inputs.WeChatServerToken &&
      inputs.WeChatServerToken !== ''
    ) {
      options.push({
        key: 'WeChatServerToken',
        value: inputs.WeChatServerToken,
      });
    }
    if (options.length > 0) await updateOptions(options);
  };

  const submitGitHubOAuth = async () => {
    const options = [];
    if (originInputs['GitHubClientId'] !== inputs.GitHubClientId)
      options.push({ key: 'GitHubClientId', value: inputs.GitHubClientId });
    if (
      originInputs['GitHubClientSecret'] !== inputs.GitHubClientSecret &&
      inputs.GitHubClientSecret !== ''
    ) {
      options.push({
        key: 'GitHubClientSecret',
        value: inputs.GitHubClientSecret,
      });
    }
    if (options.length > 0) await updateOptions(options);
  };

  const submitDiscordOAuth = async () => {
    const options = [];
    if (originInputs['discord.client_id'] !== inputs['discord.client_id']) {
      options.push({
        key: 'discord.client_id',
        value: inputs['discord.client_id'],
      });
    }
    if (
      originInputs['discord.client_secret'] !==
        inputs['discord.client_secret'] &&
      inputs['discord.client_secret'] !== ''
    ) {
      options.push({
        key: 'discord.client_secret',
        value: inputs['discord.client_secret'],
      });
    }
    if (options.length > 0) await updateOptions(options);
  };

  const submitOIDCSettings = async () => {
    if (inputs['oidc.well_known'] && inputs['oidc.well_known'] !== '') {
      if (
        !inputs['oidc.well_known'].startsWith('http://') &&
        !inputs['oidc.well_known'].startsWith('https://')
      ) {
        showError(t('Well-Known URL 必须以 http:// 或 https:// 开头'));
        return;
      }
      try {
        const res = await axios.create().get(inputs['oidc.well_known']);
        setInputs((prev) => ({
          ...prev,
          'oidc.authorization_endpoint': res.data['authorization_endpoint'],
          'oidc.token_endpoint': res.data['token_endpoint'],
          'oidc.user_info_endpoint': res.data['userinfo_endpoint'],
        }));
        showSuccess(t('获取 OIDC 配置成功！'));
      } catch (err) {
        console.error(err);
        showError(
          t('获取 OIDC 配置失败，请检查网络状况和 Well-Known URL 是否正确'),
        );
        return;
      }
    }

    const options = [];
    if (originInputs['oidc.well_known'] !== inputs['oidc.well_known']) {
      options.push({
        key: 'oidc.well_known',
        value: inputs['oidc.well_known'],
      });
    }
    if (originInputs['oidc.client_id'] !== inputs['oidc.client_id']) {
      options.push({
        key: 'oidc.client_id',
        value: inputs['oidc.client_id'],
      });
    }
    if (
      originInputs['oidc.client_secret'] !== inputs['oidc.client_secret'] &&
      inputs['oidc.client_secret'] !== ''
    ) {
      options.push({
        key: 'oidc.client_secret',
        value: inputs['oidc.client_secret'],
      });
    }
    if (
      originInputs['oidc.authorization_endpoint'] !==
      inputs['oidc.authorization_endpoint']
    ) {
      options.push({
        key: 'oidc.authorization_endpoint',
        value: inputs['oidc.authorization_endpoint'],
      });
    }
    if (
      originInputs['oidc.token_endpoint'] !== inputs['oidc.token_endpoint']
    ) {
      options.push({
        key: 'oidc.token_endpoint',
        value: inputs['oidc.token_endpoint'],
      });
    }
    if (
      originInputs['oidc.user_info_endpoint'] !==
      inputs['oidc.user_info_endpoint']
    ) {
      options.push({
        key: 'oidc.user_info_endpoint',
        value: inputs['oidc.user_info_endpoint'],
      });
    }
    if (options.length > 0) await updateOptions(options);
  };

  const submitTelegramSettings = async () => {
    await updateOptions([
      { key: 'TelegramBotToken', value: inputs.TelegramBotToken },
      { key: 'TelegramBotName', value: inputs.TelegramBotName },
    ]);
  };

  const submitTurnstile = async () => {
    const options = [];
    if (originInputs['TurnstileSiteKey'] !== inputs.TurnstileSiteKey)
      options.push({
        key: 'TurnstileSiteKey',
        value: inputs.TurnstileSiteKey,
      });
    if (
      originInputs['TurnstileSecretKey'] !== inputs.TurnstileSecretKey &&
      inputs.TurnstileSecretKey !== ''
    ) {
      options.push({
        key: 'TurnstileSecretKey',
        value: inputs.TurnstileSecretKey,
      });
    }
    if (options.length > 0) await updateOptions(options);
  };

  const submitLinuxDOOAuth = async () => {
    const options = [];
    if (originInputs['LinuxDOClientId'] !== inputs.LinuxDOClientId)
      options.push({ key: 'LinuxDOClientId', value: inputs.LinuxDOClientId });
    if (
      originInputs['LinuxDOClientSecret'] !== inputs.LinuxDOClientSecret &&
      inputs.LinuxDOClientSecret !== ''
    ) {
      options.push({
        key: 'LinuxDOClientSecret',
        value: inputs.LinuxDOClientSecret,
      });
    }
    if (
      originInputs['LinuxDOMinimumTrustLevel'] !==
      inputs.LinuxDOMinimumTrustLevel
    ) {
      options.push({
        key: 'LinuxDOMinimumTrustLevel',
        value: inputs.LinuxDOMinimumTrustLevel,
      });
    }
    if (options.length > 0) await updateOptions(options);
  };

  const submitPasskeySettings = async () => {
    const options = [
      {
        key: 'passkey.rp_display_name',
        value: inputs['passkey.rp_display_name'] || '',
      },
      {
        key: 'passkey.rp_id',
        value: inputs['passkey.rp_id'] || '',
      },
      {
        key: 'passkey.user_verification',
        value: inputs['passkey.user_verification'] || 'preferred',
      },
      {
        key: 'passkey.attachment_preference',
        value: inputs['passkey.attachment_preference'] || '',
      },
      {
        key: 'passkey.origins',
        value: inputs['passkey.origins'] || '',
      },
    ];
    await updateOptions(options);
  };

  const handleCheckboxToggle = (optionKey) => async (value) => {
    if (optionKey === 'PasswordLoginEnabled' && !value) {
      previousPasswordLoginRef.current = inputs.PasswordLoginEnabled;
      setShowPasswordLoginConfirm(true);
      return;
    }
    setField(optionKey)(value);
    await updateOptions([{ key: optionKey, value }]);
  };

  const handlePasswordLoginConfirm = async () => {
    setShowPasswordLoginConfirm(false);
    setField('PasswordLoginEnabled')(false);
    await updateOptions([{ key: 'PasswordLoginEnabled', value: false }]);
  };

  const handlePasswordLoginCancel = () => {
    setShowPasswordLoginConfirm(false);
    setField('PasswordLoginEnabled')(true);
  };

  // ----------------------------- render -----------------------------

  if (!isLoaded) {
    return (
      <div className='flex h-screen items-center justify-center'>
        <Spinner color='primary' />
      </div>
    );
  }

  return (
    <div className='relative flex flex-col gap-3'>
      {loading && (
        <div className='pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/40'>
          <Spinner color='primary' />
        </div>
      )}

      {/* 通用设置 */}
      <Card>
        <Card.Content className='space-y-4 p-5'>
          <SectionHeader title={t('通用设置')} />
          <Field
            label={t('服务器地址')}
            hint={t(
              '该服务器地址将影响支付回调地址以及默认首页展示的地址，请确保正确配置',
            )}
          >
            <TextInput
              value={inputs.ServerAddress}
              onChange={setField('ServerAddress')}
              placeholder='https://yourdomain.com'
            />
          </Field>
          <Button color='primary' onPress={submitServerAddress}>
            {t('更新服务器地址')}
          </Button>
        </Card.Content>
      </Card>

      {/* 代理设置 */}
      <Card>
        <Card.Content className='space-y-4 p-5'>
          <SectionHeader title={t('代理设置')} />
          <InfoBanner>
            {t(
              '此代理仅用于图片请求转发，Webhook通知发送等，AI API请求仍然由服务器直接发出，可在渠道设置中单独配置代理',
            )}
          </InfoBanner>
          <div className='text-sm text-foreground'>
            {t('仅支持')}{' '}
            <a
              href='https://github.com/Calcium-Ion/new-api-worker'
              target='_blank'
              rel='noreferrer'
              className='text-primary hover:underline'
            >
              new-api-worker
            </a>{' '}
            {t('或其兼容new-api-worker格式的其他版本')}
          </div>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <Field label={t('Worker地址')}>
              <TextInput
                value={inputs.WorkerUrl}
                onChange={setField('WorkerUrl')}
                placeholder='例如：https://workername.yourdomain.workers.dev'
              />
            </Field>
            <Field label={t('Worker密钥')}>
              <TextInput
                type='password'
                value={inputs.WorkerValidKey}
                onChange={setField('WorkerValidKey')}
                placeholder='敏感信息不会发送到前端显示'
              />
            </Field>
          </div>
          <CheckboxRow
            label={t('允许 HTTP 协议图片请求（适用于自部署代理）')}
            value={inputs.WorkerAllowHttpImageRequestEnabled}
            onChange={handleCheckboxToggle(
              'WorkerAllowHttpImageRequestEnabled',
            )}
          />
          <Button color='primary' onPress={submitWorker}>
            {t('更新Worker设置')}
          </Button>
        </Card.Content>
      </Card>

      {/* SSRF 防护设置 */}
      <Card>
        <Card.Content className='space-y-4 p-5'>
          <SectionHeader title={t('SSRF防护设置')} />
          <div className='text-sm text-foreground'>
            {t('配置服务器端请求伪造(SSRF)防护，用于保护内网资源安全')}
          </div>
          <div className='space-y-3'>
            <CheckboxRow
              label={t('启用SSRF防护（推荐开启以保护服务器安全）')}
              hint={t('SSRF防护开关详细说明')}
              value={inputs['fetch_setting.enable_ssrf_protection']}
              onChange={handleCheckboxToggle(
                'fetch_setting.enable_ssrf_protection',
              )}
            />
            <CheckboxRow
              label={t(
                '允许访问私有IP地址（127.0.0.1、192.168.x.x等内网地址）',
              )}
              hint={t('私有IP访问详细说明')}
              value={inputs['fetch_setting.allow_private_ip']}
              onChange={handleCheckboxToggle(
                'fetch_setting.allow_private_ip',
              )}
            />
            <CheckboxRow
              label={t('对域名启用 IP 过滤（推荐开启）')}
              hint={t('域名IP过滤详细说明')}
              value={inputs['fetch_setting.apply_ip_filter_for_domain']}
              onChange={handleCheckboxToggle(
                'fetch_setting.apply_ip_filter_for_domain',
              )}
            />
          </div>

          <div className='space-y-2'>
            <div className='text-sm font-semibold text-foreground'>
              {t(domainFilterMode ? '域名白名单' : '域名黑名单')}
            </div>
            <div className='text-xs text-muted'>
              {t('支持通配符格式，如：example.com, *.api.example.com')}
            </div>
            <Segmented
              value={domainFilterMode ? 'whitelist' : 'blacklist'}
              options={[
                { value: 'whitelist', label: t('白名单') },
                { value: 'blacklist', label: t('黑名单') },
              ]}
              onChange={(v) => {
                const isWhitelist = v === 'whitelist';
                setDomainFilterMode(isWhitelist);
                setInputs((prev) => ({
                  ...prev,
                  'fetch_setting.domain_filter_mode': isWhitelist,
                }));
              }}
            />
            <TagInput
              value={domainList}
              onChange={(value) => {
                setDomainList(value);
                setInputs((prev) => ({
                  ...prev,
                  'fetch_setting.domain_list': value,
                }));
              }}
              placeholder={t('输入域名后回车，如：example.com')}
            />
          </div>

          <div className='space-y-2'>
            <div className='text-sm font-semibold text-foreground'>
              {t(ipFilterMode ? 'IP白名单' : 'IP黑名单')}
            </div>
            <div className='text-xs text-muted'>
              {t('支持CIDR格式，如：8.8.8.8, 192.168.1.0/24')}
            </div>
            <Segmented
              value={ipFilterMode ? 'whitelist' : 'blacklist'}
              options={[
                { value: 'whitelist', label: t('白名单') },
                { value: 'blacklist', label: t('黑名单') },
              ]}
              onChange={(v) => {
                const isWhitelist = v === 'whitelist';
                setIpFilterMode(isWhitelist);
                setInputs((prev) => ({
                  ...prev,
                  'fetch_setting.ip_filter_mode': isWhitelist,
                }));
              }}
            />
            <TagInput
              value={ipList}
              onChange={(value) => {
                setIpList(value);
                setInputs((prev) => ({
                  ...prev,
                  'fetch_setting.ip_list': value,
                }));
              }}
              placeholder={t('输入IP地址后回车，如：8.8.8.8')}
            />
          </div>

          <div className='space-y-2'>
            <div className='text-sm font-semibold text-foreground'>
              {t('允许的端口')}
            </div>
            <div className='text-xs text-muted'>
              {t('支持单个端口和端口范围，如：80, 443, 8000-8999')}
            </div>
            <TagInput
              value={allowedPorts}
              onChange={(value) => {
                setAllowedPorts(value);
                setInputs((prev) => ({
                  ...prev,
                  'fetch_setting.allowed_ports': value,
                }));
              }}
              placeholder={t('输入端口后回车，如：80 或 8000-8999')}
            />
            <FieldHint>{t('端口配置详细说明')}</FieldHint>
          </div>

          <Button color='primary' onPress={submitSSRF}>
            {t('更新SSRF防护设置')}
          </Button>
        </Card.Content>
      </Card>

      {/* 配置登录注册 */}
      <Card>
        <Card.Content className='space-y-4 p-5'>
          <SectionHeader title={t('配置登录注册')} />
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <div className='space-y-3'>
              <CheckboxRow
                label={t('允许通过密码进行登录')}
                value={inputs.PasswordLoginEnabled}
                onChange={handleCheckboxToggle('PasswordLoginEnabled')}
              />
              <CheckboxRow
                label={t('允许通过密码进行注册')}
                value={inputs.PasswordRegisterEnabled}
                onChange={handleCheckboxToggle('PasswordRegisterEnabled')}
              />
              <CheckboxRow
                label={t('通过密码注册时需要进行邮箱验证')}
                value={inputs.EmailVerificationEnabled}
                onChange={handleCheckboxToggle('EmailVerificationEnabled')}
              />
              <CheckboxRow
                label={t('允许新用户注册')}
                value={inputs.RegisterEnabled}
                onChange={handleCheckboxToggle('RegisterEnabled')}
              />
              <CheckboxRow
                label={t('允许 Turnstile 用户校验')}
                value={inputs.TurnstileCheckEnabled}
                onChange={handleCheckboxToggle('TurnstileCheckEnabled')}
              />
            </div>
            <div className='space-y-3'>
              <CheckboxRow
                label={t('允许通过 GitHub 账户登录 & 注册')}
                value={inputs.GitHubOAuthEnabled}
                onChange={handleCheckboxToggle('GitHubOAuthEnabled')}
              />
              <CheckboxRow
                label={t('允许通过 Discord 账户登录 & 注册')}
                value={inputs['discord.enabled']}
                onChange={handleCheckboxToggle('discord.enabled')}
              />
              <CheckboxRow
                label={t('允许通过 Linux DO 账户登录 & 注册')}
                value={inputs.LinuxDOOAuthEnabled}
                onChange={handleCheckboxToggle('LinuxDOOAuthEnabled')}
              />
              <CheckboxRow
                label={t('允许通过微信登录 & 注册')}
                value={inputs.WeChatAuthEnabled}
                onChange={handleCheckboxToggle('WeChatAuthEnabled')}
              />
              <CheckboxRow
                label={t('允许通过 Telegram 进行登录')}
                value={inputs.TelegramOAuthEnabled}
                onChange={handleCheckboxToggle('TelegramOAuthEnabled')}
              />
              <CheckboxRow
                label={t('允许通过 OIDC 进行登录')}
                value={inputs['oidc.enabled']}
                onChange={handleCheckboxToggle('oidc.enabled')}
              />
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* 配置 Passkey */}
      <Card>
        <Card.Content className='space-y-4 p-5'>
          <SectionHeader title={t('配置 Passkey')} />
          <div className='text-sm text-foreground'>
            {t('用以支持基于 WebAuthn 的无密码登录注册')}
          </div>
          <InfoBanner>
            {t(
              'Passkey 是基于 WebAuthn 标准的无密码身份验证方法，支持指纹、面容、硬件密钥等认证方式',
            )}
          </InfoBanner>
          <CheckboxRow
            label={t('允许通过 Passkey 登录 & 认证')}
            value={inputs['passkey.enabled']}
            onChange={handleCheckboxToggle('passkey.enabled')}
          />
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <Field
              label={t('服务显示名称')}
              hint={t("用户注册时看到的网站名称，比如'我的网站'")}
            >
              <TextInput
                value={inputs['passkey.rp_display_name']}
                onChange={setField('passkey.rp_display_name')}
                placeholder={t('默认使用系统名称')}
              />
            </Field>
            <Field
              label={t('网站域名标识')}
              hint={t(
                '留空则默认使用服务器地址，注意不能携带http://或者https://',
              )}
            >
              <TextInput
                value={inputs['passkey.rp_id']}
                onChange={setField('passkey.rp_id')}
                placeholder={t('例如：example.com')}
              />
            </Field>
          </div>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            {/* CellSelect inlines the label inside the trigger so the
                surrounding <Field> wrapper would duplicate it — we drop
                Field and keep just the hint via FieldHint below. */}
            <div className='space-y-2'>
              <CellSelect
                aria-label={t('安全验证级别')}
                selectedKey={inputs['passkey.user_verification'] || 'preferred'}
                onSelectionChange={(key) => {
                  if (key)
                    setField('passkey.user_verification')(String(key));
                }}
              >
                <CellSelect.Trigger>
                  <CellSelect.Label>{t('安全验证级别')}</CellSelect.Label>
                  <CellSelect.Value />
                  <CellSelect.Indicator>
                    <ChevronsUpDown size={14} />
                  </CellSelect.Indicator>
                </CellSelect.Trigger>
                <CellSelect.Popover>
                  <ListBox>
                    <ListBox.Item id='preferred' textValue={t('推荐使用（用户可选）')}>
                      {t('推荐使用（用户可选）')}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id='required' textValue={t('强制要求')}>
                      {t('强制要求')}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id='discouraged' textValue={t('不建议使用')}>
                      {t('不建议使用')}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  </ListBox>
                </CellSelect.Popover>
              </CellSelect>
              <FieldHint>
                {t('推荐：用户可以选择是否使用指纹等验证')}
              </FieldHint>
            </div>
            <div className='space-y-2'>
              <CellSelect
                aria-label={t('设备类型偏好')}
                selectedKey={inputs['passkey.attachment_preference'] || 'any'}
                onSelectionChange={(key) => {
                  // Map the synthetic 'any' key back to '' so the existing
                  // backend contract (empty string = no constraint) is
                  // preserved without leaking the synthetic id elsewhere.
                  setField('passkey.attachment_preference')(
                    key === 'any' ? '' : String(key ?? ''),
                  );
                }}
              >
                <CellSelect.Trigger>
                  <CellSelect.Label>{t('设备类型偏好')}</CellSelect.Label>
                  <CellSelect.Value />
                  <CellSelect.Indicator>
                    <ChevronsUpDown size={14} />
                  </CellSelect.Indicator>
                </CellSelect.Trigger>
                <CellSelect.Popover>
                  <ListBox>
                    <ListBox.Item id='any' textValue={t('不限制')}>
                      {t('不限制')}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id='platform' textValue={t('本设备内置')}>
                      {t('本设备内置')}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item
                      id='cross-platform'
                      textValue={t('外接设备')}
                    >
                      {t('外接设备')}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  </ListBox>
                </CellSelect.Popover>
              </CellSelect>
              <FieldHint>
                {t('本设备：手机指纹/面容，外接：USB安全密钥')}
              </FieldHint>
            </div>
          </div>
          <CheckboxRow
            label={t('允许不安全的 Origin（HTTP）')}
            hint={t('仅用于开发环境，生产环境应使用 HTTPS')}
            value={inputs['passkey.allow_insecure_origin']}
            onChange={handleCheckboxToggle('passkey.allow_insecure_origin')}
          />
          <Field
            label={t('允许的 Origins')}
            hint={t(
              '为空则默认使用服务器地址，多个 Origin 用逗号分隔，例如 https://newapi.pro,https://newapi.com ,注意不能携带[]，需使用https',
            )}
          >
            <TextInput
              value={inputs['passkey.origins']}
              onChange={setField('passkey.origins')}
              placeholder={t('填写带https的域名，逗号分隔')}
            />
          </Field>
          <Button color='primary' onPress={submitPasskeySettings}>
            {t('保存 Passkey 设置')}
          </Button>
        </Card.Content>
      </Card>

      {/* 邮箱域名白名单 */}
      <Card>
        <Card.Content className='space-y-4 p-5'>
          <SectionHeader title={t('配置邮箱域名白名单')} />
          <div className='text-sm text-foreground'>
            {t('用以防止恶意用户利用临时邮箱批量注册')}
          </div>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <CheckboxRow
              label='启用邮箱域名白名单'
              value={inputs.EmailDomainRestrictionEnabled}
              onChange={handleCheckboxToggle('EmailDomainRestrictionEnabled')}
            />
            <CheckboxRow
              label='启用邮箱别名限制'
              value={inputs.EmailAliasRestrictionEnabled}
              onChange={handleCheckboxToggle('EmailAliasRestrictionEnabled')}
            />
          </div>
          <TagInput
            value={emailDomainWhitelist}
            onChange={setEmailDomainWhitelist}
            placeholder={t('输入域名后回车')}
          />
          <div className='flex gap-2'>
            <input
              type='text'
              value={emailToAdd}
              onChange={(event) => setEmailToAdd(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleAddEmail();
                }
              }}
              placeholder={t('输入要添加的邮箱域名')}
              className={inputClass}
            />
            <Button color='primary' onPress={handleAddEmail}>
              {t('添加')}
            </Button>
          </div>
          <Button color='primary' onPress={submitEmailDomainWhitelist}>
            {t('保存邮箱域名白名单设置')}
          </Button>
        </Card.Content>
      </Card>

      {/* SMTP */}
      <Card>
        <Card.Content className='space-y-4 p-5'>
          <SectionHeader title={t('配置 SMTP')} />
          <div className='text-sm text-foreground'>
            {t('用以支持系统的邮件发送')}
          </div>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
            <Field label={t('SMTP 服务器地址')}>
              <TextInput
                value={inputs.SMTPServer}
                onChange={setField('SMTPServer')}
              />
            </Field>
            <Field label={t('SMTP 端口')}>
              <TextInput
                value={inputs.SMTPPort}
                onChange={setField('SMTPPort')}
              />
            </Field>
            <Field label={t('SMTP 账户')}>
              <TextInput
                value={inputs.SMTPAccount}
                onChange={setField('SMTPAccount')}
              />
            </Field>
          </div>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
            <Field label={t('SMTP 发送者邮箱')}>
              <TextInput
                value={inputs.SMTPFrom}
                onChange={setField('SMTPFrom')}
              />
            </Field>
            <Field label={t('SMTP 访问凭证')}>
              <TextInput
                type='password'
                value={inputs.SMTPToken}
                onChange={setField('SMTPToken')}
                placeholder='敏感信息不会发送到前端显示'
              />
            </Field>
            <div className='space-y-3'>
              <CheckboxRow
                label={t('启用SMTP SSL')}
                value={inputs.SMTPSSLEnabled}
                onChange={handleCheckboxToggle('SMTPSSLEnabled')}
              />
              <CheckboxRow
                label={t('强制使用 AUTH LOGIN')}
                value={inputs.SMTPForceAuthLogin}
                onChange={handleCheckboxToggle('SMTPForceAuthLogin')}
              />
            </div>
          </div>
          <Button color='primary' onPress={submitSMTP}>
            {t('保存 SMTP 设置')}
          </Button>
        </Card.Content>
      </Card>

      {/* OIDC */}
      <Card>
        <Card.Content className='space-y-4 p-5'>
          <SectionHeader title={t('配置 OIDC')} />
          <div className='text-sm text-foreground'>
            {t(
              '用以支持通过 OIDC 登录，例如 Okta、Auth0 等兼容 OIDC 协议的 IdP',
            )}
          </div>
          <InfoBanner>
            {`${t('主页链接填')} ${
              inputs.ServerAddress ? inputs.ServerAddress : t('网站地址')
            }，${t('重定向 URL 填')} ${
              inputs.ServerAddress ? inputs.ServerAddress : t('网站地址')
            }/oauth/oidc`}
          </InfoBanner>
          <div className='text-sm text-foreground'>
            {t(
              '若你的 OIDC Provider 支持 Discovery Endpoint，你可以仅填写 OIDC Well-Known URL，系统会自动获取 OIDC 配置',
            )}
          </div>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <Field label={t('Well-Known URL')}>
              <TextInput
                value={inputs['oidc.well_known']}
                onChange={setField('oidc.well_known')}
                placeholder={t('请输入 OIDC 的 Well-Known URL')}
              />
            </Field>
            <Field label={t('Client ID')}>
              <TextInput
                value={inputs['oidc.client_id']}
                onChange={setField('oidc.client_id')}
                placeholder={t('输入 OIDC 的 Client ID')}
              />
            </Field>
          </div>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <Field label={t('Client Secret')}>
              <TextInput
                type='password'
                value={inputs['oidc.client_secret']}
                onChange={setField('oidc.client_secret')}
                placeholder={t('敏感信息不会发送到前端显示')}
              />
            </Field>
            <Field label={t('Authorization Endpoint')}>
              <TextInput
                value={inputs['oidc.authorization_endpoint']}
                onChange={setField('oidc.authorization_endpoint')}
                placeholder={t('输入 OIDC 的 Authorization Endpoint')}
              />
            </Field>
          </div>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <Field label={t('Token Endpoint')}>
              <TextInput
                value={inputs['oidc.token_endpoint']}
                onChange={setField('oidc.token_endpoint')}
                placeholder={t('输入 OIDC 的 Token Endpoint')}
              />
            </Field>
            <Field label={t('User Info Endpoint')}>
              <TextInput
                value={inputs['oidc.user_info_endpoint']}
                onChange={setField('oidc.user_info_endpoint')}
                placeholder={t('输入 OIDC 的 Userinfo Endpoint')}
              />
            </Field>
          </div>
          <Button color='primary' onPress={submitOIDCSettings}>
            {t('保存 OIDC 设置')}
          </Button>
        </Card.Content>
      </Card>

      {/* GitHub OAuth */}
      <Card>
        <Card.Content className='space-y-4 p-5'>
          <SectionHeader title={t('配置 GitHub OAuth App')} />
          <div className='text-sm text-foreground'>
            {t('用以支持通过 GitHub 进行登录注册')}
          </div>
          <InfoBanner>
            {`${t('Homepage URL 填')} ${
              inputs.ServerAddress ? inputs.ServerAddress : t('网站地址')
            }，${t('Authorization callback URL 填')} ${
              inputs.ServerAddress ? inputs.ServerAddress : t('网站地址')
            }/oauth/github`}
          </InfoBanner>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <Field label={t('GitHub Client ID')}>
              <TextInput
                value={inputs.GitHubClientId}
                onChange={setField('GitHubClientId')}
              />
            </Field>
            <Field label={t('GitHub Client Secret')}>
              <TextInput
                type='password'
                value={inputs.GitHubClientSecret}
                onChange={setField('GitHubClientSecret')}
                placeholder={t('敏感信息不会发送到前端显示')}
              />
            </Field>
          </div>
          <Button color='primary' onPress={submitGitHubOAuth}>
            {t('保存 GitHub OAuth 设置')}
          </Button>
        </Card.Content>
      </Card>

      {/* Discord OAuth */}
      <Card>
        <Card.Content className='space-y-4 p-5'>
          <SectionHeader title={t('配置 Discord OAuth')} />
          <div className='text-sm text-foreground'>
            {t('用以支持通过 Discord 进行登录注册')}
          </div>
          <InfoBanner>
            {`${t('Homepage URL 填')} ${
              inputs.ServerAddress ? inputs.ServerAddress : t('网站地址')
            }，${t('Authorization callback URL 填')} ${
              inputs.ServerAddress ? inputs.ServerAddress : t('网站地址')
            }/oauth/discord`}
          </InfoBanner>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <Field label={t('Discord Client ID')}>
              <TextInput
                value={inputs['discord.client_id']}
                onChange={setField('discord.client_id')}
              />
            </Field>
            <Field label={t('Discord Client Secret')}>
              <TextInput
                type='password'
                value={inputs['discord.client_secret']}
                onChange={setField('discord.client_secret')}
                placeholder={t('敏感信息不会发送到前端显示')}
              />
            </Field>
          </div>
          <Button color='primary' onPress={submitDiscordOAuth}>
            {t('保存 Discord OAuth 设置')}
          </Button>
        </Card.Content>
      </Card>

      {/* Linux DO */}
      <Card>
        <Card.Content className='space-y-4 p-5'>
          <SectionHeader title={t('配置 Linux DO OAuth')} />
          <div className='text-sm text-foreground'>
            {t('用以支持通过 Linux DO 进行登录注册')}
            <a
              href='https://connect.linux.do/'
              target='_blank'
              rel='noreferrer'
              className='mx-1 text-primary hover:underline'
            >
              {t('点击此处')}
            </a>
            {t('管理你的 LinuxDO OAuth App')}
          </div>
          <InfoBanner>
            {`${t('回调 URL 填')} ${
              inputs.ServerAddress ? inputs.ServerAddress : t('网站地址')
            }/oauth/linuxdo`}
          </InfoBanner>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-12'>
            <div className='space-y-2 md:col-span-5'>
              <FieldLabel>{t('Linux DO Client ID')}</FieldLabel>
              <TextInput
                value={inputs.LinuxDOClientId}
                onChange={setField('LinuxDOClientId')}
                placeholder={t('输入你注册的 LinuxDO OAuth APP 的 ID')}
              />
            </div>
            <div className='space-y-2 md:col-span-5'>
              <FieldLabel>{t('Linux DO Client Secret')}</FieldLabel>
              <TextInput
                type='password'
                value={inputs.LinuxDOClientSecret}
                onChange={setField('LinuxDOClientSecret')}
                placeholder={t('敏感信息不会发送到前端显示')}
              />
            </div>
            <div className='space-y-2 md:col-span-2'>
              <FieldLabel>LinuxDO Minimum Trust Level</FieldLabel>
              <TextInput
                value={inputs.LinuxDOMinimumTrustLevel}
                onChange={setField('LinuxDOMinimumTrustLevel')}
                placeholder='允许注册的最低信任等级'
              />
            </div>
          </div>
          <Button color='primary' onPress={submitLinuxDOOAuth}>
            {t('保存 Linux DO OAuth 设置')}
          </Button>
        </Card.Content>
      </Card>

      {/* 自定义 OAuth */}
      <CustomOAuthSetting serverAddress={inputs.ServerAddress} />

      {/* WeChat Server */}
      <Card>
        <Card.Content className='space-y-4 p-5'>
          <SectionHeader title={t('配置 WeChat Server')} />
          <div className='text-sm text-foreground'>
            {t('用以支持通过微信进行登录注册')}
          </div>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
            <Field label={t('WeChat Server 服务器地址')}>
              <TextInput
                value={inputs.WeChatServerAddress}
                onChange={setField('WeChatServerAddress')}
              />
            </Field>
            <Field label={t('WeChat Server 访问凭证')}>
              <TextInput
                type='password'
                value={inputs.WeChatServerToken}
                onChange={setField('WeChatServerToken')}
                placeholder={t('敏感信息不会发送到前端显示')}
              />
            </Field>
            <Field label={t('微信公众号二维码图片链接')}>
              <TextInput
                value={inputs.WeChatAccountQRCodeImageURL}
                onChange={setField('WeChatAccountQRCodeImageURL')}
              />
            </Field>
          </div>
          <Button color='primary' onPress={submitWeChat}>
            {t('保存 WeChat Server 设置')}
          </Button>
        </Card.Content>
      </Card>

      {/* Telegram */}
      <Card>
        <Card.Content className='space-y-4 p-5'>
          <SectionHeader title={t('配置 Telegram 登录')} />
          <div className='text-sm text-foreground'>
            {t('用以支持通过 Telegram 进行登录注册')}
          </div>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <Field label={t('Telegram Bot Token')}>
              <TextInput
                type='password'
                value={inputs.TelegramBotToken}
                onChange={setField('TelegramBotToken')}
                placeholder={t('敏感信息不会发送到前端显示')}
              />
            </Field>
            <Field label={t('Telegram Bot 名称')}>
              <TextInput
                value={inputs.TelegramBotName}
                onChange={setField('TelegramBotName')}
              />
            </Field>
          </div>
          <Button color='primary' onPress={submitTelegramSettings}>
            {t('保存 Telegram 登录设置')}
          </Button>
        </Card.Content>
      </Card>

      {/* Turnstile */}
      <Card>
        <Card.Content className='space-y-4 p-5'>
          <SectionHeader title={t('配置 Turnstile')} />
          <div className='text-sm text-foreground'>{t('用以支持用户校验')}</div>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <Field label={t('Turnstile Site Key')}>
              <TextInput
                value={inputs.TurnstileSiteKey}
                onChange={setField('TurnstileSiteKey')}
              />
            </Field>
            <Field label={t('Turnstile Secret Key')}>
              <TextInput
                type='password'
                value={inputs.TurnstileSecretKey}
                onChange={setField('TurnstileSecretKey')}
                placeholder={t('敏感信息不会发送到前端显示')}
              />
            </Field>
          </div>
          <Button color='primary' onPress={submitTurnstile}>
            {t('保存 Turnstile 设置')}
          </Button>
        </Card.Content>
      </Card>

      {/* 取消密码登录确认 */}
      <ConfirmDialog
        visible={showPasswordLoginConfirm}
        title={t('确认取消密码登录')}
        cancelText={t('取消')}
        confirmText={t('确认')}
        danger
        onCancel={handlePasswordLoginCancel}
        onConfirm={handlePasswordLoginConfirm}
      >
        {t('您确定要取消密码登录功能吗？这可能会影响用户的登录方式。')}
      </ConfirmDialog>
    </div>
  );
};

export default SystemSetting;

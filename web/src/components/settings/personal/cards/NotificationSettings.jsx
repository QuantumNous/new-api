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

import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Card, Switch, Tabs } from '@heroui/react';
import {
  Bell,
  DollarSign,
  Key,
  Link as LinkIcon,
  Mail,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import {
  renderQuotaWithPrompt,
  API,
  showSuccess,
  showError,
} from '../../../../helpers';
import CodeViewer from '../../../playground/CodeViewer';
import { StatusContext } from '../../../../context/Status';
import { UserContext } from '../../../../context/User';
import { useUserPermissions } from '../../../../hooks/common/useUserPermissions';
import {
  mergeAdminConfig,
  useSidebar,
} from '../../../../hooks/common/useSidebar';

// ----------------------------- helpers -----------------------------

const inputClass =
  'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:opacity-50';

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

function FieldError({ children }) {
  if (!children) return null;
  return <div className='mt-1 text-xs text-danger'>{children}</div>;
}

function SwitchRow({ label, hint, value, onChange }) {
  return (
    <div className='mb-4'>
      <div className='flex items-start justify-between gap-3'>
        <div className='space-y-1'>
          <div className='text-sm font-medium text-foreground'>{label}</div>
          {hint ? <div className='text-xs text-muted'>{hint}</div> : null}
        </div>
        <Switch
          isSelected={!!value}
          onValueChange={onChange}
          size='md'
          aria-label={label}
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>
      </div>
    </div>
  );
}

// PrefixedInput: native `<input>` with an absolute-positioned lucide icon
// prefix (replicates Semi `<Form.Input prefix>`).
function PrefixedInput({
  type = 'text',
  value,
  onChange,
  placeholder,
  prefixIcon,
  list,
  className = '',
}) {
  return (
    <div className='relative'>
      {prefixIcon ? (
        <span className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted'>
          {prefixIcon}
        </span>
      ) : null}
      <input
        type={type}
        value={value ?? ''}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        list={list}
        className={`${inputClass} ${prefixIcon ? 'pl-9' : ''} ${className}`}
      />
    </div>
  );
}

// ----------------------------- main -----------------------------

const NotificationSettings = ({
  t,
  notificationSettings,
  handleNotificationSettingChange,
  saveNotificationSettings,
}) => {
  const [statusState] = useContext(StatusContext);
  const [userState] = useContext(UserContext);
  const isAdminOrRoot = (userState?.user?.role || 0) >= 10;

  const [sidebarLoading, setSidebarLoading] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState('notification');
  const [errors, setErrors] = useState({});
  const [sidebarModulesUser, setSidebarModulesUser] = useState({
    chat: { enabled: true, playground: true, chat: true },
    console: {
      enabled: true,
      detail: true,
      token: true,
      log: true,
      midjourney: true,
      task: true,
    },
    personal: { enabled: true, topup: true, personal: true },
    admin: {
      enabled: true,
      channel: true,
      models: true,
      deployment: true,
      subscription: true,
      redemption: true,
      user: true,
      setting: true,
    },
  });
  const [adminConfig, setAdminConfig] = useState(null);

  const {
    hasSidebarSettingsPermission,
    isSidebarSectionAllowed,
    isSidebarModuleAllowed,
  } = useUserPermissions();

  const { refreshUserConfig } = useSidebar();

  // Sidebar handlers
  const handleSectionChange = (sectionKey) => (checked) => {
    setSidebarModulesUser((prev) => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], enabled: checked },
    }));
  };

  const handleModuleChange = (sectionKey, moduleKey) => (checked) => {
    setSidebarModulesUser((prev) => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], [moduleKey]: checked },
    }));
  };

  const saveSidebarSettings = async () => {
    setSidebarLoading(true);
    try {
      const res = await API.put('/api/user/self', {
        sidebar_modules: JSON.stringify(sidebarModulesUser),
      });
      if (res.data.success) {
        showSuccess(t('侧边栏设置保存成功'));
        await refreshUserConfig();
      } else {
        showError(res.data.message);
      }
    } catch (error) {
      showError(t('保存失败'));
    }
    setSidebarLoading(false);
  };

  const resetSidebarModules = () => {
    setSidebarModulesUser({
      chat: { enabled: true, playground: true, chat: true },
      console: {
        enabled: true,
        detail: true,
        token: true,
        log: true,
        midjourney: true,
        task: true,
      },
      personal: { enabled: true, topup: true, personal: true },
      admin: {
        enabled: true,
        channel: true,
        models: true,
        deployment: true,
        subscription: true,
        redemption: true,
        user: true,
        setting: true,
      },
    });
  };

  useEffect(() => {
    const loadSidebarConfigs = async () => {
      try {
        if (statusState?.status?.SidebarModulesAdmin) {
          try {
            const adminConf = JSON.parse(
              statusState.status.SidebarModulesAdmin,
            );
            setAdminConfig(mergeAdminConfig(adminConf));
          } catch (error) {
            setAdminConfig(mergeAdminConfig(null));
          }
        } else {
          setAdminConfig(mergeAdminConfig(null));
        }

        const userRes = await API.get('/api/user/self');
        if (userRes.data.success && userRes.data.data.sidebar_modules) {
          let userConf;
          if (typeof userRes.data.data.sidebar_modules === 'string') {
            userConf = JSON.parse(userRes.data.data.sidebar_modules);
          } else {
            userConf = userRes.data.data.sidebar_modules;
          }
          setSidebarModulesUser(userConf);
        }
      } catch (error) {
        console.error('加载边栏配置失败:', error);
      }
    };

    loadSidebarConfigs();
  }, [statusState]);

  const setField = (field) => (value) => {
    handleNotificationSettingChange(field, value);
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const isAllowedByAdmin = (sectionKey, moduleKey = null) => {
    if (!adminConfig) return true;
    if (moduleKey) {
      return (
        adminConfig[sectionKey]?.enabled && adminConfig[sectionKey]?.[moduleKey]
      );
    }
    return adminConfig[sectionKey]?.enabled;
  };

  const sectionConfigs = useMemo(
    () =>
      [
        {
          key: 'chat',
          title: t('聊天区域'),
          description: t('操练场和聊天功能'),
          modules: [
            {
              key: 'playground',
              title: t('操练场'),
              description: t('AI模型测试环境'),
            },
            { key: 'chat', title: t('聊天'), description: t('聊天会话管理') },
          ],
        },
        {
          key: 'console',
          title: t('控制台区域'),
          description: t('数据管理和日志查看'),
          modules: [
            {
              key: 'detail',
              title: t('数据看板'),
              description: t('系统数据统计'),
            },
            { key: 'token', title: t('令牌管理'), description: t('API令牌管理') },
            { key: 'log', title: t('使用日志'), description: t('API使用记录') },
            {
              key: 'midjourney',
              title: t('绘图日志'),
              description: t('绘图任务记录'),
            },
            { key: 'task', title: t('任务日志'), description: t('系统任务记录') },
          ],
        },
        {
          key: 'personal',
          title: t('个人中心区域'),
          description: t('用户个人功能'),
          modules: [
            { key: 'topup', title: t('钱包管理'), description: t('余额充值管理') },
            {
              key: 'personal',
              title: t('个人设置'),
              description: t('个人信息设置'),
            },
          ],
        },
        {
          key: 'admin',
          title: t('管理员区域'),
          description: t('系统管理功能'),
          modules: [
            { key: 'channel', title: t('渠道管理'), description: t('API渠道配置') },
            { key: 'models', title: t('模型管理'), description: t('AI模型配置') },
            {
              key: 'deployment',
              title: t('模型部署'),
              description: t('模型部署管理'),
            },
            {
              key: 'subscription',
              title: t('订阅管理'),
              description: t('订阅套餐管理'),
            },
            {
              key: 'redemption',
              title: t('兑换码管理'),
              description: t('兑换码生成管理'),
            },
            { key: 'user', title: t('用户管理'), description: t('用户账户管理') },
            {
              key: 'setting',
              title: t('系统设置'),
              description: t('系统参数配置'),
            },
          ],
        },
      ]
        .filter((section) => isSidebarSectionAllowed(section.key))
        .map((section) => ({
          ...section,
          modules: section.modules.filter((module) =>
            isSidebarModuleAllowed(section.key, module.key),
          ),
        }))
        .filter(
          (section) =>
            section.modules.length > 0 && isAllowedByAdmin(section.key),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [adminConfig, isSidebarSectionAllowed, isSidebarModuleAllowed, t],
  );

  // ---- Validation (replaces Semi `<Form rules>`) ----
  const validate = () => {
    const next = {};
    const settings = notificationSettings || {};

    if (!settings.warningType) {
      next.warningType = t('请选择通知方式');
    }

    const numValue = Number(settings.warningThreshold);
    if (
      settings.warningThreshold === '' ||
      settings.warningThreshold == null
    ) {
      next.warningThreshold = t('请输入预警阈值');
    } else if (Number.isNaN(numValue) || numValue <= 0) {
      next.warningThreshold = t('预警阈值必须为正数');
    }

    if (settings.warningType === 'webhook') {
      if (!settings.webhookUrl) {
        next.webhookUrl = t('请输入Webhook地址');
      } else if (!/^https:\/\/.+/.test(settings.webhookUrl)) {
        next.webhookUrl = t('Webhook地址必须以https://开头');
      }
    }

    if (settings.warningType === 'bark') {
      if (!settings.barkUrl) {
        next.barkUrl = t('请输入Bark推送URL');
      } else if (!/^https?:\/\/.+/.test(settings.barkUrl)) {
        next.barkUrl = t('Bark推送URL必须以http://或https://开头');
      }
    }

    if (settings.warningType === 'gotify') {
      if (!settings.gotifyUrl) {
        next.gotifyUrl = t('请输入Gotify服务器地址');
      } else if (!/^https?:\/\/.+/.test(settings.gotifyUrl)) {
        next.gotifyUrl = t('Gotify服务器地址必须以http://或https://开头');
      }
      if (!settings.gotifyToken) {
        next.gotifyToken = t('请输入Gotify应用令牌');
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) {
      showError(t('请检查表单填写是否正确'));
      return;
    }
    saveNotificationSettings();
  };

  // ---- Constants ----
  const NOTIFICATION_OPTIONS = [
    { value: 'email', label: t('邮件通知') },
    { value: 'webhook', label: t('Webhook通知') },
    { value: 'bark', label: t('Bark通知') },
    { value: 'gotify', label: t('Gotify通知') },
  ];

  const THRESHOLD_PRESETS = [
    { value: 100000, label: '0.2$' },
    { value: 500000, label: '1$' },
    { value: 1000000, label: '2$' },
    { value: 5000000, label: '10$' },
  ];

  const GOTIFY_PRIORITY_PRESETS = [
    { value: 0, label: t('0 - 最低') },
    { value: 2, label: t('2 - 低') },
    { value: 5, label: t('5 - 正常（默认）') },
    { value: 8, label: t('8 - 高') },
    { value: 10, label: t('10 - 最高') },
  ];

  const tabs = [
    { key: 'notification', label: t('通知配置'), icon: <Bell size={16} /> },
    { key: 'pricing', label: t('价格设置'), icon: <DollarSign size={16} /> },
    {
      key: 'privacy',
      label: t('隐私设置'),
      icon: <ShieldCheck size={16} />,
    },
    ...(hasSidebarSettingsPermission()
      ? [
          {
            key: 'sidebar',
            label: t('边栏设置'),
            icon: <Settings size={16} />,
          },
        ]
      : []),
  ];

  return (
    <Card className='!rounded-2xl' shadow='none'>
      <Card.Content className='p-5'>
        {/* Card header */}
        <div className='mb-4 flex items-center gap-3'>
          <Avatar size='sm' className='shadow-md'>
            <Avatar.Fallback className='!bg-primary/10 !text-primary'>
              <Bell size={16} />
            </Avatar.Fallback>
          </Avatar>
          <div className='flex flex-col'>
            <span className='text-base font-semibold text-foreground'>
              {t('其他设置')}
            </span>
            <span className='text-xs text-muted'>
              {t('通知、价格和隐私相关设置')}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          selectedKey={activeTabKey}
          onSelectionChange={(key) => setActiveTabKey(String(key))}
          className='mb-4'
        >
          <Tabs.List aria-label={t('其他设置')}>
            {tabs.map((tab) => (
              <Tabs.Tab key={tab.key} id={tab.key}>
                <span className='flex items-center gap-1.5'>
                  {tab.icon}
                  {tab.label}
                </span>
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>

        {/* Notification config tab */}
        {activeTabKey === 'notification' && (
          <div className='py-2'>
            {/* Notification method segmented control */}
            <div className='mb-4 space-y-2'>
              <FieldLabel required>{t('通知方式')}</FieldLabel>
              <Tabs
                selectedKey={notificationSettings.warningType}
                onSelectionChange={(key) =>
                  setField('warningType')(String(key))
                }
              >
                <Tabs.List aria-label={t('通知方式')}>
                  {NOTIFICATION_OPTIONS.map((option) => (
                    <Tabs.Tab key={option.value} id={option.value}>
                      {option.label}
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs>
              <FieldError>{errors.warningType}</FieldError>
            </div>

            {/* 额度预警阈值 */}
            <div className='mb-4 max-w-[300px] space-y-2'>
              <FieldLabel required>
                <span>
                  {t('额度预警阈值')}{' '}
                  {renderQuotaWithPrompt(
                    notificationSettings.warningThreshold,
                  )}
                </span>
              </FieldLabel>
              <PrefixedInput
                type='number'
                value={notificationSettings.warningThreshold}
                onChange={(value) =>
                  setField('warningThreshold')(value === '' ? '' : Number(value))
                }
                placeholder={t('请输入预警额度')}
                prefixIcon={<Bell size={14} />}
                list='warning-threshold-presets'
              />
              <datalist id='warning-threshold-presets'>
                {THRESHOLD_PRESETS.map((preset) => (
                  <option
                    key={preset.value}
                    value={preset.value}
                    label={preset.label}
                  />
                ))}
              </datalist>
              <FieldError>{errors.warningThreshold}</FieldError>
              <FieldHint>
                {t(
                  '当钱包或订阅剩余额度低于此数值时，系统将通过选择的方式发送通知',
                )}
              </FieldHint>
            </div>

            {isAdminOrRoot && (
              <SwitchRow
                label={t('接收上游模型更新通知')}
                hint={t(
                  '仅管理员可用。开启后，当系统定时检测全部渠道发现上游模型变更或检测异常时，将按你选择的通知方式发送汇总通知；渠道或模型过多时会自动省略部分明细。',
                )}
                value={notificationSettings.upstreamModelUpdateNotifyEnabled}
                onChange={setField('upstreamModelUpdateNotifyEnabled')}
              />
            )}

            {/* 邮件通知设置 */}
            {notificationSettings.warningType === 'email' && (
              <div className='mb-4 space-y-2'>
                <FieldLabel>{t('通知邮箱')}</FieldLabel>
                <PrefixedInput
                  value={notificationSettings.notificationEmail}
                  onChange={setField('notificationEmail')}
                  placeholder={t('留空则使用账号绑定的邮箱')}
                  prefixIcon={<Mail size={14} />}
                />
                <FieldHint>
                  {t(
                    '设置用于接收额度预警的邮箱地址，不填则使用账号绑定的邮箱',
                  )}
                </FieldHint>
              </div>
            )}

            {/* Webhook 通知设置 */}
            {notificationSettings.warningType === 'webhook' && (
              <>
                <div className='mb-4 space-y-2'>
                  <FieldLabel required>{t('Webhook地址')}</FieldLabel>
                  <PrefixedInput
                    value={notificationSettings.webhookUrl}
                    onChange={setField('webhookUrl')}
                    placeholder={t(
                      '请输入Webhook地址，例如: https://example.com/webhook',
                    )}
                    prefixIcon={<LinkIcon size={14} />}
                  />
                  <FieldError>{errors.webhookUrl}</FieldError>
                  <FieldHint>
                    {t(
                      '只支持HTTPS，系统将以POST方式发送通知，请确保地址可以接收POST请求',
                    )}
                  </FieldHint>
                </div>

                <div className='mb-4 space-y-2'>
                  <FieldLabel>{t('接口凭证')}</FieldLabel>
                  <PrefixedInput
                    value={notificationSettings.webhookSecret}
                    onChange={setField('webhookSecret')}
                    placeholder={t('请输入密钥')}
                    prefixIcon={<Key size={14} />}
                  />
                  <FieldHint>
                    {t(
                      '密钥将以Bearer方式添加到请求头中，用于验证webhook请求的合法性',
                    )}
                  </FieldHint>
                </div>

                <div className='mb-4 space-y-2'>
                  <FieldLabel>{t('Webhook请求结构说明')}</FieldLabel>
                  <div>
                    <div className='mb-3 h-[200px]'>
                      <CodeViewer
                        content={{
                          type: 'quota_exceed',
                          title: '额度预警通知',
                          content:
                            '您的额度即将用尽，当前剩余额度为 {{value}}',
                          values: ['$0.99'],
                          timestamp: 1739950503,
                        }}
                        title='webhook'
                        language='json'
                      />
                    </div>
                    <div className='space-y-1 text-xs leading-relaxed text-muted'>
                      <div>
                        <strong>type:</strong>{' '}
                        {t('通知类型 (quota_exceed: 额度预警)')}
                      </div>
                      <div>
                        <strong>title:</strong> {t('通知标题')}
                      </div>
                      <div>
                        <strong>content:</strong>{' '}
                        {t('通知内容，支持 {{value}} 变量占位符')}
                      </div>
                      <div>
                        <strong>values:</strong>{' '}
                        {t('按顺序替换content中的变量占位符')}
                      </div>
                      <div>
                        <strong>timestamp:</strong> {t('Unix时间戳')}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Bark 推送设置 */}
            {notificationSettings.warningType === 'bark' && (
              <>
                <div className='mb-4 space-y-2'>
                  <FieldLabel required>{t('Bark推送URL')}</FieldLabel>
                  <PrefixedInput
                    value={notificationSettings.barkUrl}
                    onChange={setField('barkUrl')}
                    placeholder={t(
                      '请输入Bark推送URL，例如: https://api.day.app/yourkey/{{title}}/{{content}}',
                    )}
                    prefixIcon={<LinkIcon size={14} />}
                  />
                  <FieldError>{errors.barkUrl}</FieldError>
                  <FieldHint>
                    {t(
                      '支持HTTP和HTTPS，模板变量: {{title}} (通知标题), {{content}} (通知内容)',
                    )}
                  </FieldHint>
                </div>

                <div className='mt-3 rounded-xl bg-surface-secondary/50 p-4'>
                  <div className='mb-3 text-sm font-semibold text-foreground'>
                    {t('模板示例')}
                  </div>
                  <div className='mb-4 rounded-lg bg-background p-3 font-mono text-xs text-muted shadow-sm'>
                    https://api.day.app/yourkey/{'{{title}}'}/
                    {'{{content}}'}?sound=alarm&group=quota
                  </div>
                  <div className='space-y-2 text-xs text-muted'>
                    <div>
                      • <strong>{'title'}:</strong> {t('通知标题')}
                    </div>
                    <div>
                      • <strong>{'content'}:</strong> {t('通知内容')}
                    </div>
                    <div className='mt-3 border-t border-border pt-3'>
                      <span className='text-muted'>
                        {t('更多参数请参考')}
                      </span>{' '}
                      <a
                        href='https://github.com/Finb/Bark'
                        target='_blank'
                        rel='noopener noreferrer'
                        className='font-medium text-primary hover:underline'
                      >
                        Bark {t('官方文档')}
                      </a>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Gotify 推送设置 */}
            {notificationSettings.warningType === 'gotify' && (
              <>
                <div className='mb-4 space-y-2'>
                  <FieldLabel required>{t('Gotify服务器地址')}</FieldLabel>
                  <PrefixedInput
                    value={notificationSettings.gotifyUrl}
                    onChange={setField('gotifyUrl')}
                    placeholder={t(
                      '请输入Gotify服务器地址，例如: https://gotify.example.com',
                    )}
                    prefixIcon={<LinkIcon size={14} />}
                  />
                  <FieldError>{errors.gotifyUrl}</FieldError>
                  <FieldHint>
                    {t('支持HTTP和HTTPS，填写Gotify服务器的完整URL地址')}
                  </FieldHint>
                </div>

                <div className='mb-4 space-y-2'>
                  <FieldLabel required>{t('Gotify应用令牌')}</FieldLabel>
                  <PrefixedInput
                    value={notificationSettings.gotifyToken}
                    onChange={setField('gotifyToken')}
                    placeholder={t('请输入Gotify应用令牌')}
                    prefixIcon={<Key size={14} />}
                  />
                  <FieldError>{errors.gotifyToken}</FieldError>
                  <FieldHint>
                    {t(
                      '在Gotify服务器创建应用后获得的令牌，用于发送通知',
                    )}
                  </FieldHint>
                </div>

                <div className='mb-4 max-w-[300px] space-y-2'>
                  <FieldLabel>{t('消息优先级')}</FieldLabel>
                  <div className='relative'>
                    <Bell
                      size={14}
                      className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted'
                    />
                    <select
                      value={notificationSettings.gotifyPriority ?? ''}
                      onChange={(event) => {
                        const raw = event.target.value;
                        setField('gotifyPriority')(
                          raw === '' ? '' : Number(raw),
                        );
                      }}
                      className={`${inputClass} pl-9`}
                    >
                      <option value=''>
                        {t('请选择消息优先级')}
                      </option>
                      {GOTIFY_PRIORITY_PRESETS.map((preset) => (
                        <option key={preset.value} value={preset.value}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <FieldHint>{t('消息优先级，范围0-10，默认为5')}</FieldHint>
                </div>

                <div className='mt-3 rounded-xl bg-surface-secondary/50 p-4'>
                  <div className='mb-3 text-sm font-semibold text-foreground'>
                    {t('配置说明')}
                  </div>
                  <div className='space-y-2 text-xs text-muted'>
                    <div>
                      1. {t('在Gotify服务器的应用管理中创建新应用')}
                    </div>
                    <div>
                      2.{' '}
                      {t(
                        '复制应用的令牌（Token）并填写到上方的应用令牌字段',
                      )}
                    </div>
                    <div>3. {t('填写Gotify服务器的完整URL地址')}</div>
                    <div className='mt-3 border-t border-border pt-3'>
                      <span className='text-muted'>
                        {t('更多信息请参考')}
                      </span>{' '}
                      <a
                        href='https://gotify.net/'
                        target='_blank'
                        rel='noopener noreferrer'
                        className='font-medium text-primary hover:underline'
                      >
                        Gotify {t('官方文档')}
                      </a>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* 价格设置 Tab */}
        {activeTabKey === 'pricing' && (
          <div className='py-2'>
            <SwitchRow
              label={t('接受未设置价格模型')}
              hint={t(
                '当模型没有设置价格时仍接受调用，仅当您信任该网站时使用，可能会产生高额费用',
              )}
              value={notificationSettings.acceptUnsetModelRatioModel}
              onChange={setField('acceptUnsetModelRatioModel')}
            />
          </div>
        )}

        {/* 隐私设置 Tab */}
        {activeTabKey === 'privacy' && (
          <div className='py-2'>
            <SwitchRow
              label={t('记录请求与错误日志IP')}
              hint={t(
                '开启后，仅"消费"和"错误"日志将记录您的客户端IP地址',
              )}
              value={notificationSettings.recordIpLog}
              onChange={setField('recordIpLog')}
            />
          </div>
        )}

        {/* 边栏设置 Tab */}
        {activeTabKey === 'sidebar' && hasSidebarSettingsPermission() && (
          <div className='py-2'>
            <div className='mb-4'>
              <span className='text-xs leading-relaxed text-muted'>
                {t('您可以个性化设置侧边栏的要显示功能')}
              </span>
            </div>
            <div className='rounded-xl border border-border bg-background p-4'>
              {sectionConfigs.map((section) => (
                <div key={section.key} className='mb-6'>
                  {/* 区域标题和总开关 */}
                  <div className='mb-4 flex items-center justify-between rounded-lg border border-border bg-surface-secondary p-4'>
                    <div>
                      <div className='mb-1 text-base font-semibold text-foreground'>
                        {section.title}
                      </div>
                      <span className='text-xs leading-relaxed text-muted'>
                        {section.description}
                      </span>
                    </div>
                    <Switch
                      isSelected={
                        sidebarModulesUser[section.key]?.enabled !== false
                      }
                      onValueChange={handleSectionChange(section.key)}
                      size='md'
                      aria-label={section.title}
                    >
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch>
                  </div>

                  {/* 模块网格 */}
                  <div className='grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3'>
                    {section.modules
                      .filter((module) =>
                        isAllowedByAdmin(section.key, module.key),
                      )
                      .map((module) => {
                        const sectionEnabled =
                          sidebarModulesUser[section.key]?.enabled !== false;
                        return (
                          <Card
                            key={module.key}
                            className={`!rounded-xl border border-border transition-all duration-200 hover:border-primary/40 ${
                              sectionEnabled ? '' : 'opacity-50'
                            }`}
                          >
                            <Card.Content className='p-4'>
                              <div className='flex items-center justify-between'>
                                <div className='flex-1 text-left'>
                                  <div className='mb-1 text-sm font-semibold text-foreground'>
                                    {module.title}
                                  </div>
                                  <span className='block text-xs leading-relaxed text-muted'>
                                    {module.description}
                                  </span>
                                </div>
                                <div className='ml-4'>
                                  <Switch
                                    isSelected={
                                      sidebarModulesUser[section.key]?.[
                                        module.key
                                      ] !== false
                                    }
                                    onValueChange={handleModuleChange(
                                      section.key,
                                      module.key,
                                    )}
                                    size='md'
                                    isDisabled={!sectionEnabled}
                                    aria-label={module.title}
                                  >
                                    <Switch.Control>
                                      <Switch.Thumb />
                                    </Switch.Control>
                                  </Switch>
                                </div>
                              </div>
                            </Card.Content>
                          </Card>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card.Content>

      {/* Footer */}
      <Card.Footer className='flex justify-end gap-3 border-t border-border px-5 py-3'>
        {activeTabKey === 'sidebar' ? (
          <>
            <Button variant='light' onPress={resetSidebarModules}>
              {t('重置为默认')}
            </Button>
            <Button
              color='primary'
              isPending={sidebarLoading}
              onPress={saveSidebarSettings}
            >
              {t('保存设置')}
            </Button>
          </>
        ) : (
          <Button color='primary' onPress={handleSubmit}>
            {t('保存设置')}
          </Button>
        )}
      </Card.Footer>
    </Card>
  );
};

export default NotificationSettings;

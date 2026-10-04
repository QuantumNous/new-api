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

import React from 'react';
import {
  Button,
  Card,
  Input,
  Space,
  Typography,
  Avatar,
  Tabs,
  TabPane,
  Popover,
  Modal,
} from '@douyinfe/semi-ui';
import {
  IconMail,
  IconShield,
  IconGithubLogo,
  IconKey,
  IconLock,
  IconDelete,
  IconEdit,
} from '@douyinfe/semi-icons';
import { SiTelegram, SiWechat, SiLinux, SiDiscord } from 'react-icons/si';
import { FaQq } from 'react-icons/fa';
import { UserPlus, ShieldCheck } from 'lucide-react';
import TelegramLoginButton from 'react-telegram-login';
import {
  API,
  showError,
  showSuccess,
  onGitHubOAuthClicked,
  onSteamOAuthClicked,
  onOIDCClicked,
  onLinuxDOOAuthClicked,
  onDiscordOAuthClicked,
  onQQOAuthClicked,
  onCustomOAuthClicked,
  getOAuthProviderIcon,
} from '../../../../helpers';
import TwoFASetting from '../components/TwoFASetting';
import Turnstile from 'react-turnstile';

const defaultUsernameChangeLimit = 3;

const formatCountdown = (milliseconds, t) => {
  if (milliseconds <= 0) {
    return t('已重置，可再次修改');
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];

  if (days > 0) {
    parts.push(`${days}${t('天')}`);
  }
  if (days > 0 || hours > 0) {
    parts.push(`${hours}${t('小时')}`);
  }
  parts.push(`${minutes}${t('分钟')}`);
  parts.push(`${seconds}${t('秒')}`);
  return parts.join(' ');
};

const AccountManagement = ({
  t,
  userState,
  status,
  systemToken,
  setShowEmailBindModal,
  setShowWeChatBindModal,
  generateAccessToken,
  handleSystemTokenClick,
  setShowChangePasswordModal,
  setShowAccountDeleteModal,
  onUsernameUpdated,
  turnstileEnabled,
  turnstileSiteKey,
  turnstileToken,
  setTurnstileToken,
  passkeyStatus,
  passkeySupported,
  passkeyRegisterLoading,
  passkeyDeleteLoading,
  onPasskeyRegister,
  onPasskeyDelete,
}) => {
  const renderAccountInfo = (accountId, label) => {
    if (!accountId || accountId === '') {
      return <span className='text-gray-500'>{t('未绑定')}</span>;
    }

    const popContent = (
      <div className='text-xs p-2'>
        <Typography.Paragraph copyable={{ content: accountId }}>
          {accountId}
        </Typography.Paragraph>
        {label ? (
          <div className='mt-1 text-[11px] text-gray-500'>{label}</div>
        ) : null}
      </div>
    );

    return (
      <Popover content={popContent} position='top' trigger='hover'>
        <span className='block max-w-full truncate text-gray-600 hover:text-blue-600 cursor-pointer'>
          {accountId}
        </span>
      </Popover>
    );
  };
  const isBound = (accountId) => Boolean(accountId);
  const isOAuthEnabled = (value) =>
    value === true || value === 'true' || value === 1 || value === '1';
  const [showTelegramBindModal, setShowTelegramBindModal] =
    React.useState(false);
  const [customOAuthBindings, setCustomOAuthBindings] = React.useState([]);
  const [customOAuthLoading, setCustomOAuthLoading] = React.useState({});
  const [showUsernameModal, setShowUsernameModal] = React.useState(false);
  const [newUsername, setNewUsername] = React.useState('');
  const [usernameSaving, setUsernameSaving] = React.useState(false);
  const [countdownNow, setCountdownNow] = React.useState(Date.now());

  const currentUsername = userState?.user?.username || '';
  const usernameChangeLimit =
    userState?.user?.username_change_limit || defaultUsernameChangeLimit;
  const usernameChangeCount = userState?.user?.username_change_count || 0;
  const usernameChangeRemaining =
    userState?.user?.username_change_remaining ?? usernameChangeLimit;
  const usernameChangeResetAt = userState?.user?.username_change_reset_at || 0;
  const usernameWindowStarted =
    usernameChangeCount > 0 && usernameChangeResetAt > 0;
  const usernameResetCountdown = usernameWindowStarted
    ? formatCountdown(usernameChangeResetAt * 1000 - countdownNow, t)
    : t('首次修改后开始 1 年倒计时');
  const usernameQuotaExhausted =
    usernameWindowStarted && usernameChangeRemaining <= 0;
  const usernameStatusText = usernameWindowStarted
    ? t('一年内最多 {{limit}} 次，已使用 {{count}} 次，剩余 {{remaining}} 次', {
        limit: usernameChangeLimit,
        count: usernameChangeCount,
        remaining: usernameChangeRemaining,
      })
    : t('一年内最多 {{limit}} 次，首次修改后开始计时', {
        limit: usernameChangeLimit,
      });
  const usernameResetText = usernameWindowStarted
    ? t('距离次数重置还有 {{countdown}}', {
        countdown: usernameResetCountdown,
      })
    : t('首次修改后开始 1 年倒计时');

  React.useEffect(() => {
    if (!usernameWindowStarted) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setCountdownNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [usernameWindowStarted]);

  React.useEffect(() => {
    setCountdownNow(Date.now());
  }, [usernameChangeResetAt]);

  const buildSelfUpdateUrl = () =>
    turnstileToken
      ? `/api/user/self?turnstile=${encodeURIComponent(turnstileToken)}`
      : '/api/user/self';

  const openUsernameModal = () => {
    setNewUsername(currentUsername);
    if (turnstileEnabled) {
      setTurnstileToken('');
    }
    setShowUsernameModal(true);
  };

  const closeUsernameModal = () => {
    if (usernameSaving) {
      return;
    }
    setShowUsernameModal(false);
    setNewUsername('');
    if (turnstileEnabled) {
      setTurnstileToken('');
    }
  };

  const saveUsername = async () => {
    const trimmed = newUsername.trim();
    if (!trimmed) {
      showError(t('用户名不能为空'));
      return;
    }
    if (trimmed.length > 20) {
      showError(t('用户名长度不能超过20个字符'));
      return;
    }
    if (trimmed === currentUsername) {
      closeUsernameModal();
      return;
    }
    if (usernameQuotaExhausted) {
      showError(t('用户名修改次数已用完，请等待倒计时结束后再试'));
      return;
    }

    setUsernameSaving(true);
    try {
      const res = await API.put(buildSelfUpdateUrl(), { username: trimmed });
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('用户名修改成功'));
        closeUsernameModal();
        if (onUsernameUpdated) {
          await onUsernameUpdated();
        }
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('操作失败，请重试'));
    } finally {
      setUsernameSaving(false);
    }
  };

  // Fetch custom OAuth bindings
  const loadCustomOAuthBindings = async () => {
    try {
      const res = await API.get('/api/user/oauth/bindings');
      if (res.data.success) {
        setCustomOAuthBindings(res.data.data || []);
      } else {
        showError(res.data.message || t('获取绑定信息失败'));
      }
    } catch (error) {
      showError(
        error.response?.data?.message || error.message || t('获取绑定信息失败'),
      );
    }
  };

  // Unbind custom OAuth provider
  const handleUnbindCustomOAuth = async (providerId, providerName) => {
    Modal.confirm({
      title: t('确认解绑'),
      content: t('确定要解绑 {{name}} 吗？', { name: providerName }),
      okText: t('确认'),
      cancelText: t('取消'),
      onOk: async () => {
        setCustomOAuthLoading((prev) => ({ ...prev, [providerId]: true }));
        try {
          const res = await API.delete(
            `/api/user/oauth/bindings/${providerId}`,
          );
          if (res.data.success) {
            showSuccess(t('解绑成功'));
            await loadCustomOAuthBindings();
          } else {
            showError(res.data.message);
          }
        } catch (error) {
          showError(
            error.response?.data?.message || error.message || t('操作失败'),
          );
        } finally {
          setCustomOAuthLoading((prev) => ({ ...prev, [providerId]: false }));
        }
      },
    });
  };

  // Handle bind custom OAuth
  const handleBindCustomOAuth = (provider) => {
    onCustomOAuthClicked(provider);
  };

  // Check if custom OAuth provider is bound
  const isCustomOAuthBound = (providerId) => {
    const normalizedId = Number(providerId);
    return customOAuthBindings.some(
      (b) => Number(b.provider_id) === normalizedId,
    );
  };

  // Get binding info for a provider
  const getCustomOAuthBinding = (providerId) => {
    const normalizedId = Number(providerId);
    return customOAuthBindings.find(
      (b) => Number(b.provider_id) === normalizedId,
    );
  };

  React.useEffect(() => {
    loadCustomOAuthBindings();
  }, []);

  const passkeyEnabled = passkeyStatus?.enabled;
  const lastUsedLabel = passkeyStatus?.last_used_at
    ? new Date(passkeyStatus.last_used_at).toLocaleString()
    : t('尚未使用');

  return (
    <Card className='!rounded-2xl'>
      {/* 卡片头部 */}
      <div className='flex items-center mb-4'>
        <Avatar size='small' color='teal' className='mr-3 shadow-md'>
          <UserPlus size={16} />
        </Avatar>
        <div>
          <Typography.Text className='text-lg font-medium'>
            {t('账户管理')}
          </Typography.Text>
          <div className='text-xs text-gray-600'>
            {t('账户绑定、安全设置和身份验证')}
          </div>
        </div>
      </div>

      <Tabs type='card' defaultActiveKey='binding'>
        {/* 账户绑定 Tab */}
        <TabPane
          tab={
            <div className='flex items-center'>
              <UserPlus size={16} className='mr-2' />
              {t('账户绑定')}
            </div>
          }
          itemKey='binding'
        >
          <div className='py-4'>
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
              {/* 邮箱绑定 */}
              <Card className='!rounded-xl'>
                <div className='flex items-center justify-between gap-3'>
                  <div className='flex items-center flex-1 min-w-0'>
                    <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                      <IconMail
                        size='default'
                        className='text-slate-600 dark:text-slate-300'
                      />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='font-medium text-gray-900'>
                        {t('邮箱')}
                      </div>
                      <div className='text-sm text-gray-500 truncate'>
                        {renderAccountInfo(
                          userState.user?.email,
                          t('邮箱地址'),
                        )}
                      </div>
                    </div>
                  </div>
                  <div className='flex-shrink-0'>
                    <Button
                      type='primary'
                      theme='outline'
                      size='small'
                      onClick={() => setShowEmailBindModal(true)}
                    >
                      {isBound(userState.user?.email)
                        ? t('修改绑定')
                        : t('绑定')}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* 微信绑定 */}
              <Card
                className={`!rounded-xl ${!isOAuthEnabled(status.wechat_login) ? 'hidden' : ''}`}
              >
                <div className='flex items-center justify-between gap-3'>
                  <div className='flex items-center flex-1 min-w-0'>
                    <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                      <SiWechat
                        size={20}
                        className='text-slate-600 dark:text-slate-300'
                      />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='font-medium text-gray-900'>
                        {t('微信')}
                      </div>
                      <div className='text-sm text-gray-500 truncate'>
                        {!isOAuthEnabled(status.wechat_login)
                          ? t('未启用')
                          : isBound(userState.user?.wechat_id)
                            ? t('已绑定')
                            : t('未绑定')}
                      </div>
                    </div>
                  </div>
                  <div className='flex-shrink-0'>
                    <Button
                      type='primary'
                      theme='outline'
                      size='small'
                      disabled={!isOAuthEnabled(status.wechat_login)}
                      onClick={() => setShowWeChatBindModal(true)}
                    >
                      {isBound(userState.user?.wechat_id)
                        ? t('修改绑定')
                        : isOAuthEnabled(status.wechat_login)
                          ? t('绑定')
                          : t('未启用')}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* GitHub绑定 */}
              <Card
                className={`!rounded-xl ${!isOAuthEnabled(status.github_oauth) ? 'hidden' : ''}`}
              >
                <div className='flex items-center justify-between gap-3'>
                  <div className='flex items-center flex-1 min-w-0'>
                    <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                      <IconGithubLogo
                        size='default'
                        className='text-slate-600 dark:text-slate-300'
                      />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='font-medium text-gray-900'>
                        {t('GitHub')}
                      </div>
                      <div className='text-sm text-gray-500 truncate'>
                        {renderAccountInfo(
                          userState.user?.github_id,
                          t('GitHub ID'),
                        )}
                      </div>
                    </div>
                  </div>
                  <div className='flex-shrink-0'>
                    <Button
                      type='primary'
                      theme='outline'
                      size='small'
                      onClick={() =>
                        onGitHubOAuthClicked(status.github_client_id)
                      }
                      disabled={
                        isBound(userState.user?.github_id) ||
                        !isOAuthEnabled(status.github_oauth)
                      }
                    >
                      {isOAuthEnabled(status.github_oauth)
                        ? t('绑定')
                        : t('未启用')}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Steam绑定 */}
              <Card
                className={`!rounded-xl ${!isOAuthEnabled(status.steam_oauth) ? 'hidden' : ''}`}
              >
                <div className='flex items-center justify-between gap-3'>
                  <div className='flex items-center flex-1 min-w-0'>
                    <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                      {getOAuthProviderIcon('steam', 20)}
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='font-medium text-gray-900'>
                        {t('Steam')}
                      </div>
                      <div className='text-sm text-gray-500 truncate'>
                        {renderAccountInfo(
                          userState.user?.steam_id,
                          t('Steam ID'),
                        )}
                      </div>
                    </div>
                  </div>
                  <div className='flex-shrink-0'>
                    <Button
                      type='primary'
                      theme='outline'
                      size='small'
                      onClick={() => onSteamOAuthClicked()}
                      disabled={
                        isBound(userState.user?.steam_id) ||
                        !isOAuthEnabled(status.steam_oauth)
                      }
                    >
                      {isOAuthEnabled(status.steam_oauth)
                        ? t('绑定')
                        : t('未启用')}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Discord绑定 */}
              <Card
                className={`!rounded-xl ${!isOAuthEnabled(status.discord_oauth) ? 'hidden' : ''}`}
              >
                <div className='flex items-center justify-between gap-3'>
                  <div className='flex items-center flex-1 min-w-0'>
                    <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                      <SiDiscord
                        size={20}
                        className='text-slate-600 dark:text-slate-300'
                      />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='font-medium text-gray-900'>
                        {t('Discord')}
                      </div>
                      <div className='text-sm text-gray-500 truncate'>
                        {renderAccountInfo(
                          userState.user?.discord_id,
                          t('Discord ID'),
                        )}
                      </div>
                    </div>
                  </div>
                  <div className='flex-shrink-0'>
                    <Button
                      type='primary'
                      theme='outline'
                      size='small'
                      onClick={() =>
                        onDiscordOAuthClicked(status.discord_client_id)
                      }
                      disabled={
                        isBound(userState.user?.discord_id) ||
                        !isOAuthEnabled(status.discord_oauth)
                      }
                    >
                      {isOAuthEnabled(status.discord_oauth)
                        ? t('绑定')
                        : t('未启用')}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* OIDC绑定 */}
              <Card
                className={`!rounded-xl ${!isOAuthEnabled(status.oidc_enabled) ? 'hidden' : ''}`}
              >
                <div className='flex items-center justify-between gap-3'>
                  <div className='flex items-center flex-1 min-w-0'>
                    <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                      <IconShield
                        size='default'
                        className='text-slate-600 dark:text-slate-300'
                      />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='font-medium text-gray-900'>
                        {t('OIDC')}
                      </div>
                      <div className='text-sm text-gray-500 truncate'>
                        {renderAccountInfo(
                          userState.user?.oidc_id,
                          t('OIDC ID'),
                        )}
                      </div>
                    </div>
                  </div>
                  <div className='flex-shrink-0'>
                    <Button
                      type='primary'
                      theme='outline'
                      size='small'
                      onClick={() =>
                        onOIDCClicked(
                          status.oidc_authorization_endpoint,
                          status.oidc_client_id,
                        )
                      }
                      disabled={
                        isBound(userState.user?.oidc_id) ||
                        !isOAuthEnabled(status.oidc_enabled)
                      }
                    >
                      {isOAuthEnabled(status.oidc_enabled)
                        ? t('绑定')
                        : t('未启用')}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Telegram绑定 */}
              <Card
                className={`!rounded-xl ${!isOAuthEnabled(status.telegram_oauth) ? 'hidden' : ''}`}
              >
                <div className='flex items-center justify-between gap-3'>
                  <div className='flex items-center flex-1 min-w-0'>
                    <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                      <SiTelegram
                        size={20}
                        className='text-slate-600 dark:text-slate-300'
                      />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='font-medium text-gray-900'>
                        {t('Telegram')}
                      </div>
                      <div className='text-sm text-gray-500 truncate'>
                        {renderAccountInfo(
                          userState.user?.telegram_id,
                          t('Telegram ID'),
                        )}
                      </div>
                    </div>
                  </div>
                  <div className='flex-shrink-0'>
                    {isOAuthEnabled(status.telegram_oauth) ? (
                      isBound(userState.user?.telegram_id) ? (
                        <Button
                          disabled
                          size='small'
                          type='primary'
                          theme='outline'
                        >
                          {t('已绑定')}
                        </Button>
                      ) : (
                        <Button
                          type='primary'
                          theme='outline'
                          size='small'
                          onClick={() => setShowTelegramBindModal(true)}
                        >
                          {t('绑定')}
                        </Button>
                      )
                    ) : (
                      <Button
                        disabled
                        size='small'
                        type='primary'
                        theme='outline'
                      >
                        {t('未启用')}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
              {isOAuthEnabled(status.telegram_oauth) && (
                <Modal
                  title={t('绑定 Telegram')}
                  visible={showTelegramBindModal}
                  onCancel={() => setShowTelegramBindModal(false)}
                  footer={null}
                >
                  <div className='my-3 text-sm text-gray-600'>
                    {t('点击下方按钮通过 Telegram 完成绑定')}
                  </div>
                  <div className='flex justify-center'>
                    <div className='scale-90'>
                      <TelegramLoginButton
                        dataAuthUrl='/api/oauth/telegram/bind'
                        botName={status.telegram_bot_name}
                      />
                    </div>
                  </div>
                </Modal>
              )}

              {/* LinuxDO绑定 */}
              <Card
                className={`!rounded-xl ${!isOAuthEnabled(status.linuxdo_oauth) ? 'hidden' : ''}`}
              >
                <div className='flex items-center justify-between gap-3'>
                  <div className='flex items-center flex-1 min-w-0'>
                    <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                      <SiLinux
                        size={20}
                        className='text-slate-600 dark:text-slate-300'
                      />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='font-medium text-gray-900'>
                        {t('LinuxDO')}
                      </div>
                      <div className='text-sm text-gray-500 truncate'>
                        {renderAccountInfo(
                          userState.user?.linux_do_id,
                          t('LinuxDO ID'),
                        )}
                      </div>
                    </div>
                  </div>
                  <div className='flex-shrink-0'>
                    <Button
                      type='primary'
                      theme='outline'
                      size='small'
                      onClick={() =>
                        onLinuxDOOAuthClicked(status.linuxdo_client_id)
                      }
                      disabled={
                        isBound(userState.user?.linux_do_id) ||
                        !isOAuthEnabled(status.linuxdo_oauth)
                      }
                    >
                      {isOAuthEnabled(status.linuxdo_oauth)
                        ? t('绑定')
                        : t('未启用')}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* QQ绑定 */}
              <Card
                className={`!rounded-xl ${!isOAuthEnabled(status.qq_oauth) ? 'hidden' : ''}`}
              >
                <div className='flex items-center justify-between gap-3'>
                  <div className='flex items-center flex-1 min-w-0'>
                    <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                      <FaQq
                        size={20}
                        className='text-slate-600 dark:text-slate-300'
                      />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='font-medium text-gray-900'>{t('QQ')}</div>
                      <div className='text-sm text-gray-500 truncate'>
                        {renderAccountInfo(userState.user?.qq_id, t('QQ ID'))}
                      </div>
                    </div>
                  </div>
                  <div className='flex-shrink-0'>
                    <Button
                      type='primary'
                      theme='outline'
                      size='small'
                      onClick={() => onQQOAuthClicked(status.qq_client_id)}
                      disabled={
                        isBound(userState.user?.qq_id) ||
                        !isOAuthEnabled(status.qq_oauth)
                      }
                    >
                      {isOAuthEnabled(status.qq_oauth)
                        ? t('绑定')
                        : t('未启用')}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* 自定义 OAuth 提供商绑定 */}
              {status.custom_oauth_providers &&
                status.custom_oauth_providers.map((provider) => {
                  const bound = isCustomOAuthBound(provider.id);
                  const binding = getCustomOAuthBinding(provider.id);
                  return (
                    <Card key={provider.slug} className='!rounded-xl'>
                      <div className='flex items-center justify-between gap-3'>
                        <div className='flex items-center flex-1 min-w-0'>
                          <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                            {getOAuthProviderIcon(
                              provider.icon || binding?.provider_icon || '',
                              20,
                            )}
                          </div>
                          <div className='flex-1 min-w-0'>
                            <div className='font-medium text-gray-900'>
                              {provider.name}
                            </div>
                            <div className='text-sm text-gray-500 truncate'>
                              {bound
                                ? renderAccountInfo(
                                    binding?.provider_user_id,
                                    t('{{name}} ID', { name: provider.name }),
                                  )
                                : t('未绑定')}
                            </div>
                          </div>
                        </div>
                        <div className='flex-shrink-0'>
                          {bound ? (
                            <Button
                              type='danger'
                              theme='outline'
                              size='small'
                              loading={customOAuthLoading[provider.id]}
                              onClick={() =>
                                handleUnbindCustomOAuth(
                                  provider.id,
                                  provider.name,
                                )
                              }
                            >
                              {t('解绑')}
                            </Button>
                          ) : (
                            <Button
                              type='primary'
                              theme='outline'
                              size='small'
                              onClick={() => handleBindCustomOAuth(provider)}
                            >
                              {t('绑定')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
            </div>
          </div>
        </TabPane>

        {/* 安全设置 Tab */}
        <TabPane
          tab={
            <div className='flex items-center'>
              <ShieldCheck size={16} className='mr-2' />
              {t('安全设置')}
            </div>
          }
          itemKey='security'
        >
          <div className='py-4'>
            <div className='space-y-6'>
              <Space vertical className='w-full'>
                {/* 系统访问令牌 */}
                <Card className='!rounded-xl w-full'>
                  <div className='flex flex-col sm:flex-row items-start sm:justify-between gap-4'>
                    <div className='flex items-start w-full sm:w-auto'>
                      <div className='w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mr-4 flex-shrink-0'>
                        <IconKey size='large' className='text-slate-600' />
                      </div>
                      <div className='flex-1'>
                        <Typography.Title heading={6} className='mb-1'>
                          {t('系统访问令牌')}
                        </Typography.Title>
                        <Typography.Text type='tertiary' className='text-sm'>
                          {t('用于API调用的身份验证令牌，请妥善保管')}
                        </Typography.Text>
                        {systemToken && (
                          <div className='mt-3'>
                            <Input
                              readonly
                              value={systemToken}
                              onClick={handleSystemTokenClick}
                              size='large'
                              prefix={<IconKey />}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      type='primary'
                      theme='solid'
                      onClick={generateAccessToken}
                      className='!bg-slate-600 hover:!bg-slate-700 w-full sm:w-auto'
                      icon={<IconKey />}
                    >
                      {systemToken ? t('重新生成') : t('生成令牌')}
                    </Button>
                  </div>
                </Card>

                <Card className='!rounded-xl w-full'>
                  <div className='flex flex-col sm:flex-row items-start sm:justify-between gap-4'>
                    <div className='flex items-start w-full sm:w-auto'>
                      <div className='w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mr-4 flex-shrink-0'>
                        <IconEdit size='large' className='text-slate-600' />
                      </div>
                      <div>
                        <Typography.Title heading={6} className='mb-1'>
                          {t('修改用户名')}
                        </Typography.Title>
                        <Typography.Text type='tertiary' className='text-sm'>
                          {usernameStatusText}
                        </Typography.Text>
                        <Typography.Text
                          type='quaternary'
                          className='text-xs mt-2 block'
                        >
                          @{currentUsername}
                        </Typography.Text>
                        <Typography.Text
                          type='quaternary'
                          className='text-xs mt-1 block'
                        >
                          {usernameResetText}
                        </Typography.Text>
                      </div>
                    </div>
                    <Button
                      type='primary'
                      theme='solid'
                      onClick={openUsernameModal}
                      className='!bg-slate-600 hover:!bg-slate-700 w-full sm:w-auto'
                      icon={<IconEdit />}
                    >
                      {t('修改用户名')}
                    </Button>
                  </div>
                </Card>

                {/* 密码管理 */}
                <Card className='!rounded-xl w-full'>
                  <div className='flex flex-col sm:flex-row items-start sm:justify-between gap-4'>
                    <div className='flex items-start w-full sm:w-auto'>
                      <div className='w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mr-4 flex-shrink-0'>
                        <IconLock size='large' className='text-slate-600' />
                      </div>
                      <div>
                        <Typography.Title heading={6} className='mb-1'>
                          {t('密码管理')}
                        </Typography.Title>
                        <Typography.Text type='tertiary' className='text-sm'>
                          {userState?.user?.has_password
                            ? t('定期更改密码可以提高账户安全性')
                            : t('设置密码后可使用用户名密码登录')}
                        </Typography.Text>
                      </div>
                    </div>
                    <Button
                      type='primary'
                      theme='solid'
                      onClick={() => {
                        if (turnstileEnabled) {
                          setTurnstileToken('');
                        }
                        setShowChangePasswordModal(true);
                      }}
                      className='!bg-slate-600 hover:!bg-slate-700 w-full sm:w-auto'
                      icon={<IconLock />}
                    >
                      {userState?.user?.has_password
                        ? t('修改密码')
                        : t('设置密码')}
                    </Button>
                  </div>
                </Card>

                {/* Passkey 设置 */}
                <Card className='!rounded-xl w-full'>
                  <div className='flex flex-col sm:flex-row items-start sm:justify-between gap-4'>
                    <div className='flex items-start w-full sm:w-auto'>
                      <div className='w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mr-4 flex-shrink-0'>
                        <IconKey size='large' className='text-slate-600' />
                      </div>
                      <div>
                        <Typography.Title heading={6} className='mb-1'>
                          {t('Passkey 登录')}
                        </Typography.Title>
                        <Typography.Text type='tertiary' className='text-sm'>
                          {passkeyEnabled
                            ? t('已启用 Passkey，无需密码即可登录')
                            : t('使用 Passkey 实现免密且更安全的登录体验')}
                        </Typography.Text>
                        <div className='mt-2 text-xs text-gray-500 space-y-1'>
                          <div>
                            {t('最后使用时间')}：{lastUsedLabel}
                            {passkeyStatus?.rp_id && (
                              <div>
                                {t('绑定域名')}：{passkeyStatus.rp_id}
                              </div>
                            )}
                          </div>
                          {/*{passkeyEnabled && (*/}
                          {/*  <div>*/}
                          {/*    {t('备份支持')}：*/}
                          {/*    {passkeyStatus?.backup_eligible*/}
                          {/*      ? t('支持备份')*/}
                          {/*      : t('不支持')}*/}
                          {/*    ，{t('备份状态')}：*/}
                          {/*    {passkeyStatus?.backup_state ? t('已备份') : t('未备份')}*/}
                          {/*  </div>*/}
                          {/*)}*/}
                          {!passkeySupported && (
                            <div className='text-amber-600'>
                              {t('当前设备不支持 Passkey')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      type={passkeyEnabled ? 'danger' : 'primary'}
                      theme={passkeyEnabled ? 'solid' : 'solid'}
                      onClick={
                        passkeyEnabled
                          ? () => {
                              Modal.confirm({
                                title: t('确认解绑 Passkey'),
                                content: t(
                                  '解绑后将无法使用 Passkey 登录，确定要继续吗？',
                                ),
                                okText: t('确认解绑'),
                                cancelText: t('取消'),
                                okType: 'danger',
                                onOk: onPasskeyDelete,
                              });
                            }
                          : onPasskeyRegister
                      }
                      className={`w-full sm:w-auto ${passkeyEnabled ? '!bg-slate-500 hover:!bg-slate-600' : ''}`}
                      icon={<IconKey />}
                      disabled={!passkeySupported && !passkeyEnabled}
                      loading={
                        passkeyEnabled
                          ? passkeyDeleteLoading
                          : passkeyRegisterLoading
                      }
                    >
                      {passkeyEnabled ? t('解绑 Passkey') : t('注册 Passkey')}
                    </Button>
                  </div>
                </Card>

                {/* 两步验证设置 */}
                <TwoFASetting t={t} />

                {/* 危险区域 */}
                <Card className='!rounded-xl w-full'>
                  <div className='flex flex-col sm:flex-row items-start sm:justify-between gap-4'>
                    <div className='flex items-start w-full sm:w-auto'>
                      <div className='w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mr-4 flex-shrink-0'>
                        <IconDelete size='large' className='text-slate-600' />
                      </div>
                      <div>
                        <Typography.Title
                          heading={6}
                          className='mb-1 text-slate-700'
                        >
                          {t('删除账户')}
                        </Typography.Title>
                        <Typography.Text type='tertiary' className='text-sm'>
                          {t('此操作不可逆，所有数据将被永久删除')}
                        </Typography.Text>
                      </div>
                    </div>
                    <Button
                      type='danger'
                      theme='solid'
                      onClick={() => setShowAccountDeleteModal(true)}
                      className='w-full sm:w-auto !bg-slate-500 hover:!bg-slate-600'
                      icon={<IconDelete />}
                    >
                      {t('删除账户')}
                    </Button>
                  </div>
                </Card>
              </Space>
            </div>
          </div>
        </TabPane>
      </Tabs>
      <Modal
        title={t('修改用户名')}
        visible={showUsernameModal}
        onOk={saveUsername}
        onCancel={closeUsernameModal}
        okText={t('保存')}
        cancelText={t('取消')}
        confirmLoading={usernameSaving}
        centered
        okButtonProps={{
          disabled:
            usernameQuotaExhausted && newUsername.trim() !== currentUsername,
        }}
      >
        <div className='space-y-3 py-2'>
          <Typography.Text type='tertiary' className='block text-sm'>
            @{currentUsername}
          </Typography.Text>
          <div className='rounded-xl border border-slate-200 bg-slate-50 px-3 py-3'>
            <Typography.Text strong className='block text-sm text-slate-700'>
              {t('用户名修改额度')}
            </Typography.Text>
            <Typography.Text type='tertiary' className='block text-sm mt-1'>
              {usernameStatusText}
            </Typography.Text>
            <Typography.Text
              type={usernameQuotaExhausted ? 'warning' : 'quaternary'}
              className='block text-xs mt-2'
            >
              {usernameResetText}
            </Typography.Text>
            {usernameQuotaExhausted && (
              <Typography.Text type='danger' className='block text-xs mt-2'>
                {t('当前窗口内已不能继续修改用户名')}
              </Typography.Text>
            )}
          </div>
          <Input
            value={newUsername}
            onChange={setNewUsername}
            onEnterPress={saveUsername}
            placeholder={t('请输入新的用户名')}
            maxLength={20}
            size='large'
            autoFocus
            disabled={usernameQuotaExhausted}
          />
          {turnstileEnabled && (
            <div className='flex justify-center pt-2'>
              <Turnstile
                sitekey={turnstileSiteKey}
                onVerify={(token) => {
                  setTurnstileToken(token);
                }}
                onExpire={() => {
                  setTurnstileToken('');
                }}
              />
            </div>
          )}
        </div>
      </Modal>
    </Card>
  );
};

export default AccountManagement;

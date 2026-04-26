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
  ModalHeader,
  Tooltip,
  useOverlayState,
} from '@heroui/react';
import { SiTelegram, SiWechat, SiLinux, SiDiscord } from 'react-icons/si';
import {
  Copy,
  Github,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import TelegramLoginButton from 'react-telegram-login';
import {
  API,
  copy as copyToClipboard,
  showError,
  showSuccess,
  onGitHubOAuthClicked,
  onOIDCClicked,
  onLinuxDOOAuthClicked,
  onDiscordOAuthClicked,
  onCustomOAuthClicked,
  getOAuthProviderIcon,
} from '../../../../helpers';
import ConfirmDialog from '../../../common/ui/ConfirmDialog';
import TwoFASetting from '../components/TwoFASetting';

// ----------------------------- helpers -----------------------------

function IconTile({ size = 'md', children }) {
  const sizeCls = size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
  return (
    <div
      className={`${sizeCls} flex shrink-0 items-center justify-center rounded-full bg-surface-secondary text-muted`}
    >
      {children}
    </div>
  );
}

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
  passkeyStatus,
  passkeySupported,
  passkeyRegisterLoading,
  passkeyDeleteLoading,
  onPasskeyRegister,
  onPasskeyDelete,
}) => {
  const [activeTab, setActiveTab] = useState('binding');
  const [showTelegramBindModal, setShowTelegramBindModal] = useState(false);
  const [customOAuthBindings, setCustomOAuthBindings] = useState([]);
  const [customOAuthLoading, setCustomOAuthLoading] = useState({});

  // Inline confirm dialog state (replaces Semi imperative `Modal.confirm`)
  const [unbindCustomTarget, setUnbindCustomTarget] = useState(null);
  const [unbindPasskey, setUnbindPasskey] = useState(false);

  const telegramModalState = useOverlayState({
    isOpen: showTelegramBindModal,
    onOpenChange: (isOpen) => {
      if (!isOpen) setShowTelegramBindModal(false);
    },
  });

  const renderAccountInfo = (accountId) => {
    if (!accountId || accountId === '') {
      return <span className='text-muted'>{t('未绑定')}</span>;
    }

    return (
      <Tooltip
        content={
          <div className='flex items-center gap-2 px-2 py-1 text-xs'>
            <code className='select-all rounded bg-background/40 px-1.5 py-0.5 font-mono'>
              {accountId}
            </code>
            <button
              type='button'
              className='inline-flex items-center text-primary hover:underline'
              onClick={async () => {
                const ok = await copyToClipboard(accountId);
                if (ok) showSuccess(t('已复制'));
                else showError(t('复制失败'));
              }}
              aria-label={t('复制')}
            >
              <Copy size={12} className='mr-1' />
              {t('复制')}
            </button>
          </div>
        }
      >
        <span className='block max-w-full cursor-pointer truncate text-muted hover:text-primary'>
          {accountId}
        </span>
      </Tooltip>
    );
  };

  const isBound = (accountId) => Boolean(accountId);

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
        error.response?.data?.message ||
          error.message ||
          t('获取绑定信息失败'),
      );
    }
  };

  const handleUnbindCustomOAuth = async (providerId, providerName) => {
    setCustomOAuthLoading((prev) => ({ ...prev, [providerId]: true }));
    try {
      const res = await API.delete(`/api/user/oauth/bindings/${providerId}`);
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
  };

  const handleBindCustomOAuth = (provider) => {
    onCustomOAuthClicked(provider);
  };

  const isCustomOAuthBound = (providerId) => {
    const normalizedId = Number(providerId);
    return customOAuthBindings.some(
      (b) => Number(b.provider_id) === normalizedId,
    );
  };

  const getCustomOAuthBinding = (providerId) => {
    const normalizedId = Number(providerId);
    return customOAuthBindings.find(
      (b) => Number(b.provider_id) === normalizedId,
    );
  };

  useEffect(() => {
    loadCustomOAuthBindings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const passkeyEnabled = passkeyStatus?.enabled;
  const lastUsedLabel = passkeyStatus?.last_used_at
    ? new Date(passkeyStatus.last_used_at).toLocaleString()
    : t('尚未使用');

  // ----------------------------- BindingRow ----------------------------- //
  const BindingRow = ({ icon, title, info, action }) => (
    <Card className='!rounded-xl'>
      <Card.Content className='p-4'>
        <div className='flex items-center justify-between gap-3'>
          <div className='flex min-w-0 flex-1 items-center'>
            <IconTile size='md'>{icon}</IconTile>
            <div className='ml-3 min-w-0 flex-1'>
              <div className='font-medium text-foreground'>{title}</div>
              <div className='truncate text-sm text-muted'>{info}</div>
            </div>
          </div>
          <div className='shrink-0'>{action}</div>
        </div>
      </Card.Content>
    </Card>
  );

  // ----------------------------- SecurityRow ----------------------------- //
  const SecurityRow = ({ icon, title, hint, extra, action }) => (
    <Card className='!w-full !rounded-xl'>
      <Card.Content className='p-5'>
        <div className='flex flex-col items-start gap-4 sm:flex-row sm:justify-between'>
          <div className='flex w-full items-start sm:w-auto'>
            <div className='mr-4'>
              <IconTile size='lg'>{icon}</IconTile>
            </div>
            <div className='flex-1'>
              <h6 className='m-0 mb-1 text-base font-semibold text-foreground'>
                {title}
              </h6>
              <div className='text-sm text-muted'>{hint}</div>
              {extra}
            </div>
          </div>
          <div className='w-full sm:w-auto'>{action}</div>
        </div>
      </Card.Content>
    </Card>
  );

  return (
    <Card className='!rounded-2xl'>
      <Card.Content className='p-5'>
        {/* 卡片头部 */}
        <div className='mb-4 flex items-center'>
          <div className='mr-3 flex h-9 w-9 items-center justify-center rounded-full bg-success/10 text-success shadow-md'>
            <UserPlus size={16} />
          </div>
          <div>
            <div className='text-base font-semibold text-foreground'>
              {t('账户管理')}
            </div>
            <div className='text-xs text-muted'>
              {t('账户绑定、安全设置和身份验证')}
            </div>
          </div>
        </div>

        {/* Tabs (segmented control) */}
        <div className='mb-4 inline-flex overflow-hidden rounded-xl border border-border'>
          {[
            {
              key: 'binding',
              label: t('账户绑定'),
              icon: <UserPlus size={14} />,
            },
            {
              key: 'security',
              label: t('安全设置'),
              icon: <ShieldCheck size={14} />,
            },
          ].map((tab) => {
            const active = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type='button'
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-foreground text-background'
                    : 'bg-background text-muted hover:bg-surface-secondary'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 账户绑定 Tab */}
        {activeTab === 'binding' && (
          <div className='py-2'>
            <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
              {/* 邮箱 */}
              <BindingRow
                icon={<Mail size={20} />}
                title={t('邮箱')}
                info={renderAccountInfo(userState.user?.email)}
                action={
                  <Button
                    color='primary'
                    variant='bordered'
                    size='sm'
                    onPress={() => setShowEmailBindModal(true)}
                  >
                    {isBound(userState.user?.email)
                      ? t('修改绑定')
                      : t('绑定')}
                  </Button>
                }
              />

              {/* 微信 */}
              <BindingRow
                icon={<SiWechat size={20} />}
                title={t('微信')}
                info={
                  !status.wechat_login
                    ? t('未启用')
                    : isBound(userState.user?.wechat_id)
                      ? t('已绑定')
                      : t('未绑定')
                }
                action={
                  <Button
                    color='primary'
                    variant='bordered'
                    size='sm'
                    isDisabled={!status.wechat_login}
                    onPress={() => setShowWeChatBindModal(true)}
                  >
                    {isBound(userState.user?.wechat_id)
                      ? t('修改绑定')
                      : status.wechat_login
                        ? t('绑定')
                        : t('未启用')}
                  </Button>
                }
              />

              {/* GitHub */}
              <BindingRow
                icon={<Github size={20} />}
                title={t('GitHub')}
                info={renderAccountInfo(userState.user?.github_id)}
                action={
                  <Button
                    color='primary'
                    variant='bordered'
                    size='sm'
                    onPress={() =>
                      onGitHubOAuthClicked(status.github_client_id)
                    }
                    isDisabled={
                      isBound(userState.user?.github_id) ||
                      !status.github_oauth
                    }
                  >
                    {status.github_oauth ? t('绑定') : t('未启用')}
                  </Button>
                }
              />

              {/* Discord */}
              <BindingRow
                icon={<SiDiscord size={20} />}
                title={t('Discord')}
                info={renderAccountInfo(userState.user?.discord_id)}
                action={
                  <Button
                    color='primary'
                    variant='bordered'
                    size='sm'
                    onPress={() =>
                      onDiscordOAuthClicked(status.discord_client_id)
                    }
                    isDisabled={
                      isBound(userState.user?.discord_id) ||
                      !status.discord_oauth
                    }
                  >
                    {status.discord_oauth ? t('绑定') : t('未启用')}
                  </Button>
                }
              />

              {/* OIDC */}
              <BindingRow
                icon={<ShieldCheck size={20} />}
                title={t('OIDC')}
                info={renderAccountInfo(userState.user?.oidc_id)}
                action={
                  <Button
                    color='primary'
                    variant='bordered'
                    size='sm'
                    onPress={() =>
                      onOIDCClicked(
                        status.oidc_authorization_endpoint,
                        status.oidc_client_id,
                      )
                    }
                    isDisabled={
                      isBound(userState.user?.oidc_id) || !status.oidc_enabled
                    }
                  >
                    {status.oidc_enabled ? t('绑定') : t('未启用')}
                  </Button>
                }
              />

              {/* Telegram */}
              <BindingRow
                icon={<SiTelegram size={20} />}
                title={t('Telegram')}
                info={renderAccountInfo(userState.user?.telegram_id)}
                action={
                  status.telegram_oauth ? (
                    isBound(userState.user?.telegram_id) ? (
                      <Button
                        size='sm'
                        color='primary'
                        variant='bordered'
                        isDisabled
                      >
                        {t('已绑定')}
                      </Button>
                    ) : (
                      <Button
                        color='primary'
                        variant='bordered'
                        size='sm'
                        onPress={() => setShowTelegramBindModal(true)}
                      >
                        {t('绑定')}
                      </Button>
                    )
                  ) : (
                    <Button
                      size='sm'
                      color='primary'
                      variant='bordered'
                      isDisabled
                    >
                      {t('未启用')}
                    </Button>
                  )
                }
              />

              {/* LinuxDO */}
              <BindingRow
                icon={<SiLinux size={20} />}
                title={t('LinuxDO')}
                info={renderAccountInfo(userState.user?.linux_do_id)}
                action={
                  <Button
                    color='primary'
                    variant='bordered'
                    size='sm'
                    onPress={() =>
                      onLinuxDOOAuthClicked(status.linuxdo_client_id)
                    }
                    isDisabled={
                      isBound(userState.user?.linux_do_id) ||
                      !status.linuxdo_oauth
                    }
                  >
                    {status.linuxdo_oauth ? t('绑定') : t('未启用')}
                  </Button>
                }
              />

              {/* 自定义 OAuth 提供商 */}
              {status.custom_oauth_providers &&
                status.custom_oauth_providers.map((provider) => {
                  const bound = isCustomOAuthBound(provider.id);
                  const binding = getCustomOAuthBinding(provider.id);
                  return (
                    <BindingRow
                      key={provider.slug}
                      icon={getOAuthProviderIcon(
                        provider.icon || binding?.provider_icon || '',
                        20,
                      )}
                      title={provider.name}
                      info={
                        bound
                          ? renderAccountInfo(binding?.provider_user_id)
                          : t('未绑定')
                      }
                      action={
                        bound ? (
                          <Button
                            color='danger'
                            variant='bordered'
                            size='sm'
                            isPending={customOAuthLoading[provider.id]}
                            onPress={() =>
                              setUnbindCustomTarget({
                                id: provider.id,
                                name: provider.name,
                              })
                            }
                          >
                            {t('解绑')}
                          </Button>
                        ) : (
                          <Button
                            color='primary'
                            variant='bordered'
                            size='sm'
                            onPress={() => handleBindCustomOAuth(provider)}
                          >
                            {t('绑定')}
                          </Button>
                        )
                      }
                    />
                  );
                })}
            </div>
          </div>
        )}

        {/* 安全设置 Tab */}
        {activeTab === 'security' && (
          <div className='space-y-4 py-2'>
            {/* 系统访问令牌 */}
            <SecurityRow
              icon={<KeyRound size={20} />}
              title={t('系统访问令牌')}
              hint={t('用于API调用的身份验证令牌，请妥善保管')}
              extra={
                systemToken && (
                  <div className='mt-3'>
                    <div className='relative'>
                      <KeyRound
                        size={16}
                        className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted'
                      />
                      <input
                        type='text'
                        readOnly
                        value={systemToken}
                        onClick={handleSystemTokenClick}
                        className='h-11 w-full cursor-pointer rounded-xl border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-primary'
                      />
                    </div>
                  </div>
                )
              }
              action={
                <Button
                  color='primary'
                  startContent={<KeyRound size={14} />}
                  onPress={generateAccessToken}
                  className='w-full !bg-foreground/85 hover:!bg-foreground sm:w-auto'
                >
                  {systemToken ? t('重新生成') : t('生成令牌')}
                </Button>
              }
            />

            {/* 密码管理 */}
            <SecurityRow
              icon={<Lock size={20} />}
              title={t('密码管理')}
              hint={t('定期更改密码可以提高账户安全性')}
              action={
                <Button
                  color='primary'
                  startContent={<Lock size={14} />}
                  onPress={() => setShowChangePasswordModal(true)}
                  className='w-full !bg-foreground/85 hover:!bg-foreground sm:w-auto'
                >
                  {t('修改密码')}
                </Button>
              }
            />

            {/* Passkey */}
            <SecurityRow
              icon={<KeyRound size={20} />}
              title={t('Passkey 登录')}
              hint={
                passkeyEnabled
                  ? t('已启用 Passkey，无需密码即可登录')
                  : t('使用 Passkey 实现免密且更安全的登录体验')
              }
              extra={
                <div className='mt-2 space-y-1 text-xs text-muted'>
                  <div>
                    {t('最后使用时间')}：{lastUsedLabel}
                  </div>
                  {!passkeySupported && (
                    <div className='text-warning'>
                      {t('当前设备不支持 Passkey')}
                    </div>
                  )}
                </div>
              }
              action={
                <Button
                  color={passkeyEnabled ? 'danger' : 'primary'}
                  startContent={<KeyRound size={14} />}
                  isDisabled={!passkeySupported && !passkeyEnabled}
                  isPending={
                    passkeyEnabled
                      ? passkeyDeleteLoading
                      : passkeyRegisterLoading
                  }
                  onPress={
                    passkeyEnabled
                      ? () => setUnbindPasskey(true)
                      : onPasskeyRegister
                  }
                  className={`w-full sm:w-auto ${passkeyEnabled ? '!bg-foreground/70 hover:!bg-foreground/85' : ''}`}
                >
                  {passkeyEnabled ? t('解绑 Passkey') : t('注册 Passkey')}
                </Button>
              }
            />

            {/* 两步验证 */}
            <TwoFASetting t={t} />

            {/* 危险区域 */}
            <SecurityRow
              icon={<Trash2 size={20} />}
              title={t('删除账户')}
              hint={t('此操作不可逆，所有数据将被永久删除')}
              action={
                <Button
                  color='danger'
                  startContent={<Trash2 size={14} />}
                  onPress={() => setShowAccountDeleteModal(true)}
                  className='w-full !bg-foreground/70 hover:!bg-foreground/85 sm:w-auto'
                >
                  {t('删除账户')}
                </Button>
              }
            />
          </div>
        )}
      </Card.Content>

      {/* Telegram bind modal */}
      <Modal state={telegramModalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer size='md' placement='center'>
            <ModalDialog className='bg-background/95 backdrop-blur'>
              <ModalHeader className='flex items-center justify-between border-b border-border'>
                <span>{t('绑定 Telegram')}</span>
                <Button
                  isIconOnly
                  variant='light'
                  size='sm'
                  aria-label={t('关闭')}
                  onPress={() => setShowTelegramBindModal(false)}
                >
                  <X size={16} />
                </Button>
              </ModalHeader>
              <ModalBody className='space-y-3 px-6 py-5'>
                <div className='text-sm text-muted'>
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
              </ModalBody>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>

      {/* 解绑自定义 OAuth */}
      <ConfirmDialog
        visible={!!unbindCustomTarget}
        title={t('确认解绑')}
        cancelText={t('取消')}
        confirmText={t('确认')}
        danger
        onCancel={() => setUnbindCustomTarget(null)}
        onConfirm={async () => {
          const target = unbindCustomTarget;
          setUnbindCustomTarget(null);
          if (target) {
            await handleUnbindCustomOAuth(target.id, target.name);
          }
        }}
      >
        {unbindCustomTarget
          ? t('确定要解绑 {{name}} 吗？', { name: unbindCustomTarget.name })
          : ''}
      </ConfirmDialog>

      {/* 解绑 Passkey */}
      <ConfirmDialog
        visible={unbindPasskey}
        title={t('确认解绑 Passkey')}
        cancelText={t('取消')}
        confirmText={t('确认解绑')}
        danger
        onCancel={() => setUnbindPasskey(false)}
        onConfirm={() => {
          setUnbindPasskey(false);
          onPasskeyDelete?.();
        }}
      >
        {t('解绑后将无法使用 Passkey 登录，确定要继续吗？')}
      </ConfirmDialog>
    </Card>
  );
};

export default AccountManagement;

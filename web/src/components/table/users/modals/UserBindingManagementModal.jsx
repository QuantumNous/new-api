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
import { useTranslation } from 'react-i18next';
import {
  API,
  showError,
  showSuccess,
  getOAuthProviderIcon,
} from '../../../../helpers';
import {
  Button,
  Card,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  Spinner,
  useOverlayState,
} from '@heroui/react';
import { Github, Link as LinkIcon, Mail, Trash2 } from 'lucide-react';
import { SiDiscord, SiTelegram, SiWechat, SiLinux } from 'react-icons/si';
import ConfirmDialog from '@/components/common/ui/ConfirmDialog';

const UserBindingManagementModal = ({
  visible,
  onCancel,
  userId,
  isMobile,
  formApiRef,
}) => {
  const { t } = useTranslation();
  const [bindingLoading, setBindingLoading] = React.useState(false);
  const [showBoundOnly, setShowBoundOnly] = React.useState(true);
  const [statusInfo, setStatusInfo] = React.useState({});
  const [customOAuthBindings, setCustomOAuthBindings] = React.useState([]);
  const [builtInBindings, setBuiltInBindings] = React.useState({});
  const [bindingActionLoading, setBindingActionLoading] = React.useState({});
  const [pendingUnbind, setPendingUnbind] = React.useState(null);

  const loadBindingData = React.useCallback(async () => {
    if (!userId) return;
    setBindingLoading(true);
    try {
      const [statusRes, customBindingRes, userRes] = await Promise.all([
        API.get('/api/status'),
        API.get(`/api/user/${userId}/oauth/bindings`),
        API.get(`/api/user/${userId}`),
      ]);

      if (statusRes.data?.success) {
        setStatusInfo(statusRes.data.data || {});
      } else {
        showError(statusRes.data?.message || t('操作失败'));
      }

      if (customBindingRes.data?.success) {
        setCustomOAuthBindings(customBindingRes.data.data || []);
      } else {
        showError(customBindingRes.data?.message || t('操作失败'));
      }

      if (userRes.data?.success) {
        const userData = userRes.data.data || {};
        setBuiltInBindings({
          email: userData.email || '',
          github_id: userData.github_id || '',
          discord_id: userData.discord_id || '',
          oidc_id: userData.oidc_id || '',
          wechat_id: userData.wechat_id || '',
          telegram_id: userData.telegram_id || '',
          linux_do_id: userData.linux_do_id || '',
        });
      } else {
        showError(userRes.data?.message || t('操作失败'));
      }
    } catch (error) {
      showError(
        error.response?.data?.message || error.message || t('操作失败'),
      );
    } finally {
      setBindingLoading(false);
    }
  }, [t, userId]);

  React.useEffect(() => {
    if (!visible) return;
    setShowBoundOnly(true);
    setBindingActionLoading({});
    loadBindingData();
  }, [visible, loadBindingData]);

  const setBindingLoadingState = (key, value) => {
    setBindingActionLoading((prev) => ({ ...prev, [key]: value }));
  };

  const performUnbindBuiltIn = async (bindingItem) => {
    if (!userId) return;
    const loadingKey = `builtin-${bindingItem.key}`;
    setBindingLoadingState(loadingKey, true);
    try {
      const res = await API.delete(
        `/api/user/${userId}/bindings/${bindingItem.key}`,
      );
      if (!res.data?.success) {
        showError(res.data?.message || t('操作失败'));
        return;
      }
      setBuiltInBindings((prev) => ({
        ...prev,
        [bindingItem.field]: '',
      }));
      formApiRef?.current?.setValue?.(bindingItem.field, '');
      showSuccess(t('解绑成功'));
    } catch (error) {
      showError(
        error.response?.data?.message || error.message || t('操作失败'),
      );
    } finally {
      setBindingLoadingState(loadingKey, false);
    }
  };

  const performUnbindCustom = async (provider) => {
    if (!userId) return;
    const loadingKey = `custom-${provider.id}`;
    setBindingLoadingState(loadingKey, true);
    try {
      const res = await API.delete(
        `/api/user/${userId}/oauth/bindings/${provider.id}`,
      );
      if (!res.data?.success) {
        showError(res.data?.message || t('操作失败'));
        return;
      }
      setCustomOAuthBindings((prev) =>
        prev.filter(
          (item) => Number(item.provider_id) !== Number(provider.id),
        ),
      );
      showSuccess(t('解绑成功'));
    } catch (error) {
      showError(
        error.response?.data?.message || error.message || t('操作失败'),
      );
    } finally {
      setBindingLoadingState(loadingKey, false);
    }
  };

  const requestUnbind = (item) => {
    setPendingUnbind(item);
  };

  const currentValues = formApiRef?.current?.getValues?.() || {};
  const getBuiltInBindingValue = (field) =>
    builtInBindings[field] || currentValues[field] || '';

  const builtInBindingItems = [
    {
      key: 'email',
      field: 'email',
      name: t('邮箱'),
      enabled: true,
      value: getBuiltInBindingValue('email'),
      icon: <Mail size={20} className='text-foreground' />,
    },
    {
      key: 'github',
      field: 'github_id',
      name: 'GitHub',
      enabled: Boolean(statusInfo.github_oauth),
      value: getBuiltInBindingValue('github_id'),
      icon: <Github size={20} className='text-foreground' />,
    },
    {
      key: 'discord',
      field: 'discord_id',
      name: 'Discord',
      enabled: Boolean(statusInfo.discord_oauth),
      value: getBuiltInBindingValue('discord_id'),
      icon: (
        <SiDiscord size={20} className='text-foreground' />
      ),
    },
    {
      key: 'oidc',
      field: 'oidc_id',
      name: 'OIDC',
      enabled: Boolean(statusInfo.oidc_enabled),
      value: getBuiltInBindingValue('oidc_id'),
      icon: (
        <LinkIcon size={20} className='text-foreground' />
      ),
    },
    {
      key: 'wechat',
      field: 'wechat_id',
      name: t('微信'),
      enabled: Boolean(statusInfo.wechat_login),
      value: getBuiltInBindingValue('wechat_id'),
      icon: (
        <SiWechat size={20} className='text-foreground' />
      ),
    },
    {
      key: 'telegram',
      field: 'telegram_id',
      name: 'Telegram',
      enabled: Boolean(statusInfo.telegram_oauth),
      value: getBuiltInBindingValue('telegram_id'),
      icon: (
        <SiTelegram size={20} className='text-foreground' />
      ),
    },
    {
      key: 'linuxdo',
      field: 'linux_do_id',
      name: 'LinuxDO',
      enabled: Boolean(statusInfo.linuxdo_oauth),
      value: getBuiltInBindingValue('linux_do_id'),
      icon: (
        <SiLinux size={20} className='text-foreground' />
      ),
    },
  ];

  const customBindingMap = new Map(
    customOAuthBindings.map((item) => [Number(item.provider_id), item]),
  );

  const customProviderMap = new Map(
    (statusInfo.custom_oauth_providers || []).map((provider) => [
      Number(provider.id),
      provider,
    ]),
  );

  customOAuthBindings.forEach((binding) => {
    if (!customProviderMap.has(Number(binding.provider_id))) {
      customProviderMap.set(Number(binding.provider_id), {
        id: binding.provider_id,
        name: binding.provider_name,
        icon: binding.provider_icon,
      });
    }
  });

  const customBindingItems = Array.from(customProviderMap.values()).map(
    (provider) => {
      const binding = customBindingMap.get(Number(provider.id));
      return {
        key: `custom-${provider.id}`,
        providerId: provider.id,
        name: provider.name,
        enabled: true,
        value: binding?.provider_user_id || '',
        icon: getOAuthProviderIcon(
          provider.icon || binding?.provider_icon || '',
          20,
        ),
      };
    },
  );

  const allBindingItems = [
    ...builtInBindingItems.map((item) => ({ ...item, type: 'builtin' })),
    ...customBindingItems.map((item) => ({ ...item, type: 'custom' })),
  ];

  const boundCount = allBindingItems.filter((item) =>
    Boolean(item.value),
  ).length;

  const visibleBindingItems = showBoundOnly
    ? allBindingItems.filter((item) => Boolean(item.value))
    : allBindingItems;

  const modalState = useOverlayState({
    isOpen: !!visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onCancel?.();
    },
  });

  return (
    <>
      <Modal state={modalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer
            size={isMobile ? 'full' : 'xl'}
            placement='center'
          >
            <ModalDialog className='bg-background/95 backdrop-blur'>
              <ModalHeader className='border-b border-border'>
                <div className='flex items-center gap-2'>
                  <LinkIcon size={18} />
                  {t('账户绑定管理')}
                </div>
              </ModalHeader>
              <ModalBody className='max-h-[68vh] overflow-y-auto px-6 py-5'>
                {bindingLoading ? (
                  <div className='flex items-center justify-center py-10'>
                    <Spinner />
                  </div>
                ) : (
                  <>
                    <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
                      <label className='inline-flex cursor-pointer items-center gap-2 text-sm text-foreground'>
                        <input
                          type='checkbox'
                          checked={showBoundOnly}
                          onChange={(event) =>
                            setShowBoundOnly(Boolean(event.target.checked))
                          }
                          className='h-4 w-4 accent-primary'
                        />
                        {t('仅显示已绑定')}
                      </label>
                      <span className='text-sm text-muted'>
                        {t('已绑定')} {boundCount} / {allBindingItems.length}
                      </span>
                    </div>

                    {visibleBindingItems.length === 0 ? (
                      <Card className='!rounded-xl border-2 border-dashed border-[color:var(--app-border)]'>
                        <Card.Content className='p-5 text-sm text-muted'>
                          {t('暂无已绑定项')}
                        </Card.Content>
                      </Card>
                    ) : (
                      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
                        {visibleBindingItems.map((item, index) => {
                          const isBound = Boolean(item.value);
                          const loadingKey =
                            item.type === 'builtin'
                              ? `builtin-${item.key}`
                              : `custom-${item.providerId}`;
                          const statusText = isBound
                            ? item.value
                            : item.enabled
                              ? t('未绑定')
                              : t('未启用');
                          const shouldSpanTwoCols =
                            visibleBindingItems.length % 2 === 1 &&
                            index === visibleBindingItems.length - 1;

                          return (
                            <Card
                              key={item.key}
                              className={`!rounded-xl border border-[color:var(--app-border)] shadow-sm ${
                                shouldSpanTwoCols ? 'lg:col-span-2' : ''
                              }`}
                            >
                              <Card.Content className='flex min-h-[92px] items-center justify-between gap-3 p-4'>
                                <div className='flex flex-1 items-center min-w-0'>
                                  <div className='mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-secondary'>
                                    {item.icon}
                                  </div>
                                  <div className='min-w-0 flex-1'>
                                    <div className='flex items-center gap-2 text-sm font-medium text-foreground'>
                                      <span>{item.name}</span>
                                      <span className='inline-flex items-center rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-foreground'>
                                        {item.type === 'builtin'
                                          ? t('内置')
                                          : t('自定义')}
                                      </span>
                                    </div>
                                    <div className='truncate text-xs text-muted'>
                                      {statusText}
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  color='danger'
                                  variant='light'
                                  size='sm'
                                  startContent={<Trash2 size={14} />}
                                  isDisabled={!isBound}
                                  isPending={Boolean(
                                    bindingActionLoading[loadingKey],
                                  )}
                                  onPress={() => {
                                    if (item.type === 'builtin') {
                                      requestUnbind({
                                        kind: 'builtin',
                                        bindingItem: item,
                                        name: item.name,
                                      });
                                    } else {
                                      requestUnbind({
                                        kind: 'custom',
                                        provider: {
                                          id: item.providerId,
                                          name: item.name,
                                        },
                                        name: item.name,
                                      });
                                    }
                                  }}
                                >
                                  {t('解绑')}
                                </Button>
                              </Card.Content>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </ModalBody>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>

      <ConfirmDialog
        visible={!!pendingUnbind}
        title={t('确认解绑')}
        cancelText={t('取消')}
        confirmText={t('确认')}
        danger
        onCancel={() => setPendingUnbind(null)}
        onConfirm={() => {
          const target = pendingUnbind;
          setPendingUnbind(null);
          if (!target) return;
          if (target.kind === 'builtin') performUnbindBuiltIn(target.bindingItem);
          else performUnbindCustom(target.provider);
        }}
      >
        {t('确定要解绑 {{name}} 吗？', { name: pendingUnbind?.name || '' })}
      </ConfirmDialog>
    </>
  );
};

export default UserBindingManagementModal;

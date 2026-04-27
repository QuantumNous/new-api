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
import { useTranslation } from 'react-i18next';
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
  useOverlayState,
} from '@heroui/react';
import {
  Edit3,
  Link as LinkIcon,
  Save,
  User,
  Users,
  X,
} from 'lucide-react';
import {
  API,
  showError,
  showSuccess,
  renderQuota,
  getCurrencyConfig,
} from '../../../../helpers';
import {
  quotaToDisplayAmount,
  displayAmountToQuota,
} from '../../../../helpers/quota';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import UserBindingManagementModal from './UserBindingManagementModal';

const TAG_TONE = {
  green: 'bg-success/15 text-success',
  blue: 'bg-primary/15 text-primary',
};

function StatusChip({ tone, children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
        TAG_TONE[tone] || TAG_TONE.blue
      }`}
    >
      {children}
    </span>
  );
}

function IconTile({ tone, children }) {
  const cls =
    {
      blue: 'bg-primary/10 text-primary',
      green: 'bg-success/10 text-success',
      purple:
        'bg-[color-mix(in_oklab,var(--app-primary)_8%,transparent)] text-[color-mix(in_oklab,var(--app-primary)_82%,var(--app-foreground))]',
    }[tone] || 'bg-primary/10 text-primary';
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cls}`}
    >
      {children}
    </div>
  );
}

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

const INIT_VALUES = {
  username: '',
  display_name: '',
  password: '',
  github_id: '',
  oidc_id: '',
  discord_id: '',
  wechat_id: '',
  telegram_id: '',
  linux_do_id: '',
  email: '',
  quota: 0,
  quota_amount: 0,
  group: 'default',
  remark: '',
};

const EditUserModal = (props) => {
  const { t } = useTranslation();
  const userId = props.editingUser?.id;
  const isEdit = Boolean(userId);
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState(INIT_VALUES);
  const [errors, setErrors] = useState({});
  const [groupOptions, setGroupOptions] = useState([]);
  const [bindingModalVisible, setBindingModalVisible] = useState(false);

  // Quota-adjust modal state
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustQuotaLocal, setAdjustQuotaLocal] = useState('');
  const [adjustAmountLocal, setAdjustAmountLocal] = useState('');
  const [adjustMode, setAdjustMode] = useState('add');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [showAdjustQuotaRaw, setShowAdjustQuotaRaw] = useState(false);
  const [showQuotaInput, setShowQuotaInput] = useState(false);

  const adjustModalState = useOverlayState({
    isOpen: adjustModalOpen,
    onOpenChange: (isOpen) => {
      if (!isOpen) {
        setAdjustModalOpen(false);
        setAdjustQuotaLocal('');
        setAdjustAmountLocal('');
        setAdjustMode('add');
      }
    },
  });

  const setField = (key) => (value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const fetchGroups = async () => {
    try {
      const res = await API.get(`/api/group/`);
      setGroupOptions(
        (res.data?.data || []).map((g) => ({ label: g, value: g })),
      );
    } catch (e) {
      showError(e.message);
    }
  };

  const handleCancel = () => props.handleClose();

  const loadUser = async () => {
    setLoading(true);
    const url = userId ? `/api/user/${userId}` : `/api/user/self`;
    const res = await API.get(url);
    const { success, message, data } = res.data || {};
    if (success && data) {
      data.password = '';
      data.quota_amount = Number(
        quotaToDisplayAmount(data.quota || 0).toFixed(6),
      );
      setValues({ ...INIT_VALUES, ...data });
      setErrors({});
    } else {
      showError(message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUser();
    if (userId) fetchGroups();
    setBindingModalVisible(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.editingUser?.id]);

  // ESC-to-close
  useEffect(() => {
    if (!props.visible) return;
    const onKey = (event) => {
      if (event.key === 'Escape' && !adjustModalOpen) handleCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.visible, adjustModalOpen]);

  const validate = () => {
    const next = {};
    if (!values.username?.trim()) next.username = t('请输入用户名');
    if (isEdit && !values.group) next.group = t('请选择分组');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setLoading(true);
    const payload = { ...values };
    delete payload.quota;
    delete payload.quota_amount;
    if (userId) {
      payload.id = parseInt(userId);
    }
    const url = userId ? `/api/user/` : `/api/user/self`;
    const res = await API.put(url, payload);
    const { success, message } = res.data || {};
    if (success) {
      showSuccess(t('用户信息更新成功！'));
      props.refresh?.();
      props.handleClose();
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const adjustQuota = async () => {
    const quotaVal = parseInt(adjustQuotaLocal) || 0;
    if (quotaVal <= 0 && adjustMode !== 'override') return;
    if (
      adjustMode === 'override' &&
      (adjustQuotaLocal === '' || adjustQuotaLocal == null)
    ) {
      return;
    }
    setAdjustLoading(true);
    try {
      const res = await API.post('/api/user/manage', {
        id: parseInt(userId),
        action: 'add_quota',
        mode: adjustMode,
        value: adjustMode === 'override' ? quotaVal : Math.abs(quotaVal),
      });
      const { success, message } = res.data || {};
      if (success) {
        showSuccess(t('调整额度成功'));
        setAdjustModalOpen(false);
        setAdjustQuotaLocal('');
        setAdjustAmountLocal('');
        const userRes = await API.get(`/api/user/${userId}`);
        if (userRes.data.success) {
          const data = userRes.data.data;
          data.password = '';
          data.quota_amount = Number(
            quotaToDisplayAmount(data.quota || 0).toFixed(6),
          );
          setValues({ ...INIT_VALUES, ...data });
        }
        props.refresh?.();
      } else {
        showError(message);
      }
    } catch (e) {
      showError(e.message);
    }
    setAdjustLoading(false);
  };

  const getPreviewText = () => {
    const current = values.quota || 0;
    const val = parseInt(adjustQuotaLocal) || 0;
    let result;
    switch (adjustMode) {
      case 'add':
        result = current + Math.abs(val);
        return `${t('当前额度')}：${renderQuota(current)}，+${renderQuota(Math.abs(val))} = ${renderQuota(result)}`;
      case 'subtract':
        result = current - Math.abs(val);
        return `${t('当前额度')}：${renderQuota(current)}，-${renderQuota(Math.abs(val))} = ${renderQuota(result)}`;
      case 'override':
        return `${t('当前额度')}：${renderQuota(current)} → ${renderQuota(val)}`;
      default:
        return '';
    }
  };

  const ADJUST_MODES = [
    { value: 'add', label: t('添加') },
    { value: 'subtract', label: t('减少') },
    { value: 'override', label: t('覆盖') },
  ];

  return (
    <>
      <div
        aria-hidden={!props.visible}
        onClick={handleCancel}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          props.visible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        role='dialog'
        aria-modal='true'
        aria-hidden={!props.visible}
        style={{ width: isMobile ? '100%' : 600 }}
        className={`fixed bottom-0 right-0 top-0 z-50 flex flex-col bg-background shadow-2xl transition-transform duration-300 ease-out ${
          props.visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className='flex items-center justify-between gap-3 border-b border-border px-5 py-3'>
          <div className='flex items-center gap-2'>
            <StatusChip tone='blue'>
              {t(isEdit ? '编辑' : '新建')}
            </StatusChip>
            <h4 className='m-0 text-lg font-semibold text-foreground'>
              {isEdit ? t('编辑用户') : t('创建用户')}
            </h4>
          </div>
          <Button
            isIconOnly
            variant='light'
            size='sm'
            aria-label={t('关闭')}
            onPress={handleCancel}
          >
            <X size={16} />
          </Button>
        </header>

        <div className='relative flex-1 overflow-y-auto p-3'>
          {loading && (
            <div className='absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[1px]'>
              <Spinner color='primary' />
            </div>
          )}

          <div className='space-y-3'>
            {/* 基本信息 */}
            <Card className='!rounded-2xl border-0 shadow-sm'>
              <Card.Content className='space-y-4 p-5'>
                <div className='flex items-center gap-2'>
                  <IconTile tone='blue'>
                    <User size={16} />
                  </IconTile>
                  <div>
                    <div className='text-base font-semibold text-foreground'>
                      {t('基本信息')}
                    </div>
                    <div className='text-xs text-muted'>
                      {t('用户的基本账户信息')}
                    </div>
                  </div>
                </div>

                <div className='space-y-3'>
                  <div className='space-y-2'>
                    <FieldLabel required>{t('用户名')}</FieldLabel>
                    <input
                      type='text'
                      value={values.username || ''}
                      onChange={(event) =>
                        setField('username')(event.target.value)
                      }
                      placeholder={t('请输入新的用户名')}
                      className={inputClass}
                    />
                    <FieldError>{errors.username}</FieldError>
                  </div>

                  <div className='space-y-2'>
                    <FieldLabel>{t('密码')}</FieldLabel>
                    <input
                      type='password'
                      value={values.password || ''}
                      onChange={(event) =>
                        setField('password')(event.target.value)
                      }
                      placeholder={t('请输入新的密码，最短 8 位')}
                      className={inputClass}
                    />
                  </div>

                  <div className='space-y-2'>
                    <FieldLabel>{t('显示名称')}</FieldLabel>
                    <input
                      type='text'
                      value={values.display_name || ''}
                      onChange={(event) =>
                        setField('display_name')(event.target.value)
                      }
                      placeholder={t('请输入新的显示名称')}
                      className={inputClass}
                    />
                  </div>

                  <div className='space-y-2'>
                    <FieldLabel>{t('备注')}</FieldLabel>
                    <input
                      type='text'
                      value={values.remark || ''}
                      onChange={(event) =>
                        setField('remark')(event.target.value)
                      }
                      placeholder={t('请输入备注（仅管理员可见）')}
                      className={inputClass}
                    />
                  </div>
                </div>
              </Card.Content>
            </Card>

            {/* 权限设置 */}
            {userId && (
              <Card className='!rounded-2xl border-0 shadow-sm'>
                <Card.Content className='space-y-4 p-5'>
                  <div className='flex items-center gap-2'>
                    <IconTile tone='green'>
                      <Users size={16} />
                    </IconTile>
                    <div>
                      <div className='text-base font-semibold text-foreground'>
                        {t('权限设置')}
                      </div>
                      <div className='text-xs text-muted'>
                        {t('用户分组和额度管理')}
                      </div>
                    </div>
                  </div>

                  <div className='space-y-3'>
                    <div className='space-y-2'>
                      <FieldLabel required>{t('分组')}</FieldLabel>
                      <select
                        value={values.group || ''}
                        onChange={(event) =>
                          setField('group')(event.target.value)
                        }
                        className={inputClass}
                      >
                        <option value=''>{t('请选择分组')}</option>
                        {groupOptions.map((g) => (
                          <option key={g.value} value={g.value}>
                            {g.label}
                          </option>
                        ))}
                      </select>
                      <FieldError>{errors.group}</FieldError>
                    </div>

                    <div className='grid grid-cols-1 gap-3 sm:grid-cols-12'>
                      <div className='space-y-2 sm:col-span-5'>
                        <FieldLabel>{t('金额')}</FieldLabel>
                        <div className='relative'>
                          <span className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted'>
                            {getCurrencyConfig().symbol}
                          </span>
                          <input
                            type='number'
                            value={values.quota_amount ?? 0}
                            readOnly
                            className={`${inputClass} pl-8 cursor-not-allowed`}
                          />
                        </div>
                      </div>
                      <div className='space-y-2 sm:col-span-7'>
                        <FieldLabel>{t('调整额度')}</FieldLabel>
                        <Button
                          variant='flat'
                          startContent={<Edit3 size={14} />}
                          onPress={() => setAdjustModalOpen(true)}
                        >
                          {t('调整额度')}
                        </Button>
                      </div>
                    </div>

                    <div>
                      <button
                        type='button'
                        className='cursor-pointer text-xs text-muted hover:text-foreground'
                        onClick={() => setShowQuotaInput((v) => !v)}
                      >
                        {showQuotaInput
                          ? `▾ ${t('收起原生额度输入')}`
                          : `▸ ${t('使用原生额度输入')}`}
                      </button>
                      {showQuotaInput && (
                        <div className='mt-2 space-y-2'>
                          <FieldLabel>{t('额度')}</FieldLabel>
                          <input
                            type='number'
                            value={values.quota ?? 0}
                            readOnly
                            placeholder={t('请输入额度')}
                            className={`${inputClass} cursor-not-allowed`}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </Card.Content>
              </Card>
            )}

            {/* 绑定信息入口 */}
            {userId && (
              <Card className='!rounded-2xl border-0 shadow-sm'>
                <Card.Content className='p-5'>
                  <div className='flex items-center justify-between gap-3'>
                    <div className='flex items-center gap-2 min-w-0'>
                      <IconTile tone='purple'>
                        <LinkIcon size={16} />
                      </IconTile>
                      <div className='min-w-0'>
                        <div className='text-base font-semibold text-foreground'>
                          {t('绑定信息')}
                        </div>
                        <div className='text-xs text-muted'>
                          {t(
                            '管理用户已绑定的第三方账户，支持筛选与解绑',
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant='bordered'
                      color='primary'
                      onPress={() => setBindingModalVisible(true)}
                    >
                      {t('管理绑定')}
                    </Button>
                  </div>
                </Card.Content>
              </Card>
            )}
          </div>
        </div>

        <footer className='flex justify-end gap-2 border-t border-border bg-background px-5 py-3'>
          <Button
            variant='light'
            startContent={<X size={14} />}
            onPress={handleCancel}
          >
            {t('取消')}
          </Button>
          <Button
            color='primary'
            isPending={loading}
            startContent={<Save size={14} />}
            onPress={submit}
          >
            {t('提交')}
          </Button>
        </footer>
      </aside>

      <UserBindingManagementModal
        visible={bindingModalVisible}
        onCancel={() => setBindingModalVisible(false)}
        userId={userId}
        isMobile={isMobile}
        // formApiRef is no longer used; kept for backward compat with the
        // child modal's prop signature.
      />

      {/* 调整额度模态框 */}
      <Modal state={adjustModalState}>
        <ModalBackdrop variant='blur'>
          <ModalContainer size='md' placement='center'>
            <ModalDialog className='bg-background/95 backdrop-blur'>
              <ModalHeader className='border-b border-border'>
                <div className='flex items-center gap-2'>
                  <Edit3 size={16} className='text-primary' />
                  <span>{t('调整额度')}</span>
                </div>
              </ModalHeader>
              <ModalBody className='space-y-4 px-6 py-5'>
                <div className='text-sm text-muted'>{getPreviewText()}</div>

                <div className='space-y-2'>
                  <FieldLabel>{t('操作')}</FieldLabel>
                  <div className='inline-flex w-full overflow-hidden rounded-xl border border-border'>
                    {ADJUST_MODES.map((mode) => {
                      const active = mode.value === adjustMode;
                      return (
                        <button
                          key={mode.value}
                          type='button'
                          onClick={() => {
                            setAdjustMode(mode.value);
                            setAdjustQuotaLocal('');
                            setAdjustAmountLocal('');
                          }}
                          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                            active
                              ? 'bg-foreground text-background'
                              : 'bg-background text-muted hover:bg-surface-secondary'
                          }`}
                        >
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className='space-y-2'>
                  <FieldLabel>{t('金额')}</FieldLabel>
                  <div className='relative'>
                    <span className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted'>
                      {getCurrencyConfig().symbol}
                    </span>
                    <input
                      type='number'
                      value={adjustAmountLocal}
                      step={0.000001}
                      min={adjustMode === 'override' ? undefined : 0}
                      onChange={(event) => {
                        const raw = event.target.value;
                        const amount = raw === '' ? '' : Number(raw);
                        setAdjustAmountLocal(amount);
                        setAdjustQuotaLocal(
                          amount === ''
                            ? ''
                            : adjustMode === 'override'
                              ? displayAmountToQuota(amount)
                              : displayAmountToQuota(Math.abs(amount)),
                        );
                      }}
                      placeholder={t('输入金额')}
                      className={`${inputClass} pl-8`}
                    />
                  </div>
                </div>

                <div>
                  <button
                    type='button'
                    className='cursor-pointer text-xs text-muted hover:text-foreground'
                    onClick={() => setShowAdjustQuotaRaw((v) => !v)}
                  >
                    {showAdjustQuotaRaw
                      ? `▾ ${t('收起原生额度输入')}`
                      : `▸ ${t('使用原生额度输入')}`}
                  </button>
                  {showAdjustQuotaRaw && (
                    <div className='mt-2 space-y-2'>
                      <FieldLabel>{t('额度')}</FieldLabel>
                      <input
                        type='number'
                        value={adjustQuotaLocal}
                        step={500000}
                        min={adjustMode === 'override' ? undefined : 0}
                        onChange={(event) => {
                          const raw = event.target.value;
                          const quota = raw === '' ? '' : Number(raw);
                          setAdjustQuotaLocal(quota);
                          setAdjustAmountLocal(
                            quota === ''
                              ? ''
                              : adjustMode === 'override'
                                ? Number(
                                    quotaToDisplayAmount(quota).toFixed(6),
                                  )
                                : Number(
                                    quotaToDisplayAmount(
                                      Math.abs(quota),
                                    ).toFixed(6),
                                  ),
                          );
                        }}
                        placeholder={t('输入额度')}
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>
              </ModalBody>
              <ModalFooter className='border-t border-border'>
                <Button
                  variant='light'
                  onPress={() => {
                    setAdjustModalOpen(false);
                    setAdjustQuotaLocal('');
                    setAdjustAmountLocal('');
                    setAdjustMode('add');
                  }}
                >
                  {t('取消')}
                </Button>
                <Button
                  color='primary'
                  isPending={adjustLoading}
                  onPress={adjustQuota}
                >
                  {t('确定')}
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>
    </>
  );
};

export default EditUserModal;

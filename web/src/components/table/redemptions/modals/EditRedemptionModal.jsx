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
import { useTranslation } from 'react-i18next';
import {
  API,
  downloadTextAsFile,
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
import { Button, Card, Input, Spinner } from '@heroui/react';
import { CreditCard, Gift, Save, X } from 'lucide-react';
import ConfirmDialog from '@/components/common/ui/ConfirmDialog';

const inputClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:opacity-50';

function NumberField({ label, value, onChange, min, step, prefix, helper, error, placeholder }) {
  return (
    <div className='space-y-2'>
      <div className='text-sm font-medium text-foreground'>{label}</div>
      <div className='flex h-10 items-center overflow-hidden rounded-lg border border-[color:var(--app-border)] bg-background text-sm transition focus-within:border-primary'>
        {prefix ? (
          <span className='whitespace-nowrap pl-3 text-muted'>{prefix}</span>
        ) : null}
        <input
          type='number'
          value={value === '' || value == null ? '' : String(value)}
          onChange={(event) => {
            const v = event.target.value;
            onChange(v === '' ? '' : Number(v));
          }}
          min={min}
          step={step}
          placeholder={placeholder}
          aria-label={label}
          className='h-full min-w-0 flex-1 bg-transparent px-3 text-foreground outline-none'
        />
      </div>
      {error ? (
        <div className='text-xs text-red-600 dark:text-red-400'>{error}</div>
      ) : helper ? (
        <div className='text-xs leading-snug text-muted'>{helper}</div>
      ) : null}
    </div>
  );
}

function toLocalDateTimeInputValue(date) {
  if (!date) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

const EditRedemptionModal = (props) => {
  const { t } = useTranslation();
  const isEdit = props.editingRedemption.id !== undefined;
  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [showQuotaInput, setShowQuotaInput] = useState(false);
  const [postCreateConfirm, setPostCreateConfirm] = useState(null);
  const [errors, setErrors] = useState({});

  const [values, setValues] = useState(() => ({
    name: '',
    quota: 100000,
    amount: Number(quotaToDisplayAmount(100000).toFixed(6)),
    count: 1,
    expired_time: null,
  }));

  const setField = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const reset = () => {
    setValues({
      name: '',
      quota: 100000,
      amount: Number(quotaToDisplayAmount(100000).toFixed(6)),
      count: 1,
      expired_time: null,
    });
    setErrors({});
  };

  const handleCancel = () => {
    props.handleClose?.();
  };

  useEffect(() => {
    if (!props.visiable) return;
    const onKey = (event) => {
      if (event.key === 'Escape') handleCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.visiable]);

  const loadRedemption = async () => {
    setLoading(true);
    try {
      const res = await API.get(
        `/api/redemption/${props.editingRedemption.id}`,
      );
      const { success, message, data } = res.data;
      if (success) {
        const expired =
          data.expired_time === 0 ? null : new Date(data.expired_time * 1000);
        setValues({
          name: data.name || '',
          quota: data.quota || 0,
          amount: Number(quotaToDisplayAmount(data.quota || 0).toFixed(6)),
          count: 1,
          expired_time: expired,
        });
      } else {
        showError(message);
      }
    } catch (error) {
      showError(t('加载兑换码信息失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!props.visiable) {
      reset();
      return;
    }
    if (isEdit) {
      loadRedemption();
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.visiable, props.editingRedemption?.id]);

  const validate = () => {
    const next = {};
    if (isEdit && !values.name?.trim()) {
      next.name = t('请输入名称');
    }
    const amount = Number(values.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      next.amount = t('请输入金额');
    }
    if (!isEdit) {
      const c = parseInt(values.count, 10);
      if (!Number.isFinite(c) || c <= 0) next.count = t('生成数量必须大于0');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    let name = values.name;
    if (!isEdit && (!name || name === '')) {
      name = renderQuota(values.quota);
    }
    setSubmitting(true);
    const localInputs = {
      ...values,
      count: parseInt(values.count, 10) || 0,
      quota: displayAmountToQuota(values.amount),
      name,
    };
    if (localInputs.quota <= 0) {
      showError(t('请输入金额'));
      setSubmitting(false);
      return;
    }
    if (!localInputs.expired_time) {
      localInputs.expired_time = 0;
    } else {
      localInputs.expired_time = Math.floor(
        localInputs.expired_time.getTime() / 1000,
      );
    }
    try {
      const res = isEdit
        ? await API.put(`/api/redemption/`, {
            ...localInputs,
            id: parseInt(props.editingRedemption.id),
          })
        : await API.post(`/api/redemption/`, { ...localInputs });
      const { success, message, data } = res.data;
      if (success) {
        if (isEdit) {
          showSuccess(t('兑换码更新成功！'));
        } else {
          showSuccess(t('兑换码创建成功！'));
        }
        props.refresh?.();
        props.handleClose?.();
      } else {
        showError(message);
      }
      if (!isEdit && data) {
        let text = '';
        for (let i = 0; i < data.length; i++) {
          text += data[i] + '\n';
        }
        setPostCreateConfirm({
          text,
          name: localInputs.name,
        });
      }
    } catch (error) {
      showError(t('提交失败'));
    } finally {
      setSubmitting(false);
    }
  };

  const placement = isEdit ? 'right' : 'left';

  return (
    <>
      <div
        aria-hidden={!props.visiable}
        onClick={handleCancel}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          props.visiable ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        role='dialog'
        aria-modal='true'
        aria-hidden={!props.visiable}
        style={{ width: isMobile ? '100%' : 600 }}
        className={`fixed bottom-0 top-0 z-50 flex flex-col bg-background shadow-2xl transition-transform duration-300 ease-out ${
          placement === 'right' ? 'right-0' : 'left-0'
        } ${
          props.visiable
            ? 'translate-x-0'
            : placement === 'right'
              ? 'translate-x-full'
              : '-translate-x-full'
        }`}
      >
        <header className='flex items-center justify-between gap-3 border-b border-[color:var(--app-border)] px-5 py-3'>
          <div className='flex items-center gap-2'>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                isEdit
                  ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
              }`}
            >
              {isEdit ? t('更新') : t('新建')}
            </span>
            <h4 className='m-0 text-lg font-semibold text-foreground'>
              {isEdit ? t('更新兑换码信息') : t('创建新的兑换码')}
            </h4>
          </div>
          <Button
            isIconOnly
            variant='tertiary'
            size='sm'
            aria-label={t('关闭')}
            onPress={handleCancel}
          >
            <X size={16} />
          </Button>
        </header>

        <div className='flex-1 overflow-y-auto p-3'>
          {loading ? (
            <div className='flex items-center justify-center py-10'>
              <Spinner />
            </div>
          ) : (
            <>
              <Card className='!rounded-2xl mb-6 border-0 shadow-sm'>
                <Card.Content className='space-y-4 p-5'>
                  <div className='flex items-center gap-2'>
                    <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 shadow-md dark:bg-sky-950/40 dark:text-sky-300'>
                      <Gift size={16} />
                    </div>
                    <div>
                      <div className='text-base font-semibold text-foreground'>
                        {t('基本信息')}
                      </div>
                      <div className='text-xs text-muted'>
                        {t('设置兑换码的基本信息')}
                      </div>
                    </div>
                  </div>

                  <div className='space-y-2'>
                    <div className='text-sm font-medium text-foreground'>
                      {t('名称')}
                      {isEdit ? (
                        <span className='ml-1 text-red-500'>*</span>
                      ) : null}
                    </div>
                    <Input
                      type='text'
                      value={values.name}
                      onChange={(event) => setField('name', event.target.value)}
                      placeholder={t('请输入名称')}
                      aria-label={t('名称')}
                      className={inputClass}
                    />
                    {errors.name ? (
                      <div className='text-xs text-red-600'>{errors.name}</div>
                    ) : null}
                  </div>

                  <div className='space-y-2'>
                    <div className='text-sm font-medium text-foreground'>
                      {t('过期时间')}
                    </div>
                    <input
                      type='datetime-local'
                      value={toLocalDateTimeInputValue(values.expired_time)}
                      onChange={(event) => {
                        const v = event.target.value;
                        setField(
                          'expired_time',
                          v ? new Date(v) : null,
                        );
                      }}
                      aria-label={t('过期时间')}
                      className={inputClass}
                    />
                    <div className='text-xs leading-snug text-muted'>
                      {t('选择过期时间（可选，留空为永久）')}
                    </div>
                  </div>
                </Card.Content>
              </Card>

              <Card className='!rounded-2xl border-0 shadow-sm'>
                <Card.Content className='space-y-4 p-5'>
                  <div className='flex items-center gap-2'>
                    <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-md dark:bg-emerald-950/40 dark:text-emerald-300'>
                      <CreditCard size={16} />
                    </div>
                    <div>
                      <div className='text-base font-semibold text-foreground'>
                        {t('额度设置')}
                      </div>
                      <div className='text-xs text-muted'>
                        {t('设置兑换码的额度和数量')}
                      </div>
                    </div>
                  </div>

                  <NumberField
                    label={t('金额')}
                    value={values.amount}
                    onChange={(val) => {
                      const amount = val === '' || val == null ? 0 : val;
                      setField('amount', amount);
                      setValues((prev) => ({
                        ...prev,
                        quota: displayAmountToQuota(amount),
                      }));
                    }}
                    min={0}
                    step={0.000001}
                    prefix={getCurrencyConfig().symbol}
                    placeholder={t('输入金额')}
                    error={errors.amount}
                  />

                  <div
                    className='cursor-pointer text-xs text-muted'
                    onClick={() => setShowQuotaInput((v) => !v)}
                  >
                    {showQuotaInput
                      ? `▾ ${t('收起原生额度输入')}`
                      : `▸ ${t('使用原生额度输入')}`}
                  </div>

                  {showQuotaInput ? (
                    <NumberField
                      label={t('额度')}
                      value={values.quota}
                      onChange={(val) => {
                        const quota = val === '' || val == null ? 0 : val;
                        setField('quota', quota);
                        setValues((prev) => ({
                          ...prev,
                          amount: Number(
                            quotaToDisplayAmount(quota).toFixed(6),
                          ),
                        }));
                      }}
                      min={0}
                      step={1}
                      placeholder={t('输入额度')}
                    />
                  ) : null}

                  {!isEdit ? (
                    <NumberField
                      label={t('生成数量')}
                      value={values.count}
                      onChange={(val) =>
                        setField('count', val === '' || val == null ? 1 : val)
                      }
                      min={1}
                      step={1}
                      error={errors.count}
                    />
                  ) : null}
                </Card.Content>
              </Card>
            </>
          )}
        </div>

        <footer className='flex justify-end gap-2 border-t border-[color:var(--app-border)] bg-[color:var(--app-background)] px-5 py-3'>
          <Button
            variant='tertiary'
            onPress={handleCancel}
            startContent={<X size={14} />}
          >
            {t('取消')}
          </Button>
          <Button
            color='primary'
            onPress={submit}
            isPending={submitting || loading}
            startContent={<Save size={14} />}
          >
            {t('提交')}
          </Button>
        </footer>
      </aside>

      <ConfirmDialog
        visible={!!postCreateConfirm}
        title={t('兑换码创建成功')}
        cancelText={t('取消')}
        confirmText={t('下载')}
        onCancel={() => setPostCreateConfirm(null)}
        onConfirm={() => {
          const target = postCreateConfirm;
          setPostCreateConfirm(null);
          if (target) downloadTextAsFile(target.text, `${target.name}.txt`);
        }}
      >
        <div className='space-y-1 text-sm text-foreground'>
          <p>{t('兑换码创建成功，是否下载兑换码？')}</p>
          <p className='text-muted'>
            {t('兑换码将以文本文件的形式下载，文件名为兑换码的名称。')}
          </p>
        </div>
      </ConfirmDialog>
    </>
  );
};

export default EditRedemptionModal;

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
  Input,
  ListBox,
  Select,
  Spinner,
  Switch,
} from '@heroui/react';
import { ChevronDown, X } from 'lucide-react';
import { API, showError, showSuccess } from '../../../../helpers';
import {
  quotaToDisplayAmount,
  displayAmountToQuota,
} from '../../../../helpers/quota';
import SideSheet from '../../../common/ui/SideSheet';

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

const inputClass =
  '!h-10 w-full !rounded-xl !border !border-border !bg-background !px-3 !text-sm !text-foreground outline-none transition focus:!border-primary disabled:opacity-50';

// HeroUI Select treats empty / null `selectedKey` as "no selection"
// (renders the placeholder). Round-trip optional values through a
// sentinel so we keep state-shape parity.
const SELECT_EMPTY_KEY = '__plan_select_empty__';
const toSelectKey = (value) => {
  if (value === undefined || value === null || value === '') {
    return SELECT_EMPTY_KEY;
  }
  return String(value);
};
const fromSelectKey = (key) => {
  if (key === null || key === undefined || key === SELECT_EMPTY_KEY) {
    return '';
  }
  return String(key);
};

// Reusable Select trigger styled to match `Input` exactly so all form
// fields sit on the same baseline.
function FormSelect({
  ariaLabel,
  placeholder,
  selectedKey,
  onSelectionChange,
  isDisabled,
  options,
}) {
  return (
    <Select
      aria-label={ariaLabel}
      placeholder={placeholder}
      selectedKey={selectedKey}
      onSelectionChange={onSelectionChange}
      isDisabled={isDisabled}
    >
      <Select.Trigger
        className={`${inputClass} flex items-center justify-between gap-2 cursor-pointer text-left`}
      >
        <Select.Value className='truncate' />
        <Select.Indicator>
          <ChevronDown size={14} className='text-muted' />
        </Select.Indicator>
      </Select.Trigger>
      <Select.Popover className='min-w-(--trigger-width)'>
        <ListBox>
          {options.map((o) => (
            <ListBox.Item
              key={String(o.value)}
              id={String(o.value)}
              textValue={o.label}
            >
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

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

const durationUnitOptions = [
  { value: 'year', label: '年' },
  { value: 'month', label: '月' },
  { value: 'day', label: '日' },
  { value: 'hour', label: '小时' },
  { value: 'custom', label: '自定义(秒)' },
];

const resetPeriodOptions = [
  { value: 'never', label: '不重置' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'custom', label: '自定义(秒)' },
];

const INIT_VALUES = {
  title: '',
  subtitle: '',
  price_amount: 0,
  currency: 'USD',
  duration_unit: 'month',
  duration_value: 1,
  custom_seconds: 0,
  quota_reset_period: 'never',
  quota_reset_custom_seconds: 0,
  enabled: true,
  sort_order: 0,
  max_purchase_per_user: 0,
  total_amount: 0,
  upgrade_group: '',
  stripe_price_id: '',
  creem_product_id: '',
};

const AddEditSubscriptionModal = ({
  visible,
  handleClose,
  editingPlan,
  placement = 'left',
  refresh,
  t,
}) => {
  const [loading, setLoading] = useState(false);
  const [groupOptions, setGroupOptions] = useState([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const isEdit = editingPlan?.plan?.id !== undefined;
  const [values, setValues] = useState(INIT_VALUES);
  const [errors, setErrors] = useState({});

  const buildFormValues = () => {
    if (editingPlan?.plan?.id === undefined) return INIT_VALUES;
    const p = editingPlan.plan || {};
    return {
      ...INIT_VALUES,
      title: p.title || '',
      subtitle: p.subtitle || '',
      price_amount: Number(p.price_amount || 0),
      currency: 'USD',
      duration_unit: p.duration_unit || 'month',
      duration_value: Number(p.duration_value || 1),
      custom_seconds: Number(p.custom_seconds || 0),
      quota_reset_period: p.quota_reset_period || 'never',
      quota_reset_custom_seconds: Number(p.quota_reset_custom_seconds || 0),
      enabled: p.enabled !== false,
      sort_order: Number(p.sort_order || 0),
      max_purchase_per_user: Number(p.max_purchase_per_user || 0),
      total_amount: Number(
        quotaToDisplayAmount(p.total_amount || 0).toFixed(2),
      ),
      upgrade_group: p.upgrade_group || '',
      stripe_price_id: p.stripe_price_id || '',
      creem_product_id: p.creem_product_id || '',
    };
  };

  useEffect(() => {
    if (!visible) return;
    setValues(buildFormValues());
    setErrors({});
    setGroupLoading(true);
    API.get('/api/group')
      .then((res) => {
        if (res.data?.success) {
          setGroupOptions(res.data?.data || []);
        } else {
          setGroupOptions([]);
        }
      })
      .catch(() => setGroupOptions([]))
      .finally(() => setGroupLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editingPlan?.plan?.id]);

  // ESC-to-close
  useEffect(() => {
    if (!visible) return;
    const onKey = (event) => {
      if (event.key === 'Escape') handleClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, handleClose]);

  const setField = (key) => (value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const setNumberField = (key) => (raw) => {
    const value = raw === '' ? '' : Number(raw);
    setField(key)(value);
  };

  const validate = () => {
    const next = {};
    if (!values.title || values.title.trim() === '') {
      next.title = t('请输入套餐标题');
    }
    if (
      values.price_amount === '' ||
      values.price_amount === null ||
      Number(values.price_amount) < 0
    ) {
      next.price_amount = t('请输入金额');
    }
    if (
      values.total_amount === '' ||
      values.total_amount === null ||
      Number(values.total_amount) < 0
    ) {
      next.total_amount = t('请输入总额度');
    }
    if (!values.duration_unit) {
      next.duration_unit = t('请选择有效期单位');
    }
    if (values.duration_unit === 'custom') {
      if (!values.custom_seconds || Number(values.custom_seconds) < 1) {
        next.custom_seconds = t('请输入秒数');
      }
    } else if (!values.duration_value || Number(values.duration_value) < 1) {
      next.duration_value = t('请输入数值');
    }
    if (
      values.quota_reset_period === 'custom' &&
      (!values.quota_reset_custom_seconds ||
        Number(values.quota_reset_custom_seconds) < 60)
    ) {
      next.quota_reset_custom_seconds = t('请输入秒数');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) {
      showError(t('请检查表单填写'));
      return;
    }
    setLoading(true);
    try {
      const payload = {
        plan: {
          ...values,
          price_amount: Number(values.price_amount || 0),
          currency: 'USD',
          duration_value: Number(values.duration_value || 0),
          custom_seconds: Number(values.custom_seconds || 0),
          quota_reset_period: values.quota_reset_period || 'never',
          quota_reset_custom_seconds:
            values.quota_reset_period === 'custom'
              ? Number(values.quota_reset_custom_seconds || 0)
              : 0,
          sort_order: Number(values.sort_order || 0),
          max_purchase_per_user: Number(values.max_purchase_per_user || 0),
          total_amount: displayAmountToQuota(values.total_amount),
          upgrade_group: values.upgrade_group || '',
        },
      };
      if (editingPlan?.plan?.id) {
        const res = await API.put(
          `/api/subscription/admin/plans/${editingPlan.plan.id}`,
          payload,
        );
        if (res.data?.success) {
          showSuccess(t('更新成功'));
          handleClose();
          refresh?.();
        } else {
          showError(res.data?.message || t('更新失败'));
        }
      } else {
        const res = await API.post('/api/subscription/admin/plans', payload);
        if (res.data?.success) {
          showSuccess(t('创建成功'));
          handleClose();
          refresh?.();
        } else {
          showError(res.data?.message || t('创建失败'));
        }
      }
    } catch (e) {
      showError(t('请求失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SideSheet
      visible={visible}
      onClose={handleClose}
      placement={placement}
      width={600}
    >
        <header className='flex items-center justify-between gap-3 border-b border-border px-5 py-3'>
          <div className='flex items-center gap-2'>
            <StatusChip tone={isEdit ? 'blue' : 'green'}>
              {isEdit ? t('更新') : t('新建')}
            </StatusChip>
            <h4 className='m-0 text-lg font-semibold text-foreground'>
              {isEdit ? t('更新套餐信息') : t('创建新的订阅套餐')}
            </h4>
          </div>
          <Button
            isIconOnly
            variant='tertiary'
            size='sm'
            aria-label={t('关闭')}
            onPress={handleClose}
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

          {/* 基本信息 — section header has no icon tile (per UX
              spec); title + subtitle alone gives enough hierarchy
              inside a single-card side sheet layout. */}
          <Card className='mb-3 !rounded-2xl border-0 shadow-sm'>
            <Card.Content className='space-y-4 p-5'>
              <div>
                <div className='text-base font-semibold text-foreground'>
                  {t('基本信息')}
                </div>
                <div className='text-xs text-muted'>
                  {t('套餐的基本信息和定价')}
                </div>
              </div>

              <div className='space-y-3'>
                <div className='space-y-2'>
                  <FieldLabel required>{t('套餐标题')}</FieldLabel>
                  <Input
                    type='text'
                    value={values.title}
                    onChange={(event) => setField('title')(event.target.value)}
                    placeholder={t('例如：基础套餐')}
                    aria-label={t('套餐标题')}
                    className={inputClass}
                  />
                  <FieldError>{errors.title}</FieldError>
                </div>

                <div className='space-y-2'>
                  <FieldLabel>{t('套餐副标题')}</FieldLabel>
                  <Input
                    type='text'
                    value={values.subtitle}
                    onChange={(event) =>
                      setField('subtitle')(event.target.value)
                    }
                    placeholder={t('例如：适合轻度使用')}
                    aria-label={t('套餐副标题')}
                    className={inputClass}
                  />
                </div>

                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                  <div className='space-y-2'>
                    <FieldLabel required>{t('实付金额')}</FieldLabel>
                    <Input
                      type='number'
                      min={0}
                      step={0.01}
                      value={values.price_amount}
                      onChange={(event) =>
                        setNumberField('price_amount')(event.target.value)
                      }
                      aria-label={t('实付金额')}
                      className={inputClass}
                    />
                    <FieldError>{errors.price_amount}</FieldError>
                  </div>
                  <div className='space-y-2'>
                    <FieldLabel required>{t('总额度')}</FieldLabel>
                    <Input
                      type='number'
                      min={0}
                      step={0.01}
                      value={values.total_amount}
                      onChange={(event) =>
                        setNumberField('total_amount')(event.target.value)
                      }
                      aria-label={t('总额度')}
                      className={inputClass}
                    />
                    <FieldHint>
                      {`${t('0 表示不限')} · ${t('原生额度')}：${displayAmountToQuota(
                        values.total_amount,
                      )}`}
                    </FieldHint>
                    <FieldError>{errors.total_amount}</FieldError>
                  </div>
                </div>

                <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                  <div className='space-y-2'>
                    <FieldLabel>{t('升级分组')}</FieldLabel>
                    <FormSelect
                      ariaLabel={t('升级分组')}
                      placeholder={t('不升级')}
                      selectedKey={toSelectKey(values.upgrade_group)}
                      onSelectionChange={(key) =>
                        setField('upgrade_group')(fromSelectKey(key))
                      }
                      isDisabled={groupLoading}
                      options={[
                        { value: '', label: t('不升级') },
                        ...(groupOptions || []).map((g) => ({
                          value: g,
                          label: g,
                        })),
                      ]}
                    />
                    <FieldHint>
                      {t(
                        '购买或手动新增订阅会升级到该分组；当套餐失效/过期或手动作废/删除后，将回退到升级前分组。回退不会立即生效，通常会有几分钟延迟。',
                      )}
                    </FieldHint>
                  </div>
                  <div className='space-y-2'>
                    <FieldLabel>{t('币种')}</FieldLabel>
                    <Input
                      type='text'
                      value={values.currency}
                      isDisabled
                      aria-label={t('币种')}
                      className={inputClass}
                    />
                    <FieldHint>{t('由全站货币展示设置统一控制')}</FieldHint>
                  </div>
                </div>

                <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
                  <div className='space-y-2'>
                    <FieldLabel>{t('排序')}</FieldLabel>
                    <Input
                      type='number'
                      step={1}
                      value={values.sort_order}
                      onChange={(event) =>
                        setNumberField('sort_order')(event.target.value)
                      }
                      aria-label={t('排序')}
                      className={inputClass}
                    />
                  </div>
                  <div className='space-y-2'>
                    <FieldLabel>{t('购买上限')}</FieldLabel>
                    <Input
                      type='number'
                      min={0}
                      step={1}
                      value={values.max_purchase_per_user}
                      onChange={(event) =>
                        setNumberField('max_purchase_per_user')(
                          event.target.value,
                        )
                      }
                      aria-label={t('购买上限')}
                      className={inputClass}
                    />
                    <FieldHint>{t('0 表示不限')}</FieldHint>
                  </div>
                  <div className='space-y-2'>
                    <FieldLabel>{t('启用状态')}</FieldLabel>
                    <div className='flex h-10 items-center'>
                      <Switch
                        isSelected={values.enabled}
                        onChange={setField('enabled')}
                        size='md'
                        aria-label={t('启用状态')}
                      >
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch>
                    </div>
                  </div>
                </div>
              </div>
            </Card.Content>
          </Card>

          {/* 有效期设置 */}
          <Card className='mb-3 !rounded-2xl border-0 shadow-sm'>
            <Card.Content className='space-y-4 p-5'>
              <div>
                <div className='text-base font-semibold text-foreground'>
                  {t('有效期设置')}
                </div>
                <div className='text-xs text-muted'>
                  {t('配置套餐的有效时长')}
                </div>
              </div>

              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <FieldLabel required>{t('有效期单位')}</FieldLabel>
                  <FormSelect
                    ariaLabel={t('有效期单位')}
                    placeholder={t('请选择有效期单位')}
                    selectedKey={toSelectKey(values.duration_unit)}
                    onSelectionChange={(key) =>
                      setField('duration_unit')(fromSelectKey(key))
                    }
                    options={durationUnitOptions.map((o) => ({
                      value: o.value,
                      label: t(o.label),
                    }))}
                  />
                </div>
                <div className='space-y-2'>
                  {values.duration_unit === 'custom' ? (
                    <>
                      <FieldLabel required>{t('自定义秒数')}</FieldLabel>
                      <Input
                        type='number'
                        min={1}
                        step={1}
                        value={values.custom_seconds}
                        onChange={(event) =>
                          setNumberField('custom_seconds')(event.target.value)
                        }
                        aria-label={t('自定义秒数')}
                        className={inputClass}
                      />
                      <FieldError>{errors.custom_seconds}</FieldError>
                    </>
                  ) : (
                    <>
                      <FieldLabel required>{t('有效期数值')}</FieldLabel>
                      <Input
                        type='number'
                        min={1}
                        step={1}
                        value={values.duration_value}
                        onChange={(event) =>
                          setNumberField('duration_value')(event.target.value)
                        }
                        aria-label={t('有效期数值')}
                        className={inputClass}
                      />
                      <FieldError>{errors.duration_value}</FieldError>
                    </>
                  )}
                </div>
              </div>
            </Card.Content>
          </Card>

          {/* 额度重置 */}
          <Card className='mb-3 !rounded-2xl border-0 shadow-sm'>
            <Card.Content className='space-y-4 p-5'>
              <div>
                <div className='text-base font-semibold text-foreground'>
                  {t('额度重置')}
                </div>
                <div className='text-xs text-muted'>
                  {t('支持周期性重置套餐权益额度')}
                </div>
              </div>

              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <FieldLabel>{t('重置周期')}</FieldLabel>
                  <FormSelect
                    ariaLabel={t('重置周期')}
                    placeholder={t('选择重置周期')}
                    selectedKey={toSelectKey(values.quota_reset_period)}
                    onSelectionChange={(key) =>
                      setField('quota_reset_period')(fromSelectKey(key))
                    }
                    options={resetPeriodOptions.map((o) => ({
                      value: o.value,
                      label: t(o.label),
                    }))}
                  />
                </div>
                <div className='space-y-2'>
                  <FieldLabel required={values.quota_reset_period === 'custom'}>
                    {t('自定义秒数')}
                  </FieldLabel>
                  <Input
                    type='number'
                    min={values.quota_reset_period === 'custom' ? 60 : 0}
                    step={1}
                    value={values.quota_reset_custom_seconds}
                    onChange={(event) =>
                      setNumberField('quota_reset_custom_seconds')(
                        event.target.value,
                      )
                    }
                    isDisabled={values.quota_reset_period !== 'custom'}
                    aria-label={t('自定义秒数')}
                    className={inputClass}
                  />
                  <FieldError>{errors.quota_reset_custom_seconds}</FieldError>
                </div>
              </div>
            </Card.Content>
          </Card>

          {/* 第三方支付配置 */}
          <Card className='!rounded-2xl border-0 shadow-sm'>
            <Card.Content className='space-y-4 p-5'>
              <div>
                <div className='text-base font-semibold text-foreground'>
                  {t('第三方支付配置')}
                </div>
                <div className='text-xs text-muted'>
                  {t('Stripe/Creem 商品ID（可选）')}
                </div>
              </div>

              <div className='space-y-3'>
                <div className='space-y-2'>
                  <FieldLabel>Stripe PriceId</FieldLabel>
                  <Input
                    type='text'
                    value={values.stripe_price_id}
                    onChange={(event) =>
                      setField('stripe_price_id')(event.target.value)
                    }
                    placeholder='price_...'
                    aria-label='Stripe PriceId'
                    className={inputClass}
                  />
                </div>
                <div className='space-y-2'>
                  <FieldLabel>Creem ProductId</FieldLabel>
                  <Input
                    type='text'
                    value={values.creem_product_id}
                    onChange={(event) =>
                      setField('creem_product_id')(event.target.value)
                    }
                    placeholder='prod_...'
                    aria-label='Creem ProductId'
                    className={inputClass}
                  />
                </div>
              </div>
            </Card.Content>
          </Card>
        </div>

        <footer className='flex justify-end gap-2 border-t border-border bg-background px-5 py-3'>
          <Button variant='tertiary' onPress={handleClose}>
            {t('取消')}
          </Button>
          <Button color='primary' isPending={loading} onPress={submit}>
            {t('提交')}
          </Button>
        </footer>
    </SideSheet>
  );
};

export default AddEditSubscriptionModal;

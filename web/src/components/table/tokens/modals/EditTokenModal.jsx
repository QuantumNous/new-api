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

import React, { useEffect, useState, useContext } from 'react';
import { Button, Card, Spinner, Switch } from '@heroui/react';
import {
  CreditCard,
  KeyRound,
  Link as LinkIcon,
  Save,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  API,
  showError,
  showSuccess,
  timestamp2string,
  getCurrencyConfig,
  getModelCategories,
} from '../../../../helpers';
import {
  quotaToDisplayAmount,
  displayAmountToQuota,
} from '../../../../helpers/quota';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import { StatusContext } from '../../../../context/Status';

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
  'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary';

const textareaClass =
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary';

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

// Replaces Semi `<Avatar>` icon-tile with a flat round container that
// follows the rest of /console.
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

const INIT_VALUES = {
  name: '',
  remain_quota: 0,
  remain_amount: 0,
  expired_time: -1,
  unlimited_quota: true,
  model_limits_enabled: false,
  model_limits: [],
  allow_ips: '',
  group: '',
  cross_group_retry: false,
  tokenCount: 1,
};

// Convert a server timestamp/string `expired_time` into the format
// expected by `<input type='datetime-local'>`. The original Semi
// `Form.DatePicker` accepted both -1 and a `YYYY-MM-DD HH:mm:ss` string.
const toDateTimeInputValue = (value) => {
  if (value === -1 || value === null || value === undefined || value === '') {
    return '';
  }
  if (typeof value === 'number') {
    const date = new Date(value * 1000);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 16);
  }
  // Server already gave us "YYYY-MM-DD HH:mm:ss"; convert to the
  // `<input>` format "YYYY-MM-DDTHH:mm".
  const time = Date.parse(value);
  if (Number.isNaN(time)) return '';
  const d = new Date(time);
  const pad = (n) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const EditTokenModal = (props) => {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();
  const [models, setModels] = useState([]);
  const [groups, setGroups] = useState([]);
  const [showQuotaInput, setShowQuotaInput] = useState(false);
  const [values, setValues] = useState(INIT_VALUES);
  const [errors, setErrors] = useState({});
  const isEdit = props.editingToken?.id !== undefined;

  const setField = (key) => (value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const reset = () => {
    setValues(INIT_VALUES);
    setErrors({});
    setShowQuotaInput(false);
  };

  // Sets `expired_time` to a timestamp (in seconds) `month`+`day`+`hour`
  // +`minute` from now. Passing all zeroes resets to "永不过期" (-1).
  const setExpiredTime = (month, day, hour, minute) => {
    const now = new Date();
    let timestamp = now.getTime() / 1000;
    let seconds =
      month * 30 * 24 * 60 * 60 +
      day * 24 * 60 * 60 +
      hour * 60 * 60 +
      minute * 60;
    if (seconds !== 0) {
      timestamp += seconds;
      setField('expired_time')(timestamp2string(timestamp));
    } else {
      setField('expired_time')(-1);
    }
  };

  const loadModels = async () => {
    try {
      const res = await API.get(`/api/user/models`);
      const { success, message, data } = res.data || {};
      if (success && Array.isArray(data)) {
        const categories = getModelCategories(t);
        const modelOptions = data.map((model) => {
          let icon = null;
          for (const [key, category] of Object.entries(categories)) {
            if (key !== 'all' && category.filter({ model_name: model })) {
              icon = category.icon;
              break;
            }
          }
          return {
            label: (
              <span className='flex items-center gap-1'>
                {icon}
                {model}
              </span>
            ),
            value: model,
          };
        });
        setModels(modelOptions);
      } else {
        showError(t(message || '获取模型列表失败'));
      }
    } catch (error) {
      showError(error?.response?.data?.message || error.message);
    }
  };

  const loadGroups = async () => {
    try {
      const res = await API.get(`/api/user/self/groups`);
      const { success, message, data } = res.data || {};
      if (success && data && typeof data === 'object') {
        let localGroupOptions = Object.entries(data).map(([group, info]) => ({
          label: info.desc,
          value: group,
          ratio: info.ratio,
        }));
        if (statusState?.status?.default_use_auto_group) {
          if (localGroupOptions.some((group) => group.value === 'auto')) {
            localGroupOptions.sort((a, b) => (a.value === 'auto' ? -1 : 1));
          }
        }
        setGroups(localGroupOptions);
      } else {
        showError(t(message || '获取分组列表失败'));
      }
    } catch (error) {
      showError(error?.response?.data?.message || error.message);
    }
  };

  const loadToken = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/api/token/${props.editingToken.id}`);
      const { success, message, data } = res.data || {};
      if (success && data) {
        // Defensive null-handling — server occasionally sends `null` for
        // empty model_limits, which used to throw `Cannot read properties of
        // null (reading 'map')` when consumers later did
        // `model_limits.split(',')`.
        const modelLimits =
          typeof data.model_limits === 'string' && data.model_limits !== ''
            ? data.model_limits.split(',')
            : [];
        const expired =
          data.expired_time && data.expired_time !== -1
            ? timestamp2string(data.expired_time)
            : -1;
        setValues({
          ...INIT_VALUES,
          ...data,
          expired_time: expired,
          model_limits: modelLimits,
          remain_amount: Number(
            quotaToDisplayAmount(data.remain_quota || 0).toFixed(6),
          ),
        });
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error?.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  // Initial load: models + groups regardless of edit/create
  useEffect(() => {
    loadModels();
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.editingToken?.id]);

  // Open: load existing token (edit) or reset (create)
  useEffect(() => {
    if (props.visiable) {
      if (isEdit) {
        loadToken();
      } else {
        reset();
      }
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.visiable, props.editingToken?.id]);

  // ESC-to-close
  useEffect(() => {
    if (!props.visiable) return;
    const onKey = (event) => {
      if (event.key === 'Escape') props.handleClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [props.visiable, props.handleClose]);

  const generateRandomSuffix = () => {
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(
        Math.floor(Math.random() * characters.length),
      );
    }
    return result;
  };

  const validate = () => {
    const next = {};
    if (!values.name?.trim()) {
      next.name = t('请输入名称');
    }
    if (values.expired_time !== -1) {
      const time = Date.parse(values.expired_time);
      if (Number.isNaN(time)) {
        next.expired_time = t('过期时间格式错误！');
      } else if (time <= Date.now()) {
        next.expired_time = t('过期时间不能早于当前时间！');
      }
    } else if (values.expired_time === '' || values.expired_time === null) {
      next.expired_time = t('请选择过期时间');
    }
    if (!values.unlimited_quota) {
      const amt = Number(values.remain_amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        next.remain_amount = t('请输入金额');
      }
    }
    if (!isEdit) {
      const count = parseInt(values.tokenCount, 10);
      if (!Number.isFinite(count) || count < 1) {
        next.tokenCount = t('请输入新建数量');
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleDateTimeChange = (raw) => {
    if (!raw) {
      setField('expired_time')(-1);
      return;
    }
    setField('expired_time')(raw.replace('T', ' ') + ':00');
  };

  const submit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      if (isEdit) {
        const { tokenCount: _tc, ...localInputs } = values;
        localInputs.remain_quota = localInputs.unlimited_quota
          ? 0
          : displayAmountToQuota(localInputs.remain_amount);
        if (localInputs.expired_time !== -1) {
          const time = Date.parse(localInputs.expired_time);
          localInputs.expired_time = Math.ceil(time / 1000);
        }
        const limits = Array.isArray(localInputs.model_limits)
          ? localInputs.model_limits
          : [];
        localInputs.model_limits = limits.join(',');
        localInputs.model_limits_enabled = limits.length > 0;
        const res = await API.put(`/api/token/`, {
          ...localInputs,
          id: parseInt(props.editingToken.id),
        });
        const { success, message } = res.data || {};
        if (success) {
          showSuccess(t('令牌更新成功！'));
          props.refresh();
          props.handleClose();
        } else {
          showError(t(message));
        }
      } else {
        const count = parseInt(values.tokenCount, 10) || 1;
        let successCount = 0;
        for (let i = 0; i < count; i++) {
          const { tokenCount: _tc, ...localInputs } = values;
          const baseName =
            values.name.trim() === '' ? 'default' : values.name.trim();
          if (i !== 0 || values.name.trim() === '') {
            localInputs.name = `${baseName}-${generateRandomSuffix()}`;
          } else {
            localInputs.name = baseName;
          }
          localInputs.remain_quota = localInputs.unlimited_quota
            ? 0
            : displayAmountToQuota(localInputs.remain_amount);
          if (localInputs.expired_time !== -1) {
            const time = Date.parse(localInputs.expired_time);
            localInputs.expired_time = Math.ceil(time / 1000);
          }
          const limits = Array.isArray(localInputs.model_limits)
            ? localInputs.model_limits
            : [];
          localInputs.model_limits = limits.join(',');
          localInputs.model_limits_enabled = limits.length > 0;
          const res = await API.post(`/api/token/`, localInputs);
          const { success, message } = res.data || {};
          if (success) {
            successCount++;
          } else {
            showError(t(message));
            break;
          }
        }
        if (successCount > 0) {
          showSuccess(t('令牌创建成功，请在列表页面点击复制获取令牌！'));
          props.refresh();
          props.handleClose();
        }
      }
    } finally {
      setLoading(false);
      reset();
    }
  };

  // Multi-select toggle for model limits
  const toggleModelLimit = (modelValue) => {
    setField('model_limits')(
      values.model_limits.includes(modelValue)
        ? values.model_limits.filter((m) => m !== modelValue)
        : [...values.model_limits, modelValue],
    );
  };

  const sidePlacement = isEdit ? 'right' : 'left';
  const slideOpen =
    sidePlacement === 'right' ? 'translate-x-0' : 'translate-x-0';
  const slideClose =
    sidePlacement === 'right' ? 'translate-x-full' : '-translate-x-full';
  const positionClass =
    sidePlacement === 'right'
      ? 'fixed bottom-0 right-0 top-0'
      : 'fixed bottom-0 left-0 top-0';

  return (
    <>
      <div
        aria-hidden={!props.visiable}
        onClick={props.handleClose}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          props.visiable ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        role='dialog'
        aria-modal='true'
        aria-hidden={!props.visiable}
        style={{ width: isMobile ? '100%' : 600 }}
        className={`${positionClass} z-50 flex flex-col bg-background shadow-2xl transition-transform duration-300 ease-out ${
          props.visiable ? slideOpen : slideClose
        }`}
      >
        <header className='flex items-center justify-between gap-3 border-b border-border px-5 py-3'>
          <div className='flex items-center gap-2'>
            <StatusChip tone={isEdit ? 'blue' : 'green'}>
              {isEdit ? t('更新') : t('新建')}
            </StatusChip>
            <h4 className='m-0 text-lg font-semibold text-foreground'>
              {isEdit ? t('更新令牌信息') : t('创建新的令牌')}
            </h4>
          </div>
          <Button
            isIconOnly
            variant='tertiary'
            size='sm'
            aria-label={t('关闭')}
            onPress={props.handleClose}
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

          {/* 基本信息 */}
          <Card className='mb-3 !rounded-2xl border-0 shadow-sm'>
            <Card.Content className='space-y-4 p-5'>
              <div className='flex items-center gap-2'>
                <IconTile tone='blue'>
                  <KeyRound size={16} />
                </IconTile>
                <div>
                  <div className='text-base font-semibold text-foreground'>
                    {t('基本信息')}
                  </div>
                  <div className='text-xs text-muted'>
                    {t('设置令牌的基本信息')}
                  </div>
                </div>
              </div>

              <div className='space-y-3'>
                <div className='space-y-2'>
                  <FieldLabel required>{t('名称')}</FieldLabel>
                  <input
                    type='text'
                    value={values.name}
                    onChange={(event) =>
                      setField('name')(event.target.value)
                    }
                    placeholder={t('请输入名称')}
                    className={inputClass}
                  />
                  <FieldError>{errors.name}</FieldError>
                </div>

                <div className='space-y-2'>
                  <FieldLabel>{t('令牌分组')}</FieldLabel>
                  {groups.length > 0 ? (
                    <select
                      value={values.group || ''}
                      onChange={(event) =>
                        setField('group')(event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value=''>
                        {t('令牌分组，默认为用户的分组')}
                      </option>
                      {groups.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                          {g.ratio !== undefined ? ` (${g.ratio}x)` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select disabled className={inputClass}>
                      <option>{t('管理员未设置用户可选分组')}</option>
                    </select>
                  )}
                </div>

                {values.group === 'auto' && (
                  <label className='flex items-center justify-between gap-3'>
                    <div>
                      <div className='text-sm font-medium text-foreground'>
                        {t('跨分组重试')}
                      </div>
                      <div className='text-xs text-muted'>
                        {t(
                          '开启后，当前分组渠道失败时会按顺序尝试下一个分组的渠道',
                        )}
                      </div>
                    </div>
                    <Switch
                      isSelected={values.cross_group_retry}
                      onValueChange={setField('cross_group_retry')}
                      size='sm'
                      aria-label={t('跨分组重试')}
                    >
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch>
                  </label>
                )}

                <div className='grid grid-cols-1 gap-3 lg:grid-cols-12'>
                  <div className='space-y-2 lg:col-span-5'>
                    <FieldLabel required>{t('过期时间')}</FieldLabel>
                    <input
                      type='datetime-local'
                      value={
                        values.expired_time === -1
                          ? ''
                          : toDateTimeInputValue(values.expired_time)
                      }
                      onChange={(event) =>
                        handleDateTimeChange(event.target.value)
                      }
                      className={inputClass}
                    />
                    {values.expired_time === -1 && (
                      <FieldHint>{t('当前：永不过期')}</FieldHint>
                    )}
                    <FieldError>{errors.expired_time}</FieldError>
                  </div>
                  <div className='space-y-2 lg:col-span-7'>
                    <FieldLabel>{t('过期时间快捷设置')}</FieldLabel>
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        size='sm'
                        variant='tertiary'
                        onPress={() => setExpiredTime(0, 0, 0, 0)}
                      >
                        {t('永不过期')}
                      </Button>
                      <Button
                        size='sm'
                        variant='tertiary'
                        onPress={() => setExpiredTime(1, 0, 0, 0)}
                      >
                        {t('一个月')}
                      </Button>
                      <Button
                        size='sm'
                        variant='tertiary'
                        onPress={() => setExpiredTime(0, 1, 0, 0)}
                      >
                        {t('一天')}
                      </Button>
                      <Button
                        size='sm'
                        variant='tertiary'
                        onPress={() => setExpiredTime(0, 0, 1, 0)}
                      >
                        {t('一小时')}
                      </Button>
                    </div>
                  </div>
                </div>

                {!isEdit && (
                  <div className='space-y-2'>
                    <FieldLabel required>{t('新建数量')}</FieldLabel>
                    <input
                      type='number'
                      min={1}
                      value={values.tokenCount}
                      onChange={(event) =>
                        setField('tokenCount')(
                          event.target.value === ''
                            ? ''
                            : Number(event.target.value),
                        )
                      }
                      className={inputClass}
                    />
                    <FieldHint>
                      {t('批量创建时会在名称后自动添加随机后缀')}
                    </FieldHint>
                    <FieldError>{errors.tokenCount}</FieldError>
                  </div>
                )}
              </div>
            </Card.Content>
          </Card>

          {/* 额度设置 */}
          <Card className='mb-3 !rounded-2xl border-0 shadow-sm'>
            <Card.Content className='space-y-4 p-5'>
              <div className='flex items-center gap-2'>
                <IconTile tone='green'>
                  <CreditCard size={16} />
                </IconTile>
                <div>
                  <div className='text-base font-semibold text-foreground'>
                    {t('额度设置')}
                  </div>
                  <div className='text-xs text-muted'>
                    {t('设置令牌可用额度和数量')}
                  </div>
                </div>
              </div>

              <div className='space-y-3'>
                <div className='space-y-2'>
                  <FieldLabel>{t('金额')}</FieldLabel>
                  <div className='relative'>
                    <span className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted'>
                      {getCurrencyConfig().symbol}
                    </span>
                    <input
                      type='number'
                      min={0}
                      step={0.000001}
                      value={
                        values.unlimited_quota
                          ? ''
                          : (values.remain_amount ?? 0)
                      }
                      disabled={values.unlimited_quota}
                      onChange={(event) => {
                        const raw = event.target.value;
                        const amount = raw === '' ? 0 : Number(raw);
                        setValues((prev) => ({
                          ...prev,
                          remain_amount: amount,
                          remain_quota: displayAmountToQuota(amount),
                        }));
                      }}
                      placeholder={t('输入金额')}
                      className={`${inputClass} pl-8 ${
                        values.unlimited_quota ? 'opacity-50' : ''
                      }`}
                    />
                  </div>
                  <FieldError>{errors.remain_amount}</FieldError>
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
                        min={0}
                        step={500000}
                        value={
                          values.unlimited_quota
                            ? ''
                            : (values.remain_quota ?? 0)
                        }
                        disabled={values.unlimited_quota}
                        onChange={(event) => {
                          const raw = event.target.value;
                          const quota = raw === '' ? 0 : Number(raw);
                          setValues((prev) => ({
                            ...prev,
                            remain_quota: quota,
                            remain_amount: Number(
                              quotaToDisplayAmount(quota).toFixed(6),
                            ),
                          }));
                        }}
                        placeholder={t('输入额度')}
                        className={`${inputClass} ${
                          values.unlimited_quota ? 'opacity-50' : ''
                        }`}
                      />
                    </div>
                  )}
                </div>

                <label className='flex items-center justify-between gap-3'>
                  <div>
                    <div className='text-sm font-medium text-foreground'>
                      {t('无限额度')}
                    </div>
                    <div className='text-xs text-muted'>
                      {t(
                        '令牌的额度仅用于限制令牌本身的最大额度使用量，实际的使用受到账户的剩余额度限制',
                      )}
                    </div>
                  </div>
                  <Switch
                    isSelected={values.unlimited_quota}
                    onValueChange={setField('unlimited_quota')}
                    size='sm'
                    aria-label={t('无限额度')}
                  >
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                </label>
              </div>
            </Card.Content>
          </Card>

          {/* 访问限制 */}
          <Card className='!rounded-2xl border-0 shadow-sm'>
            <Card.Content className='space-y-4 p-5'>
              <div className='flex items-center gap-2'>
                <IconTile tone='purple'>
                  <LinkIcon size={16} />
                </IconTile>
                <div>
                  <div className='text-base font-semibold text-foreground'>
                    {t('访问限制')}
                  </div>
                  <div className='text-xs text-muted'>
                    {t('设置令牌的访问限制')}
                  </div>
                </div>
              </div>

              <div className='space-y-3'>
                <div className='space-y-2'>
                  <FieldLabel>{t('模型限制列表')}</FieldLabel>
                  <div className='max-h-48 overflow-y-auto rounded-xl border border-border bg-background p-2'>
                    {models.length === 0 ? (
                      <div className='py-2 text-center text-xs text-muted'>
                        {t('暂无可选模型')}
                      </div>
                    ) : (
                      <div className='grid grid-cols-1 gap-1 sm:grid-cols-2'>
                        {models.map((model) => {
                          const checked = values.model_limits.includes(
                            model.value,
                          );
                          return (
                            <label
                              key={model.value}
                              className='flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm text-foreground hover:bg-surface-secondary'
                            >
                              <input
                                type='checkbox'
                                checked={checked}
                                onChange={() => toggleModelLimit(model.value)}
                                className='h-4 w-4 accent-primary'
                              />
                              <span className='min-w-0 truncate'>
                                {model.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <FieldHint>{t('非必要，不建议启用模型限制')}</FieldHint>
                </div>

                <div className='space-y-2'>
                  <FieldLabel>{t('IP白名单（支持CIDR表达式）')}</FieldLabel>
                  <textarea
                    value={values.allow_ips}
                    onChange={(event) =>
                      setField('allow_ips')(event.target.value)
                    }
                    placeholder={t('允许的IP，一行一个，不填写则不限制')}
                    rows={3}
                    className={textareaClass}
                  />
                  <FieldHint>
                    {t(
                      '请勿过度信任此功能，IP可能被伪造，请配合nginx和cdn等网关使用',
                    )}
                  </FieldHint>
                </div>
              </div>
            </Card.Content>
          </Card>
        </div>

        <footer className='flex justify-end gap-2 border-t border-border bg-background px-5 py-3'>
          <Button
            variant='tertiary'
            startContent={<X size={14} />}
            onPress={props.handleClose}
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
    </>
  );
};

export default EditTokenModal;

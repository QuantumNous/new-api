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

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Input, Switch } from '@heroui/react';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
  parseHttpStatusCodeRules,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';
import HttpStatusCodeRulesInput from '../../../components/settings/HttpStatusCodeRulesInput';

const DEFAULT_INPUTS = {
  ChannelDisableThreshold: '',
  QuotaRemindThreshold: '',
  AutomaticDisableChannelEnabled: false,
  AutomaticEnableChannelEnabled: false,
  AutomaticDisableKeywords: '',
  AutomaticDisableStatusCodes: '401',
  AutomaticRetryStatusCodes:
    '100-199,300-399,401-407,409-499,500-503,505-523,525-599',
  'monitor_setting.auto_test_channel_enabled': false,
  'monitor_setting.auto_test_channel_minutes': 10,
};

const BOOLEAN_FIELDS = new Set([
  'AutomaticDisableChannelEnabled',
  'AutomaticEnableChannelEnabled',
  'monitor_setting.auto_test_channel_enabled',
]);

const NUMERIC_FIELDS = new Set([
  'ChannelDisableThreshold',
  'QuotaRemindThreshold',
  'monitor_setting.auto_test_channel_minutes',
]);

function ToggleRow({ label, helper, isSelected, onValueChange }) {
  return (
    <label className='flex items-start justify-between gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-background)] p-4'>
      <div className='min-w-0 flex-1'>
        <div className='text-sm font-medium text-foreground'>{label}</div>
        {helper ? (
          <div className='mt-1 text-xs leading-snug text-muted'>{helper}</div>
        ) : null}
      </div>
      <Switch
        isSelected={!!isSelected}
        onChange={onValueChange}
        aria-label={label}
        size='sm'
      >
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch>
    </label>
  );
}

function NumberField({ label, value, onChange, suffix, helper, placeholder, min = 0 }) {
  return (
    <div className='space-y-2'>
      <div className='text-sm font-medium text-foreground'>{label}</div>
      <div className='flex items-center gap-2'>
        <Input
          type='number'
          min={min}
          step={1}
          value={value === '' || value == null ? '' : String(value)}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? '' : Number(v));
          }}
          placeholder={placeholder}
          aria-label={label}
          className='h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary'
        />
        {suffix ? (
          <span className='text-xs text-muted shrink-0'>{suffix}</span>
        ) : null}
      </div>
      {helper ? (
        <div className='text-xs leading-snug text-muted'>{helper}</div>
      ) : null}
    </div>
  );
}

export default function SettingsMonitoring(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [inputsRow, setInputsRow] = useState(DEFAULT_INPUTS);

  const setField = (field) => (value) =>
    setInputs((prev) => ({ ...prev, [field]: value }));

  const parsedDisable = useMemo(
    () => parseHttpStatusCodeRules(inputs.AutomaticDisableStatusCodes || ''),
    [inputs.AutomaticDisableStatusCodes],
  );
  const parsedRetry = useMemo(
    () => parseHttpStatusCodeRules(inputs.AutomaticRetryStatusCodes || ''),
    [inputs.AutomaticRetryStatusCodes],
  );

  const onSubmit = async () => {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) {
      showWarning(t('你似乎并没有修改什么'));
      return;
    }
    if (!parsedDisable.ok) {
      const details =
        parsedDisable.invalidTokens?.length > 0
          ? `: ${parsedDisable.invalidTokens.join(', ')}`
          : '';
      showError(`${t('自动禁用状态码格式不正确')}${details}`);
      return;
    }
    if (!parsedRetry.ok) {
      const details =
        parsedRetry.invalidTokens?.length > 0
          ? `: ${parsedRetry.invalidTokens.join(', ')}`
          : '';
      showError(`${t('自动重试状态码格式不正确')}${details}`);
      return;
    }
    setLoading(true);
    try {
      const requests = updateArray.map((item) => {
        let value;
        if (typeof inputs[item.key] === 'boolean') {
          value = String(inputs[item.key]);
        } else if (item.key === 'AutomaticDisableStatusCodes') {
          value = parsedDisable.normalized;
        } else if (item.key === 'AutomaticRetryStatusCodes') {
          value = parsedRetry.normalized;
        } else {
          value = String(inputs[item.key] ?? '');
        }
        return API.put('/api/option/', { key: item.key, value });
      });
      const results = await Promise.all(requests);
      if (results.some((r) => r === undefined)) {
        if (requests.length > 1) {
          showError(t('部分保存失败，请重试'));
          return;
        }
        return;
      }
      showSuccess(t('保存成功'));
      setInputsRow(structuredClone(inputs));
      props.refresh?.();
    } catch (e) {
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!props.options) return;
    const next = { ...DEFAULT_INPUTS };
    for (const key of Object.keys(DEFAULT_INPUTS)) {
      if (key in props.options) {
        const raw = props.options[key];
        if (BOOLEAN_FIELDS.has(key)) {
          next[key] = raw === true || raw === 'true';
        } else if (NUMERIC_FIELDS.has(key)) {
          if (raw === '' || raw == null) {
            next[key] = '';
          } else {
            const parsed = Number(raw);
            next[key] = Number.isFinite(parsed) ? parsed : '';
          }
        } else {
          next[key] = raw ?? '';
        }
      }
    }
    setInputs(next);
    setInputsRow(structuredClone(next));
  }, [props.options]);

  return (
    <div className='p-6 space-y-6'>
      <div>
        <div className='text-base font-semibold text-foreground'>
          {t('监控设置')}
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <ToggleRow
          label={t('定时测试所有通道')}
          helper={t('开启后系统会定期对所有通道发起健康检查')}
          isSelected={inputs['monitor_setting.auto_test_channel_enabled']}
          onValueChange={setField('monitor_setting.auto_test_channel_enabled')}
        />
        <NumberField
          label={t('自动测试所有通道间隔时间')}
          value={inputs['monitor_setting.auto_test_channel_minutes']}
          onChange={setField('monitor_setting.auto_test_channel_minutes')}
          suffix={t('分钟')}
          helper={t('每隔多少分钟测试一次所有通道')}
          min={1}
        />
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <NumberField
          label={t('测试所有渠道的最长响应时间')}
          value={inputs.ChannelDisableThreshold}
          onChange={setField('ChannelDisableThreshold')}
          suffix={t('秒')}
          helper={t('当运行通道全部测试时，超过此时间将自动禁用通道')}
        />
        <NumberField
          label={t('额度提醒阈值')}
          value={inputs.QuotaRemindThreshold}
          onChange={setField('QuotaRemindThreshold')}
          suffix='Token'
          helper={t('低于此额度时将发送邮件提醒用户')}
        />
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <ToggleRow
          label={t('失败时自动禁用通道')}
          isSelected={inputs.AutomaticDisableChannelEnabled}
          onValueChange={setField('AutomaticDisableChannelEnabled')}
        />
        <ToggleRow
          label={t('成功时自动启用通道')}
          isSelected={inputs.AutomaticEnableChannelEnabled}
          onValueChange={setField('AutomaticEnableChannelEnabled')}
        />
      </div>

      <HttpStatusCodeRulesInput
        label={t('自动禁用状态码')}
        value={inputs.AutomaticDisableStatusCodes ?? ''}
        onChange={setField('AutomaticDisableStatusCodes')}
        placeholder={t('例如：401, 403, 429, 500-599')}
        extraText={t('支持填写单个状态码或范围（含首尾），使用逗号分隔')}
        parsed={parsedDisable}
        invalidText={t('自动禁用状态码格式不正确')}
      />

      <HttpStatusCodeRulesInput
        label={t('自动重试状态码')}
        value={inputs.AutomaticRetryStatusCodes ?? ''}
        onChange={setField('AutomaticRetryStatusCodes')}
        placeholder={t('例如：401, 403, 429, 500-599')}
        extraText={t(
          '支持填写单个状态码或范围（含首尾），使用逗号分隔；504 和 524 始终不重试，不受此处配置影响',
        )}
        parsed={parsedRetry}
        invalidText={t('自动重试状态码格式不正确')}
      />

      <div className='space-y-2'>
        <div className='text-sm font-medium text-foreground'>
          {t('自动禁用关键词')}
        </div>
        <textarea
          value={inputs.AutomaticDisableKeywords ?? ''}
          onChange={(e) => setField('AutomaticDisableKeywords')(e.target.value)}
          placeholder={t('一行一个，不区分大小写')}
          rows={6}
          aria-label={t('自动禁用关键词')}
          className='w-full resize-y rounded-lg border border-[color:var(--app-border)] bg-background px-3 py-2 font-mono text-sm text-foreground outline-none transition focus:border-primary'
        />
        <div className='text-xs leading-snug text-muted'>
          {t('当上游通道返回错误中包含这些关键词时（不区分大小写），自动禁用通道')}
        </div>
      </div>

      <div className='border-t border-[color:var(--app-border)] pt-4'>
        <Button
          color='primary'
          size='md'
          onPress={onSubmit}
          isPending={loading}
          className='min-w-[100px]'
        >
          {t('保存监控设置')}
        </Button>
      </div>
    </div>
  );
}

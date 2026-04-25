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
import { Button, Input, Switch } from '@heroui/react';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
  verifyJSON,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

const DEFAULT_INPUTS = {
  ModelRequestRateLimitEnabled: false,
  ModelRequestRateLimitCount: -1,
  ModelRequestRateLimitSuccessCount: 1000,
  ModelRequestRateLimitDurationMinutes: 1,
  ModelRequestRateLimitGroup: '',
};

const NUMERIC_FIELDS = new Set([
  'ModelRequestRateLimitCount',
  'ModelRequestRateLimitSuccessCount',
  'ModelRequestRateLimitDurationMinutes',
]);

function NumberField({ label, value, onChange, suffix, helper, min = 0, max }) {
  return (
    <div className='space-y-2'>
      <div className='text-sm font-medium text-foreground'>{label}</div>
      <div className='flex items-center gap-2'>
        <Input
          type='number'
          min={min}
          max={max}
          step={1}
          value={value === '' || value == null ? '' : String(value)}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === '' ? '' : Number(v));
          }}
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

export default function RequestRateLimit(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [inputsRow, setInputsRow] = useState(DEFAULT_INPUTS);
  const [groupJsonError, setGroupJsonError] = useState('');

  const setField = (field) => (value) =>
    setInputs((prev) => ({ ...prev, [field]: value }));

  const onSubmit = async () => {
    if (
      inputs.ModelRequestRateLimitGroup &&
      !verifyJSON(inputs.ModelRequestRateLimitGroup)
    ) {
      setGroupJsonError(t('不是合法的 JSON 字符串'));
      showError(t('不是合法的 JSON 字符串'));
      return;
    }
    setGroupJsonError('');

    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) {
      showWarning(t('你似乎并没有修改什么'));
      return;
    }
    setLoading(true);
    try {
      const requests = updateArray.map((item) =>
        API.put('/api/option/', {
          key: item.key,
          value:
            typeof inputs[item.key] === 'boolean'
              ? String(inputs[item.key])
              : String(inputs[item.key] ?? ''),
        }),
      );
      const results = await Promise.all(requests);
      if (results.some((r) => r === undefined)) {
        if (requests.length > 1) {
          showError(t('部分保存失败，请重试'));
          return;
        }
        return;
      }
      for (const r of results) {
        if (r?.data && !r.data.success) {
          showError(r.data.message);
          return;
        }
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
        if (key === 'ModelRequestRateLimitEnabled') {
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
          {t('模型请求速率限制')}
        </div>
      </div>

      <label className='flex items-start justify-between gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-background)] p-4'>
        <div className='min-w-0 flex-1'>
          <div className='text-sm font-medium text-foreground'>
            {t('启用用户模型请求速率限制（可能会影响高并发性能）')}
          </div>
        </div>
        <Switch
          isSelected={!!inputs.ModelRequestRateLimitEnabled}
          onChange={setField('ModelRequestRateLimitEnabled')}
          aria-label={t('启用用户模型请求速率限制')}
          size='sm'
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>
      </label>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
        <NumberField
          label={t('限制周期')}
          value={inputs.ModelRequestRateLimitDurationMinutes}
          onChange={setField('ModelRequestRateLimitDurationMinutes')}
          suffix={t('分钟')}
          helper={t('频率限制的周期（分钟）')}
        />
        <NumberField
          label={t('用户每周期最多请求次数')}
          value={inputs.ModelRequestRateLimitCount}
          onChange={setField('ModelRequestRateLimitCount')}
          suffix={t('次')}
          helper={t('包括失败请求的次数，0代表不限制')}
          max={100000000}
        />
        <NumberField
          label={t('用户每周期最多请求完成次数')}
          value={inputs.ModelRequestRateLimitSuccessCount}
          onChange={setField('ModelRequestRateLimitSuccessCount')}
          suffix={t('次')}
          helper={t('只包括请求成功的次数')}
          min={1}
          max={100000000}
        />
      </div>

      <div className='space-y-2'>
        <div className='text-sm font-medium text-foreground'>
          {t('分组速率限制')}
        </div>
        <textarea
          value={inputs.ModelRequestRateLimitGroup ?? ''}
          onChange={(e) => {
            setField('ModelRequestRateLimitGroup')(e.target.value);
            setGroupJsonError('');
          }}
          onBlur={(e) => {
            const v = e.target.value;
            if (v && !verifyJSON(v)) {
              setGroupJsonError(t('不是合法的 JSON 字符串'));
            } else {
              setGroupJsonError('');
            }
          }}
          placeholder={'{\n  "default": [200, 100],\n  "vip": [0, 1000]\n}'}
          rows={6}
          aria-label={t('分组速率限制')}
          className={`w-full resize-y rounded-lg border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none transition focus:border-primary ${
            groupJsonError
              ? 'border-rose-500'
              : 'border-[color:var(--app-border)]'
          }`}
        />
        {groupJsonError ? (
          <div className='text-xs text-rose-600'>{groupJsonError}</div>
        ) : null}
        <div className='space-y-1 text-xs leading-snug text-muted'>
          <div>{t('说明：')}</div>
          <ul className='list-inside list-disc space-y-0.5'>
            <li>
              {t(
                '使用 JSON 对象格式，格式为：{"组名": [最多请求次数, 最多请求完成次数]}',
              )}
            </li>
            <li>{t('示例：{"default": [200, 100], "vip": [0, 1000]}。')}</li>
            <li>
              {t(
                '[最多请求次数]必须大于等于0，[最多请求完成次数]必须大于等于1。',
              )}
            </li>
            <li>
              {t('[最多请求次数]和[最多请求完成次数]的最大值为2147483647。')}
            </li>
            <li>{t('分组速率配置优先级高于全局速率限制。')}</li>
            <li>{t('限制周期统一使用上方配置的“限制周期”值。')}</li>
          </ul>
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
          {t('保存模型速率限制')}
        </Button>
      </div>
    </div>
  );
}

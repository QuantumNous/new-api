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
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

const DEFAULT_INPUTS = {
  DataExportEnabled: false,
  DataExportInterval: '',
  DataExportDefaultTime: '',
};

export default function DataDashboard(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [inputsRow, setInputsRow] = useState(DEFAULT_INPUTS);

  const intervalOptions = [
    { label: t('小时'), value: 'hour' },
    { label: t('天'), value: 'day' },
    { label: t('周'), value: 'week' },
  ];

  const setField = (field) => (value) =>
    setInputs((prev) => ({ ...prev, [field]: value }));

  const onSubmit = async () => {
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
    if ('DataExportEnabled' in props.options) {
      const raw = props.options.DataExportEnabled;
      next.DataExportEnabled = raw === true || raw === 'true';
    }
    if ('DataExportInterval' in props.options) {
      next.DataExportInterval = props.options.DataExportInterval ?? '';
    }
    if ('DataExportDefaultTime' in props.options) {
      next.DataExportDefaultTime = props.options.DataExportDefaultTime ?? '';
    }
    setInputs(next);
    setInputsRow(structuredClone(next));
    if (next.DataExportDefaultTime) {
      localStorage.setItem(
        'data_export_default_time',
        String(next.DataExportDefaultTime),
      );
    }
  }, [props.options]);

  return (
    <div className='p-6 space-y-6'>
      <div>
        <div className='text-base font-semibold text-foreground'>
          {t('数据看板设置')}
        </div>
      </div>

      <label className='flex items-start justify-between gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-background)] p-4'>
        <div className='min-w-0 flex-1'>
          <div className='text-sm font-medium text-foreground'>
            {t('启用数据看板（实验性）')}
          </div>
          <div className='mt-1 text-xs leading-snug text-muted'>
            {t('开启后控制台首页将展示用量、消费等聚合数据')}
          </div>
        </div>
        <Switch
          isSelected={!!inputs.DataExportEnabled}
          onChange={setField('DataExportEnabled')}
          aria-label={t('启用数据看板')}
          size='sm'
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>
      </label>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <div className='space-y-2'>
          <div className='text-sm font-medium text-foreground'>
            {t('数据看板更新间隔')}
          </div>
          <div className='flex items-center gap-2'>
            <Input
              type='number'
              min={1}
              step={1}
              value={
                inputs.DataExportInterval === '' ||
                inputs.DataExportInterval == null
                  ? ''
                  : String(inputs.DataExportInterval)
              }
              onChange={(e) =>
                setField('DataExportInterval')(e.target.value)
              }
              placeholder={t('数据看板更新间隔')}
              aria-label={t('数据看板更新间隔')}
              className='h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary'
            />
            <span className='text-xs text-muted shrink-0'>{t('分钟')}</span>
          </div>
          <div className='text-xs leading-snug text-muted'>
            {t('设置过短会影响数据库性能')}
          </div>
        </div>

        <div className='space-y-2'>
          <div className='text-sm font-medium text-foreground'>
            {t('数据看板默认时间粒度')}
          </div>
          <select
            value={inputs.DataExportDefaultTime ?? ''}
            onChange={(e) =>
              setField('DataExportDefaultTime')(e.target.value)
            }
            aria-label={t('数据看板默认时间粒度')}
            className='h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary'
          >
            <option value=''>{t('数据看板默认时间粒度')}</option>
            {intervalOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className='text-xs leading-snug text-muted'>
            {t('仅修改展示粒度，统计精确到小时')}
          </div>
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
          {t('保存数据看板设置')}
        </Button>
      </div>
    </div>
  );
}

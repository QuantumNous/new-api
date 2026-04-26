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
import { Button, Switch } from '@heroui/react';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

const DEFAULT_INPUTS = {
  DrawingEnabled: false,
  MjNotifyEnabled: false,
  MjAccountFilterEnabled: false,
  MjForwardUrlEnabled: false,
  MjModeClearEnabled: false,
  MjActionCheckSuccessEnabled: false,
};

function ToggleRow({ label, helper, isSelected, onValueChange }) {
  return (
    <label className='flex items-start justify-between gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-background)] p-4'>
      <div className='min-w-0 flex-1'>
        <div className='text-sm font-medium leading-snug text-foreground'>
          {label}
        </div>
        {helper ? (
          <div className='mt-1 text-xs leading-snug text-muted'>{helper}</div>
        ) : null}
      </div>
      <Switch
        isSelected={!!isSelected}
        onChange={onValueChange}
        aria-label={typeof label === 'string' ? label : undefined}
        size='sm'
      >
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch>
    </label>
  );
}

export default function SettingsDrawing(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [inputsRow, setInputsRow] = useState(DEFAULT_INPUTS);

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
          value: String(inputs[item.key]),
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
    for (const key of Object.keys(DEFAULT_INPUTS)) {
      if (key in props.options) {
        const raw = props.options[key];
        next[key] = raw === true || raw === 'true';
      }
    }
    setInputs(next);
    setInputsRow(structuredClone(next));
    localStorage.setItem('mj_notify_enabled', String(next.MjNotifyEnabled));
  }, [props.options]);

  return (
    <div className='p-6 space-y-6'>
      <div>
        <div className='text-base font-semibold text-foreground'>
          {t('绘图设置')}
        </div>
      </div>

      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
        <ToggleRow
          label={t('启用绘图功能')}
          isSelected={inputs.DrawingEnabled}
          onValueChange={setField('DrawingEnabled')}
        />
        <ToggleRow
          label={t('允许回调（会泄露服务器 IP 地址）')}
          isSelected={inputs.MjNotifyEnabled}
          onValueChange={setField('MjNotifyEnabled')}
        />
        <ToggleRow
          label={t('允许 AccountFilter 参数')}
          isSelected={inputs.MjAccountFilterEnabled}
          onValueChange={setField('MjAccountFilterEnabled')}
        />
        <ToggleRow
          label={t('开启之后将上游地址替换为服务器地址')}
          isSelected={inputs.MjForwardUrlEnabled}
          onValueChange={setField('MjForwardUrlEnabled')}
        />
        <ToggleRow
          label={
            <span>
              {t('开启之后会清除用户提示词中的')}{' '}
              <code className='rounded bg-[color:var(--app-surface-muted)] px-1 py-0.5 font-mono text-[11px]'>
                --fast
              </code>{' '}
              、
              <code className='rounded bg-[color:var(--app-surface-muted)] px-1 py-0.5 font-mono text-[11px]'>
                --relax
              </code>{' '}
              {t('以及')}{' '}
              <code className='rounded bg-[color:var(--app-surface-muted)] px-1 py-0.5 font-mono text-[11px]'>
                --turbo
              </code>{' '}
              {t('参数')}
            </span>
          }
          isSelected={inputs.MjModeClearEnabled}
          onValueChange={setField('MjModeClearEnabled')}
        />
        <ToggleRow
          label={t('检测必须等待绘图成功才能进行放大等操作')}
          isSelected={inputs.MjActionCheckSuccessEnabled}
          onValueChange={setField('MjActionCheckSuccessEnabled')}
        />
      </div>

      <div className='border-t border-[color:var(--app-border)] pt-4'>
        <Button
          color='primary'
          size='md'
          onPress={onSubmit}
          isPending={loading}
          className='min-w-[100px]'
        >
          {t('保存绘图设置')}
        </Button>
      </div>
    </div>
  );
}

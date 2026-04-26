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

const FIELDS = {
  enabled: 'checkin_setting.enabled',
  minQuota: 'checkin_setting.min_quota',
  maxQuota: 'checkin_setting.max_quota',
};

const DEFAULT_INPUTS = {
  [FIELDS.enabled]: false,
  [FIELDS.minQuota]: 1000,
  [FIELDS.maxQuota]: 10000,
};

export default function SettingsCheckin(props) {
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
        if (typeof DEFAULT_INPUTS[key] === 'boolean') {
          next[key] = raw === true || raw === 'true';
        } else if (typeof DEFAULT_INPUTS[key] === 'number') {
          const parsed = Number(raw);
          next[key] = Number.isFinite(parsed) ? parsed : DEFAULT_INPUTS[key];
        } else {
          next[key] = raw;
        }
      }
    }
    setInputs(next);
    setInputsRow(structuredClone(next));
  }, [props.options]);

  const enabled = !!inputs[FIELDS.enabled];

  return (
    <div className='p-6 space-y-6'>
      <div>
        <div className='text-base font-semibold text-foreground'>
          {t('签到设置')}
        </div>
        <div className='mt-1 text-xs text-muted'>
          {t('签到功能允许用户每日签到获取随机额度奖励')}
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
        <label className='flex items-start justify-between gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-background)] p-4'>
          <div className='min-w-0 flex-1'>
            <div className='text-sm font-medium text-foreground'>
              {t('启用签到功能')}
            </div>
            <div className='mt-1 text-xs leading-snug text-muted'>
              {t('开启后用户可在签到日历中领取每日额度')}
            </div>
          </div>
          <Switch
            isSelected={enabled}
            onChange={setField(FIELDS.enabled)}
            aria-label={t('启用签到功能')}
            size='sm'
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
        </label>

        <div className='space-y-2'>
          <div className='text-sm font-medium text-foreground'>
            {t('签到最小额度')}
          </div>
          <Input
            type='number'
            min={0}
            value={String(inputs[FIELDS.minQuota] ?? '')}
            onChange={(e) => {
              const v = e.target.value;
              setField(FIELDS.minQuota)(v === '' ? '' : Number(v));
            }}
            placeholder={t('签到奖励的最小额度')}
            disabled={!enabled}
            aria-label={t('签到最小额度')}
            className='h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-60'
          />
        </div>

        <div className='space-y-2'>
          <div className='text-sm font-medium text-foreground'>
            {t('签到最大额度')}
          </div>
          <Input
            type='number'
            min={0}
            value={String(inputs[FIELDS.maxQuota] ?? '')}
            onChange={(e) => {
              const v = e.target.value;
              setField(FIELDS.maxQuota)(v === '' ? '' : Number(v));
            }}
            placeholder={t('签到奖励的最大额度')}
            disabled={!enabled}
            aria-label={t('签到最大额度')}
            className='h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-60'
          />
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
          {t('保存签到设置')}
        </Button>
      </div>
    </div>
  );
}

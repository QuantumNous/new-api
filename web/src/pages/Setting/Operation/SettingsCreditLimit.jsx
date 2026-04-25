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
import { useTranslation } from 'react-i18next';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';

const NUMERIC_FIELDS = [
  'QuotaForNewUser',
  'PreConsumedQuota',
  'QuotaForInviter',
  'QuotaForInvitee',
];
const BOOLEAN_FIELDS = ['quota_setting.enable_free_model_pre_consume'];

const DEFAULT_INPUTS = {
  QuotaForNewUser: '',
  PreConsumedQuota: '',
  QuotaForInviter: '',
  QuotaForInvitee: '',
  'quota_setting.enable_free_model_pre_consume': true,
};

// Small reusable number input row used for all the per-field cards on this
// settings page. Keeps the visual weight consistent and avoids repeating the
// label/description block four times in JSX.
function NumberField({ label, value, onChange, suffix, helper, placeholder }) {
  return (
    <div className='space-y-2'>
      <div className='text-sm font-medium text-foreground'>{label}</div>
      <div className='flex items-center gap-2'>
        <Input
          type='number'
          min={0}
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

export default function SettingsCreditLimit(props) {
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
    for (const key of Object.keys(DEFAULT_INPUTS)) {
      if (key in props.options) {
        const raw = props.options[key];
        if (BOOLEAN_FIELDS.includes(key)) {
          next[key] = raw === true || raw === 'true';
        } else if (NUMERIC_FIELDS.includes(key)) {
          if (raw === '' || raw == null) {
            next[key] = '';
          } else {
            const parsed = Number(raw);
            next[key] = Number.isFinite(parsed) ? parsed : '';
          }
        } else {
          next[key] = raw;
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
          {t('额度设置')}
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
        <NumberField
          label={t('新用户初始额度')}
          value={inputs.QuotaForNewUser}
          onChange={setField('QuotaForNewUser')}
          suffix='Token'
        />
        <NumberField
          label={t('请求预扣费额度')}
          value={inputs.PreConsumedQuota}
          onChange={setField('PreConsumedQuota')}
          suffix='Token'
          helper={t('请求结束后多退少补')}
        />
        <NumberField
          label={t('邀请新用户奖励额度')}
          value={inputs.QuotaForInviter}
          onChange={setField('QuotaForInviter')}
          suffix='Token'
          placeholder={t('例如：2000')}
        />
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
        <NumberField
          label={t('新用户使用邀请码奖励额度')}
          value={inputs.QuotaForInvitee}
          onChange={setField('QuotaForInvitee')}
          suffix='Token'
          placeholder={t('例如：1000')}
        />
      </div>

      <label className='flex items-start justify-between gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-background)] p-4'>
        <div className='min-w-0 flex-1'>
          <div className='text-sm font-medium text-foreground'>
            {t('对免费模型启用预消耗')}
          </div>
          <div className='mt-1 text-xs leading-snug text-muted'>
            {t(
              '开启后，对免费模型（倍率为0，或者价格为0）的模型也会预消耗额度',
            )}
          </div>
        </div>
        <Switch
          isSelected={!!inputs['quota_setting.enable_free_model_pre_consume']}
          onChange={setField('quota_setting.enable_free_model_pre_consume')}
          aria-label={t('对免费模型启用预消耗')}
          size='sm'
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>
      </label>

      <div className='border-t border-[color:var(--app-border)] pt-4'>
        <Button
          color='primary'
          size='md'
          onPress={onSubmit}
          isPending={loading}
          className='min-w-[100px]'
        >
          {t('保存额度设置')}
        </Button>
      </div>
    </div>
  );
}

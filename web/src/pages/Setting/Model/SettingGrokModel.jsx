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
  API,
  compareObjects,
  showError,
  showSuccess,
  showWarning,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

const XAI_VIOLATION_FEE_DOC_URL =
  'https://docs.x.ai/docs/models#usage-guidelines-violation-fee';

const DEFAULT_GROK_INPUTS = {
  'grok.violation_deduction_enabled': true,
  'grok.violation_deduction_amount': 0.05,
};

const inputClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:opacity-50';

function ToggleRow({ label, helper, value, onChange }) {
  return (
    <div className='flex items-start justify-between gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-background)] p-4'>
      <div className='min-w-0 flex-1'>
        <div className='text-sm font-medium text-foreground'>{label}</div>
        {helper ? (
          <div className='mt-1 text-xs leading-snug text-muted'>{helper}</div>
        ) : null}
      </div>
      <Switch
        isSelected={!!value}
        onChange={onChange}
        aria-label={label}
        size='sm'
      >
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch>
    </div>
  );
}

function NumberField({ label, value, onChange, helper, min, step, disabled }) {
  return (
    <div className='space-y-2'>
      <div className='text-sm font-medium text-foreground'>{label}</div>
      <Input
        type='number'
        value={value === '' || value == null ? '' : String(value)}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? '' : Number(v));
        }}
        min={min}
        step={step}
        disabled={disabled}
        aria-label={label}
        className={inputClass}
      />
      {helper ? (
        <div className='text-xs leading-snug text-muted'>{helper}</div>
      ) : null}
    </div>
  );
}

export default function SettingGrokModel(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(DEFAULT_GROK_INPUTS);
  const [inputsRow, setInputsRow] = useState(DEFAULT_GROK_INPUTS);

  const setField = (key) => (value) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const onSubmit = () => {
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) =>
      API.put('/api/option/', {
        key: item.key,
        value: String(inputs[item.key]),
      }),
    );

    setLoading(true);
    Promise.all(requestQueue)
      .then((res) => {
        if (res.includes(undefined)) {
          if (requestQueue.length > 1) {
            return showError(t('部分保存失败，请重试'));
          }
          return;
        }
        showSuccess(t('保存成功'));
        props.refresh?.();
      })
      .catch(() => showError(t('保存失败，请重试')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const currentInputs = { ...DEFAULT_GROK_INPUTS };
    for (const key of Object.keys(DEFAULT_GROK_INPUTS)) {
      if (props.options[key] !== undefined) {
        currentInputs[key] = props.options[key];
      }
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
  }, [props.options]);

  return (
    <div className='p-6 space-y-6'>
      <div className='text-base font-semibold text-foreground'>
        {t('Grok设置')}
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <ToggleRow
          label={t('启用违规扣费')}
          helper={
            <span>
              {t('开启后，违规请求将额外扣费。')}{' '}
              <a
                href={XAI_VIOLATION_FEE_DOC_URL}
                target='_blank'
                rel='noreferrer'
                className='text-primary underline'
              >
                {t('官方说明')}
              </a>
            </span>
          }
          value={inputs['grok.violation_deduction_enabled']}
          onChange={setField('grok.violation_deduction_enabled')}
        />
        <NumberField
          label={t('违规扣费金额')}
          value={inputs['grok.violation_deduction_amount']}
          onChange={setField('grok.violation_deduction_amount')}
          min={0}
          step={0.01}
          disabled={!inputs['grok.violation_deduction_enabled']}
          helper={
            <span>
              {t('这是基础金额，实际扣费 = 基础金额 x 系统分组倍率。')}{' '}
              <a
                href={XAI_VIOLATION_FEE_DOC_URL}
                target='_blank'
                rel='noreferrer'
                className='text-primary underline'
              >
                {t('官方说明')}
              </a>
            </span>
          }
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
          {t('保存')}
        </Button>
      </div>
    </div>
  );
}

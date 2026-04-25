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
  CheckSensitiveEnabled: false,
  CheckSensitiveOnPromptEnabled: false,
  SensitiveWords: '',
};

const BOOLEAN_FIELDS = new Set([
  'CheckSensitiveEnabled',
  'CheckSensitiveOnPromptEnabled',
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

export default function SettingsSensitiveWords(props) {
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
        if (BOOLEAN_FIELDS.has(key)) {
          next[key] = raw === true || raw === 'true';
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
          {t('屏蔽词过滤设置')}
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <ToggleRow
          label={t('启用屏蔽词过滤功能')}
          helper={t('开启后会拦截命中屏蔽词的请求')}
          isSelected={inputs.CheckSensitiveEnabled}
          onValueChange={setField('CheckSensitiveEnabled')}
        />
        <ToggleRow
          label={t('启用 Prompt 检查')}
          helper={t('开启后会对用户提示词逐条进行屏蔽词检查')}
          isSelected={inputs.CheckSensitiveOnPromptEnabled}
          onValueChange={setField('CheckSensitiveOnPromptEnabled')}
        />
      </div>

      <div className='space-y-2'>
        <div className='text-sm font-medium text-foreground'>
          {t('屏蔽词列表')}
        </div>
        <textarea
          value={inputs.SensitiveWords ?? ''}
          onChange={(e) => setField('SensitiveWords')(e.target.value)}
          placeholder={t('一行一个屏蔽词，不需要符号分割')}
          rows={8}
          aria-label={t('屏蔽词列表')}
          className='w-full resize-y rounded-lg border border-[color:var(--app-border)] bg-background px-3 py-2 font-mono text-sm text-foreground outline-none transition focus:border-primary'
        />
        <div className='text-xs text-muted'>
          {t('一行一个屏蔽词，不需要符号分割')}
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
          {t('保存屏蔽词过滤设置')}
        </Button>
      </div>
    </div>
  );
}

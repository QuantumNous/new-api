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

const CLAUDE_HEADER = {
  'claude-3-7-sonnet-20250219-thinking': {
    'anthropic-beta': [
      'output-128k-2025-02-19',
      'token-efficient-tools-2025-02-19',
    ],
  },
};

const CLAUDE_HEADER_APPEND_CONFIG = {
  'claude-3-7-sonnet-20250219-thinking': {
    'anthropic-beta': ['token-efficient-tools-2025-02-19'],
  },
};

const CLAUDE_HEADER_APPEND_BEFORE = `anthropic-beta: output-128k-2025-02-19`;

const CLAUDE_HEADER_APPEND_AFTER = `anthropic-beta: output-128k-2025-02-19,token-efficient-tools-2025-02-19`;

const CLAUDE_DEFAULT_MAX_TOKENS = {
  default: 8192,
  'claude-3-haiku-20240307': 4096,
  'claude-3-opus-20240229': 4096,
  'claude-3-7-sonnet-20250219-thinking': 8192,
};

const DEFAULT_INPUTS = {
  'claude.model_headers_settings': '',
  'claude.thinking_adapter_enabled': true,
  'claude.default_max_tokens': '',
  'claude.thinking_adapter_budget_tokens_percentage': 0.8,
};

const inputClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:opacity-50';

const textareaClass =
  'w-full resize-y rounded-lg border border-[color:var(--app-border)] bg-background px-3 py-2 font-mono text-sm text-foreground outline-none transition focus:border-primary';

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

function NumberField({ label, value, onChange, helper, min, step = 0.01 }) {
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
        aria-label={label}
        className={inputClass}
      />
      {helper ? (
        <div className='text-xs leading-snug text-muted'>{helper}</div>
      ) : null}
    </div>
  );
}

function JsonField({ label, value, onChange, placeholder, helper, rows = 6 }) {
  return (
    <div className='space-y-2'>
      <div className='text-sm font-medium text-foreground'>{label}</div>
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        aria-label={label}
        className={textareaClass}
      />
      {helper ? (
        <div className='text-xs leading-snug text-muted'>{helper}</div>
      ) : null}
    </div>
  );
}

export default function SettingClaudeModel(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [inputsRow, setInputsRow] = useState(DEFAULT_INPUTS);

  const setField = (key) => (value) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const onSubmit = () => {
    const jsonKeys = [
      'claude.model_headers_settings',
      'claude.default_max_tokens',
    ];
    for (const key of jsonKeys) {
      const v = inputs[key];
      if (v && String(v).trim() !== '' && !verifyJSON(v)) {
        showError(t('不是合法的 JSON 字符串'));
        return;
      }
    }

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
    const currentInputs = { ...DEFAULT_INPUTS };
    for (const key in props.options) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_INPUTS, key)) {
        currentInputs[key] = props.options[key];
      }
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
  }, [props.options]);

  return (
    <div className='p-6 space-y-6'>
      <div className='text-base font-semibold text-foreground'>
        {t('Claude设置')}
      </div>

      <JsonField
        label={t('Claude请求头追加')}
        value={inputs['claude.model_headers_settings']}
        onChange={setField('claude.model_headers_settings')}
        placeholder={
          t('为一个 JSON 文本，例如：') +
          '\n' +
          JSON.stringify(CLAUDE_HEADER, null, 2)
        }
      />

      <div className='space-y-1 text-xs leading-snug text-muted'>
        <div>
          {t(
            'Claude会在原有请求头基础上追加这些值，不会覆盖已有同名请求头；重复值会自动忽略。',
          )}
        </div>
        <pre className='whitespace-pre-wrap rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-background)] p-3 font-mono text-[11px]'>
{`${t('前：')}\n${CLAUDE_HEADER_APPEND_BEFORE}\n\n${t('配置：')}\n${JSON.stringify(
            CLAUDE_HEADER_APPEND_CONFIG,
            null,
            2,
          )}\n\n${t('后：')}\n${CLAUDE_HEADER_APPEND_AFTER}`}
        </pre>
      </div>

      <JsonField
        label={t('缺省 MaxTokens')}
        value={inputs['claude.default_max_tokens']}
        onChange={setField('claude.default_max_tokens')}
        placeholder={
          t('为一个 JSON 文本，例如：') +
          '\n' +
          JSON.stringify(CLAUDE_DEFAULT_MAX_TOKENS, null, 2)
        }
        helper={
          t('示例') + '\n' + JSON.stringify(CLAUDE_DEFAULT_MAX_TOKENS, null, 2)
        }
      />

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <ToggleRow
          label={t('启用Claude思考适配（-thinking后缀）')}
          value={inputs['claude.thinking_adapter_enabled']}
          onChange={setField('claude.thinking_adapter_enabled')}
        />
        <NumberField
          label={t('思考适配 BudgetTokens 百分比')}
          value={inputs['claude.thinking_adapter_budget_tokens_percentage']}
          onChange={setField(
            'claude.thinking_adapter_budget_tokens_percentage',
          )}
          helper={t(
            'Claude思考适配 BudgetTokens = MaxTokens * BudgetTokens 百分比，0.1以上的小数',
          )}
          min={0.1}
          step={0.01}
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

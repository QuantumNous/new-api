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

const GEMINI_SETTING_EXAMPLE = { default: 'OFF' };
const GEMINI_VERSION_EXAMPLE = { default: 'v1beta' };

const DEFAULT_GEMINI_INPUTS = {
  'gemini.safety_settings': '',
  'gemini.version_settings': '',
  'gemini.supported_imagine_models': '',
  'gemini.thinking_adapter_enabled': false,
  'gemini.thinking_adapter_budget_tokens_percentage': 0.6,
  'gemini.function_call_thought_signature_enabled': true,
  'gemini.remove_function_response_id_enabled': true,
};

const inputClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:opacity-50';

const textareaClass =
  'w-full resize-y rounded-lg border border-[color:var(--app-border)] bg-background px-3 py-2 font-mono text-sm text-foreground outline-none transition focus:border-primary';

function ToggleRow({ label, helper, value, onChange, disabled }) {
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
        isDisabled={disabled}
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

function NumberField({
  label,
  value,
  onChange,
  helper,
  min,
  max,
  step = 0.001,
}) {
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
        max={max}
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

export default function SettingGeminiModel(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(DEFAULT_GEMINI_INPUTS);
  const [inputsRow, setInputsRow] = useState(DEFAULT_GEMINI_INPUTS);

  const setField = (key) => (value) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const onSubmit = () => {
    const jsonKeys = [
      'gemini.safety_settings',
      'gemini.version_settings',
      'gemini.supported_imagine_models',
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
    const currentInputs = { ...DEFAULT_GEMINI_INPUTS };
    for (const key in props.options) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_GEMINI_INPUTS, key)) {
        currentInputs[key] = props.options[key];
      }
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
  }, [props.options]);

  return (
    <div className='p-6 space-y-6'>
      <div className='text-base font-semibold text-foreground'>
        {t('Gemini设置')}
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <JsonField
          label={t('Gemini安全设置')}
          value={inputs['gemini.safety_settings']}
          onChange={setField('gemini.safety_settings')}
          placeholder={
            t('为一个 JSON 文本，例如：') +
            '\n' +
            JSON.stringify(GEMINI_SETTING_EXAMPLE, null, 2)
          }
          helper={t('default为默认设置，可单独设置每个分类的安全等级')}
        />
        <JsonField
          label={t('Gemini版本设置')}
          value={inputs['gemini.version_settings']}
          onChange={setField('gemini.version_settings')}
          placeholder={
            t('为一个 JSON 文本，例如：') +
            '\n' +
            JSON.stringify(GEMINI_VERSION_EXAMPLE, null, 2)
          }
          helper={t('default为默认设置，可单独设置每个模型的版本')}
        />
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <ToggleRow
          label={t('启用FunctionCall思维签名填充')}
          helper={t('仅为使用OpenAI格式的Gemini/Vertex渠道填充thoughtSignature')}
          value={inputs['gemini.function_call_thought_signature_enabled']}
          onChange={setField(
            'gemini.function_call_thought_signature_enabled',
          )}
        />
        <ToggleRow
          label={t('移除 functionResponse.id 字段')}
          helper={t(
            'Vertex AI 不支持 functionResponse.id 字段，开启后将自动移除该字段',
          )}
          value={inputs['gemini.remove_function_response_id_enabled']}
          onChange={setField('gemini.remove_function_response_id_enabled')}
        />
      </div>

      <JsonField
        label={t('支持的图像模型')}
        value={inputs['gemini.supported_imagine_models']}
        onChange={setField('gemini.supported_imagine_models')}
        placeholder={
          t('例如：') +
          '\n' +
          JSON.stringify(['gemini-2.0-flash-exp-image-generation'], null, 2)
        }
        rows={4}
      />

      <div className='space-y-3 border-t border-[color:var(--app-border)] pt-4'>
        <div className='text-sm font-semibold text-foreground'>
          {t('Gemini思考适配设置')}
        </div>
        <p className='text-sm leading-relaxed text-muted'>
          {t(
            '和Claude不同，默认情况下Gemini的思考模型会自动决定要不要思考，就算不开启适配模型也可以正常使用，如果您需要计费，推荐设置无后缀模型价格按思考价格设置。支持使用 gemini-2.5-pro-preview-06-05-thinking-128 格式来精确传递思考预算。',
          )}
        </p>

        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <ToggleRow
            label={t('启用Gemini思考后缀适配')}
            helper={t('适配 -thinking、-thinking-预算数字 和 -nothinking 后缀')}
            value={inputs['gemini.thinking_adapter_enabled']}
            onChange={setField('gemini.thinking_adapter_enabled')}
          />
          <NumberField
            label={t('思考预算占比')}
            value={inputs['gemini.thinking_adapter_budget_tokens_percentage']}
            onChange={setField(
              'gemini.thinking_adapter_budget_tokens_percentage',
            )}
            helper={t(
              'Gemini思考适配 BudgetTokens = MaxTokens * BudgetTokens 百分比，0.002-1之间的小数',
            )}
            min={0.002}
            max={1}
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
          {t('保存')}
        </Button>
      </div>
    </div>
  );
}

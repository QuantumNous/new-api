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
import { Alert, Button, Input, Switch } from '@heroui/react';
import {
  compareObjects,
  API,
  showError,
  showSuccess,
  showWarning,
  verifyJSON,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';

const thinkingExample = JSON.stringify(
  ['moonshotai/kimi-k2-thinking', 'kimi-k2-thinking'],
  null,
  2,
);

const chatCompletionsToResponsesPolicyExample = JSON.stringify(
  {
    enabled: true,
    all_channels: false,
    channel_ids: [1, 2],
    channel_types: [1],
    model_patterns: ['^gpt-4o.*$', '^gpt-5.*$'],
  },
  null,
  2,
);

const chatCompletionsToResponsesPolicyAllChannelsExample = JSON.stringify(
  {
    enabled: true,
    all_channels: true,
    model_patterns: ['^gpt-4o.*$', '^gpt-5.*$'],
  },
  null,
  2,
);

const defaultGlobalSettingInputs = {
  'global.pass_through_request_enabled': false,
  'global.thinking_model_blacklist': '[]',
  'global.chat_completions_to_responses_policy': '{}',
  'general_setting.ping_interval_enabled': false,
  'general_setting.ping_interval_seconds': 60,
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

function NumberField({ label, value, onChange, helper, min, disabled }) {
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

function JsonField({ label, value, onChange, placeholder, helper, rows = 4 }) {
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

function WarnBanner({ children }) {
  return (
    <Alert
      status='warning'
      className='!items-center ct-compact-alert'
    >
      <Alert.Indicator>
        <TriangleAlert size={14} />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Description>{children}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

export default function SettingGlobalModel(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(defaultGlobalSettingInputs);
  const [inputsRow, setInputsRow] = useState(defaultGlobalSettingInputs);
  const policyKey = 'global.chat_completions_to_responses_policy';

  const setField = (key) => (value) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const setPolicyValue = (value) => setField(policyKey)(value);

  const normalizeValueBeforeSave = (key, value) => {
    if (key === 'global.thinking_model_blacklist') {
      const text = typeof value === 'string' ? value.trim() : '';
      return text === '' ? '[]' : value;
    }
    if (key === policyKey) {
      const text = typeof value === 'string' ? value.trim() : '';
      return text === '' ? '{}' : value;
    }
    return value;
  };

  const onSubmit = () => {
    if (
      inputs['global.thinking_model_blacklist'] &&
      inputs['global.thinking_model_blacklist'].trim() !== '' &&
      !verifyJSON(inputs['global.thinking_model_blacklist'])
    ) {
      showError(t('不是合法的 JSON 字符串'));
      return;
    }
    if (
      inputs[policyKey] &&
      inputs[policyKey].trim() !== '' &&
      !verifyJSON(inputs[policyKey])
    ) {
      showError(t('不是合法的 JSON 字符串'));
      return;
    }

    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));
    const requestQueue = updateArray.map((item) => {
      const normalizedValue = normalizeValueBeforeSave(
        item.key,
        inputs[item.key],
      );
      return API.put('/api/option/', {
        key: item.key,
        value: String(normalizedValue),
      });
    });

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
    const currentInputs = {};
    for (const key of Object.keys(defaultGlobalSettingInputs)) {
      if (props.options[key] !== undefined) {
        let value = props.options[key];
        if (
          key === 'global.thinking_model_blacklist' ||
          key === policyKey
        ) {
          try {
            value =
              value && String(value).trim() !== ''
                ? JSON.stringify(JSON.parse(value), null, 2)
                : defaultGlobalSettingInputs[key];
          } catch (error) {
            value = defaultGlobalSettingInputs[key];
          }
        }
        currentInputs[key] = value;
      } else {
        currentInputs[key] = defaultGlobalSettingInputs[key];
      }
    }
    setInputs(currentInputs);
    setInputsRow(structuredClone(currentInputs));
  }, [props.options]);

  return (
    <div className='p-6 space-y-6'>
      <div className='text-base font-semibold text-foreground'>
        {t('全局设置')}
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
        <ToggleRow
          label={t('启用请求透传')}
          helper={t(
            '开启后，所有请求将直接透传给上游，不会进行任何处理（重定向和渠道适配也将失效）,请谨慎开启',
          )}
          value={inputs['global.pass_through_request_enabled']}
          onChange={setField('global.pass_through_request_enabled')}
        />
      </div>

      <JsonField
        label={t('禁用思考处理的模型列表')}
        value={inputs['global.thinking_model_blacklist']}
        onChange={setField('global.thinking_model_blacklist')}
        placeholder={t('例如：') + '\n' + thinkingExample}
        helper={t(
          '列出的模型将不会自动添加或移除-thinking/-nothinking 后缀',
        )}
        rows={4}
      />

      <div className='space-y-3 border-t border-[color:var(--app-border)] pt-4'>
        <div className='flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground'>
          <span>{t('ChatCompletions→Responses 兼容配置')}</span>
          <span className='inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950/60 dark:text-amber-200'>
            {t('测试版')}
          </span>
        </div>

        <WarnBanner>
          {t(
            '提示：该功能为测试版，未来配置结构与功能行为可能发生变更，请勿在生产环境使用。',
          )}
        </WarnBanner>

        <JsonField
          label={t('参数配置')}
          value={inputs[policyKey]}
          onChange={setField(policyKey)}
          placeholder={
            t('例如（指定渠道）：') +
            '\n' +
            chatCompletionsToResponsesPolicyExample +
            '\n\n' +
            t('例如（全渠道）：') +
            '\n' +
            chatCompletionsToResponsesPolicyAllChannelsExample
          }
          rows={8}
        />

        <div className='flex flex-wrap items-center gap-2'>
          <Button
            variant='tertiary'
            size='sm'
            onPress={() =>
              setPolicyValue(chatCompletionsToResponsesPolicyExample)
            }
          >
            {t('填充模板（指定渠道）')}
          </Button>
          <Button
            variant='tertiary'
            size='sm'
            onPress={() =>
              setPolicyValue(
                chatCompletionsToResponsesPolicyAllChannelsExample,
              )
            }
          >
            {t('填充模板（全渠道）')}
          </Button>
          <Button
            variant='tertiary'
            size='sm'
            onPress={() => {
              const raw = inputs[policyKey];
              if (!raw || String(raw).trim() === '') return;
              try {
                const formatted = JSON.stringify(JSON.parse(raw), null, 2);
                setPolicyValue(formatted);
              } catch (error) {
                showError(t('不是合法的 JSON 字符串'));
              }
            }}
          >
            {t('格式化 JSON')}
          </Button>
        </div>
      </div>

      <div className='space-y-3 border-t border-[color:var(--app-border)] pt-4'>
        <div className='text-sm font-semibold text-foreground'>
          {t('连接保活设置')}
        </div>

        <WarnBanner>
          {t(
            '警告：启用保活后，如果已经写入保活数据后渠道出错，系统无法重试，如果必须开启，推荐设置尽可能大的Ping间隔',
          )}
        </WarnBanner>

        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <ToggleRow
            label={t('启用Ping间隔')}
            helper={t('开启后，将定期发送ping数据保持连接活跃')}
            value={inputs['general_setting.ping_interval_enabled']}
            onChange={setField('general_setting.ping_interval_enabled')}
          />
          <NumberField
            label={t('Ping间隔（秒）')}
            value={inputs['general_setting.ping_interval_seconds']}
            onChange={setField('general_setting.ping_interval_seconds')}
            min={1}
            disabled={!inputs['general_setting.ping_interval_enabled']}
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

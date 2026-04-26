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
  verifyJSON,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '@/components/common/ui/ConfirmDialog';

const DEFAULT_INPUTS = {
  ModelPrice: '',
  ModelRatio: '',
  CacheRatio: '',
  CreateCacheRatio: '',
  CompletionRatio: '',
  ImageRatio: '',
  AudioRatio: '',
  AudioCompletionRatio: '',
  ExposeRatioEnabled: false,
};

const textareaClass =
  'w-full resize-y rounded-lg border border-[color:var(--app-border)] bg-background px-3 py-2 font-mono text-sm text-foreground outline-none transition focus:border-primary';

function JsonField({ label, value, onChange, placeholder, helper, error, rows = 6 }) {
  return (
    <div className='space-y-2'>
      <div className='text-sm font-medium text-foreground'>{label}</div>
      <textarea
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        aria-label={label}
        className={`${textareaClass} ${error ? 'border-red-400 focus:border-red-500' : ''}`}
      />
      {error ? (
        <div className='text-xs text-red-600 dark:text-red-400'>{error}</div>
      ) : helper ? (
        <div className='text-xs leading-snug text-muted'>{helper}</div>
      ) : null}
    </div>
  );
}

export default function ModelRatioSettings(props) {
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [inputsRow, setInputsRow] = useState(DEFAULT_INPUTS);
  const [errors, setErrors] = useState({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const { t } = useTranslation();

  const setField = (key) => (value) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    const jsonKeys = [
      'ModelPrice',
      'ModelRatio',
      'CacheRatio',
      'CreateCacheRatio',
      'CompletionRatio',
      'ImageRatio',
      'AudioRatio',
      'AudioCompletionRatio',
    ];
    for (const key of jsonKeys) {
      const v = inputs[key];
      if (v && String(v).trim() !== '' && !verifyJSON(v)) {
        next[key] = t('不是合法的 JSON 字符串');
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = () => {
    if (!validate()) {
      showError(t('请检查输入'));
      return;
    }
    const updateArray = compareObjects(inputs, inputsRow);
    if (!updateArray.length) return showWarning(t('你似乎并没有修改什么'));

    const requestQueue = updateArray.map((item) => {
      const value =
        typeof inputs[item.key] === 'boolean'
          ? String(inputs[item.key])
          : inputs[item.key];
      return API.put('/api/option/', { key: item.key, value });
    });

    setLoading(true);
    Promise.all(requestQueue)
      .then((res) => {
        if (res.includes(undefined)) {
          return showError(
            requestQueue.length > 1
              ? t('部分保存失败，请重试')
              : t('保存失败'),
          );
        }
        for (let i = 0; i < res.length; i++) {
          if (!res[i].data?.success) {
            return showError(res[i].data?.message);
          }
        }
        showSuccess(t('保存成功'));
        props.refresh?.();
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Unexpected error:', error);
        showError(t('保存失败，请重试'));
      })
      .finally(() => setLoading(false));
  };

  const resetModelRatio = async () => {
    try {
      const res = await API.post(`/api/option/rest_model_ratio`);
      if (res.data?.success) {
        showSuccess(res.data.message);
        props.refresh?.();
      } else {
        showError(res.data?.message);
      }
    } catch (error) {
      showError(error);
    }
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
    <div className='space-y-5'>
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <JsonField
          label={t('模型固定价格')}
          value={inputs.ModelPrice}
          onChange={setField('ModelPrice')}
          placeholder={t(
            '为一个 JSON 文本，键为模型名称，值为一次调用消耗多少刀，比如 "gpt-4-gizmo-*": 0.1，一次消耗0.1刀',
          )}
          helper={t('一次调用消耗多少刀，优先级大于模型倍率')}
          error={errors.ModelPrice}
        />
        <JsonField
          label={t('模型倍率')}
          value={inputs.ModelRatio}
          onChange={setField('ModelRatio')}
          placeholder={t('为一个 JSON 文本，键为模型名称，值为倍率')}
          error={errors.ModelRatio}
        />
        <JsonField
          label={t('提示缓存倍率')}
          value={inputs.CacheRatio}
          onChange={setField('CacheRatio')}
          placeholder={t('为一个 JSON 文本，键为模型名称，值为倍率')}
          error={errors.CacheRatio}
        />
        <JsonField
          label={t('缓存创建倍率')}
          value={inputs.CreateCacheRatio}
          onChange={setField('CreateCacheRatio')}
          placeholder={t('为一个 JSON 文本，键为模型名称，值为倍率')}
          helper={t(
            '默认为 5m 缓存创建倍率；1h 缓存创建倍率按固定乘法自动计算（当前为 1.6x）',
          )}
          error={errors.CreateCacheRatio}
        />
        <JsonField
          label={t('模型补全倍率（仅对自定义模型有效）')}
          value={inputs.CompletionRatio}
          onChange={setField('CompletionRatio')}
          placeholder={t('为一个 JSON 文本，键为模型名称，值为倍率')}
          helper={t('仅对自定义模型有效')}
          error={errors.CompletionRatio}
        />
        <JsonField
          label={t('图片输入倍率（仅部分模型支持该计费）')}
          value={inputs.ImageRatio}
          onChange={setField('ImageRatio')}
          placeholder={t(
            '为一个 JSON 文本，键为模型名称，值为倍率，例如：{"gpt-image-1": 2}',
          )}
          helper={t(
            '图片输入相关的倍率设置，键为模型名称，值为倍率，仅部分模型支持该计费',
          )}
          error={errors.ImageRatio}
        />
        <JsonField
          label={t('音频倍率（仅部分模型支持该计费）')}
          value={inputs.AudioRatio}
          onChange={setField('AudioRatio')}
          placeholder={t(
            '为一个 JSON 文本，键为模型名称，值为倍率，例如：{"gpt-4o-audio-preview": 16}',
          )}
          helper={t('音频输入相关的倍率设置，键为模型名称，值为倍率')}
          error={errors.AudioRatio}
        />
        <JsonField
          label={t('音频补全倍率（仅部分模型支持该计费）')}
          value={inputs.AudioCompletionRatio}
          onChange={setField('AudioCompletionRatio')}
          placeholder={t(
            '为一个 JSON 文本，键为模型名称，值为倍率，例如：{"gpt-4o-realtime": 2}',
          )}
          helper={t('音频输出补全相关的倍率设置，键为模型名称，值为倍率')}
          error={errors.AudioCompletionRatio}
        />
      </div>

      <label className='flex items-center justify-between gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-background)] p-4'>
        <span className='text-sm font-medium text-foreground'>
          {t('暴露倍率接口')}
        </span>
        <Switch
          isSelected={!!inputs.ExposeRatioEnabled}
          onChange={setField('ExposeRatioEnabled')}
          aria-label={t('暴露倍率接口')}
          size='sm'
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>
      </label>

      <div className='flex flex-wrap items-center gap-2 border-t border-[color:var(--app-border)] pt-4'>
        <Button
          color='primary'
          onPress={onSubmit}
          isPending={loading}
          className='min-w-[140px]'
        >
          {t('保存模型倍率设置')}
        </Button>
        <Button color='danger' onPress={() => setShowResetConfirm(true)}>
          {t('重置模型倍率')}
        </Button>
      </div>

      <ConfirmDialog
        visible={showResetConfirm}
        title={t('确定重置模型倍率吗？')}
        cancelText={t('取消')}
        confirmText={t('确定')}
        danger
        onCancel={() => setShowResetConfirm(false)}
        onConfirm={() => {
          setShowResetConfirm(false);
          resetModelRatio();
        }}
      >
        {t('此修改将不可逆')}
      </ConfirmDialog>
    </div>
  );
}

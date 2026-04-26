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
import { Button, Input } from '@heroui/react';
import {
  API,
  removeTrailingSlash,
  showError,
  showSuccess,
  verifyJSON,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

const DEFAULT_INPUTS = {
  ServerAddress: '',
  CustomCallbackAddress: '',
  TopupGroupRatio: '',
  PayMethods: '',
  AmountOptions: '',
  AmountDiscount: '',
};

const inputClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary';

const textareaClass =
  'w-full resize-y rounded-lg border border-[color:var(--app-border)] bg-background px-3 py-2 font-mono text-sm text-foreground outline-none transition focus:border-primary';

function TextField({ label, value, onChange, placeholder, helper }) {
  return (
    <div className='space-y-2'>
      <div className='text-sm font-medium text-foreground'>{label}</div>
      <Input
        type='text'
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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

export default function SettingsGeneralPayment(props) {
  const { t } = useTranslation();
  const sectionTitle = props.hideSectionTitle ? undefined : t('通用设置');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [originInputs, setOriginInputs] = useState(DEFAULT_INPUTS);

  const setField = (field) => (value) =>
    setInputs((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    if (!props.options) return;
    const next = {
      ServerAddress: props.options.ServerAddress || '',
      CustomCallbackAddress: props.options.CustomCallbackAddress || '',
      TopupGroupRatio: props.options.TopupGroupRatio || '',
      PayMethods: props.options.PayMethods || '',
      AmountOptions: props.options.AmountOptions || '',
      AmountDiscount: props.options.AmountDiscount || '',
    };
    setInputs(next);
    setOriginInputs({ ...next });
  }, [props.options]);

  const submit = async () => {
    if (
      originInputs.TopupGroupRatio !== inputs.TopupGroupRatio &&
      !verifyJSON(inputs.TopupGroupRatio)
    ) {
      showError(t('充值分组倍率不是合法的 JSON 字符串'));
      return;
    }
    if (
      originInputs.PayMethods !== inputs.PayMethods &&
      !verifyJSON(inputs.PayMethods)
    ) {
      showError(t('充值方式设置不是合法的 JSON 字符串'));
      return;
    }
    if (
      originInputs.AmountOptions !== inputs.AmountOptions &&
      inputs.AmountOptions.trim() !== '' &&
      !verifyJSON(inputs.AmountOptions)
    ) {
      showError(t('自定义充值数量选项不是合法的 JSON 数组'));
      return;
    }
    if (
      originInputs.AmountDiscount !== inputs.AmountDiscount &&
      inputs.AmountDiscount.trim() !== '' &&
      !verifyJSON(inputs.AmountDiscount)
    ) {
      showError(t('充值金额折扣配置不是合法的 JSON 对象'));
      return;
    }

    setLoading(true);
    try {
      const options = [
        {
          key: 'ServerAddress',
          value: removeTrailingSlash(inputs.ServerAddress),
        },
      ];

      if (inputs.CustomCallbackAddress !== '') {
        options.push({
          key: 'CustomCallbackAddress',
          value: removeTrailingSlash(inputs.CustomCallbackAddress),
        });
      }
      if (originInputs.TopupGroupRatio !== inputs.TopupGroupRatio) {
        options.push({ key: 'TopupGroupRatio', value: inputs.TopupGroupRatio });
      }
      if (originInputs.PayMethods !== inputs.PayMethods) {
        options.push({ key: 'PayMethods', value: inputs.PayMethods });
      }
      if (originInputs.AmountOptions !== inputs.AmountOptions) {
        options.push({
          key: 'payment_setting.amount_options',
          value: inputs.AmountOptions,
        });
      }
      if (originInputs.AmountDiscount !== inputs.AmountDiscount) {
        options.push({
          key: 'payment_setting.amount_discount',
          value: inputs.AmountDiscount,
        });
      }

      const results = await Promise.all(
        options.map((option) =>
          API.put('/api/option/', { key: option.key, value: option.value }),
        ),
      );

      const errorResults = results.filter((res) => !res.data?.success);
      if (errorResults.length === 0) {
        showSuccess(t('更新成功'));
        setOriginInputs({ ...inputs });
        props.refresh?.();
      } else {
        errorResults.forEach((res) => showError(res.data.message));
      }
    } catch (error) {
      showError(t('更新失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='p-6 space-y-6'>
      {sectionTitle ? (
        <div>
          <div className='text-base font-semibold text-foreground'>
            {sectionTitle}
          </div>
        </div>
      ) : null}

      <TextField
        label={t('服务器地址')}
        value={inputs.ServerAddress}
        onChange={setField('ServerAddress')}
        placeholder='https://yourdomain.com'
        helper={t(
          '该服务器地址将影响支付回调地址以及默认首页展示的地址，请确保正确配置',
        )}
      />

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <TextField
          label={t('回调地址')}
          value={inputs.CustomCallbackAddress}
          onChange={setField('CustomCallbackAddress')}
          placeholder={t('例如：https://yourdomain.com')}
          helper={t('留空时默认使用服务器地址作为回调地址，填写后将覆盖默认值')}
        />
        <JsonField
          label={t('充值分组倍率')}
          value={inputs.TopupGroupRatio}
          onChange={setField('TopupGroupRatio')}
          placeholder={t('为一个 JSON 文本，键为组名称，值为倍率')}
        />
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <JsonField
          label={t('充值方式设置')}
          value={inputs.PayMethods}
          onChange={setField('PayMethods')}
          placeholder={t('为一个 JSON 文本')}
        />
        <JsonField
          label={t('自定义充值数量选项')}
          value={inputs.AmountOptions}
          onChange={setField('AmountOptions')}
          placeholder={t('为一个 JSON 数组，例如：[10, 20, 50, 100, 200, 500]')}
          helper={t(
            '设置用户可选择的充值数量选项，例如：[10, 20, 50, 100, 200, 500]',
          )}
        />
      </div>

      <JsonField
        label={t('充值金额折扣配置')}
        value={inputs.AmountDiscount}
        onChange={setField('AmountDiscount')}
        placeholder={t(
          '为一个 JSON 对象，例如：{"100": 0.95, "200": 0.9, "500": 0.85}',
        )}
        helper={t(
          '设置不同充值金额对应的折扣，键为充值金额，值为折扣率，例如：{"100": 0.95, "200": 0.9, "500": 0.85}',
        )}
      />

      <div className='border-t border-[color:var(--app-border)] pt-4'>
        <Button
          color='primary'
          size='md'
          onPress={submit}
          isPending={loading}
          className='min-w-[100px]'
        >
          {t('保存通用设置')}
        </Button>
      </div>
    </div>
  );
}

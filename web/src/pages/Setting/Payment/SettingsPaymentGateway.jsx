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
} from '../../../helpers';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';

const inputClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary';

function Field({ label, value, onChange, placeholder, type = 'text', helper, step, min, max }) {
  return (
    <div className='space-y-2'>
      <div className='text-sm font-medium text-foreground'>{label}</div>
      <Input
        type={type}
        value={value === '' || value == null ? '' : String(value)}
        onChange={(e) => {
          const v = e.target.value;
          if (type === 'number') {
            onChange(v === '' ? '' : Number(v));
          } else {
            onChange(v);
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        step={step}
        min={min}
        max={max}
        className={inputClass}
      />
      {helper ? (
        <div className='text-xs leading-snug text-muted'>{helper}</div>
      ) : null}
    </div>
  );
}

const DEFAULT_INPUTS = {
  PayAddress: '',
  EpayId: '',
  EpayKey: '',
  Price: 7.3,
  MinTopUp: 1,
};

export default function SettingsPaymentGateway(props) {
  const { t } = useTranslation();
  const sectionTitle = props.hideSectionTitle ? undefined : t('易支付设置');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);

  const setField = (field) => (value) =>
    setInputs((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    if (!props.options) return;
    setInputs({
      PayAddress: props.options.PayAddress || '',
      EpayId: props.options.EpayId || '',
      EpayKey: props.options.EpayKey || '',
      Price:
        props.options.Price !== undefined
          ? parseFloat(props.options.Price)
          : 7.3,
      MinTopUp:
        props.options.MinTopUp !== undefined
          ? parseFloat(props.options.MinTopUp)
          : 1,
    });
  }, [props.options]);

  const submit = async () => {
    if (props.options?.ServerAddress === '') {
      showError(t('请先填写服务器地址'));
      return;
    }
    setLoading(true);
    try {
      const options = [
        { key: 'PayAddress', value: removeTrailingSlash(inputs.PayAddress) },
      ];
      if (inputs.EpayId !== '') {
        options.push({ key: 'EpayId', value: inputs.EpayId });
      }
      if (inputs.EpayKey !== undefined && inputs.EpayKey !== '') {
        options.push({ key: 'EpayKey', value: inputs.EpayKey });
      }
      if (inputs.Price !== '') {
        options.push({ key: 'Price', value: inputs.Price.toString() });
      }
      if (inputs.MinTopUp !== '') {
        options.push({ key: 'MinTopUp', value: inputs.MinTopUp.toString() });
      }

      const requestQueue = options.map((opt) =>
        API.put('/api/option/', { key: opt.key, value: opt.value }),
      );
      const results = await Promise.all(requestQueue);
      const errorResults = results.filter((res) => !res.data?.success);
      if (errorResults.length > 0) {
        errorResults.forEach((res) => showError(res.data.message));
      } else {
        showSuccess(t('更新成功'));
        props.refresh?.();
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

      <div className='flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200'>
        <Info size={16} className='mt-0.5 shrink-0' />
        <div>
          {t('当前仅支持易支付接口，回调地址请在通用设置中配置。')}
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
        <Field
          label={t('支付地址')}
          value={inputs.PayAddress}
          onChange={setField('PayAddress')}
          placeholder={t('例如：https://yourdomain.com')}
        />
        <Field
          label={t('商户 ID')}
          value={inputs.EpayId}
          onChange={setField('EpayId')}
          placeholder={t('例如：0001')}
        />
        <Field
          label={t('API 密钥')}
          value={inputs.EpayKey}
          onChange={setField('EpayKey')}
          placeholder={t('敏感信息不会发送到前端显示')}
          type='password'
        />
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <Field
          label={t('充值价格（x元/美金）')}
          value={inputs.Price}
          onChange={setField('Price')}
          placeholder={t('例如：7，就是7元/美金')}
          type='number'
          step='0.01'
        />
        <Field
          label={t('最低充值美元数量')}
          value={inputs.MinTopUp}
          onChange={setField('MinTopUp')}
          placeholder={t('例如：2，就是最低充值2$')}
          type='number'
          step='0.01'
        />
      </div>

      <div className='border-t border-[color:var(--app-border)] pt-4'>
        <Button
          color='primary'
          size='md'
          onPress={submit}
          isPending={loading}
          className='min-w-[120px]'
        >
          {t('更新易支付设置')}
        </Button>
      </div>
    </div>
  );
}

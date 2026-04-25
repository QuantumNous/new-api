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
  removeTrailingSlash,
  showError,
  showSuccess,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';
import { BookOpen, TriangleAlert } from 'lucide-react';

const inputClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary';

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  helper,
  step,
}) {
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
        className={inputClass}
      />
      {helper ? (
        <div className='text-xs leading-snug text-muted'>{helper}</div>
      ) : null}
    </div>
  );
}

const DEFAULT_INPUTS = {
  StripeApiSecret: '',
  StripeWebhookSecret: '',
  StripePriceId: '',
  StripeUnitPrice: 8.0,
  StripeMinTopUp: 1,
  StripePromotionCodesEnabled: false,
};

export default function SettingsPaymentGatewayStripe(props) {
  const { t } = useTranslation();
  const sectionTitle = props.hideSectionTitle ? undefined : t('Stripe 设置');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [originInputs, setOriginInputs] = useState(DEFAULT_INPUTS);

  const setField = (field) => (value) =>
    setInputs((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    if (!props.options) return;
    const next = {
      StripeApiSecret: props.options.StripeApiSecret || '',
      StripeWebhookSecret: props.options.StripeWebhookSecret || '',
      StripePriceId: props.options.StripePriceId || '',
      StripeUnitPrice:
        props.options.StripeUnitPrice !== undefined
          ? parseFloat(props.options.StripeUnitPrice)
          : 8.0,
      StripeMinTopUp:
        props.options.StripeMinTopUp !== undefined
          ? parseFloat(props.options.StripeMinTopUp)
          : 1,
      StripePromotionCodesEnabled:
        props.options.StripePromotionCodesEnabled === true ||
        props.options.StripePromotionCodesEnabled === 'true',
    };
    setInputs(next);
    setOriginInputs({ ...next });
  }, [props.options]);

  const submit = async () => {
    if (props.options?.ServerAddress === '') {
      showError(t('请先填写服务器地址'));
      return;
    }
    setLoading(true);
    try {
      const options = [];

      if (inputs.StripeApiSecret) {
        options.push({ key: 'StripeApiSecret', value: inputs.StripeApiSecret });
      }
      if (inputs.StripeWebhookSecret) {
        options.push({
          key: 'StripeWebhookSecret',
          value: inputs.StripeWebhookSecret,
        });
      }
      if (inputs.StripePriceId !== '') {
        options.push({ key: 'StripePriceId', value: inputs.StripePriceId });
      }
      if (inputs.StripeUnitPrice != null) {
        options.push({
          key: 'StripeUnitPrice',
          value: inputs.StripeUnitPrice.toString(),
        });
      }
      if (inputs.StripeMinTopUp != null) {
        options.push({
          key: 'StripeMinTopUp',
          value: inputs.StripeMinTopUp.toString(),
        });
      }
      if (
        originInputs.StripePromotionCodesEnabled !==
        inputs.StripePromotionCodesEnabled
      ) {
        options.push({
          key: 'StripePromotionCodesEnabled',
          value: inputs.StripePromotionCodesEnabled ? 'true' : 'false',
        });
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
        setOriginInputs({ ...inputs });
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

      <div className='space-y-3'>
        <div className='flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200'>
          <BookOpen size={16} className='mt-0.5 shrink-0' />
          <div className='space-y-1'>
            <div>
              Stripe 密钥、Webhook 等设置请
              <a
                href='https://dashboard.stripe.com/developers'
                target='_blank'
                rel='noreferrer'
                className='mx-1 text-primary underline'
              >
                点击此处
              </a>
              进行设置，建议先在
              <a
                href='https://dashboard.stripe.com/test/developers'
                target='_blank'
                rel='noreferrer'
                className='mx-1 text-primary underline'
              >
                测试环境
              </a>
              完成联调。
            </div>
            <div>
              {t('回调地址')}：
              {props.options?.ServerAddress
                ? removeTrailingSlash(props.options.ServerAddress)
                : t('网站地址')}
              /api/stripe/webhook
            </div>
          </div>
        </div>

        <div className='flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100'>
          <TriangleAlert size={16} className='mt-0.5 shrink-0' />
          <div>
            {t(
              '需要包含事件：checkout.session.completed 和 checkout.session.expired',
            )}
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
        <Field
          label={t('API 密钥')}
          value={inputs.StripeApiSecret}
          onChange={setField('StripeApiSecret')}
          placeholder={t('例如：sk_xxx 或 rk_xxx，留空表示保持当前不变')}
          helper={t('保存后不会回显，请填写当前环境对应的 Stripe API 密钥')}
          type='password'
        />
        <Field
          label={t('Webhook 签名密钥')}
          value={inputs.StripeWebhookSecret}
          onChange={setField('StripeWebhookSecret')}
          placeholder={t('例如：whsec_xxx，留空表示保持当前不变')}
          helper={t('用于校验 Stripe Webhook 签名，保存后不会回显')}
          type='password'
        />
        <Field
          label={t('商品价格 ID')}
          value={inputs.StripePriceId}
          onChange={setField('StripePriceId')}
          placeholder={t('例如：price_xxx')}
          helper={t('在 Stripe 后台创建价格后获得')}
        />
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
        <Field
          label={t('充值价格（x元/美金）')}
          value={inputs.StripeUnitPrice}
          onChange={setField('StripeUnitPrice')}
          placeholder={t('例如：7，就是7元/美金')}
          helper={t('按 1 美元对应的站内价格填写')}
          type='number'
          step='0.01'
        />
        <Field
          label={t('最低充值美元数量')}
          value={inputs.StripeMinTopUp}
          onChange={setField('StripeMinTopUp')}
          placeholder={t('例如：2，就是最低充值2$')}
          helper={t('用户单次最少可充值的美元数量')}
          type='number'
          step='0.01'
        />
        <label className='flex items-start justify-between gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-background)] p-4'>
          <div className='min-w-0 flex-1'>
            <div className='text-sm font-medium text-foreground'>
              {t('允许在 Stripe 支付中输入促销码')}
            </div>
          </div>
          <Switch
            isSelected={!!inputs.StripePromotionCodesEnabled}
            onChange={setField('StripePromotionCodesEnabled')}
            aria-label={t('允许在 Stripe 支付中输入促销码')}
            size='sm'
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
        </label>
      </div>

      <div className='border-t border-[color:var(--app-border)] pt-4'>
        <Button
          color='primary'
          size='md'
          onPress={submit}
          isPending={loading}
          className='min-w-[120px]'
        >
          {t('更新 Stripe 设置')}
        </Button>
      </div>
    </div>
  );
}

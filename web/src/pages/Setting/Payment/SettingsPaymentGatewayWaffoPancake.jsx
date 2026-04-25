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
import { BookOpen, TriangleAlert } from 'lucide-react';
import {
  API,
  removeTrailingSlash,
  showError,
  showSuccess,
} from '../../../helpers';
import { useTranslation } from 'react-i18next';

const defaultInputs = {
  WaffoPancakeEnabled: false,
  WaffoPancakeSandbox: false,
  WaffoPancakeMerchantID: '',
  WaffoPancakePrivateKey: '',
  WaffoPancakeWebhookPublicKey: '',
  WaffoPancakeWebhookTestKey: '',
  WaffoPancakeStoreID: '',
  WaffoPancakeProductID: '',
  WaffoPancakeReturnURL: '',
  WaffoPancakeCurrency: 'USD',
  WaffoPancakeUnitPrice: 1.0,
  WaffoPancakeMinTopUp: 1,
};

const toBoolean = (value) => value === true || value === 'true';

const inputClass =
  'h-10 w-full rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:opacity-50';
const textareaClass =
  'w-full resize-y rounded-lg border border-[color:var(--app-border)] bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary';

function Field({ label, value, onChange, placeholder, type = 'text', helper, step }) {
  return (
    <div className='space-y-2'>
      <div className='text-sm font-medium text-foreground'>{label}</div>
      <Input
        type={type}
        value={value === '' || value == null ? '' : String(value)}
        onChange={(event) => {
          const v = event.target.value;
          if (type === 'number') {
            onChange(v === '' ? '' : Number(v));
          } else {
            onChange(v);
          }
        }}
        placeholder={placeholder}
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

function TextAreaField({ label, value, onChange, placeholder, helper, rows = 4, type }) {
  return (
    <div className='space-y-2'>
      <div className='text-sm font-medium text-foreground'>{label}</div>
      <textarea
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        aria-label={label}
        // For textareas with secret content we render as type=text so users can verify;
        // upstream label already says "保存后不会回显".
        data-secret={type === 'password' ? 'true' : undefined}
        className={textareaClass}
      />
      {helper ? (
        <div className='text-xs leading-snug text-muted'>{helper}</div>
      ) : null}
    </div>
  );
}

function ToggleRow({ label, value, onChange, helper }) {
  return (
    <label className='flex items-start justify-between gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-background)] p-4'>
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
    </label>
  );
}

export default function SettingsPaymentGatewayWaffoPancake(props) {
  const { t } = useTranslation();
  const sectionTitle = props.hideSectionTitle
    ? undefined
    : t('Waffo Pancake 设置');
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState(defaultInputs);

  const setField = (key) => (value) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!props.options) return;
    setInputs({
      WaffoPancakeEnabled: toBoolean(props.options.WaffoPancakeEnabled),
      WaffoPancakeSandbox: toBoolean(props.options.WaffoPancakeSandbox),
      WaffoPancakeMerchantID: props.options.WaffoPancakeMerchantID || '',
      WaffoPancakePrivateKey: props.options.WaffoPancakePrivateKey || '',
      WaffoPancakeWebhookPublicKey:
        props.options.WaffoPancakeWebhookPublicKey || '',
      WaffoPancakeWebhookTestKey:
        props.options.WaffoPancakeWebhookTestKey || '',
      WaffoPancakeStoreID: props.options.WaffoPancakeStoreID || '',
      WaffoPancakeProductID: props.options.WaffoPancakeProductID || '',
      WaffoPancakeReturnURL: props.options.WaffoPancakeReturnURL || '',
      WaffoPancakeCurrency: props.options.WaffoPancakeCurrency || 'USD',
      WaffoPancakeUnitPrice:
        props.options.WaffoPancakeUnitPrice !== undefined
          ? parseFloat(props.options.WaffoPancakeUnitPrice)
          : 1.0,
      WaffoPancakeMinTopUp:
        props.options.WaffoPancakeMinTopUp !== undefined
          ? parseFloat(props.options.WaffoPancakeMinTopUp)
          : 1,
    });
  }, [props.options]);

  const submitWaffoPancakeSetting = async () => {
    const values = inputs;
    const currentWebhookField = values.WaffoPancakeSandbox
      ? 'WaffoPancakeWebhookTestKey'
      : 'WaffoPancakeWebhookPublicKey';
    const currentWebhookLabel = values.WaffoPancakeSandbox
      ? t('Webhook 公钥（测试环境）')
      : t('Webhook 公钥（生产环境）');

    if (values.WaffoPancakeEnabled && !values.WaffoPancakeMerchantID.trim()) {
      showError(t('请输入商户 ID'));
      return;
    }
    if (values.WaffoPancakeEnabled && !values.WaffoPancakeStoreID.trim()) {
      showError(t('请输入 Store ID'));
      return;
    }
    if (values.WaffoPancakeEnabled && !values.WaffoPancakeProductID.trim()) {
      showError(t('请输入 Product ID'));
      return;
    }
    if (
      values.WaffoPancakeEnabled &&
      !String(values[currentWebhookField] || '').trim()
    ) {
      showError(currentWebhookLabel);
      return;
    }
    if (
      values.WaffoPancakeEnabled &&
      Number(values.WaffoPancakeUnitPrice) <= 0
    ) {
      showError(t('充值价格必须大于 0'));
      return;
    }
    if (values.WaffoPancakeEnabled && Number(values.WaffoPancakeMinTopUp) < 1) {
      showError(t('最低充值美元数量必须大于 0'));
      return;
    }

    setLoading(true);
    try {
      const options = [
        {
          key: 'WaffoPancakeEnabled',
          value: values.WaffoPancakeEnabled ? 'true' : 'false',
        },
        {
          key: 'WaffoPancakeSandbox',
          value: values.WaffoPancakeSandbox ? 'true' : 'false',
        },
        {
          key: 'WaffoPancakeMerchantID',
          value: values.WaffoPancakeMerchantID || '',
        },
        { key: 'WaffoPancakeStoreID', value: values.WaffoPancakeStoreID || '' },
        {
          key: 'WaffoPancakeProductID',
          value: values.WaffoPancakeProductID || '',
        },
        {
          key: 'WaffoPancakeReturnURL',
          value: removeTrailingSlash(values.WaffoPancakeReturnURL || ''),
        },
        {
          key: 'WaffoPancakeCurrency',
          value: values.WaffoPancakeCurrency || 'USD',
        },
        {
          key: 'WaffoPancakeUnitPrice',
          value: String(values.WaffoPancakeUnitPrice),
        },
        {
          key: 'WaffoPancakeMinTopUp',
          value: String(values.WaffoPancakeMinTopUp),
        },
      ];

      if ((values.WaffoPancakePrivateKey || '').trim()) {
        options.push({
          key: 'WaffoPancakePrivateKey',
          value: values.WaffoPancakePrivateKey,
        });
      }
      if ((values.WaffoPancakeWebhookPublicKey || '').trim()) {
        options.push({
          key: 'WaffoPancakeWebhookPublicKey',
          value: values.WaffoPancakeWebhookPublicKey,
        });
      }
      if ((values.WaffoPancakeWebhookTestKey || '').trim()) {
        options.push({
          key: 'WaffoPancakeWebhookTestKey',
          value: values.WaffoPancakeWebhookTestKey,
        });
      }

      const results = await Promise.all(
        options.map((opt) =>
          API.put('/api/option/', { key: opt.key, value: opt.value }),
        ),
      );

      const errorResults = results.filter((res) => !res.data?.success);
      if (errorResults.length > 0) {
        errorResults.forEach((res) => showError(res.data?.message));
        return;
      }
      showSuccess(t('更新成功'));
      props.refresh?.();
    } catch (error) {
      showError(t('更新失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='p-6 space-y-6'>
      {sectionTitle ? (
        <div className='text-base font-semibold text-foreground'>
          {sectionTitle}
        </div>
      ) : null}

      <div className='space-y-3'>
        <div className='flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200'>
          <BookOpen size={16} className='mt-0.5 shrink-0' />
          <div className='space-y-1'>
            <div>
              Waffo Pancake 的商户、商品和签名密钥请
              <a
                href='https://docs.waffo.ai'
                target='_blank'
                rel='noreferrer'
                className='mx-1 text-primary underline'
              >
                点击此处
              </a>
              获取，建议先在测试环境完成联调。
            </div>
            <div>
              {t('回调地址')}：
              {props.options?.ServerAddress
                ? removeTrailingSlash(props.options.ServerAddress)
                : t('网站地址')}
              /api/waffo-pancake/webhook
            </div>
          </div>
        </div>

        <div className='flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100'>
          <TriangleAlert size={16} className='mt-0.5 shrink-0' />
          <div>
            {t('请确认 Merchant、Store、Product 和所选环境密钥一致。')}
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
        <ToggleRow
          label={t('启用 Waffo Pancake')}
          value={inputs.WaffoPancakeEnabled}
          onChange={setField('WaffoPancakeEnabled')}
        />
        <ToggleRow
          label={t('沙盒模式')}
          value={inputs.WaffoPancakeSandbox}
          onChange={setField('WaffoPancakeSandbox')}
          helper={t('用于切换当前下单和回调校验所使用的环境')}
        />
        <Field
          label={t('货币')}
          value={inputs.WaffoPancakeCurrency}
          onChange={setField('WaffoPancakeCurrency')}
          placeholder='USD'
          helper={t('默认使用 USD 结算')}
        />
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
        <Field
          label={t('商户 ID')}
          value={inputs.WaffoPancakeMerchantID}
          onChange={setField('WaffoPancakeMerchantID')}
          placeholder={t('例如：MER_xxx')}
          helper={t('请填写当前环境对应的商户 ID')}
        />
        <Field
          label={t('Store ID')}
          value={inputs.WaffoPancakeStoreID}
          onChange={setField('WaffoPancakeStoreID')}
          placeholder={t('例如：STO_xxx')}
          helper={t('请填写当前环境对应的 Store ID')}
        />
        <Field
          label={t('Product ID')}
          value={inputs.WaffoPancakeProductID}
          onChange={setField('WaffoPancakeProductID')}
          placeholder={t('例如：PROD_xxx')}
          helper={t('请填写当前环境对应的 Product ID')}
        />
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <TextAreaField
          label={t('API 私钥')}
          value={inputs.WaffoPancakePrivateKey}
          onChange={setField('WaffoPancakePrivateKey')}
          placeholder={t('填写后覆盖当前私钥，留空表示保持当前不变')}
          helper={t('保存后不会回显，请填写当前环境对应的 API 私钥')}
          type='password'
        />
        <Field
          label={t('支付返回地址')}
          value={inputs.WaffoPancakeReturnURL}
          onChange={setField('WaffoPancakeReturnURL')}
          placeholder={t('例如：https://example.com/console/topup')}
          helper={t('留空则自动使用当前站点的默认充值页地址')}
        />
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <TextAreaField
          label={t('Webhook 公钥（生产环境）')}
          value={inputs.WaffoPancakeWebhookPublicKey}
          onChange={setField('WaffoPancakeWebhookPublicKey')}
          placeholder={t(
            '填写后覆盖当前生产环境 Webhook 公钥，留空表示保持当前不变',
          )}
          helper={t('用于校验生产环境的 Waffo Pancake Webhook 签名')}
          type='password'
        />
        <TextAreaField
          label={t('Webhook 公钥（测试环境）')}
          value={inputs.WaffoPancakeWebhookTestKey}
          onChange={setField('WaffoPancakeWebhookTestKey')}
          placeholder={t(
            '填写后覆盖当前测试环境 Webhook 公钥，留空表示保持当前不变',
          )}
          helper={t('用于校验测试环境的 Waffo Pancake Webhook 签名')}
          type='password'
        />
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <Field
          label={t('充值价格（x元/美金）')}
          value={inputs.WaffoPancakeUnitPrice}
          onChange={setField('WaffoPancakeUnitPrice')}
          placeholder={t('例如：7，就是7元/美金')}
          helper={t('按 1 美元对应的站内价格填写')}
          type='number'
          step='0.01'
        />
        <Field
          label={t('最低充值美元数量')}
          value={inputs.WaffoPancakeMinTopUp}
          onChange={setField('WaffoPancakeMinTopUp')}
          placeholder={t('例如：2，就是最低充值2$')}
          helper={t('用户单次最少可充值的美元数量')}
          type='number'
          step='0.01'
        />
      </div>

      <div className='border-t border-[color:var(--app-border)] pt-4'>
        <Button
          color='primary'
          size='md'
          onPress={submitWaffoPancakeSetting}
          isPending={loading}
          className='min-w-[180px]'
        >
          {t('更新 Waffo Pancake 设置')}
        </Button>
      </div>
    </div>
  );
}
